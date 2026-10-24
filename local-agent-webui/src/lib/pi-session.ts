import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {
  HarnessAgent,
  type HarnessAgentResumeSessionState,
} from '@ai-sdk/harness/agent';
import { createPi } from '@ai-sdk/harness-pi';
import { getAgentDir, getPiConfiguration } from './pi-config';
import { chatIdSchema } from './request';
import { createLocalSandbox, privateSessionDirectory } from './local-sandbox';
import { loadHarnessResources, nativeTools } from './harness-resources';
import type { HarnessInfo, PermissionMode, ThinkingLevel } from './types';

const dataDir = resolve(
  /* turbopackIgnore: true */ process.env.PI_WEB_DATA_DIR || '.data',
);
const globalSessions = globalThis as typeof globalThis & {
  piChatBusy?: Set<string>;
};
const busy = (globalSessions.piChatBusy ??= new Set<string>());
export function acquireChat(id: string) {
  chatIdSchema.parse(id);
  if (busy.has(id)) return false;
  busy.add(id);
  return true;
}
export function releaseChat(id: string) {
  busy.delete(id);
}
export function sessionDir(id: string) {
  return join(dataDir, 'sessions', chatIdSchema.parse(id));
}

export async function openChatSession(
  id: string,
  model: string,
  thinkingLevel: ThinkingLevel,
  options: {
    permissionMode?: PermissionMode;
    onRuntime?: (info: HarnessInfo) => void;
  } = {},
) {
  const { providers } = await getPiConfiguration();
  const resources = await loadHarnessResources();
  const dir = sessionDir(id);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  let resumeFrom: HarnessAgentResumeSessionState | undefined;
  try {
    resumeFrom = JSON.parse(await readFile(join(dir, 'state.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      throw new Error('会话恢复文件无法读取，请新建对话。');
  }
  let previous: HarnessInfo | undefined;
  try {
    previous = JSON.parse(await readFile(join(dir, 'runtime.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous?.workspace && previous.workspace !== resources.info.workspace)
    throw new Error('此会话的工作目录已改变，请新建对话。');
  const engineSessionId =
    previous?.engineSessionId ??
    (resumeFrom
      ? id
      : `pi-web-${createHash('sha256').update(dataDir).digest('hex').slice(0, 12)}-${id}`);
  const sandbox = createLocalSandbox(
    resources.info.workspace,
    engineSessionId,
    join(dir, 'sandbox'),
  );
  const runtimeInfo: HarnessInfo = { ...resources.info, engineSessionId };
  const agent = new HarnessAgent({
    harness: createPi({
      providers,
      auth: 'custom',
      thinkingLevel,
      reattachInProcess: false,
      fileToolPathPolicy: {
        readableRoots: resources.readableRoots,
        deniedRoots: ['auth.json', 'models.json', 'mcp.json'].map((name) =>
          join(/* turbopackIgnore: true */ getAgentDir(), name),
        ),
      },
      mcpServers: resources.mcpServers,
      extensionFactories: [
        (pi) => {
          pi.on('before_agent_start', (event) => {
            // The adapter deliberately disables filesystem discovery. Reuse Pi's
            // own prompt builder with its native resource catalog and source paths.
            resources.applyPrompt(event.systemPromptOptions);
            const active = new Set(pi.getActiveTools());
            runtimeInfo.tools = pi
              .getAllTools()
              .filter((tool) => active.has(tool.name))
              .map((tool) => {
                const name = tool.name === 'find' ? 'glob' : tool.name;
                return {
                  name,
                  description:
                    nativeTools.find((item) => item.name === name)
                      ?.description ?? tool.description,
                };
              });
            runtimeInfo.systemPrompt = event.systemPrompt;
            runtimeInfo.promptStatus = 'loaded';
            runtimeInfo.loadedAt = new Date().toISOString();
            options.onRuntime?.(runtimeInfo);
          });
        },
      ],
    }),
    model,
    permissionMode: options.permissionMode ?? 'allow-reads',
    sandboxConfig: { workDir: '.' },
  });
  try {
    const session = await agent.createSession({
      sessionId: engineSessionId,
      resumeFrom,
      sandboxSession: sandbox,
    });
    if (session.hasUnfinishedTurn() && previous?.promptStatus === 'loaded') {
      Object.assign(runtimeInfo, previous);
      options.onRuntime?.(runtimeInfo);
    }
    return {
      agent,
      session,
      resources,
      runtimeInfo,
      async close() {
        try {
          const state = await session.stop();
          for (const [name, value] of [
            ['state', state],
            ['runtime', runtimeInfo],
          ] as const) {
            const temp = join(dir, `${name}-${randomUUID()}.tmp`);
            await writeFile(temp, JSON.stringify(value), { mode: 0o600 });
            await rename(temp, join(dir, `${name}.json`));
          }
        } finally {
          await sandbox.destroy();
        }
      },
    };
  } catch (error) {
    await sandbox.destroy();
    throw error;
  }
}
export async function deleteChatSession(id: string) {
  if (!acquireChat(id)) return false;
  try {
    const dir = sessionDir(id);
    // Delete native state only for a conversation owned by this application.
    try {
      const runtime = JSON.parse(
        await readFile(join(dir, 'runtime.json'), 'utf8'),
      ) as HarnessInfo;
      await rm(privateSessionDirectory(runtime.engineSessionId ?? id), {
        recursive: true,
        force: true,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await rm(dir, { recursive: true, force: true });
    return true;
  } finally {
    releaseChat(id);
  }
}

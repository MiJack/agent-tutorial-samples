import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  access,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type Payload = {
  model: string;
  messages: { role: string; content: unknown }[];
  tools?: {
    function: {
      name: string;
      parameters: { properties: Record<string, unknown> };
    };
  }[];
};
function events(text: string): Record<string, unknown>[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)));
}

test(
  'native Harness executes real tools, pauses for approvals, loads Skills/prompts, and restores old sessions',
  { timeout: 120_000 },
  async () => {
    const temp = await mkdtemp(join(tmpdir(), 'pi-harness-tools-'));
    const workspace = join(temp, 'project');
    const agentDir = join(temp, 'agent');
    const skillPath = join(agentDir, 'skills', 'color-workflow', 'SKILL.md');
    await mkdir(join(workspace, '.pi'), { recursive: true });
    await mkdir(join(agentDir, 'skills', 'color-workflow'), {
      recursive: true,
    });
    await mkdir(join(agentDir, 'skills', 'hidden-workflow'), {
      recursive: true,
    });
    await writeFile(
      skillPath,
      '---\nname: color-workflow\ndescription: Specialized color workflow for auto discovery\n---\nSkill token: BLUE_NATIVE_SKILL\n',
    );
    await writeFile(
      join(agentDir, 'skills/hidden-workflow/SKILL.md'),
      '---\nname: hidden-workflow\ndescription: Manual workflow\ndisable-model-invocation: true\n---\nMANUAL_SECRET_MARKER\n',
    );
    await writeFile(
      join(agentDir, 'SYSTEM.md'),
      'GLOBAL_SYSTEM_MUST_BE_OVERRIDDEN',
    );
    await writeFile(
      join(workspace, '.pi/SYSTEM.md'),
      'PROJECT_SYSTEM_ACTIVE. You are a coding agent with tools.',
    );
    await writeFile(
      join(workspace, '.pi/APPEND_SYSTEM.md'),
      'APPEND_NATIVE_ACTIVE',
    );
    await writeFile(join(workspace, 'AGENTS.md'), 'PROJECT_CONTEXT_ACTIVE');
    const previous = Object.fromEntries(
      [
        'PI_CODING_AGENT_DIR',
        'PI_WEB_DATA_DIR',
        'PI_WEB_WORKSPACE',
        'PI_WEB_SKILL_DIRS',
      ].map((key) => [key, process.env[key]]),
    );
    process.env.PI_CODING_AGENT_DIR = agentDir;
    process.env.PI_WEB_DATA_DIR = join(temp, 'data');
    process.env.PI_WEB_WORKSPACE = workspace;
    process.env.PI_WEB_SKILL_DIRS = join(agentDir, 'skills');
    const requests: Payload[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body: Payload = JSON.parse(Buffer.concat(chunks).toString());
      requests.push(body);
      const current = JSON.stringify(
        body.messages.findLast((message) => message.role === 'user')?.content,
      );
      const last = body.messages.at(-1);
      let content = 'NATIVE_READY';
      let tool: { name: string; arguments: string; id: string } | undefined;
      if (current.includes('AUTO_SKILL_TEST')) {
        if (last?.role === 'tool')
          content = JSON.stringify(last.content).includes('BLUE_NATIVE_SKILL')
            ? 'AUTO_SKILL_OK'
            : 'SKILL_MISSING';
        else {
          const properties =
            body.tools?.find((tool) => tool.function.name === 'read')?.function
              .parameters.properties ?? {};
          tool = {
            name: 'read',
            id: 'read-skill',
            arguments: JSON.stringify({
              [Object.hasOwn(properties, 'path') ? 'path' : 'file_path']:
                skillPath,
            }),
          };
        }
      } else if (current.includes('MANUAL_SKILL_TEST'))
        content = current.includes('MANUAL_SECRET_MARKER')
          ? 'MANUAL_SKILL_OK'
          : 'MANUAL_SKILL_MISSING';
      else if (
        current.includes('APPROVE_TOOL_TEST') ||
        current.includes('DENY_TOOL_TEST')
      ) {
        const denied = current.includes('DENY_TOOL_TEST');
        if (last?.role === 'tool')
          content = denied
            ? 'DENIED_OK'
            : JSON.stringify(last.content).includes('REAL_NODE_EXECUTED')
              ? 'APPROVE_OK'
              : 'TOOL_OUTPUT_MISSING';
        else
          tool = {
            name: 'bash',
            id: denied ? 'bash-denied' : 'bash-approved',
            arguments: JSON.stringify({
              command: `node -e "require('node:fs').writeFileSync('${denied ? 'denied' : 'approved'}.txt','REAL_NODE_EXECUTED'); console.log('REAL_NODE_EXECUTED')"`,
            }),
          };
      } else if (current.includes('LEGACY_RECALL_TEST'))
        content = JSON.stringify(body.messages).includes('LEGACY-7392')
          ? 'LEGACY_OK'
          : 'LEGACY_LOST';
      else if (current.includes('LEGACY-7392')) content = 'Legacy remembered';
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const delta = tool
        ? {
            role: 'assistant',
            tool_calls: [
              {
                index: 0,
                id: tool.id,
                type: 'function',
                function: { name: tool.name, arguments: tool.arguments },
              },
            ],
          }
        : { role: 'assistant', content };
      for (const part of [
        { choices: [{ index: 0, delta, finish_reason: null }] },
        {
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: tool ? 'tool_calls' : 'stop',
            },
          ],
          usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 60 },
        },
      ])
        res.write(
          `data: ${JSON.stringify({ id: 'mock-native', object: 'chat.completion.chunk', created: 1, model: body.model, ...part })}\n\n`,
        );
      res.end('data: [DONE]\n\n');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    try {
      await writeFile(
        join(agentDir, 'settings.json'),
        JSON.stringify({ defaultProvider: 'fixture', defaultModel: 'model' }),
      );
      await writeFile(
        join(agentDir, 'models.json'),
        JSON.stringify({
          providers: {
            fixture: {
              api: 'openai-completions',
              baseUrl: `http://127.0.0.1:${port}/v1`,
              apiKey: 'mock-only-key',
              models: [
                {
                  id: 'model',
                  name: 'model',
                  reasoning: false,
                  input: ['text'],
                  contextWindow: 32000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        }),
      );
      // Configured relative Skill roots follow Pi's user-dir / project-.pi rules.
      await mkdir(join(agentDir, 'extra/global-extra'), { recursive: true });
      await mkdir(join(workspace, '.pi/extra/project-extra'), {
        recursive: true,
      });
      await writeFile(
        join(agentDir, 'extra/global-extra/SKILL.md'),
        '---\nname: global-extra\ndescription: Global configured fixture\n---\nGlobal.',
      );
      await writeFile(
        join(workspace, '.pi/extra/project-extra/SKILL.md'),
        '---\nname: project-extra\ndescription: Project configured fixture\n---\nProject.',
      );
      await writeFile(
        join(agentDir, 'settings.json'),
        JSON.stringify({
          defaultProvider: 'fixture',
          defaultModel: 'model',
          skills: ['./extra'],
        }),
      );
      await writeFile(
        join(workspace, '.pi/settings.json'),
        JSON.stringify({ skills: ['./extra'] }),
      );
      const limited = process.env.PI_WEB_SKILL_DIRS;
      delete process.env.PI_WEB_SKILL_DIRS;
      const { loadHarnessResources: loadConfigured } =
        await import('../src/lib/harness-resources');
      const configured = await loadConfigured();
      assert.ok(
        configured.skills.some((skill) => skill.name === 'global-extra'),
      );
      assert.ok(
        configured.skills.some((skill) => skill.name === 'project-extra'),
      );
      process.env.PI_WEB_SKILL_DIRS = limited;
      const { POST } = await import('../src/app/api/chat/route');
      const { getPiConfiguration } = await import('../src/lib/pi-config');
      await getPiConfiguration(true);
      const { loadHarnessResources } =
        await import('../src/lib/harness-resources');
      const resources = await loadHarnessResources();
      assert.equal(resources.info.skills.length, 2);
      assert.ok(
        resources.info.skills.find((skill) => skill.name === 'hidden-workflow')
          ?.manualOnly,
      );
      const send = (id: string, messages: unknown[]) =>
        POST(
          new Request('http://127.0.0.1:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              model: 'fixture/model',
              thinkingLevel: 'off',
              messages,
            }),
          }),
        );
      const prompt = (id: string, text: string) =>
        send(id, [
          { id: `${id}-user`, role: 'user', parts: [{ type: 'text', text }] },
        ]);
      const auto = await (await prompt('auto-skill', 'AUTO_SKILL_TEST')).text();
      assert.ok(auto.includes('AUTO_SKILL_OK'), auto);
      assert.ok(auto.includes('read-skill'), auto);
      const initial = JSON.stringify(
        requests[0].messages.filter((message) => message.role === 'system'),
      );
      assert.ok(initial.includes('PROJECT_SYSTEM_ACTIVE'));
      assert.ok(initial.includes('APPEND_NATIVE_ACTIVE'));
      assert.ok(initial.includes('PROJECT_CONTEXT_ACTIVE'));
      assert.ok(initial.includes('color-workflow'));
      assert.ok(!initial.includes('GLOBAL_SYSTEM_MUST_BE_OVERRIDDEN'));
      assert.ok(
        !initial.includes('BLUE_NATIVE_SKILL'),
        'Skills must remain lazy until read',
      );
      assert.ok(
        !initial.includes('hidden-workflow'),
        'Manual-only skills must not be advertised automatically',
      );
      const runtime = JSON.parse(
        await readFile(
          join(temp, 'data/sessions/auto-skill/runtime.json'),
          'utf8',
        ),
      );
      assert.equal(runtime.promptStatus, 'loaded');
      assert.ok(runtime.systemPrompt.includes('PROJECT_SYSTEM_ACTIVE'));
      const manual = await (
        await prompt('manual-skill', '/skill:hidden-workflow MANUAL_SKILL_TEST')
      ).text();
      assert.ok(manual.includes('MANUAL_SKILL_OK'), manual);
      assert.ok(manual.includes('data-skill'), manual);

      async function approvalFlow(
        id: string,
        marker: string,
        approved: boolean,
      ) {
        const response = await prompt(id, marker);
        assert.equal(response.status, 200);
        const text = await response.text();
        const chunks = events(text);
        const approval = chunks.find(
          (chunk) => chunk.type === 'tool-approval-request',
        );
        const call = chunks.find(
          (chunk) => chunk.type === 'tool-input-available',
        );
        assert.ok(approval, text);
        assert.ok(call, text);
        await assert.rejects(
          access(join(workspace, approved ? 'approved.txt' : 'denied.txt')),
        );
        const part = {
          type: call.dynamic ? 'dynamic-tool' : `tool-${call.toolName}`,
          toolName: call.toolName,
          toolCallId: call.toolCallId,
          state: 'approval-responded',
          input: call.input,
          approval: { id: approval.approvalId, approved },
        };
        const continued = await send(id, [
          { id: `${id}-assistant`, role: 'assistant', parts: [part] },
        ]);
        assert.equal(continued.status, 200);
        const result = await continued.text();
        assert.equal(
          events(result).find((chunk) => chunk.type === 'start')?.messageId,
          `${id}-assistant`,
          'Approval continuation must update the same assistant message',
        );
        assert.ok(
          result.includes(approved ? 'APPROVE_OK' : 'DENIED_OK'),
          result,
        );
        assert.ok(!result.includes('"type":"error"'), result);
      }
      await approvalFlow('approval-chat', 'APPROVE_TOOL_TEST', true);
      assert.equal(
        await readFile(join(workspace, 'approved.txt'), 'utf8'),
        'REAL_NODE_EXECUTED',
      );
      await approvalFlow('denial-chat', 'DENY_TOOL_TEST', false);
      await assert.rejects(access(join(workspace, 'denied.txt')));

      // Upgrade an existing just-bash session without dropping its native history.
      const { HarnessAgent } = await import('@ai-sdk/harness/agent');
      const { createPi } = await import('@ai-sdk/harness-pi');
      const { createJustBashNetworkSandboxSession } =
        await import('@ai-sdk/sandbox-just-bash');
      const { ReadWriteFs } = await import('just-bash');
      const legacyDir = join(temp, 'data/sessions/legacy-chat');
      await mkdir(join(legacyDir, 'sandbox'), { recursive: true });
      const sandbox = await createJustBashNetworkSandboxSession({
        fs: new ReadWriteFs({ root: join(legacyDir, 'sandbox') }),
        cwd: '/workspace',
      });
      const legacyAgent = new HarnessAgent({
        harness: createPi({
          providers: (await getPiConfiguration()).providers,
          auth: 'custom',
        }),
        model: 'fixture/model',
        activeTools: [],
        sandboxConfig: { workDir: '.' },
      });
      const legacy = await legacyAgent.createSession({
        sessionId: 'legacy-chat',
        sandboxSession: sandbox,
      });
      await legacyAgent.generate({
        session: legacy,
        prompt: 'Remember LEGACY-7392',
      });
      await writeFile(
        join(legacyDir, 'state.json'),
        JSON.stringify(await legacy.stop()),
      );
      await sandbox.destroy();
      const migrated = await (
        await prompt('legacy-chat', 'LEGACY_RECALL_TEST')
      ).text();
      assert.ok(migrated.includes('LEGACY_OK'), migrated);
      const { deleteChatSession } = await import('../src/lib/pi-session');
      for (const id of [
        'auto-skill',
        'manual-skill',
        'approval-chat',
        'denial-chat',
        'legacy-chat',
      ])
        await deleteChatSession(id);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(temp, { recursive: true, force: true });
    }
  },
);

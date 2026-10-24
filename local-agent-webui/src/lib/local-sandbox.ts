import { spawn as spawnProcess, type ChildProcess } from 'node:child_process';
import { Readable } from 'node:stream';
import { mkdir, readFile, writeFile, readdir, chmod } from 'node:fs/promises';
import { resolve, dirname, basename, join, sep } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type { HarnessV1NetworkSandboxSession } from '@ai-sdk/harness';

export function privateSessionDirectory(id: string) {
  return join(
    homedir(),
    '.ai-sdk',
    'harness-pi',
    createHash('sha256').update(id).digest('hex'),
  );
}

// Pi runs in this Node process. Its tools need the actual local shell and
// filesystem so existing Skill scripts can use installed CLIs and credentials.
// This is a host execution environment, not an OS isolation boundary.
export function createLocalSandbox(
  workspace: string,
  id: string,
  legacyRoot?: string,
): HarnessV1NetworkSandboxSession {
  const children = new Set<ChildProcess>();
  const pathOf = (path: string) => resolve(workspace, path);
  const kill = (child: ChildProcess) => {
    if (child.exitCode !== null || child.signalCode) return;
    try {
      if (process.platform !== 'win32' && child.pid)
        process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      /* Already ended. */
    }
    const timer = setTimeout(() => {
      try {
        if (process.platform !== 'win32' && child.pid)
          process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        /* Already ended. */
      }
    }, 1000);
    timer.unref();
    child.once('close', () => clearTimeout(timer));
  };
  const session: HarnessV1NetworkSandboxSession = {
    id,
    defaultWorkingDirectory: workspace,
    ports: [],
    description: `Local host execution in ${workspace}. Shell and environment are inherited from the server process.`,
    async getPortEndpoint() {
      throw new Error('The Pi host runtime does not expose sandbox ports.');
    },
    async getPortUrl() {
      throw new Error('The Pi host runtime does not expose sandbox ports.');
    },
    restricted() {
      const {
        id,
        defaultWorkingDirectory,
        ports,
        getPortEndpoint,
        getPortUrl,
        restricted,
        stop,
        destroy,
        ...basic
      } = session;
      return basic;
    },
    async stop() {
      for (const child of children) kill(child);
    },
    async destroy() {
      for (const child of children) kill(child);
    },
    async readBinaryFile({ path, abortSignal }) {
      abortSignal?.throwIfAborted();
      try {
        return await readFile(pathOf(path), { signal: abortSignal });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        // Older versions stored the same Pi JSONL in just-bash's virtual HOME.
        // Only the adapter's own private history reads can use this fallback.
        if (
          legacyRoot &&
          pathOf(path).startsWith(privateSessionDirectory(id) + sep) &&
          path.endsWith('.jsonl')
        ) {
          const files = await readdir(legacyRoot, { recursive: true }).catch(
            () => [],
          );
          const match = files.find((file) => basename(file) === basename(path));
          if (match)
            return await readFile(join(legacyRoot, match), {
              signal: abortSignal,
            });
        }
        return null;
      }
    },
    async readFile(options) {
      const bytes = await session.readBinaryFile(options);
      return bytes === null
        ? null
        : new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          });
    },
    async readTextFile({ encoding = 'utf-8', startLine, endLine, ...options }) {
      const bytes = await session.readBinaryFile(options);
      if (bytes === null) return null;
      const text = Buffer.from(bytes).toString(encoding as BufferEncoding);
      return startLine !== undefined || endLine !== undefined
        ? text
            .split('\n')
            .slice((startLine ?? 1) - 1, endLine)
            .join('\n')
        : text;
    },
    async writeBinaryFile({ path, content, abortSignal }) {
      abortSignal?.throwIfAborted();
      const target = pathOf(path);
      const privateHistory = target.startsWith(
        privateSessionDirectory(id) + sep,
      );
      await mkdir(dirname(target), {
        recursive: true,
        mode: privateHistory ? 0o700 : undefined,
      });
      await writeFile(target, content, {
        signal: abortSignal,
        mode: privateHistory ? 0o600 : undefined,
      });
      if (privateHistory) {
        await chmod(dirname(target), 0o700);
        await chmod(target, 0o600);
        if (legacyRoot && path.endsWith('.jsonl')) {
          const mirror = join(legacyRoot, 'native-session', basename(path));
          await mkdir(dirname(mirror), { recursive: true, mode: 0o700 });
          await writeFile(mirror, content, {
            mode: 0o600,
            signal: abortSignal,
          });
        }
      }
    },
    async writeTextFile({ content, encoding = 'utf-8', ...options }) {
      await session.writeBinaryFile({
        ...options,
        content: Buffer.from(content, encoding as BufferEncoding),
      });
    },
    async writeFile({ content, ...options }) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of content) chunks.push(chunk);
      await session.writeBinaryFile({
        ...options,
        content: Buffer.concat(chunks),
      });
    },
    async spawn({ command, workingDirectory, env, abortSignal }) {
      abortSignal?.throwIfAborted();
      const child = spawnProcess(
        process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
        process.platform === 'win32'
          ? ['/c', command]
          : ['--noprofile', '--norc', '-c', command],
        {
          cwd: workingDirectory ?? workspace,
          env: { ...process.env, ...env },
          detached: process.platform !== 'win32',
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      children.add(child);
      const abort = () => kill(child);
      abortSignal?.addEventListener('abort', abort, { once: true });
      const done = new Promise<{ exitCode: number }>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code) => {
          children.delete(child);
          abortSignal?.removeEventListener('abort', abort);
          if (abortSignal?.aborted) reject(abortSignal.reason);
          else resolve({ exitCode: code ?? 1 });
        });
      });
      done.catch(() => {});
      let size = 0;
      const boundOutput = (chunk: Buffer) => {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) kill(child);
      };
      child.stdout!.on('data', boundOutput);
      child.stderr!.on('data', boundOutput);
      return {
        pid: child.pid,
        stdout: Readable.toWeb(child.stdout!) as ReadableStream<Uint8Array>,
        stderr: Readable.toWeb(child.stderr!) as ReadableStream<Uint8Array>,
        wait: () => done,
        async kill() {
          kill(child);
        },
      };
    },
    async run(options) {
      const proc = await session.spawn(options);
      const [stdout, stderr, result] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.wait(),
      ]);
      return { ...result, stdout, stderr };
    },
  };
  return session;
}

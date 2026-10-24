import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalSandbox } from '../src/lib/local-sandbox';

test(
  'native process execution uses the real workspace and aborts child processes',
  { timeout: 10_000 },
  async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-shell-test-'));
    const sandbox = createLocalSandbox(dir, 'process-abort-test');
    try {
      const cwd = await sandbox.run({ command: 'pwd' });
      assert.equal(cwd.exitCode, 0);
      assert.ok(
        cwd.stdout.trim().endsWith(dir.replace('/private/tmp', '/tmp')) ||
          cwd.stdout.trim().endsWith(dir),
      );
      const controller = new AbortController();
      const pending = sandbox.run({
        command: 'node -e "setInterval(() => {}, 1000)"',
        abortSignal: controller.signal,
      });
      const timer = setTimeout(
        () => controller.abort(new Error('test abort')),
        150,
      );
      try {
        await assert.rejects(Promise.resolve(pending), /test abort/);
      } finally {
        clearTimeout(timer);
      }
    } finally {
      await sandbox.destroy();
      await rm(dir, { recursive: true, force: true });
    }
  },
);

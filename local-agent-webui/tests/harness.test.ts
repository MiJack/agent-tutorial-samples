import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test(
  'official Pi harness persists native context, switches models, and deletes the isolated session',
  { timeout: 45_000 },
  async () => {
    const temp = await mkdtemp(join(tmpdir(), 'pi-web-chat-test-'));
    const requests: Record<string, unknown>[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      requests.push({ ...body, requestHeaders: req.headers });
      const remembered = body.messages
        .slice(0, -1)
        .some((message: { content: unknown }) =>
          JSON.stringify(message.content).includes('STORAGE-7392'),
        );
      const content =
        requests.length === 1
          ? '已记住'
          : remembered
            ? 'STORAGE-7392'
            : 'CONTEXT_LOST';
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      for (const part of [
        {
          choices: [
            {
              index: 0,
              delta: { role: 'assistant', content },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 40, completion_tokens: 5, total_tokens: 45 },
        },
      ])
        res.write(
          `data: ${JSON.stringify({ id: 'test-completion', object: 'chat.completion.chunk', model: body.model, created: 1, ...part })}\n\n`,
        );
      if (JSON.stringify(body.messages.at(-1)).includes('CANCEL_TEST')) {
        const timer = setTimeout(() => res.end('data: [DONE]\n\n'), 5000);
        res.on('close', () => clearTimeout(timer));
      } else res.end('data: [DONE]\n\n');
    });
    const beforeDir = process.env.PI_CODING_AGENT_DIR;
    const beforeData = process.env.PI_WEB_DATA_DIR;
    const beforeWorkspace = process.env.PI_WEB_WORKSPACE;
    const beforeSkills = process.env.PI_WEB_SKILL_DIRS;
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    try {
      const agentDir = join(temp, 'agent');
      await mkdir(join(temp, 'workspace'));
      process.env.PI_WEB_WORKSPACE = join(temp, 'workspace');
      process.env.PI_WEB_SKILL_DIRS = join(agentDir, 'skills');
      await mkdir(agentDir);
      await writeFile(
        join(agentDir, 'settings.json'),
        JSON.stringify({
          defaultProvider: 'test-provider',
          defaultModel: 'first',
          defaultThinkingLevel: 'off',
        }),
      );
      await writeFile(
        join(agentDir, 'models.json'),
        JSON.stringify({
          providers: {
            'test-provider': {
              api: 'openai-completions',
              baseUrl: `http://127.0.0.1:${port}/v1`,
              apiKey: 'fake-test-only-key',
              models: ['first', 'second'].map((id) => ({
                id,
                name: id,
                reasoning: true,
                compat: { supportsReasoningEffort: true },
                input: ['text'],
                contextWindow: 32000,
                maxTokens: 4096,
                headers: { 'X-Fixture-Model': id },
              })),
            },
          },
        }),
      );
      process.env.PI_CODING_AGENT_DIR = agentDir;
      process.env.PI_WEB_DATA_DIR = join(temp, 'data');
      const { getPiConfiguration } = await import('../src/lib/pi-config');
      const { config } = await getPiConfiguration(true);
      assert.ok(
        config.models.some((model) => model.key === 'test-provider/first'),
      );
      assert.ok(!JSON.stringify(config).includes('fake-test-only-key'));
      const { openChatSession, deleteChatSession, acquireChat, releaseChat } =
        await import('../src/lib/pi-session');
      assert.equal(acquireChat('test-chat'), true);
      assert.equal(acquireChat('test-chat'), false);
      releaseChat('test-chat');
      const first = await openChatSession(
        'test-chat',
        'test-provider/first',
        'high',
      );
      try {
        const result = await first.agent.generate({
          session: first.session,
          prompt: '记住验证码 STORAGE-7392。只回复已记住。',
          abortSignal: AbortSignal.timeout(15_000),
        });
        assert.equal(result.text, '已记住');
      } finally {
        await first.close();
      }
      const state = JSON.parse(
        await readFile(
          join(temp, 'data/sessions/test-chat/state.json'),
          'utf8',
        ),
      );
      assert.ok(state);
      const second = await openChatSession(
        'test-chat',
        'test-provider/second',
        'low',
      );
      try {
        const result = await second.agent.generate({
          session: second.session,
          prompt: '刚才的验证码是什么？',
          abortSignal: AbortSignal.timeout(15_000),
        });
        assert.equal(result.text, 'STORAGE-7392');
      } finally {
        await second.close();
      }
      assert.equal(requests[1].model, 'second');
      assert.equal(requests[0].reasoning_effort, 'high');
      assert.equal(requests[1].reasoning_effort, 'low');
      assert.equal(
        (requests[0].requestHeaders as Record<string, string>)[
          'x-fixture-model'
        ],
        'first',
      );
      assert.equal(
        (requests[1].requestHeaders as Record<string, string>)[
          'x-fixture-model'
        ],
        'second',
      );
      const { POST } = await import('../src/app/api/chat/route');
      const makeRequest = (text: string, signal?: AbortSignal) =>
        new Request('http://127.0.0.1:3000/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            id: 'api-test-chat',
            model: 'test-provider/first',
            thinkingLevel: 'off',
            messages: [{ role: 'user', parts: [{ type: 'text', text }] }],
          }),
        });
      const initial = await POST(makeRequest('记住 STORAGE-7392'));
      const initialEvents = await initial.text();
      assert.ok(initialEvents.includes('text-delta'));
      assert.ok(initialEvents.includes('[DONE]'));
      assert.equal(requests[2].reasoning_effort, undefined);
      const abort = new AbortController();
      const pending = await POST(makeRequest('CANCEL_TEST', abort.signal));
      const reader = pending.body!.getReader();
      let received = '';
      const timer = setTimeout(() => abort.abort(), 3000);
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          received += new TextDecoder().decode(chunk.value);
          if (received.includes('text-delta')) abort.abort();
        }
      } finally {
        clearTimeout(timer);
        reader.releaseLock();
      }
      const afterStop = await POST(makeRequest('停止后继续：验证码是什么？'));
      assert.equal(afterStop.status, 200);
      const afterStopEvents = await afterStop.text();
      assert.ok(afterStopEvents.includes('STORAGE-7392'), afterStopEvents);
      assert.ok(!afterStopEvents.includes('"type":"error"'), afterStopEvents);
      assert.equal(await deleteChatSession('api-test-chat'), true);
      assert.equal(await deleteChatSession('test-chat'), true);
      await assert.rejects(access(join(temp, 'data/sessions/test-chat')));
      assert.equal(
        JSON.parse(await readFile(join(agentDir, 'settings.json'), 'utf8'))
          .defaultModel,
        'first',
      );
    } finally {
      if (beforeWorkspace === undefined) delete process.env.PI_WEB_WORKSPACE;
      else process.env.PI_WEB_WORKSPACE = beforeWorkspace;
      if (beforeSkills === undefined) delete process.env.PI_WEB_SKILL_DIRS;
      else process.env.PI_WEB_SKILL_DIRS = beforeSkills;
      if (beforeDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
      else process.env.PI_CODING_AGENT_DIR = beforeDir;
      if (beforeData === undefined) delete process.env.PI_WEB_DATA_DIR;
      else process.env.PI_WEB_DATA_DIR = beforeData;
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(temp, { recursive: true, force: true });
    }
  },
);

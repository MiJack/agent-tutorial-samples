import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chatIdSchema,
  chatRequestSchema,
  isLocalRequest,
} from '../src/lib/request';

test('accepts same-origin local requests and command-line requests', () => {
  assert.equal(
    isLocalRequest(new Request('http://127.0.0.1:3000/api/chat')),
    true,
  );
  assert.equal(
    isLocalRequest(
      new Request('http://localhost:3000/api/chat', {
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'sec-fetch-site': 'same-origin',
        },
      }),
    ),
    true,
  );
});
test('rejects foreign origins, rebinding hosts, and opaque origins', () => {
  const cases: Record<string, string>[] = [
    { host: 'evil.example' },
    { origin: 'https://evil.example' },
    { origin: 'null' },
    { origin: 'http://127.0.0.1:3001' },
    { 'sec-fetch-site': 'cross-site' },
  ];
  for (const headers of cases) {
    assert.equal(
      isLocalRequest(
        new Request('http://127.0.0.1:3000/api/chat', { headers }),
      ),
      false,
    );
  }
});
test('session ids cannot escape the data directory', () => {
  for (const id of [
    '../settings',
    '/tmp/file',
    '..',
    'a/b',
    'a\\b',
    '',
    'a'.repeat(81),
  ])
    assert.equal(chatIdSchema.safeParse(id).success, false);
  assert.equal(
    chatIdSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success,
    true,
  );
});
test('chat validation rejects unsupported levels and malformed message parts', () => {
  const request = {
    id: 'test',
    model: 'provider/model',
    thinkingLevel: 'high',
    messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
  };
  assert.equal(chatRequestSchema.safeParse(request).success, true);
  assert.equal(
    chatRequestSchema.safeParse({ ...request, thinkingLevel: 'unlimited' })
      .success,
    false,
  );
  assert.equal(
    chatRequestSchema.safeParse({
      ...request,
      messages: [{ role: 'user', parts: [{ type: 'text', text: 123 }] }],
    }).success,
    false,
  );
});

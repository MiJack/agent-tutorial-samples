import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatInput } from '../src/lib/chat-input';

const file = (
  text: string,
  mediaType = 'text/plain',
  filename = 'notes.txt',
) => ({
  type: 'file',
  mediaType,
  filename,
  url: `data:${mediaType};base64,${Buffer.from(text).toString('base64')}`,
});
test('text files are passed into the real user turn, and all text precedes images', () => {
  const image = file('image-bytes', 'image/png', 'image.png');
  const message = createChatInput(
    [
      image,
      { type: 'text', text: 'Summarize the files' },
      file('Project: PI-7392'),
    ],
    ['text', 'image'],
  );
  assert.ok(Array.isArray(message.content));
  assert.deepEqual(
    message.content.map((part) => part.type),
    ['text', 'text', 'file'],
  );
  assert.ok(JSON.stringify(message).includes('Project: PI-7392'));
});
test('an attachment-only prompt works, and unsupported image models are rejected', () => {
  assert.ok(
    JSON.stringify(createChatInput([file('hello')], ['text'])).includes(
      'hello',
    ),
  );
  const image = file('image-bytes', 'image/png', 'image.png');
  assert.throws(() => createChatInput([image], ['text']), /不支持图片/);
  assert.ok(Array.isArray(createChatInput([image], ['text', 'image']).content));
});
test('remote file fetches, binary documents and invalid attachment declarations are rejected', () => {
  assert.throws(
    () =>
      createChatInput(
        [
          {
            type: 'file',
            mediaType: 'text/plain',
            url: 'https://example.com/private.txt',
          },
        ],
        ['text'],
      ),
    /本地文件/,
  );
  assert.throws(
    () =>
      createChatInput(
        [file('binary', 'application/pdf', 'file.pdf')],
        ['text'],
      ),
    /支持图片和文本/,
  );
  assert.throws(
    () =>
      createChatInput(
        [{ ...file('hello'), mediaType: 'image/png' }],
        ['text', 'image'],
      ),
    /不一致/,
  );
  assert.throws(
    () =>
      createChatInput(
        Array.from({ length: 5 }, () => file('hello')),
        ['text'],
      ),
    /最多上传/,
  );
});

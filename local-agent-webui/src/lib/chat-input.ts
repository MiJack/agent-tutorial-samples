import type { UserModelMessage } from 'ai';

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_FILES = 4;
const imageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);
const textExtensions =
  /\.(txt|md|mdx|csv|tsv|json|js|jsx|ts|tsx|py|java|kt|swift|rs|go|rb|sh|yaml|yml|xml|html|css|sql|log)$/i;

export function createChatInput(
  parts: { type: string; text?: string; [key: string]: unknown }[],
  input: readonly string[],
): UserModelMessage {
  const text = parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
  const files = parts.filter((part) => part.type === 'file');
  if ((!text && !files.length) || text.length > 100_000)
    throw new Error('请输入有效消息（最多 100,000 字符）。');
  if (files.length > MAX_FILES) throw new Error('一次最多上传 4 个附件。');
  const content: Exclude<UserModelMessage['content'], string> = [];
  if (text) content.push({ type: 'text', text });
  const images: Exclude<UserModelMessage['content'], string> = [];
  for (const file of files) {
    if (typeof file.url !== 'string' || typeof file.mediaType !== 'string')
      throw new Error('附件格式无效。');
    const match = /^data:([^;,]*);base64,([A-Za-z0-9+/]*={0,2})$/.exec(
      file.url,
    );
    if (!match)
      throw new Error('附件必须是本次上传的本地文件，不支持远程附件地址。');
    const mediaType = file.mediaType.toLowerCase();
    if (match[1] && match[1].toLowerCase() !== mediaType)
      throw new Error('附件类型与文件内容声明不一致。');
    const data = Buffer.from(match[2], 'base64');
    if (!data.length || data.length > MAX_FILE_BYTES)
      throw new Error('每个附件须小于 4 MB，且不能为空。');
    const filename =
      typeof file.filename === 'string' ? file.filename : 'attachment';
    if (imageTypes.has(mediaType)) {
      if (!input.includes('image'))
        throw new Error('所选模型不支持图片，请切换支持图片的模型。');
      images.push({ type: 'file', data, mediaType, filename });
    } else if (
      mediaType.startsWith('text/') ||
      mediaType === 'application/json' ||
      textExtensions.test(filename)
    ) {
      let fileText: string;
      try {
        fileText = new TextDecoder('utf-8', { fatal: true }).decode(data);
      } catch {
        throw new Error('文本附件需要使用 UTF-8 编码。');
      }
      if (fileText.includes('\0') || fileText.length > 100_000)
        throw new Error('文本附件必须为文本内容，且不超过 100,000 字符。');
      content.push({
        type: 'text',
        text: `Attached file: ${filename}\n\n${fileText}`,
      });
    } else
      throw new Error(
        '支持图片和文本/代码附件；请将其他文档转换为文本后上传。',
      );
  }
  // Pi requires every text part before the first image part.
  if (!content.length && images.length)
    content.push({ type: 'text', text: '请查看这些图片。' });
  return { role: 'user', content: [...content, ...images] };
}

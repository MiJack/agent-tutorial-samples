import { z } from 'zod';
import { thinkingLevels } from './types';

export const chatIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{1,80}$/, '无效的会话 ID');
export const chatRequestSchema = z.object({
  id: chatIdSchema,
  model: z.string().min(1).max(300),
  thinkingLevel: z.enum(thinkingLevels),
  permissionMode: z
    .enum(['allow-reads', 'allow-edits', 'allow-all'])
    .default('allow-reads'),
  messages: z
    .array(
      z
        .object({
          role: z.enum(['user', 'assistant', 'system']),
          parts: z
            .array(
              z
                .object({ type: z.string(), text: z.string().optional() })
                .passthrough(),
            )
            .max(100),
        })
        .passthrough(),
    )
    .min(1)
    .max(1000),
});

export function isLocalRequest(request: Request) {
  const host = request.headers.get('host') ?? new URL(request.url).host;
  let target: URL;
  try {
    target = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname))
    return false;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const source = new URL(origin);
      if (
        source.host !== target.host ||
        !['http:', 'https:'].includes(source.protocol)
      )
        return false;
    } catch {
      return false;
    }
  }
  return request.headers.get('sec-fetch-site') !== 'cross-site';
}

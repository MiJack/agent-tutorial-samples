import { isLocalRequest, chatIdSchema } from '@/lib/request';
import { deleteChatSession } from '@/lib/pi-session';
export const runtime = 'nodejs';
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isLocalRequest(request))
    return new Response('Forbidden', { status: 403 });
  const { id } = await context.params;
  if (!chatIdSchema.safeParse(id).success)
    return new Response('无效的会话 ID', { status: 400 });
  const deleted = await deleteChatSession(id);
  return deleted
    ? new Response(null, { status: 204 })
    : new Response('请先停止生成再删除对话。', { status: 409 });
}

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  convertToModelMessages,
  validateUIMessages,
  type UIMessage,
} from 'ai';
import { getHarnessErrorMessage } from '@ai-sdk/harness/agent';
import { chatRequestSchema, isLocalRequest } from '@/lib/request';
import { getPiConfiguration } from '@/lib/pi-config';
import { expandSkillCommand } from '@/lib/harness-resources';
import { createChatInput } from '@/lib/chat-input';
import { acquireChat, openChatSession, releaseChat } from '@/lib/pi-session';
export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: Request) {
  if (!isLocalRequest(request))
    return new Response('Forbidden', { status: 403 });
  let data: ReturnType<typeof chatRequestSchema.parse>;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 24_000_000)
      return new Response('对话过长，请新建对话。', { status: 413 });
    data = chatRequestSchema.parse(JSON.parse(raw));
  } catch {
    return new Response('请求格式无效。', { status: 400 });
  }
  const latest = data.messages.at(-1);
  const approval =
    latest?.role === 'assistant' &&
    latest.parts.some(
      (part) =>
        (part.type.startsWith('tool-') || part.type === 'dynamic-tool') &&
        part.state === 'approval-responded',
    );
  if (latest?.role !== 'user' && !approval)
    return new Response('请输入用户消息或工具审批响应。', { status: 400 });
  const { config } = await getPiConfiguration();
  const model = config.models.find((model) => model.key === data.model);
  if (!model)
    return new Response('模型当前不可用，请重新加载 Pi 配置。', {
      status: 400,
    });
  if (!model.thinkingLevels.includes(data.thinkingLevel))
    return new Response('所选模型不支持此思考强度。', { status: 400 });
  let message: ReturnType<typeof createChatInput> | undefined;
  try {
    if (!approval) message = createChatInput(latest!.parts, model.input);
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : '附件解析失败。',
      { status: 400 },
    );
  }
  let approvalMessages: UIMessage[] | undefined;
  if (approval) {
    try {
      approvalMessages = await validateUIMessages({ messages: data.messages });
    } catch {
      return new Response('工具审批消息无效。', { status: 400 });
    }
  }
  if (!acquireChat(data.id))
    return new Response('当前对话仍在生成，请稍后重试。', { status: 409 });

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: approvalMessages,
      execute: async ({ writer }) => {
        let chat: Awaited<ReturnType<typeof openChatSession>> | undefined;
        try {
          chat = await openChatSession(
            data.id,
            data.model,
            data.thinkingLevel,
            {
              permissionMode: data.permissionMode,
              onRuntime: (info) =>
                writer.write({
                  type: 'data-harness',
                  data: info,
                  transient: true,
                }),
            },
          );
          if (message) {
            if (chat.session.hasUnfinishedTurn())
              throw new Error('请先批准或拒绝等待中的工具调用。');
            const skill = await expandSkillCommand(
              message,
              chat.resources.skills,
            );
            if (skill)
              writer.write({
                type: 'data-skill',
                data: { name: skill.name, filePath: skill.filePath },
                transient: true,
              });
          }
          const result = await chat.agent.stream({
            session: chat.session,
            messages: message
              ? [message]
              : await convertToModelMessages(
                  await validateUIMessages({
                    messages: data.messages,
                    tools: chat.agent.tools,
                  }),
                ),
            abortSignal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(600_000),
            ]),
          });
          const uiStream = toUIMessageStream({
            stream: result.stream,
            sendReasoning: true,
            onError: getHarnessErrorMessage,
          });
          for await (const chunk of uiStream) writer.write(chunk);
        } finally {
          try {
            await chat?.close();
          } finally {
            releaseChat(data.id);
          }
        }
      },
      onError: getHarnessErrorMessage,
    }),
  });
}

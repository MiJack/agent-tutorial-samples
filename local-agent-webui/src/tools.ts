import type { UIMessage } from 'ai';

// Types used by the copied official text/reasoning presentation components.
export type ChatUIMessage = UIMessage;
export type ChatMessagePart = ChatUIMessage['parts'][number];
export type TextMessagePart = Extract<ChatMessagePart, { type: 'text' }>;
export type ReasoningMessagePart = Extract<
  ChatMessagePart,
  { type: 'reasoning' }
>;

'use client';

import type { UIMessage } from 'ai';
import { MessageActions } from '@/components/message-actions';
import { ReasoningPart } from '@/components/parts/reasoning-part';
import { TextPart } from '@/components/parts/text-part';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Message, MessageContent } from '@/components/ui/message';
import { Trace } from '@/components/ui/trace';
export { textOf } from '@/hooks/use-chat-workspace';

// Presentation copied from shadcn-ui/chatbot-template/components/chat-message.tsx.
// Pi's text-only tool policy only needs the upstream text and reasoning branches.
export function ChatMessage({
  message,
  isStreaming = false,
}: {
  message: UIMessage;
  isStreaming?: boolean;
}) {
  if (message.role === 'user') {
    return (
      <Message align="end">
        <MessageContent>
          <Bubble align="end" variant="muted">
            <BubbleContent>
              {message.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('')}
            </BubbleContent>
          </Bubble>
        </MessageContent>
      </Message>
    );
  }
  const text = message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n\n');
  return (
    <Message align="start">
      <MessageContent>
        {message.parts.map((part, index) => {
          if (part.type === 'text')
            return part.text.trim() ? (
              <TextPart key={index} part={part} />
            ) : null;
          if (part.type === 'reasoning')
            return (
              <Trace key={index}>
                <ReasoningPart part={part} isStreaming={isStreaming} />
              </Trace>
            );
          return null;
        })}
        {!isStreaming && text && <MessageActions text={text} />}
      </MessageContent>
    </Message>
  );
}

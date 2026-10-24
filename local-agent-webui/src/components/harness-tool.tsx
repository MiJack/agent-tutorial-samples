'use client';

import type { HarnessInfo } from '@/lib/types';
import type { DynamicToolUIPart, ToolUIPart, UIMessage } from 'ai';
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool';
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation';
import {
  Terminal,
  TerminalActions,
  TerminalContent,
  TerminalCopyButton,
  TerminalHeader,
  TerminalTitle,
} from '@/components/ai-elements/terminal';

export type HarnessToolPart = ToolUIPart | DynamicToolUIPart;
export function isHarnessToolPart(
  part: UIMessage['parts'][number],
): part is HarnessToolPart {
  return part.type.startsWith('tool-') || part.type === 'dynamic-tool';
}
export function outputText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray(value.content)
  )
    return value.content
      .map((item) =>
        item && typeof item === 'object' && 'text' in item
          ? item.text
          : JSON.stringify(item),
      )
      .join('\n');
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}
export function HarnessTool({
  part,
  busy,
  onApproval,
  skills,
}: {
  part: HarnessToolPart;
  busy: boolean;
  skills?: HarnessInfo['skills'];
  onApproval: (id: string, approved: boolean) => void;
}) {
  const name =
    part.type === 'dynamic-tool' ? part.toolName : part.type.slice(5);
  const unresolved =
    !busy &&
    (part.state === 'input-available' || part.state === 'input-streaming');
  const displayState = unresolved ? 'output-error' : part.state;
  const errorText =
    'errorText' in part
      ? part.errorText
      : unresolved
        ? '本轮已结束，未收到工具结果。'
        : undefined;
  const output = 'output' in part ? part.output : undefined;
  const approval = 'approval' in part ? part.approval : undefined;
  const input = part.input;
  const readPath =
    input && typeof input === 'object'
      ? 'file_path' in input
        ? input.file_path
        : 'path' in input
          ? input.path
          : undefined
      : undefined;
  const skill =
    typeof readPath === 'string'
      ? skills?.find((skill) => skill.filePath === readPath)
      : undefined;
  const command =
    input && typeof input === 'object' && 'command' in input
      ? String(input.command)
      : name;
  return (
    <>
      <Tool
        defaultOpen={
          part.state === 'approval-requested' ||
          part.state === 'output-error' ||
          unresolved
        }
      >
        <ToolHeader
          type="dynamic-tool"
          toolName={name}
          state={displayState}
          title={skill ? `${name} · Skill: ${skill.name}` : name}
        />
        <ToolContent>
          {input !== undefined && <ToolInput input={input} />}
          {name === 'bash' && output !== undefined ? (
            <Terminal
              output={outputText(output)}
              isStreaming={busy && part.state !== 'output-available'}
            >
              <TerminalHeader>
                <TerminalTitle>{command}</TerminalTitle>
                <TerminalActions>
                  <TerminalCopyButton />
                </TerminalActions>
              </TerminalHeader>
              <TerminalContent />
            </Terminal>
          ) : (
            <ToolOutput output={output} errorText={errorText} />
          )}
          {name === 'bash' && errorText && (
            <ToolOutput output={undefined} errorText={errorText} />
          )}
        </ToolContent>
      </Tool>
      {(part.state === 'approval-requested' ||
        part.state === 'approval-responded' ||
        part.state === 'output-available' ||
        part.state === 'output-denied') && (
        <Confirmation approval={approval} state={part.state}>
          <ConfirmationRequest>
            <ConfirmationTitle>
              允许执行 {name}？工具将在当前本地工作目录运行。
            </ConfirmationTitle>
            <ConfirmationActions>
              <ConfirmationAction
                variant="outline"
                onClick={() => approval && onApproval(approval.id, false)}
              >
                拒绝
              </ConfirmationAction>
              <ConfirmationAction
                onClick={() => approval && onApproval(approval.id, true)}
              >
                批准
              </ConfirmationAction>
            </ConfirmationActions>
          </ConfirmationRequest>
          <ConfirmationAccepted>
            <ConfirmationTitle>已批准此工具调用。</ConfirmationTitle>
          </ConfirmationAccepted>
          <ConfirmationRejected>
            <ConfirmationTitle>
              已拒绝此工具调用，未授权执行。
            </ConfirmationTitle>
          </ConfirmationRejected>
        </Confirmation>
      )}
    </>
  );
}

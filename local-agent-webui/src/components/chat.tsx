'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type FileUIPart,
} from 'ai';
import { HarnessStatus } from '@/components/harness-panel';
import { HarnessTool, isHarnessToolPart } from '@/components/harness-tool';
import { CheckIcon, GlobeIcon } from 'lucide-react';
import type { ChatWorkspace } from '@/hooks/use-chat-workspace';
import { thinkingLabels } from '@/lib/types';
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// JSX structure and class names from the exact example requested by the user:
// https://elements.ai-sdk.dev/examples/chatbot
// Its scripted messages/streaming are replaced with the existing Pi transport.
const suggestions = [
  'What are the latest trends in AI?',
  'How does machine learning work?',
  'Explain quantum computing',
  'Best practices for React development',
  'Tell me about TypeScript benefits',
  'How to optimize database queries?',
  'What is the difference between SQL and NoSQL?',
  'Explain cloud computing basics',
];

function logoProvider(provider: string): string | undefined {
  if (provider.startsWith('openai')) return 'openai';
  if (provider.startsWith('anthropic')) return 'anthropic';
  if (provider.startsWith('google')) return 'google';
  if (provider.startsWith('opencode')) return 'opencode';
  if (provider === 'ali-coding') return 'alibaba';
  return undefined;
}

function PromptInputAttachmentsDisplay({
  onCountChange,
}: {
  onCountChange: (count: number) => void;
}) {
  const attachments = usePromptInputAttachments();
  useEffect(() => {
    onCountChange(attachments.files.length);
  }, [attachments.files.length, onCountChange]);
  if (attachments.files.length === 0) return null;
  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

export function Chat({ workspace }: { workspace: ChatWorkspace }) {
  const {
    active: conversation,
    config,
    updateMessages,
    updateSelection,
    setBusy,
    notice,
  } = workspace;
  if (!conversation) throw new Error('Missing conversation');
  const [text, setText] = useState('');
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [inputError, setInputError] = useState('');
  const selection = useRef({
    model: conversation.model,
    thinkingLevel: conversation.thinkingLevel,
    permissionMode: conversation.permissionMode ?? 'allow-reads',
  });
  selection.current = {
    model: conversation.model,
    thinkingLevel: conversation.thinkingLevel,
    permissionMode: conversation.permissionMode ?? 'allow-reads',
  };
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        prepareSendMessagesRequest: ({ id, messages }) => ({
          body: { id, ...selection.current, messages: messages.slice(-1) },
        }),
      }),
    [],
  );
  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    clearError,
    addToolApprovalResponse,
  } = useChat({
    id: conversation.id,
    messages: conversation.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onFinish: () => {
      void workspace.reloadHarness();
    },
    onData: (part) => {
      if (part.type === 'data-harness')
        workspace.setHarness(part.data as import('@/lib/types').HarnessInfo);
      if (part.type === 'data-skill')
        workspace.setNotice(
          `已加载 Skill：${(part.data as { name: string }).name}`,
        );
    },
  });
  const awaitingApproval = messages.some((message) =>
    message.parts.some(
      (part) => isHarnessToolPart(part) && part.state === 'approval-requested',
    ),
  );
  useEffect(() => {
    if (workspace.skillRequest) {
      setText(`/skill:${workspace.skillRequest.name} `);
      workspace.clearSkillRequest();
    }
  }, [workspace.skillRequest, workspace.clearSkillRequest]);
  // Bind the reference Search action only when Pi has a real search tool.
  const supportsWebSearch = false;
  const busy = status === 'submitted' || status === 'streaming';
  const model = config.models.find((item) => item.key === conversation.model);
  const providers = useMemo(
    () => [...new Set(config.models.map((model) => model.provider))],
    [config.models],
  );
  const selectedLogo = model ? logoProvider(model.provider) : undefined;
  useEffect(() => {
    updateMessages(conversation.id, messages);
  }, [conversation.id, messages, updateMessages]);
  useEffect(() => {
    setBusy(busy || awaitingApproval);
  }, [busy, awaitingApproval, setBusy]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && busy) void stop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, stop]);

  const handleModelSelect = useCallback(
    (key: string) => {
      const next = config.models.find((model) => model.key === key);
      if (!next) return;
      const effort = next.thinkingLevels.includes(conversation.thinkingLevel)
        ? conversation.thinkingLevel
        : next.thinkingLevels.includes('medium')
          ? 'medium'
          : (next.thinkingLevels[0] ?? 'off');
      updateSelection(conversation.id, key, effort);
      setModelSelectorOpen(false);
    },
    [
      config.models,
      conversation.id,
      conversation.thinkingLevel,
      updateSelection,
    ],
  );
  async function handleSubmit(message: PromptInputMessage) {
    if (
      (!message.text.trim() && !message.files.length) ||
      busy ||
      awaitingApproval ||
      !model
    )
      return;
    clearError();
    setInputError('');
    setText('');
    await sendMessage({ text: message.text, files: message.files });
  }
  async function handleSuggestionClick(prompt: string) {
    if (busy || awaitingApproval || !model) return;
    clearError();
    setInputError('');
    await sendMessage({ text: prompt });
  }
  const handleTranscriptionChange = useCallback((transcript: string) => {
    setText((previous) =>
      previous ? `${previous} ${transcript}` : transcript,
    );
  }, []);

  return (
    <div className="relative flex size-full flex-col divide-y overflow-hidden">
      <Conversation>
        <ConversationContent>
          <HarnessStatus workspace={workspace} />
          {messages.length === 0 && <ConversationEmptyState />}
          {messages.map((message) => {
            const sources = message.parts.filter(
              (part) => part.type === 'source-url',
            );
            const reasoning = message.parts.filter(
              (part) => part.type === 'reasoning',
            );
            const files = message.parts.filter(
              (part): part is FileUIPart => part.type === 'file',
            );
            const content = message.parts
              .filter((part) => part.type === 'text')
              .map((part) => part.text)
              .join('');
            return (
              <MessageBranch defaultBranch={0} key={message.id}>
                <MessageBranchContent>
                  <Message from={message.role}>
                    <div>
                      {sources.length > 0 && (
                        <Sources>
                          <SourcesTrigger count={sources.length} />
                          <SourcesContent>
                            {sources.map((source) => (
                              <Source
                                href={source.url}
                                key={source.sourceId}
                                title={source.title ?? source.url}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {reasoning.map((part, index) => (
                        <Reasoning
                          key={index}
                          isStreaming={
                            busy &&
                            message.id === messages.at(-1)?.id &&
                            part.state === 'streaming'
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      ))}
                      {files.length > 0 && (
                        <Attachments variant="inline">
                          {files.map((file, index) => (
                            <Attachment
                              key={index}
                              data={{ ...file, id: `${message.id}-${index}` }}
                            >
                              <AttachmentPreview />
                            </Attachment>
                          ))}
                        </Attachments>
                      )}
                      {message.parts.filter(isHarnessToolPart).map((part) => (
                        <HarnessTool
                          key={part.toolCallId}
                          part={part}
                          skills={workspace.harness?.skills}
                          busy={busy}
                          onApproval={(id, approved) => {
                            void addToolApprovalResponse({ id, approved });
                          }}
                        />
                      ))}
                      <MessageContent>
                        <MessageResponse
                          isAnimating={
                            busy && message.id === messages.at(-1)?.id
                          }
                        >
                          {content}
                        </MessageResponse>
                      </MessageContent>
                    </div>
                  </Message>
                </MessageBranchContent>
              </MessageBranch>
            );
          })}
          {status === 'submitted' && (
            <Reasoning isStreaming>
              <ReasoningTrigger />
            </Reasoning>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="grid shrink-0 gap-4 pt-4">
        <Suggestions className="px-4">
          {suggestions.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onClick={(prompt) => void handleSuggestionClick(prompt)}
              disabled={busy || awaitingApproval || !model}
            />
          ))}
        </Suggestions>
        <div className="w-full px-4 pb-4">
          {(error ||
            notice ||
            inputError ||
            config.warnings.length > 0 ||
            !model) && (
            <Alert variant={error || inputError ? 'destructive' : 'default'}>
              <AlertTitle>{error ? 'Request failed' : 'Pi Agent'}</AlertTitle>
              <AlertDescription>
                {error?.message ||
                  inputError ||
                  notice ||
                  config.warnings.join(' ') ||
                  '在终端运行 pi 并使用 /login 连接供应商，然后重新加载配置。'}
              </AlertDescription>
            </Alert>
          )}
          <PromptInput
            globalDrop
            multiple
            maxFiles={4}
            maxFileSize={4 * 1024 * 1024}
            onError={(error) => setInputError(error.message)}
            onSubmit={handleSubmit}
          >
            <PromptInputHeader>
              <PromptInputAttachmentsDisplay
                onCountChange={setAttachmentCount}
              />
            </PromptInputHeader>
            <PromptInputBody>
              <PromptInputTextarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={100000}
                disabled={busy || awaitingApproval || !model}
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger
                    disabled={busy || awaitingApproval || !model}
                  />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <SpeechInput
                  className="shrink-0"
                  onTranscriptionChange={handleTranscriptionChange}
                  size="icon-sm"
                  variant="ghost"
                  disabled={busy || awaitingApproval || !model}
                />
                {supportsWebSearch && (
                  <PromptInputButton
                    variant="ghost"
                    disabled
                    title="当前 Pi 会话未配置联网搜索工具"
                  >
                    <GlobeIcon size={16} />
                    <span>Search</span>
                  </PromptInputButton>
                )}
                <ModelSelector
                  open={modelSelectorOpen}
                  onOpenChange={setModelSelectorOpen}
                >
                  <ModelSelectorTrigger asChild>
                    <PromptInputButton
                      disabled={
                        busy || awaitingApproval || !config.models.length
                      }
                      aria-label="Select model"
                    >
                      {selectedLogo && (
                        <ModelSelectorLogo provider={selectedLogo} />
                      )}
                      {model && (
                        <ModelSelectorName>{model.name}</ModelSelectorName>
                      )}
                    </PromptInputButton>
                  </ModelSelectorTrigger>
                  <ModelSelectorContent>
                    <ModelSelectorInput placeholder="Search models..." />
                    <ModelSelectorList>
                      <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                      {providers.map((provider) => (
                        <ModelSelectorGroup heading={provider} key={provider}>
                          {config.models
                            .filter((model) => model.provider === provider)
                            .map((item) => {
                              const logo = logoProvider(item.provider);
                              return (
                                <ModelSelectorItem
                                  key={item.key}
                                  value={`${item.key} ${item.name}`}
                                  onSelect={() => handleModelSelect(item.key)}
                                >
                                  {logo && (
                                    <ModelSelectorLogo provider={logo} />
                                  )}
                                  <ModelSelectorName>
                                    {item.name}
                                  </ModelSelectorName>
                                  {logo && (
                                    <ModelSelectorLogoGroup>
                                      <ModelSelectorLogo provider={logo} />
                                    </ModelSelectorLogoGroup>
                                  )}
                                  {conversation.model === item.key ? (
                                    <CheckIcon className="ml-auto size-4" />
                                  ) : (
                                    <div className="ml-auto size-4" />
                                  )}
                                </ModelSelectorItem>
                              );
                            })}
                        </ModelSelectorGroup>
                      ))}
                    </ModelSelectorList>
                  </ModelSelectorContent>
                </ModelSelector>
                <PromptInputSelect
                  value={conversation.thinkingLevel}
                  onValueChange={(level) =>
                    updateSelection(
                      conversation.id,
                      conversation.model,
                      level as typeof conversation.thinkingLevel,
                    )
                  }
                  disabled={busy || awaitingApproval || !model}
                >
                  <PromptInputSelectTrigger aria-label="Thinking effort">
                    <PromptInputSelectValue />
                  </PromptInputSelectTrigger>
                  <PromptInputSelectContent>
                    {(
                      model?.thinkingLevels ?? [conversation.thinkingLevel]
                    ).map((level) => (
                      <PromptInputSelectItem key={level} value={level}>
                        {thinkingLabels[level]}
                      </PromptInputSelectItem>
                    ))}
                  </PromptInputSelectContent>
                </PromptInputSelect>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={
                  !busy &&
                  (!model ||
                    awaitingApproval ||
                    (!text.trim() && !attachmentCount))
                }
                status={status}
                onStop={() => void stop()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

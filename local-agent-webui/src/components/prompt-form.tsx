'use client';

import * as React from 'react';
import { ArrowUpIcon, SquareIcon } from 'lucide-react';

import { type ChatModel, type ThinkingLevel } from '@/lib/types';
import { EffortSelect } from '@/components/effort-select';
import { ModelSelect } from '@/components/model-select';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group';

export function PromptForm({
  models,
  model,
  onModelChange,
  isBusy,
  onSubmit,
  onStop,
  thinkingLevel,
  onThinkingChange,
}: {
  models: ChatModel[];
  model: string;
  onModelChange: (model: string) => void;
  isBusy: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
  thinkingLevel: ThinkingLevel;
  onThinkingChange: (value: ThinkingLevel) => void;
}) {
  const currentModel = models.find((item) => item.key === model);
  const [input, setInput] = React.useState('');

  function handleSubmit(event?: React.FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || isBusy || !currentModel) return;
    onSubmit(text);
    setInput('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup>
        <InputGroupTextarea
          placeholder="Send a message…"
          className="p-3.5"
          value={input}
          maxLength={100000}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <InputGroupAddon align="block-end">
          <ModelSelect
            models={models}
            value={model}
            onValueChange={onModelChange}
            disabled={isBusy || !models.length}
          />
          <EffortSelect
            levels={currentModel?.thinkingLevels ?? [thinkingLevel]}
            value={thinkingLevel}
            onValueChange={onThinkingChange}
            disabled={
              isBusy || !currentModel || currentModel.thinkingLevels.length < 2
            }
          />
          {isBusy ? (
            <InputGroupButton
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label="Stop generating"
              className="ml-auto"
              onClick={onStop}
            >
              <SquareIcon />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              size="icon-sm"
              variant="default"
              aria-label="Send message"
              className="ml-auto"
              disabled={!input.trim() || !currentModel}
            >
              <ArrowUpIcon />
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

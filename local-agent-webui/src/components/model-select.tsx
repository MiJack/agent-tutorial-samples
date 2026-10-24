'use client';

import * as React from 'react';
import type { ChatModel } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Official template ModelSelect, bound to Pi's provider/model catalog.
export function ModelSelect({
  models,
  value,
  onValueChange,
  disabled,
}: {
  models: ChatModel[];
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const items = React.useMemo(
    () => models.map((model) => ({ label: model.name, value: model.key })),
    [models],
  );
  const providers = React.useMemo(
    () => [...new Set(models.map((model) => model.provider))],
    [models],
  );
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === 'string') onValueChange(next);
      }}
    >
      <SelectTrigger aria-label="Model" className="bg-background">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {providers.map((provider) => (
          <SelectGroup key={provider}>
            <SelectLabel>{provider}</SelectLabel>
            {models
              .filter((model) => model.provider === provider)
              .map((model) => (
                <SelectItem key={model.key} value={model.key}>
                  {model.name}
                </SelectItem>
              ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

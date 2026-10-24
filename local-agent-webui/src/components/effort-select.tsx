'use client';

import { ChevronDownIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroupButton } from '@/components/ui/input-group';
import { thinkingLabels, type ThinkingLevel } from '@/lib/types';

// Copied from the official Model Selector pattern; only its model-specific data
// and callbacks are supplied by the Pi integration.
export function EffortSelect({
  levels,
  value,
  onValueChange,
  disabled,
}: {
  levels: ThinkingLevel[];
  value: ThinkingLevel;
  onValueChange: (value: ThinkingLevel) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <InputGroupButton
            size="sm"
            variant="outline"
            aria-label={`Effort: ${thinkingLabels[value]}`}
            disabled={disabled}
          />
        }
      >
        <span className="text-muted-foreground">Effort</span>
        {thinkingLabels[value]}
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Effort</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onValueChange(next as ThinkingLevel)}
          >
            {levels.map((level) => (
              <DropdownMenuRadioItem key={level} value={level} closeOnClick>
                {thinkingLabels[level]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  BotIcon,
  DownloadIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SettingsIcon,
  TrashIcon,
} from 'lucide-react';
import type { ChatWorkspace } from '@/hooks/use-chat-workspace';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { thinkingLabels } from '@/lib/types';

// The header layout and New Chat button use the official template classes.
// Additional application actions use unstyled/default shadcn menus and dialogs.
export function SiteHeader({ workspace }: { workspace: ChatWorkspace }) {
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { active, chats, config, busy } = workspace;
  async function remove() {
    setDeleting(true);
    try {
      if (await workspace.deleteChat()) setDeleteOpen(false);
    } catch {
      workspace.setNotice('删除失败，请重试。');
    } finally {
      setDeleting(false);
    }
  }
  return (
    <>
      <header className="flex items-center justify-between gap-2 px-6 py-3">
        <Link href="/" className="text-sm font-medium">
          Chat
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Harness resources"
            onClick={() => workspace.setHarnessOpen(true)}
          >
            <BotIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Chat history"
            disabled={busy}
            onClick={() => setHistoryOpen(true)}
          >
            <HistoryIcon />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Chat options"
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Pi Agent</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon />
                  Configuration
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => void workspace.reload()}
                  disabled={busy || workspace.reloading}
                >
                  <RefreshCwIcon />
                  Reload configuration
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={workspace.exportChat}
                  disabled={!active?.messages.length}
                >
                  <DownloadIcon />
                  Export conversation
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={theme ?? 'system'}
                      onValueChange={setTheme}
                    >
                      {['system', 'light', 'dark'].map((theme) => (
                        <DropdownMenuRadioItem
                          key={theme}
                          value={theme}
                          closeOnClick
                        >
                          {theme}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                disabled={busy}
                onClick={() => setDeleteOpen(true)}
              >
                <TrashIcon />
                Delete conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="secondary"
            onClick={workspace.newChat}
            disabled={busy}
          >
            <PlusIcon data-icon="inline-start" />
            New Chat
          </Button>
        </div>
      </header>
      <CommandDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Chat history"
        description="Search your local conversations."
      >
        <Command>
          <CommandInput placeholder="Search conversations…" />
          <CommandList>
            <CommandEmpty>No conversations found.</CommandEmpty>
            <CommandGroup heading="Conversations">
              {[...chats]
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((chat) => (
                  <CommandItem
                    key={chat.id}
                    value={`${chat.title} ${chat.id}`}
                    onSelect={() => {
                      workspace.setActiveId(chat.id);
                      setHistoryOpen(false);
                    }}
                  >
                    <HistoryIcon />
                    {chat.title}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pi configuration</DialogTitle>
            <DialogDescription>
              直接复用本机 Pi 的供应商、模型和认证。
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel>Configuration directory</FieldLabel>
              <Input value={config.agentDir} readOnly />
            </Field>
            <Field>
              <FieldLabel>Default model</FieldLabel>
              <FieldDescription>
                {config.defaultModel ?? 'Not configured'}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Default effort</FieldLabel>
              <FieldDescription>
                {thinkingLabels[config.defaultThinkingLevel]}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel>Available models</FieldLabel>
              <FieldDescription>
                {config.models.length} models ·{' '}
                {new Set(config.models.map((model) => model.provider)).size}{' '}
                providers
              </FieldDescription>
            </Field>
            <Field>
              <FieldDescription>
                在终端运行 pi，使用 /login 连接供应商，自定义端点放在
                models.json 中。网页在本地运行，消息发送给所选供应商；密钥由本机
                Pi 管理。
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy || workspace.reloading}
              onClick={() => void workspace.reload()}
            >
              <RefreshCwIcon />
              Reload configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              聊天记录与对应的本地 Pi
              会话将被删除，无法恢复。需要保留时请先导出。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void remove()}
            >
              Delete conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

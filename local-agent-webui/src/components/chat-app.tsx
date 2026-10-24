'use client';

import type { PiConfig } from '@/lib/types';
import { useChatWorkspace } from '@/hooks/use-chat-workspace';
import { SiteHeader } from '@/components/site-header';
import { HarnessPanel } from '@/components/harness-panel';
import { Chat } from '@/components/chat';

export function ChatApp({ config }: { config: PiConfig }) {
  const workspace = useChatWorkspace(config);
  if (!workspace.ready || !workspace.active) return null;
  return (
    <>
      <SiteHeader workspace={workspace} />
      <HarnessPanel workspace={workspace} />
      <Chat key={workspace.active.id} workspace={workspace} />
    </>
  );
}

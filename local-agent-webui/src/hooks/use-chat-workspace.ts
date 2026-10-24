'use client';

import * as React from 'react';
import type { UIMessage } from 'ai';
import type {
  Conversation,
  PiConfig,
  ThinkingLevel,
  HarnessInfo,
  PermissionMode,
} from '@/lib/types';

const STORAGE_KEY = 'pi-web-chat:v1';
export function textOf(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
function createConversation(config: PiConfig): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'New Chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: config.defaultModel ?? '',
    thinkingLevel: config.defaultThinkingLevel,
    messages: [],
    permissionMode: 'allow-reads',
  };
}
export function useChatWorkspace(initialConfig: PiConfig) {
  const [config, setConfig] = React.useState(initialConfig);
  const [harnessOpen, setHarnessOpen] = React.useState(false);
  const [harness, setHarness] = React.useState<HarnessInfo>();
  const [skillRequest, setSkillRequest] = React.useState<{
    name: string;
    nonce: number;
  }>();
  const [chats, setChats] = React.useState<Conversation[]>([]);
  const [activeId, setActiveId] = React.useState('');
  const [ready, setReady] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState('');
  const [reloading, setReloading] = React.useState(false);
  const reloadHarness = React.useCallback(async () => {
    try {
      const response = await fetch(
        `/api/harness?chatId=${encodeURIComponent(activeId)}`,
      );
      const info = await response.json();
      if (!response.ok) throw new Error(info.error ?? 'Harness 资源加载失败');
      setHarness(info);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Harness 资源加载失败',
      );
    }
  }, [activeId]);
  React.useEffect(() => {
    if (activeId) void reloadHarness();
  }, [activeId, reloadHarness]);
  const current = React.useRef({ chats, activeId });
  current.current = { chats, activeId };

  React.useEffect(() => {
    let restored: Conversation[] = [];
    let active = '';
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (
          !Array.isArray(data.chats) ||
          !data.chats.every(
            (chat: Conversation) =>
              typeof chat.id === 'string' &&
              typeof chat.title === 'string' &&
              Array.isArray(chat.messages) &&
              chat.messages.every(
                (message) =>
                  typeof message.id === 'string' &&
                  Array.isArray(message.parts),
              ),
          )
        )
          throw new Error('Invalid history');
        restored = data.chats;
        active = data.activeId;
      }
    } catch {
      setNotice('浏览器历史记录无法读取，请检查本地存储。');
    }
    if (!restored.length) restored = [createConversation(initialConfig)];
    restored = restored.map((chat) => {
      const model = initialConfig.models.find(
        (model) => model.key === chat.model,
      );
      if (!model)
        return {
          ...chat,
          model: initialConfig.defaultModel ?? '',
          thinkingLevel: initialConfig.defaultThinkingLevel,
        };
      return {
        ...chat,
        thinkingLevel: model.thinkingLevels.includes(chat.thinkingLevel)
          ? chat.thinkingLevel
          : (model.thinkingLevels[0] ?? 'off'),
      };
    });
    setChats(restored);
    setActiveId(
      restored.some((chat) => chat.id === active) ? active : restored[0].id,
    );
    setReady(true);
  }, [initialConfig]);

  React.useEffect(() => {
    if (!ready) return;
    const save = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current.current));
      } catch {
        setNotice('浏览器存储空间不足，请先导出重要对话。');
      }
    };
    const timer = setTimeout(save, 300);
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
    };
  }, [chats, activeId, ready]);

  const updateMessages = React.useCallback(
    (id: string, messages: UIMessage[]) => {
      setChats((chats) =>
        chats.map((chat) => {
          if (chat.id !== id || chat.messages === messages) return chat;
          const first = messages.find((message) => message.role === 'user');
          return {
            ...chat,
            messages,
            title: first
              ? textOf(first).replace(/\s+/g, ' ').slice(0, 28)
              : 'New Chat',
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [],
  );
  const updateSelection = React.useCallback(
    (id: string, model: string, thinkingLevel: ThinkingLevel) => {
      setChats((chats) =>
        chats.map((chat) =>
          chat.id === id ? { ...chat, model, thinkingLevel } : chat,
        ),
      );
    },
    [],
  );
  function newChat() {
    if (busy) return;
    const chat = createConversation(config);
    setChats((chats) => [chat, ...chats]);
    setActiveId(chat.id);
  }
  async function reload() {
    setReloading(true);
    try {
      const response = await fetch('/api/config?refresh=1');
      const next = await response.json();
      if (!response.ok) throw new Error(next.error ?? '读取配置失败');
      setConfig(next);
      await reloadHarness();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '读取配置失败');
    } finally {
      setReloading(false);
    }
  }
  async function deleteChat() {
    if (busy) return;
    const response = await fetch(`/api/chats/${activeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      setNotice(await response.text());
      return false;
    }
    const remaining = chats.filter((chat) => chat.id !== activeId);
    if (!remaining.length) remaining.push(createConversation(config));
    setChats(remaining);
    setActiveId(remaining[0].id);
    return true;
  }
  function updatePermission(permissionMode: PermissionMode) {
    setChats((chats) =>
      chats.map((chat) =>
        chat.id === activeId ? { ...chat, permissionMode } : chat,
      ),
    );
  }
  const clearSkillRequest = React.useCallback(
    () => setSkillRequest(undefined),
    [],
  );
  function useSkill(name: string) {
    setSkillRequest({ name, nonce: Date.now() });
  }
  const active = chats.find((chat) => chat.id === activeId);
  function exportChat() {
    if (!active?.messages.length) return;
    const content =
      `# ${active.title}\n\n` +
      active.messages
        .map(
          (message) =>
            `## ${message.role === 'user' ? 'You' : 'Pi'}\n\n${textOf(message)}`,
        )
        .join('\n\n---\n\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/markdown;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `${active.title.replace(/[\\/:*?"<>|]/g, '-')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return {
    harnessOpen,
    setHarnessOpen,
    harness,
    setHarness,
    reloadHarness,
    skillRequest,
    clearSkillRequest,
    useSkill,
    updatePermission,
    config,
    chats,
    active,
    ready,
    busy,
    setBusy,
    notice,
    setNotice,
    activeId,
    setActiveId,
    updateMessages,
    updateSelection,
    newChat,
    reload,
    reloading,
    deleteChat,
    exportChat,
  };
}
export type ChatWorkspace = ReturnType<typeof useChatWorkspace>;

import type { UIMessage } from 'ai';

export const thinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;
export type ThinkingLevel = (typeof thinkingLevels)[number];
export const thinkingLabels: Record<ThinkingLevel, string> = {
  off: '关闭',
  minimal: '最少',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '很高',
  max: '最高',
};
export interface ChatModel {
  key: string;
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  input: ('text' | 'image')[];
  contextWindow: number;
  thinkingLevels: ThinkingLevel[];
}
export interface PiConfig {
  models: ChatModel[];
  defaultModel: string | null;
  defaultThinkingLevel: ThinkingLevel;
  agentDir: string;
  warnings: string[];
}
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  thinkingLevel: ThinkingLevel;
  messages: UIMessage[];
  permissionMode?: PermissionMode;
}

export type PermissionMode = 'allow-reads' | 'allow-edits' | 'allow-all';
export interface HarnessInfo {
  workspace: string;
  execution: 'local-host';
  engineSessionId?: string;
  tools: { name: string; description: string }[];
  skills: {
    name: string;
    description: string;
    filePath: string;
    baseDir: string;
    manualOnly: boolean;
  }[];
  promptSources: {
    path: string;
    kind: 'system' | 'append' | 'context';
    content: string;
  }[];
  systemPrompt: string;
  promptStatus: 'preview' | 'loaded';
  mcpServers: { name: string; transport: string }[];
  warnings: string[];
  loadedAt: string;
  revision: string;
}

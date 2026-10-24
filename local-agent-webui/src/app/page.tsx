import type { Metadata } from 'next';
import { ChatApp } from '@/components/chat-app';
import { getPiConfiguration, getAgentDir } from '@/lib/pi-config';
import type { PiConfig } from '@/lib/types';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Chat · Pi',
  description: 'The AI Elements Chatbot example connected to local Pi Agent.',
};
export default async function Home() {
  let config: PiConfig;
  try {
    config = (await getPiConfiguration()).config;
  } catch {
    config = {
      models: [],
      defaultModel: null,
      defaultThinkingLevel: 'off',
      agentDir: getAgentDir(),
      warnings: ['读取 Pi 配置失败，请检查配置文件与权限，然后重新加载。'],
    };
  }
  return <ChatApp config={config} />;
}

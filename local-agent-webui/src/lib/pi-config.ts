import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ModelRuntime,
  type ProviderConfig,
} from '@earendil-works/pi-coding-agent';
import { getSupportedThinkingLevels } from '@earendil-works/pi-ai';
import { thinkingLevels, type PiConfig, type ThinkingLevel } from './types';

export function getAgentDir() {
  return resolve(
    /* turbopackIgnore: true */ process.env.PI_CODING_AGENT_DIR ||
      join(homedir(), '.pi', 'agent'),
  );
}

let cached: { time: number; promise: ReturnType<typeof load> } | undefined;
async function load() {
  const agentDir = getAgentDir();
  let settings: Record<string, unknown> = {};
  const warnings: string[] = [];
  try {
    settings = JSON.parse(
      await readFile(join(agentDir, 'settings.json'), 'utf8'),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      warnings.push('Pi settings.json 无法解析，请检查 JSON 格式。');
  }
  const runtime = await ModelRuntime.create({
    authPath: join(agentDir, 'auth.json'),
    modelsPath: join(agentDir, 'models.json'),
    allowModelNetwork: false,
  });
  if (runtime.getError())
    warnings.push('Pi 模型配置存在问题，请在 Pi CLI 中检查 models.json。');
  const available = await runtime.getAvailable();
  const models = available
    .map((model) => ({
      key: `${model.provider}/${model.id}`,
      id: model.id,
      name: model.name,
      provider: model.provider,
      reasoning: model.reasoning,
      input: model.input,
      contextWindow: model.contextWindow,
      thinkingLevels: getSupportedThinkingLevels(model).filter(
        (level): level is ThinkingLevel =>
          thinkingLevels.includes(level as ThinkingLevel),
      ),
    }))
    .sort(
      (a, b) =>
        a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name),
    );
  const preferred = `${settings.defaultProvider}/${settings.defaultModel}`;
  const defaultModel =
    models.find((model) => model.key === preferred) ?? models[0];
  if (
    defaultModel &&
    preferred !== 'undefined/undefined' &&
    defaultModel.key !== preferred
  )
    warnings.push('Pi 默认模型当前不可用，已选择一个可用模型。');
  const requested = settings.defaultThinkingLevel as ThinkingLevel;
  const defaultThinkingLevel = defaultModel?.thinkingLevels.includes(requested)
    ? requested
    : defaultModel?.thinkingLevels.includes('medium')
      ? 'medium'
      : (defaultModel?.thinkingLevels[0] ?? 'off');
  // Registered-provider APIs only enumerate extension registrations, not models.json.
  // Keep the original auth/endpoint settings and use Pi's normalized model metadata.
  let providerSettings: Record<
    string,
    ProviderConfig & {
      modelOverrides?: Record<string, { headers?: Record<string, string> }>;
    }
  > = {};
  try {
    const file = JSON.parse(
      await readFile(join(agentDir, 'models.json'), 'utf8'),
    );
    providerSettings = file.providers ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT' && !warnings.length)
      warnings.push('models.json 无法解析，请检查 Pi 配置。');
  }
  const providerIds = new Set([
    ...Object.keys(providerSettings),
    ...available.map((model) => model.provider),
  ]);
  const providers: Record<string, ProviderConfig> = Object.fromEntries(
    [...providerIds].map((id) => {
      const settings = providerSettings[id] ?? {};
      return [
        id,
        {
          ...settings,
          // Include cached built-in catalogs as well as custom models. A fresh
          // harness runtime otherwise only sees the SDK's bundled catalog.
          models: runtime.getModels(id).map((model) => ({
            ...model,
            headers: {
              ...settings.models?.find((entry) => entry.id === model.id)
                ?.headers,
              ...settings.modelOverrides?.[model.id]?.headers,
            },
          })),
        },
      ];
    }),
  );
  const config: PiConfig = {
    models,
    defaultModel: defaultModel?.key ?? null,
    defaultThinkingLevel,
    agentDir,
    warnings,
  };
  return { config, providers };
}

export async function getPiConfiguration(refresh = false) {
  if (refresh || !cached || Date.now() - cached.time > 30_000) {
    const promise = load();
    cached = { time: Date.now(), promise };
    promise.catch(() => {
      if (cached?.promise === promise) cached = undefined;
    });
  }
  return cached.promise;
}

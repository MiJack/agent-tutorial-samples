import { readFile, stat } from 'node:fs/promises';
import { resolve, join, dirname, delimiter, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import {
  DefaultResourceLoader,
  SettingsManager,
  getPackageDir,
  formatSkillsForPrompt,
  stripFrontmatter,
  loadSkills,
  type Skill,
  type NormalizedBuildSystemPromptOptions,
} from '@earendil-works/pi-coding-agent';
import { getAgentDir } from './pi-config';
import type { HarnessInfo } from './types';

export const nativeTools = [
  { name: 'read', description: '读取项目文件、Skill 指令与参考资料' },
  { name: 'write', description: '创建或覆写文件' },
  { name: 'edit', description: '精确编辑文件内容' },
  { name: 'bash', description: '在本地工作目录执行 Shell、CLI 与 Skill 脚本' },
  { name: 'grep', description: '搜索文件内容' },
  { name: 'glob', description: '查找文件路径' },
  { name: 'ls', description: '列出目录' },
];
export function getWorkspace() {
  return resolve(
    /* turbopackIgnore: true */ process.env.PI_WEB_WORKSPACE || process.cwd(),
  );
}
async function json(path: string) {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw new Error(`配置文件无法解析：${path}`);
  }
}
export async function loadHarnessResources() {
  const workspace = getWorkspace();
  if (!(await stat(workspace)).isDirectory())
    throw new Error('PI_WEB_WORKSPACE 必须是存在的项目目录。');
  const agentDir = getAgentDir();
  const globalSettings = await json(join(agentDir, 'settings.json'));
  const projectSettings = await json(join(workspace, '.pi', 'settings.json'));
  // Reuse resource configuration without bootstrapping CLI extension packages.
  const configuredSkills = [
    [globalSettings.skills, agentDir],
    [projectSettings.skills, join(workspace, '.pi')],
  ].flatMap(([value, base]) =>
    Array.isArray(value)
      ? value
          .filter((path): path is string => typeof path === 'string')
          .map((path) => {
            const prefix = /^[!+-]/.test(path) ? path[0] : '';
            const value = prefix ? path.slice(1) : path;
            return (
              prefix +
              (isAbsolute(value) || value.startsWith('~')
                ? value
                : resolve(String(base), value))
            );
          })
      : [],
  );
  const skillDirs =
    process.env.PI_WEB_SKILL_DIRS?.split(delimiter).filter(Boolean);
  const loader = new DefaultResourceLoader({
    cwd: workspace,
    agentDir,
    settingsManager: SettingsManager.inMemory({
      packages: [],
      skills: configuredSkills,
    }),
    noExtensions: true,
    noThemes: true,
    noPromptTemplates: true,
    noSkills: Boolean(skillDirs),
    skillsOverride: skillDirs
      ? () =>
          loadSkills({
            cwd: workspace,
            agentDir,
            skillPaths: skillDirs,
            includeDefaults: false,
          })
      : undefined,
  });
  await loader.reload({ resolveProjectTrust: async () => true });
  const { skills, diagnostics } = loader.getSkills();
  const contextFiles = loader.getAgentsFiles().agentsFiles;
  const system = loader.getSystemPrompt();
  const appended = loader.getAppendSystemPrompt();
  const promptSources: HarnessInfo['promptSources'] = contextFiles.map(
    (file) => ({ ...file, kind: 'context' }),
  );
  const systemSource = loader.getSystemPromptSource();
  if (systemSource)
    promptSources.unshift({
      path: systemSource.path,
      kind: 'system',
      content: system ?? '',
    });
  for (const source of loader.getAppendSystemPromptSources())
    promptSources.push({
      path: source.path,
      kind: 'append',
      content: await readFile(source.path, 'utf8'),
    });
  const mcpServers: Record<string, unknown> = {};
  const warnings = diagnostics.map((item) => item.message);
  for (const path of [
    join(agentDir, 'mcp.json'),
    join(workspace, '.pi', 'mcp.json'),
  ]) {
    const config = await json(path);
    const servers = config.mcpServers ?? config.servers;
    if (servers && typeof servers === 'object' && !Array.isArray(servers))
      for (const [name, value] of Object.entries(servers)) {
        if (value && typeof value === 'object') {
          const entry = value as {
            enabled?: boolean;
            disabled?: boolean;
            command?: string;
            url?: string;
            type?: string;
          };
          if (entry.enabled === false || entry.disabled) {
            delete mcpServers[name];
            continue;
          }
          const inherited =
            !entry.command && !entry.url && !entry.type
              ? mcpServers[name]
              : undefined;
          mcpServers[name] = {
            ...(inherited && typeof inherited === 'object' ? inherited : {}),
            ...entry,
          };
        }
      }
  }
  const preview = [
    system ?? 'Pi 默认系统提示词：首次执行后可查看运行时完整内容。',
    ...appended,
    ...contextFiles.map((file) => `${file.path}\n${file.content}`),
    formatSkillsForPrompt(skills),
    `工作目录：${workspace}`,
  ].join('\n\n');
  const applyPrompt = (options: NormalizedBuildSystemPromptOptions) => {
    options.customPrompt = system;
    options.forceSystemPrompt = undefined;
    options.appendSystemPrompt = appended.join('\n\n');
    options.contextFiles = contextFiles;
    options.skills = skills;
    options.cwd = workspace;
  };
  const info: HarnessInfo = {
    workspace,
    execution: 'local-host',
    tools: nativeTools,
    skills: skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      filePath: skill.filePath,
      baseDir: skill.baseDir,
      manualOnly: skill.disableModelInvocation,
    })),
    promptSources,
    systemPrompt: preview,
    promptStatus: 'preview',
    mcpServers: Object.entries(mcpServers).map(([name, value]) => ({
      name,
      transport: (value as { url?: string }).url ? 'HTTP' : 'stdio',
    })),
    warnings,
    loadedAt: new Date().toISOString(),
    revision: createHash('sha256')
      .update(JSON.stringify({ workspace, skills, promptSources, mcpServers }))
      .digest('hex')
      .slice(0, 12),
  };
  return {
    info,
    skills,
    applyPrompt,
    mcpServers,
    readableRoots: [
      getPackageDir(),
      ...new Set(
        skills.map((skill) => {
          const index = skill.baseDir.indexOf('/skills/');
          return index >= 0 ? skill.baseDir.slice(0, index + 7) : skill.baseDir;
        }),
      ),
    ],
  };
}
export async function expandSkillCommand(
  message: { role: 'user'; content: unknown },
  skills: Skill[],
) {
  const content = message.content;
  if (!Array.isArray(content)) return undefined;
  const first = content.find((part) => part.type === 'text');
  const match =
    first?.text && /^\/skill:([^\s]+)(?:\s+([\s\S]*))?$/.exec(first.text);
  if (!match) return undefined;
  const skill = skills.find((skill) => skill.name === match[1]);
  if (!skill) throw new Error(`未找到 Skill：${match[1]}`);
  const body = stripFrontmatter(await readFile(skill.filePath, 'utf8'));
  first.text = `<skill name="${skill.name}" source="${skill.filePath}">\nSkill 资源目录：${dirname(skill.filePath)}。相对路径按此目录解析。\n\n${body}\n</skill>${match[2] ? `\n\n${match[2]}` : ''}`;
  return skill;
}

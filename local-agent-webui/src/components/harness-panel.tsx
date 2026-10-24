'use client';

import * as React from 'react';
import { BotIcon, BookOpenIcon, RefreshCwIcon } from 'lucide-react';
import type { ChatWorkspace } from '@/hooks/use-chat-workspace';
import type { PermissionMode } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CodeBlock, CodeBlockContent } from '@/components/ui/code-block';

export function HarnessStatus({ workspace }: { workspace: ChatWorkspace }) {
  const info = workspace.harness;
  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <BotIcon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Pi Harness</ItemTitle>
        <ItemDescription>
          {info
            ? `${info.tools.length} 工具 · ${info.skills.length} Skills · ${info.promptSources.length} 提示词文件 · ${info.workspace}`
            : '正在加载本机工具、Skills 与系统提示词…'}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="outline"
          size="sm"
          onClick={() => workspace.setHarnessOpen(true)}
        >
          查看
        </Button>
      </ItemActions>
    </Item>
  );
}

const policies = [
  { value: 'allow-reads', label: '只读自动执行；写入和 Shell 需批准' },
  { value: 'allow-edits', label: '读写自动执行；Shell 需批准' },
  { value: 'allow-all', label: '所有内置工具自动执行' },
];
export function HarnessPanel({ workspace }: { workspace: ChatWorkspace }) {
  const info = workspace.harness;
  const [selectedSkill, setSelectedSkill] = React.useState('');
  const [source, setSource] = React.useState('runtime');
  const [skillDocument, setSkillDocument] = React.useState<{
    name: string;
    content: string;
    filePath: string;
  }>();
  const selected = info?.skills.find((skill) => skill.name === selectedSkill);
  const document =
    source === 'runtime'
      ? info?.systemPrompt
      : info?.promptSources.find((file) => file.path === source)?.content;
  async function preview() {
    if (!selected) return;
    const response = await fetch(
      `/api/harness?skill=${encodeURIComponent(selected.name)}`,
    );
    const data = await response.json();
    if (!response.ok) {
      workspace.setNotice(data.error ?? 'Skill 读取失败');
      return;
    }
    setSkillDocument(data);
  }
  return (
    <>
      <Dialog
        open={workspace.harnessOpen}
        onOpenChange={workspace.setHarnessOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Harness 运行资源</DialogTitle>
            <DialogDescription>
              本地工具、按需加载的 Skills 和实际系统提示词。CLI
              扩展文件不会自动执行。
            </DialogDescription>
          </DialogHeader>
          {!info ? (
            <FieldDescription>资源正在加载，可点击重新加载。</FieldDescription>
          ) : (
            <Tabs defaultValue="tools">
              <TabsList>
                <TabsTrigger value="tools">工具</TabsTrigger>
                <TabsTrigger value="skills">
                  Skills ({info.skills.length})
                </TabsTrigger>
                <TabsTrigger value="prompts">提示词</TabsTrigger>
              </TabsList>
              <TabsContent value="tools">
                <ScrollArea className="h-72">
                  <FieldGroup>
                    <Field>
                      <FieldLabel>工作目录</FieldLabel>
                      <Input value={info.workspace} readOnly />
                      <FieldDescription>
                        工具使用本机真实 Shell 和已安装的 CLI。通过
                        PI_WEB_WORKSPACE 设置项目目录。
                      </FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel>当前对话内置工具权限</FieldLabel>
                      <Select
                        items={policies}
                        value={
                          workspace.active?.permissionMode ?? 'allow-reads'
                        }
                        onValueChange={(value) =>
                          value &&
                          workspace.updatePermission(value as PermissionMode)
                        }
                        disabled={workspace.busy}
                      >
                        <SelectTrigger aria-label="Tool permission mode">
                          <SelectValue>
                            {
                              policies.find(
                                (policy) =>
                                  policy.value ===
                                  (workspace.active?.permissionMode ??
                                    'allow-reads'),
                              )?.label
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {policies.map((policy) => (
                            <SelectItem key={policy.value} value={policy.value}>
                              {policy.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <FieldGroup>
                      {info.tools.map((tool) => (
                        <Field key={tool.name}>
                          <FieldLabel>{tool.name}</FieldLabel>
                          <FieldDescription>
                            {tool.description}
                          </FieldDescription>
                        </Field>
                      ))}
                      <Field>
                        <FieldLabel>MCP 配置</FieldLabel>
                        <FieldDescription>
                          {info.mcpServers.length
                            ? info.mcpServers
                                .map(
                                  (server) =>
                                    `${server.name} (${server.transport})`,
                                )
                                .join('、')
                            : '未配置 MCP。可读取全局和项目 .pi/mcp.json。'}
                        </FieldDescription>
                      </Field>
                    </FieldGroup>
                  </FieldGroup>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="skills">
                <Command>
                  <CommandInput placeholder="搜索 Skills…" />
                  <CommandList>
                    <CommandEmpty>没有匹配的 Skill</CommandEmpty>
                    <CommandGroup heading="按需加载；点击选择">
                      {info.skills.map((skill) => (
                        <CommandItem
                          key={skill.name}
                          value={`${skill.name} ${skill.description}`}
                          onSelect={() => setSelectedSkill(skill.name)}
                          title={skill.description}
                        >
                          <BookOpenIcon />
                          {skill.name}
                          {skill.manualOnly ? '（仅手动）' : ''}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <FieldDescription>
                  只将名称和描述用于自动发现，完整指令及脚本按需读取。
                  {selected ? ` 已选择：${selected.name}` : ''}
                </FieldDescription>
                {selected && (
                  <DialogFooter>
                    <Button variant="outline" onClick={() => void preview()}>
                      查看 SKILL.md
                    </Button>
                    <Button
                      disabled={workspace.busy}
                      onClick={() => {
                        workspace.useSkill(selected.name);
                        workspace.setHarnessOpen(false);
                      }}
                    >
                      使用此 Skill
                    </Button>
                  </DialogFooter>
                )}
              </TabsContent>
              <TabsContent value="prompts">
                <FieldGroup>
                  <Field>
                    <FieldLabel>
                      {info.promptStatus === 'loaded'
                        ? '最近一轮实际系统提示词'
                        : '已发现的提示词（执行后可查看完整运行时内容）'}
                    </FieldLabel>
                    <Select
                      items={[
                        { value: 'runtime', label: '完整系统提示词' },
                        ...info.promptSources.map((file) => ({
                          value: file.path,
                          label: `${file.kind}: ${file.path.split('/').slice(-2).join('/')}`,
                        })),
                      ]}
                      value={source}
                      onValueChange={(value) => value && setSource(value)}
                    >
                      <SelectTrigger aria-label="System prompt source">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="runtime">完整系统提示词</SelectItem>
                        {info.promptSources.map((file) => (
                          <SelectItem key={file.path} value={file.path}>
                            {file.kind}:{' '}
                            {file.path.split('/').slice(-2).join('/')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <CodeBlock size="sm">
                    <CodeBlockContent wrap className="max-h-64">
                      {document ?? '未找到所选提示词文件。'}
                    </CodeBlockContent>
                  </CodeBlock>
                  <FieldDescription>
                    {info.loadedAt} · {info.revision}
                  </FieldDescription>
                </FieldGroup>
              </TabsContent>
            </Tabs>
          )}
          {info?.warnings.length ? (
            <FieldDescription>
              {info.warnings.slice(0, 3).join('；')}
            </FieldDescription>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => void workspace.reloadHarness()}
            >
              <RefreshCwIcon />
              重新加载资源
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!skillDocument}
        onOpenChange={(open) => !open && setSkillDocument(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{skillDocument?.name}</DialogTitle>
            <DialogDescription>Skill 原始指令与资源目录</DialogDescription>
          </DialogHeader>
          <CodeBlock size="sm">
            <CodeBlockContent wrap className="max-h-64">
              {skillDocument
                ? `${skillDocument.filePath}\n\n${skillDocument.content}`
                : ''}
            </CodeBlockContent>
          </CodeBlock>
        </DialogContent>
      </Dialog>
    </>
  );
}

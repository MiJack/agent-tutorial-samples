# 开发前调研与接入决策

调研日期：2026-10-23。业务功能开发暂停后完成此记录；此前仅有空项目初始化、依赖安装与 shadcn 组件下载。

## 阅读范围

完整阅读用户提供的两个入口页面正文，包括章节、示例和限制；并沿与本项目有关的链接补读以下官方资料。入口侧栏链接不等于本项目需要实现整个文档站的全部功能。

| 资料                                                                                                                                                                                                                                      | 覆盖内容                                                                                                        | 本项目使用方式                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [shadcn/ui 介绍](https://ui.shadcn.com/docs)                                                                                                                                                                                              | Open Code、Composition、Distribution、Beautiful Defaults、AI-Ready 五项原则；组件、AI Elements 与 Registry 导航 | 下载原有组件源码后组合，避免另造基础组件                               |
| [Harness 入口](https://ai-sdk.dev/providers/ai-sdk-harnesses)                                                                                                                                                                             | 统一 Agent 抽象、可用适配器、创建与释放会话示例                                                                 | 使用 HarnessAgent，指定官方 Pi 适配器                                  |
| [Next.js 安装](https://ui.shadcn.com/docs/installation/next)、[components.json](https://ui.shadcn.com/docs/components-json)                                                                                                               | 新建/既有项目两类安装流程、CLI、路径别名、RSC、主题配置、registry                                               | Next.js App Router、TypeScript、Tailwind v4、CLI 安装组件              |
| [主题](https://ui.shadcn.com/docs/theming)、[暗色模式](https://ui.shadcn.com/docs/dark-mode/next)、[CLI](https://ui.shadcn.com/docs/cli)                                                                                                  | 语义 CSS token、明暗主题、组件新增与更新流程                                                                    | 统一 token；组件保存在 src/components/ui                               |
| [Select](https://ui.shadcn.com/docs/components/select)、[Dialog](https://ui.shadcn.com/docs/components/dialog)、[AI Elements](https://ui.shadcn.com/docs/ai-elements)                                                                     | 表单选择、对话框、聊天/推理/输入/模型选择组合模式                                                               | 模型与思考菜单、配置对话框、流式消息区                                 |
| [Harness 概念](https://ai-sdk.dev/docs/ai-sdk-harnesses/overview)、[HarnessAgent](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-agent)                                                                                                 | Agent/适配器/沙箱/会话；生成、流式、历史、恢复、生命周期、跨轮配置、工具、沙箱和可观察性                        | 保留原生会话状态，逐轮设置模型                                         |
| [Harness UI](https://ai-sdk.dev/docs/ai-sdk-harnesses/ui)、[Tools](https://ai-sdk.dev/docs/ai-sdk-harnesses/tools)、[Adapters](https://ai-sdk.dev/docs/ai-sdk-harnesses/harness-adapters)                                                 | useChat 接入、UIMessage stream、工具种类/过滤/审批、运行位置与能力差异                                          | 前端 useChat；后端转换 Harness stream；聊天默认不启用文件和 Shell 工具 |
| [Pi Harness](https://ai-sdk.dev/providers/ai-sdk-harnesses/pi)                                                                                                                                                                            | 安装、配置、认证、路径策略、扩展、恢复、沙箱、工具和限制                                                        | createPi + 本地 just-bash；不依赖 Vercel 云账号                        |
| [Pi 官方项目](https://github.com/earendil-works/pi)、[模型](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)、[SDK](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/sdk.md) | 安装/Node 版本、认证优先级、可用模型、原生持久化与 SDK 生命周期                                                 | 复用本机模型与认证，读取模型支持的思考档位                             |
| 当前安装包的 TypeScript 声明和源码                                                                                                                                                                                                        | 网页没有列出的 agentDir、ModelRuntime、ProviderConfig、getSupportedThinkingLevels；本地沙箱 FS API              | 以锁定版本的真实接口补齐网页遗漏，并做最小接入验证                     |

## 已补齐的信息与决策

| 原文缺口或容易误读之处                | 补充证据 / 结论                                                                                                    | 实现决策                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| “两个页面”是否是要制作两个网页        | 用户提供的是 UI 组件站与 Agent 接入站；两个入口都属于技术资料                                                      | 建设一个本地聊天网站，含对话和配置界面                                                                                           |
| 统一 Agent 与普通模型 Provider 的区别 | Harness 负责 Agent 会话、工具与上下文；直接 streamText 调模型会绕开 Pi                                             | 调用链固定为 useChat → API → HarnessAgent → createPi → Pi runtime → 所选模型                                                     |
| 示例依赖 Vercel Sandbox，本地是否可用 | HarnessAgent 文档说明 Pi 属于宿主进程运行时，不要求桥接端口                                                        | 使用 @ai-sdk/sandbox-just-bash；不安装 sandbox-vercel                                                                            |
| “本地运行”是否意味着推理完全离线      | Web 服务和会话存储本地运行；目前本机默认配置指向远端模型服务                                                       | 明确区分本地 WebUI 与模型计算位置；不宣称完全离线                                                                                |
| 本地 Pi 配置位置                      | 默认 ~/.pi/agent，允许 PI_CODING_AGENT_DIR 覆盖；settings.json、models.json、auth.json、models-store.json 各有职责 | 仅在服务端读取；API 只返回模型与配置状态，不返回 key、token、headers 或原始配置                                                  |
| 如何覆盖内置与自定义供应商            | ModelRuntime 统一合并内置目录、缓存目录、自定义 providers 与可用认证                                               | 模型列表取 getAvailable；自定义 providers 通过官方 createPi.providers 传递                                                       |
| 认证不是只读一个 API key              | Pi 支持存储凭证、OAuth、配置里的 key / 命令及环境变量                                                              | 交给 Pi 原生认证流程；不在浏览器保存密钥，不另做登录表单                                                                         |
| 可用模型不等于目录里的所有模型        | Pi 的可用列表取决于供应商认证、配置和缓存                                                                          | 仅允许选择实际可用模型；配置为空或错误时给出操作说明                                                                             |
| 七档思考强度是否所有模型均支持        | 全局联合类型有 off/minimal/low/medium/high/xhigh/max；单模型支持集合可不同                                         | 使用 pi-ai.getSupportedThinkingLevels(model)，前后端均校验；切模型时选有效档位                                                   |
| 直接传 agentDir 的副作用              | 最小验证中发现本机 settings.packages 会触发包解析/克隆，尽管 Harness 不自动启用文件扩展                            | 避免将整套 CLI 设置直接交给 Harness；通过 providers 复用模型配置，通过默认原生认证发现复用凭证；默认模型和思考强度由应用显式传入 |
| 配置复用边界                          | Harness 禁用文件扩展、主题、prompt template 自动发现；MCP 需显式注入                                               | 本期复用用户明确要求的供应商、模型、认证和思考默认值；不宣称完整复制 Pi CLI 的所有插件行为                                       |
| 将历史 messages 重传能否恢复对话      | Harness 只把最新 user 消息视为新输入，原生上下文属于 session                                                       | 稳定 chat ID；保存不透明 resume state 和本地沙箱持久化文件，下一轮恢复同一会话                                                   |
| 本地内存沙箱重启后会丢历史            | resume state 还引用沙箱中的 Pi 原生会话文件                                                                        | just-bash 使用限制根目录的 ReadWriteFs，持久化到 .data 下，每个会话独立目录                                                      |
| 什么时候清理运行时                    | stop 保存恢复信息，destroy 放弃恢复；外部传入沙箱由调用方负责                                                      | 请求结束保存并 stop，释放运行时句柄；删除聊天时一并清理本地数据                                                                  |
| 中止、失败和并发如何处理              | abortSignal 属于逐次调用参数；启动也可能失败                                                                       | 中止向下传递；限制同一会话并发；错误进入 UI stream；恢复状态原子写入                                                             |
| UI 与模型流的关系                     | Harness UI 指定 createUIMessageStream + toUIMessageStream + useChat                                                | 直接复用 AI SDK 的流协议，展示文本和可展开的 reasoning                                                                           |
| Pi 能力限制                           | 不支持结构化 output；图片须文本在前；路径策略不约束 bash                                                           | 本期聚焦文本聊天；不添加不完整的附件、结构化输出或工具审批入口                                                                   |
| 实验 API 的稳定性                     | Harness 文档标记 experimental，接口可能破坏兼容                                                                    | 固定依赖版本并提交 lockfile；更新时重跑接入和恢复测试                                                                            |

## 本机事实（不含凭证）

- 项目目录原为空；没有既有业务代码需要迁移。
- Node.js v24.16.0，Pi CLI v1.4.0，满足 Pi 的 Node 22.19+ 要求。
- 当前安装：Next 16.4.2、React 19.3.1、AI SDK 7.0.150、Harness 1.0.161、Pi Harness 1.0.163、Pi SDK 1.4.0。
- Pi ModelRuntime 发现 57 个可用聊天模型。
- 当前默认供应商 opencode-go，模型 mimo-v2.6-flash，思考强度 high。
- 默认模型支持 off/minimal/low/medium/high；界面不应为它展示 xhigh/max。
- 自定义供应商还包括 bigmodel-anthropic、glm-coding、ali-coding；协议由 Pi 配置提供，不根据供应商名称猜测。

## 尚需验证的事项

以下属于实现后的运行验证，不作为已完成事实：浏览器流式显示、刷新恢复、进程重启恢复、切换模型、停止生成、错误恢复、持久化删除、移动端布局、类型检查和生产构建。真实供应商的配额/延迟/可用性由供应商决定，模型列表有认证不代表远端请求一定成功。

当前没有需要用户另行提供的必要技术信息。先完成最小真实调用与原生会话恢复验证，再开始业务功能开发。若验证暴露缺口，先补充本记录。

## 搜索记录

- opencli registry 中无 ui.shadcn.com / ai-sdk.dev 专用适配器，因此直接读取官方页面。
- 官方文档读取：上述链接；网页搜索 2 个查询（Pi harness 本地 sandbox、shadcn Next.js Tailwind），各 1 次；实现结论只采纳官方资料与当前安装包接口。

## 开发前接入验证结果

独立临时脚本（不属于产品代码）使用真实默认供应商和官方 Harness 完成两轮调用：第一轮记住临时验证码，session.stop() 后保存恢复状态并销毁沙箱句柄；第二轮重新创建沙箱、从磁盘恢复 session，仅发送新问题，准确回复原验证码。Pi settings.json 的 SHA-256 前后一致。该验证已通过，开发前没有遗留的阻断性接入问题。

## 实现与验证时补充核对

- `getRegisteredProviderIds()` / `getRegisteredProviderConfig()` 只反映扩展注册，不包含 `models.json` 的供应商。最终接入从原配置保留端点/认证/headers，并使用 `ModelRuntime.getModels()` 的标准化模型信息；也传递本地缓存中的内置目录，避免新模型只出现在菜单而不能调用。
- 模型级 headers 需保留并应用 `modelOverrides` 的优先级；本地模拟供应商已验证切换前后各自收到对应 headers。
- Next.js 对 `just-bash` 的可选原生压缩依赖不能直接打包；最终通过 `serverExternalPackages` 使用 Node 原生模块加载，生产构建通过。
- 本期不需要新建自定义模型 Provider，不绕开 Harness，也没有引入 Vercel 云沙箱。后续验收结果单独记录于 VALIDATION.md。

## 官网原样复用的后续修订

用户明确要求直接复用官网元素和样式后，重新阅读 AI Elements 的 Chat、Message、Prompt Input、Model Selector、Reasoning 示例，沿官网链接取得 shadcn-ui/chatbot-template。界面改为该模板的 neutral 主题和 base-rhea 组件，不再沿用先前的自定义布局/配色。历史、配置等业务操作采用同套官方组件的默认样式。来源核对见 UI-SOURCES.md 和 UI-SOURCES.json。

## 最终明确的示例基准

用户后续明确实际看到的是 https://elements.ai-sdk.dev/examples/chatbot 。经重新核对，该例使用 Conversation、PromptInput、可搜索 ModelSelector、Reasoning、Sources、Suggestions、Attachments 和 SpeechInput，和前次选用的 chatbot-template 组合并不相同。当前已直接复制该例对应的原始组件，按原 JSX 结构接入 Pi；不再将“模板来自同一网站”视为“完整示例一致”。官方迁移文档允许既有原组件继续使用，因此保留其 API/样式以准确对齐原例。详情与来源快照见 UI-SOURCES.md 及 AI-ELEMENTS-SOURCES.json。

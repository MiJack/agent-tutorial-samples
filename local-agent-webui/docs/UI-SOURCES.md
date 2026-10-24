# 当前界面：指定 Chatbot 示例

当前基准是用户明确指定的 **[AI Elements Chatbot 完整示例](https://elements.ai-sdk.dev/examples/chatbot)**。此前选用的 chatbot-template 是另一个页面组合，不能作为这个示例的等价替代；当前主对话区已经替换。

## 实际接入的组件

| 示例里的组件                                                  | 本项目实际文件                                  | 说明                                     |
| ------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Conversation / ConversationContent / ConversationScrollButton | `src/components/ai-elements/conversation.tsx`   | 原组件滚动容器和滚动按钮                 |
| Message / MessageBranch / MessageContent / MessageResponse    | `src/components/ai-elements/message.tsx`        | 原消息布局、分支容器和 Streamdown 渲染   |
| ModelSelector 及搜索、分组、图标                              | `src/components/ai-elements/model-selector.tsx` | 搜索弹窗，接入 Pi 的实际供应商与模型     |
| PromptInput、Body、Footer、Tools、Submit                      | `src/components/ai-elements/prompt-input.tsx`   | 原输入区、附件菜单、发送/停止按钮        |
| Attachments / AttachmentPreview / AttachmentRemove            | `src/components/ai-elements/attachments.tsx`    | 原附件预览；实际发送本地文件             |
| Reasoning / ReasoningTrigger / ReasoningContent               | `src/components/ai-elements/reasoning.tsx`      | 原思考折叠区，显示真实模型 reasoning     |
| Sources / Source                                              | `src/components/ai-elements/sources.tsx`        | 仅在运行时返回真实 source-url 时显示     |
| SpeechInput                                                   | `src/components/ai-elements/speech-input.tsx`   | 原语音输入组件，依赖浏览器支持及用户授权 |
| Suggestions / Suggestion                                      | `src/components/ai-elements/suggestion.tsx`     | 原底部横向建议栏，使用示例的八条提示词   |
| Shimmer                                                       | `src/components/ai-elements/shimmer.tsx`        | 原推理进行中的文字效果                   |

这些文件直接来自 AI Elements 官方发布 registry，**只替换导入路径，没有修改组件体和样式**。它们依赖的 15 个 shadcn Radix 默认组件也直接复制，放在 `src/components/ai-elements/ui/`，以保留原示例的属性接口与样式。顶部历史和配置仍使用先前官方组件。

`src/components/chat.tsx` 按指定示例的 JSX 结构组合上述组件；其中的字面量 className 均可在原示例源码中找到。它已不再使用另一个模板的 PromptForm、Select 模型菜单、居中欢迎提示或 MessageScroller 组合。

## 迁移关系

[shadcn AI Elements 说明](https://ui.shadcn.com/docs/ai-elements)将这些元素映射到 Chat、Message、Model Selector、Prompt Input、Reasoning、Sources、Suggestion 等新模式；同时说明已有项目复制的原组件可以继续使用，不要求迁移。

为了准确对齐这次给出的完整示例，保留原组件接口与代码，避免迁移时又换成外观不同的组合。没有把迁移说明误当成“两个页面的完整示例布局相同”。

## Pi 业务绑定与显示条件

- 原示例的固定聊天记录与模拟流式回复，替换为现有 AI SDK Pi Harness；新对话不会出现示例里的假聊天记录。
- 模型数据来自 Pi；额外的思考强度使用原 PromptInputSelect，并按模型支持的档位设置。
- 文本/代码附件会进入真实模型输入；图片仅发送给支持图片的模型。每次最多 4 个文件，每个不超过 4 MB。PDF 等其他文档需要先转成文本。
- 原示例 Search 控件保留在接入代码中，但当前 Pi 没有联网搜索工具，因此按能力隐藏；不把外观切换当成已经执行搜索。
- Sources 仅在真实来源数据返回时显示。已复用消息分支容器，但当前 Pi 对话没有版本切换入口，不生成演示分支。
- Streamdown 的 Tailwind `@source` 扫描指令按[官方安装说明](https://streamdown.ai/docs/getting-started)增加。没有新增视觉 CSS 规则。

## 来源校验

- [AI-ELEMENTS-SOURCES.json](AI-ELEMENTS-SOURCES.json)：当前 25 个原始 AI Elements / shadcn 依赖文件、官方 registry URL、原始 SHA-256 和导入路径转换说明。
- `docs/upstream/ai-elements/`：下载的原始 registry JSON 及指定 Chatbot 示例代码，供离线逐文件比对。
- [UI-SOURCES.json](UI-SOURCES.json)：早期官方模板基础资源及顶部管理控件的来源记录，不再用其文件数量证明主聊天示例一致。

```bash
npm run verify:ui
```

校验会把当前 AI Elements 文件与原始 snapshot 做内容比对，仅允许导入路径变化；并检查主对话布局没有引入指定示例以外的 className。上游授权见 `third_party/ai-elements.LICENSE` 和 `third_party/shadcn-chatbot-template.LICENSE`。

# 组件来源与校验

本文对应教程的“搭建聊天界面”与“完成验收”阶段。主聊天区使用 [AI Elements Chatbot 示例](https://elements.ai-sdk.dev/examples/chatbot) 的原始组件与布局，业务代码接入真实 Pi 数据和事件。

## 页面组件与文件

| 教程中的功能 | 组件与实现位置 |
| --- | --- |
| 消息、滚动与 Markdown | `src/components/ai-elements/conversation.tsx`、`message.tsx` |
| 模型搜索与思考档位 | `model-selector.tsx`、`prompt-input.tsx` |
| 输入、附件与语音 | `prompt-input.tsx`、`attachments.tsx`、`speech-input.tsx` |
| 推理、来源与建议栏 | `reasoning.tsx`、`sources.tsx`、`suggestion.tsx` |
| 工具、终端与审批 | `tool.tsx`、`terminal.tsx`、`confirmation.tsx` |
| 资源面板 | `src/components/harness-panel.tsx` 与官方基础组件 |
| 页面业务组合 | [chat.tsx](../../src/components/chat.tsx)、[harness-tool.tsx](../../src/components/harness-tool.tsx) |

AI Elements 及匹配的 Radix 依赖放在 `src/components/ai-elements/`，原组件仅适配导入路径。管理控件使用 `src/components/ui/` 的官方基础组件。两组组件接口有区别，使用时应保留各自匹配的依赖。

主题、Geist 字体和默认布局来自保存的官方基础资源。Streamdown 的 Tailwind 扫描配置位于 `src/app/globals.css`。

## 来源文件

| 文件 | 用途 |
| --- | --- |
| [AI-ELEMENTS-SOURCES.json](ui/AI-ELEMENTS-SOURCES.json) | 31 个原始组件及依赖的来源、摘要和快照位置，以及 Chatbot 示例源码位置 |
| [UI-SOURCES.json](ui/UI-SOURCES.json) | 主题、样式和基础组件的固定摘要 |
| [HARNESS-UI-SOURCES.json](ui/HARNESS-UI-SOURCES.json) | 资源面板补充组件的固定摘要 |
| [upstream/ai-elements/](ui/upstream/ai-elements/) | 清单使用的 32 份原始 registry 和示例快照 |

## 执行来源检查

在 `local-agent-webui` 目录运行：

```bash
npm run verify:ui
```

脚本位于 [verify-ui-source.mjs](../../scripts/verify-ui-source.mjs)，会检查原组件正文、导入适配、基础文件摘要、主聊天布局类名，以及是否增加了自定义样式表。它使用本地快照，不需要在线下载上游源码。

来源检查证明的是组件和约定的一致性；页面布局、滚动、弹窗与交互仍需按教程在浏览器中验证。业务绑定只显示真实能力：没有搜索工具时隐藏入口，没有实际来源时不展示引用。

## 上游授权

- [AI Elements](../../third_party/ai-elements.LICENSE)
- [shadcn/ui](../../third_party/shadcn-ui.LICENSE)
- [Chatbot 基础模板](../../third_party/shadcn-chatbot-template.LICENSE)

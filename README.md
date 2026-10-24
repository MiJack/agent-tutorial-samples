# Agent 教程案例

本仓库收集可在本地运行的 AI Agent 教学案例。每个案例放在独立目录中，包含运行源码、依赖锁文件、教程和验证说明。

## 案例

| 案例 | 内容 | 入口 |
| --- | --- | --- |
| 本地 Agent WebUI | 用官方 AI Elements 组件和 AI SDK Pi Harness 搭建聊天工作台，支持工具审批、Skill、提示词和原生会话恢复 | [运行说明](local-agent-webui/README.md) · [教程目录](local-agent-webui/docs/README.md) |

## 快速开始

```bash
git clone https://github.com/MiJack/agent-tutorial-samples.git
cd agent-tutorial-samples/local-agent-webui
npm ci
npm run dev
```

访问 http://127.0.0.1:3000 。首次使用前，需要配置自己的 Pi 供应商认证；详细操作见案例运行说明。

## 目录

```text
agent-tutorial-samples/
├── README.md
└── local-agent-webui/
    ├── src/                 WebUI 与 Pi Harness 接入
    ├── tests/               自动化测试
    ├── scripts/             官方组件来源校验
    ├── docs/                教程、运行截图与组件参考资料
    ├── third_party/         上游组件授权
    └── package-lock.json    可复现的依赖安装
```

本仓库不包含个人认证、会话数据、依赖安装目录或构建缓存。上游组件保留各自来源和授权，见案例的 third_party 目录。

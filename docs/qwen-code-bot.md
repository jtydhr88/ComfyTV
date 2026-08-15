# ComfyTV Qwen Code Bot 集成文档

## 概述

ComfyTV 支持将 [Qwen Code](https://help.aliyun.com/zh/model-studio/qwen-code) 作为内嵌 AI 智能体提供者（Provider），与 Claude Code 并列。用户可通过 ComfyTV 侧边栏的 Bot 面板直接与 Qwen Code 对话，利用其代码生成、画布操控、项目管理等能力，配合 MCP 工具直接操作 ComfyTV 画布。

## 架构

```
┌─────────────────────────────────────────────┐
│  ComfyTV WebUI (BotPanel.vue / botStore.ts) │
│  ← WebSocket 事件推送 (turn_delta, etc.)     │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│  api/bot.py                                  │
│  /comfytv/bot/status  → list_providers()     │
│  /comfytv/bot/chats   → 聊天管理             │
│  /comfytv/bot/chats/{id}/send → 发送消息     │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│  bot/providers.py                            │
│  AgentProvider 抽象基类 + Provider 注册表     │
├──────────────────┬──────────────────────────┤
│  claude_code.py  │  qwen_code.py            │
│  ClaudeCodeProvider │ QwenCodeProvider       │
│  `claude` CLI     │  `qwen` CLI              │
└──────────────────┴──────────────────────────┘
                   │
          MCP (comfytv tools)
                   │
┌──────────────────▼──────────────────────────┐
│  ComfyTV MCP Server                          │
│  http://127.0.0.1:8188/comfytv/mcp          │
│  39 个工具: 画布/项目/工作流/执行/资产...      │
└─────────────────────────────────────────────┘
```

## 涉及文件

| 文件 | 说明 |
|------|------|
| `bot/qwen_code.py` | **新增** — QwenCodeProvider 实现（~376 行） |
| `bot/__init__.py` | **修改** — 导入并注册 QwenCodeProvider（+2 行） |
| `bot/providers.py` | 无需修改 — 通用 Provider 基类和注册机制 |
| `bot/claude_code.py` | 无需修改 — 参考实现 |
| `api/bot.py` | 无需修改 — 通过 `list_providers()` 自动发现 |
| 前端 (`BotPanel.vue` 等) | 无需修改 — 已支持多 Provider |

## 安装前提

### 1. 安装 Qwen Code CLI

**macOS / Linux:**
```bash
bash -c "$(curl -fsSL https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.sh)" -s --source bailian
```

**Windows (管理员 cmd):**
```cmd
curl -fsSL -o %TEMP%\install-qwen.bat https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen.bat && %TEMP%\install-qwen.bat --source bailian
```

**验证安装:**
```bash
qwen --version
```

### 2. 认证配置

启动 `qwen` 后输入 `/auth` 进行可视化配置。支持以下认证方式：

| 方式 | 环境变量 | Base URL |
|------|----------|----------|
| Token Plan 个人版 | `BAILIAN_TOKEN_PLAN_API_KEY` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| Token Plan 团队版 | `BAILIAN_TOKEN_PLAN_API_KEY` | 同上 |
| Coding Plan | `BAILIAN_CODING_PLAN_API_KEY` | `https://coding.dashscope.aliyuncs.com/v1` |
| 按量计费 (Standard API Key) | `BAILIAN_API_KEY` | `https://{WorkspaceId}.<region>.maas.aliyuncs.com/compatible-mode/v1` |

配置文件路径：`~/.qwen/settings.json`

### 3. 启用 ComfyTV Bot

在 ComfyTV 侧边栏 → Settings 中开启：
- **Enable MCP** — 启用 MCP 服务端
- **Enable Bot** — 启用智能体功能（依赖 MCP）

两个开关都需要打开，Bot 才能工作。

## QwenCodeProvider 实现详解

### 类定义

```python
class QwenCodeProvider(AgentProvider):
    id = "qwen-code"
    label = "Qwen Code"
```

### 核心方法

#### `probe() → ProviderStatus`

检测 `qwen` 是否可用：

1. 调用 `resolve_qwen_command()` 查找可执行文件
2. 执行 `qwen --version` 获取版本号
3. 检查 `~/.qwen/` 目录判断登录状态

结果缓存 60 秒（`_PROBE_CACHE_S`）。

#### `send(turn, emit, handle) → TurnResult`

执行一轮对话：

1. 构建命令行参数（`_build_argv`）
2. 确保 MCP 服务器已配置（`_ensure_mcp_configured`）
3. 以子进程方式启动 `qwen -p "<用户消息>" --output-format stream-json`
4. 逐行解析 stdout 的 JSON 流
5. 通过 `emit()` 回调向前端推送事件（文本 delta、工具调用、工具结果）
6. 返回 `TurnResult`（包含 `session_id` 作为 `resume_token` 用于会话恢复）

#### `stop(handle)`

停止正在运行的子进程：
- Linux/macOS: `kill -SIGKILL` 进程组
- Windows: `taskkill /F /T /PID`

### 可执行文件查找 (`resolve_qwen_command`)

按优先级查找：

1. `shutil.which("qwen")` — 系统 PATH
2. `~/.nvm/versions/node/v*/bin/qwen` — nvm 安装路径（倒序取最新版）
3. `/usr/local/bin/qwen`、`~/.npm-global/bin/qwen` — npm 全局安装路径

> **注意**：当 ComfyUI 通过 systemd 启动时，PATH 可能不包含 nvm 路径。
> fallback 机制确保即使 PATH 中没有 nvm，也能通过直接搜索 `~/.nvm` 目录找到 `qwen`。

### 流解析 (`_StreamParser`)

Qwen Code 的 `stream-json` 输出格式：

```
{"type":"system","subtype":"init","session_id":"..."}     ← 会话初始化
{"type":"assistant","message":{"content":[                 ← 完整消息
  {"type":"text","text":"..."},                            ← 文本块 → delta 事件
  {"type":"tool_use","name":"...","input":{...}}           ← 工具调用 → tool_use 事件
]}}
{"type":"user","message":{"content":[                      ← 工具执行结果
  {"type":"tool_result","tool_use_id":"...","content":"..."} ← → tool_result 事件
]}}
{"type":"result","subtype":"success","session_id":"..."}   ← 轮次结束
```

解析器将上述格式转换为 `BotEvent`：

| JSON 类型 | 内容块类型 | → BotEvent |
|-----------|-----------|------------|
| `assistant` | `text` | `t="delta"`, `text=...` |
| `assistant` | `tool_use` | `t="tool_use"`, `name=...`, `input=...` |
| `user` | `tool_result` | `t="tool_result"`, `name=...`, `text=...` |

> **与 Claude Code 的区别**：Claude Code 使用 `content_block_delta` 流式推送文本，
> Qwen Code 使用完整的 `assistant` 消息发送文本。两者都在 `_parse_assistant` 中处理。

### MCP 自动配置 (`_ensure_mcp_configured`)

每次发送消息前自动检查并配置 MCP：

```bash
qwen mcp list                    # 检查 comfytv 是否已配置
qwen mcp add comfytv <url>       # 如未配置则自动添加
```

使用 `resolve_qwen_command()` 返回的完整路径执行，避免 PATH 问题。

## 与 Claude Code Provider 的对比

| 特性 | ClaudeCodeProvider | QwenCodeProvider |
|------|-------------------|-----------------|
| CLI 命令 | `claude` | `qwen` |
| Provider ID | `claude-code` | `qwen-code` |
| 可执行文件查找 | PATH only | PATH + nvm fallback + npm global fallback |
| 流式文本 | `content_block_delta` 事件 | 完整 `assistant` 消息中的 `text` 块 |
| MCP 配置 | `--mcp-config` 参数 | `qwen mcp add` 命令（预配置） |
| 会话恢复 | `--resume` | `--resume` |
| 工作目录 | `~/comfytv/bot-home` | `~/comfytv/bot-home-qwen` |
| 超时 | 30 分钟 | 30 分钟 |

## 已知问题与解决方案

### 1. systemd 环境下找不到 `qwen`

**现象**：API 返回 `"qwen executable not found"`

**原因**：systemd 服务的 PATH 不包含 nvm 路径

**解决**：`resolve_qwen_command()` 内置了 nvm fallback 搜索。如果仍然失败，
可在 systemd service 中添加 nvm 初始化：

```ini
ExecStart=/bin/bash -c "source /root/.nvm/nvm.sh && cd /MMXTools/ComfyUI && ..."
```

### 2. MCP 配置报 `No such file or directory: 'qwen'`

**原因**：`_ensure_mcp_configured` 使用了硬编码的 `"qwen"` 而非完整路径

**解决**：已修复，使用 `resolve_qwen_command()` 返回的完整路径。

### 3. `--verbose` 参数不存在

**现象**：qwen 输出帮助文本并退出

**原因**：Qwen Code CLI 不支持 `--verbose` 参数

**解决**：已从 `_build_argv` 中移除该参数。

### 4. WebUI 看不到对话回复

**现象**：能看到工具调用，但看不到文字回复

**原因**：`_parse_assistant` 只处理了 `tool_use` 块，跳过了 `text` 块

**解决**：已增加对 `text` 类型块的处理。

## 支持的模型

取决于认证方式，主要包括：

- **通义千问系列**：qwen3.8-max, qwen3.7-max, qwen3.7-plus, qwen3-coder-plus 等
- **第三方模型**：DeepSeek v4-pro, Kimi k2.5/k2.7, GLM-5.2, MiniMax-M2.5 等

可通过 `/model` 命令在对话中切换模型。

## 参考链接

- [Qwen Code 官方文档（阿里云百炼）](https://help.aliyun.com/zh/model-studio/qwen-code)
- [Qwen Code 详细文档](https://qwenlm.github.io/qwen-code-docs/zh/users/overview/)
- [Qwen Code GitHub Releases](https://github.com/QwenLM/qwen-code/releases)
- [ComfyTV Bot 架构](./bot-architecture.md)（如有）

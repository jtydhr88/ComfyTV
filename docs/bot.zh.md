[English](bot.md) | **简体中文**

# ComfyTV Bot

> 内嵌在侧边栏的聊天代理,直接驱动你的画布:说出想要什么,它就搭节点、跑工作流、等渲染、亲眼看结果、继续迭代 — 由你本机已装的 agent CLI 驱动,任何地方都不存 API key。

## 是什么

**ComfyTV Bot** 是侧边栏的聊天面板(✨ 图标),背后是本机的 agent CLI。你发的每条消息都会启动一个 agent 回合,它能使用完整的 [ComfyTV MCP 工具集](mcp.zh.md) — 而且*只有*这套工具:能读写画布、跑渲染、看图、管理资产库,但没有 shell、没有文件系统、没有其他任何工具。

典型用法:

- *"加一个 Z-Image Turbo 的图片节点,提示词写夜里的霓虹猫,16:9,跑起来。"*
- *"用那张图做参考出一段 5 秒图生视频,等它跑完,质检一下首帧。"*
- *"看看我的画布,告诉我视频节点为什么失败了。"*
- *"打开导演台时间线,把第 3 段用更慢的运镜重拍一条。"*
- *"我刚 link 了个新工作流 — 帮我把 seed、宽、高绑上。"*

## 不碰 API key,这是设计

Bot 不直接调用任何模型 API,ComfyTV 也永远不存 key。它驱动的是**你机器上已经装好的 agent CLI** — 目前是 [Claude Code](https://claude.com/claude-code) — 用那个 CLI 自己的登录态(比如你的订阅)。Provider 层是可插拔的,以后可以接入其他本地 agent CLI。

前置条件:

1. 装好 Claude Code 并登录一次(`npm install -g @anthropic-ai/claude-code`,然后运行 `claude` 登录)。
2. 在 ComfyTV **设置 → Agent 与 MCP** 里,先开 **MCP 服务**,再开 **ComfyTV Bot**(Bot 依赖 MCP — 那是 agent 触达画布的通道)。

检测不到 agent CLI 时,面板会显示安装引导而不是聊天框。

## 面板用法

- **对话持久化**:列表支持置顶、改名、删除;每个对话跨回合保持完整上下文(CLI 恢复同一会话)。
- **流式**:回复实时流出;工具调用显示为可折叠条目(如 `add_stage`、`wait_stage`),你能实时看它操作画布 — 节点在画布上边长边跑。
- **停止**按钮中断当前回合,已有的部分输出保留。
- 切走侧边栏(或收起面板)不会打断进行中的回合 — 回合在服务器侧继续,回来时记录自动补齐。

## 简述原理

每个回合都以 headless 模式启动一个全新 CLI 进程,锁死在 ComfyTV 的 MCP 服务上(`--strict-mcp-config`,工具白名单 `mcp__comfytv__*`),并恢复该对话的会话保证连续性。对话状态由 CLI 持有;ComfyTV 数据库只存一份用于显示的记录镜像。画布写操作仍遵循 MCP 规则 — 由打开着的 ComfyTV tab 执行,所以 Bot 干活时保持 tab 开着。

## 排障

| 现象 | 原因 / 处理 |
|---|---|
| 侧边栏没有 ✨ 图标 | **启用 ComfyTV Bot** 没开(设置 → Agent 与 MCP),它又依赖**启用 MCP 服务** |
| 面板显示安装引导 | 没检测到 agent CLI — 装 Claude Code 并登录,然后点*重新检测* |
| Bot 说够不到画布 | 没有打开的 ComfyTV tab(或服务器重启后 tab 的 websocket 断了 — 硬刷新) |
| 长渲染时 Bot 好像没动 | 它在 `wait_stage` 里阻塞等待 — 工具条目能看到;正常且省钱 |

## 另见

- [Agent 接入(MCP)](mcp.zh.md) — Bot 用的工具集,以及如何接入外部 agent
- [侧边栏](sidebar.zh.md) — 带两个开关的设置面板

[English](bot.md) | **简体中文**

# ComfyTV Bot

> 内嵌在侧边栏的聊天代理,直接驱动你的画布:说出想要什么,它就搭节点、跑工作流、等渲染、亲眼看结果、继续迭代 — 由你本机已装的 agent CLI 驱动,任何地方都不存 API key。

## 是什么

**ComfyTV Bot** 是侧边栏的聊天面板(✨ 图标),背后是本机的 agent CLI。你发的每条消息都会启动一个 agent 回合,它能使用完整的 [ComfyTV MCP 工具集](mcp.zh.md) — 而且*只有*这套工具:能读写画布、跑渲染、看图、管理资产库,但没有 shell、没有文件系统、没有其他任何工具。

典型用法:

- *"加一个 Z-Image Turbo 的图片节点,提示词写夜里的霓虹猫,16:9,跑起来。"*
- *"用那张图做参考出一段 5 秒图生视频,等它跑完,质检一下首帧。"*
- *"这是我的歌和卡点歌词——按段落切开,逐段做一支音频驱动的 MV。"*
- *"看看我的画布,告诉我视频节点为什么失败了。"*
- *"打开导演台时间线,把第 3 段用更慢的运镜重拍一条。"*
- *"我刚 link 了个新工作流 — 帮我把 seed、宽、高绑上。"*

## 不碰 API key,这是设计

Bot 不直接调用任何云端模型 API,ComfyTV 也永远不存 key。它驱动的是**你机器上已经装好的 agent CLI**(用 CLI 自己的登录态),或者通过 Local LLM provider 驱动**你自己硬件上跑的模型服务**。当前内置四个:

| Provider | 安装 | 登录 | 附件 |
| --- | --- | --- | --- |
| [Claude Code](https://claude.com/claude-code) | `npm install -g @anthropic-ai/claude-code` | 运行 `claude` 登录一次 | 图片/视频/音频 |
| [Codex](https://developers.openai.com/codex) | `npm install -g @openai/codex` | `codex login` | 图片/视频/音频 |
| [Qwen Code](https://qwenlm.github.io/qwen-code-docs/zh/) | 官方安装脚本(见其文档) | 运行 `qwen` 后 `/auth` | 暂不支持 |
| Local LLM | 任意 OpenAI 兼容的本地模型服务 | 无 — 在设置里填端点 URL 即可 | 暂不支持 |

前置条件:

1. 至少装好一个 agent CLI 并登录 — 或者跑一个本地模型服务并在设置里填上它的 URL。
2. 在 ComfyTV **设置 → Agent 与 MCP** 里,先开 **MCP 服务**,再开 **ComfyTV Bot**(Bot 依赖 MCP — 那是 agent 触达画布的通道)。

有多个 provider 可用时,➕ 按钮会让你选新对话用哪个引擎;每个对话记住自己的 provider。一个都检测不到时,面板显示安装引导而不是聊天框。

隔离策略按引擎各自落实:Claude Code 走每轮独立的严格 MCP 配置+工具白名单;Codex 的 `codex exec` 沙箱限定在 bot 工作目录,shell 和联网搜索关闭,该回合只保留 ComfyTV 一个 MCP 服务,审批请求交给 Codex 自带的自动审察(headless 无法弹批准框);Qwen Code 走 bot 工作目录内的项目级 `.qwen/settings.json`(只挂 ComfyTV MCP,内置 shell/文件工具全部排除)— 你的全局 CLI 配置永远不被碰。

## Local LLM provider

Local LLM 完全不需要 agent CLI:ComfyTV 自己跑 agent 循环,对接任何 OpenAI 兼容端点 — LM Studio、llama.cpp 的 `llama-server`、vLLM、Ollama 都行。把 **设置 → Agent 与 MCP → Local LLM 端点** 指向服务的 base URL(如 `http://127.0.0.1:1234/v1`),模型建议直接来自端点的 `/models` 真实列表。仅限免 key 的本地端点 — 与"不存 key"的铁律一致(局域网服务非要 token 的话,认 `COMFYTV_LOCAL_LLM_API_KEY` 环境变量,但永远不落库)。

几个值得知道的细节:

- 对话历史由 ComfyTV 自己的记录重放(端点不持有会话),重启服务器也不丢上下文。
- 只暴露核心画布工具集(搭建/运行/等待/看图),不给全量目录 — 小模型会被塞爆。
- `wait_stage` 由 provider 侧循环续片,渲染真正结束才回到模型。
- 如果装了 [LM Studio](https://lmstudio.ai) 的 `lms` CLI,渲染期间会自动把驱动模型从显存卸掉、渲完再装回 — 单卡机器上出图时画布独占整张卡。

## 面板用法

- **对话持久化**:列表支持置顶、改名、删除;每个对话跨回合保持完整上下文(CLI 恢复同一会话)。
- **流式**:回复实时流出;工具活动折叠进一个抽屉(默认收起),逐调用显示条目(如 `add_stage`、`wait_stage`),你能实时看它操作画布 — 节点在画布上边长边跑。
- **附件**:支持附件的 provider 可以通过 📎 按钮、拖文件、从资产库挑选或直接粘贴,发送图片/视频/音频。视频会附中间帧、音频会附波形图,agent 是真的"看得见"你发了什么。
- **技能**:输入框打 **`/`** 唤出技能面板 — 选一个已安装的 [Agent Skill](skills.zh.md),它会变成消息上的一枚 chip;agent 先读该技能,再按其指令执行任务。
- **停止**按钮中断当前回合,已有的部分输出保留。
- 切走侧边栏(或收起面板)不会打断进行中的回合 — 回合在服务器侧继续,回来时记录自动补齐。

## 简述原理

每个回合都以 headless 模式启动一个全新 CLI 进程,锁死在 ComfyTV 的 MCP 服务上(`--strict-mcp-config`,工具白名单 `mcp__comfytv__*`),并恢复该对话的会话保证连续性。对话状态由 CLI 持有;ComfyTV 数据库只存一份用于显示的记录镜像。画布写操作仍遵循 MCP 规则——由打开着的 ComfyTV 页面执行，Comfy Desktop 与浏览器都可以。

## 排障

| 现象 | 原因 / 处理 |
|---|---|
| 侧边栏没有 ✨ 图标 | **启用 ComfyTV Bot** 没开(设置 → Agent 与 MCP),它又依赖**启用 MCP 服务** |
| 面板显示安装引导 | 没检测到 agent CLI — 按上表装一个并登录,然后点*重新检测* |
| Bot 说够不到画布 | 没有打开的 ComfyTV 页面（Comfy Desktop 或浏览器）；或服务器重启后 websocket 断了——刷新该页面 |
| 长渲染时 Bot 好像没动 | 它在 `wait_stage` 里阻塞等待 — 工具条目能看到;正常且省钱 |

## 另见

- [Agent 接入(MCP)](mcp.zh.md) — Bot 用的工具集,以及如何接入外部 agent
- [Agent Skills](skills.zh.md) — Bot(和外部 agent)可调用的指令包
- [侧边栏](sidebar.zh.md) — 带两个开关的设置面板

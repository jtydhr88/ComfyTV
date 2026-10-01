[English](bot.md) | **简体中文**

# ComfyTV Bot

> 停靠在画布右侧的聊天代理,直接驱动你的画布:说出想要什么,它就搭节点、跑工作流、等渲染、亲眼看结果、继续迭代 — 由你本机已装的 agent CLI 驱动,任何地方都不存 API key。

## 是什么

**ComfyTV Bot** 是停靠在画布右侧的面板 — 点工作流标签栏右上角的 agent 按钮打开。面板本身就是 ComfyUI 前端为其云端 agent 自带的那一套,ComfyTV 把它原样收录进来(见 `src/agent/native/UPSTREAM`),接到自己的本地 agent 后端上,背后是本机的 agent CLI。你发的每条消息都会启动一个 agent 回合,它能使用完整的 [ComfyTV MCP 工具集](mcp.zh.md) — 而且*只有*这套工具:能读写画布、跑渲染、看图、管理资产库,但没有 shell、没有文件系统、没有其他任何工具。

典型用法:

- *"加一个 Z-Image Turbo 的图片节点,提示词写夜里的霓虹猫,16:9,跑起来。"*
- *"用那张图做参考出一段 5 秒图生视频,等它跑完,质检一下首帧。"*
- *"这是我的歌和卡点歌词——按段落切开,逐段做一支音频驱动的 MV。"*
- *"看看我的画布,告诉我视频节点为什么失败了。"*
- *"打开导演台时间线,把第 3 段用更慢的运镜重拍一条。"*
- *"我刚 link 了个新工作流 — 帮我把 seed、宽、高绑上。"*

## 不碰 API key,这是设计

Bot 不直接调用任何云端模型 API,ComfyTV 也永远不存 key。它驱动的是**你机器上已经装好的 agent CLI**(用 CLI 自己的登录态),或者通过 Local LLM / ComfyUI LLM provider 驱动**你自己硬件上跑的模型**。当前内置六个:

| Provider | 安装 | 登录 | 附件 |
| --- | --- | --- | --- |
| [Claude Code](https://claude.com/claude-code) | `npm install -g @anthropic-ai/claude-code` | 运行 `claude` 登录一次 | 图片/视频/音频 |
| [Codex](https://developers.openai.com/codex) | `npm install -g @openai/codex` | `codex login` | 图片/视频/音频 |
| [Qwen Code](https://qwenlm.github.io/qwen-code-docs/zh/) | 官方安装脚本(见其文档) | 运行 `qwen` 后 `/auth` | 暂不支持 |
| DeepSeek Harness | `dsh`(DeepSeek Harness 命令行) | 在 DeepSeek Harness 应用内登录 | 图片(需视觉模型) |
| Local LLM | 任意 OpenAI 兼容的本地模型服务 | 无 — 在设置里填端点 URL 即可 | 暂不支持 |
| ComfyUI LLM | 往 `models/text_encoders` 放一个 Qwen3 或 Gemma 系权重 | 无 | 暂不支持 |

前置条件:

1. 至少装好一个 agent CLI 并登录 — 或者跑一个本地模型服务并在设置里填上它的 URL。
2. 在 ComfyTV **设置 → Agent 与 MCP** 里,先开 **MCP 服务**,再开 **ComfyTV Bot**(Bot 依赖 MCP — 那是 agent 触达画布的通道)。

聊天上方的工具条选择新对话用哪个引擎(以及每个引擎用哪个模型);对话固定用它开始时的引擎,切换引擎就会开一个新对话。引擎 chip 上的红点表示没装或没登录 — 悬停可看原因。

隔离策略按引擎各自落实:Claude Code 走每轮独立的严格 MCP 配置+工具白名单;Codex 的 `codex exec` 沙箱限定在 bot 工作目录,shell 和联网搜索关闭,该回合只保留 ComfyTV 一个 MCP 服务,审批请求交给 Codex 自带的自动审察(headless 无法弹批准框);Qwen Code 走 bot 工作目录内的项目级 `.qwen/settings.json`(只挂 ComfyTV MCP,内置 shell/文件工具全部排除);DeepSeek Harness 以 ACP 模式运行 `dsh`,使用专用 profile,内置工具全部关闭 — 你的全局 CLI 配置和应用自身设置永远不被改动。

## Local LLM provider

Local LLM 完全不需要 agent CLI:ComfyTV 自己跑 agent 循环,对接任何 OpenAI 兼容端点 — LM Studio、llama.cpp 的 `llama-server`、vLLM、Ollama 都行。把 **设置 → Agent 与 MCP → Local LLM 端点** 指向服务的 base URL(如 `http://127.0.0.1:1234/v1`),模型建议直接来自端点的 `/models` 真实列表。仅限免 key 的本地端点 — 与"不存 key"的铁律一致(局域网服务非要 token 的话,认 `COMFYTV_LOCAL_LLM_API_KEY` 环境变量,但永远不落库)。

几个值得知道的细节:

- 对话历史由 ComfyTV 自己的记录重放(端点不持有会话),重启服务器也不丢上下文。
- 只暴露核心画布工具集(搭建/运行/等待/看图),不给全量目录 — 小模型会被塞爆。
- `wait_stage` 由 provider 侧循环续片,渲染真正结束才回到模型。
- 如果装了 [LM Studio](https://lmstudio.ai) 的 `lms` CLI,渲染期间会自动把驱动模型从显存卸掉、渲完再装回 — 单卡机器上出图时画布独占整张卡。

## ComfyUI LLM provider

ComfyUI LLM 更进一步:连外部服务也不需要 — 推理直接跑在 **ComfyUI 本体内**,用的就是核心 `TextGenerate` 节点那套文本编码器推理栈。往 `models/text_encoders` 放一个可生成的 Qwen3 或 Gemma 系权重(如 Qwen3 8B,或 LTX2 已在用的 Gemma 3/4 编码器),provider 即可用;在**设置 → Agent 与 MCP → ComfyUI LLM 模型**里选权重(留空 = 自动取第一个)。Qwen3 有原生工具调用训练、最适合当驱动;Gemma 靠指令跟随同一约定。

对比 Local LLM:

- 零安装零配置 — 不需要端点 URL,不需要额外服务进程。
- 显存由 ComfyUI 的模型管理统一仲裁:渲染期间 LLM 自动 offload,下一轮对话自动装回 — 不再需要 `lms` 那种手工腾挪。
- 工具调用走 Qwen3 训练所用的 Hermes 约定(`<tool_call>` 块),由 ComfyTV 负责渲染与解析。
- 回合经由 `/comfytv/llm/v1` 的 OpenAI 兼容 shim 逐个处理(不支持流式)— bot 开启期间,本机其他应用也可以指向这个端点复用同一模型。

## DeepSeek Harness provider

每轮以 ACP 模式启动一次 `dsh`(DeepSeek Harness 命令行),复用它自己的登录,ComfyTV 不读也不存任何凭据。

准备:

1. 安装 DeepSeek Harness 桌面应用并登录 DeepSeek 账号。
2. 把 `dsh` 放到 PATH 上:在应用菜单里点 **Manage dsh Command…**,或运行 `npm install -g @deepseek-ai/dsh`。

- **模型与计费**:模型菜单里每一项都标明走 **桌面账号** 还是 **API Key**。留空用桌面账号下的第一个模型,不会自动改用 API Key。模型列表在第一次对话后出现。
- **工具**:关闭 Harness 的全部内置工具(shell、文件、联网、子代理等),只能调用 ComfyTV MCP 工具。
- **会话**:每个对话对应一个 Harness 会话,ComfyTV 重启后仍可继续。ACP 不支持 fork,所以不能分支对话。删除 ComfyTV 对话不会删除 Harness 侧的会话。
- **附件**:只发送图片,且仅当所选模型支持图片输入;目前 DeepSeek 模型都不支持,会在发送前报错。
- **文件位置**:工作目录在 ComfyUI 用户目录 `comfytv/bot-home-deepseek-harness/chats/<chat id>`;首次使用时在 `~/.dsh/profiles/comfytv-acp` 创建专用 profile。

## 面板用法

- **画布**:Bot 永远操作当前屏幕上的标签页,切换标签页它就跟着切。
- **对话持久化**:历史页(时钟图标)列出、改名、移除对话;每个对话跨回合保持完整上下文(CLI 恢复同一会话)。
- **流式**:回复实时流出;工具活动按回合显示为活动轨迹(如 `add_stage`、`wait_stage`),回合结束后折叠成摘要 — 节点在画布上边长边跑。
- **提及**:输入 **`@`** 引用画布上的节点(stage),或用选择器框选节点附到消息上。
- **附件**:支持附件的 provider 可以通过 **+** 按钮从 ComfyTV 资产库选择、从资产标签页拖资产卡片、或直接拖入/粘贴文件(文件会先导入资产库,agent 才能把它们以 `asset_refs` 交给节点),发送图片/视频/音频。视频会附中间帧、音频会附波形图,agent 是真的"看得见"你发了什么。
- **技能**:消息以 **`/<名字>`** 开头即按该已安装的 [Agent Skill](skills.zh.md) 执行;agent 先读该技能,再按其指令执行任务。
- **运行权限**:发送键旁的弹层在"运行工作流前先问我"和"自动运行"之间切换。
- **停止**按钮中断当前回合,已有的部分输出保留。
- 收起面板不会打断进行中的回合 — 回合在服务器侧继续,重新打开时记录自动补齐。

## 简述原理

CLI provider 每回合启动一个新的 headless 进程并恢复对话会话。DeepSeek Harness 每回合以 ACP 模式启动 `dsh` 并恢复会话。ComfyTV 数据库保存一份用于显示的记录镜像。画布写操作仍遵循 MCP 规则——由打开着的 ComfyTV 页面执行，Comfy Desktop 与浏览器都可以。

## 排障

| 现象 | 原因 / 处理 |
|---|---|
| 右上角没有 agent 按钮 | **启用 ComfyTV Bot** 没开(设置 → Agent 与 MCP),它又依赖**启用 MCP 服务**;另外需要自带 agent 面板插槽的 ComfyUI 前端(1.53 及以上) |
| 引擎 chip 上有红点 | 该 agent CLI 没装或没登录 — 按上表装一个并登录,然后重新打开面板 |
| Bot 说够不到画布 | 没有打开的 ComfyTV 页面（Comfy Desktop 或浏览器）；或服务器重启后 websocket 断了——刷新该页面 |
| 长渲染时 Bot 好像没动 | 它在 `wait_stage` 里阻塞等待 — 工具条目能看到;正常且省钱 |

## 另见

- [Agent 接入(MCP)](mcp.zh.md) — Bot 用的工具集,以及如何接入外部 agent
- [Agent Skills](skills.zh.md) — Bot(和外部 agent)可调用的指令包
- [侧边栏](sidebar.zh.md) — 带两个开关的设置面板

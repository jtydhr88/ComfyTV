[English](skills.md) | **简体中文**

# Agent Skills(技能)

> 技能是可复用的指令包——一个带 `SKILL.md` 的文件夹——教会任何在你 ComfyTV 上干活的 agent 把某类事做好:一套提示词方法论、一条生产管线、一种团队风格。装一次,[Bot](bot.zh.md) 和所有接入 [MCP](mcp.zh.md) 的 agent 都能发现并遵循它。

## 技能是什么

ComfyTV 采用开放的 **Agent Skills** 格式(与 Claude Code 等 agent 产品同一套 `SKILL.md` 约定)。一个技能就是一个文件夹:

```
my-skill/
├── SKILL.md              # 必需:frontmatter + 指令正文
├── references/           # 可选:深层资料,按需加载
│   └── checklist.md
└── agents/openai.yaml    # 可选:展示元数据
```

`SKILL.md` 以 YAML frontmatter 开头,后接普通 Markdown 指令:

```markdown
---
name: my-skill
description: 一段话说清这个技能做什么、agent 什么时候该用它。
---

# My Skill

agent 要遵循的分步指令……
深层资料:见 [references/checklist.md](references/checklist.md)。
```

两个字段最关键:

- **`name`** —— 小写字母、数字、连字符(如 `h3-cinematic-director`)。它是技能在所有地方的身份:`/` 面板、MCP prompt、`skills/` 下的文件夹名。
- **`description`** —— "什么时候用"的那段话。在 agent 判定任务命中之前,它只能看到这一段,所以要写具体:技能产出什么、期望什么输入、哪些说法应该触发它。

这套格式是**渐进披露**的:agent 先只看到 name + description,任务命中才读 `SKILL.md` 全文,指令里指到 `references/` 才继续读深层文件。再长的方法论也不烧上下文。

## 技能放在哪

| 位置 | 内容 |
|---|---|
| `ComfyTV/skills/` | 随 ComfyTV 分发的**内置**技能 |
| `<ComfyUI user 目录>/comfytv/skills/` | **你自己的**技能——导入落在这里 |

用户技能与内置技能同 `name` 时,**用户版覆盖内置版**。

ComfyTV 目前内置一个技能:**`h3-cinematic-director`** —— MiniMax H3 视频生产的导演级方法论:分镜设计、H3 提示词精确 schema(T2VA/I2VA/FL2VA/L2VA/Ref2VA)、一致性审片、单点修复。配合自带的 [H3 工作流](generate.zh.md#video-stage)使用。

## 管理技能

打开[侧边栏](sidebar.zh.md)的 **设置 → 技能**:

- **启用 Agent Skills** —— 全局开关(默认开)。关掉后 `skill` 工具和所有技能 prompt 从 MCP 上消失。
- 每个已装技能显示来源(内置/用户)和描述,带**逐技能开关**。
- **导入** —— 上传包含单个技能文件夹的 `.zip`(`SKILL.md` 在 zip 根,或在唯一的顶层文件夹里)。不合规的包会被拒并给出原因。
- **删除** —— 仅限用户技能;内置技能只能禁用。

改动即时生效——技能索引每次请求现扫,不用重启。一个例外:长连的外部 MCP 客户端会按会话缓存工具清单,装了新技能后让它重连(或开个新会话)。

## 使用技能

**在 Bot 里** —— 聊天输入框打 **`/`** 唤出技能面板;继续打字过滤,回车或点击选中。技能变成消息上的一枚 chip,agent 会先读它再动手:

```
/h3-cinematic-director  ⏎
shot-design: 雨夜巷口追逐的开场,三个镜头
```

**在外部 agent 里(Claude Code、Codex……)** —— 零配置。MCP `skill` 工具的 description 内嵌一份实时技能索引,接入的 agent 自己就能发现,任务命中时调 `skill(action='read')`。每个启用的技能还同时作为 **MCP prompt** 提供:在 Claude Code 里表现为 `/mcp__comfytv__<技能名>` 斜杠命令,可显式调用。

## 写自己的技能

1. 在 `<user 目录>/comfytv/skills/` 下建文件夹(或打成 `.zip` 走导入)。
2. 写 `SKILL.md` —— frontmatter 的 `name` + `description`,然后是指令正文。写给 agent 看而不是给人看:祈使句分步、精确字段名、硬规则、失败情形。
3. 长篇参考资料放 `references/*.md`,在 `SKILL.md` 里链接过去——agent 通过同一个 `skill` 工具按需拉取。
4. 到**设置 → 技能**里检查:你的技能应该在列且已启用。显示 invalid 时,行内会写明原因(缺 description、name 不合规、frontmatter 坏了)。

几个上限:description 最长 1024 字符;单个 reference 文件 512 KB;导入 zip 16 MB(解压后 64 MB)。

**信任提示**:技能就是你的 agent 会照做的指令。只装来源可信的技能——对待技能 zip,要像对待一段你即将执行的脚本。

## 另见

- [ComfyTV Bot](bot.zh.md) —— `/` 面板就在它的聊天输入框里
- [Agent 接入(MCP)](mcp.zh.md) —— `skill` 工具与 prompt 映射
- [侧边栏](sidebar.zh.md) —— 管理技能的设置面板

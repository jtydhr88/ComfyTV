# 项目 (Project)

> 给当前 ComfyTV 画布命名并绑定项目上下文，让所有生成结果归入同一项目并在重载工作流时自动恢复。

## 这个节点是做什么的

**Project** 是 ComfyTV 工作流的「根节点」。它本身不生成任何内容，也没有 **▶ 运行** 按钮；它的作用是告诉 ComfyUI：「我现在在哪个项目里工作」。

你在画布上运行的每一个 Image、Video、Audio 等 stage，都会把输出快照保存到**当前项目**的资产库里。下次打开同一份工作流，Project 节点会恢复项目 id 和名称，下游 stage 可以继续读取之前的快照。

如果你从未用过 ComfyUI 工作流，可以把 Project 理解成「文件夹标签」——所有 stage 共享这一个标签，方便管理和切换不同创作任务。

## 适用场景

- 新建一条 ComfyTV 流水线时，在画布**最开头**放一个 Project 节点。
- 需要在多个创作任务之间切换（例如「广告 A」和「短片 B」），通过改项目名或 UI 项目选择器切换。
- 希望生成结果按项目归档，而不是散落在 ComfyUI 默认 output 目录里找不到。
- 协作或备份时，需要明确「这份 workflow 属于哪个项目」。

## 工作原理（为什么 ComfyTV 这样设计）

ComfyTV 的 stage 设计核心是**逐步运行 + 快照传递**：

- 带 **▶ 运行** 的 stage 只执行自己，不会触发 ComfyUI 全局 Queue 整张图。
- 每次 Run 后，结果写入项目快照；下游 stage 再 Run 时直接读快照，**不会自动重跑上游**。
- Project 节点提供 `项目 id（project_id）`，让所有 stage 写入同一个项目存储空间。

Project 节点不参与上述执行链，但为整条链提供「写入到哪里」的上下文。没有 Project 时，部分 stage 仍可能运行，但项目归档和资产库体验会不完整——官方推荐每个画布都放一个。

## 界面与参数说明

### project_name（项目名称）

画布上可见的显示名称，例如 `我的短片_v1`。你可以随时修改；修改后新运行的 stage 输出会归入新项目名对应的项目（具体 id 由 UI 管理）。

**常见误区**：以为改项目名会移动旧资产——已保存的快照仍绑定原来的 `项目 id（project_id）`，切换项目应通过 UI 项目选择器而不是只改字符串。

### 项目 id（project_id）（项目 ID）

内部标识符，绑定到 ComfyTV 前端的 `projectStore.currentProjectId`，随工作流 JSON **一起保存**。一般不需要手改；手改可能导致资产对不上。

### schema_version（Schema 版本）

隐藏字段，标记当前 ComfyTV 工作流 schema 版本。加载旧 workflow 且版本与插件当前版本不一致时，前端会弹出升级提示。

## 输出说明

本节点**没有输出口**。它只设定上下文，不向下游传递数据。

## 新手一步一步

1. 打开 ComfyUI，双击画布 → **Add Node** → **ComfyTV** → **Project** → **Project**，拖入画布。
2. 在节点的 **project_name** 里输入一个好记的名字，例如 `测试_文生图`。
3. 在它右侧添加 **Generate → Image Stage**（或其它 stage），连好线。
4. 运行 Image Stage 后，打开 ComfyTV **Assets** 侧栏，确认结果出现在当前项目下。
5. **File → Save** 保存工作流；下次 Load 时 Project 名称和项目 id 会自动恢复。
6. 要做第二个独立任务：改 **project_name** 或通过 UI 切换到新项目，避免和旧任务混在一起。

## 完整教程（推荐阅读）

> 本页只说明**这一个节点**的参数与用法。端到端流程与多节点串联，请见 GitHub 上的 [ComfyTV 用户指南](https://github.com/jtydhr88/ComfyTV/tree/main/docs)：

| 教程 | 内容 |
| --- | --- |
| [入门指南](https://github.com/jtydhr88/ComfyTV/blob/main/docs/getting-started.zh.md) | 安装、画布基础、逐节点 Run、快照、Project、Image Picker |

## 仓库与工作流

| 资源 | 链接 |
| --- | --- |
| **GitHub 仓库** | https://github.com/jtydhr88/ComfyTV |
| **用户指南目录** | https://github.com/jtydhr88/ComfyTV/tree/main/docs |
| **内置工作流总览** | https://github.com/jtydhr88/ComfyTV/tree/main/workflows |
| **模型清单** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/models.zh.md |
| **自定义工作流** | https://github.com/jtydhr88/ComfyTV/blob/main/docs/custom-workflows.zh.md |
## 常见问题

**Q：Project 节点必须放吗？**  
A：强烈推荐。没有它，项目归档、资产库筛选、工作流恢复体验都会打折扣。

**Q：一个画布可以有两个 Project 吗？**  
A：技术上可以拖两个，但所有 stage 只会绑定其中一个上下文，容易混乱。一个画布一个 Project 即可。

**Q：保存 workflow 后项目里的图片会丢吗？**  
A：不会。快照存在 ComfyTV 项目存储里；重载 workflow 后，只要 `项目 id（project_id）` 一致，资产仍在。换机器或重装需自行备份 ComfyUI 数据目录。

## 相关节点

- **Image Stage / Video Stage / Audio Stage** 等 Generate 节点——依赖 Project 提供的项目上下文。
- **Load Image from Asset** 等 Asset Loader——从当前项目资产库挑选已有结果。
- **Image Picker**——在多张生成图里选定一张继续编辑。

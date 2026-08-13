# 任务：建立强制 language key 国际化规范

- 状态：completed
- 日期：2026-07-14
- 对话：00-历史开发归档-截至2026-07-13（项目统一规范追加）
- 分支：`chore/i18n-language-key-policy`
- 基线：`02cf401cf8f59daf49ee79a7cebd7ca6821af075`
- 负责人：Codex（本地执行）

## 用户问题

对整个预见 PreVision 项目及四个专用对话建立永久统一要求：从现在开始，中文用户界面文案不得直接写入应用代码，必须通过 language key 和语言资源实现国际化。

## 目标

- 将规则写入所有新任务必读的 `AGENTS.md` 和正式开发文档。
- 提供渲染进程与 Electron 主进程均可使用的 language key 基础设施。
- 新增中英文语言资源并要求 key 集合一致。
- 建立自动检查，阻止基线之后在运行时代码中新增直接中文。
- 迁移一小组低风险入口文案，证明 HTML、动态取词和 Electron 菜单路径可用。
- 将同一规则同步到 Bug、新功能、UI 和工程发布四个专用对话。

## 非目标

- 不在本任务一次性迁移现有数百条历史中文文案。
- 不改变镜头、时间轴、角色、保存格式或项目数据版本。
- 不增加第三方国际化依赖。

## 证据与现状

- 代码：主 HTML 与 Electron 主进程存在大量历史内联中文，没有统一语言层。
- Git：基础建设分支干净，当前从 `02cf401` 创建独立 chore 分支。
- 测试/运行：已有 core、app、desktop、foundation 和影响测试。
- 文档/历史线索：用户明确要求本规范覆盖当前项目、四个专用对话及以后所有开发。

## 影响范围

- 模块：国际化、入口 UI、Electron 菜单/文件对话框、仓库基础测试。
- 文件：`AGENTS.md`、`i18n/`、主 HTML、Electron 主进程、测试、QA 与流程文档。
- 数据格式：无。
- 平台：macOS Electron 与本地浏览器模式。

## 风险

- 数据：无项目数据迁移。
- UI/交互：语言资源未及时加载可能造成入口文案短暂为空或显示 key。
- 安全：不引入远程资源或动态执行外部语言包。
- 发布：新增本地资源必须随 Electron 包一起分发。

## 验收条件

- [x] 新任务入口明确禁止在运行时代码中新增直接中文。
- [x] `zh-CN` 与 `en-US` 语言包 key 完全一致。
- [x] `t(key)`、变量插值和 `data-i18n*` 能工作。
- [x] 自动测试能拒绝基线之后新增的直接中文运行时代码。
- [x] 现有完整应用与 Electron 回归通过。
- [x] 四个专用对话收到统一规范；正在执行任务的对话也已收到暂停旧写法的指令。
- [x] 文档、决策记录和验收单更新完成。

## 测试计划

- 影响映射模块：main-app、electron、foundation、i18n。
- 主应用模块参数：无，跨渲染进程与 Electron。
- 最小命令：`npm run test:i18n`、`npm run test:desktop`、`npm run test:foundation`。
- 升级到全量的条件：主 HTML、Electron 或测试夹具变化，最终运行 `npm run test:full`。
- 人工检查尺寸/步骤：启动应用，确认标题、项目入口按钮和 macOS 菜单仍显示中文且无 language key 裸露。

## 实施记录

- 假设：语言资源文件允许包含对应语言文本；“代码中不写中文”指运行时 HTML/JS/Electron 逻辑，不包含文档、测试说明和 `i18n/locales/`。
- 关键决定：历史内联中文以 `02cf401` 为遗留基线；今后新增或触碰用户可见文案必须迁移为 key。
- 实际修改：新增浏览器与 Node 两套轻量取词运行时、`zh-CN`/`en-US` 对齐语言包、国际化策略文件与契约测试；迁移顶栏入口和 Electron 菜单/文件对话框；更新测试映射、CI 全历史 checkout、项目入口、架构、流程、评审、贡献、已知问题、功能登记与 ADR。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run test:i18n` | 20 通过，0 失败 | <1s | key 对齐、插值、DOM、Node、引用与直接中文守卫。 |
| `npm run test:desktop` | 21 通过，0 失败 | <1s | Electron 取词、IPC、安全与语法。 |
| `npm run test:core` | 7 通过，0 失败 | <1s | 语言资源在应用 boot 前加载。 |
| `npm run test:full` | 全部通过 | 约 10s | app 254、desktop 21、foundation 51、i18n 20。 |
| `npm run test:impact -- --base 02cf401...` | 全部通过 | 9.0s | 正确选择 app、desktop、foundation。 |
| `git diff --check` | 通过 | <1s | 无空白错误。 |
| Electron 真机界面检查 | 通过 | — | 顶栏、项目输入、撤销和 macOS 菜单显示中文，无空白或裸露 key。 |

## 未覆盖与后续

- 全量历史文案迁移应按模块分批建立独立任务，不能混入普通功能开发。
- 本任务没有改变打包或运行依赖，未重复生成 `.app`/ZIP/DMG；发布前仍按 `RELEASE_PROCESS.md` 构建。

## 交接

- 最终提交：`chore/i18n-language-key-policy` 分支的本任务提交（见 Git 记录）
- PR：无（未连接 GitHub）
- 工作区状态：提交前检查通过
- 下一步：把本规范提交合入各专用任务的工作基线；历史文案按模块逐步迁移

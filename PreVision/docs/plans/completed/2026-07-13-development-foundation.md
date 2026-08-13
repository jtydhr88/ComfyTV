# 任务：开发流程重构与阶段交接

- 状态：completed
- 日期：2026-07-13
- 对话：预见 PreVision 项目开发流程重构与阶段交接
- 分支：`chore/prevision-development-foundation`
- 基线：`ce523b2f1914e34f863826977492626dcb3bd754`
- 负责人：Codex（本地执行）

## 用户问题

暂停新增业务功能，直接检查并升级项目开发管理方式：安全保存阶段基线，把历史上下文迁入仓库，区分功能状态，建立分层测试和影响映射，并形成一个任务、一个对话、一个分支、一个验收单的本地与 GitHub 工作流。

## 目标与结果

- [x] 原始代码保存为明确且不覆盖旧分支的 checkpoint。
- [x] 新对话可从 `AGENTS.md` 和 `docs/INDEX.md` 恢复当前事实。
- [x] 功能按已验证、已实现未验证、部分完成和计划中登记。
- [x] 建立核心冒烟、应用、Electron、仓库基础和全量测试入口。
- [x] 主单体应用支持按登记模块运行目标断言，不再要求所有已知单模块修改默认检查 252 项。
- [x] 建立机器可读核心流程与 Git 文件影响映射。
- [x] 建立任务、分支、验收、评审、发布和 PR 模板。
- [x] 本地 `main`、checkpoint 和基础建设分支边界清楚。
- [x] 检查 GitHub 状态；无远程时不阻塞本地体系，也不创建公开仓库。

## 非目标

- 不新增或重构业务功能。
- 不改变项目数据格式、生产数据或用户文件。
- 不升级依赖，不调用真实付费 AI 服务。
- 不代替项目所有者选择许可证、Git 身份、GitHub 仓库可见性或 Apple 签名身份。

## 只读审计结论

- 仓库根目录是当前 `预见PreVision` 目录；审计开始时 Git 无提交、`main` 为 unborn，全部有效代码未跟踪。
- 技术栈为原生 HTML/CSS/JavaScript、Three.js r128、Electron 43.1.0、Electron Forge 7.11.2、npm lockfile v3。
- 推荐 Node 22，允许 20–24；系统默认 Node 26.3.0 超出打包范围。
- 没有 remote/origin；GitHub CLI 2.94.0 已安装但未登录；已有 Actions、Issue 表单和 PR 模板。
- 无 merge、rebase、cherry-pick 或冲突状态。
- 公开候选文件没有发现高置信度 Token、密钥、本机绝对路径或凭据文件。
- `node_modules/`、`out/`、`.claude/`、`日志/`、环境文件、密钥类型和日志已经忽略。
- 许可证尚未确定，因此不得自动公开源码。

## Git 基线

- checkpoint 分支：`checkpoint/prevision-before-foundation-2026-07-13`
- checkpoint 提交：`ce523b2f1914e34f863826977492626dcb3bd754`
- `main`：`ce523b2f1914e34f863826977492626dcb3bd754`
- 基础建设实现提交：`a8516fe`
- 主应用模块测试提交：`50886a8`
- 上述本地提交均使用明确的临时身份；没有修改或猜测用户的 Git 姓名、邮箱。

## 实际修改

- 增加代理入口、当前状态、架构、功能登记、已知问题、历史决策、测试、评审、发布和任务流程文档。
- 增加 ADR-0001 和 active/completed 验收单目录。
- 增加 `qa/feature-registry.yaml`、`qa/core-flows.yaml`、`qa/test-impact-map.yaml`；文件使用 JSON 兼容 YAML 1.2，无新增解析依赖。
- 将测试入口拆为 `test:core`、`test:module`、`test:app`、`test:desktop`、`test:foundation`、`test:full` 和 `test:impact`。
- `test:module` 登记 14 个主应用模块；保留真实 boot 和必要状态准备，在目标模块最后一段后提前结束。
- `npm test` 改为快速核心启动检查；GitHub Actions 明确执行 `npm run test:full`。
- 增加仓库基础安全测试和基于 Git 变化的影响测试；`--module` 只替换已知单体 HTML 范围，测试脚本、未知文件和跨模块变化仍自动升级完整回归。
- 更新 README、贡献指南和 PR 模板，要求验收单、影响测试、全量证据、兼容性与剩余风险。

## 验证结果

### 原始 checkpoint

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ls --depth=0` | 通过 | <1s | 四个固定开发依赖完整。 |
| 原始 `npm test` | 272 项通过 | 8.16s | 应用 252 + 桌面壳 20。 |
| `npm run package` | 通过 | 11.71s | 隔离目录、兼容 Node 24、arm64 App。 |
| `npm run make:mac` | 通过 | 18.77s | 约 120MB ZIP。 |
| `npm run make:mac:dmg` | 通过 | 18.28s | 约 120MB DMG；修正审计 PATH 后成功。 |
| `codesign --verify --deep --strict` | 通过 | <1s | ad-hoc 签名，不代表正式签名/公证。 |

### 基础建设分支

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run test:core` | 5 项通过 | <1s | Three.js、应用 boot、默认项目/对象/镜头。 |
| `npm run test:impact -- --base main --dry-run` | 通过 | <1s | 正确选出 app、desktop、foundation。 |
| `npm run test:impact -- --base main` | 317 项通过 | 7.46s | 应用 252 + 桌面 20 + 基础 45。 |
| `npm run test:full` | 317 项通过 | 7.52s | 零失败。 |
| 全部 14 个 `test:module` | 全部通过 | 单次依模块而异 | 代表性计数：camera 41、timeline 23、actor 78、project 14、layout 24。 |
| `test:impact -- --module camera --dry-run` | 通过 | <1s | 测试夹具本身变化时拒绝降级；无效模块以退出码 2 拒绝。 |
| `node --check` 两个新增测试脚本 | 通过 | <1s | 语法检查。 |
| `git diff --check` | 通过 | <1s | 无冲突标记和空白错误。 |
| 仓库基础安全扫描 | 通过 | 包含在 foundation | 不输出可疑值，只报告路径和风险类型。 |

## 未覆盖与后续

- 本次没有 UI 或业务行为改动，因此不重复人工操作全部创作功能；沿用 checkpoint 的 1316×768 MacBook 布局检查证据。
- package.json 只调整测试 scripts，基础建设后未重复生成 120MB 构建产物；原始 checkpoint 的 App/ZIP/DMG 已在隔离兼容 Node 环境通过。
- 录屏、真实编码器、长时间运行、系统文件对话框、Apple Developer 签名、公证和 Intel Mac 仍需按发布清单人工验证。
- GitHub 没有连接，因而没有远程 PR 或 Actions 运行；这不影响本地分支、提交和验收体系。
- 下一步由项目所有者决定许可证、配置真实 Git 身份并登录/连接 GitHub；不得默认创建公开仓库。

## 交接

- 实现提交：`a8516fe`、`50886a8`
- 验收记录提交：本文件所在的基础建设分支 HEAD
- PR：无（没有 remote，GitHub CLI 未登录）
- 工作区状态：提交本验收记录后应为干净
- 下一个开发任务：从 `docs/TASK_TEMPLATE.md` 建立新的 active 验收单，并从正确基线创建新的任务分支

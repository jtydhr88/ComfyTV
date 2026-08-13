# 任务：固定本地 PreVision App 入口

- 状态：completed
- 日期：2026-07-14
- 对话：当前 Codex Bug 修复与回归对话
- 分支：fix/canonical-latest-app
- 基线：40e8dd366039768af0f9ea0a2cfb2d6ae3b1f37f（包含国际化规范 `0d5bcb6`）
- 负责人：Codex

## 用户问题

随着持续迭代，本机出现了多个外观相同的 PreVision App，难以判断哪个是最新版本。用户希望固定一个 App，后续优化后从同一入口打开时始终是最新构建。

## 目标

- 提供可重复执行的本地更新命令：先构建，再安全更新固定的 `PreVision.app`。
- 默认固定入口明确且稳定；安装过程只替换该入口，不触碰其他同名副本。
- 替换前验证新构建和既有目标确属 PreVision；失败时不留下半安装状态。
- 补充自动回归与开发文档，并实际构建、安装和启动验证。

## 非目标

- 不自动搜索、删除或覆盖固定入口之外的历史 App、副本、DMG 或用户文件。
- 不实现在线自动更新、正式 Apple 签名、公证或对外发布。
- 不改变项目数据格式、自动保存 key 或现有业务功能。

## 证据与现状

- 代码：`npm run package` 只在 `out/PreVision-darwin-arm64/PreVision.app` 生成构建产物，没有固定安装/更新入口；`npm run app:update -- --dry-run` 以 Missing script 失败。
- Git：任务分支先从国际化规范提交 `0d5bcb6` 创建；发现现有安装包含后续 UI，而该提交不是最新集成状态后，仅快进到已整合国际化的最新提交 `40e8dd3`，没有重写历史或覆盖其他工作树改动。
- 测试/运行：Spotlight 盘点确认截图中的三个入口分别是用户 Applications 中的固定 App、桌面仓库 `out/` 构建包和同目录旧备份；三者 bundle ID 均为 `com.prevision.director`，签名验证通过，但固定 App 尚未包含 `40e8dd3` 的最新录屏界面修复。
- 文档/历史线索：`0925ef0` 的验收单记录了手工同时刷新固定 App 与开发包、保留旧备份的过程；发布文档仅覆盖打包与 DMG 安装，没有日常安全、可恢复的固定入口更新流程。

## 影响范围

- 模块：macOS 桌面构建、本地安装、仓库 QA。
- 文件：预计涉及 `package.json`、本地安装脚本、相应测试、`qa/test-impact-map.yaml` 与构建/开发文档。
- 数据格式：无；Electron bundle ID 和用户数据目录保持不变。
- 平台：macOS Apple Silicon；测试安装目标使用临时目录，实际验收使用 `~/Applications/PreVision.app` 固定入口。

## 风险

- 数据：替换 App bundle 不得删除 Electron 用户数据或项目文件；bundle ID 必须保持 `com.prevision.director`。
- UI/交互：无主应用界面改动；命令行提示不得新增运行时内联中文用户文案。
- 安全：不得覆盖 bundle ID 不匹配的现有 App，不得跟随危险目标或删除固定入口之外的文件。
- 发布：当前仍为 ad-hoc 签名；本任务只解决本机开发安装，不代表正式发行。

## 验收条件

- [x] 单条 npm 命令能在兼容 Node 版本下构建并安全更新固定 `PreVision.app`。
- [x] 重复运行只更新同一路径，目标 bundle ID、版本和签名验证通过。
- [x] 安装失败或目标身份不匹配时拒绝覆盖，可安全回滚的失败路径不残留本次临时/备份 App；回滚本身中断时保留可识别恢复证据。
- [x] 固定入口之外的现有 App 不被自动删除或改写。
- [x] 新增能在修复前失败、修复后通过的回归断言。
- [x] `npm run test:i18n`、完整回归及相关影响测试通过。
- [x] 使用 Node 20–24 完成真实构建、固定入口更新和启动人工验证。
- [x] 文档和 QA 影响映射已更新。

## 测试计划

- 影响映射模块：本地安装脚本、build-config、foundation。
- 主应用模块参数：无。
- 最小命令：安装脚本目标测试、`npm run test:i18n`、`npm run test:desktop`、`npm run test:foundation`。
- 升级到全量的条件：本任务修改打包/安装流程，交接前固定运行 `npm run test:full` 与 `npm run test:impact -- --base 40e8dd3`。
- 人工检查尺寸/步骤：关闭旧固定 App；用兼容 Node 构建并更新固定入口；核对路径、bundle ID、签名和修改时间；从固定入口启动并确认只有该路径被替换。

## 实施记录

- 假设：沿用本机已经存在且无需管理员权限的 `~/Applications/PreVision.app` 作为唯一固定入口；自动测试使用隔离临时目录。
- 关键决定：安装流程只更新固定入口；截图中的 `out/` 构建包和旧备份作为无关副本保持不变，避免未经授权删除。
- 实际修改：新增 `scripts/update-local-app.mjs` 与 `npm run app:update`，把打包明确限定为 macOS arm64，并新增本机安装回归和影响映射。更新命令在打包前恢复旧事务并争用完整锁，恢复工作区用 `Owner.lock` 硬链接与事务绑定；源包、阶段包和最终包均校验身份、签名与哈希，可捕获失败回滚，异常中止下次先恢复。
- 安全复审：独立复审逐项验证并修复了 build 前恢复、同/跨进程并发、PID 复用、提交后清理、恢复工作区所有权和锁二次核对；最终结论为 GO，未留 P0–P2。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:update -- --dry-run`（修复前） | 失败 | <1s | 当时不存在 `app:update` script，确认缺口。 |
| Node 24.14.0 下 `npm ci` | 通过 | 约 5s | 使用 lockfile 安装 504 个 package；审计告警未自动改依赖。 |
| `npm run test:local-install` | 27 通过 | <1s | 隔离临时目录；覆盖路径/身份、符号链接、并发、锁、回滚、中断恢复与清理失败。 |
| `npm run test:full` | 通过 | 约 11s | 应用 343、桌面 23、本机安装 27、基础 53、国际化 21 项通过。 |
| `npm run test:i18n` | 21 通过 | <1s | 由 foundation/full 重复验证，无新增直接中文运行时文案。 |
| `npm run test:impact -- --base 40e8dd3` | 通过 | 1.7s | 选择并通过 desktop、local-install、foundation/i18n。 |
| Node 24.14.0 下 `npm run app:update` | 通过 | 约 12s | 显式 package darwin/arm64，更新 `~/Applications/PreVision.app`。 |
| 真实包校验 | 通过 | <2s | 源/安装 `app.asar` SHA-256 同为 `f40c6c6d…`；工作树/源包/安装包 HTML 同为 `94af9947…`；bundle ID `com.prevision.director`、版本 0.7.0、codesign 与 arm64 通过，事务残留 0。 |
| 固定路径启动 | 通过 | <1s | 运行路径为 `~/Applications/PreVision.app/Contents/MacOS/PreVision`。 |
| 其他副本不变性 | 通过 | <1s | 桌面仓库构建包/旧备份 `app.asar` 哈希仍为 `b61ff300…` / `aca94ce0…`。 |

## 未覆盖与后续

- 历史副本清理由用户确认后另行处理；本任务不自动删除。

## 交接

- 最终提交：本验收单归档后创建本地任务提交（见分支 Git 历史）。
- PR：无（仓库尚无 remote）
- 工作区状态：实现、测试、真实安装与文档已完成，待归档并提交。
- 下一步：今后从 `~/Applications/PreVision.app` 启动，每次需要刷新时先退出 App，再在 Node 20–24 下运行 `npm run app:update`。

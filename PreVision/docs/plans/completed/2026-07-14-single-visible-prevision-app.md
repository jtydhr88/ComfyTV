# 任务：本机只保留一个可见 PreVision App

- 状态：completed
- 日期：2026-07-14
- 对话：当前 Codex Bug 修复与回归对话
- 分支：fix/single-visible-prevision-app
- 基线：e3394a8（固定 App 可恢复更新）
- 负责人：Codex

## 用户问题

固定入口已更新，但 Finder 仍显示三个外观相同的 PreVision App。用户期望本机只保留一个日常可见入口，以后更新也不再留下可被 Finder 找到的构建 App。

## 目标

- 保留且仅保留 `~/Applications/PreVision.app` 作为日常入口。
- 把已确认的旧构建 App 与旧备份移入废纸篓，不永久删除。
- `app:update` 只在真实安装成功后清理本次生成的 `out/.../PreVision.app`，失败时保留诊断产物。
- 补充回归、文档与真实 Finder/Spotlight 盘点证据。

## 非目标

- 不删除固定 App、用户项目、Application Support 或导出数据。
- 不清空废纸篓，不永久删除历史 App。
- 不改变主应用 UI、数据格式或业务语义。

## 影响范围与风险

- 代码：本机更新脚本及隔离安装回归。
- 本机文件：仅两个已验证的历史 App 副本，使用可恢复的废纸篓移动。
- 风险：不得跟随符号链接或清理任意路径；仅在安装结果已验证后删除精确的可再生成源 App。

## 验收条件

- [x] Spotlight/Finder 盘点中只剩固定 App 作为非废纸篓 PreVision 入口。
- [x] 两个历史副本已移入废纸篓，固定 App 随后经真实更新并从精确路径启动。
- [x] `runUpdate` 成功后清理构建 App，失败时不清理，清理失败不回滚已验证的固定 App。
- [x] `npm run test:local-install`、`npm run test:i18n`、`npm run test:full` 和影响测试通过。
- [x] 真实 Node 20–24 `app:update` 后仍只剩一个非废纸篓 App。
- [x] 文档与 QA 证据已更新，已创建本地提交。

## 测试计划

- 最小：`npm run test:local-install`、`npm run test:foundation`、`npm run test:i18n`。
- 完整：`npm run test:full`、`npm run test:impact -- --base e3394a8`。
- 真实：Node 24 运行 `npm run app:update`，核对固定 App 签名/哈希/路径及 Spotlight 结果。

## 实施与验证记录

- 根因：上一任务只固定了 Applications 入口，并出于保守策略刻意保留桌面仓库的 `out/` 构建与备份；三份 bundle ID/版本相同，因此 Finder 仍显示三个。
- 盘点：Spotlight 原结果为固定 App（`f40c6c6d…`）、桌面旧构建（`b61ff300…`）和旧备份（`aca94ce0…`）。仅后两份经路径、bundle ID 和哈希三重校验后移入废纸篓，未清空废纸篓。
- 代码：`runUpdate` 只允许清理标准 `<repository>/out/PreVision-darwin-arm64/PreVision.app`，在写入前拒绝与 target 互为祖先的路径。安装提交后将源 App 原地换名到隐藏 quarantine，重复校验 inode、bundle、签名、source/target 哈希后才删除；任一失败尽力恢复 source，只返回警告，不回滚已提交的固定 App。`installLocalApp` 直接调用仍保留 source。
- 独立删除边界复审结论：GO，未发现 P0–P2。
- 实现提交：`1baf3f8` (`fix: keep only one visible PreVision app`)。

| 命令/步骤 | 结果 | 证据 |
| --- | --- | --- |
| `npm run test:local-install` | 36 通过 | 新增成功清理、build/安装失败保留、清理失败不回滚、canonical 路径、祖先路径、inode/quarantine 竞态和直接安装保留。 |
| `npm run test:full` | 通过 | 应用 343、桌面 23、本机安装 36、基础 53、国际化 21 项通过。 |
| `npm run test:impact -- --base e3394a8` | 通过 | 选择并通过 local-install 36 项、foundation 53 项与 i18n 21 项。 |
| Node 24.14.0 `npm run app:update` | 通过 | 固定 App SHA-256 `7bdda3bf…`，bundle ID `com.prevision.director`、0.7.0、codesign、arm64 通过；本次 source 不存在，事务残留 0。 |
| Spotlight 现存结果 | 1 个 | 仅 `~/Applications/PreVision.app`；两个桌面旧路径均不存在。 |
| 精确路径启动 | 通过 | 运行路径为 `~/Applications/PreVision.app/Contents/MacOS/PreVision`。 |

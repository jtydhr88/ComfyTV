# 任务：PreVision 最新预览固定入口

- 状态：completed
- 日期：2026-07-27
- 对话：`04.17｜PreVision 最新预览固定入口`（canonical task/thread 已核对，去敏）
- 分支：`chore/04.17-stable-local-preview-launcher`
- 基线：`526c94e89f619aaae462365fa20bb642d9ab3752`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（`chore/integrate-04.9-before-product`）
- 负责人：`worker:04.17-stable-local-preview-launcher`

## 并行任务声明

- 任务 ID：`04.17-stable-local-preview-launcher`
- 模式：write
- 分管 owner：04
- 模块：`desktop,repository,release`
- UI 表面：`dialogs`
- 数据区域：`electron-ipc,build-provenance,local-install`
- 预计修改文件：
  - `package.json`
  - `scripts/install-latest-preview-launcher.mjs`
  - `scripts/publish-latest-preview.mjs`
  - `scripts/latest-preview-launcher-runtime.mjs`
  - `qa/latest-preview-launcher-policy.json`
  - `测试/最新预览入口测试.mjs`
  - `docs/qa/latest-preview-launcher/README.md`
  - `docs/plans/active/2026-07-27-stable-local-preview-launcher.md`
  - `docs/plans/completed/2026-07-27-stable-local-preview-launcher.md`
  - `docs/plans/completed/README.md`
- reservation：已从同一 reservation 转换为 active claim；token 不提交。
- reserve request key：已核对/已去敏。
- 协调登记：schema v3 revision=`d50889af-3e35-4525-8ab9-cdae523f337c`；persistence=confirmed。
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：`worker:04.17-stable-local-preview-launcher` / `worker:04.17-stable-local-preview-launcher`
- 状态更新时间 / 原因：2026-07-27T04:44:58Z；独立 R2 round1 对冻结 HEAD `85fcdc0` 报告 pointer TOCTOU 与 Electron binary 缺少内容指纹两个 P2，已从 REVIEW 恢复同一 claim 最小返修。
- 侧栏去重证据：task id、client id、thread id 已核对/已去敏。
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present。
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background。
- 执行可见性：BACKGROUND_ONLY（后台施工）。
- Desktop live 证据：不适用；`desktopLiveObserved=no`，不得宣称 DESKTOP_LIVE。
- WAITING checkpoint：首个 turn 已明确写明 WAITING 并结束；本 turn 恢复同一 canonical task/thread。
- turn stop verification：round1 的 stop verification 已由 REVIEW→ACTIVE 按协议作废；本轮返修完成后重新固化。
- 失败补偿：标准 claim 命中 `spawnSync git ENOBUFS` 且未转换；核验协调器 blob 为批准值后，使用一次性非落盘 64MiB wrapper 成功转换同一 reservation，未修改协调器、registry 语义或锁。
- `task:check` 结果：固定 04 已完成原子 reserve；仅与 `03.15-camera-position-delete-follow-camera` 在 `docs/plans/completed/README.md` 文件级软冲突。机械集成顺序固定为 03.15 先、04.17 后，并保留双方索引。
- `task:claim --reservation`：已从 reservation 转换。
- REVIEW commit list：round1 曾精确冻结 `082ba68,f0a142b,85fcdc0`；R2 BLOCK 后已作废，round2 将包含新增返修提交。
- 机械 closeout：reviewer PASS 后以 sole-parent `--closeout-commit` 仅移动 active→completed 验收单并更新 `docs/plans/completed/README.md`；不得混入其他文件。
- `task:release`：未释放。
- `task:archive`：未开始。

## 用户问题

建立可双击的“PreVision 最新预览”独立小型启动器。它只读取由受控脚本原子发布的最新预览指针，严格验证来源 Worktree、commit、clean 状态、生成 HTML、锁定 Electron 依赖和隔离 profile 后启动；失败必须明确提示且不得回退固定 App。

## 目标

- 安装独立小型启动器，不复制完整 PreVision App，不修改或替换固定 `PreVision.app`。
- 通过事务化指针把“安装启动器”与“切换最新预览来源”分离，以后 `00` 只需机械发布新指针。
- 启动时 fail closed：精确 Worktree、commit、clean tree、生成 HTML、Electron 依赖、隔离 profile 任一不成立均不启动。
- 首次发布目标由项目外参数承载，标题明确包含 `NOT INTEGRATED`。

## 非目标

- 不执行 `app:deliver`，不更新固定 App。
- 不修改 Electron 产品代码、现有 i18n locales、固定 App 交付脚本或 impact map。
- 不杀无关 Electron 进程，不发布公网/GitHub/Pages，不运行 `test:full`。

## 证据与现状

- 代码：已新增独立 launcher policy、事务安装器、原子指针发布器、启动时 fail-closed runtime 与定向测试；没有修改 Electron 产品代码或固定 App 交付脚本。
- Git：从 detached exact baseline 创建目标分支；创建验收单前工作区 clean。
- 测试/运行：Node v24.18.0 首次 `app:status` 因缺少 `@electron/asar` 失败；`npm ci` 后成功读取固定 App provenance。R2 round1 后新增 pointer TOCTOU、直接 symlink/FIFO 与 Electron binary 替换确定性反例；返修门禁为 latest-preview 56/0、i18n 217/0、desktop 47/0、foundation 151、C8 11、coordination 553、project-input 11。返修提交后已重装 launcher、发布 schema 2 指针并真实启动为 `ready`。
- 文档/历史线索：固定 App 交付与任务 claim 是独立边界；本任务只新增快速预览基础设施。

## 影响范围

- 模块：desktop、repository、release。
- 文件：仅“预计修改文件”白名单。
- 数据格式：无项目数据变更；新增项目外事务化预览指针与隔离 Electron profile。
- 平台：macOS Apple Silicon，本机开发预览。

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：不可观察，未验证
- Ultra：不可观察，未验证
- Max/升级原因：无
- 独立只读 reviewer：round1 最终 BLOCK（两个 P2）；修复完成后由固定 04 送同一独立 R2 round2。
- 数据：指针必须原子替换，且不得接受符号链接、脏树或 commit 漂移。
- 供应链：pointer JSON 必须以 `O_NOFOLLOW|O_NONBLOCK` 打开并在同一 inode 上完成 stat/read，避免 FIFO 在类型检查前阻塞；Electron binary 必须以 pointer 中 SHA-256 锁定并在 spawn 前复核。
- UI/交互：错误提示需明确区分失败原因；正常标题必须标明未集成状态。
- 安全：外部路径只进入项目外指针/命令参数，不提交本机绝对路径；命令启动不用 shell 拼接。
- 发布：仅本机快速预览基础设施，不是固定 App 正式交付或对外发布。

## 验收条件

- [x] 独立启动器可安装并可双击，不修改固定 `PreVision.app`。
- [x] 受控发布脚本事务化切换精确预览指针。
- [x] 启动器验证精确 Worktree、commit、clean tree、生成 HTML、锁定 Electron 依赖和隔离 profile。
- [x] 自动故障注入确认缺失、脏树、commit 不匹配、依赖缺失均 fail closed，不回退固定 App，不杀无关进程。
- [x] 首次指针目标启动后标题明确包含 `NOT INTEGRATED`，且使用隔离 profile。
- [x] 定向自动测试、Node 24 `test:i18n`、desktop、foundation/C8 检查通过。
- [x] 真实双击成功路径和失效路径已验证。
- [x] `app:status` 前后固定 App provenance 不变。
- [ ] 实现者之外的独立只读 R2 已完成，阻塞问题已关闭。
- [x] 固定 App 交付不适用：本任务明确禁止 `app:deliver`。

## 测试计划

- 影响映射模块：desktop、repository、release、foundation/build-config。
- 主应用模块参数：无。
- 最小命令：定向最新预览入口测试、`npm run test:i18n`、`npm run test:desktop`、`npm run test:foundation`，以及实际改动后的 `test:impact` 评估。
- 升级到全量的条件：不运行 `test:full`；若实现要求超出声明 scope，立即停止并升级固定 04。
- 人工检查尺寸/步骤：Finder 双击独立启动器；核对标题、精确来源、隔离 profile；分别验证无指针/脏树/commit 漂移/依赖缺失提示。
- 固定 App 交付：不适用；固定路径只读核对 provenance，禁止更新。

## 实施记录

- 假设：发布者显式提供合法 Worktree 和 40 位 commit；启动时来源必须仍精确 clean。
- 关键决定：启动器与完整 App、指针与 profile 分离；所有失败路径 fail closed。
- 实际修改：
  - `package.json` 新增受控 install/publish/test 入口。
  - policy 固定唯一 launcher、pointer、profile、来源文件和 Node 范围，不含本机绝对路径。
  - installer 生成最小 App bundle、复用现有图标与 language keys、校验 bundle identity/codesign，并事务替换同一 launcher；不读取或替换固定 App。
  - launcher config 不内置 preview commit 或占位符；运行时精确 expected commit 只从项目外原子指针读取。
  - publisher 先验证精确 source commit、clean tree、生成 HTML 与锁定 Electron，再以 `0600` 临时文件 + fsync + rename 发布唯一指针。
  - runtime 以 `O_RDONLY|O_NOFOLLOW|O_NONBLOCK` 打开 pointer，并只对同一 FileHandle 做 stat/read/JSON 检查；路径在 open 后被换成 symlink 也不会改变已打开 inode 的读取内容，FIFO/特殊文件在读取前拒绝。
  - pointer schema 2 记录 Electron binary SHA-256；runtime 每次校验来源并在 spawn 前再次比较 binary 内容指纹，再生成项目外 bootstrap、设置隔离 `userData/sessionData` 和 `NOT INTEGRATED` 窗口标题。
  - 定向测试覆盖安装回滚、身份拒绝、固定 App 哨兵、原子指针、确定性 pointer TOCTOU 和同版本 Electron binary 替换等关键失效路径。
- 中断/恢复：首个 turn 只建立 WAITING checkpoint；本 turn 从同一 canonical thread 恢复。
- app-server 通知消费：首个 WAITING turn 已结束；当前正式开工 turn 为后台施工，不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status`（安装依赖前） | 失败 | <1s | 缺少锁定依赖 `@electron/asar`，未修改 App |
| Node 24 `npm ci` | 通过 | 约 9s | 仅安装 lockfile 依赖 |
| Node 24 `npm run app:status`（安装依赖后） | 通过 | <1s | installed source 为 `b8da5f4...` |
| 标准 `task:claim --reservation` | 失败且未转换 | 约 60s | `spawnSync git ENOBUFS` |
| 批准的一次性 64MiB wrapper claim | 通过 | 约 46s | ACTIVE/BACKGROUND_ONLY；协调器 blob `aba303e...` |
| `npm run test:latest-preview` | 通过 | <1s | 48 通过，0 失败；含跨 cwd 构建和已安装 bundle 无 commit 占位回归 |
| `npm run test:i18n` | 通过 | <1s | 217 通过，0 失败 |
| `npm run test:desktop` | 通过 | <1s | 47 通过，0 失败 |
| 首次 `npm run test:foundation` | 失败（测试自检） | <1s | 定向测试中的绝对路径检测字面量被敏感守卫识别；未改守卫/impact map |
| 修正测试字面量后 `npm run test:foundation` | 通过 | 约 74s | foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11 |
| `npm run test:impact -- --base 526c94e... --dry-run` | 只读评估 | <1s | 新脚本未登记 impact map，建议 full；按开工单不改 map、不运行 full |
| 生产 installer + publisher | 通过 | <1s | 独立 bundle identity/codesign、2.2 MiB、`0600` 指针通过；首次调用发现并修复目标构建 cwd 误判 |
| 首次合法指针真实双击 | 通过 | 约 31s | `ready`，标题/commit 精确，Electron 来自指定 Worktree，Profile/Session 均 `0700` |
| commit mismatch 真实提示 | 通过 | <10s | 受控全零 expected 故障注入显示 `LATEST_PREVIEW_COMMIT_MISMATCH`；这是项目外指针测试，不是 bundle 占位泄漏 |
| 恢复合法指针后再次双击 | 通过 | 约 6s | 新 `last-launch.json` 为 `ready`，标题、commit、进程来源与隔离 profile 再次匹配 |
| Node 24 `npm run app:status`（安装与双击后） | 通过 | <1s | installed source 仍为 `b8da5f4...`，固定 App 未更新 |
| 独立 R2 round1 | BLOCK | — | P2：pointer lstat/readFile TOCTOU；同版本 Electron binary 替换未被内容指纹覆盖 |
| REVIEW→ACTIVE | 通过 | 约 45s | revision `d50889af...`；旧 review/stop evidence 已作废，claim 保持 |
| 返修期 `npm run test:latest-preview` | 通过 | 约 1s | 56 通过，0 失败 |
| 返修期 `npm run test:i18n` | 通过 | <1s | 217 通过，0 失败 |
| 返修期 `npm run test:desktop` | 通过 | <1s | 47 通过，0 失败 |
| 返修期 `npm run test:foundation` | 通过 | 约 91s | foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11 |
| 返修前 Node 24 `npm run app:status` | 通过 | <1s | installed source 仍为 `b8da5f4...`；尚未重装小 launcher |
| 返修提交 | 通过 | — | `164edd29f77431ed3ca169552a3b8bbe78fc2683`；未 amend round1 三提交 |
| 返修 launcher install + pointer publish | 通过 | <1s | installer source=`164edd2`；bundle identity/codesign 通过；pointer schema 2、`0600`、Electron binary SHA-256 已写入 |
| 返修真实双击 | 通过 | 约 7s | 新 `last-launch.json` 为 `ready`；标题/`aa04809...`/Electron 来源精确，Profile/Session 均 `0700` |
| 安装 runtime 无启动复核 | 通过 | <1s | schema 2、Electron 43.1.0 与 binary SHA-256 全部匹配 |
| 返修后 Node 24 `npm run app:status` | 通过 | <1s | installed source 仍为 `b8da5f4...`，固定 App 未更新 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：本任务不启动固定 App；收尾只读核对 provenance 与开工前一致。

## 未覆盖与后续

- 同一独立 R2 round2、中央集成、release、archive 均由固定 04/00 后续处理。

## 交接

- round1 冻结提交：`082ba685507fb13f122054451d9fbda7e641eaea`、`f0a142b79cd5f913a3e54a17876c37671f02f01a`、`85fcdc05264c8caf60ce6a9598fbb19c6e8946d1`。
- round1 BLOCK 后返修提交：`164edd29f77431ed3ca169552a3b8bbe78fc2683`；任务级外部 QA 证据提交待本轮收尾生成。
- PR：无。
- reviewer 结论：独立 R2 round1 BLOCK（两个 P2）；禁止 closeout/HANDOFF，返修尚未复审。
- 生命周期交接：ACTIVE / BACKGROUND_ONLY。
- 工作区状态：两项最小返修、既定自动门禁与返修后外部 QA 均完成；仅待形成任务级 evidence commit 并确认 clean。
- 下一步：停止并向固定 04 交接；由固定 04 重新 verify-stop→REVIEW，冻结 baseline..新 HEAD 完整列表并送同一独立 R2 round2。

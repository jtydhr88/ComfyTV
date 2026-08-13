# 任务：02.12｜时间轴0.1s尺规与半秒吸附

- 状态：completed
- 日期：2026-07-28
- 对话：02.12｜时间轴0.1s尺规与半秒吸附
- 分支：`feat/02.12-timeline-tenth-ruler-half-second-snap`
- 基线：`c99968d0c547392fa046b5e1a5ac0ca9f5b7d2e5`
- 固定 App 来源：初次 `npm run app:status` 因缺少 `@electron/asar` 未取得；本任务不得更新固定 App
- 负责人：短期实现任务 `02.12-timeline-tenth-ruler-half-second-snap`

## 并行任务声明

- 任务 ID：`02.12-timeline-tenth-ruler-half-second-snap`
- 模式：write
- 分管 owner：02
- 模块：`actor,camera,history,i18n,layout,testing,timeline`
- UI 表面：`timeline`
- 数据区域：`autosave,i18n-resources,object-paths,qa-metadata,shot-camera,ui-preferences`
- 预计修改文件：
  - `app-shell.html`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/plans/active/2026-07-28-timeline-tenth-ruler-half-second-snap.md`
  - `docs/plans/completed/2026-07-28-timeline-tenth-ruler-half-second-snap.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/timeline-tenth-ruler-half-second-snap/README.md`
  - `docs/qa/timeline-tenth-ruler-half-second-snap/evidence.json`
  - `docs/qa/timeline-tenth-ruler-half-second-snap/electron-1316x768.png`
  - `docs/qa/timeline-tenth-ruler-half-second-snap/electron-1440x900.png`
  - `i18n/locales/en-US.js`
  - `i18n/locales/zh-CN.js`
  - `qa/feature-registry.yaml`
  - `src/ui/timeline.js`
  - `测试/冒烟测试.mjs`
  - `预见PreVision.html`
- reservation：已预留（ID `fbd7508c-6933-4eca-8670-ef7e14e9dc4d`；token 不写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=`86ce9511-2452-4bc3-bcc9-c17c71fa272b`；persistence=committed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：`worker:02.12-timeline-tenth-ruler-half-second-snap`
- 状态更新时间 / 原因：2026-07-28；原 reservation 已原子转换为 write claim，隔离实现与预览进行中
- 侧栏去重证据：task id、client id、thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=desktop
- 执行可见性：DESKTOP_LIVE
- Desktop live 证据：rollout/thread DB/sidebar present + name=set + turnOwner=desktop + started turn + 已实际观察当前 turn（去敏）
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无
- `task:check` 结果：reservation 已由分管入口原子预留
- `task:claim --reservation`：成功；原 reservation/token 与 immutable scope 原样使用，revision=`86ce9511-2452-4bc3-bcc9-c17c71fa272b`
- REVIEW commit list：未冻结
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

在快速 NOT INTEGRATED 隔离预览中，把时间轴尺规精度统一到 0.1s，并为整秒/半秒增加默认开启、可临时旁路的强吸附和明确反馈，同时保持既有项目、历史和路径语义。

## 目标

- 时间尺使用 0.1s 小刻度、0.5s 中刻度和一位小数标签、1.0s 大刻度和最大数字，并与 lane 网格、0 和镜头结束线严格对齐。
- camera、legacy actor/path、generic preview key/group 拖动统一量化到 0.1s；靠近整秒/半秒约 8px 时强吸附并显示 guide、高亮和双语状态，多选保持 anchor 相对间距。
- 增加默认开启的 session/presentation 吸附按钮；手动开启时 Option/Alt 临时旁路，手动关闭时 Option 不反向开启。
- 保持局部/全局时间边界、min-gap、0 秒基础点、pointercancel/blur 和 history 事务语义。

## 非目标

- 不修改 camera/project 数据模型、actor/prop 语义、project/history/autosave 持久化。
- 不运行 `test:impact`、`test:full` 或 `app:deliver`。
- 不更新固定 App、稳定预览指针、GitHub、Pages 或任何其他预览。
- 不在 immutable scope 之外写入；缺文件时 fail closed。

## 证据与现状

- 代码：P9 后时间轴源文件为 `src/ui/timeline.js`，根 `预见PreVision.html` 是确定性构建产物。
- Git：开工前 HEAD 精确为基线且工作区 clean；目标分支已从该基线创建。
- 测试/运行：Node `v24.18.0`；初次 `app:status` 缺 `@electron/asar`；标准 `task:status` 复现 `spawnSync git ENOBUFS`，协调器 SHA-256 与受信值一致。
- 文档/历史线索：TIME-001～005、ADR-0002、ADR-0005、ADR-0006、ADR-0017。

## 影响范围

- 模块：`actor,camera,history,i18n,layout,testing,timeline`
- 文件：仅上述 immutable scope
- 数据格式：无
- 平台：macOS Electron 隔离开发预览；浏览器运行时共用代码

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：不可观察，未验证
- Ultra：不可观察，未验证
- Max/升级原因：无
- 独立只读 reviewer：R2 round 1 结论为 FAIL（P0=0、P1=1、P2=1）；本轮仅修复所列两项，round 2 仍由实施者之外的 reviewer 执行
- 数据：多类时间轴拖动必须共用量化/强吸附边界，不能改变持久数据模型
- UI/交互：窄窗口工具栏、Option 旁路、多选 anchor、guide/反馈和 pointer 收尾存在回归风险
- 安全：不扩大输入、IPC 或外部资源边界
- 发布：仅 NOT INTEGRATED 隔离预览

## 验收条件

- [x] 尺规层级、0.1s 精度、0.5/1.0 主刻度与 lane/边界对齐满足冻结合同。
- [x] camera、legacy actor/path、generic preview key/group 统一 0.1s，并正确处理 8px 强吸附、多选 anchor、时间边界、min-gap 和 0 秒基础点。
- [x] `motionSnap` 默认 on；active/aria/title/status 与双语 key 完整；Option/Alt 只在 manual on 时临时旁路。
- [x] manual off 仍量化到 0.1s，只取消强吸附、guide 和“已吸附”反馈；开关不写 project/history/autosave。
- [x] pointercancel/blur 沿用现有事务语义且不新增 history。
- [x] Node 24 timeline、layout、i18n、build 与 `git diff --check` 通过。
- [x] 隔离 Electron 1440×900、1316×768 完成真实 UI 检查并保存证据；1440×900 的 Computer Use 截图传输被等比下采样到 1229×768，原窗口外框尺寸已在 renderer 中核对。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：本任务明确禁止 `app:deliver`。
- [ ] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：`timeline,layout,i18n`
- 主应用模块参数：`timeline`、`layout`
- 最小命令：Node 24 下 `npm run test:module -- timeline`、`npm run test:module -- layout`、`npm run test:i18n`、`npm run build`、`git diff --check`
- 升级到全量的条件：本轮禁止 `test:impact` / `test:full`；出现 scope 外必需修改即停止回报
- 人工检查尺寸/步骤：隔离 Electron 1440×900 与 1316×768；验证 1.0/1.5/2.0 吸附、Option 旁路、manual off、guide/状态和按钮不挤压
- 固定 App 交付：不适用；不得触碰 `~/Applications/PreVision.app`

## 实施记录

- 假设：强吸附以约 8 CSS px 转换为当前时间尺度阈值；最终落点始终量化为 0.1s。
- 关键决定：开关仅为当前 session/presentation 状态，每次启动默认 on。
- 实际修改：增加 0.1s/0.5s/1.0s 共用尺规与 lane 网格、统一拖动量化/强吸附 helper、session-only `motionSnap` 控件、竖向 guide、关键帧高亮、双语实时状态与最小确定性回归；camera/project 数据模型未变。
- R2 最小返修：camera Shift 多选的邻接边界只按实际 moving indices 跳过，静止 foundation 即使处于选择集仍保留真实 min-gap；snap 状态使用明确 active/text 追踪，使 snap→unsnap 与 Option/Alt 旁路同步清除 guide、高亮和吸附状态，同时不覆盖后来写入的无关状态。
- R2 回归：真实 pointer 事件覆盖选择 `[0,1]` 后把第二 key 拖至最左，确认 foundation=0、第二点=0.1、position/aim/FOV 时间一致且单次 history/autosave；另一真实 pointer 序列覆盖 snap→unsnap、无关状态保护、再次 snap→Option 旁路的 DOM 状态。
- 中断/恢复：标准 claim 因 `spawnSync git ENOBUFS` 失败；原 reservation 保持存在后，使用已批准且 hash 已核对的 Node 24 非落盘 64MiB wrapper 原样重放成功。隔离 Electron 首次启动触发已安装 `electron` 包补齐其二进制后立即停止；随后从同一工作树、独立临时 user-data 正常启动。
- app-server 通知消费：当前为 Desktop-owned started turn；完成前必须单独 verify-stop

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| 开工 Git/Node 核对 | 通过 | <1s | HEAD 精确、工作区 clean、Node 24 |
| `npm run app:status`（初次） | 失败 | <1s | 缺 `@electron/asar`，未取得 installed source |
| 标准 `npm run task:status` | 失败 | 约 15s | `spawnSync git ENOBUFS`；受信 hash 已核对 |
| `npm run test:module -- timeline` | 通过 | 约 38s | 187 通过，0 失败 |
| `npm run test:module -- layout` | 通过 | 约 41s | 160 通过，0 失败 |
| `npm run test:i18n` | 通过 | <10s | 217 通过，0 失败 |
| `npm run build` | 通过 | <1s | 根 HTML 确定性重建 |
| `git diff --check` | 通过 | <1s | 无空白错误 |
| 隔离 Electron 1440×900 / 1316×768 | 通过（有记录限制） | 约 10min | 真实拖动验证 2.0/1.5/1.0 强吸附和 manual off 1.4；按钮/尺规/状态/窄宽布局通过。Option 组合键和拖动中 guide 由自动门禁覆盖，当前 Computer Use 原子 drag 无法保持 Option 或停在 pointermove 中截图 |
| 独立 R2 round 1 | FAIL | — | P0=0、P1=1、P2=1；禁止 closeout/HANDED_OFF，已按同一 claim/branch/scope 返回 ACTIVE |
| R2 `npm run test:module -- timeline` | 通过 | 约 39s | 189 通过，0 失败；新增两项真实 pointer/DOM 回归 |
| R2 `npm run test:module -- layout` | 通过 | 约 39s | 160 通过，0 失败 |
| R2 `npm run test:i18n` | 通过 | <10s | 217 通过，0 失败 |
| R2 `npm run build` / `git diff --check` | 通过 | <1s | 根 HTML 重建；无空白错误 |

固定 App installed source：未取得；本任务禁止更新。

固定 App 人工启动结果：不适用。

## 未覆盖与后续

- 固定 App、稳定预览、中央集成、完整回归、对外发布均由后续阶段处理。

## 交接

- 实现提交：`9ba9934ca93f4ae24eac1a77b51b27179f19f82e`
- PR：无
- reviewer 结论：round 1 FAIL（P0=0、P1=1、P2=1）；两项已最小返修，round 2 待评
- 生命周期交接：REVIEW→ACTIVE 已完成；返修提交与 completed-turn stop verification 后重新转 REVIEW，保持 claim
- 工作区状态：R2 返修待提交
- 下一步：提交聚焦返修，运行 `task:verify-stop`，以原两提交加返修提交的完整有序列表转换为 REVIEW；next=`02-independent-r2-round2`

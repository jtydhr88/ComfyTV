# 任务：04.16｜检查栏快速入口滚动稳定性与探针收敛

- 状态：completed
- 日期：2026-07-26
- 对话：04.16 canonical worker（已去敏核对）
- 分支：`fix/04.16-inspector-rail-scroll-stability`
- 基线：`3f7514a36c3cc039ed5d35c3c41b7c0a0815c2fd`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`；当前分支包含该来源但不精确相同，本任务禁止更新固定 App
- 负责人：worker:04.16-inspector-rail-scroll-stability

## 并行任务声明

- 任务 ID：04.16-inspector-rail-scroll-stability
- 模式：write
- 分管 owner：04
- 模块：layout、repository、testing
- UI 表面：inspector
- 数据区域：qa-metadata
- 预计修改文件：本验收单、完成验收单/索引、QA README、`src/ui/shell.js`、`测试/冒烟测试.mjs`、`测试/项目输入DOM探针.cjs`、`预见PreVision.html`
- reservation：已从 reservation 转换为 active claim（去敏）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:04.16-inspector-rail-scroll-stability
- 状态更新时间 / 原因：claim 已转换；开始已批准的 scoped implementation
- 侧栏去重证据：task id、canonical client/thread 已核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得宣称 Desktop live
- WAITING checkpoint：已完成；已进入 ACTIVE
- turn stop verification：待聚焦提交后的生命周期命令
- 失败补偿：保留 claim；恢复同一 thread
- `task:check` 结果：claim 转换时无 hard conflict；未额外运行
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

修复检查栏快速入口在 rail、peek 和 director-focus 状态切换后滚动位置不稳定的问题，并将项目输入 DOM 探针收敛到可证明的 settled 条件。

## 目标

- 在最终 rail 宽度与 scrollport 几何稳定后，最后一次将目标补滚到可见位置。
- 保留最后意图，且用户 wheel、touch、pointer、键盘滚动取消权不得回归。
- 探针在与产品相同、可证明的完成条件后才冻结，验证目标可见、非底部、2 秒 `scrollTop` 不漂移、48 个样本与 ownership。
- 覆盖 1316、1440、1600 宽度及 rail、peek、expanded、director-focus 矩阵。

## 非目标

- 不改变检查栏以外 UI、持久化数据、应用文案或 CSS 架构。
- 不复用或读取任何取消任务的 WIP。
- 不更新固定 App、GitHub、Pages、发布或执行 `app:deliver`。

## 证据与现状

- 代码：`src/ui/shell.js` 负责 rail、peek 与 director-focus 的检查栏快速入口；完成条件为 right/scrollport/summary/scrollTop 连续 rAF 稳定。
- Git：从精确基线开始；claim 已登记为 ACTIVE/BACKGROUND_ONLY。
- 测试/运行：Node 24 的依赖安装、构建、layout、project-input、app、i18n、impact 和 full 已执行；最终 owner QA 的真实 exit=0 与 12 份外部证据已核对；最终源码门禁在单一长生命周期 shell session 中均为 exit=0。
- 文档/历史线索：已有 QA 入口 `docs/qa/inspector-quick-entry-scroll-stability/README.md`。

## 影响范围

- 模块：layout、repository、testing
- 文件：声明范围内八个文件
- 数据格式：无
- 平台：macOS 开发/Chromium 探针；不涉及固定 App 交付

## 风险

- 风险档：R2
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：待固定 04 组织全新独立 R2 reviewer
- 数据：无 project v5 变化
- UI/交互：滚动竞争可能破坏用户主动滚动的取消权
- 安全：不新增外部输入或权限
- 发布：本任务禁止交付固定 App

## 验收条件

- [x] rail / peek / director-focus 在最终几何稳定后仅做一次目标补滚，且保留 last-intent。
- [x] wheel、touch、pointer、键盘的用户取消权由自动测试保护。
- [x] 探针验证目标可见、非底部、2 秒 scrollTop 不漂移、48 样本与 ownership；不以延长 sleep 或重复碰绿替代完成条件。
- [x] 1316/1440/1600 × rail/peek/expanded/director-focus，覆盖快速连续入口、用户滚轮取消、panel state 保持与目标可见。
- [x] 相关自动测试通过。
- [x] 真实 BrowserWindow owner QA 已完成；12 张项目外 PNG 与 metadata 哈希已核对。
- [ ] 实现者之外的独立只读 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：用户明确禁止 `app:deliver` 与固定 App 更新。
- [x] QA 文档与验收记录已更新。

## 测试计划

- 影响映射模块：main-app、app-test、foundation
- 主应用模块参数：layout
- 最小命令：layout 相关门禁、project-input 连续三次、project-input wrapper、`test:app`、`test:i18n`、impact（基线 + layout）、`test:full`
- 升级到全量的条件：实现或探针断言变化后必跑 `test:full`
- 人工检查尺寸/步骤：1316/1440/1600，rail/peek/expanded/director-focus，快速入口与用户取消
- 固定 App 交付：不适用；用户明确禁止

## 实施记录

- 假设：现有 QA README 与测试可提供可重复的滚动稳定性基线。
- 关键决定：只在已声明的 scrollport 完成条件满足后执行一次补滚。
- 实际修改：新增最小共享几何稳定完成条件与一次最终补滚；探针等待该条件后冻结 48 个样本；烟雾测试覆盖几何重排、wheel 取消和最后意图；owner QA metadata 在桌面矩阵完成后原子写入；普通无证据目录的探针不再尝试写入空 metadata record。
- 中断/恢复：WAITING claim 经同一 canonical worker 恢复为 ACTIVE/BACKGROUND_ONLY。
- app-server 通知消费：后台 turn=started；不是 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node 24） | 通过 | 11s | 安装前后 `package.json`/`package-lock.json` Git blob 未变；未复用其他 Worktree 依赖。 |
| `npm run app:status` | 通过 | — | installed=`b8da5f4…`；current=`3f7514a…`；Contains=yes，Exact=no。 |
| `node scripts/build-app.mjs`（Node 24） | 通过 | 83ms | 最终门禁 session 中已重建声明内 `预见PreVision.html`。 |
| `npm run test:module -- layout` | 通过 | — | 最终门禁 session：148 通过、0 失败；覆盖几何稳定、一次补滚、wheel 取消与最后意图。 |
| `npm run test:project-input` ×3 | 通过 | — | 3×4×4 的真实 Chromium/Electron 矩阵，含 48 样本、wheel/panel ownership。 |
| 最终 owner QA `npm run test:project-input` | 通过 | — | shell session 的真实 exit=0；新目录 12 PNG + metadata + SHA-256 全部核验。 |
| `npm run test:app` / `npm run test:i18n` | 通过 | — | 主应用与国际化门禁。 |
| `npm run test:impact -- --base 3f7514a36c3cc039ed5d35c3c41b7c0a0815c2fd --module layout` | 通过 | — | 最终门禁 session 按基线和 layout 范围执行。 |
| `npm run test:full` | 通过 | — | 最终门禁 session 的真实 exit=0。 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`。

固定 App 人工启动结果：不适用；本任务禁止更新固定 App。

## 未覆盖与后续

- 固定 04 需在实现完成后组织一名全新独立 R2 reviewer。
- 390×844 为非阻断 N/A 观察；不扩移动布局 scope。

## 交接

- 最终提交：待定
- PR：无；本地仓库无 remote，且本任务禁止 push/PR
- reviewer 结论：未评审
- 生命周期交接：目标为 REVIEW（保持 claim）
- 工作区状态：最终门禁已通过；待 scope/diff 审计、聚焦提交、stop verification 与独立 R2。
- 下一步：审计 scope/diff，形成聚焦提交并保持 claim 进入 REVIEW。

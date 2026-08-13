# 任务：机位点高度上限 30m 收口

- 状态：completed
- 日期：2026-07-26
- 对话：02.6c｜机位点高度上限 30m 收口
- 分支：`feat/02.6c-camera-point-height-30m`
- 基线：`c981658745e4a345c5484c35ec731cafd95651ac`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（Node 24 + `npm ci` 后由 `npm run app:status` 实测）
- 负责人：worker:02.6c-camera-point-height-30m

## 并行任务声明

- 任务 ID：`02.6c-camera-point-height-30m`
- 模式：write
- 分管 owner：02
- 模块：camera,i18n,playback,project,testing,timeline,viewport
- UI 表面：inspector,timeline,viewport
- 数据区域：i18n-resources,project-v5,qa-metadata,shot-camera
- 预计修改文件：
  - `app-shell.html`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/plans/active/2026-07-26-camera-point-height-30m.md`
  - `docs/plans/completed/2026-07-26-camera-point-height-30m.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/camera-point-height-30m/README.md`
  - `docs/qa/camera-point-height-30m/electron-1440x900-30m.png`
  - `i18n/locales/en-US.js`
  - `i18n/locales/zh-CN.js`
  - `qa/feature-registry.yaml`
  - `src/core/project-data.js`
  - `src/main.js`
  - `src/stage/runtime.js`
  - `src/ui/inspector.js`
  - `src/ui/timeline.js`
  - `src/viewport/interact.js`
  - `测试/冒烟测试.mjs`
  - `测试/回归/U4_normalize_malformed.mjs`
  - `预见PreVision.html`
- reservation：已预留（reservation id `772c3a73-9523-43f6-b0ea-1847af3295fb`；token 未写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3 revision=`fe503a39-fef6-4df8-a43f-81391d7d747a`；persistence=confirmed（独立 R2 FAIL 后，同一 canonical worker 已由 REVIEW 恢复 ACTIVE）
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.6c-camera-point-height-30m / worker:02.6c-camera-point-height-30m
- 状态更新时间 / 原因：2026-07-26T12:48:02.947Z；独立 R2 发现非有限高度输入副作用 P2，同一 canonical worker 最小返修
- 侧栏去重证据：task id、canonical client id、canonical thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得宣称 DESKTOP_LIVE
- WAITING checkpoint：不适用
- turn stop verification：上一轮证据已随 REVIEW→ACTIVE 作废；本轮完成后重新验证
- 失败补偿：无
- `task:check` 结果：未单独运行；既有 reservation 已由固定 02 原子通过
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用（R2 PASS 前验收单保持 active）
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

把所有新用户编辑产生的摄影机机位点高度统一限制为 0.2–30m，同时保留 v1–v5 项目中既有有限高点的兼容加载语义；完成新基线自动验证和 1440×900 BrowserWindow-owner Electron QA，但不更新固定 App、不发布。

## 目标

- 共享 authoring clamp 覆盖 inspector、新点、preset、当前视图、首尾帧、Alt 拖、对象路径复制和 timeline camera key 粘贴。
- timeline 粘贴 legacy 47m camera key 时仅把新写点夹到 30m，剪贴板/源点不变，非 camera 粘贴不变。
- v1–v5 的 15、29.9、30m 保真；既有有限大于 30m 值加载不静默改写；NaN/Infinity 继续拒绝；normalize 不修改输入对象。
- project v5 不升级；30m 经 stageToData→normalize→load 保持；line/custom 15→30 插值、播放、终点和点预览正确。

## 非目标

- 不改变 storyboard 自动规划原有 15m 限制。
- 不改变演员、道具、Aim/FOV 粘贴语义。
- 不运行 `app:deliver`，不修改 `~/Applications/PreVision.app`。
- 不 push、不创建 PR、不操作 GitHub/Pages、不发布。
- 不修改协调器、registry 语义、锁或校验。

## 证据与现状

- 代码：开工时 HEAD 为精确基线 `c981658745e4a345c5484c35ec731cafd95651ac`。
- Git：开工前 detached HEAD clean；已从精确基线创建任务分支。
- 测试/运行：Node 24.18.0 可用；初次 `app:status` 因依赖未安装失败，必须在 claim 后 `npm ci` 并重跑；协调脚本 blob 为批准值 `aba303e3a946477f6e5e77e953e232f7421a9362`。
- 文档/历史线索：00 明确授权在 claim 后机械承接旧提交 `a9a1aceda0f3082003490ee331f91d9ab861bfb2` 的 30m 语义及旧 Worktree QA/测试证据；必须逐文件审查并明确记录来源。旧截图只作历史佐证，不能代替本轮新 HEAD 证据。

## 影响范围

- 模块：camera,i18n,playback,project,testing,timeline,viewport
- 文件：仅限并行任务声明中的精确清单
- 数据格式：project v5 不升版；只收口用户 authoring 写入范围，加载保留既有有限大于 30m 值
- 平台：本地 macOS Electron 开发与 Node 自动测试

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：gpt-5.6-sol（当前任务元数据可观察）
- 请求 reasoning：XHigh
- 实际 selected reasoning：xhigh（当前任务元数据可观察）
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：固定 02 后续派发的独立 R2 reviewer；实现者不自审
- 数据：必须区分加载兼容与新 authoring 写入，防止静默迁移 legacy 高点
- UI/交互：多入口必须共享同一 clamp；真实 Electron 事件必须覆盖四项可观察行为
- 安全：NaN/Infinity 拒绝与 normalize 输入不可变性不得回归
- 发布：仅本地任务分支，不交付固定 App

## 验收条件

- [x] 所有冻结 authoring 入口统一限制为 0.2–30m。
- [x] legacy camera key 粘贴只夹新点，源/剪贴板仍为原值，非 camera 粘贴行为不变。
- [x] v1–v5 15、29.9、30m 保真，有限 >30m 加载不改写，非有限输入拒绝且输入对象不变。
- [x] project v5 往返与 line/custom 15→30 插值、播放、终点和点预览正确。
- [x] 04.16 inspector rail 稳定性探针继续通过。
- [x] 相关自动测试、显式 full、build 和 `git diff --check` 通过。
- [x] 新 HEAD 的 BrowserWindow-owner Electron 1440×900 四项真实 UI QA 完成并生成新 PNG/记录哈希。
- [x] 文档和功能登记已更新。
- [ ] 实现者之外的独立 R2 reviewer 完成前保持 REVIEW，不交接、不 release。
- [ ] `npm run app:deliver` 不适用：本任务明确禁止固定 App 交付。

## 测试计划

- 影响映射模块：camera,project,playback,timeline,viewport,i18n,foundation
- 主应用模块参数：camera / project / playback / timeline / viewport
- 最小命令：五个 `test:module`；`test:i18n`；`node 测试/回归/U4_normalize_malformed.mjs`
- 升级到全量的条件：本任务跨 camera/project/timeline/viewport 且修改生成主应用，明确运行 `test:app`、`test:project-input`、`test:foundation`、`test:impact`、`test:full` 与 build
- 人工检查尺寸/步骤：BrowserWindow owner；CSS content 1440×900；inspector 30m、Alt 上下界、timeline 47→30 且源不变、15→30 路径播放/终点/点预览
- 固定 App 交付：不适用；不得触碰 `~/Applications/PreVision.app`

## 实施记录

- 假设：旧提交仅作为授权迁移来源，当前基线代码、04.16 rail 实现与新测试证据优先。
- 关键决定：共享 authoring clamp 不用于 normalize/load；测试 expected 使用独立 oracle。
- 实际修改：
  - `src/core/project-data.js` 定义共享 authoring 高度常量/helper；normalize/load 不调用该 helper。
  - inspector、viewport、对象路径复制与 timeline camera key 粘贴入口统一使用共享 clamp；非有限粘贴在写入前原子拒绝。
  - app shell 与中英文 locale 同步 30m UI 上限/文案，根 HTML 仅由 `npm run build` 生成。
  - 独立 oracle 覆盖全部冻结入口、legacy/source 不变、v1–v5 保真、输入不可变与 15→30 播放/预览。
  - 更新 CAM-006 文档/机器登记，并生成本轮新 BrowserWindow QA PNG。
- 独立 R2 返修：
  - 第一轮三路独立 R2 中测试与视觉 reviewer PASS；代码/数据 reviewer 发现一个 P2：inspector `camPtY` 对 NaN/Infinity/-Infinity 虽保留 legacy 47m，却仍登记 preview edit 并调用 `markDirty()`，不能满足项目/history/autosave 原子零写入。
  - 使用同一 canonical thread/client 和既有 claim 执行受信 REVIEW→ACTIVE；旧 review/stop evidence 已失效，没有新建 reservation、任务或 claim。
  - 回归先在旧实现稳定红 6 项，再把非有限解析/拒绝移到任何 preview/history/autosave 副作用之前。测试覆盖 legacy 47m × 三种非有限值 × Auto Key 开/关，并逐项比较 camPts、stage/project 序列化、preview pending/auto transaction、undo/history、dirty timer、autosave/localStorage 写次数与 `project.modified`。
  - 根 HTML 重新生成后旧 `e1476d…` HTML / `994064…` PNG 仅保留为上一轮历史证据；本轮重新执行 BrowserWindow-owner QA 并绑定新哈希。
- 迁移审查：claim 后从授权提交 `a9a1aceda0f3082003490ee331f91d9ab861bfb2` 执行 `cherry-pick -n`；唯一 add/add 冲突是 active 验收单，保留 02.6c 新基线版本。逐文件复核后确认未覆盖 `9904b46` / `2270368` / `c981658` 的 04.16 rail 实现与断言。授权所述旧 Worktree 已不存在，本轮未从其复制任何文件或截图。
- 中断/恢复：第一轮独立 R2 FAIL 后按治理恢复同一 canonical worker；未创建副本，旧 stop/review evidence 已失效。
- app-server 通知消费：当前任务由 Codex Desktop 启动；按治理要求登记 BACKGROUND_ONLY，不以侧栏条目冒充 Desktop live。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（Node 24，依赖安装前） | BLOCKED | <1s | 缺少 `@electron/asar`；claim 后 `npm ci` 再重跑 |
| `npm run task:status`（Node 24） | 已执行；CLI stdout 未形成可判读状态 | 约 25s | 另行只读检查 common-dir registry，确认 schema v3、既有 reservation、精确 scope 与 revision |
| `npm run task:claim -- --reservation …`（Node 24） | PASS | 约 52s | 默认运行命中 `spawnSync git ENOBUFS`；核验批准 blob 后用一次性非落盘 64MiB wrapper 成功，权威状态 ACTIVE/BACKGROUND_ONLY |
| `npm ci`（Node 24.18.0） | PASS | 11s | 按 `package-lock.json` 安装 506 个依赖；未执行 audit fix |
| `npm run app:status`（Node 24，依赖安装后） | PASS | <1s | installed source `b8da5f4…`；current `c981658…`；contains=yes，exact=no |
| `npm run build`（迁移后） | PASS | <1s | 初次生成 HTML 1,214,844 bytes；最终 helper 收紧后重新构建 |
| P2 回归（修复前） | FAIL（预期红） | 约 30s | legacy 47m × NaN/Infinity/-Infinity × Auto Key 开/关共 6 项均捕获 preview/history/autosave 副作用 |
| `npm run test:module -- camera`（P2 修复后） | PASS | 约 30s | 106 通过，0 失败；六种组合逐项确认项目/预览/history/autosave 原子零写入 |
| `npm run test:module -- project` | PASS | <1s | 113 通过，0 失败 |
| `npm run test:module -- playback` | PASS | <1s | 35 通过，0 失败 |
| `npm run test:module -- timeline` | PASS | <1s | 130 通过，0 失败 |
| `npm run test:module -- viewport` | PASS | <1s | 31 通过，0 失败 |
| `node 测试/回归/U4_normalize_malformed.mjs` | PASS | <1s | 23 个用例、53 个断言 |
| `npm run test:i18n` | PASS | <1s | 217 通过，0 失败 |
| `npm run test:app` | PASS | 约 50s | 1031 通过，0 失败 |
| `npm run test:project-input` | PASS | 约 21s | 1316×768、1440×900、1600×900 × 四种 rail 模式；48 个 quick-entry 样本稳定 |
| `npm run test:foundation`（实现后） | PASS | 约 5s | foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11 |
| `npm run test:impact -- --base c981658… --module camera` | PASS | P2 返修轮 209.03s | 未知映射文件触发 full 升级；含 04.16 rail 全部样本 |
| `npm run test:full`（显式） | PASS | P2 返修轮约 210s | 独立显式运行；非复用 impact 内部 full |
| BrowserWindow-owner Electron QA（P2 新 HEAD） | PASS | 约 3s | owner PID 39891；URL/title/bounds 精确绑定；CSS 1440×900、DPR 2；四项真实 UI 事件通过 |
| 原始 / 发布 PNG（P2 新 HEAD） | PASS | — | raw 2880×1800 / SHA-256 `423b10…27300`；发布 1440×900 / SHA-256 `1a9fa0…d13b32`；Electron nativeImage best resize，无裁切 |
| `npm run test:foundation`（文档/证据最终态） | PASS | 约 69s | 显式最终运行；foundation 151、C8 11、coordination 553、i18n 217、project-input wrapper 11 |
| `npm run build`（P2 新 HEAD） | PASS | 80ms | 生成物 1,214,924 bytes；SHA-256 `49001547fb23c0ae8f8834b7470b29434e90b905d3e4be87102d71926057a156` |
| `git diff --check` / `git diff --cached --check` | PASS | <1s | 无空白错误 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用，本任务禁止更新/启动交付固定 App

## 未覆盖与后续

- 第一轮独立 R2 总结为 FAIL（一个 P2，已最小返修）；固定 02 将在本轮回到 REVIEW 后派发全新独立 R2，本临时工不自审。
- 00 机械集成、最终回归、release/归档及任何固定 App 交付均不属于本任务。

## 交接

- 最终提交：初始化提交 `9b68239`、首轮实现提交 `5a2c974`；P2 最小返修另作聚焦提交，精确对象以 `baseline..HEAD` 有序链为权威
- PR：无
- reviewer 结论：第一轮独立 R2 总结 FAIL（测试/视觉 PASS，代码/数据一个 P2）；P2 已返修，等待全新独立 R2
- 生命周期交接：完成后仅转 REVIEW（保持 claim）
- 工作区状态：P2 最小返修、全套自动测试与新 HEAD BrowserWindow QA 已完成；验收单在新 R2 PASS 前按治理要求保持 active 路径
- 下一步：聚焦返修提交、`task:verify-stop` 后以精确有序提交链转 REVIEW；保持 claim 并通知固定 02 派发全新独立 R2。

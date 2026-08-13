# 任务：项目打开事务隔离与不可信输入安全

- 状态：completed（独立任务级验收完成，等待 `00` 集成；claim 保留）
- 日期：2026-07-16
- 对话：侧栏可见独立短期开发任务 `01.3｜项目打开隔离与不可信输入安全`
- 分支：`fix/project-open-isolation-visible`
- 基线：`34c0d407f05f7dd8437a421dd98b03ddbcbdc305`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex 独立短期临时工

## 并行任务声明

- 任务 ID：`01.3-project-open-isolation`
- 模式：write
- 模块：`project,history,actor,camera,timeline,background,layout,viewport,robustness,desktop,testing,i18n`
- UI 表面：`app-shell,topbar,left-rail,viewport,timeline,monitor,inspector,dialogs`
- 数据区域：`project-v5,autosave,shot-camera,object-paths,actor-rig,scene-template,electron-ipc,qa-metadata,i18n-resources`
- 预计修改文件：`预见PreVision.html`、双语语言包、`测试/冒烟测试.mjs`、可选独立项目输入安全测试与 `package.json`、`qa/test-impact-map.yaml`、本验收单、必要的项目/架构/功能登记文档
- `task:check` 结果：2026-07-16 在当前分支重新检查，无硬冲突
- `task:claim`：已用当前分支和同一 task ID 重新登记
- `task:release`：保留至 `00` 成功集成或确认取消

## 用户问题

不可信或损坏的项目数据可能通过动态 DOM 字符串执行标记/事件，也可能在完整验证失败前部分改写当前工作区，并被已有自动保存计时器写回。需要先收口最小 P0 安全边界，再继续普通业务功能。

## 目标

- 所有 project/storyboard 派生动态文本以 DOM 属性、`textContent` 或 `value` 写入；类似 HTML 的名称只按文本显示。
- 建立纯 `normalizeProjectData`，完整遍历所有场景并返回全新的 project v5 白名单对象；兼容无版本与 v1–v5，拒绝非法版本和未来版本。
- startup、浏览器打开、Electron renderer 打开共用同一归一化边界。
- 项目打开采用两阶段事务：归一化与资源预检成功前零运行时写入，提交意外失败时恢复原工作区；失败不触发 autosave，不清空 03.5 瞬时预览。
- 危险 map key 不得污染原型；未知 `semanticType` 仍作为普通未知值安全往返并走已有视觉降级。
- 增加执行级 corpus/回归，覆盖 DOM probe、全场景验证、引用 sanity、计时器隔离、失败快照与成功打开。

## 非目标

- 不增加文件/图片/像素/复杂度 hard cap，不制定远程资源策略或 Electron stat-before-read。
- 不调整 Storyboard 性能阈值、Quota 分类、CSP、脚本外置、Electron sandbox 或 Three.js 资源释放。
- 不增加 project v6，不持久化 03.5 preview sidecar，不实现 facingOffset、背景删除或媒体导出重排。
- 不拆分单体架构，不公开部署，不交付固定 App，也不更新稳定预览。

## 证据与现状

- 代码：项目入口与绝大多数业务状态集中在 `预见PreVision.html`；当前输入门禁只覆盖最小启动结构，部分动态列表仍使用 `innerHTML`。
- Git：分支从总协调精确基线 `34c0d40` 创建，工作树起始干净。
- 测试/运行：Node `24.18.0`；`app:status` 确认当前基线包含固定 App 来源；开工时无 active claim。
- 文档/历史线索：`docs/ARCHITECTURE.md` 明确说明 `isRestorableProject()` 不等于完整不可信输入安全层。

## 影响范围

- 模块：项目加载/自动保存/历史、演员与摄影机引用、时间轴、背景、布局/视口、桌面打开桥接、鲁棒性与测试。
- 文件：以并行任务声明为上限，实际提交按最小实现收敛。
- 数据格式：不升级版本；输入被归一化为全新的 v5 白名单对象，未知合法业务值按兼容约定保留。
- 平台：Web 与 macOS Electron renderer 共用输入边界。

## 风险

- 数据：过严归一化可能拒绝旧项目；过松可能保留执行载荷、非有限数值或悬挂引用。
- UI/交互：事务回滚必须恢复选择、时间、播放、Three/UI 和 03.5 瞬时预览，不得出现“失败但部分打开”。
- 安全：测试必须真实执行 DOM sink 行为，不能仅依赖不解析 HTML 的假 DOM。
- 发布：本轮仅快速集成预览前置安全修复，不更新固定 App。

## 验收条件

- [x] HTML-looking 名称在所有相关列表/选择器只产生文本，不创建额外节点或触发事件。
- [x] `normalizeProjectData` 对无版本/v1–v5 输出全新 v5，对 v6+、非整数、零/负版本和所有场景中的错类型/非有限值拒绝。
- [x] 重复、悬挂、自引用与循环引用按明确规则安全处理；危险 key 不污染原型，未知 `semanticType` 安全往返与降级。
- [x] startup、浏览器打开和 Electron renderer 打开共用归一化；归一化/预检失败和提交异常均保持输入前快照与 autosave 写次数。
- [x] pending dirty timer 后非法打开超过 800ms 仍不因该输入写入 autosave；成功打开成为活动项目并按既有语义 autosave。
- [x] 相关模块、i18n、desktop、web、foundation、impact 与 `test:full` 在 Node 24 通过。
- [x] 隔离 Web 与 Electron 完成无害 DOM probe。
- [x] 固定 App 交付不适用：临时工未运行 `app:deliver`，由 `00` 集成与决定后续交付。
- [x] 文档和功能登记已按实际行为更新。

## 测试计划

- 影响映射模块：`project,history,actor,camera,timeline,background,layout,viewport,robustness`
- 主应用模块参数：逐项运行上述模块，并执行完整应用测试。
- 最小命令：项目输入安全 corpus、相关模块、`npm run test:i18n`、`npm run test:desktop`、`npm run test:web`、`npm run test:foundation`。
- 升级到全量的条件：本任务为 P0 且跨模块/数据边界，必须运行 `npm run test:impact -- --base 34c0d40` 与 `npm run test:full`。
- 人工检查尺寸/步骤：隔离 Web 与隔离 Electron 导入无害 markup label，确认仅文本展示、无事件副作用；非法文件失败后当前项目、选择、预览和 autosave 不变。
- 固定 App 交付：不适用；禁止临时工更新 `~/Applications/PreVision.app`。

## 实施记录

- 假设：现有 v1–v5 数据均可通过白名单迁移至 v5；当前版本仍为 5。
- 关键决定：使用新对象白名单归一化、Map/null-prototype 容器和两阶段项目打开；Quota-lite autosave 的 dangling 图片引用采用确定性视觉降级，不拒绝整份项目。
- 实际修改：保留并审查 checkpoint 的纯 `normalizeProjectData`、安全 DOM 写入和事务快照/回滚；补齐 pending dirty timer、commit fault、成功 commit/autosave corpus；新增真实 Chromium Web 与带实际 preload 的 Electron renderer DOM probe，并接入 impact/full；同步架构与功能登记。
- 迁移结果：侧栏可见独立短期任务从 `b9dbb65` 恢复并完成，不把 WIP checkpoint 单独作为交付成果。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status`（Node 24.18.0） | 通过 | <1s | installed `7ff9aa5`；current `34c0d40`；contains=yes |
| `npm run task:status` | 通过 | <1s | 开工前无 active claim |
| `npm run test:module -- project`（Node 24.18.0） | 通过 | 10s | WIP 阶段 71/71；尚未包含完整事务 fault/800ms corpus |
| `npm run test:core`（Node 24.18.0） | 通过 | 1s | 暂停前 19/19，证明脚本可加载与 boot |
| `git diff --check` | 通过 | <1s | 暂停前无空白错误 |
| 10 个相关模块（project/history/actor/camera/timeline/background/layout/viewport/robustness/storyboard） | 通过 | 约 2m | project 80/80；其余模块全部 0 失败 |
| `npm run test:project-input`（Node 24.18.0） | 通过 | <2s | 真实 Chromium Web/Electron renderer，各 3 个动态表面；无节点/事件执行 |
| `npm run test:i18n` / `test:desktop` / `test:web` / `test:foundation` | 通过 | <5s | 21 / 43 / 23 / 134 项通过 |
| `npm run test:impact -- --base 34c0d40` | 通过 | 约 38s | app 731、desktop、foundation、DOM probe、web 全部通过 |
| `npm run test:full` | 通过 | 约 35s | app 731、DOM probe、Web 23、desktop 43、local install 49、foundation 134 全部通过 |
| `git diff --check` | 通过 | <1s | 完成阶段无空白错误 |
| 复审后 `project` / `layout` / `camera` | 通过 | 约 30s | 103 / 121 / 80 项通过 |
| 复审后 `npm run test:project-input` | 通过 | <2s | startup + Web FileReader + Electron IPC；project/storyboard sink sentinel 通过 |
| 复审后 `npm run test:impact -- --base 34c0d40` | 通过 | 约 32s | app 754、desktop、foundation+launcher、DOM probe、web 全部通过 |
| 复审后 `npm run test:full` | 通过 | 约 32s | app 754、DOM probe、Web 23、desktop 43、local install 49、foundation+launcher 全部通过 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：本轮不交付、不启动；真实 DOM 检查使用隔离 Electron BrowserWindow 与独立 session partition，不触碰固定 App/profile。

## 未覆盖与后续

- hard caps、资源 URL/图片解码策略、CSP/sandbox、Three.js 生命周期和存储配额语义分别留给后续独立任务。
- 未覆盖项均属于明确非目标：hard caps、图片 magic/远程资源、CSP/sandbox、Three 资源释放、媒体、facingOffset、背景删除和 project v6。

## 00 集成复审追加修复

- 保留首个完成提交 `3d5db5d`，不改写历史；本节变更形成独立第二提交。
- 旧项目兼容：无版本/v1–v5 的有限 path/camera times、ease、partial camAim 与 timeLinkShot 错配按旧运行态语义修复；越界 timeLinkShot 降级为 dormant `independent`，不会夹到别的镜头后意外激活。错类型、非有限值和非法引用仍拒绝。3 点非等距 corpus 明确区分 valid-length overflow→uniform 与 invalid-length→camTimes fallback；极值有限坐标的距离溢出回退 index 均分，场景总时长溢出拒绝。
- 比例运行态：成功打开和 commit fault rollback 均调度 resize；断言覆盖 renderer、shotCam、PIP、画幅缓存及 `resLabel` 恢复。
- 真实入口：隔离 Chromium 分别由 startup localStorage、Web FileReader、Electron preload/IPC 驱动统一归一化，并覆盖 project/storyboard 动态文本 sink；execution/error/dialog sentinel 在每个入口前安装。
- 跨平台 CI：`test:project-input` 改由 Node wrapper 启动；Linux 无 `DISPLAY` 时强制 `xvfb-run -a`，缺失会明确失败；Windows 直接执行 Electron `dist/electron.exe`；GitHub Actions 显式安装 Xvfb。launcher 11 项命令构造断言覆盖 Linux headless/DISPLAY、Windows 与 Darwin；真实 probe 总截止 90 秒、单入口轮询 10 秒，慢 CI 有界失败且不跳过。
- 影响映射：主 HTML 与 probe/wrapper 文件变化都会运行 `test:project-input`。

## 交接

- 最终提交：由本验收单归档后的 clean commit 承载，提交哈希在交接消息中提供
- PR：无（仓库没有 remote）
- 工作区状态：最终提交后保持干净；claim 保留给 `00` 集成成功后 release
- 下一步：`00` 审查并机械集成本任务最终提交；本任务不继续下一项工作。

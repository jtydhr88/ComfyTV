# 任务：01.13｜Web 保存项目失败结算

- 状态：completed（独立任务级实现与验证完成，claim 保留等待 00 集成）
- 日期：2026-07-16
- 对话：用户侧栏可见独立短期 Bug 临时工 `01.13｜Web 保存项目失败结算`
- 分支：`fix/01.13-web-project-save-settlement`
- 基线：`e3826edd1907a7be155a030d186a577ce1bbc0fb`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex 独立短期临时工
- 风险路由：R2；GPT-5.6-Sol / high / Flex 标准速度，Fast、Max、Ultra 关闭。此项仅为调度元数据，不作为业务验收证据。

## 并行任务声明

- 任务 ID：`01.13-web-project-save-settlement`
- 模式：write
- 模块：`project,i18n`
- UI 表面：`topbar`
- 数据区域：`i18n-resources`
- 预计修改文件：
  - `预见PreVision.html`
  - `测试/冒烟测试.mjs`
  - `测试/项目输入DOM探针.cjs`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `docs/plans/active/2026-07-16-web-project-save-settlement.md`
  - `docs/plans/completed/2026-07-16-web-project-save-settlement.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/web-project-save-settlement/README.md`
- `task:check` 结果：无硬冲突；与 03.11 仅在主 HTML、两份测试和 completed 索引存在文件软冲突，固定集成顺序为 01.13 先、03.11 后
- `task:claim`：已登记
- `task:release`：未释放；由 00 集成成功或确认取消后释放

## 用户问题

Web 分支调用 `dl()` 后未等待 Promise，随即无条件显示“项目文件已保存到本地”。当浏览器下载链路在 URL、DOM 或点击阶段失败时，界面仍误报成功，并可能产生未处理 Promise。

## 目标

- Web 项目保存只有在 `dl()` Promise 真正 resolve 后显示本地化成功终态。
- Web 保存失败只显示一次明确、本地化的失败终态，不先显示或同时保留成功反馈。
- 覆盖 `createObjectURL`、append、click、remove/revoke 和底层 typed reject 的合理失败边界；失败后可立即重试并成功。
- 保持 Electron bridge 的成功、取消、错误语义不变。
- 保持项目文件内容、文件名、project v5、IPC 和保存位置不变。

## 非目标

- 不修改项目打开、自动保存、历史、project v5、Electron IPC、系统保存位置或文件命名规则。
- 不处理其他导出、录屏、剪贴板或项目打开问题。
- 不改变 scene/shot、selection、history 或 autosave。
- 不拆分单体应用，不更新稳定预览或公网部署。
- 不运行 `app:deliver`、`app:update`、`package`、`make`，不更新固定 App，不关闭正式 PreVision App。

## 证据与现状

- 代码：`saveProjectFile()` 的 Web 分支调用 `dl(...)` 后立即写入内联中文成功状态；`dl()` 为 async，append/click/底层失败会 typed reject，并负责 URL/anchor 清理。
- Git：工作区起始 clean，HEAD 精确为 `e3826edd1907a7be155a030d186a577ce1bbc0fb`，分支和 Worktree 符合任务指定。
- 测试/运行：Node `v24.14.0`；`app:status` 显示 installed source `7ff9aa5`、contains yes、exact no；`task:status` 仅有 03.11 活动 claim。
- 文档/历史线索：03.10 已保证唯一 `#saveState` 在目标尺寸可见；01.12 已建立 autosave 末次结算，本任务不得改变该链路。

## 影响范围

- 模块：project、i18n。
- 文件：仅限并行任务声明中的文件。
- 数据格式：无；保持 project v5 和现有 JSON 内容。
- 平台：Web Chrome 下载回退；Electron renderer 仅做语义不回归验证。

## 风险

- 数据：保存前现有 `syncScene()` / `gcAssets()` 行为保持不变，失败结算不得额外写 autosave 或改变项目状态。
- UI/交互：异步失败可能造成成功与失败状态竞态，或产生未处理 rejection。
- 安全：测试和证据只能使用合成项目、隔离 origin/userData 和去敏路径。
- 发布：仅快速开发与任务级验证，固定 App 保持原来源，不执行正式交付。

## 验收条件

- [x] Web 仅在 `dl()` resolve 后显示成功；失败只显示一次本地化失败终态，绝不先后或同时出现成功。
- [x] `createObjectURL`、append、click、remove/revoke 与底层 typed reject 均无 uncaught/unhandledrejection；失败后可立即重试成功。
- [x] URL/DOM 临时资源按既有契约清理，不吞掉失败或伪造 resolve。
- [x] Electron save ok/cancel/error 保持原语义，取消无成功或失败反馈。
- [x] 保存结算不额外改变 project、scene/shot、selection、history、autosave 或文件内容/文件名。
- [x] 触及的项目保存成功/失败状态已迁移到双语 language key，无新增运行时直写中文。
- [x] 修复前失败的执行级 onclick/Promise 回归先建立，再完成最小实现。
- [x] project、i18n、project-input、impact、full 与静态检查通过。
- [x] 真 Chrome 隔离 origin 和 Electron 隔离 userData 验证完成，控制台 0 error/unhandled。
- [x] 固定 App 未更新；临时工未执行任何交付、打包或安装命令。
- [x] QA 证据与 completed 索引已更新。

## 测试计划

- 影响映射模块：project、i18n。
- 主应用模块参数：project。
- 最小命令：`npm run test:module -- project`、`npm run test:i18n`、`npm run test:project-input`。
- 升级到全量的条件：本任务修改主 HTML、共享冒烟测试、真实 Chromium probe 和 i18n，固定执行 `npm run test:impact -- --base e3826edd1907a7be155a030d186a577ce1bbc0fb --module project` 与 `npm run test:full`。
- 人工检查尺寸/步骤：真 Chrome 使用隔离临时 origin/profile，分别验证允许下载与注入失败、实际文件、失败反馈、立即重试和控制台；Electron 使用隔离 userData 验证 save ok/cancel/error，不连接正式数据。
- GUI 串行与共享锁：`test:project-input`、包含它的 `test:impact`、`test:full` 及其他真实 Electron 命令串行执行；每次启动前原子 `mkdir /tmp/prevision-electron-gui-test.lock`，结束或异常均释放。锁超过 30 分钟且确认无测试 Electron 进程时才可清理。
- 固定 App 交付：不适用；本轮禁止更新 `~/Applications/PreVision.app`。

## 实施记录

- 假设：浏览器下载的同步 click 完成仍以现有 `dl()` resolve 作为可观察成功边界；浏览器本身后续取消下载不在页面可知范围内。
- 关键决定：Web 分支构造 Blob URL，并直接 `await` 现有 `dl()`；不改变 `dl()` 的 typed reject 和延迟 cleanup 契约。Electron 继续走原 bridge，仅把历史内联成功/失败文案迁移为 language key。
- 实际修改：`saveProjectFile()` 增加可测试依赖参数，Web 在 Promise resolve 后写成功、reject 后写唯一失败终态并返回 false；Electron ok/cancel/error 分别返回 true/false，同时保持原状态/alert 语义。双语资源新增三个 project key；VM 和真实 DOM probe 覆盖失败边界、重试、资源清理、状态不变量及 Electron 实际 IPC。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci --cache /tmp/prevision-npm-cache`（Node 24.14.0） | 通过 | 约 1m | 恢复锁定依赖；未使用本机 root-owned npm cache |
| `npm run app:status`（Node 24.14.0） | 通过 | <1s | installed `7ff9aa5`；current `e3826ed`；contains yes、exact no |
| `npm run task:status`（Node 24.14.0） | 通过 | <1s | 仅 03.11 活动 claim；逻辑范围零重叠 |
| `npm run task:check -- ...`（原声明范围） | 通过 | <1s | 无硬冲突；与 03.11 有四个文件软冲突，01.13 先集成 |
| `npm run task:claim -- ...`（同一范围） | 通过 | <1s | claim 已登记并保留至 00 集成成功 |
| 回归先行 `npm run test:module -- project` | 预期失败 | 约 14s | 108/2；执行级 onclick/Promise 断言证明 append 失败仍误报成功并产生 unhandled rejection，且本地化失败终态契约尚未满足 |
| `npm run test:module -- project` | 通过 | 约 14s | 112/0；含 createObjectURL、DOM、click、cleanup warning、typed reject、重试及状态不变量 |
| `npm run test:i18n` | 通过 | <1s | 21/0；双语 key 对齐和运行时中文守卫通过 |
| `npm run test:project-input` | 通过 | 约 8s | 共享锁下串行；真实 Chromium Web 与 Electron preload/IPC save ok/cancel/error 均通过 |
| 真 Google Chrome 隔离 origin/profile | 通过 | 约 4s | 允许下载与 append 注入失败后立即重试均验证；2 个实际下载文件可解析为 project v5，0 console/runtime error/unhandled |
| `node --check 测试/项目输入DOM探针.cjs` | 通过 | <1s | 探针语法有效 |
| `npm run test:desktop` | 通过 | <1s | 47/0；Electron 桥接结构与语法保持 |
| `npm run test:full` | 通过 | 约 35s | app 936、project-input、Web 24、desktop 47、local install 49、foundation 156，全部 0 失败 |
| `npm run test:impact -- --base e3826ed... --module project` | 通过 | 约 40s | 最终源码命中 app/foundation/project-input/web，全部通过 |
| 归档后 `npm run test:foundation` | 通过 | 约 1s | 93+31+21+11，文档、claim 治理、i18n 与 probe launcher 全通过 |
| `git diff --check` | 通过 | <1s | 当前实现无空白错误 |
| 敏感信息、绝对路径与意外文件检查 | 通过 | <1s | 无凭据、用户路径、构建产物或范围外文件 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：本轮禁止连接、关闭或更新固定 App。

## 未覆盖与后续

- 页面无法获知 `dl()` resolve 后由浏览器或用户取消下载的结果；本任务沿用既有“click 已成功启动”结算边界。
- click 成功后的 remove/revoke 异常仍按既有契约作为 cleanup warning，不反转已经成功启动的下载。

## 交接

- 最终提交：由本验收单归档后的单一聚焦提交承载，精确哈希见交接消息
- PR：无（仓库无 remote）
- 工作区状态：提交后保持 clean
- 下一步：00 按 01.13 先、03.11 后的顺序机械集成；集成成功后由 00 release claim。本任务不更新固定 App。

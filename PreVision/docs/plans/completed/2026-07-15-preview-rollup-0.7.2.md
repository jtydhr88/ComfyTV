# 任务：近期已完成预览统一收口为 0.7.2

- 状态：completed
- 日期：2026-07-15
- 对话：00｜项目总协调与集成交付｜0.7.x
- 分支：`chore/preview-rollup-0.7.2`
- 基线：`3cc2aad`（已集成 02.2 与透明图标母版）
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（0.7.2）
- 负责人：00 总协调

## 并行任务声明

- 任务 ID：`00.preview-rollup-0.7.2`
- 模式：write
- 模块：`release,repository,testing`
- UI 表面：`app-shell`
- 数据区域：`build-provenance,local-install,qa-metadata`
- 预计修改文件：`package.json`、`package-lock.json`、`CHANGELOG.md`、`README.md`、`docs/CURRENT_STATE.md`、`docs/FEATURES.md`、`docs/FEATURE_REGISTRY.md`、`docs/KNOWN_ISSUES.md`、`docs/plans/active/2026-07-15-preview-rollup-0.7.2.md`、`docs/plans/completed/2026-07-15-preview-rollup-0.7.2.md`、相关已完成验收单、`docs/plans/completed/README.md`、`qa/feature-registry.yaml`、`测试/冒烟测试.mjs`
- `task:check` 结果：无硬冲突；02.2 已先完成集成回归并释放，当前无其他 active claim
- `task:claim`：已登记
- `task:release`：首次归档提交后已释放；发现来源表述需区分运行时提交与 docs-only HEAD 后临时复领，修正提交后再次释放

## 用户问题

把所有已完成但尚未进入固定 App 的预览成果统一更新到最新 App，同步递增版本号并报告版本。

## 目标

- 以当前安全集成基线统一交付截图/录屏保存位置、离线分镜规划器 v2、语义代理模型库 MVP。
- 纳入已完成且干净的透明图标母版仓库成果，但不谎称它已替换运行时图标。
- 将产品版本从 0.7.1 patch 递增到 0.7.2，并同步包元数据、更新日志和当前事实文档。
- 在 Node 20–24 下完成影响测试、全量回归和 `app:deliver`，从唯一固定入口人工确认。

## 非目标

- 不纳入仍为脏工作区、未提交或未验收的缩略图、欢迎场景、摄影机、马鞍/骑姿等遗留实验。
- 不纳入仍等待用户选型且未接入正式入口的 Web 首页四套方向。
- 不制作 ZIP/DMG，不建立公开 Release，不宣称 Developer ID 签名或公证。
- 不调用 Seedance 或其他付费服务；外部模型多镜头一致性仍需用户后续实机验证。

## 证据与现状

- 代码：根集成基线已含 `83b17ea` 截图/录屏保存位置、`6441682` 离线分镜规划器、`1734270` 语义代理模型库和 `3cc2aad` 透明图标母版。
- Git：分支为 `chore/preview-rollup-0.7.2`；运行时交付提交为 `7ff9aa5`，验收归档只再更新文档与 QA 状态。
- 测试/运行：Node 24 正式 `app:deliver` 的全量门禁通过（App 562、Desktop 43、local-install 36、delivery gate 13、Foundation 66、coordination 20、i18n 21），固定 App 已自动启动。
- 文档/运行事实：固定 App 为 0.7.2，来源 `7ff9aa5`；Info.plist 版本/构建号、ad-hoc codesign 和普通启动均已复核。

## 影响范围

- 模块：版本发布、仓库事实、测试与固定 App 交付。
- 文件：仅并行声明列出的发布元数据、文档、QA 登记和验收单。
- 数据格式：项目数据仍为 v5，不迁移用户项目。
- 平台：macOS Apple Silicon 本机固定 App。

## 风险

- 数据：语义代理增加 project v5 可选字段，必须保留旧项目和未知类型兼容测试证据。
- UI/交互：长剧本窗口、语义代理 inspector 和顶部捕获入口需从固定 App 复核可用。
- 安全：交付必须保留一次性捕获授权、来源谱系和固定路径安装门禁。
- 发布：未完成正式 Apple 签名/公证，只是本机预览版更新。
- 测试：主应用夹具原先继承系统随机数，环境件随机落位会让同一提交在“固定布景”或沙丘骑乘断言上偶发不同结果；交付门禁必须先固定夹具随机种子，且不得改变运行时随机放置或业务语义。

## 验收条件

- [x] 所有已完成、干净且有验收证据的未发布成果已进入统一分支；未完成实验明确排除。
- [x] `package.json`、`package-lock.json`、App Info.plist 与文档版本一致为 0.7.2。
- [x] `test:impact`、`test:i18n`、`test:full` 与交付门禁全部通过。
- [x] 主应用 smoke fixture 使用可复现随机序列，同一 actor 场景连续独立运行不再随机换失败点。
- [x] 工作区在运行时交付提交时干净，提交不含构建产物、私人路径或未验收实验；最终归档仅含本单声明的文档/QA 更新。
- [x] `npm run app:deliver` 成功；交付后 `app:status` 显示 installed/current source 精确一致为 `7ff9aa5`。
- [x] 从 `~/Applications/PreVision.app` 人工确认版本和本轮三个用户可见成果入口。
- [x] 相关验收单、当前状态、功能登记、已知限制和更新日志已同步。

## 测试计划

- 影响映射模块：build-config、foundation、app-test、main-app、electron、local-install。
- 主应用模块参数：无；本轮跨模块统一交付。
- 最小命令：`npm run test:impact -- --base 0b5f851a3d5ddfa7226e5686f0f0e771c4f2a026`、`npm run test:i18n`。
- 升级到全量的条件：本任务属于跨模块正式交付，强制运行 `npm run test:full`；`app:deliver` 内再次执行完整门禁。
- 人工检查尺寸/步骤：从固定 App 打开顶部截图入口、剧本分镜规划器缩放/全屏、语义代理新增/类型/尺寸入口；核对 App 版本 0.7.2。
- 固定 App 交付：需要；目标路径固定为 `~/Applications/PreVision.app`。

## 实施记录

- 假设：“所有未发布预览”指已完成、干净且有验收证据的成果，不包含等待选型或未提交实验。
- 关键决定：使用 patch 版本规则升级到 0.7.2；不提升 Seedance 实机一致性的验证状态。
- 实际修改：精确集成 02.2 与透明图标母版；版本 patch 递增到 0.7.2；同步更新日志、README、当前状态、功能说明/登记和三项业务验收记录；在首次正式交付被随机环境断言安全拦截后，只为 Node smoke VM 注入固定伪随机序列，不改变 App 运行时随机放置或业务逻辑。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status` | 通过 | <1s | 初始固定 App 为 0.7.1，来源 `de0c6ac`；集成基线包含该来源。 |
| `task:status` / `task:check` / `task:claim` | 通过 | <1s | 02.2 先集成并释放；0.7.2 收口声明无硬冲突。 |
| 精确集成 `bacbabe` / `bd14ad6` | 通过 | <1s | 生成 `1734270` / `3cc2aad`；未合并旧分支或其未提交实验。 |
| 集成后 Node 24 `npm run test:full` | 通过 | 约 20s | App 562、Desktop 43、local-install 36、delivery gate 13、Foundation 66、coordination 20、i18n 21。 |
| Node 24 `npm version patch --no-git-tag-version` | 通过 | <1s | `package.json` 与 lockfile 从 0.7.1 同步递增为 0.7.2。 |
| `npm run test:impact -- --base 0b5f851...` | 通过 | 24.59s | 25 个变化文件；命中 foundation/build-config/i18n/app/main-app，因 CHANGELOG 未识别自动升级并通过 `test:full`。 |
| `npm run test:i18n` | 通过 | <1s | 21 通过，0 失败。 |
| `git diff --check` / QA JSON 解析 | 通过 | <1s | 无空白错误；package、lockfile、功能登记和语义目录 JSON 可解析。 |
| 首次 Node 24 `npm run app:deliver` | 安全停止 | 约 16s | `test:full` 的 App 结果 561/562，“路径转向与程序化步态更新后”断言偶发失败；构建、安装与启动均未执行，固定 App 保持 0.7.1 / `de0c6ac`。 |
| 未固定夹具的 actor 独立复跑 ×3 | 发现非确定性 | 约 8s | 同一提交得到通过、另一个“固定布景”断言失败、通过三种结果，证明失败点随随机环境落位变化。 |
| 注入固定序列的 actor 诊断 ×5 | 通过 | 约 10s | 5 个独立进程均为 119/119；据此仅固定 smoke VM 的 `Math.random`。 |
| 修正后 `npm run test:module -- actor` ×5 | 通过 | 6.4s | 5 个独立进程均为 119/119，运行时 App 代码未改。 |
| 修正后 `npm run test:impact -- --base e730edc...` | 通过 | 约 16s | App 562、Foundation 66、coordination 20、i18n 21，全部 0 失败。 |
| 修正后 Node 24 `npm run test:full` | 通过 | 14.8s | App 562、Desktop 43、local-install 36、delivery gate 13、Foundation 66、coordination 20、i18n 21，全部 0 失败。 |
| 干净提交 `7ff9aa5` 上 Node 24 `npm run app:deliver` | 通过 | 约 29s | 再次通过同组全量门禁，完成 macOS arm64 package、安全替换并自动启动唯一固定 App。 |
| `app:status` / Info.plist / `codesign --verify --deep --strict` | 通过 | <1s | installed/current source 精确一致为 `7ff9aa5`；版本与构建号均为 0.7.2；签名结构有效。 |
| 固定 App 顶部捕获入口 | 通过 | 人工 | 顶部截图/录屏可见；真实 App DOM 确认工作区/摄影机截图、工作区录屏与“开始前选择保存位置”提示，选择目标 IPC bridge 可用。 |
| 固定 App 离线分镜规划器 | 通过 | 人工 | 窗口从固定 App 打开；应用内全屏占满内容视口，Esc 首次还原窗口且不关闭规划器。 |
| 固定 App 语义代理模型库 | 通过 | 人工 | DOM 列出 11 类；新增默认成人男性后输入启用，改为儿童与 3m 高度仍保持类型/尺寸分离。临时对象禁用 autosave 后测试，强制重载确认内存与 autosave 均无残留。 |
| 恢复普通启动 | 通过 | 人工 | 临时本机调试端口已关闭；固定 App 重新普通启动，9223 无监听，来源与签名保持不变。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（0.7.2）

归档后的来源说明：`app:deliver` 与人工验收均在干净的运行时提交 `7ff9aa5` 完成；随后只新增文档/QA 归档提交，故最终分支 HEAD 的 `app:status` 为 contains=yes、exact=no。固定 App 已包含全部本轮运行时代码，无需为纯文档差异重复打包。

固定 App 人工启动结果：通过；顶部捕获入口、分镜窗口全屏/Esc 还原和语义代理 11 类/独立尺寸均从唯一固定入口完成检查。测试对象与调试端口已清理，App 已普通启动。

## 未覆盖与后续

- Seedance 真实生成一致性仍需用户按语义代理目录中的协议实机验证。
- 长录屏、真实编码器和播放器兼容性仍需持续真机观察。

## 交接

- 运行时交付提交：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；本验收单随后以 docs/QA-only 归档提交收口。
- PR：无（仓库无 remote）。
- 工作区状态：归档提交后 clean。
- 下一步：由用户按语义代理目录在 Seedance 实机完成三镜头/多焦段一致性评分；继续观察真实长录屏、编码器和播放器兼容性。

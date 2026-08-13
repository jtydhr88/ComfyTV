# 任务：02.14｜普通视频与白模导出统一24fps

- 状态：completed
- 日期：2026-08-03
- 对话：02.14｜普通视频与白模导出统一24fps（已核对/已去敏）
- 分支：`feat/02.14-unified-video-export-24fps`
- 基线：`a030c9b975fa6fc8158c18557c5b4ac2c21e5f69`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（`chore/integrate-04.9-before-product`）；当前分支包含该来源但不精确等于它
- 负责人：worker:02.14-unified-video-export-24fps

## 并行任务声明

- 任务 ID：`02.14-unified-video-export-24fps`
- 模式：write
- 分管 owner：02
- 模块：capture、i18n、testing
- UI 表面：capture-controls
- 数据区域：i18n-resources、qa-metadata
- 预计修改文件：`docs/CURRENT_STATE.md`、`docs/FEATURE_REGISTRY.md`、本验收单及其 completed 路径、`docs/plans/completed/README.md`、`docs/qa/unified-video-export-24fps/README.md`、`docs/qa/unified-video-export-24fps/evidence.json`、`i18n/locales/en-US.js`、`i18n/locales/zh-CN.js`、`qa/feature-registry.yaml`、`qa/seedance-white-model-profile.json`、`src/export/capture.js`、`src/export/seedance-profile.js`、`测试/冒烟测试.mjs`、`测试/回归/C5_seedance_package.mjs`、`测试/回归/C7_seedance_white_model_profile.mjs`、`预见PreVision.html`
- reservation：已预留（id 已核对；token 不写入仓库）
- reserve request key：已由固定 02 核对/去敏
- 协调登记：schema v3 revision=`c2417350-0624-47d4-bf0c-6dce11380ca2`；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:02.14-unified-video-export-24fps / worker:02.14-unified-video-export-24fps
- 状态更新时间 / 原因：2026-08-03；首轮独立 R2 发现普通 WebM 回退被无条件拒绝，同一 canonical worker/claim 已按协议 REVIEW→ACTIVE 做最小返修
- 侧栏去重证据：task id、client id、thread id 已在本机核对/已去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得宣称 Desktop live
- WAITING checkpoint：不适用
- turn stop verification：首轮证据已因 REVIEW→ACTIVE 作废；返修轮 fresh verification 待收尾
- 失败补偿：无；保留同一 reservation/thread，禁止重派
- `task:check` 结果：固定 02 已完成，无硬冲突
- `task:claim --reservation`：已登记；标准命令触发已知 `spawnSync git ENOBUFS`，校验协调脚本 SHA-256=`5303a45347b40e4dc0c51d557f639c1ee8392185235ac391d4e1371dc0f96adb` 后，用获批 Node 24 非落盘 64MiB maxBuffer wrapper 原样重放同一 claim 成功
- REVIEW commit list：未冻结
- 机械 closeout：不适用；由独立 reviewer PASS 后按治理流程执行
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

把底部“导出当前镜视频”“导出本场景视频”和 Seedance 2.5 白模参考包统一为固定 24fps；顶部工作区录屏/屏幕录制仍保持 30fps。

## 目标

- 建立单一权威导出 FPS=24，普通视频录制/调度与白模 planner、manifest、timestamps、严格媒体验证同源。
- 5 秒白模精确生成 120 个半开样本 `0..5-1/24`，实际 MP4 必须为 120 samples / 24fps。
- 当前镜与本场景普通视频以真实媒体探针证明 24fps；错误帧率、掉帧或多帧均 fail closed、零下载。
- 成功、取消与错误路径完整恢复 capture 状态，project/history/autosave 零写。

## 非目标

- 不改变顶部工作区录屏/屏幕录制的 `captureStream(30)`、`1000/30` 或 30fps 语义。
- 不改变分辨率、码率、容器优先级、29.5 秒白模限制、项目/摄影机/演员采样语义。
- 不新增 24/30 开关，不更新固定 App、稳定指针、GitHub、Pages，不运行 impact/full。

## 证据与现状

- 代码：基线已含 Seedance 2.5 白模 planner、严格 MP4 inspector/normalizer 与普通 `recordBlob` 导出链；当前合同仍为 30fps。
- Git：HEAD 已精确核对为 `a030c9b975fa6fc8158c18557c5b4ac2c21e5f69`，创建任务分支前工作区干净。
- 测试/运行：Node 24.18.0 可用；首次 `app:status` 因缺 `@electron/asar` 失败，须在 `npm ci` 后重跑。
- 文档/历史线索：`docs/CURRENT_STATE.md`、`docs/ARCHITECTURE.md`、`docs/FEATURE_REGISTRY.md` 与既有 Seedance QA 登记已核对。

## 影响范围

- 模块：capture、i18n、testing
- 文件：仅限并行任务声明中的精确列表
- 数据格式：不改 project v5；只改 QA profile/证据与导出 manifest 的 fps/timestamps 合同
- 平台：浏览器/Electron 的底部普通视频与 Seedance 白模导出；顶部工作区录屏保持原语义

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：GPT-5（具体运行变体不可观察，未验证）
- 请求 reasoning：未指定
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：由固定 02 另行组织；实现者不自审
- 数据：必须证明导出不写 project/history/autosave
- UI/交互：只允许双语状态/错误诊断的必要更新；不加 fps 开关
- 安全：wrong-fps/drop/extra 必须在下载前拒绝
- 发布：快速 NOT INTEGRATED 预览；禁止固定 App 与公开发布

## 验收条件

- [x] 底部当前镜、本场景与 Seedance 2.5 白模统一由单一权威 24fps 源驱动。
- [x] 顶部工作区录屏/屏幕录制仍为 30fps，相关常量与时钟语义未改变。
- [x] 5 秒白模 planner/timestamps/manifest/最终 MP4 合同均为 120 samples / 24fps；wrong-fps/drop/extra 均 fail closed 且零下载。
- [x] 普通当前镜/本场景视频保留 MP4→WebM 回退；MP4 通过真实 ISO-BMFF 探针，WebM 通过执行级 EBML Block/timecode 字节探针证明 24fps。
- [x] 成功/取消/错误恢复 capture 状态，project/history/autosave 零写。
- [x] zh-CN/en-US 文案与生成 HTML 同步。
- [x] Node 20–24 下 capture、C7、C5、i18n、build、diff-check 通过；未运行 impact/full。
- [x] 真实短镜普通导出与白模经 ffprobe/ISO-BMFF 核验，实际窗口尺寸与限制已如实记录。
- [ ] 实现者之外的独立 R2 reviewer 已完成，阻塞问题已关闭。
- [ ] 固定 App 交付不适用：本轮是快速 NOT INTEGRATED 预览，明确禁止 `app:deliver`。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：capture、i18n、testing
- 主应用模块参数：capture
- 最小命令：`npm run test:module -- capture`、`node 测试/回归/C7_seedance_white_model_profile.mjs`、`node 测试/回归/C5_seedance_package.mjs`、`npm run test:i18n`、`npm run build`、`git diff --check`
- 升级到全量的条件：本任务明确禁止 impact/full；若最小门禁暴露跨范围问题则停下并交固定 02 决策
- 人工检查尺寸/步骤：隔离 Electron 标题 `PreVision 02.14 Preview — NOT INTEGRATED`；记录实际内容区尺寸；当前镜/本场景短镜及 5 秒白模以 ffprobe 或 ISO-BMFF 核验
- 固定 App 交付：不适用；快速 NOT INTEGRATED 预览

## 实施记录

- 假设：普通底部视频与白模可共用一个导出 FPS 常量，同时保留顶部 workspace 30fps 专属常量。
- 关键决定：媒体探针必须验证实际样本数、timescale/duration 与 24fps，不把 JS 常量断言当真媒体证据。
- 实际修改：保留独立的手动录制 `REC_FPS=30`；将 Seedance profile 的 `fps=24` 作为所有自动导出的单一权威源。自动 target 冻结 fps，`recordBlob` 的录制/调度/白模计划全部从它同源取值，不对自动导出回退 30。普通当前镜/本场景/普通 Seedance 参考视频在保存/入 ZIP 前：MP4 复用白模 inspector、安全 timing normalizer 和 strict assertion；WebM 从最终 EBML 字节解析唯一视频轨、Block sample、TimecodeScale、逐 sample 时间码、DefaultDuration/Duration 并按相同 frameCount/24fps 合同严格放行。白模仍 H.264/MP4-only。增加双语严格媒体错误，并用真实容器结构测试夹具替代字符串伪媒体。
- 中断/恢复：首轮独立 R2 唯一结论 FAIL，原因是 `preferredRecordingSpec` 仍选择 WebM 但 `normalizeAndValidateAutomaticExportBlob` 无条件拒绝非 MP4，使容器回退实质失效。已保持原 task/thread/client/claim，以受信协调脚本和获批 Node 24 64MiB wrapper 完成 REVIEW→ACTIVE；旧 stop/review evidence 自动清除，未新建 reservation/worktree。
- app-server 通知消费：后台 turn 已启动；当前由 Desktop 承接同一任务，不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 版本 | PASS | <1s | v24.18.0 |
| `npm run app:status`（首次） | BLOCKED | <1s | 工作树尚未安装 `@electron/asar`；完成 `npm ci` 后重跑 |
| `npm ci` | PASS | 约 10s | 安装 506 packages；未执行 audit fix |
| `npm run app:status`（补跑） | PASS | <1s | installed source=`b8da5f4...`；contains=yes，exact=no |
| `npm run test:module -- capture` | PASS | 27.9s | 162/162；含 WebM-only 当前镜/本场景成功、wrong/drop/extra 零保存及手动/工作区 30fps |
| `node 测试/回归/C7_seedance_white_model_profile.mjs` | PASS | 3.7s | 114/114 |
| `node 测试/回归/C5_seedance_package.mjs` | PASS | 1s | 41/41 |
| `npm run test:i18n` | PASS | 1s | 217/217 |
| `npm run build` | PASS | <1s | 生成 HTML 1,407,568 bytes |
| `git diff --check` | PASS | <1s | 无 whitespace 错误 |
| 真 Chrome 0.5s 当前镜普通导出 + ffprobe | PASS（下载限制已记录） | 约 2s | H.264/avc1，13 packets，24/1，0.541667s；最终 Blob 只读提取，未观察到产品异步 anchor 自动下载事件 |
| 真 Chrome 0.5s 白模 + ffprobe | PASS | 约 1s | H.264/avc1，12 packets，24/1，0.5s；第二次显式点击下载 96,278-byte ZIP |
| 隔离 Electron 预览 | PASS | 运行中 | 标题精确；内容区 1512×862，外框 1512×894，DPR 2 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本轮禁止固定 App 交付/启动

## 未覆盖与后续

- R2 返修轮按命令禁止 UI/Electron/Chrome，因此没有补跑真实 WebM 浏览器编码；真实 MP4/白模证据保持不变，普通异步 anchor 下载仍仅记录“未观察”。真实 WebM、长录制、同一独立 R2 复审、中央集成与固定 App 最终回归由后续治理阶段完成。

## 交接

- 提交链：首轮实现 `4577e485fa42296a62d277312062484000882c86`；本轮最小返修由提交后的 Git HEAD 与 fresh REVIEW evidence 固化，不为回写 hash 追加第二个文档提交
- PR：无
- reviewer 结论：首轮 FAIL（WebM 回退被禁用）；最小返修完成，等待同一 reviewer 只审新增提交与累计合同
- 生命周期交接：目标 REVIEW（保持 claim）
- 工作区状态：active（代码/定向验证已完成，准备 verify-stop 并转 REVIEW）
- 下一步：提交完整任务 diff，执行本轮 `task:verify-stop`、转 REVIEW 并保持 claim，等待固定 02 组织独立 R2

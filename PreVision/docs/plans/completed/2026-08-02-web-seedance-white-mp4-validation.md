# 任务：01.16｜网页端 Seedance 白模 MP4 严格校验修复

- 状态：completed
- 日期：2026-08-02
- 对话：01.16｜网页端 Seedance 白模 MP4 严格校验修复（后台施工）
- 分支：fix/01.16-web-seedance-white-mp4-validation
- 基线：12f86ac8da59f9a9d8f57f025416921a53d1e840
- 固定 App 来源：b8da5f4f36a40010541700171cb246f2ca9de17b
- 负责人：worker:01.16-web-seedance-white-mp4-validation

## 并行任务声明

- 任务 ID：01.16-web-seedance-white-mp4-validation
- 模式：write
- 分管 owner：01
- 模块：capture, history, project, robustness, testing, i18n
- UI 表面：capture-controls
- 数据区域：project-v5, autosave, qa-metadata, i18n-resources
- 预计修改文件：`app-shell.html`、`src/export/capture.js`、`src/export/seedance-profile.js`、`src/main.js`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`测试/回归/C7_seedance_white_model_profile.mjs`、`测试/冒烟测试.mjs`、`测试/Web运行底座测试.mjs`、`qa/seedance-white-model-profile.json`、`qa/feature-registry.yaml`、`预见PreVision.html`、`docs/CURRENT_STATE.md`、`docs/FEATURE_REGISTRY.md`、`docs/KNOWN_ISSUES.md`、`docs/qa/seedance-white-model-chrome-mp4-validation/README.md`、`docs/qa/seedance-white-model-chrome-mp4-validation/evidence.json`、`docs/qa/seedance-white-model-chrome-mp4-validation/chrome-lan-5s.png`、本验收单的 active/completed 路径及 `docs/plans/completed/README.md`
- reservation：已从原 reservation 原子转换为 claim；token 不入库
- reserve request key：已由固定 01 核对/去敏；明文未进入仓库
- 协调登记：schema v3；claim 后 write slots 1/2（claims=1, reservations=0, orphans=0, expired=0）；本 Worktree 普通 status 因 `spawnSync git ENOBUFS` 失败，受信 Node 24 + 64MiB 非落盘 wrapper 已明确结束，不重复启动
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：worker:01.16-web-seedance-white-mp4-validation
- 状态更新时间 / 原因：2026-08-02T08:48:26.592Z；后台施工 turn 已正式开工，开始真实 Chrome RED 诊断与最小修复
- 侧栏去重证据：task id、canonical client/thread id 已在本机核对/去敏，不提交精确值
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得把侧栏任务存在或后台 turn 推断为 Desktop live
- WAITING checkpoint：不适用
- turn stop verification：未完成
- 失败补偿：无；claim 失败立即停止并回报固定 01
- `task:check` 结果：由固定 01 在 reserve 前完成；本任务不重复 reserve
- `task:claim --reservation`：已从原 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：reviewer PASS 后仅允许 sole-parent closeout 移动本验收单并追加 completed 索引
- `task:release`：未释放；保持到 `00` 集成和最终回归
- `task:archive`：未开始

## 用户问题

稳定 LAN 预览的 Chrome 网页端在约 5 秒单镜头生成 Seedance 2.5 白模参考包时，真实 MP4 严格媒体校验失败，未生成或下载参考包。必须先持久记录 expected/actual frameCount、duration、fps、capture ledger 与 MediaRecorder 事件复现 RED，再修复真实 Chrome 编码节拍、启动/尾帧排空或容器时间轴的根因；不得放宽、跳过校验或让失败包下载。

## 目标

- 为 Web/Chrome 白模录制增加用户可读、证据可持久化的媒体诊断，覆盖预期/实际元数据、capture ledger 和 MediaRecorder 事件。
- 修复真实 Chrome MP4 的实际根因，同时保留 frameCount 精确相等、duration 误差不超过 `1/fps`、fps 误差不超过 `0.5` 的严格合同。
- 真实 LAN Chrome 约 5 秒生成一次严格通过的白模包；第二次由真实用户点击下载，ZIP/manifest 校验通过。
- 保持 project/history/autosave/material 零写与完整恢复；cancel/error 后可 retry。

## 非目标

- 不调用付费 Seedance，不修改固定 App、稳定预览 pointer、GitHub、Pages，不运行 `app:deliver`。
- 不放宽或删除严格媒体校验，不允许失败包下载碰绿。
- 不主动运行 impact/full，不修改声明外文件。

## 证据与现状

- 代码：基线包含 02.13 白模 planner、同步 clay override、严格 ISO-BMFF/媒体元数据校验和显式浏览器下载。
- Git：Worktree 从精确基线 `12f86ac8da59f9a9d8f57f025416921a53d1e840` 创建并切到声明分支，创建验收单前 clean。
- 测试/运行：Node v24.18.0；`npm ci` 成功；`app:status` 显示 installed=`b8da5f4...`、current=`12f86ac...`、contains=yes、exact=no。普通 `task:status` 命中已知 `spawnSync git ENOBUFS`；固定 01 已核验中央 0/2 与本 reservation。
- 文档/历史线索：02.13 Electron 证据为 150/150/150、约 5.004533s、29.972825fps；不能替代本次真实 LAN Chrome RED/绿证据。Obsidian 架构笔记确认录制链以 30Hz tick、`captureStream(0)+requestFrame` 和 MediaRecorder 为边界，project/time/playing/captureTransaction 为高风险共享状态。

## 影响范围

- 模块：capture, history, project, robustness, testing, i18n
- 文件：仅并行任务声明中的精确清单
- 数据格式：不新增 project v5 持久字段；诊断仅为瞬时 UI/QA 证据
- 平台：macOS 真实 Chrome / 稳定 LAN Web；Node 24 自动门禁

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：待固定 01 派发；必须 R2，不得降级
- 数据：必须证明 project/history/autosave 零写与材料/运行态恢复
- UI/交互：诊断必须持久可读，失败/cancel 后可再次生成
- 安全：失败 ZIP/下载必须继续 fail closed；证据不得含私人项目字节或绝对路径
- 发布：仅任务分支与 LAN 验证，不正式交付或发布

## 验收条件

- [x] 真实 LAN Chrome 先复现 RED，并持久记录 Chrome 版本、expected/actual frameCount/duration/fps、capture ledger、MediaRecorder 事件。
- [x] 修复真实根因，严格媒体校验未删除、跳过或放宽。
- [x] 真实 LAN Chrome 约 5 秒生成一次严格通过；第二次真实用户点击下载，ZIP/manifest 校验通过。
- [x] `shot` scope 的 pending ZIP 与当前镜头身份绑定；从 C01 切到 C04 后，旧“重新下载”点击先生成 S1C4，不得再次下载 S1C1。
- [x] pending ZIP 与当前作者内容 SHA-256 指纹绑定；同一个 shot/scene 对象原地编辑后旧包也必须失效，pending 身份不得强引用 project/scene/shot 对象。
- [x] 故障注入覆盖真实事件顺序、启动确认、尾帧 drain/dataavailable/onstop、严格失败拒绝 ZIP/下载、cancel/error/retry 与零 project/history/autosave 写。
- [x] C7、capture 模块、Web 相关定向、`test:i18n`、build、`git diff --check` 通过。
- [x] 需要的人工验证与去敏证据完成。
- [ ] 实现者之外的独立 R2 只读 reviewer 完成，阻塞问题关闭。
- [x] 固定 App 交付不适用：本任务明确禁止 `app:deliver`。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：capture、main-app、i18n-browser、app-test、web-runtime、foundation
- 主应用模块参数：capture
- 最小命令：C7；`npm run test:module -- capture`；Web 相关定向；`npm run test:i18n`；`npm run build`；`git diff --check`
- 升级到全量的条件：不主动运行 impact/full；若最小修复暴露声明外根因，先停止并向固定 01 请求 scope 变更
- 人工检查尺寸/步骤：真实 Chrome 打开 LAN 任务预览；当前镜头 5 秒；白模参考包生成一次、第二次真实点击下载；记录实际窗口/截图尺寸和 Chrome 版本。现场自动恢复项目含其他场景/镜头，因此不虚构为“整个项目单场景/单镜头”；白模 scope 明确为当前镜头
- 固定 App 交付：不适用；固定 App、稳定预览 pointer、GitHub、Pages 均保持不变

## 实施记录

- 假设：不预设 frameCount、duration 或 fps 哪一项失败；以真实 Chrome 持久诊断为准。
- 关键决定：先 RED 证据，再最小修复；严格失败始终拒绝 ZIP/下载。
- 实际 RED：Chrome 150.0.0.0、真实 LAN 分支预览 `http://192.168.1.200:4175/director/`、当前镜头 5.0s；第一次临界通过为 150 帧 / 5.021567s / 29.871156fps，第二次复现严格失败为 150 帧 / 5.373s / 27.917365fps。失败时 ledger 仍为 planned/rendered/requested=150/150/150，首末 `requestFrame` 分别为 237.3ms / 5586.1ms，尾部 `requestData`=5639.5ms、`dataavailable`=5648.4ms、`onstop`=5649.4ms；严格校验拒绝 ZIP/下载，UI 保留完整诊断且按钮回到可重试。
- 根因诊断：帧账本未丢帧；当前调度器在每个目标采样时刻才开始同步 WebGL 渲染，随后才 `requestFrame()`，因此渲染耗时会进入 MediaRecorder 容器时间轴。真实 RED 的首末采样跨度 5.3488s，与 actual duration/fps 失败直接一致。
- 实际修改：增加可展开、可复制、失败后保留的严格校验诊断，包含 expected、recorder actual、最终 actual、ledger、MediaRecorder 事件和 browser UA；以不计入计划的 primer 触发并等待真实 `start`，计划帧改为提前渲染后在绝对时刻 `requestFrame()`，尾部 drain 同时锚定首帧计划时长和末帧后一帧。若真实 Chrome 仍按墙钟写入 sample delta，则只在 H.264 且编码样本数精确等于计划时归一化 ISO-BMFF timing；149/151 帧、异常容器或严格校验失败仍在 ZIP/download 前拒绝。
- 首轮 R2 BLOCK 与返工：第一版只重写 sample duration，没有同步第二个 `moof` 的 `tfdt`，因此误报严格 150/5/30；真实下载 MP4 仍有 3185/30000 秒分片空洞，ffprobe 为 5.106167 秒。返工后 inspector 持久暴露 `timelineGapTicks` / `timelineOverlapTicks`，strict assertion 要求二者为零；normalizer 同步重写 `tfdt` 与匹配 `mfra/tfra`，对 `sidx` / edit list 保守拒绝。finalize 恢复失败也会覆盖 ready 诊断为 `finalize-failed` 并清空待下载包。
- 最终 GREEN：Chrome 150.0.7871.187 / LAN 4175 / 当前镜头 5 秒；recorder actual=150 帧 / 5.079133 秒 / 29.532597fps，并记录真实 `timelineGapTicks=147`；最终严格 actual=150 帧 / 5 秒 / 30fps，gap/overlap 均为零。ledger=planned/rendered/requested 150/150/150，primer=1，`startSource=listener-after-primer`；16 个 MediaRecorder/capture 事件从 created 到 `onstop` 完整有序。第二次真实点击下载所得两个浏览器字节产物均为 54,311 bytes、SHA-256 `ca0b4a3b…dc2f0`；两份 ZIP/manifest/current inspect/assert 均 PASS，包内 H.264 MP4=150/5/30。ffprobe 8.1.2 得到 5.000000 秒、150 packets、30/1，第 101→102 包 gap=0，全包 discontinuities 为空。
- 用户追加 RED 与首轮修复：用户切到 C04 后点击旧“重新下载”仍取得 C01；对其解压包只读核对后，timestamps/manifest/MP4 均为 `S1C1 / shotIndex=0`。planner 并未取错镜头，实际是已验证 C01 pending ZIP 未绑定当前选择。首轮修复为 pending 包记录 project/scene/scope/aspect 与 shot scope 的 shot index/ref，下载前复核；身份变更时清除旧 pending 并生成新当前镜头包，不允许旧包直接下载。
- 当前镜头最终 GREEN：Chrome 从 C01 生成/下载（下载数 0→1）后切 C04；旧按钮第一次点击只启动 `S1C4` 新生成，下载数保持 1，ready 后第二次点击才变 2。新包 manifest/timestamps/MP4 均为 `S1C4 / sceneIndex=0 / shotIndex=3`，ZIP SHA-256 `d935e598…e3fce`；H.264=105 帧 / 3.5 秒 / 30fps，项目 inspect/assert 与 ffprobe 105 packets、无 discontinuity 均通过。首末帧 MD5 不同只证明画面内容运动；C04 作者设定为固定机位。页面业务投影前后 SHA 相同、undo disabled、autosave 文案不变；未读取浏览器存储。
- 第二轮 R2 BLOCK 与返工：reviewer 在同一个 shot 对象上把 yaw 从 0 改为 17 并 `markDirty`，ref/index 仍相同，首轮修复会直接下载旧 ZIP；pending 还强引用旧 project/scene/shot。最终身份只保存 scope、scene/shot index、aspect 和 SHA-256 内容指纹，指纹覆盖工程名、场景名与冻结 `stageToData()`；下载前从当前状态重算，任何同对象内容编辑都会先废弃旧包。单个已验证 Blob 仍有界保留以满足二次点击/重试，但不再持有 project/scene/shot 对象引用。
- 最终精确构建 Chrome 复测：4175 served 与 dist 均为 1,393,279 bytes / SHA-256 `cded24b0…90dac`。Chrome 150 下载计数 302→303 取得 C01；切 C04 后第一次旧按钮点击仍 303 并开始第4镜新生成，ready 后第二次才 304。C01=150/5/30；C04 ZIP=1,499,240 bytes / SHA `fdfbd87f…9d89`，manifest/timestamps/inspect/assert 与 ffprobe 105 packets / 3.5s / 30fps / discontinuities=0 全通过。把同一 C04 时长 3.5→3.6 后点击旧按钮，计数仍 304 而新生成 108/3.6/30；随后 Undo 恢复 3.5，未下载第三包。
- 中断/恢复：无
- app-server 通知消费：当前为后台 started turn；任务结束前按治理做独立 stop verification，不把后台连接当 Desktop live 证据

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm ci` | 通过 | 约 7s | 安装 506 个 lockfile 依赖；未运行 audit fix |
| Node 24 `npm run app:status` | 通过 | <1s | installed `b8da5f4...`；current `12f86ac...`；contains=yes；exact=no |
| Node 24 `npm run task:status` | 环境性失败 | 约 24s | `spawnSync git ENOBUFS`；未误判为空登记 |
| Node 24 + 64MiB 受信 wrapper `task:claim` | 通过 | 约 30s | `CLAIMED FROM RESERVATION`；write slots 1/2；ACTIVE / BACKGROUND_ONLY |
| Node 24 C7 定向回归 | 通过 | 约 4s | 最终 113 passed, 0 failed；启动 primer、真实 start、预渲染节拍、尾帧 drain、fragmented/non-fragmented timing、多 `moof` gap/overlap、`tfdt/tfra`、`sidx/elst` 拒绝、finalize/cancel/error/retry、pending 无对象强引用、直接下载入口拒绝旧包、C01→C02、同 shot/scene 对象原地编辑失效与零写恢复覆盖 |
| 真实 Chrome / LAN 稳定 4174 基线尝试 | 未复现 | 约 6s | 本次生成成功，说明问题具备节拍波动；未下载，未修改稳定 pointer |
| 真实 Chrome 150 / LAN 任务预览 4175 RED | 严格失败（符合预期） | 约 6s | expected=150/5/30；actual=150/5.373/27.917365；ledger=150/150/150；无 ZIP/无下载，诊断持久可读 |
| 首轮 R2 对伪 GREEN 的字节级审计 | BLOCK（已修复） | 只读 | 第二个 `moof` 的 `tfdt` 留下 3185 ticks gap；旧 inspector/manifest 错报 150/5/30，ffprobe 实际 5.106167s |
| 返工后真实 Chrome overlap RED | 严格失败（符合预期） | 约 6s | 新 inspector 识别真实 Chrome 分片 overlap，未生成 ZIP/下载；据此调整为可诊断、可规范化，但最终 strict 仍要求零断裂 |
| 真实 Chrome 150 / LAN 任务预览 4175 最终 GREEN | 通过 | 约 6s | recorder=150/5.079133/29.532597，raw gap=147 ticks；strict actual=150/5/30，gap/overlap=0；primer=1，start=listener-after-primer，尾帧 drain 完整 |
| 第二次真实用户点击下载 + 当前源码/ffprobe 包校验 | 通过（文件名限制见备注） | <1s | Chrome 留下两个 `.crdownload` 临时名；二者 ZIP 均 54,311 bytes、SHA 相同，manifest/inspect/assert=true；内含 H.264=150/5/30，ffprobe 150 packets 且 discontinuities=[]；未改名、移动或删除用户文件 |
| 用户解压包只读诊断 | RED（已修复） | <1s | 用户选择 C04 后得到的包仍为 `01_white_model_S1C1.mp4`；timestamps/manifest 明确 `shotIndex=0` |
| 真实 Chrome C01→C04 pending 身份回归 | 通过 | 约 15s | C01 下载数 0→1；切 C04 后第一次旧按钮点击保持 1 并生成 S1C4，ready 后第二次点击才 1→2；新 ZIP/manifest/timestamps/MP4 为 shotIndex=3，105/3.5/30，ffprobe 无断层 |
| 最终内容指纹构建 Chrome C01→C04 + 同镜头编辑 | 通过 | 只读复测 | 精确 served SHA `cded24b0…90dac`；C01→C04 下载计数 302→303→303→304；C04 105/3.5/30 严格通过；同一 C04 3.5→3.6 后不下载旧包而新生成 108/3.6/30，Undo 恢复且无第三包 |
| Node 24 `npm run test:module -- capture` | 通过 | 约 19s | 155 passed, 0 failed；首次运行因普通录屏静态恢复合同未保留直连 `rec.onerror=failRecording` 为 154/1，最小修正后通过 |
| Node 24 `npm run test:web` | 通过 | 约 3s | Web runtime 11/0；stress harness contract 14/0 |
| Node 24 `npm run test:i18n` | 通过 | 约 3s | 217 passed, 0 failed |
| Node 24 `npm run build` | 通过 | <1s | `预见PreVision.html` 1,393,274 bytes |
| `git diff --check` | 通过 | <1s | 无 whitespace error |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本任务禁止更新或启动固定 App 做交付验收

## 未覆盖与后续

- 独立 R2、REVIEW/HANDED_OFF 尚待完成。本任务按合同不更新稳定 4174 pointer，因此分支真机 RED/绿证据使用同一 LAN 主机的短期 4175 任务预览。真机只覆盖 5 秒当前镜头和 macOS Chrome 150；长录制与其他平台浏览器仍未验证。

## 交接

- 最终提交：待完成
- PR：无（无 remote/未登录）
- reviewer 结论：将在 REVIEW 后由实现者之外的独立 R2 持久化到 common-dir lifecycle；本 active 验收单在 REVIEW 冻结后不再改写该结论
- 生命周期交接：ACTIVE
- 工作区状态：声明范围内实现、测试和去敏证据已完成；待聚焦提交
- 下一步：聚焦提交后做 stop verification、REVIEW、独立 R2 与 HANDED_OFF；保持 claim 给 `00`

# 当前状态

更新时间：2026-08-03
产品版本：0.7.2 Preview
项目数据版本：5

## 阶段基线

- 摄影机 FOV 锁定与时间线一致性修复任务 `01.17-camera-fov-lock-timeline-consistency` 基于 `37c8cd8d81626b81232a2ab5f774326811602532` 在独立任务分支完成实现：FOV 的显示、提交与播放采样已和 yaw/pitch 锁解耦，actor/global/manual × custom/pointSync/arcLength 的基础点、普通 key、非 key draft、point preview、Undo、保存重开与 capture gate 已纳入执行级回归；`shot.fov`、当前 `camKey.fov`、运行 `shotCam`、monitor 与自动 capture 使用同一有效 FOV。Node 24 的 build、camera/timeline/playback/history/project/capture、project-input、i18n、foundation 与 web 门禁均通过；impact 内 camera/playback/timeline 通过，随后 `test:app` 仅保留与精确 baseline 相同的“树木提示词指代”和“无 modal 快捷键恢复”2 个历史失败（baseline 1186/2，任务分支 1187/2），故 impact 如实返回 1，不包装为 PASS。真实 Chrome 150 在隔离 `4187` LAN 任务预览完成男人1/custom/t=0 原生 39°→79°、播放、保存重开以及 global/manual、pointSync/arcLength 复核，console 无错误。当前状态仍为 `IMPLEMENTED_UNVERIFIED`，等待实现者之外的独立 R2 与中央集成；固定 App、稳定 4174 指针、GitHub 和 Pages 均未更新。

- P9 模块化任务分支 `chore/p9-ui-persist-main-shim` 从 `acb4ba6` 开始：`6b17d57` 固化 ADR/验收契约，`39693d4` 将 legacy `src/app.js` 拆为 `src/main.js`、`src/ui/{shell,timeline,inspector}.js` 与 `src/persist/persistence.js`。构建仍交付单一离线 HTML（两个 bare script blocks）；P9 boundary、P8、i18n、C8、census、核心冒烟、Web 与 desktop 门禁已通过。V1 仍为既定 SKIP；未运行 V2/V3，未更新固定 App。

- 04.7 开工采用的当前集成基线 HEAD：`a706161afd10daf3b090bf67c7b656599d344414`，父提交为 `a268ce495c97e2d41c2bb86eec186e200f81dfe0`。`a706161` 已集成 01.10 模态窗口命令所有权与背后快捷键隔离实现；2026-07-16 的 `task:status` 中已无 01.10 claim。
- 项目根目录：仓库根目录即当前 `预见PreVision` 目录。
- 原始阶段检查点分支：`checkpoint/prevision-before-foundation-2026-07-13`
- 原始阶段检查点提交：`ce523b2f1914e34f863826977492626dcb3bd754`
- `main`：指向同一阶段检查点，没有额外修改。
- 当前基础建设分支：`chore/prevision-development-foundation`
- 基础建设实现提交：`a8516fe`（文档、QA 登记、分层测试和仓库模板）。
- 主应用模块测试提交：`50886a8`（14 个登记模块和安全降级规则）。
- 基础建设完整基线：`02cf401`。
- 当前 UI 实现分支：`feat/ui-cinema-console-themes`，基于设计方向提交 `525ea2b`。
- 当前本机入口刷新分支：`fix/local-app-web-entry-refresh`，基于 UI 实现提交 `2570518`。
- 国际化规范提交：`0d5bcb6`；浏览器与 Electron language key 基础、双语言资源和新增中文守卫已实现。
- 当前录屏界面反馈分支：`fix/recording-ui-feedback`，基于本机入口刷新提交 `0925ef0`；优化默认栏位、即时提示、右栏分隔条、时间轴拖拽重绘和场景地面外观。
- 当前固定 App 更新分支：`fix/canonical-latest-app`，基于已整合国际化与录屏界面修复的 `40e8dd3`；日常唯一入口为 `~/Applications/PreVision.app`。
- 当前单一可见 App 收敛分支：`fix/single-visible-prevision-app`，基于固定入口提交 `e3394a8`；成功更新后不再保留可被 Finder 找到的源构建 App。
- 当前品牌副标题对齐分支：`fix/brand-subtitle-alignment`，基于录屏界面修复提交 `40e8dd3`；下移并放大「3D DIRECTOR」，使其底边对齐应用图标。
- 当前统一交付门禁分支：`chore/canonical-delivery-gate`，基于 `96050d1` 并已整合品牌副标题提交；将每次用户可见任务的全测、来源校验、构建、固定 App 更新和启动验收合并为单一完成步骤。
- 画布颜色任务：`feat/canvas-color-options` 的已验收提交已进入 0.7.1；右上角三种画布快捷外观与 4 倍棋盘单格随固定 App 交付。
- 场景创作升级任务：`feat/scene-authoring-upgrade` 的已验收提交已进入 0.7.1；包含人物/道具细化、白马及马头零件统一、连续方形沙漠贴地、全身主要关节、四个常用场景构图模板、剧本分镜模板路由，以及左栏“项目场景 → 场景镜头”分层与底栏镜头条去重。
- 当前 0.7.1 正式收口分支：`fix/recent-preview-rollup-0.7.1`，已安全整合上述成果并完成全量回归；未纳入 Web 首页概念稿。版本元数据从 0.7.0 自动递增到 0.7.1，并由该分支统一交付固定 App。
- 当前开发调度基础分支：`chore/parallel-development-orchestration`，基于固定 App 0.7.1 来源 `de0c6ac`；建立短期 Worktree 任务、两个并行写任务上限、模块/UI/数据写前冲突门禁和固定入口/`99` 归档体系。本任务不改变业务 App。
- 当前工程治理任务 `04.9-autonomous-dispatch-model-routing` 基于 `c037a4b`，R5 独立复审针对 `40d4d71` 提出的三个阻断已由同一独立短期临时工在原任务完成最小补正，重新 stop verification 后处于 REVIEW 并保留 claim；c037 migration 语义未改动。common-dir 使用严格 schema v3 + revision；真实 c037 旧 claim/release 由目录 guard 阻止改写，`00` 需用 `task:migrate-legacy-worktree` 把旧标准 npm status/check 显式迁移到 common-dir 版本化只读 launcher，迁移前核验受信 HEAD、协调脚本、全部 `task:*` npm 入口及 clean 状态。v3 lock 使用固定 locale+UTC 启动身份、不含 argv，并以 fd/inode/recovery guard 读取和释放；跨版本 identity 不匹配时只要 PID 存活仍不得偷锁。stdout 断连与并发 replay 按幂等 request key 恢复同 generation、同一 token；取消后新 request key 可重派同 task ID，旧 token/request 不复活。旧 release 对任何 owner 造成的 ACTIVE-without-claim 都保留为占槽 integrity issue，直到 `00` 提供停止证据。canonical thread/client 不可清空或替换；REVIEW 绑定完整有序 baseline..HEAD 列表，返工作废旧 stop/review。机械 closeout 在每次读取时绑定当前 claim scope，终态则绑定 release scope fingerprint，且验收单/索引必须保持 `100644` blob；中央 release 的 commit/patch/tree 证据统一使用禁用 replace refs 的 raw Git 对象语义。本任务不改变业务 App 或固定 App。
- 截图/录屏保存位置成果已由 `fix/integrate-capture-save-location` 的 `83b17ea` 安全集成到 0.7.2 收口分支；顶部四个捕获入口先选择系统保存位置，取消不写入/不开始，完整路径和实际后缀可见。
- 自动导出内容身份与导航隔离已在任务分支 `fix/01.14-automatic-export-content-identity` 完成实现和任务级验收，等待新一轮 R2 独立只读复审。当前镜头、本场景与 Seedance 在启动前结算在途编辑并冻结 scene/shot、分辨率、逐帧时间计划、prompt/JSON 与运行时恢复状态；事务期间 UI、快捷键、菜单和程序 mutator 在首写前拒绝导航与内容编辑，既有 history/autosave timer 仍按原时序消费，导出自身不写项目。纹理预检安装 stop 后刷新真实按钮状态，悬挂资源可由用户点击停止；MediaRecorder 请求停止后若不触发 `onstop`，1500ms 单次兜底会明确失败并释放 Promise、事务与 UI，迟到回调不重复完成。point-preview、迟到导入、全镜顺序、ZIP 条目身份、手动工作区录制和异常收尾均有执行回归；Node v24.18.0 的 impact/full 与真 macOS Chrome、隔离 Electron 重验通过。本任务没有运行 `app:deliver`，固定 App 仍为 `7ff9aa5`，尚不包含该修复。
- 普通视频与白模导出统一 24fps 任务 `02.14-unified-video-export-24fps` 基于 `a030c9b` 在独立 Worktree 完成实现与 R2 最小返修：底部当前镜/本场景、普通 Seedance 参考视频和 Seedance 2.5 白模从同一权威导出 FPS=24 取样，顶部摄影机/工作区录屏仍为 30fps。5 秒白模是 120 个半开样本且仍为 H.264/MP4-only；普通导出保留既有 MP4→WebM 容器回退，MP4 复用 ISO-BMFF inspector/normalizer/strict assertion，WebM 从最终 EBML 视频轨、Block sample 与逐 sample timecode 严格验证 24fps，wrong/drop/extra 均 fail closed。Node 24 capture 162/162、C7 114/114、C5 41/41、i18n 217/217、build/diff-check 已通过；真 Chrome 0.5 秒当前镜 MP4 为 H.264/avc1 13 packets / 24fps，白模为 12 packets / 24fps，ffprobe 与项目 inspector 一致。R2 返修禁止 UI/Chrome，故 WebM 证据是执行级真实 EBML 字节回归，不冒充浏览器实录。任务等待同一独立 R2 复审，未运行 impact/full、中央集成、固定 App 交付、GitHub 或 Pages；证据见 `docs/qa/unified-video-export-24fps/`。
- 离线分镜规划器 v2 的任务提交 `d05d555` 已由 `00` 精确集成为 `6441682` 并进入 0.7.2 收口分支。功能包含中英文节拍分析、瞬时 `StoryboardPlan`、角色映射、动态 4–8 镜与确认应用；分析窗口支持连续二维缩放、应用内全屏/还原、固定关键区与独立列表滚动。
- 语义代理模型库 MVP 的任务提交 `bacbabe` 已由 `00` 精确集成为 `1734270` 并进入 0.7.2 收口分支；首批 11 类低复杂度代理支持类型/尺寸分离、project v5 兼容和 Seedance 验证协议。`02.2` claim 已在集成全量回归通过后释放；Seedance 实机一致性仍未验证。
- 快速预览模型包任务 `02.5-fast-preview-model-pack` 的首轮独立 R2 因沉船 45° 斜向假碰撞和人工证据不足退回；旧 review/stop/视觉证据失效，同一 `feat/02.5-fast-preview-model-pack`、同一 claim 上的聚焦返工现已完成任务级实现与验证。产品语义收敛为“沉船 + 海马 + fallback wizard foundation”：沉船已改用 9 段定向船体代理并补 0°/45°/90°、尖艏/分段对角、路径 yaw 与旧白马回归；海马已重做骑乘五点宿主相对近景、真实 280px inspector 和播放性能证据。当前生成 HTML SHA-256 为 `343a67d52c29e69cbdc3992f0fc93fd731947b14e85c2965ea0206affa687074`，重复构建一致；5 秒真实播放的模型包/空场 median 均为 59.9 FPS，模型包 p10 59.2 FPS。程序化巫师只保留 `char` 全身 rig、帽/杖随骨、project v5 兼容与性能基线，不代表原人物高精度，高精度原人物直绑骨由独立后续任务承担。`SCN-009` 保持 `IMPLEMENTED_UNVERIFIED`，须等待新独立 R2 与中央集成验证；固定 App 仍为任务基线来源，尚未包含本模型包。
- 导演台高识别人物代理任务 `02.11-director-proxy-characters` 已在独立任务分支替换巫师产品入口：模型库直接提供男人、女人、小朋友，精确主色为 `#2F6BFF`、`#F0445E`、`#FFD43B`，统一低面数 rig 强化五官方向与肩肘腕/髋膝踝标记。工厂使用真实 Three bounds 归一化到约 1.78m、1.66m、1.2m；viewport、monitor 与捕获沿用同一 stage 对象。project v1–v5 legacy wizard 无损迁移为 `adult_male` 且保存后不再写 `characterStyle`，普通无 `semanticType` 旧 char 不被静默补字段。当前为 NOT INTEGRATED 快速预览，等待独立 R2 与中央集成；固定 App 未更新。
- 透明图标母版提交 `bd14ad6` 已由 `00` 集成为 `3cc2aad`；它只新增 1254×1254 RGBA 设计母版和验收证据，未替换当前运行时/Forge 图标。
- 机位点作者期高度收口任务 `02.6c-camera-point-height-30m` 已基于 `c981658` 在独立任务分支统一为 `0.2–30m`：覆盖 inspector 滑杆/拖拽、新增点外推、pull/crane、当前视角、起幅/落幅、Alt 拖机位、对象路径复制及 timeline camera key 粘贴，并继续无损载入 project v1–v5 的有限历史 `>30m` 坐标。独立 oracle 已覆盖 30m 往返及 15→30 的 22.5m 中点/30m 终点，camera/project/playback/timeline/viewport、i18n、app、project-input、impact 与显式 full 均通过，04.16 inspector rail 三档尺寸/四种模式及 48 个 quick-entry 样本继续稳定。新 BrowserWindow-owner Electron QA 已在 CSS 1440×900、DPR 2 下通过 inspector 30m、Alt 0.2/30、timeline 47→30 且源 47 不变、15→30 播放/中点/终点预览四项真实事件并留存新 PNG；状态保持 `IMPLEMENTED_UNVERIFIED`，等待实现者之外的独立 R2 与中央集成。固定 App 来源仍为 `b8da5f4`，未更新。
- 镜头时长/关键帧边界任务 `02.7-shot-duration-boundaries-segments` 已基于 `777c902` 在独立任务分支形成快速开发预览：时长拖动与数值输入使用临时草稿，0.1s 精度、0.5s 最小值，pointerup/Enter/blur 单次提交且 Escape 零写；有限历史 `>20s` 不被 range 静默夹回。camera 的 shot-local 与 actor/prop 的 scene-global 关键帧绝对秒不缩放、不迁移；截断、sceneDur 越界、cameraNodes/cameraFollow 联动或 pointSync/arcLength 无法安全物化时在首写前原子拒绝。相邻 times/ease 派生的区间条不持久化、不聚焦、不抢 key 命中。定向模块、i18n、U4 v1–v5、build 与隔离 Electron 1440×900 已通过；状态保持 `IMPLEMENTED_UNVERIFIED`，等待独立 R3 reviewer 与中央集成。固定 App 仍为 `b8da5f4`，未更新。
- 9:16 当前镜头独立重构图任务 `02.9-shot-reframe-9x16` 已在精确基线 `2def382` 的独立 Worktree 实现首版：project v5 仅按需保存 `shot.reframeByAspect['9:16']={offsetX,offsetY,zoom}`，16:9 与旧 v1–v5 缺字段解析为 identity，原 camera/times/FOV 数据不改写。纯共享 helper 统一 monitor、Follow/编辑导演台、PNG、当前镜视频与本场景视频的 contain-fit、scissor 和投影；导出在启动时冻结逐镜头 resolved 值，并以故障注入验证 camera/renderer/exportLook/播放状态恢复。作者交互采用 draft→单次 history/autosave 提交，取消与受 gate 拒绝路径零写。Leo 真实截图暴露首版 toolbar 入口在“属性与监视器”展开布局中不可发现后，P1 返修在右侧 monitor 下增加了始终可见的同命令入口：9:16 显示、16:9 隐藏，两处 `aria-pressed` 共用单一状态，点击一步进入并聚焦主画布，CSS 有界避免右栏横向溢出。project/history/camera/playback/viewport/layout/capture、i18n、U6/C1/U4/P8 与 build 已完成定向验证；真实隔离 Electron 进程保持以 `PreVision 02.9 Preview — NOT INTEGRATED` 标题运行，但尚未补 1440×900 仓库截图与完整人工点击矩阵，因此状态保持 `IMPLEMENTED_UNVERIFIED` 和 ACTIVE，等待产品复看、独立 R2 与中央集成；固定 App 未更新。
- 时间轴 0.1s 尺规与半秒吸附任务 `02.12-timeline-tenth-ruler-half-second-snap` 基于 `c99968d` 在独立 Worktree 开发：尺规/lane 共用 0.1s 小网格、0.5s 中刻度和 1.0s 大刻度；camera、legacy actor/path 与 generic preview key/group 拖动共用 0.1s 量化，整秒/半秒在约 8px 内强吸附。当前旁路语义已由 01.15 修正：snap ON 保持 0.1s 量化和强吸附，snap OFF 或 Option/Alt 只 clamp 合法边界并保持连续；session-only 开关不写 project/history/autosave。02.12 的 Node 24 定向门禁与 NOT INTEGRATED 1316×768/1440×900 证据属于当时实现；当前行为以 01.15 的新回归为准。等待独立 reviewer 与中央集成，固定 App、稳定预览和远端均未更新。
- 播放头/尺规吸附一致性修复任务 `01.15-playhead-ruler-snap-consistency` 基于 `5e059556` 在独立 Worktree 将红色播放头拖动、尺规点击/拖动和 lane 空白定位接入既有约 8 CSS px 整秒/半秒强吸附与 guide/status/highlight 反馈。用户真实预览后，开关语义统一修正为：snap ON 时播放头与关键帧保持既有 0.1s 量化和强吸附；snap OFF 或按住 Option/Alt 时只 clamp 边界并保持连续，pointermove 期间以三位小数实时更新可见 status。程序化播放、capture gate、shot-local / scene-global 及播放头的 project/history/autosave 零写语义不变。精确 baseline 的同一 Node 24 timeline 命令为 188 通过/1 失败（既有 AutoKey 夹具 `A·主体.scale 1→0.81`）；新合同执行级 RED 为 192/2，返修后 timeline 194/0、playback 42/0、layout 160/0、i18n 217/0、build 与 diff-check 全绿。隔离 Electron 标题和时间轴已在实际 `2560×1409` CSS 窗口静态核验，保存的 PNG 为实际 `1396×768`；Computer Use 原生拖拽人工项未验证，截图不作为 PASS。临时进程与独立 profile/clone 已清理，等待实现者之外的独立 R2 与中央集成；固定 App、稳定预览和远端均未更新。
- 专业电影摄影机机位可视化已实现为独立编辑 overlay：核心保持 48 CSS px，透明命中代理保留原有点选/拖动，独立投影摄影机按完整模型包围球动态收紧 near/far；monitor、摄影机画面、缩略图与 Seedance 导出隐藏该辅助模型。
- 首次启动白马欢迎场景已在 `feat/first-run-white-horse-welcome` 完成开发预览：真正缺少 autosave 时建立白马路径、骑手挂载、侧向太阳和 4 镜/16.5 秒的普通 project v5；有效 autosave 恢复，损坏/不可读数据不覆盖原 autosave 并回退标准双人对话，New Project 语义不变。1440×900 Web 雾白主题和隔离 Electron 1680×1018 内容区均已留证；该成果尚未执行 `app:deliver`，固定 App 仍为 `7ff9aa5`。
- 当前固定 App 来源为 `b8da5f4f36a40010541700171cb246f2ca9de17b`（`chore/integrate-04.9-before-product`），日常入口仍为 `~/Applications/PreVision.app`。2026-07-29 本任务前后只读 `app:status` 都是该来源；当前任务分支 `Contains installed source: yes`、`Exact installed source: no`。04.19 未执行 `app:deliver`，没有更新或启动固定 App。
- 静态 Web 运行底座已由 `chore/web-runtime-foundation` 的 `067cd00` 集成为 `d0c7815`。当前集成线还包含 Web 首页开场动画与导演台组装提交 `6da46a0`、`995f9e7`、`d28eaf5`：`web/home/` 已存在，`/` 构建为响应式开场首页，动画完成事件返回后单次同源进入 `/director/`。它仍不是业务后端，尚未部署公网，也不改变固定 App。
- 固定 LAN 最新预览任务 `04.19-stable-lan-latest-preview` 已在独立任务分支形成实现并完成首轮独立 R2 指定的三项返修：用户级 LaunchAgent 固定 `4174`，只绑定默认物理 `en*` 私有 IPv4，并以 hostname/IP Host allowlist、同子网远端源和网络变化 fail-closed 拒绝公网/VPN/Tailscale。runtime 每个请求核对既有 schema 2 pointer，只从精确 sourceCommit 的 Web 白名单 Git blobs 在私有 Application Support 构建并原子切换 manifest/hash 已核验快照；active snapshot 每次 serving 前重新核验，损坏即撤销 ready 并返回 503。installer 对所有动作统一拒绝 root/非当前 UID，严格核对 managed owner/type/mode 和完整确定性 plist；Node 24 loader 由 plist bootstrap hash 锚定，并只执行安全 FD 已验证的同一模块字节。Node 24 定向 LAN 9/0、原 Web 25/0、latest-preview 56/0、i18n 217/0、foundation 与必要 build 均通过；真实 LaunchAgent 已从 schema1 原位升级到 `c0fb7d0` 的 schema2 安装态，restart 后 PID 更新且固定 URL、Host/来源拒绝、安全头与 ready 均通过。当前运行快照与 stable pointer 均为 `6058255777ceb78db6fd0627094710a8dfe19937`，pointer SHA-256 前后仍为 `eb48c2dc...b5bf`，固定 App 仍为 `b8da5f4...`；第二真实 LAN 设备执行通道仍缺，任务保持 `IMPLEMENTED_UNVERIFIED`，等待固定 04 对返修 HEAD 另组独立 R2。
- Web 跨平台压力验证已在 `test/web-cross-platform-stress` 完成，基于 `d0c7815`。零依赖工装固定覆盖默认/多对象/4096×2048 全景/反复切换/播放/截图/短录屏/Seedance/长会话，不新增产品限制。macOS Chrome standard 已在本机物理硬件通过 9/9 且未观察到崩溃或 WebGL context lost；资源计数、JS heap 与长会话进程树 RSS 均上升，是资源滞留风险的强信号，但单次 120 秒观察不直接证明无界内存泄漏或用户上限。Safari 因 Remote Automation 未授权而 blocked，Windows Chrome/Edge 因无真实 Windows 环境而 not_run。
- Three.js 场景资源生命周期修复已进入当前源码，集成线包含 `d4bb4be`、`f0f0572`、`62e20fe`。同机 Chrome standard 的 4×24/40 次切换从 geometry `565→17,244`、texture `28→988` 收敛为 geometry `452→451`、texture `27→27`；120 秒后仍为 geometry `451→448`、texture `27→27`，短播放 60 FPS/p95 17.7ms。工装用独立深冻结 oracle 在每轮校验真实 scene identity 与 24 个对象；项目级 `assetTex` owner 还覆盖打开成功/失败、新建失败回滚、跨场景共享和 orphan GC。原始去敏证据位于 `docs/qa/three-resource-lifecycle/`。当前固定 App 来源 `b8da5f4` 已包含 `62e20fe`；跨平台 Safari/Windows 真机证据仍未补齐。
- 合并/rebase/cherry-pick 冲突：无。

## GitHub 状态

- Remote：无。
- `origin`：不存在。
- GitHub CLI：已安装，版本 2.94.0。
- GitHub 登录：未登录。
- GitHub Actions、Issue 表单和 PR 模板：仓库中已经存在，但尚未在远程执行。
- 许可证：尚未选择；在确定许可证前不得公开发布源码。

## 技术栈

- 前端：原生 HTML、CSS、JavaScript；没有框架和打包器。
- 3D：Three.js r128，发行代码内嵌在 `预见PreVision.html`。
- 桌面：Electron 43.1.0、Electron Forge 7.11.2、CommonJS 主进程/预加载。
- 离线录屏辅助：html2canvas 1.4.1。
- 包管理器：npm，lockfileVersion 3。
- 推荐 Node：22（`.nvmrc`）；`package.json` 允许 20–24。
- 当前系统默认 Node 26.3.0 超出允许范围，测试可运行，但 Electron 打包必须切换到兼容 Node。
- 2026-07-14 使用兼容的 Node 24.14.0 重新生成当前 UI 的 macOS arm64 `.app`，并通过 `npm run app:update` 更新固定入口；没有使用系统 Node 26 打包。

## 原始 checkpoint 验证

下表记录基础建设开始前的原始代码证据。当时 `npm test` 等价于完整应用测试加桌面壳测试；当前命令已按 `TEST_STRATEGY.md` 分层。

| 命令/检查 | 结果 | 耗时 | 说明 |
| --- | --- | ---: | --- |
| `npm ls --depth=0` | 成功 | <1s | 四个固定开发依赖已安装，无缺失依赖。 |
| `npm test` | 成功 | 8.16s | 应用 252 项、桌面壳 20 项，共 272 项通过。 |
| `npm run package` | 成功 | 11.71s | 在隔离目录、兼容 Node 24 环境生成 arm64 `.app`。 |
| `npm run make:mac` | 成功 | 18.77s | 生成约 120MB ZIP。 |
| `npm run make:mac:dmg` | 成功 | 18.28s | 生成约 120MB DMG。第一次隔离 PATH 漏掉 `/usr/sbin` 导致 `bless` 不可见，修正审计环境后通过。 |
| `codesign --verify --deep --strict` | 成功 | <1s | 当前为本地 ad-hoc 签名，不等于 Apple Developer 签名或公证。 |
| lint | 未配置 | — | `package.json` 没有 lint 命令。 |
| typecheck | 未配置 | — | 项目为原生 JavaScript，没有 TypeScript/typecheck。 |

所有构建验证均未调用真实 AI 服务，也未修改用户项目数据。

## 当前分支测试入口

| 命令 | 范围 | 当前结果 |
| --- | --- | --- |
| `npm test` / `npm run test:core` | 国际化资源、应用脚本加载、boot、默认项目/对象/镜头 | 7 项通过 |
| `npm run test:module -- <module>` | 单体 HTML 中登记模块的目标断言 | `a706161` 的既有 01.10 验收证据：history 29、layout 143、playback 32、robustness 57、actor 147、camera 84、project 103、timeline 124、viewport 31、storyboard 172 项通过；这是既有证据，不是 04.7 重新执行。 |
| `npm run test:app` | 主应用完整行为 | `a706161` 的既有 01.10 验收证据：926 项通过；04.7 未重新执行。 |
| `npm run test:desktop` | Electron 结构、安全边界、IPC、国际化接入与语法 | `a706161` 的既有 01.10 验收证据：47 项通过；04.7 未重新执行。 |
| `npm run test:local-install` | 固定路径、身份校验、并发锁、回滚、中断恢复、来源追踪与防分支回退 | `a706161` 的既有 01.10 full 验收证据：安装事务 36 项 + 交付门禁 13 项通过；04.7 未重新执行。 |
| `npm run test:i18n` | 双语言 key、浏览器/Node 运行时、引用和直接中文守卫 | 04.7 已重新执行并通过：21 项，0 失败。 |
| `npm run test:web` | 静态清单、首页、导演台依赖、确定性、路径/符号链接、MIME、Host、安全响应头与压力工装契约 | 04.7 已重新执行并通过：Web runtime 10 项 + 压力工装 14 项，0 失败；该命令不冒充 Safari/Windows 真浏览器实测。 |
| `npm run test:coordination` | 共享任务登记、硬/软冲突、并行写上限、只读审查和释放 | 04.7 已由 `test:foundation` 重新执行并通过：31 项，0 失败。 |
| `npm run test:foundation` | 文档、QA、任务协调、忽略规则、公开提交边界与国际化契约 | 04.7 已重新执行并通过：基础 93、协调 31、国际化 21、项目输入探针启动 11 项，均为 0 失败。 |
| `npm run test:full` | 完整应用、静态 Web、压力工装、桌面壳、本机安装、仓库与国际化 | `a706161` 的既有 01.10 验收证据：应用 926、项目输入 Web/Electron、Web、桌面 47、安装事务 36、交付门禁 13、基础 93、协调 31、国际化 21 项通过；04.7 不冒充重新执行 full。 |
| `npm run test:impact -- --base a706161...` | 根据 Git 变化执行最小安全并集 | 04.7 已重新执行并通过：检测 8 个文档变化文件，仅命中 `foundation`、`web-stress`，实际运行 `test:foundation` 与 `test:web` 并全部通过。 |

CI 使用 `npm run test:full`，不会把快速的 `npm test` 当成完整回归。

## 已确认可运行范围

- macOS Apple Silicon 桌面应用可以启动。
- Electron 本地打开/保存桥接、导出目录和应用内截图桥接存在并通过结构测试。
- 主应用可以在 VM 测试环境完成启动、项目加载、三维场景和核心交互流程。
- B「电影控制台」主界面、C「导演专注」模式、本地统一 SVG 图标和四主题已实现。
- 2026-07-13 已在 1316×768、1440×900、1728×1117 的 MacBook 目标尺寸中人工检查四主题、左右栏状态、时间轴三态和导演专注；截图与尺寸记录位于 `docs/qa/ui-cinema-console/`。
- 2026-07-14 当前工作树 HTML 与新 `.app` 包内 HTML 的 SHA-256 已核对一致；用户 Applications 目录中的 App 与原常用开发包入口均已实际启动，确认 B 主界面、四主题和 C 专注模式进入/退出。
- 独立本地网页副本已通过仅绑定回环地址的 HTTP 预览，在 1316×768 和 1440×900 检查主题、专注状态恢复、页面尺寸与控制台；证据位于 `docs/qa/local-entry-refresh/`。
- 静态 Web 工程现在可用 `npm run web:build` 生成 `dist/web/`，并用 `npm run web:preview` 在 `127.0.0.1` 校验部署清单后预览。当前仓库的 `web/home/` 已接入首页开场动画，`/` 完成动画后进入 `/director/`；若未来构建输入确实缺少 `web/home/index.html`，底座仍保留确定性导演台回退。尚未选择公网静态主机、域名或访问控制。
- Web 压力工装可先用 `npm run web:stress:check` 只读审计浏览器条件，再用 `npm run web:stress -- --browser <chrome|edge|safari> --profile standard --attestation physical-machine` 执行有界面真浏览器矩阵。2026-07-15 的 macOS Chrome 轮已真实完成 4096×2048 全景、40 次场景切换、播放、PNG 截图、2 秒 MP4 录屏、Seedance ZIP 和 120 秒长会话；证据未保存媒体或项目字节，也未观察到崩溃/context lost。默认 `unattested` 结果不计入矩阵；Windows 上获批 3D GPU VM 可使用 `approved-3d-gpu-vm`。完整口径见 `docs/WEB_PERFORMANCE.md`。
- language key 基础覆盖浏览器入口文案和 Electron 菜单/文件对话框；以后新增直接中文运行时代码会被自动测试拒绝。
- 2026-07-14 录屏界面反馈已在 1316×768、1440×900、1728×1117 检查：新用户默认固定右栏与完整时间轴、普通属性入口不再覆盖时间轴、右栏双三角分隔条、时间轴高度拖拽无黑帧、纯白/纯黑/自定义颜色地面及四主题/专注往返；证据位于 `docs/qa/recording-ui-feedback/`。
- 2026-07-14 品牌副标题已在 1440×900、1728×1117 确认与 25px 图标底边相差约 0.22px，四主题对齐一致；1316×768 仍按断点隐藏副标题且顶栏无溢出。证据位于 `docs/qa/brand-subtitle-alignment/`。
- 电影控制台顶栏、模式轨、动态布局/主题/播放状态与地面控件已使用 language key；无障碍名和即时提示分别通过 `data-i18n-aria-label`、`data-i18n-tooltip` 取词。
- 2026-07-14 已将原桌面仓库 `out/` 中的旧构建 App 和旧备份移入废纸篓；随后用 Node 24.14.0 再次真实运行 `app:update`，固定 App `app.asar` SHA-256 为 `7bdda3bf…`，bundle ID、0.7.0、codesign 和 arm64 通过，本次构建源 App 已自动清理、事务残留为 0。Spotlight 的现存匹配只剩 `~/Applications/PreVision.app`，且已从该精确路径启动。
- 已确认过去“代码完成但 App 不变”的根因：四个专用任务在兄弟分支独立提交，最后运行安装的分支会独占固定 App，其他已完成分支不会自动进入安装包。统一交付门禁用包内来源记录和 Git 祖先校验阻止这种回退。
- 2026-07-14 首次受门禁保护的一键交付从 `e969d11` 构建；`app:status` 显示 installed/current source 精确一致，包内主 HTML SHA-256 与源码一致，bundle ID、0.7.0、ad-hoc codesign 和 arm64 通过。固定 App 自动打开后，真机确认整合后的 `3D DIRECTOR` 品牌副标题、导演台、监视器、属性栏和调度轨道正常显示。
- 2026-07-14 将近期开发预览统一收口为 0.7.1；交付门禁重新执行 436 项应用、23 项桌面、36 项安装事务、13 项来源门禁、58 项基础和 21 项国际化测试，并从唯一固定入口 `~/Applications/PreVision.app` 启动验收。
- 2026-07-15 将截图/录屏保存位置、离线分镜规划器 v2 与语义代理模型库 MVP 统一交付为 0.7.2；正式门禁通过应用 562、桌面 43、安装事务 36、交付门禁 13、基础 66、协调 20、国际化 21 项。固定 App 真机确认顶部捕获入口、分镜窗口应用内全屏/Esc 还原，以及 11 类语义代理和独立宽高深编辑；临时 3m 儿童验证对象未写入 autosave，调试端口已关闭并恢复普通启动。
- Bug、新功能、UI 和工程发布四个专用对话已逐一确认采用 ADR-0003：用户可见任务只有在 Node 20–24 `app:deliver` 成功并从固定 App 人工看到变化后才能完成。
- 2026-07-16 固定入口治理升级为分管自治：固定 `01`–`04` 分别负责 Bug、功能、UI 和工程，可拆单、原子 reserve、创建并命名侧栏 Worktree 临时工、组织独立只读 review 和部门验收；普通无冲突任务成功预留后直接派发并通知 `00`。固定 `00`–`04` 仍不得亲自实现、持有 write claim、在长期对话堆代码或自行集成；固定 `05`/`99` 继续只读。
- 用户原则上只与 `00` 讨论；`00` 保持可对话，由固定 `01`–`04` 自治管理并立即派发真实侧栏临时工。所有新写任务在创建侧栏任务前通过 `task:reserve` 原子声明 owner、精确 baseline、模块、UI 表面、数据区域和文件；临时工用 token 原子转换为 claim。active claim、未过期 reservation 与未解决 ACTIVE-without-claim 隔离项共同限制为两个写槽，隔离项存在时新 reserve 全局 fail closed。逻辑范围重叠在 reserve 前阻止并报告 owner/后果/顺序；只有文件重叠时允许按通知 `00` 的顺序机械集成。升级前 legacy active claim 保持有效。
- common-dir 登记以 schemaVersion/coordinationVersion 3 持久化完整生命周期，并把 execution visibility 与 integrity issues 独立查询。`DESKTOP_LIVE` 需要 canonical thread/client、rollout/thread DB/sidebar present、name=set、Desktop-owned started turn 和实际观察；ghost cancel 不能在同一命令伪造 completed，必须先持久化 stop verification。worker/reviewer 完成不能释放 claim；REVIEW 列表必须完整有序，返工后重新 stop verification，PASS 后只允许严格机械 closeout。只有 `00` 在中央分支当前 HEAD 验证受审列表/closeout 的保序一对一 stable patch-id 等价映射、最终树/净 diff 和最终回归后 release，再执行或重试归档。
- app-server 创建必须完成 `thread/start`、`thread/name/set`，启动 turn 后持续读取通知到 `turn/completed`；这只证明后台连接完整性。独立 app-server 可以真实写入但 Desktop 仍显示 notLoaded、无圆圈或不实时刷新，因此默认标记 `BACKGROUND_ONLY`/“后台施工”。必须实时可见时保留同一 thread，等待受支持的 Desktop 启动或一次人工触发，不复制任务、不要求用户手动创建 Worktree。
- 当前场景创作工作树的左栏以当前项目为上下文先列场景，进入场景后逐卡显示镜头并可返回上一级；镜头新增、选择、删除和重命名仍同步同一份场景数据。底栏只保留红色预演、前后镜头、时间码和调度轨道，右侧监视器及播放镜头/本场景入口保留。
- 时间轴运行状态已收敛为 `full` / `hidden`；旧 `filmstrip` 与 legacy `previz_motion_open='0'` 载入时迁移为 `hidden`，不会恢复已移除的底栏镜头条。
- 人物右栏已在同一“人物姿态与全身关节”区域提供头部、躯干、左右肩肘腕与髋膝踝调节；新增腕/踝枞轴、双轴角度、保存恢复和旧项目缺字段回退已有自动断言。
- 新建场景只提供双人对话·正反打、单人表演·景别递进、动作追逐·轴线连续和环境建立·空间交代四模板；剧本分镜可手动锁定或按对白/动作/环境/单人关键词自动选择，并保存稳定 `templateId`。
- 离线分镜规划器 v2 在任务分支把单场景中英文剧本拆为稳定节拍，使用与 UI locale 分离的规则生成 4–8 镜临时计划；用户可检查理由/置信度、角色映射和节拍覆盖，编辑主体/时长/FOV，确认后才复制当前场景人物与对象并写入 project v5。分析、过期与取消不写项目或 autosave。
- 分镜规划窗口默认适配普通剧本，可由右下角手柄连续缩放至视口边界，或切换应用内全屏；Esc 优先退出全屏。标题、角色映射和底部动作固定，节拍/镜头列表独立滚动，窗口大小不持久化。
- 语义代理模型库提供成人男性、成人女性、儿童、狗、SUV、树 A/B、石头、灌木、房屋体块和道路；人物类以直接按钮创建高识别低面数导演台代理，类型决定轮廓/精确配色，宽高深独立保存，切换类型默认不覆盖用户尺寸。道路按地表参考处理，未知未来类型保持原 ID 并安全降级。

## 当前不应被误认为已完成的范围

- Windows 桌面端未维护。
- Windows Web Chrome/Edge 尚无真实 Windows 主机或获批 3D 加速 VM，压力矩阵仍为 `not_run`；不得用 CI 或 macOS 浏览器替代。
- Safari Web 压力矩阵因本机尚未由用户启用 Remote Automation 而为 `blocked`；工装不会自行更改系统授权。
- Intel Mac 构建未验证。
- 应用未使用正式 Apple Developer ID 签名，也未公证。
- Web 公开部署和 GitHub Pages 未建立。
- ComfyUI 节点未实现。
- 与真实付费 AI 视频服务的自动端到端测试未建立。
- 录屏、视频编码和下载在自动测试中使用浏览器/API 桩，不能替代每次发布前的真机验证。
- Seedance 2.5 白模参考包仍是 NOT INTEGRATED 任务分支能力：除 02.13 的真实 Electron/WebGL 材料恢复证据外，01.16 已在 macOS Chrome 150 的真实 LAN 5 秒镜头复现 recorder 时间轴漂移 RED，并以启动 primer、实际 `start` 确认、预渲染绝对采样、尾帧 drain 和仅限 H.264 精确样本数的容器时间轴归一化取得 150 帧 / 5 秒 / 30fps 严格绿。首轮 R2 曾发现只改 sample duration 会遗漏多 `moof` 的 `tfdt` gap；返工后的 inspector 明确记录 gap/overlap，normalizer 同步 `tfdt/tfra`，最终 strict 再要求零断裂。两次真实点击所得 ZIP 均通过 manifest/current inspector/assert，ffprobe 为 5.000000 秒、150 packets 且 DTS 连续。用户随后发现 pending C01 包在切到 C04 后仍会被“重新下载”；现在 pending 包下载前以当前工程/场景/scope/aspect/作者内容 SHA-256 指纹和 shot scope 当前索引复核，真机 C01→C04 回归证明首次点击生成 S1C4、第二次才下载，包内 `shotIndex=3` 且 105/3.5/30 严格通过。第二轮 R2 又用同一个 shot 对象原地改动证明只比 ref/index 仍会漏判；返工后同对象和 scene scope 内容编辑都会让旧包失效，pending 身份不再保留 project/scene/shot 对象引用。证据见 `docs/qa/seedance-white-model-chrome-mp4-validation/`。它仍缺长录制、独立 R2 复审结论、中央集成和固定 App 最终回归，因此不得表述为已发布能力。

更多限制见 [已知问题](KNOWN_ISSUES.md)，功能级状态见 [功能登记](FEATURE_REGISTRY.md)。

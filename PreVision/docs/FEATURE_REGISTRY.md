# 功能登记

本表按当前代码和截至 2026-08-01 的验证结果登记。机器可读版本位于 `qa/feature-registry.yaml`。

## 状态定义

- **VERIFIED**：代码存在，并有当前自动测试、构建或明确人工验证证据。
- **IMPLEMENTED_UNVERIFIED**：代码存在，但缺少足够的真实环境端到端验证。
- **PARTIAL**：核心能力存在，但范围、精度或平台覆盖未达到完整产品状态。
- **PLANNED**：未实现或没有代码证据。

## 登记表

| ID | 模块 | 功能 | 状态 | 当前证据与边界 |
| --- | --- | --- | --- | --- |
| APP-001 | 启动 | 离线页面启动与默认项目 | VERIFIED | `测试/冒烟测试.mjs` 在 VM 中执行真实应用脚本并完成 boot。 |
| APP-002 | 项目 | localStorage 自动保存、恢复与不可信输入归一化 | VERIFIED | 正常 800ms timer 与 `pagehide`/`beforeunload` 共用唯一同步幂等结算入口，仅在 pending 时执行 `syncScene`、资产 GC、完整写与 quota-lite 降级；隔离 Chromium 已覆盖 Web/Electron reload、force reload、close-relaunch。既有 corpus 继续覆盖 v1–v5 迁移、v6+ 拒绝、全场景校验、事务打开与 commit fault 回滚；真实大图片配额仍需发布前验证。 |
| APP-003 | 项目 | Electron 原生打开/保存项目 | VERIFIED | IPC、preload 边界和往返结构测试通过；真实 Chromium probe 由 startup、Web FileReader 与 Electron IPC 驱动统一归一化，并确认 project/storyboard markup 只显示文本且无节点/事件执行；Linux CI 无 DISPLAY 时强制使用 Xvfb，系统文件对话框本身不在自动测试中点击。 |
| APP-004 | 撤销 | 连续 Cmd/Ctrl+Z 多步项目撤销 | VERIFIED | 执行级回归覆盖 macOS Cmd+Z、Windows/Linux Ctrl+Z 与多步恢复；textarea、各类 input、select、contenteditable/子节点和 composing 期间保留原生编辑语义，并断言项目、选择、history 与 autosave 零副作用。 |
| APP-005 | 启动 | 首次启动白马欢迎场景与四态恢复分流 | VERIFIED | 核心/项目/演员/摄影机/光影/布局、国际化、Web、影响与全量回归覆盖 missing/restored/invalid/unavailable、旧版迁移、损坏字段和启动 autosave 零写入；1440×900 Web 与隔离 Electron 1680×1018 内容区验证 fresh/reload/edit+reload/invalid/New Project，证据见 `docs/qa/first-run-white-horse-welcome/`。清空站点数据会再次进入 firstRun；最小启动结构门禁不替代完整不可信输入安全层。 |
| APP-006 | 应用命令 | 最上层 modal 命令所有权与背后快捷键隔离 | VERIFIED | 唯一实时入口以 Chromium `:modal` 区分原生 top-layer 与 `dialog.show()`，并覆盖嵌套/重开/ARIA modal；自动回归和真实 Chromium DOM probe 证明 modal 内工作区快捷键、项目 open/save renderer 回调不穿透，按钮激活、Tab、textarea 原生撤销和滚动仍工作。真 Chrome 与隔离 Electron 开发态复核 Space/Delete、无 modal 恢复和分镜全屏双阶段 Esc，证据见 `docs/qa/modal-command-ownership/`；系统 open/save 对话框本身未在自动测试中点击。 |
| I18N-001 | 国际化 | 浏览器/Electron language key 基础与新增中文守卫 | PARTIAL | 双语言包、两端运行时和契约测试已通过；电影控制台顶栏、模式轨、布局状态、主题、播放及地面控件已迁移，`data-i18n-aria-label`/`data-i18n-tooltip` 覆盖无障碍名和即时提示；其他历史界面中文尚未全部迁移。 |
| SCN-001 | 场景 | 细化人物、道具、车辆、白马和环境库 | VERIFIED | 自动断言覆盖人物五官朝向、道具/车辆细节、白马解剖轮廓与马头局部零件挂载。 |
| SCN-002 | 角色 | 站/坐/蹲/倒地与头、躯干、肩肘腕、髋膝踝关节调节 | VERIFIED | `actor` 模块验证人物专属控件显隐、双轴调节、保存恢复、旧项目回退与重置。 |
| SCN-003 | 挂载 | 人物骑乘马匹、宿主路径 | VERIFIED | 低矮贴背马鞍、白马专用默认骑姿、与演员/马匹保存顺序无关的旧默认值幂等迁移、非 1:1 马/骑手缩放、挂载变换、朝向、路径所有权及 project v5 往返均有自动断言；车载和普通物体挂载保持原默认姿态。1440×900 开发预览覆盖默认/缩放骑手、卸载重挂与重开恢复，并留有空马近景。 |
| SCN-004 | 空间 | 高度、一键贴地、失踪恢复 | VERIFIED | 高度、贴地、坐标保护、定位和全局取景测试通过。 |
| SCN-005 | 碰撞 | 接触允许与基础防穿透 | PARTIAL | 包围盒和大步移动算法有测试；不是连续刚体或人体物理仿真。 |
| SCN-006 | 地形 | 连续方形沙漠与人物/骑乘贴地 | VERIFIED | 确定性高度场同时驱动可见网格和贴地采样；自动测试覆盖人物、白马、骑手、移动、序列化与碰撞隔离，Electron 开发预览已近景检查。 |
| SCN-007 | 场景模板 | 双人对话、单人表演、动作追逐与环境建立四种构图 | VERIFIED | 四模板均有 4 个合法镜头、可从新建场景弹窗创建，并以 `templateId` 保存往返。 |
| SCN-008 | 场景 | 语义代理模型库 MVP | IMPLEMENTED_UNVERIFIED | 首批 11 类代理、类型/尺寸分离、道路碰撞豁免、project v5 往返和 `qa/semantic-proxy-catalog.json` 已有自动证据；0.7.2 固定 App 已人工确认新增代理、11 类下拉选项及 3m 儿童尺寸独立编辑。Seedance 实机多镜头一致性仍需用户用导出参考帧验证，因此整体状态暂不升级。 |
| SCN-009 | 角色与场景 | 快速预览模型包：沉船、海马骑乘与可调巫师 | IMPLEMENTED_UNVERIFIED | 首轮独立 R2 因沉船斜向假碰撞和人工证据不足退回，旧 review/stop/视觉证据已失效；同一任务已完成分段定向船体代理、0°/45°/90° 回归、海马骑乘五点近景、真实 280px inspector 与播放性能采样的任务级返工和验证。产品语义已收敛为“沉船 + 海马 + fallback wizard foundation”：程序化巫师仅保留 `char` 全身 rig、帽/杖随骨、project v5 兼容与性能基线，不代表原人物高精度；高精度原人物直绑骨由独立后续任务承担。须等待新一轮独立 R2 与中央集成验证；固定 App 尚未包含本任务。 |
| SCN-010 | 角色 | 导演台高识别人物代理 | IMPLEMENTED_UNVERIFIED | 男人、女人、小朋友直接入口复用 `adult_male` / `adult_female` / `child`；真实 Three bounds、精确主色、五官方向、主要关节层级、project v5 往返、autosave 与 Undo 已有任务级自动证据。legacy `characterStyle:'wizard'` 无损归一化为成人男性代理并停止保存旧字段；普通无 `semanticType` 的旧 char 只做运行时视觉默认，不静默回写。隔离 Electron 双尺寸证据见 `docs/qa/director-proxy-characters/`；等待独立 R2 与中央集成，固定 App 未更新。 |
| CAM-001 | 摄影机 | 多点直线/曲线路径 | VERIFIED | 直线与 centripetal Catmull-Rom 路径代码和测试存在。 |
| CAM-002 | 摄影机 | 逐点位置、朝向和 FOV | VERIFIED | 独立子轨道和插值测试通过。 |
| CAM-003 | 摄影机 | 点选机位快速监看 | VERIFIED | 摄影机点与角色点独立预览测试通过。 |
| CAM-004 | 摄影机 | 对象路径复制为邻近运镜路径 | VERIFIED | 点数、轨迹、偏移和整轨平移测试通过。 |
| CAM-005 | 摄影机 | 专业电影摄影机机位可视化 | VERIFIED | 真实 Three.js 投影回归覆盖 48px 屏幕尺寸、独立 overlay camera 动态裁剪与渲染失败恢复；1440×900 Chrome 深/浅主题和 1229×768 Electron 开发实例已留证，monitor 不含编辑摄影机。 |
| CAM-006 | 摄影机 | 机位点作者期高度 0.2–30m | IMPLEMENTED_UNVERIFIED | 共享 authoring helper 已覆盖 inspector、视口、对象路径复制和 timeline camera key 粘贴；独立 oracle 验证上下界、NaN/Infinity、project v1–v5 历史有限高点无损载入、30m 往返及 15→30 插值，camera/project/playback/timeline/viewport、i18n、app、project-input、impact 与显式 full 均通过，04.16 inspector rail 探针保持全绿。新 BrowserWindow-owner Electron 已在 CSS 1440×900、DPR 2 下以真实 UI 事件验证 inspector 30m、Alt 0.2/30、timeline 47→30 且源 47 不变，以及 15→30 播放/中点/终点预览，并留存 `docs/qa/camera-point-height-30m/electron-1440x900-30m.png`；等待实现者之外的独立 R2 和中央集成，固定 App 来源仍为 `b8da5f4`，尚未包含本任务。 |
| CAM-007 | 摄影机 | 当前镜头 9:16 独立重构图 | IMPLEMENTED_UNVERIFIED | project v5 仅按需保存 `reframeByAspect['9:16']`，共享纯 helper 统一 monitor、Follow/编辑导演台、PNG 与两类视频导出；U6 独立数学断言、v1–v5 round-trip/malformed、原 camera 字节不变、草稿单次提交/取消零写、capture 故障恢复及 P8 静态边界均通过。Leo 真实截图驱动的 P1 返修已在右侧 monitor 下加入与 toolbar 共用状态的 9:16 编辑入口，展开布局一步可进入并聚焦主画布，两入口 `aria-pressed` 同步且无横向溢出；layout/viewport/i18n 定向门禁通过。隔离 Electron 保持 `PreVision 02.9 Preview — NOT INTEGRATED`；尚缺 1440×900 仓库截图、完整真实 UI 点击矩阵、实现者之外独立 R2 与中央集成，固定 App 未更新。 |
| CAM-008 | 摄影机 | FOV 锁定与时间线一致性 | IMPLEMENTED_UNVERIFIED | FOV 显示、提交和运行采样不再依赖 yaw/pitch 控件的 disabled 状态；actor/global/manual × custom/pointSync/arcLength 的基础点、普通 key、非 key draft、point preview、连续手势、Undo、project v5 保存重开与 capture gate 已有执行级回归。committed key 同步 `camKey.fov` 与兼容标量 `shot.fov`，draft 在记录前零 project/history/autosave 写，`shotCam`、monitor、播放与自动 capture 共用有效 FOV；yaw/pitch 和旧 v1–v5 数据语义不变。真实 Chrome 150 隔离 LAN 任务预览完成男人1/custom/t=0 原生 39°→79°、构图变化、播放不回退和保存重开，并复核 global/manual、pointSync/arcLength，console 无错误；等待实现者之外的独立 R2 与中央集成，固定 App、稳定 4174 和远端均未更新。 |
| TIME-001 | 时间轴 | 多对象、多轨关键帧时间轴 | VERIFIED | 节点时间、片段整体拖动、播放头和项目序列化测试通过。 |
| TIME-002 | 时间轴 | 缓动与自定义贝塞尔速度曲线 | VERIFIED | 数学端点、采样和序列化测试通过。 |
| TIME-003 | 时间轴 | 独立、节点同步和摄影机跟随 | VERIFIED | 节点同步、点数不一致拒绝和联动映射测试通过。 |
| TIME-004 | 时间轴 | 调度轨道完整/收起两态、高度拖动与旧偏好迁移 | VERIFIED | 状态 API 仅输出 `full` / `hidden`，历史 `filmstrip` 与 legacy `previz_motion_open='0'` 载入时迁移为 `hidden`；自动断言继续覆盖高度拖动、renderer 同帧重绘、红色预演和右侧监视器保留，底栏不再承载镜头缩略条。 |
| TIME-005 | 时间轴 | 镜头时长绝对秒边界与派生关键帧区间条 | IMPLEMENTED_UNVERIFIED | 时长编辑采用 preview/commit/cancel 三态与 0.1s 精度；camera 保持 shot-local、actor/prop 保持 scene-global 绝对秒，截断、sceneDur 越界、联动或物化不安全均在首写前双语拒绝。非 custom 模式仅在能精确物化现有到达秒数时同事务转 custom。区间条严格由相邻 times/ease 派生且 `pointer-events:none`；v1–v5 与有限 >20s 时长往返、拒绝零副作用、一次 history/autosave、Undo/reopen 及 Electron 1440×900 已验证。等待独立 R3 reviewer 与中央集成，固定 App 尚未包含本任务。 |
| TIME-006 | 时间轴 | 0.1s 尺规与整秒/半秒强吸附 | IMPLEMENTED_UNVERIFIED | 尺规与 lane 共用 0.1s/0.5s 网格，1.0s 使用大刻度；snap ON 时 camera、legacy actor/path、generic preview key/group、红色播放头、尺规和 lane 空白统一以 0.1s 落点，整秒/半秒在约 8 CSS px 内强吸附。snap OFF 或按住 Option/Alt 时播放头与关键帧只 clamp 合法边界并保持连续，pointermove 以三位小数实时更新可见 status；多选仍按 anchor 移动并保持相对间距，session-only 开关不写 project/history/autosave。01.15 新合同执行级 RED 为 timeline 192/2；最小返修后 Node 24 timeline 194/0、playback 42/0、layout 160/0、i18n 217/0、build 和 diff-check 已通过；精确 baseline 的同一 timeline 命令为 188/1，既有 AutoKey 夹具失败已最小返修。隔离 Electron 标题和时间轴静态呈现已在实际 2560×1409 CSS 窗口核验，PNG 实际 1396×768；Computer Use 原生拖拽未验证，静态截图不作为交互 PASS。证据见 `docs/qa/timeline-tenth-ruler-half-second-snap/` 与 `docs/qa/timeline-playhead-snap/`。等待实现者之外的独立 R2 与中央集成，固定 App 未更新。 |
| VIEW-001 | 导演台 | 空白区环绕、俯仰和平移 | VERIFIED | 轴心稳定和指针交互测试通过。 |
| VIEW-002 | UI | 场景栏与右栏宽度调节 | VERIFIED | 状态持久化、280px 下限、最大半屏、指针无过渡拖动、双三角分隔条和键盘调宽测试通过；1316×768 人工确认属性轨入口直接固定展开且不覆盖时间轴。 |
| VIEW-003 | UI | 标签屏幕尺寸限制与显隐 | VERIFIED | 近景缩放和标签开关测试通过。 |
| VIEW-004 | UI | B「电影控制台」界面层级与统一图标 | VERIFIED | `UI v3: 主题、面板状态、专注模式与菜单` 回归覆盖全局栏、上下文栏、模式轨、监视器/属性栏、菜单互斥和本地内联 SVG；品牌副标题字号、下移与图标底边对齐有布局回归及 `docs/qa/brand-subtitle-alignment/` 人工证据。 |
| VIEW-005 | UI | 石墨深海、雾白日间、暮光靛蓝和胶片琥珀四主题 | VERIFIED | `setUITheme` 回归覆盖四主题切换、刷新恢复和损坏值回退；主题只写 `previz_ui_theme`，自动断言确认项目、撤销栈和项目自动保存不变。 |
| VIEW-006 | 布局 | 左右栏与时间轴两态 API | VERIFIED | 新用户默认固定右栏与完整时间轴；普通属性入口直接固定展开，`peek` 只保留给导演专注临时查看；时间轴只保留完整/收起两态并兼容迁移旧 `filmstrip` 偏好，回归覆盖偏好恢复、即时模式提示、主视口与监视器画幅重算。 |
| VIEW-007 | 导演台 | C「导演专注」模式 | VERIFIED | `setDirectorFocus`、顶栏入口和 `⇧⌘F` 已实现；自动回归确认进入/退出不覆盖栏位偏好并触发 renderer 重算，目标尺寸截图包含暮光专注态。 |
| VIEW-008 | 导航 | 项目场景→当前场景镜头的左栏分层钻取 | VERIFIED | 左栏以当前项目为上下文先列场景，进入场景后逐卡显示镜头缩略图并提供返回上一级；镜头新增、选择、删除和重命名复用当前场景的 `shots` 数据，底栏不再重复显示镜头条。自动测试覆盖层级切换、操作同步和保留预演/监视器。 |
| LIGHT-001 | 光影 | 三轴太阳、色温、强度和实时阴影 | VERIFIED | 两套渲染器阴影、光向、预设和数据保存测试通过；不是光线追踪。 |
| BG-001 | 背景 | 全景天空球、导演台地面外观与场景图板 | PARTIAL | 棋盘格、纯白、纯黑、自定义颜色/图片、资产保存往返和全景导出阴影切换测试通过；画布右上角的三种快捷外观及 4 倍棋盘单格已进入 0.7.1 固定 App；自定义图片素材适配仍需按具体素材人工校准。 |
| STORY-001 | 分镜 | 共用四构图模板的离线剧本分镜规则引擎 | VERIFIED | 四种稳定模板继续作为构图语法，可手动锁定或由与 UI 翻译分离的对白/动作/环境/单人规则路由；这是确定性离线规则，不是 AI 语义理解。 |
| STORY-002 | 分镜 | 离线分镜规划器 v2：中英文节拍、临时预览与动态 4–8 镜 | VERIFIED | 合成语料与全量测试覆盖确定性、角色映射、覆盖/合并、分析/取消零写入、project v5 往返、连续缩放、应用内全屏/还原和独立滚动；开发预览覆盖 1316×768/1440×900，0.7.2 固定 App 又确认窗口打开、应用内全屏和 Esc 还原。范围仍限单场景、最多两名主要角色，不含复杂遮挡和动作路径自动生成。 |
| CAP-001 | 截图 | 摄影机画面和应用工作区截图 | VERIFIED | 浏览器回退与 Electron `capturePage` 边界测试通过；顶部两种截图先弹系统保存位置，取消无写入，renderer 绑定的一次性 token 只允许写入批准路径，完整结果路径右锚定显示。 |
| CAP-002 | 录屏 | 摄影机画面与应用工作区录屏 | IMPLEMENTED_UNVERIFIED | 顶部两种录屏在开始前选择保存位置，取消不开始；录制 Blob 通过一次性目标 token 落盘。MediaRecorder/html2canvas 流程有 API 桩测试；每次发布仍需真机检查帧率、音视频容器和长录制稳定性。 |
| OUT-001 | 导出 | 镜头视频、参考帧和结构化描述 | IMPLEMENTED_UNVERIFIED | 底部当前镜、本场景和普通 Seedance 参考视频在 02.14 任务分支共用白模 profile 的权威导出 FPS=24，并保留原包含终点采样及 MP4→WebM 容器优先级。MP4 从最终 H.264/ISO-BMFF sample table 严格重读；WebM 从最终 EBML 视频轨、Block sample、TimecodeScale 和逐 sample 时间码严格重读。capture 自动回归覆盖 MP4/WebM 当前镜/本场景 24fps、wrong/drop/extra 零保存、顶部 30fps 与 project/history/autosave 零写；真 Chrome 0.5 秒当前镜 MP4 为 H.264/avc1 13 packets / 24fps，返修轮按命令未跑真实 WebM。未调用付费 AI；尚缺真实 WebM/长本场景、同一独立 R2 复审、中央集成与固定 App。证据见 `docs/qa/unified-video-export-24fps/`。 |
| OUT-002 | 导出 | Seedance 2.5 白模参考包 | IMPLEMENTED_UNVERIFIED | 纯 planner 同源驱动一镜一 clip、实际采样、timestamp 与实际 ZIP manifest；同步单帧 clay 覆盖、LIFO 恢复、A/B transaction、v1–v5、9:16、project/history/autosave 零写已有自动回归和真实 Electron/WebGL 证据。01.16 以 primer/start 确认、预渲染绝对采样、尾帧 drain 及精确 sample 门禁修复 Chrome 时间轴，并对多 `moof` 同步归一 `tfdt/tfra`。02.14 进一步把权威 fps 固定为 24：5 秒为 120 个半开样本 `0..5-1/24`，最终 inspector 要求精确 sample count/24fps 且 gap/overlap 为零，wrong-fps/drop/extra 在 ZIP/download 前拒绝。真 Chrome 0.5 秒白模最终 H.264/avc1 为 12 packets / 0.5s / 24fps，第二次显式点击后 ZIP 下载完成。pending 包仍以当前工程/场景/scope/aspect/作者内容 SHA-256 指纹和 shot 索引复核；单镜 >29.5s 首写前拒绝。尚缺长录制、独立 R2、中央集成与固定 App。证据见 `docs/qa/seedance-2.5-white-model-export-profile/`、`docs/qa/seedance-white-model-chrome-mp4-validation/` 与 `docs/qa/unified-video-export-24fps/`。 |
| DESK-001 | macOS | Apple Silicon `.app`、ZIP、DMG | VERIFIED | 2026-07-13 已验证 `.app`、ZIP、DMG；2026-07-14 使用 Node 24 重新 package 当前 UI，包内 HTML 哈希与源码一致，ad-hoc codesign、安装入口启动及 B/C 交互通过。 |
| DESK-005 | macOS | 固定本机 App 可恢复且防分支回退的统一交付 | VERIFIED | `npm run app:deliver` 串联全量测试、来源追踪、安全替换和自动启动；安装器拒绝脏工作区、detached HEAD、兄弟/落后分支以及打包期间发生变化的源码，并保留原有身份、锁、回滚和中断恢复保护。并行任务仍需先明确整合最新已交付提交。 |
| DESK-002 | macOS | 正式签名与 Apple 公证 | PLANNED | 没有 Developer ID/公证配置。 |
| DESK-003 | macOS | Intel/x64 构建 | PLANNED | 当前命令和验证只覆盖 arm64。 |
| DESK-004 | Windows | Windows 桌面端 | PLANNED | 当前依赖和 Forge makers 明确暂停 Windows。 |
| WEB-001 | Web | 本地离线浏览器模式 | VERIFIED | HTML 保留浏览器文件/下载回退；2026-07-14 独立副本经回环 HTTP 在 1316×768、1440×900 完成主题与专注检查，控制台无运行错误。 |
| WEB-002 | Web | 公开在线体验 | PLANNED | 没有托管配置、部署或线上隐私策略。 |
| WEB-003 | Web | 响应式首页开场影片与魔法溶解 | IMPLEMENTED_UNVERIFIED | `web/home/` 已接入本地 4K H.264 影片、SVG 排版、有界确定性颗粒溶解、减少动效和 `prevision:intro-complete` 事件；完成事件监听返回后以单次同源导航组装到 `/director/`，返回/BFCache、媒体失败及持续 8 秒无进度的 stall 会恢复完整首页。Node 24 Web 契约与脚本行为测试覆盖短暂/永久 stall 和旧 watchdog 失效，390×844/1440×900 回环检查、导演台直达/刷新/返回通过；内嵌浏览器有声媒体被拒绝时已验证恢复但未能完成正常影片端到端，Safari/Windows 真机及公网部署仍未验证。 |
| WEB-004 | Web | 固定局域网最新预览与用户级 LaunchAgent | IMPLEMENTED_UNVERIFIED | 独立 LAN runtime 从既有 schema 2 pointer 验证精确 clean sourceCommit，并只把该 commit 的 Web 契约白名单 Git blobs 在私有 Application Support 中构建、核验、原子切换为 ready snapshot；固定 `4174` 只绑定默认 `en*` 物理 LAN 私有 IPv4，Host 与远端源限当前 hostname/IP 和同一子网，拒绝 VPN/Tailscale/任意 Host。首轮独立 R2 指定的返修已加入统一 non-root/current-UID 与 managed owner/type/mode/完整 plist 门禁、由 plist hash 锚定且只执行安全 FD 已验证字节的 Node 24 loader，以及每次 serving 前的 active snapshot 完整核验/损坏原子失效。LAN 9/0 与原 Web、latest-preview、foundation、i18n、build 门禁通过；真实 schema1→schema2 原位升级和 restart 后仍精确服务 pointer commit。第二真实 LAN 设备执行通道与返修 HEAD 的独立 R2 尚待补齐。 |
| INT-001 | 集成 | ComfyUI 节点 | PLANNED | 仓库无节点实现。 |
| OSS-001 | 开源 | GitHub 公开仓库与许可证 | PLANNED | 本地无 remote，GitHub 未登录，许可证未选择。 |

## 更新规则

- 行为变化必须在同一任务更新本表和 YAML。
- 从 `IMPLEMENTED_UNVERIFIED` 升级到 `VERIFIED` 必须增加可重复证据。
- 历史日志或聊天描述不能单独作为升级依据。
- 删除或替代功能时保留 ID，在备注中记录迁移，不复用旧 ID 表示新语义。

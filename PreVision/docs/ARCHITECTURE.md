# 架构

## 总览

PreVision 当前是“离线优先的单页三维导演台 + 薄 Electron 外壳”。业务逻辑集中、部署简单，但主文件耦合度已经较高。

```text
预见PreVision.html
  ├─ i18n/locales/* + i18n/runtime.js
  ├─ 内嵌 Three.js r128
  ├─ HTML / CSS / 原生 JavaScript
  ├─ B 电影控制台 UI Shell 与 C 导演专注状态
  ├─ 四套本机主题与栏位布局偏好
  ├─ 项目数据 v5 与 localStorage 自动保存
  ├─ 主导演台 WebGLRenderer
  ├─ 摄影机监视器 WebGLRenderer
  └─ 截图、录屏、导出与项目编辑逻辑

electron/main.cjs
  ├─ i18n/node.cjs + 共用语言资源
  ├─ BrowserWindow 与原生菜单
  ├─ 项目文件打开/保存
  ├─ 导出文件落盘
  └─ 应用窗口截图

electron/preload.cjs
  └─ contextBridge 暴露受限 previsionDesktop API

web/runtime-contract.json
  ├─ 白名单静态输入与首页插槽
  ├─ / 与 /director/ 路由
  ├─ MIME、缓存和安全响应头
  └─ 确定性 dist/web 清单
```

## 主要文件

| 路径 | 责任 | 当前风险 |
| --- | --- | --- |
| `src/main.js` + `src/ui/` + `src/persist/` | P9 后的 classic-runtime 源片段：main 路由/boot，shell、timeline、inspector、persistence 分别拥有 UI 与项目持久化职责 | 仍以单一脚本词法环境交付；跨模块调用暂由既有 bridge 保持。 |
| `预见PreVision.html` | P9 构建产物：内嵌 Three.js 与组装后的单一应用 script | 恰有两个 bare script blocks；不直接手改。 |
| `electron/main.cjs` | 桌面生命周期、窗口、菜单、文件和截图 IPC | `sandbox:false`；API 边界需持续保持最小化。 |
| `electron/preload.cjs` | 渲染进程到主进程的受限桥 | 每个新增 IPC 都需校验输入，不能暴露通用 Node 能力。 |
| `i18n/` | 浏览器/Node 取词运行时与 `zh-CN`、`en-US` 语言资源 | 新 key 必须在全部语言包同时存在；历史内联中文仍需按模块迁移。 |
| `scripts/update-local-app.mjs` | 固定 App 安全换位、回滚和来源谱系门禁 | 只允许干净命名分支，且必须包含当前安装包记录的来源提交。 |
| `scripts/deliver-local-app.mjs` | 全量测试、构建、安装、启动的一键本机交付 | 用户可见任务的必经完成步骤；失败即不交付。 |
| `scripts/web-runtime-lib.mjs` | 静态 Web 白名单构建、清单校验和回环预览核心 | 只能服务清单文件；兼容单体页面的 CSP 仍含 `unsafe-inline`。 |
| `web/runtime-contract.json` | 首页插槽、导演台入口、共享资源、路由、MIME 与响应头契约 | 首页与导演台当前同源共享 localStorage；公开分享前需独立安全审计。 |
| `forge.config.cjs` | macOS arm64 打包、图标、临时签名、ZIP/DMG | 当前仅 ad-hoc 签名；发布前需正式签名/公证策略。 |
| `测试/冒烟测试.mjs` | VM 中运行真实应用脚本并使用 DOM/WebGL/API 桩验证行为 | 支持 core、登记模块和完整应用回归；分镜模块另读取 `qa/storyboard-corpus.json` 的合成语料，仍不能替代真机媒体和视觉验证。 |
| `测试/桌面壳测试.mjs` | Electron 安全结构、IPC 和语法 | 主要是结构断言，不会真正打开系统对话框。 |

## 运行时边界

### 渲染进程

- 加载本地 `file://` 页面，不依赖在线前端资源。
- `contextIsolation:true`、`nodeIntegration:false`。
- 所有三维对象、路径、镜头、时间轴和项目状态位于页面 JavaScript。
- 浏览器模式下使用下载回退；Electron 模式通过 `window.previsionDesktop` 调用受限原生能力。

### 主进程

- 只接受项目打开/保存、普通导出落盘、路径查询，以及受一次性目标授权约束的截图/录屏保存请求。
- 外部 HTTP(S) 链接交给系统浏览器，应用内部拒绝任意导航。
- 普通导出默认目录为用户文稿目录中的 `预见 PreVision/导出`；顶部两种截图与两种录屏先用系统保存对话框选择目标。
- 捕获目标授权由主进程生成随机 token，绑定发起 renderer、限制捕获类型、12 小时自动过期并在首次写入时消费；renderer 能看到选择结果用于状态展示，但不能提交任意绝对路径写文件。

### 国际化边界

- `i18n/locales/` 是用户界面翻译文本的唯一来源；语言包可同时被浏览器和 CommonJS 加载。
- 渲染进程通过 `PreVisionI18n.t()` 和 `data-i18n*` 取词；Electron 主进程通过 `i18n/node.cjs` 取词。
- 默认语言为 `zh-CN`，当前同时维护 `en-US`；缺失 key 直接显示 key，避免静默返回错误语言。
- `qa/i18n-policy.json` 记录规范边界，`npm run test:i18n` 检查语言包一致性、运行时行为、引用完整性和新增直接中文。
- 主应用历史内联中文属于已登记技术债。普通任务触碰到相关文案时就地迁移，不在无关任务中一次性重写全部 UI。

### 静态 Web 边界

静态 Web 构建不新增第二套导演台业务代码，而是把同一浏览器运行时和明确白名单资源组装成可部署目录：

```text
runtime-contract + 预见PreVision.html + i18n/vendor/icon + 可选 web/home
  → 临时 staging 校验
  → 把登记的导演台共享资源改为根绝对 URL
  → 排序后的文件哈希清单
  → dist/web
  → 静态主机/CDN
```

- `/` 是可替换首页插槽；`web/home/index.html` 不存在时确定性回退到导演台。
- `/director/` 是固定导演台入口，共享资源位于根 `assets/`、`i18n/` 和 `vendor/`。
- Node 回环预览器只模拟生产 MIME、路由和响应头，校验 Host、文件哈希、路径穿越与符号链接；它不是业务服务器，也不能监听公网地址。
- 首版不需要账号、数据库、云存储或常驻服务进程。把页面分享成链接只需静态托管；访问控制、撤回、云端项目和审计若进入需求，再单独设计业务服务。
- 当前页面仍以 localStorage 自动保存；同源首页不得加载第三方脚本。公开载入不受信任项目之前，必须先处理项目解析、DOM XSS、资源隔离和 CSP 收紧。

完整部署契约见 `docs/WEB_RUNTIME.md`。

## 数据模型

- 项目根：`{ app, version, name, aspect, assets, settings, created, scenes }`
- 当前数据版本：5。
- 场景：角色/道具、太阳、背景、可选地面外观、镜头列表和可选 `templateId`。地面外观支持棋盘格、纯色和引用 `project.assets` 的本地图片；旧 v5 场景缺失地面或模板字段时分别回退棋盘格或无模板关联。
- 镜头：时长、锁定对象、FOV、摄影机点、逐点朝向/FOV、位置/朝向/FOV 时间、缓动和同步方式。
- 对象：类型、位置、姿态、挂载关系、高度、调度点、节点时间、缓动和摄影机时间联动。语义代理对象可额外保存可选 `semanticType` 和独立 `dimensions`；`kind` 继续负责旧行为分发，`semanticType` 只表达 Seedance 参考语义，切换类型默认不覆盖用户尺寸。人物 `joints` 字典直接保存头部、躯干、肩肘腕与髋膝踝角度；旧项目缺少新腕/踝/躯干轴时以 0° 兼容恢复。
- 新建场景的双人对话、单人表演、动作追逐和环境建立四模板仍是唯一构图源。离线分镜规划器把单场景中英文文本解析为对白、动作与环境节拍，先生成瞬时 `StoryboardPlan`，再按用户确认把动态 4–8 镜物化到这四套模板语法；情绪和节奏只参与确定性的焦段、机位和时长微调。
- 左栏导航不复制项目数据：项目层直接读取 `project.scenes`，进入场景后直接读取该场景运行时 `shots`；新增、选择、删除或重命名仍走原场景/镜头数据入口。当前显示“场景列表”还是“镜头列表”属于瞬时 UI 导航状态，不进入项目 v5、撤销栈或自动保存。
- 自动保存 key 仍名为 `previz_autosave_v3`，但载入后统一迁移到数据版本 5；修改 key 前必须设计兼容迁移。
- 正常 800ms 自动保存与页面终止事件共用 `flushPendingAutosave()`：只有存在 pending timer 时才同步 `syncScene()`、GC 资产并写入，入口先取消 timer，因此重复生命周期通知最多产生一次有效写入。完整写失败继续使用无图片资产的 quota-lite 降级；序列化、存储和状态提示异常不得抛出到生命周期边界，也不得主动删除此前有效 autosave。

### 启动与自动恢复边界

- 只有 `previz_autosave_v3` 不存在（`getItem()` 精确返回 `null`）才属于 `firstRun`，并在内存中建立白马骑手、四镜 16.5 秒和侧向太阳的欢迎 project v5。欢迎项目不带专用持久化标记或 `templateId`，后续仍完全使用普通项目编辑、保存和导出链路。
- 结构可启动的缺版本、历史版本 1–4 与当前版本 5 autosave 属于 `restored`，载入后只在内存迁移为版本 5；显式未来版本、JSON 损坏或启动所需字段/数值损坏属于 `invalid`。读取 `window.localStorage` 本身或 `getItem()` 失败属于 `unavailable`。
- `invalid` / `unavailable` 只在内存打开既有标准双人对话并显示对应 language key 警告。启动分类与项目装载不调用 `markDirty()`、不写 `previz_autosave_v3`；主题/栏位等既有 UI 偏好仍按各自语义独立维护。“原数据未覆盖”只描述启动阶段，用户之后真实编辑仍按既有自动保存语义写入。
- 用户主动点击 New Project 始终调用原有 `newProject()` 标准双人对话工厂，不复用欢迎种子。
- `normalizeProjectData()` 是 startup、浏览器 FileReader 和 Electron renderer IPC 打开的共用不可信输入边界：无版本与 v1–v5 会生成全新的 v5 白名单对象，未来/非法版本、错类型、非有限数值和不合法引用会被拒绝；危险 map key 使用无原型容器或固定字段白名单。有限的历史 path/camera time、ease、partial camAim 和 timeLinkShot 错配按旧 `ensure*/repairPathTimes` 语义确定性修复。Quota-lite autosave 中悬挂的图片资产引用按背景清空、地面回退棋盘和对象去除资产引用安全降级。文件/图片 hard cap、图片 magic、远程资源策略、CSP 与 sandbox 不属于该层。
- 项目打开是两阶段事务：完整归一化成功前不写运行时；commit fault 会恢复 project、场景/镜头选择、Three/UI、历史、计时器、资源缓存、分辨率标签和瞬时 03.5 预览。成功打开或回滚恢复比例后都会调度 renderer、shotCam 与 PIP 画幅更新。失败打开不排队 autosave；已有 dirty timer 只继续保存打开前的合法编辑。动态 project/storyboard 文本以 `textContent`、`value` 或 DOM 属性写入，不把项目字符串解释为 HTML。
- 真实 DOM probe 在 Web FileReader、Electron IPC 与 startup 每个入口前安装 execution/error/dialog sentinel，并在隔离 Chromium session 中验证 project 与 storyboard 文本 sink。`test:full` 通过跨平台 Node wrapper 启动该 probe：Linux 无 `DISPLAY` 时必须使用 `xvfb-run -a`，缺少 Xvfb 会明确失败而不会跳过；GitHub Actions 显式安装 `xvfb`。

### 语义代理模型库边界

- 语义代理目录由运行时代码和 `qa/semantic-proxy-catalog.json` 共同约束，首批包含成人男性、成人女性、儿童、狗、SUV、树 A/B、石头、灌木、房屋体块和道路。
- 语义 ID、稳定配色、默认宽高深和显示 language key 可自动校验；实际生成视频中的场景一致性不在本地测试中调用或断言。
- 人物库直接以 `adult_male`、`adult_female`、`child` 创建低面数导演台代理。人物几何共用一套命名 rig 与 stage 渲染链；主色覆盖头、躯干和四肢，高反差材料只承担五官、正面方向和肩肘腕/髋膝踝标记。真实 Three bounds 在工厂内归一化到约 1.78m、1.66m、1.2m，monitor 与捕获不另建模型。
- `characterStyle:'wizard'` 只被不可信输入边界识别为 legacy `char`：归一化后显式迁移为 `semanticType:'adult_male'` 并丢弃旧字段，其他演员数据仍走 project v5 白名单。缺少 `semanticType` 的普通历史 `char` 运行时使用成人男性视觉默认，但序列化保持字段缺失，避免仅为视觉默认改写旧项目。
- Road/道路是 surface-like reference proxy：参与视觉参考和保存，但在基础碰撞中被视为豁免对象，避免被解释为巨大墙体。
- 未知未来 `semanticType` 必须安全保留，不升级 project v5，也不阻断旧项目打开。

### 离线分镜规划边界

- `STORYBOARD_ANALYSIS_LEXICON` 是稳定业务分析资源，不从 `i18n/locales/` 读取关键词；语言包只负责把模板、理由、置信度和控件标签展示给用户。相同原文、选项和场景人物摘要在不同 UI locale 下生成相同计划。
- 计划只含纯 JSON：原始剧本文本、稳定节拍/镜头 ID、类型、角色映射、覆盖关系、理由 code、置信度和有限数值。分析、重新映射、编辑时长/FOV、过期和取消均不调用 `syncScene()`、`markDirty()` 或 localStorage。
- 用户确认应用后才同步来源场景，并复制其人物、对象、背景、地面、太阳和调度路径来创建新场景；只替换名称、描述、原剧本、`templateId` 与镜头。节拍、理由、置信度和 `StoryboardPlan` 本身不进入 project v5。
- 基础摄影约束以最多两名主要角色形成的轴线为准：所有规划机位保持同侧，镜头锁定现有主体以维持入画，视线方向按主/次角色区分，并钳制机位、FOV 与时长。复杂遮挡搜索、三人以上调度和动作路径自动生成不在当前边界内。
- 分镜规划器窗口尺寸是瞬时 UI 状态，不写入 project、autosave 或本机偏好。普通模式用视口夹取后的 `left/top/width/height`，右下角手柄连续调整宽高；应用内全屏只填满当前 Web 内容视口，不调用 macOS 系统全屏或改变主窗口。固定标题/角色映射/footer 与独立的节拍/镜头滚动区共同保证长计划可读。

## UI Shell 状态边界

- 主题使用 `previz_ui_theme`；左栏、右栏、时间轴分别使用 `previz_railc`、`previz_rightc`、`previz_timeline_state`。这些都是本机 UI 偏好，不进入项目 v5、撤销栈或 `previz_autosave_v3`。
- `setLeftPanelState`、`setRightPanelState`、`setTimelineState` 是栏位状态入口；右栏 `peek` 不覆盖固定偏好。时间轴状态只输出 `full` / `hidden`，旧 `filmstrip` 与 legacy `previz_motion_open='0'` 只作为兼容输入并迁移为 `hidden`。
- 新用户默认固定右栏与完整时间轴；普通属性轨入口直接进入固定布局，`peek` 只用于导演专注模式中的临时属性查看。
- 左栏在当前项目的场景列表和当前场景的镜头列表之间分层钻取，镜头层提供返回上一级；镜头缩略图和新增入口只在左栏出现。底栏只负责红色预演、前后镜头、时间码和调度轨道，右侧监视器及播放镜头/本场景入口保持独立，不随镜头条迁移而删除。
- `setDirectorFocus` 只在 `appWorkspace` 上叠加瞬时专注状态，不改写左、右、时间轴的基础数据属性与持久值。
- 栏位、专注模式和窗口尺寸变化通过 `scheduleUIResize` 合并到主渲染循环，在同一帧先更新尺寸再 render；主视口与监视器分别缓存宽高/DPR，避免时间轴拖拽反复清空 WebGL canvas。该链路只更新 renderer、摄影机投影和播放头 DOM，不改摄影机、路径或时间轴项目数据。

## 三维与时间

- 主导演台使用自由观察 `viewCam`；右侧监视器和导出使用 `shotCam`。
- 摄影机与对象路径支持直线或 centripetal Catmull-Rom 曲线。
- 摄影机位置、朝向和 FOV 是可独立计时的子轨道。
- 对象路径可独立计时、按摄影机节点同步或跟随摄影机时间。
- 缓动支持匀速、线性、缓入、缓出、缓入缓出和自定义三次贝塞尔曲线。

## 保存与输出

- localStorage 提供自动恢复；资源超配额时有不含图片的降级保存，归一化恢复时悬挂图片引用确定性降级而不拒绝整份项目。
- 项目文件使用 JSON/`previz` 扩展名，由用户主动打开和保存。
- 截图和视频使用 `preserveDrawingBuffer`、MediaRecorder、Canvas 捕获及 html2canvas；桌面顶部捕获在写入截图或开始录制前取得保存目标，取消系统对话框不会写文件或进入录制状态。摄影机与工作区录屏固定使用预选容器后缀，构造、启动、运行或保存失败均回到未录制状态；工作区异步初始化可安全取消，并以六小时上限落在一次性授权的有效期内。
- Seedance 2.5 白模参考包由纯 planner 固化一镜一 clip、30fps 采样、timestamp 和 manifest 元数据；单镜超过 29.5 秒在首个编码帧前拒绝，场景总长超过 30 秒只生成确定性 continuation group。白模 clay 覆盖只包住一次同步 `renderer.render`，使用独立 LIFO、exactly-once 账本恢复 mesh material、scene/renderer/camera 与编辑辅助显隐，绝不把共享材质替换跨到异步 MediaRecorder 生命周期。包内 manifest 从实际 ZIP 条目反算 bytes/SHA-256/顺序后再允许浏览器下载；首版不接 Electron chooser 或 electron-ipc，也不写 project/history/autosave。
- 外部 AI 服务不在应用内直接调用；当前输出是参考画面、视频和结构化描述。

## 构建

- `npm ci` 安装固定依赖。
- `scripts/build-app.mjs` 从 `src/main.js` 的显式 P9 marker 按顺序插入 `src/ui/shell.js`、`src/persist/persistence.js`、`src/ui/inspector.js`、`src/ui/timeline.js`，再将既有 core/stage/playback/viewport/capture/prompt bridge 置于同一 classic script 前部。
- `npm start` 启动 Electron Forge 开发模式。
- `npm run package` 生成 `.app`。
- `npm run app:update` 先显式构建 macOS arm64 App，再把已验证的新包安全更新到 `~/Applications/PreVision.app`；该路径是日常唯一用户入口。
- `npm run make:mac` 生成 arm64 ZIP。
- `npm run make:mac:dmg` 生成 arm64 DMG。
- `out/` 是可再生构建产物，不能提交。
- `npm run web:build` 以零新增依赖生成 `dist/web/`；`npm run web:preview` 仅在 `127.0.0.1` 模拟静态生产行为。
- `dist/` 是可再生静态 Web 产物，不能提交；静态 Web 不经过 Electron 签名、公证或固定 App 交付。
- Forge 在包内写入 `prevision-build.json`，记录 commit、branch、时间和可交付状态。固定 App 更新器读取该记录并用 Git 祖先关系阻止并行兄弟分支相互覆盖。
- `npm run app:deliver` 是日常业务交付入口；`npm run app:update` 仅是底层安全安装器，`npm run package` 只产生临时构建包。

本机更新流程只替换 App bundle：打包前先恢复固定入口并取得同级事务锁，恢复工作区用与该锁同 inode 的 `Owner.lock` 绑定；新包校验 bundle ID、ad-hoc 签名与 `app.asar` 哈希后再分阶段换位。可捕获的换位失败立即恢复旧包，进程中止留下的已识别事务会在下次运行时先恢复或确认固定入口。最终安装经再次校验后，`app:update` 删除本次生成的精确源 App；安装或清理失败时不回滚已验证入口，并保留源 App 供诊断。脚本不扫描删除其他路径、用户项目、Application Support 或导出目录。

## 下一步架构原则

- 不在普通功能任务中直接拆分整个单文件应用。
- 新增复杂逻辑优先形成纯函数边界和独立测试，再评估迁出 HTML。
- 数据格式变化必须带迁移与往返测试。
- 媒体、文件和 Electron IPC 保持在明确边界内，不把 Node 能力扩散到渲染进程。
- 架构调整单独立项、单独分支，并先写决策记录。

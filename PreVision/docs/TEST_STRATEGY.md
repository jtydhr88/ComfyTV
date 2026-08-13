# 测试策略

## 目标

- 快速确认应用能启动和读取核心数据。
- 修改文档、Electron 或仓库配置时，不默认运行全部应用断言。
- 修改主应用、数据格式或跨模块逻辑时，仍保持安全的全量回归。
- 明确自动测试不能替代的视觉、媒体和系统交互检查。

## 测试层级

### L0 仓库基础检查

命令：`npm run test:foundation`

覆盖：必需文档、QA YAML 基本结构、并行任务范围分类与冲突门禁、忽略规则、package scripts、禁止提交目录、本机绝对路径，以及国际化规范测试。

适用：文档、Issue/PR 模板、工作流和 QA 登记。

### L0.25 并行任务协调

命令：`npm run test:coordination`

覆盖：跨 Worktree 共享登记、文件软冲突、模块/UI/数据硬冲突、两个写任务上限、只读审查和安全释放。

适用：任务分流、冲突检测脚本、范围分类、验收模板和开发流程。该测试使用临时登记文件，不修改真实活动任务状态。

### L0.5 国际化契约

命令：`npm run test:i18n`

覆盖：`zh-CN`/`en-US` key 集合一致、key 格式、变量插值、浏览器和 Node 取词、DOM `data-i18n*` 应用、应用引用完整性，以及规范基线之后运行时代码新增直接中文的拦截。

适用：任何用户文案、主 HTML、Electron 菜单/对话框、语言资源和国际化运行时。语言资源本身允许包含对应语言文本；其他运行时代码必须使用 key。

P9-0a 只为国际化契约测试建立 synthetic conformance foundation 和 fixture oracle。P9-0b 已启用真实 assembled runtime candidate adapter：它从 P9 的 `src/main.js` 与受控 source fragments 组装运行时后，以 Acorn AST 的位置和明确 UI sink 角色提取 `textContent`、`title`、`value`、`alert`、`prompt`、`showConfirm` 的直接文字候选，再交给同一 bounded evaluator；模板或不能唯一证明的 producer必须 fail closed。adapter 不按产品函数名、中文文本或变量名决定通过，并不扩展 P9-0a 的 binding/producer 语义。现有 direct-Han、key、locale/runtime 引用门禁继续生效。

在合成矩阵内，分析器只消费正向白名单中的形态：同一 synthetic candidate 内唯一、非 async、非 generator 的 top-level `FunctionDeclaration`；简单且名称互不重复的 `Identifier` 参数或 literal default 参数；非空且互斥的纯 consumer-assignment body 或纯 direct-call wrapper body；最多一层直接参数 wrapper/monitor；direct literal / `Identifier` argument；最多一层不可写 `const Identifier -> terminal literal`；以及与上述 statement 共存的 top-level harmless `EmptyStatement`（额外分号）。direct-call argument 中的 nested `CallExpression` 不在白名单。binding identity 是 top-level unique declaration 节点，name 只用于 bounded top-level unique lookup 与诊断，未解析到唯一声明节点不得消费；nested lexical scope、shadow 和局部 binding 不分析，出现即 fail closed。consumer 仅在 `complete===true && ambiguous===false` 时消费。任一相关 provenance incomplete 时整体 producer 必须 fail closed；白名单内重复 binding 或重复 finding 报告 ambiguous。async/generator、重复参数、mixed/empty/未知函数体角色、`FunctionExpression`、callable Arrow、callee alias、多层 wrapper、所有 return producer、external const default、参数依赖 default、regular/module export、try/catch/finally、nested function、let/var、object/array/template/class/container、conditional/logical/sequence、所有 loop、complex binder、member/computed（唯一例外是结构化 consumer sink 的 `<identifier>.textContent = <resolved parameter identifier>`）、import/await/export-all/import.meta、reflection/eval、assignment/update/control-flow 等均不得猜测通过。P9-0b 的 runtime adapter 将负责从真实文件提取 root/sink candidate 后调用本 bounded evaluator；P9-0a 不实现产品 adapter。

分析矩阵使用统一 oracle：`H` 表示唯一完整且精确一个发现；`0` 表示唯一完整且无发现；`I` 表示 incomplete；`A` 表示 ambiguous。矩阵至少覆盖 binding、alias、default、monitor/forward、return、unsupported 和 metamorphic 变异；注释、普通字符串、产品函数名或 fixture 名不得成为测试特判。Acorn 仅作为现有 lockfile 下的 test-only parser 复用，不是本轮新增依赖；若缺失必须明确失败或 fail closed，不能退回正则 fallback。完整威胁模型、parser 决策和逐 fixture 矩阵见 ADR-0016。

### L0.75 静态 Web 契约

命令：`npm run test:web`

覆盖：静态输入白名单、首页插槽与本地依赖、导演台根路径资源、确定性文件清单、缺失/远程素材原子失败、保留路径/符号链接/FIFO/路径穿越、回环监听、Host 校验、MIME、HTML 路由回退、资源 404、安全响应头、CLI 关闭，以及真浏览器压力工装的矩阵、参数、安全清理与证据去敏契约。

适用：Web 构建/预览脚本、`web/` 契约或首页、主 HTML、浏览器 i18n、vendor、运行时图标、压力工装和 package 构建入口。测试只写系统临时目录，不生成仓库 `dist/`，也不会启动真浏览器或生成性能结论；真机证据按 L4.5 单独执行。

### L1 核心冒烟

命令：`npm run test:core`

覆盖：真实 Three.js 脚本加载、应用脚本编译/boot、默认项目、默认场景、对象和镜头存在。通过 `测试/冒烟测试.mjs --core` 在核心断言后提前结束。

适用：低风险 UI 文案、样式和不会改变业务模型的小改动。

### L2 模块测试

- 主应用指定模块：`npm run test:module -- <module>`
- 主应用：`npm run test:app`
- Electron：`npm run test:desktop`
- 本机固定 App 安装：`npm run test:local-install`
- 静态 Web：`npm run test:web`
- 仓库基础：`npm run test:foundation`

主应用模块名登记在 `qa/test-impact-map.yaml`，包括 camera、timeline、actor、project、capture、lighting、background、layout 等。模块测试先完成真实应用 boot，只统计目标模块断言，并在该模块最后一个测试段之后提前结束；为保持测试状态可靠，目标模块之前必要的运行时准备仍会执行。

当前 `预见PreVision.html` 是单文件，Git 无法只靠文件名判断其中改动的是摄影机还是时间轴。因此任务验收单必须明确模块，并使用 `npm run test:impact -- --base <commit> --module camera`。没有可靠模块归属、跨模块或修改测试夹具时，仍运行完整的 `test:app` 行为断言。Electron 或文档变化不需要运行这些断言。

`test:local-install` 同时覆盖安全替换/回滚和本地交付门禁：只有干净的命名分支、包含已安装来源提交、且打包来源与当前 HEAD 完全一致时才可更新固定 App。它不替代真实交付；用户可见任务最终仍执行 `npm run app:deliver`。

### L3 全量回归

命令：`npm run test:full`

覆盖：完整应用行为、静态 Web 契约和压力工装契约、Electron 桌面边界、本机安装和仓库基础检查。它不替代 L4.5 的真浏览器压力实测。

必须用于：跨模块改动、数据格式、摄影机数学、时间同步、保存恢复、录屏导出、依赖、发布和未知影响。

### L4 构建与真机

命令与步骤见 `RELEASE_PROCESS.md`。

覆盖：`.app`、ZIP、DMG、codesign、实际启动、窗口尺寸、系统文件对话框、截图和录屏。

### L4.5 Web 真浏览器压力验证

环境审计：`npm run web:stress:check`

标准轮：`npm run web:stress -- --browser <chrome|edge|safari> --profile standard --attestation <physical-machine|approved-3d-gpu-vm>`

矩阵与指标口径见 `qa/web-stress-matrix.json` 和 `docs/WEB_PERFORMANCE.md`。标准轮固定覆盖默认场景、典型多对象场景、4096×2048 的 2:1 全景、场景反复切换、短镜头播放、截图、短录屏、Seedance 导出和长会话；这些参数是测试夹具，不是产品限制。

压力结论必须来自目标系统上的有界面真浏览器。执行者必须显式声明本机物理硬件；Windows 上亦可显式声明已获批的 3D GPU VM。默认 `unattested` 结果只作诊断，不计入矩阵。Windows Chrome/Edge 必须在真实 Windows 主机或启用 3D 加速的获批 Windows VM 内运行，CI 结构测试、macOS Edge 或模拟指标不能替代。Safari 未授权 Remote Automation 时记录为 `blocked`，工装不得自动执行 `safaridriver --enable`。

Chromium 的浏览器进程树内存：macOS 记录 RSS 之和，Windows 记录 Working Set 之和；二者不得当作完全同口径数值。Windows PowerShell/CIM 采样间隔不快于 2 秒，并在证据中标注采样开销。Safari 无法可靠归属相关进程集时必须写 `unsupported`，不能填 0 或估算。Chromium 关闭遮挡/后台降频时必须在证据写明调度策略，visibility 变化仍使 FPS 样本失效。每轮原始证据先完成页面、浏览器、服务、profile 和构建目录清理，再通过严格 Schema/跨字段一致性检查写入去敏 JSON。

## 影响选择

`npm run test:impact -- --base <commit>` 根据 Git 变化和 `qa/test-impact-map.yaml` 给出并运行最小命令。没有 base 时检查工作区与当前 HEAD。单体 HTML 中能明确归属的修改追加 `--module <name>`；该参数不能把测试脚本自身、未知文件或跨模块变化降级为局部测试。

规则：

- 只改 `docs/`、`qa/`、`AGENTS.md`、社区模板：foundation。
- 改 `electron/`：desktop + foundation。
- 改 `scripts/update-local-app.mjs` 或本机安装回归：local-install + foundation，并执行真实构建检查。
- 改 `i18n/` 或用户文案：i18n + 对应的 app/desktop + foundation。
- 改 Web 脚本、`web/`、主 HTML/browser i18n/vendor/图标：web + 对应的 app/desktop + foundation。
- 改压力工装、矩阵或性能证据契约：web + foundation；工装契约测试通过不等于目标平台 L4.5 实测通过。
- 改 Forge/package/图标：web + desktop + foundation，发布前再构建。
- 改主 HTML且模块明确：对应 module + foundation；模块不明或跨模块：app + foundation。
- 同时命中多个模块：取并集。
- 无法识别或影响数据/媒体/依赖：full。

## 自动测试证据要求

- 每条结果记录命令、退出码、耗时和环境。
- 失败不能被“历史上通过”覆盖。
- 新功能没有测试时登记为 `IMPLEMENTED_UNVERIFIED` 或 `PARTIAL`。
- 修 Bug 时新增能在修复前失败、修复后通过的断言。

## 必须人工验证的范围

- UI 布局：目标窗口尺寸、展开/折叠、右栏最大宽度、轨道紧凑模式。
- 视觉：背景透视、阴影、标签遮挡、模型穿插观感。
- 系统能力：文件对话框、Finder 导出目录、Gatekeeper。
- 媒体：截图范围、录屏启停、帧率、长录制、输出文件可播放。
- Web 性能：目标系统真浏览器、硬件加速状态、实际刷新基线、长会话资源趋势、崩溃和 WebGL context lost。
- 发布：DMG 安装、首次启动和新用户数据目录。

人工结果写入任务验收单，不用模糊的“看起来正常”。

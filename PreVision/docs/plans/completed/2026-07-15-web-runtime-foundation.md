# 任务：静态 Web 运行与部署底座

- 状态：completed
- 日期：2026-07-15
- 对话：04｜工程、构建与发布 · Web 运行底座
- 分支：`chore/web-runtime-foundation`
- 基线：`f75f2dbbf23c7a1c62823af7accd69125c229b05`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 负责人：Codex

## 并行任务声明

- 任务 ID：`04.web-runtime-foundation`
- 模式：write
- 模块：`repository`, `release`
- UI 表面：无
- 数据区域：无
- 预计修改文件：`.gitignore`、`package.json`、`scripts/web-runtime-lib.mjs`、`scripts/build-web.mjs`、`scripts/preview-web.mjs`、`web/runtime-contract.json`、`测试/Web运行底座测试.mjs`、`测试/仓库基础测试.mjs`、`qa/test-impact-map.yaml`、`docs/WEB_RUNTIME.md`、`docs/INDEX.md`、`docs/ARCHITECTURE.md`、`docs/CURRENT_STATE.md`、`docs/TEST_STRATEGY.md`、本验收单
- `task:check` 结果：与 `03.web-landing-design` 仅在 `qa/test-impact-map.yaml` 有文件软冲突；04 底座先集成最新 0.7.2，03 页面定稿后按底座契约接入并处理文本合并
- `task:claim`：已登记
- `task:release`：已释放

## 用户问题

在 Web 首页视觉仍由 03 任务打磨期间，先建立与视觉无关、供应商中立的静态 Web 构建、本地生产预览、路由/资产和部署契约，使页面定稿后可以直接接入并生成 Web 版。

## 目标

- 提供零新增依赖、确定性的静态 Web 构建命令和可部署目录。
- 固定 `/` 首页与 `/director/` 导演台入口的路由及资产契约，允许最终首页素材后插入而不修改构建逻辑。
- 提供只绑定回环地址的生产式本地预览，覆盖 MIME、HTML 回退、静态资源 404、路径穿越与兼容现有单体内联脚本的安全响应头。
- 用自动测试验证构建清单、缺失素材失败、核心 app/i18n 资源和安全边界。
- 明确本任务交付的是静态 Web 运行底座，不是账号、数据库、云存储或业务后端。

## 非目标

- 不修改 03 的首页视觉、文案、交互或 i18n 资源。
- 不修改 PreVision 项目 v5、业务功能或 Electron 运行时代码。
- 不引入账号、数据库、云存储、付费 API、AI 服务或网络依赖。
- 不部署公网、不创建公开仓库、不制作 ZIP/DMG、不运行 `app:deliver`。

## 证据与现状

- 代码：当前浏览器运行时为 `预见PreVision.html`，依赖仓库内 `i18n/`、`vendor/html2canvas.min.js` 和 `assets/PreVisionIcon-128.png`。
- Git：基线 `f75f2db` 包含固定 App 来源 `7ff9aa5`；工作树从 `chore/preview-rollup-0.7.2` 建立。
- 测试/运行：`app:status` 已确认 `Contains installed source: yes`；`task:check`/`task:claim` 仅报告 `qa/test-impact-map.yaml` 文件软冲突。
- 文档/历史线索：`WEB-001` 已验证本地浏览器模式，`WEB-002` 公开在线体验仍为 planned。

## 影响范围

- 模块：repository、release
- 文件：构建/预览脚本、Web 契约、自动测试、测试影响映射、部署与架构文档
- 数据格式：无，不修改 project v5
- 平台：静态 Web 构建与 macOS/Linux/Windows 可运行的 Node 本地预览；本轮在 macOS 回环地址验证

## 风险

- 数据：构建只能复制明确白名单资源，不读取或上传用户项目、autosave 或私人文件。
- UI/交互：不改变当前页面；首页未定稿期间 `/` 暂时回退到现有导演台文档。
- 安全：必须拒绝路径穿越和符号链接，预览仅绑定回环地址；CSP 暂时允许 inline script/style 以兼容单体运行时，但不允许 `unsafe-eval`。
- 发布：只生成忽略的 `dist/web`，不等同公网部署、正式签名、公证或固定 App 交付。

## 验收条件

- [x] `npm run web:build` 确定性生成可部署静态目录及机器可读部署清单。
- [x] `/`、`/director/`、首页素材插槽及共享资源契约明确，最终首页可不改构建逻辑直接接入。
- [x] `npm run web:preview` 只绑定回环地址，并模拟 MIME、路由回退、资源 404 和安全响应头。
- [x] 构建/预览拒绝路径穿越、符号链接、FIFO、大小写冲突、缺失或篡改核心素材。
- [x] 不引入新依赖、不联网、不调用 AI、不上传项目数据；`dist/` 和临时产物被忽略且基础测试禁止强制提交。
- [x] 自动测试覆盖构建清单、确定性、缺失/远程素材、路径安全、核心 app/i18n 资源和预览响应。
- [x] 相关自动测试通过。
- [x] 回环生产预览及真浏览器检查完成。
- [x] 固定 App 交付不适用：本任务只改变仓库/静态 Web 工程底座，且固定 App 交付由 00 总协调统一执行。
- [x] 文档和测试影响登记已更新。

## 测试计划

- 影响映射模块：repository、release
- 主应用模块参数：无
- 最小命令：`npm run test:web`、`npm run web:build`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:desktop`、`npm run test:impact -- --base f75f2dbbf23c7a1c62823af7accd69125c229b05`
- 升级到全量的条件：构建输出或安全响应头导致现有 app/i18n 资源不能在真实浏览器启动；影响映射识别为未知范围
- 人工检查尺寸/步骤：回环地址检查 `/`、`/director/`、核心脚本/语言包 MIME、安全头、HTML fallback 和缺失资源 404；不做页面视觉评审
- 固定 App 交付：不适用；本任务不改变安装包运行时且 00 为唯一交付者

## 实施记录

- 假设：首版完全由浏览器运行，当前不需要常驻服务器端进程或业务后端。
- 关键决定：输出只允许位于 `dist/`；首页定稿前 `/` 确定性复用导演台，定稿后直接读取 `web/home/index.html`；`/director/` 固定为导演台入口，只有其无扩展 HTML 子路由回退。
- 关键决定：不注入 `<base>`，而是只把已登记的 `assets/`、`i18n/`、`vendor/` 引用改为根绝对 URL，避免破坏同页 SVG fragment；CSP 因此使用 `base-uri 'none'`。
- 关键决定：构建采用白名单、临时 staging、确定性排序/哈希清单和安全目录替换；首页 HTML/CSS 常见依赖必须是清单内本地文件，未知 MIME、远程依赖、隐藏文件、符号链接及大小写折叠冲突直接失败。
- 关键决定：本地预览只绑定 `127.0.0.1`，校验 Host/端口、原始请求路径、manifest/contract 一致性、逐请求文件类型/realpath/字节数/SHA-256，并拒绝非 GET/HEAD。
- 实际修改：新增 `web:build`、`web:preview`、`test:web`，把 Web 层加入 `test:full` 和影响映射；新增静态运行契约、部署文档及 9 组隔离回归；`dist/` 被忽略并禁止进入 Git 索引。
- 安全审查：两轮只读审查发现并修复 `<base>` 破坏 SVG fragment、任意输出路径、父 symlink、运行中资源替换、FIFO 阻塞、manifest 遗漏、大小写覆盖和删清单绕过等问题；最终复核无阻断项。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 通过 | <1s | installed `7ff9aa5`，当前分支包含该来源 |
| `npm run task:check` | 通过，软冲突 | <1s | 仅 `qa/test-impact-map.yaml`；已明确 04 → 03 集成顺序 |
| `npm run task:claim` | 通过，已登记 | <1s | modules=`repository,release` |
| `npm run task:release` | 通过 | <1s | `04.web-runtime-foundation` 已释放；活动写任务仅余 03 首页设计 |
| `npm run test:web` | 通过 | <1s | 9 组；含构建确定性、首页插槽、远程/缺失依赖、大小写冲突、FIFO、Host、遍历与清单篡改 |
| `npm run web:build` | 通过 | <1s | `dist/web`，`director-fallback`，manifest 登记 9 个受信文件 |
| `npm run test:i18n` | 通过 | <1s | 21 项；未新增/修改用户文案或语言资源 |
| `npm run test:foundation` | 通过 | 1.4s | 基础 73、协调 20、i18n 21 项 |
| `npm run test:full` | 通过 | 11.8s | app 562、Web 9 组、desktop 43、安装 36、交付门禁 13、基础 73、协调 20、i18n 21 |
| `npm run test:impact -- --base f75f2db…` | 通过 | 1.7s | 命中 foundation/build-config/web-runtime/foundation-test；desktop、foundation、web 全通过 |
| 回环 HTTP 人工检查 | 通过 | <1s | `/` 200、`/director` 308、`/director/` 200、i18n JS MIME 正确、缺失资源 404、安全头完整 |
| 真浏览器检查 | 通过 | <2s | 页面 complete、主 canvas 可见、3 个 canvas、品牌已中文取词、可见 SVG 13×13、控制台无 error/warn |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用，本任务不运行 `app:deliver`，也未改 Electron/主 HTML/i18n 运行时。

## 未覆盖与后续

- 03 首页视觉定稿后需把最终素材接入约定目录并由 00 按顺序集成。
- 公网域名、CDN/对象存储、账号权限、隐私政策和正式发布均不在本任务范围。
- `/` 与 `/director/` 仍同源共享 localStorage；首页不得接第三方脚本，长期建议营销站与 Web App 分子域。
- 当前 CSP 为兼容单体页面仍允许 inline，项目名称/对象 label 的历史 `innerHTML` sink 尚未安全收敛；公开载入不受信任项目之前必须另立 DOM XSS/项目白名单任务。
- Windows 未实机验证；当前在 macOS + Node 24.14.0 验证，代码只使用 Node 20–24 API。
- 未来若主 HTML 或首页 JavaScript 新增动态资源、module import、`srcset` 或 CSS URL，接入任务需同步扩充资源审计并实际运行 `web:build`。

## 交接

- 最终提交：本验收单所在 `chore/web-runtime-foundation` 提交，以 Git 记录为准
- PR：无，仓库未连接 GitHub
- 工作区状态：提交后干净；`dist/` 为忽略的可再生产物
- 下一步：00 先集成本底座；03 页面定稿后把最终首页迁入 `web/home/`，运行真实 `web:build` 并处理 `qa/test-impact-map.yaml` 软冲突

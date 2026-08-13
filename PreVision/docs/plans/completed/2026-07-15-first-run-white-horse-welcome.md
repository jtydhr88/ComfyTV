# 任务：首次启动白马欢迎场景

- 状态：completed（已由 00 集成并 release）
- 日期：2026-07-15
- 对话：02.3｜首次启动白马欢迎场景
- 分支：feat/first-run-white-horse-welcome
- 基线：204722994e5f9e23050e40ac608a926e6f5fad89
- 固定 App 来源：7ff9aa583b4e51fb4d888aa1815792b747d275d7（chore/preview-rollup-0.7.2）
- 负责人：Codex 00

## 并行任务声明

- 任务 ID：02.3-first-run-white-horse-welcome
- 模式：write
- 模块：project, actor, camera, lighting, layout, i18n
- UI 表面：app-shell, topbar, left-rail, viewport, monitor
- 数据区域：project-v5, autosave, shot-camera, object-paths, actor-rig, scene-template, qa-metadata, i18n-resources
- 预计修改文件：`预见PreVision.html`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`测试/冒烟测试.mjs`、`docs/ARCHITECTURE.md`、`docs/CURRENT_STATE.md`、`docs/FEATURES.md`、`docs/FEATURE_REGISTRY.md`、`qa/feature-registry.yaml`、`qa/test-impact-map.yaml`、本验收单、完成验收单索引与 `docs/qa/first-run-white-horse-welcome/`
- `task:check` 结果：无硬冲突
- `task:claim`：已登记
- `task:release`：已释放

## 用户问题

首次打开导演台时应看到一个能体现 PreVision 能力、又可直接编辑的白马骑手欢迎场景，而不是普通双人对话。它必须只属于真正首次启动，不能覆盖已有项目，也不能把损坏的 autosave 冒充首次用户。

## 目标

- 无 autosave 时加载白马、骑手、侧向太阳和四镜 16.5 秒的欢迎项目。
- 有效 autosave 原样恢复；损坏或不可读 autosave 安全回退标准双人对话并给出双语恢复警告，且不覆盖原始数据。
- 用户主动“新建项目”始终保持现有标准双人对话模板。
- 启动装载本身零 autosave 写入；真实编辑后才按既有语义保存。
- 同时覆盖桌面导演台和 Web `/director/`，不修改 Web 首页开场动画。

## 非目标

- 不修改 project v5 版本、autosave key、分镜规划器协议或场景模板目录。
- 不把欢迎场景设为用户点击“新建项目”后的默认项目。
- 不整合旧 5444 工作树中的缩略图、旧摄影机、马鞍或捕获成果。
- 不执行 `app:deliver`、不更新固定 App、不公开部署。

## 证据与现状

- 代码：当前启动直接恢复 autosave 或调用现有 `newProject()` 标准双人对话；桌面与 Web 导演台共用同一运行时。
- Git：从最新集成提交 `2047229` 建立独立 Worktree；基线包含专业摄影机与分镜文本删除键修复。
- 测试/运行：Node 24.14.0；`app:status` 确认包含固定 App 来源 `7ff9aa5`。
- 文档/历史线索：旧 5444 只读草案混合多项过时成果，只参考纯场景参数，不合并或拣选。

## 影响范围

- 模块：project、actor、camera、lighting、layout、i18n。
- 文件：主应用、双语资源、主应用回归、功能登记、影响映射及 QA 证据。
- 数据格式：project v5 不升级；只新增启动分类和内存欢迎种子。
- 平台：macOS Electron 与静态 Web `/director/`。

## 风险

- 数据：错误分类 autosave 可能覆盖已有项目；启动路径必须 fail-safe、对 autosave 零写入且区分 missing/invalid/unavailable。
- UI/交互：欢迎场景不能改变 New Project、分镜规划器或现有场景编辑语义。
- 安全：本任务仅做最小启动分类；后续不可信输入安全任务会统一中央 normalize 边界。
- 发布：只更新实时预览，用户确认前不写入固定 App。

## 验收条件

- [x] fresh origin/profile 首次进入导演台显示白马骑手、4 镜、16.5 秒与侧向太阳；专业摄影机仅在主 viewport 可见。
- [x] 首次启动与未操作刷新均不创建 `previz_autosave_v3`；真实编辑后刷新精确恢复。
- [x] 有效 autosave 原样恢复且启动不改写 raw 字节。
- [x] JSON 损坏、结构损坏和 storage 读取异常均不崩溃；回退标准双人对话并显示双语恢复警告，启动不覆盖原 raw。
- [x] 用户点击 New Project 始终得到现有 dialogue 模板，而不是欢迎场景。
- [x] project v5 往返保留 mount、path、shots、sun、语义字段和规划器兼容。
- [x] Web 首页、网络/IPC、版本号和固定 App 均不变。
- [x] 相关自动测试通过。
- [x] Chromium 1440×900 与实际 Electron 外层尺寸完成 fresh/reload/edit+reload/valid/invalid/New Project 人工验证并留证。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：main-app、app-test、foundation、i18n、web-runtime。
- 主应用模块参数：project、actor、camera、lighting、layout。
- 最小命令：`npm run test:core`、对应五个 `test:module`、`npm run test:i18n`、`npm run test:app`、`npm run test:web`、`npm run test:foundation`。
- 升级到全量的条件：启动、autosave、project v5 与跨模块场景种子均属高风险，因此必跑 `test:impact` 和 `test:full`。
- 人工检查尺寸/步骤：Chromium 1440×900；Electron 记录实际宿主外层尺寸；使用隔离 storage/profile 验证六条启动链路。
- 固定 App 交付：不适用；本任务只提供实时网页预览，用户明确确认后再由 00 统一交付。

## 实施记录

- 假设：仅 `localStorage.getItem(AUTOSAVE_KEY) === null` 代表真正首次启动。
- 关键决定：missing、restored、invalid、unavailable 四态明确区分；boot 不调用 `markDirty()`。
- 实际修改：新增普通 project v5 欢迎种子；把 boot 分为 missing/restored/invalid/unavailable 四态；结构门禁严格检查会被启动 UI 直接使用的场景、演员、镜头与数值字段，兼容缺版本及显式历史 1–4、拒绝未来版本；`window.localStorage` getter/getItem 异常均安全回退。启动装载不写 autosave，New Project 工厂不变。
- 审查修正：首轮只读评审发现字符串时长、null/字符串坐标、缺场景/镜头名可能误放行，以及 storage getter 未捕获和旧版回退；全部补回归并复审。启动门禁仍明确不是完整不可信输入安全层。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm run app:status` | 通过 | <1s | 当前基线包含固定 App 来源 `7ff9aa5`，Exact=no |
| `npm run test:core` | 19/19 | <10s | fresh、四态、坏字段、缺/旧/未来版本、getter 异常、真实 New Project 点击 |
| `npm run test:module -- project` | 41/41 | <30s | autosave、项目往返与启动恢复 |
| `npm run test:module -- actor` | 143/143 | <30s | 白马路径、骑手挂载与旧演员行为 |
| `npm run test:module -- camera` | 80/80 | <30s | 四镜机位与既有摄影机行为 |
| `npm run test:module -- lighting` | 32/32 | <30s | 侧向太阳与双 renderer 光影 |
| `npm run test:module -- layout` | 121/121 | <30s | 欢迎层级、monitor 与既有布局 |
| `npm run test:i18n` | 21/21 | <2s | 双语 key 与新增中文守卫 |
| `npm run test:impact -- --base 2047229...` | 通过 | 22s | app 616、foundation 81+20+21、Web 10+13 |
| `npm run test:full` | 全部通过 | <30s | app 616、Web 10+13、desktop 43、local install 36+13、foundation 81+20+21 |
| `npm run web:build` | 通过 | <1s | provided-home，19 个清单文件 |
| Web 1440×900 | 通过 | 人工 | 雾白主题；fresh/reload/edit+reload/invalid/New Project；见 QA README |
| Electron 1680×1018 内容区 | 通过 | 人工 | 临时 userData；fresh/reload/edit+reload/invalid/New Project；截图按宿主缩放为 1229×768 |

固定 App installed source：7ff9aa583b4e51fb4d888aa1815792b747d275d7

固定 App 人工启动结果：本任务不更新固定 App，不适用。

## 未覆盖与后续

- 不可信项目内容的完整大小、资源 URL、原型/DOM 注入与中央归一化留给后续安全任务；本任务只保证 autosave 启动分类、boot 所需字段安全和启动不改写 autosave。
- 清空站点数据会再次被识别为 firstRun，这是本地/静态 Web 无账号架构下的预期语义。

## 交接

- 最终提交：`b4f43118242702806e7f5824d5839266debbd73c`（任务实现）；`ecb86ac`（00 集成）
- PR：无（本地仓库无 remote）
- 工作区状态：实现提交后干净；归档提交仅含验收单移动与完成索引。
- 下一步：稳定实时预览已重建；按队列先处理人物路径旋转回弹 Bug。

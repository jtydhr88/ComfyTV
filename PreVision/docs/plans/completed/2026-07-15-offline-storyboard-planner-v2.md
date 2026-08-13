# 任务：离线分镜规划器 v2

- 状态：completed
- 日期：2026-07-15
- 对话：02.1｜离线分镜规划器 v2
- 分支：`feat/offline-storyboard-planner-v2`
- 基线：`83b17eaef30e7b7c9fd139721e74caf580fdddf0`
- 固定 App 来源：任务开始时为 `de0c6acfff21ecae683b9ffa33d79780cedad351`（`fix/recent-preview-rollup-0.7.1`）；最终随 0.7.2 从 `7ff9aa583b4e51fb4d888aa1815792b747d275d7` 统一交付
- 负责人：Codex

## 并行任务声明

- 任务 ID：`02.1-offline-storyboard-planner-v2`
- 模式：write
- 模块：`storyboard,project,camera,layout,robustness,testing,i18n`
- UI 表面：`dialogs`
- 数据区域：`project-v5,scene-template,shot-camera,qa-metadata,i18n-resources`
- 预计修改文件：
  - `预见PreVision.html`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `测试/冒烟测试.mjs`
  - `qa/storyboard-corpus.json`
  - `docs/ARCHITECTURE.md`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURES.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/KNOWN_ISSUES.md`
  - `qa/feature-registry.yaml`
  - `qa/test-impact-map.yaml`
  - `docs/plans/active/2026-07-15-offline-storyboard-planner-v2.md`
- `task:check` 结果：无冲突（使用本节完整范围重新检查）
- `task:claim`：已登记
- `task:release`：已由 00 在集成提交通过全量回归后释放

## 用户问题

把现有固定四镜、按 UI 翻译关键词直接路由的“剧本 → 分镜”升级为一个完全离线且确定性的分镜规划器：解析单场景、最多两个主要角色的中英文剧本节拍，先生成可编辑分析预览和选型理由，由用户确认后再应用到现有 project v5 场景、人物与镜头数据。

## 目标

- 将中文/英文对白、动作、环境和常见剧本标点解析为有稳定 ID 的有效节拍。
- 根据有效节拍动态生成约 4–8 镜；每个节拍由镜头覆盖，或在预览中给出明确合并理由。
- 先生成不写项目的瞬时 `StoryboardPlan`，在对话框内允许检查、编辑主要角色映射和模板覆盖，再由用户确认应用。
- 对模板与镜头选择展示离线规则理由及置信度，不以“AI”或语义模型能力对外表述。
- 复用现有四种场景模板语法、现有对象及人物，提供基础 180°轴线、视线方向、主体入画与合法 FOV、时长、机位约束。
- 相同剧本文本与相同选项重复分析得到深度一致的计划。
- 保留原剧本文本；应用结果仍落入 project v5 的 `scene/actors/shots`，保存、打开与 autosave 往返合法。
- 分析词典与 UI locale/翻译资源解耦，测试只使用仓库内合成剧本。
- 分析/确认窗口支持右下角连续二维缩放和应用内全屏/还原；标题、角色映射与底部动作固定可见，节拍/镜头长列表独立滚动，尺寸始终夹在当前内容视口内。
- 同步双语言 language key、自动测试、机器可读语料、架构与功能登记。

## 非目标

- 不处理整部剧本、多场次批处理或三人以上复杂对话。
- 不调用 Agent、云端服务、真实付费 AI、本地大模型或模型下载。
- 不做复杂遮挡搜索、完整电影级优化、复杂姿态或动作路径自动编排。
- 不修改 Electron IPC，不引入 project v6，不新增持久分析字段，不重构整份单文件架构。
- 本轮只做快速开发预览，不运行 `app:deliver`，不更新固定 App，不制作对外发布包。

## 证据与现状

- 代码：基线入口复用四个 `SCENE_TEMPLATES`，但 `storyGen` 会立即创建场景，且关键词从 `PreVisionI18n.t('storyboard.keywords.*')` 读取。实现后已拆成 locale 无关纯分析、瞬时预览与独立 Apply 副作用边界。
- Git：Worktree 初始为干净的 `83b17ea` detached HEAD；已确认该提交包含固定 App 来源 `de0c6ac`，并从它建立任务分支。
- 测试/运行：Node 24.14.0 下完成依赖安装；`app:status` 显示 `Contains installed source: yes`。基线 storyboard/project/camera/layout/robustness 与 i18n 测试均已完成，结果见下表。
- 文档/历史线索：`STORY-001` 当前只登记固定四镜的离线关键词规则引擎；架构明确要求复杂新逻辑优先形成纯函数并保持 project v5 兼容。

## 影响范围

- 模块：storyboard、project、camera、layout、robustness、testing、i18n。
- 文件：以并行任务声明为准；若实现需要扩展范围，先释放 claim，再用完整范围重新 check/claim。
- 数据格式：不升级 schema。分析计划仅存在于对话框运行时；确认应用后只写现有 v5 场景、对象与镜头字段。旧 v5 项目、缺 `templateId` 项目继续兼容。
- 平台：离线 Web 渲染进程与 Electron 开发模式；不修改桌面主进程边界。

## 风险

- 数据：错误映射可能覆盖新场景的角色名或镜头，因此分析阶段禁止写项目，应用前重新校验计划；不把临时计划塞进 autosave。
- UI/交互：4–8 镜和长理由会增加弹窗高度；用 760×640 的普通最小值、视口自适应下限、连续二维缩放、应用内全屏及固定关键区避免遮挡。宿主物理屏只有 1366×768，因此 1440×900 使用 Electron DevTools 响应式内容视口验证，不能视为原生外层窗口截图。
- 安全：业务结果不得依赖网络、locale 翻译或用户私人数据；测试不得触发真实付费服务。
- 摄影机：轴线和视线规则是基础启发式，必须钳制 FOV、时长和有限机位，不虚报复杂遮挡优化。
- 发布：第一轮预览不更新固定 App；因此固定入口仍显示 0.7.1 已交付版本。实现已由 00 集成并完成回归，等待用户后续明确“正式更新”。

## 验收条件

- [x] 中文与英文合成剧本的对白、动作、环境及常见标点被解析为稳定节拍。
- [x] 混合/歧义文本有确定性回退，相同输入与选项重复分析得到相同计划。
- [x] 有效计划动态生成 4–8 镜，每个有效节拍都被覆盖或带明确合并理由。
- [x] 分析预览不修改项目、autosave 或撤销栈；取消不写入，确认才应用。
- [x] 预览可修正两个主要角色映射、可手动覆盖模板，并显示模板/镜头理由与置信度。
- [x] 生成镜头满足基础 180°轴线、视线、主体入画及合法 FOV/时长/机位范围。
- [x] 原剧本文本保留，结果进入现有 project v5 的 scene/actors/shots，保存/打开与 autosave 往返合法。
- [x] 旧项目和既有手动模板行为继续兼容，分析词典不读取 UI 翻译决定业务结果。
- [x] 无网络、Agent、云模型或真实付费 AI 依赖；自动测试仅使用合成语料。
- [x] 分镜窗口支持连续二维缩放、760×640 普通最小值、视口最大值、应用内全屏/还原、Esc 优先还原和主窗口缩小时夹取。
- [x] 标题、角色映射和 footer 固定可见；节拍/镜头使用剩余高度独立滚动，扩大窗口后可见内容显著增加。
- [x] 相关自动测试与最终 `test:full` 通过。
- [x] 1316×768、1440×900 响应式内容视口与应用内全屏开发预览完成，留有分析预览、滚动、应用/取消与可编辑结果截图说明。
- [x] 本轮按快速开发预览明确跳过 `npm run app:deliver`；固定 App 不变。
- [x] 文档和功能登记已更新。

## 测试计划

- 影响映射模块：storyboard、project、camera、layout、robustness、i18n、foundation。
- 主应用模块参数：`storyboard`、`project`、`camera`、`layout`、`robustness`。
- 基线最小命令：上述五个 `test:module` 命令及 `npm run test:i18n`。
- 实现后命令：重复五个模块；运行 `npm run test:i18n`、`npm run test:app`、`npm run test:foundation`，再按 `npm run test:impact -- --base 83b17ea...` 核对。
- 自动断言：中英文标点、混合/歧义文本、确定性、动态镜头数、节拍覆盖、手动模板覆盖、角色映射、数值合法、project v5 往返和无网络依赖。
- 最终全量：用户恢复执行时明确要求运行 `npm run test:full`；本轮已执行，但不因此触发固定 App 交付。
- 人工检查尺寸/步骤：Electron 开发模式实际 1316×768、DevTools 响应式内容视口 1440×900 与应用内全屏；打开剧本规划器、输入长合成剧本、分析、连续拖拽、独立滚动、Esc 还原、取消确认无写入、再次应用并编辑新场景镜头 FOV。
- 固定 App 交付：本轮不适用；用户明确要求快速预览且不得运行 `app:deliver`。

## 实施记录

- 假设：单场景最多两个主要角色；第三个及以后具名说话者作为歧义提示合并到动作/对白节拍，不自动建立复杂调度。
- 关键决定：
  - `StoryboardPlan` 只保存纯 JSON 和稳定 reason code，不保存翻译文本、DOM/THREE 引用、时间戳或随机值；跨 locale 可直接深比较。
  - 业务词典放在 `STORYBOARD_ANALYSIS_LEXICON`，中文词使用 Unicode escape，既与 UI 翻译资源分离，也不绕过新增运行时中文守卫。
  - 4–8 镜数量由有效节拍数钳制；少于四节拍用“支持镜头”补足，多于八节拍把相邻节拍分配到八镜并记录 `merge.shotLimit`。
  - 机位围绕当前场景两名角色的实际位置生成，统一选择空间余量较大的轴线侧；镜头锁定现有主体，FOV、时长、高度和舞台坐标均钳制。复杂遮挡与动作路径生成不在本轮伪实现。
  - Apply 才 `syncScene()`，复制来源场景的人物、对象、背景、地面、太阳和路径，替换新场景的名称/描述/原剧本/`templateId`/镜头；分析字段不落盘。
- 实际修改：
  - 扩展分镜对话框为可连续二维缩放的弹性预览；标题栏可切换应用内全屏/还原，普通尺寸受 760×640 与当前视口边界约束，Esc 在全屏时先还原。标题、角色映射和 footer 固定，节拍/镜头独立滚动；增加模板决策、置信度、节拍审计、4–8 镜卡片，以及主体/时长/FOV 编辑。
  - 增加中文全角标点、英文场景标题/说话人 cue/括号动作、引号对白、动作/环境和歧义回退解析。
  - 增加合成语料 `qa/storyboard-corpus.json`，并让影响映射在语料变化时运行应用测试。
  - 扩展 VM 冒烟测试覆盖确定性、跨 locale、无网络、角色交换、同侧轴线、覆盖/合并、零写入、过期/取消、Apply、project v5 autosave/打开往返和响应式弹窗结构。
  - 同步双语言资源、架构、功能说明、功能登记、当前状态和已知限制。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node 24.14.0） | 通过 | 10s | 新 Worktree 安装锁定依赖；未修改 lockfile。 |
| `npm run app:status`（Node 24.14.0） | 通过 | <1s | installed `de0c6ac`；current `83b17ea`；包含关系为 yes。 |
| `npm run task:status` | 通过 | <1s | 领取前无 active claim。 |
| `npm run task:check -- <完整声明>` | 通过 | <1s | `No hard conflicts.` |
| `npm run task:claim -- <相同完整声明>` | 通过 | <1s | `CLAIMED`；第一轮预览后保持 active。 |
| 基线 `npm run test:module -- storyboard` | 通过 | 约 5s | 57 项。 |
| 基线 `npm run test:module -- project` | 通过 | 约 5s | 20 项。 |
| 基线 `npm run test:module -- camera` | 通过 | 约 5s | 43 项。 |
| 基线 `npm run test:module -- layout` | 通过 | 约 5s | 104 项。 |
| 基线 `npm run test:module -- robustness` | 通过 | 约 5s | 10 项。 |
| 基线 `npm run test:i18n` | 通过 | <1s | 21 项。 |
| 实现后 `npm run test:module -- storyboard` | 通过 | 约 6s | 143 项；含合成语料、分析/应用边界、连续缩放、全屏往返、Esc 与视口夹取。 |
| 实现后 `npm run test:module -- project` | 通过 | 约 6s | 22 项；含 v5 瞬时字段不落盘和往返。 |
| 实现后 `npm run test:module -- camera` | 通过 | 约 6s | 43 项。 |
| 实现后 `npm run test:module -- layout` | 通过 | 约 7s | 108 项；含规划器弹性布局、固定关键区、独立滚动、resize handle 与双语无障碍结构。 |
| 实现后 `npm run test:module -- robustness` | 通过 | 约 6s | 10 项。 |
| 实现后 `npm run test:i18n` | 通过 | <1s | 21 项；双语言 key、引用和新增中文守卫均通过。 |
| `npm run test:app` | 通过 | 约 10s | 541 项；完整应用行为回归。 |
| `npm run test:foundation` | 通过 | 约 10s | foundation 66、coordination 20、i18n 21。 |
| `npm run test:impact -- --base 83b17eaef30e7b7c9fd139721e74caf580fdddf0`（Node 24.14.0） | 通过 | 约 15s | 命中 app、foundation 与 i18n；应用 541、基础 66、协调 20、国际化 21 项通过。 |
| `npm run test:full` | 通过 | 约 20s | app 541、desktop 43、local-install 36、delivery gate 13、foundation 66、coordination 20、i18n 21；未执行交付。 |
| 收尾 `npm run task:status`（Node 24.14.0） | 通过 | <1s | 任务分支交接时唯一 active claim 为 `02.1-offline-storyboard-planner-v2`。 |
| 00 集成 `npm run test:full`（Node 24.14.0） | 通过 | 约 16s | 集成提交 `6441682`：app 541、desktop 43、local-install 36、delivery gate 13、foundation 66、coordination 20、i18n 21。 |
| 00 `npm run task:release -- --task 02.1-offline-storyboard-planner-v2` | 通过 | <1s | 集成回归完成后释放；当前无 active claim。 |
| `git diff --check`、精确范围、QA JSON、敏感信息与绝对路径检查 | 通过 | <1s | 13 个变更/新增文件与 claim 完全一致；无范围外文件、凭据、本机绝对路径或构建产物。 |

Node 24 收尾时，两次中间复跑分别命中未触及的环境库随机放置/沙漠贴地历史断言；随后独立 `test:app` 与最终 `test:impact` 均稳定通过 541 项，分镜规划器断言从未失败。本任务未为掩盖波动修改环境业务语义。

## 人工预览证据

| 视口/步骤 | 结果 | 截图 |
| --- | --- | --- |
| Electron 开发窗口 1316×768，默认分析 | 通过；11 节拍/8 镜、理由、角色映射、固定 footer 和右下角手柄均可见。 | `offline-storyboard-v2-resizable-1316x768.jpeg` |
| 1316×768 连续拖拽放大 | 通过；非档位连续增大后，同屏节拍从 1 条显著增加到 5 条，角色映射和 footer 保持可见。 | `offline-storyboard-v2-drag-resized-1316x768.jpeg` |
| 独立列表滚动 | 通过；滚至 S07/S08 时标题、两角色映射、重新分析/应用仍固定可用。 | `offline-storyboard-v2-independent-scroll-1316x768.jpeg` |
| 应用内全屏 | 通过；只占满 PreVision 内容视口，未调用 macOS 系统全屏；同屏可见 6 张镜头卡，Esc 首次只还原并保留计划。 | `offline-storyboard-v2-app-fullscreen-1316x768.jpeg` |
| 取消 / 应用 / 可编辑结果 | 通过；取消前后场景数保持 2；再次应用后创建场景 3 的 8 镜，右栏 FOV 从 38 调为 39。 | `offline-storyboard-v2-applied-editable-scene-1316x768.jpeg` |
| Electron DevTools 响应式内容视口 1440×900 | 通过；尺寸栏确认 Width 1440 / Height 900，规划器、角色和 footer 无溢出。宿主物理屏仅 1366×768，不能提供外层 BrowserWindow 原生 1440×900 截图。 | `offline-storyboard-v2-electron-devtools-1440x900.jpeg` |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（0.7.2）

固定 App 人工启动结果：0.7.2 已从 `~/Applications/PreVision.app` 打开剧本分镜窗口；默认窗口、应用内全屏和 Esc 首次还原均通过，结合既有连续拖拽、独立滚动、取消零写入和应用结果开发预览，`STORY-002` 已升级为 `VERIFIED`。

## 未覆盖与后续

- 复杂遮挡搜索、动作路径自动生成、三人以上对白、多场次规划和电影级优化明确留待后续任务。

## 交接

- 任务提交：`d05d555459f956ddd08c688758ae7eb0a32a9b3e`。
- 00 集成提交：`64416824192ac95e4666721217cc0c06e093ea31`，父提交为 `83b17eaef30e7b7c9fd139721e74caf580fdddf0`，集成树与任务提交完全一致。
- PR：无（仓库未连接 remote）。
- 工作区状态：任务 Worktree 与 00 集成工作区均保持干净。
- 固定 App：原开发轮次未从任务分支直接安装；现已由 00 从 0.7.2 集成分支统一交付。
- 下一步：复杂遮挡、动作路径、三人以上对白和多场次规划继续作为独立后续任务。

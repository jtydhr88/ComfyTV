# 任务：语义代理模型库 MVP

- 状态：completed
- 日期：2026-07-15
- 对话：02.2｜语义代理模型库 MVP
- 分支：`feat/semantic-proxy-library-mvp`
- 基线：`0b5f851a3d5ddfa7226e5686f0f0e771c4f2a026`
- 固定 App 来源：开发基线为 `de0c6acfff21ecae683b9ffa33d79780cedad351`；最终随 0.7.2 从 `7ff9aa583b4e51fb4d888aa1815792b747d275d7` 统一交付
- 负责人：Codex 短期实现代理

## 并行任务声明

- 任务 ID：`02.2-semantic-proxy-library-mvp`
- 模式：write
- 模块：`actor,background,project,layout,robustness,testing,i18n`
- UI 表面：`inspector,viewport`
- 数据区域：`project-v5,autosave,actor-rig,object-paths,qa-metadata,i18n-resources`
- 预计修改文件：`"预见PreVision.html"`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`"测试/冒烟测试.mjs"`、`qa/semantic-proxy-catalog.json`、`qa/feature-registry.yaml`、`qa/test-impact-map.yaml`、`docs/ARCHITECTURE.md`、`docs/CURRENT_STATE.md`、`docs/FEATURES.md`、`docs/FEATURE_REGISTRY.md`、`docs/KNOWN_ISSUES.md`、本验收单
- `task:check` 结果：无硬冲突
- `task:claim`：已登记
- `task:release`：已由 00 在集成全量回归通过后释放

## 流程例外

Codex App 的新任务创建服务连续超时并产生未物化的空壳，00 已清理。本任务改由内部短期代理在独立 Worktree 执行；代码隔离、写前 Claim、验收和本地提交规则不变。

## 用户问题

导演台当前资产类型与尺寸语义耦合，缺少一组能在常用距离、多角度和多焦段下快速辨识的低复杂度语义代理。用户需要用它们进行空间规划，并导出稳定参考帧供 Seedance 多镜头一致性实验使用。

## 目标

- 提供确定性、低复杂度、无外部资产授权风险的首批 11 种语义代理：成人男性、成人女性、儿童、狗、SUV、树 A、树 B、石头、灌木、房屋体块和道路。
- 语义类型决定轮廓、默认比例和稳定配色；尺寸/scale 作为独立 transform 维度编辑与持久化，允许三米儿童等非常规设定。
- 将类型 ID、分类、默认尺寸/比例、显示 language key 和 Seedance 验证场景写入可机器检查的 `qa/semantic-proxy-catalog.json`。
- 在 inspector 提供清晰的语义类型选择与独立尺寸编辑，viewport 立即更新代理轮廓，不破坏旧对象的姿态、路径、挂载或时间轴数据。
- 保持 project v5、`previz_autosave_v3` 和打开/保存往返兼容；未知语义类型安全降级，不升级项目格式。

## 用户流程

1. 用户从现有添加对象入口创建一个语义代理，或选中旧对象。
2. 用户在右侧 inspector 选择语义类型；viewport 保留位置/旋转/路径并立即替换为对应轮廓和稳定配色。
3. 用户独立编辑尺寸；语义 ID 不随尺寸改变，尺寸也不因项目重开而被语义默认值覆盖。
4. 用户保存并重开 project v5，验证类型与尺寸往返；打开旧项目时，旧类型仍可编辑，未知新类型用稳定占位轮廓降级。
5. 用户按基准场景导出多角度/多焦段参考帧，携带语义清单到 Seedance 进行独立实机对齐。

## 非目标

- 不追求 Blender 级写实精模、骨骼动画、物理仿真或复杂材质。
- 不建设资产商城、材质系统、自动场景生成器或大型建模系统。
- 不调用 Seedance 或任何真实付费 AI 服务，不把 PreVision 内部参考帧稳定性冒充为 Seedance 实机一致性。
- 不扩展多人骨骼、自动遮挡搜索或分镜规则引擎。
- 不升级 project v5，除非实现证明无法在可选字段内安全兼容；如发生则先停止并补充迁移设计。

## 证据与现状

- 代码：当前主应用在单体 HTML 中内嵌 Three.js r128；人物、车辆、环境对象已有确定性几何和 inspector 数据流，但没有可机器校验的语义代理目录和独立语义/尺寸契约。
- Git：分支 HEAD 为 `0b5f851a3d5ddfa7226e5686f0f0e771c4f2a026`，包含固定 App 来源 `de0c6acfff21ecae683b9ffa33d79780cedad351`。
- 测试/运行：首次 `app:status` 因新 Worktree 尚未 `npm ci` 且系统 Node 26 缺失依赖而失败，未修改代码；改用 Node 24.14.0 安装锁定依赖后重跑成功。`task:status` 初始为无活跃 claim。
- 文档/历史线索：`ARCHITECTURE.md` 确认对象类型、位置、姿态、高度、路径和时间已进入 project v5；外部 AI 仅消费参考画面/描述，不在应用内调用。

## 数据兼容契约

- 语义类型使用对象上的可选稳定 ID 字段，transform/尺寸仍使用独立数值字段；两者不互相推导或覆盖。
- 新建对象可由目录默认尺寸初始化一次；类型切换默认保留用户已设尺寸，如 UI 提供恢复默认则必须是显式动作。
- 现有 project v5 文档不需要迁移版本；缺失语义 ID 时按旧类型选择稳定形状，未知 ID 使用不抛错的占位轮廓，原数据保留以便新版本重开。
- 自动保存 key 不变；配额降级、打开/保存和旧项目往返必须有回归断言。

## Seedance 验证协议

### 可复现基准场景

- 用固定 ID、固定位置/旋转/尺寸和固定配色放置人物组（成人男性、成人女性、儿童、狗）、交通组（SUV、道路）、环境组（树 A/B、石头、灌木、房屋体块）。
- 建立至少三个固定镜头：正面建立镜、35–45° 斜向中景、侧/后方空间镜；使用至少广角、标准、中长焦三档固定 FOV/焦段对应。
- 每帧同时保留场景 ID、镜头 ID、代理语义 ID、位置/旋转/尺寸、FOV 与参考帧文件名的资产/语义清单，使复现不依赖人工记忆。

### PreVision 内部检查

- 对比同一项目保存/重开前后的几何轮廓、稳定配色、语义 ID、transform 和镜头 FOV，确认多镜头参考帧在 PreVision 内部一致。
- 在常用 MacBook 窗口尺寸下，以近/中/远景和不同方位人工判定：三类人物一眼可区分，SUV/狗/树 A/B/石头/灌木/房屋/道路在构图距离可辨，非常规尺寸不改变语义。
- 对每帧以 1–5 分记录：语义可辨性、轮廓跨角度稳定性、配色稳定性、遮挡/构图可读性；每项平均不低于 4，且无单项低于 3。

### Seedance 实机检查（用户后续）

- 将同一批参考帧、语义清单和统一提示词分别用于 Seedance 多镜头生成，禁止在镜头间手动改变资产描述。
- 人工逐镜以 1–5 分记录：主体身份保持、相对尺寸/位置、稳定配色/轮廓、背景地标和道路连续性；同时记录模型版本、生成时间与随机种子（若可用）。
- 本任务只能宣称“PreVision 参考帧内部一致性已验证”；“Seedance 实机生成一致性”必须等用户在对应模型中完成上述实验，未完成前明确为未验证。

## 影响范围

- 模块：人物/语义资产、背景/环境资产、项目持久化、inspector/viewport 布局、鲁棒降级、QA 与国际化。
- 文件：仅并行任务声明中列出的文件；如设计证明需要新增范围，先 release 再以完整真实范围重新 check/claim。
- 数据格式：有；project v5 对象新增可选语义 ID 和独立尺寸字段，保持 v5 版本号与旧数据兼容。
- 平台：macOS Apple Silicon Electron 开发预览，同时保持离线浏览器模式。

## 风险

- 数据：类型切换如重新套用默认尺寸会覆盖用户设定；未知 ID 或旧类型若被清洗会造成信息丢失。
- UI/交互：inspector 屏幕宽度有限，新控件可能导致 MacBook 窗口溢出；替换群组时需保持选中、标签、路径和挂载参照。
- 视觉：几何过简会退化为同色方块，过于复杂则降低预览/导出性能；稳定颜色必须在当前四主题与地面外观下保持可读。
- 安全：仅使用程序生成的 Three.js 内置几何，不加载远程资产，不调用付费 AI，不扩大 Electron 权限。
- 发布：本任务是独立开发预览；不运行 `app:deliver`、不更新固定 App，由 00 完成安全集成和后续交付。

## 验收条件

- [x] 机器可读目录包含指定首批语义类型，ID、分类、默认尺寸/比例、显示 key、稳定配色和验证场景可自动校验。
- [x] 成人男性、成人女性、儿童在轮廓、默认体型/身高和稳定配色上可一眼区分；其他类型在常用距离和不同角度可辨。
- [x] 语义类型与尺寸独立编辑和持久化；切换类型不覆盖已设尺寸，三米儿童保存/重开后仍为儿童语义。
- [x] inspector 的类型选择和尺寸编辑清晰，viewport 立即反馈，不破坏选中、姿态、路径、挂载、镜头或时间轴。
- [x] project v5、autosave、打开/保存往返、旧项目缺字段和未知类型安全降级均有自动回归证据。
- [x] 新增用户文案全部使用 language key，`zh-CN` / `en-US` 对齐，`npm run test:i18n` 通过。
- [x] 相关模块、`test:impact`、`test:app` 和跨模块最终 `test:full` 通过。
- [x] Electron 开发预览已在本机常用窗口启动并留存截图；类型切换、独立缩放、保存/重开、旧项目和多镜头/多焦段数据路径由自动回归覆盖。
- [x] Seedance 协议和语义清单可复现；文档明确区分 PreVision 内部一致性与 Seedance 实机待用户验证。
- [x] 文档、功能登记、QA 映射和已知边界已同步。
- [x] 已建立聚焦本地提交，工作区干净；Claim 保留等待 00 集成。
- [x] 短期任务分支未直接执行 `app:deliver`；成果已由 00 安全集成并随 0.7.2 统一更新 `~/Applications/PreVision.app`。

## 测试计划

- 影响映射模块：`actor`、`background`、`project`、`layout`、`robustness`，加上 QA/foundation 与 i18n。
- 主应用模块参数：`actor`、`background`、`project`、`layout`、`robustness`。
- 最小命令：上述单模块测试、`npm run test:i18n`、`npm run test:foundation`。
- 升级到全量的条件：本任务修改单体 HTML 且涉及跨模块项目数据，因此必须运行 `npm run test:app`、`npm run test:impact -- --base 0b5f851a3d5ddfa7226e5686f0f0e771c4f2a026` 和最终 `npm run test:full`。
- 人工检查尺寸/步骤：至少 1316×768 和 1440×900；创建基准组、切换类型、将儿童设为 3m、保存/重开、打开旧 v5，依次检查三角度与三焦段参考。
- 固定 App 交付：不适用于本短期分支；明确禁止 `app:deliver`，固定路径由 00 在集成后统一交付。

## 实施记录

- 假设：语义 ID 可以作为 project v5 对象可选字段，而不需要项目版本升级。
- 关键决定：保留旧 `kind` 作为行为分发和旧项目兼容字段，新增可选 `semanticType` 与 `dimensions`。类型切换通过重建对应低复杂度几何完成，但默认保留用户自定义宽高深；“恢复默认尺寸”才重新套用目录尺寸。
- 关键决定：道路是 surface-like reference proxy，进入保存/提示/参考帧，但在基础碰撞里与沙漠、图板一样豁免，避免变成巨型墙体。
- 实际修改：新增首批 11 类语义代理定义、狗/灌木/道路程序几何、右栏语义代理库入口、类型选择、宽/高/深独立编辑、默认尺寸恢复、project v5 保存恢复、未知未来类型保留和 QA 目录。
- 实际修改：新增 `qa/semantic-proxy-catalog.json`，同步功能登记、影响映射、架构/功能/当前状态/已知边界和中英文 language key。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci` (Node 24.14.0) | 通过 | 10s | 新 Worktree 安装 lockfile 固定依赖；没有改变跟踪文件。 |
| `npm run app:status` (Node 24.14.0) | 通过 | <1s | 当前基线包含固定 App 来源；不是精确同一提交。 |
| `npm run task:status` (Node 24.14.0) | 通过 | <1s | 写前无活跃 claim。 |
| `npm run test:module -- actor` (Node 24.14.0) | 通过 | 7.17s | 119 通过，0 失败；覆盖语义目录、类型/尺寸分离、3m child、道路碰撞豁免和未知类型保留。 |
| `npm run test:i18n` (Node 24.14.0) | 通过 | <1s | 21 通过，0 失败。 |
| `npm run test:foundation` (Node 24.14.0) | 通过 | 1.16s | Foundation 66、coordination 20、i18n 21，全部 0 失败。 |
| `npm run test:app` (Node 24.14.0) | 通过 | 23.56s | 562 通过，0 失败。 |
| `npm run test:impact -- --base 0b5f851a3d5ddfa7226e5686f0f0e771c4f2a026` (Node 24.14.0) | 通过 | 27.83s | 命中 foundation、i18n-browser、app-test、main-app；实际运行 app + foundation。 |
| `npm run test:full` (Node 24.14.0) | 通过 | 24.87s | App 562、Desktop 43、本机安装 36、交付门禁 13、Foundation 66、coordination 20、i18n 21，全部 0 失败。 |
| Electron 开发预览 `npm start` | 通过 | - | 临时开发窗口启动并显示当前项目；未运行 `app:deliver`。截图存于仓库外可视化证据目录：`~/.codex/visualizations/2026/07/15/02.2-semantic-proxy-library-mvp/development-preview-window.png`。 |
| 00 精确集成与 Node 24 `npm run test:full` | 通过 | 约 20s | 集成为 `1734270`；App 562、Desktop 43、local-install 36、delivery gate 13、Foundation 66、coordination 20、i18n 21。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`（0.7.2）

固定 App 人工启动结果：0.7.2 已从固定入口启动；真实 App DOM 列出成人男性、成人女性、儿童、狗、SUV、树 A/B、石头、灌木、房屋体块和道路 11 类。新增代理默认类型/尺寸输入可用，切换为儿童并把高度改为 3m 后仍保持儿童类型与 `0.65×3×0.38m` 独立尺寸；测试前禁用 autosave，强制重载后确认临时对象既不在内存也不在 autosave。Seedance 外部生成仍未验证。

## 未覆盖与后续

- Seedance 真实模型中的多镜头一致性必须由用户在实际服务中执行协议后评估；本任务不会访问或调用该服务。
- Electron 预览截图确认开发版窗口启动和既有场景显示；语义控件/数据路径由自动测试覆盖，未在真实 Seedance 环境中验证生成结果。

## 交接

- 最终提交：任务提交 `bacbabe4e13be6a12b832fae339f390037045d2e`；00 集成提交 `1734270`
- PR：无（当前仓库无 remote）
- 工作区状态：clean
- 下一步：由用户按 `qa/semantic-proxy-catalog.json` 的三镜头/多焦段协议在 Seedance 实机评分。外部一致性通过前保持 `IMPLEMENTED_UNVERIFIED`。

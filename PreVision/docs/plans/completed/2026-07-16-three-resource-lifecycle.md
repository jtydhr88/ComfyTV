# 任务：04.5｜Three.js 场景资源生命周期修复

- 状态：completed
- 日期：2026-07-16
- 对话：固定 00 派发的侧栏可见短期性能临时工
- 分支：`fix/04.5-three-resource-lifecycle`
- 基线：`76582209564a2e2cfc91144bea41fe7686303f4b`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；本临时工未运行 `app:deliver`
- 负责人：Codex 短期性能临时工

## 并行任务声明

- 任务 ID：`04.5-three-resource-lifecycle`
- 模式：write
- 模块：`actor,camera,background,lighting,viewport,playback,display,robustness,project,testing`
- UI 表面：`viewport,monitor`
- 数据区域：无；没有改变 project v5/autosave/history 格式或语义
- 实际文件：`预见PreVision.html`、`测试/冒烟测试.mjs`、`测试/Web压力测试工装测试.mjs`、`scripts/web-stress-lib.mjs`、`docs/CURRENT_STATE.md`、`docs/KNOWN_ISSUES.md`、本验收单、`docs/qa/three-resource-lifecycle/*`、`docs/plans/completed/README.md`
- `task:check` / `task:claim`：同参通过；claim 保留，由 00 集成后 release
- 并行软冲突：录制 P1 先集成，04.5 后集成；主 HTML、冒烟测试和 completed README 需机械保留双方语义

## 问题与目标

04.4 修复后的真实 4 场景 × 24 对象夹具证明，基线切场景只 remove/clear 而不 dispose，renderer geometry/texture 随切换线性增长。任务目标是为 stage actor/board/environment、label、sky、path/viz 等独占资源建立明确、可重入的释放边界，同时保护 `assetTex`、renderer、地面、摄影机 overlay 等共享/全局资源。

任务还在 00 终审中闭合了两个同属资源 owner 的漏口：标签重命名遗留 CanvasTexture，以及项目级 `assetTex` 在打开/回滚、新建项目和 orphan GC 时缺少 owner 结束。

## 非目标

- 未做逐帧 `shotCurve` / `actorCurve` / 碰撞缓存。
- 未改 facingOffset、缩略图、架构、project v5、autosave/history、选择、镜头/路径/FOV、碰撞、挂载、太阳、截图/录屏/Seedance 输出语义。
- 未使用 4175，未运行 `app:deliver`。

## 实际实现

- 新增明确 Object3D owner 的幂等释放器，去重 geometry/material/texture，覆盖材质数组、直接贴图字段、Shader uniform/数组、SpriteMaterial 和 CanvasTexture。
- Three r128 所有 Sprite 共享引擎 geometry，释放器显式跳过 Sprite geometry，只回收标签自有 material/map。
- `clearStage`、对象删除/语义替换、`rebuildViz`、`buildSky` 和标签重命名接入统一释放边界；共享 `groundTex` / `assetTex` 不随场景对象误释放。
- `openProjectData` 仅在候选项目完整提交后释放旧 cache；失败时先恢复旧快照，再释放候选 cache。`activateNewProject` 保留 New Project 原成功语义，但在 `loadScene` 异常时恢复 project/scene/selection/history/pending autosave/旧 owner。
- `gcAssets` 扫描全部场景的 bg/ground/actor 资产，orphan 同步删除项目记录并释放 cache；其他场景仍引用的共享纹理保留。
- 压力工装在打开候选项目前复制并深冻结 scene/actor identity oracle；每次切换与 long-session 每轮同时核验 live project 和 runtime，不能由可变 project 自证。路径对象比较完整 `pathPts`，无路径对象比较 `obj.position`。

## 验收条件结果

- [x] 独占 geometry/material/texture 正确、幂等 dispose；材质数组、贴图字段、Shader uniform、Sprite/CanvasTexture 有自动回归。
- [x] 共享 `assetTex`、Sprite engine geometry、renderer、地面与摄影机 overlay 不被场景释放器误处置。
- [x] 连续重命名逐次释放旧标签资源，新标签可见；再次清场不双重处置。
- [x] 项目 A→B 成功、失败回滚、新建失败回滚、正常 New、跨场景共享和 orphan GC 均有真实 Three r128 dispose 事件断言。
- [x] 4×24 预热后 40 次切换：geometry `452→451`、texture `27→27`，oracle 每轮验证 `sceneCount=4` / `objectCount=24`，零 alert。
- [x] 切换后短播放 60 FPS、p95 17.7ms，达到 `≥55 FPS` / `<25ms`。
- [x] 120 秒/58 循环：geometry `451→448`、texture `27→27`，56.83 FPS、p95 18.0ms；每轮身份校验通过。
- [x] 4096×2048 全景 texture ready；标签/摄影机辅助人工可见；图板/全景共享材质在场景和项目 owner 回归中保持同一存活纹理。
- [x] 零 console error、exception、WebGL context lost；未观察到 crash/detach；截图、MP4 和 Seedance ZIP 格式验证通过。
- [x] 自动模块、app、i18n、impact、full 与真 Chrome formal 证据通过。

## 验证结果

所有 npm/Node 命令均使用 Node 24.18.0。

| 命令/步骤 | 结果 |
| --- | --- |
| `git merge --ff-only 7658220...` | 从干净 `a9472e3` 精确快进 |
| `npm run app:status` | installed source `7ff9aa5`；当前分支包含该来源但不精确相等 |
| `task:check` → 同参 `task:claim` | 无硬冲突；claim 已登记并保留 |
| `test:module -- actor/camera/background/lighting/viewport/playback/display/robustness/project` | 147 / 84 / 81 / 32 / 31 / 32 / 25 / 23 / 103，全部零失败 |
| `npm run test:app` | 830/830 |
| `npm run test:i18n` | 21/21 |
| `npm run test:web:stress-harness` | 14/14；含 immutable oracle 正向、live+runtime 陈旧和 runtime-only 陈旧负例 |
| `npm run test:impact -- --base 7658220... --module background` | app 830、foundation 93、coordination 31、i18n 21、project-input Web/Electron、Web 10 + 工装 14 全通过 |
| `npm run test:full` | app 830；project-input Web/Electron；Web 10 + 工装 14；desktop 43；local install 36 + delivery 13；foundation 93 + coordination 31 + i18n 21 + wrapper 11 全通过 |
| 真 Chrome baseline standard | geometry `565→17,244`、texture `28→988`；120 秒 `17,307→41,778` / `988→2,404` |
| 真 Chrome after standard | 来源 `8dcb0ed8ca79b2d2a2096babcf152c1132bdf4d5`；40 次 `452→451` / `27→27`；短播放 60 FPS/p95 17.7ms；120 秒 `451→448` / `27→27`、56.83 FPS/p95 18.0ms |

原始去敏证据与摘要：`docs/qa/three-resource-lifecycle/`。

## 数据、兼容与可见性评估

- 没有新增/迁移 project 字段；项目打开与 New 成功路径的既有 history/autosave 语义保持，失败路径只新增内存回滚与候选 GPU owner 回收。
- 压力证据不保存项目/媒体字节、用户名、主机名、PID、profile 或绝对路径。
- 当前 24 对象 formal 夹具不含 board；图板无丢材质使用真实 Three r128 的 sky/board `material.map === assetTex`、跨场景重建和失败回滚执行级断言证明，未冒充像素比较。

## 残余风险与后续

- 逐帧曲线/碰撞缓存只保留为后续性能观察项。
- 单个 custom texture 的 `dispose()` 极端抛错时会继续清理其他 cache，但该异常对象不可重试，按 KI-021/P3 记录。
- Safari Remote Automation 和真实 Windows Chrome/Edge 未在本任务补测。
- 固定 App 仍是 `7ff9aa5`；00 集成、最终回归和用户明确授权后的 `app:deliver` 尚未发生。

## 交接

- 实现提交：`11d714145c5ebcf2b6d80634e4b59457ddb18e06`
- 终审补项提交：`8dcb0ed8ca79b2d2a2096babcf152c1132bdf4d5`
- 文档/证据：本验收单所在后续提交
- PR：无 remote
- claim：保留，由 00 集成后 release/归档

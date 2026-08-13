# ADR-0013:舞台运行时模块搬迁(重构 P7a:stage/runtime.js)

- 状态:accepted
- 日期:2026-07-19
- 范围:重构 P7a —— 将舞台对象运行时、碰撞/地形对齐、场景同步/加载和路径/预览动画运行时从 `src/app.js` 纯搬运至 `src/stage/runtime.js`;承接 ADR-0006~0012,不改变项目 v5 数据契约、C1/C2 输出、RefreshHub 注册语义或固定 App 交付流程。

## 背景

P6 之后,建模工厂、环境/资产、提示词和分镜规划已各自有模块所有权,但舞台运行时仍留在 `src/app.js`,同时被 factory、environment、prompt、storyboard 和 project-data 通过桥读取。P7a 的目标是只搬运已冻结的 F+J 边界,把行为从单文件残文中移出,并用 corrected scope 明确处理调用期依赖,避免引入新的 import 环。

必须守住的边界:

1. `finiteBox`、`frameBounds`、`fitAllActors`、`focusActor` 仍属 viewport framing,留在 `src/app.js`。
2. `semanticLabel`、`POSE_ZH`、`poseText` 仍属 app/UI 文案与提示词辅助,留在 `src/app.js`。
3. `replaceSelectOptions`、`refreshCopyPathUI`、`refreshTimingUI`、`previewChannelHasKeys`、preview mutable state、`GROUND_QUICK_PRESETS`、`GROUND_QUICK_BUTTONS`、`currentGroundQuickPreset`、timing register 和全部 UI RefreshHub handler 留在 `src/app.js`;注册总数保持 app 21 + prompt 1 = 22。
4. `src/core/project-data.js` 不得 import stage;factory/environment 不得 import runtime;prompt/storyboard 可对 runtime 使用真 import。

## 决定

1. **新增 `src/stage/runtime.js`**:承接 F 边界 `configureObjectShadows`、`buildActor`、`stageToData`、碰撞/地形/安全移动、场景同步、`clearStage`、`loadScene`;承接 J 边界 `actorByLabel`、路径 owner/sync、copy/add/remove path point、camera lock、preview camera/joint/scale/elevation/actor animation;并随迁 `v3`、`stageCoord`、`clampStagePoint`、`cleanDimensions`、`actorJointsFromData`、`DEFAULT_GLOBAL_LOCK`、`liveSceneDuration`。
2. **桥出口保持既有模式**:`src/app.js` import runtime 全部 moved names,构建脚本继续剥离 import 并在桥中 re-expose 到 `globalThis`,以保持 smoke/runtime 对旧顶层名字的访问语义。`clampStagePoint` 明确随迁并继续导出。
3. **9 个显式调用期访问**:为避免循环,以下调用保留原函数声明和函数体,只在调用点改为 `globalThis.<name>(...)`:
   - `src/stage/factory.js`: `cleanDimensions`、`buildActor`、`alignAllActorsToTerrain`、`actorByLabel`。
   - `src/stage/environment.js`: `actorWorldBox`、`terrainSupportHeight`、`syncScene`。
   - `src/stage/runtime.js`: `updatePrompt`。
   - `src/core/project-data.js`: `liveSceneDuration`。
4. **真 import 只用于无环方向**:`src/export/prompt.js` 以别名 import runtime 的 `actorByLabel`、`lockTarget`;`src/features/storyboard.js` 以别名 import runtime 的 `syncScene`、`loadScene`、`stageToData`。不新增 core -> stage,也不新增 factory/environment -> runtime。
5. **两项 i18n 偏差收敛**:`copyActorPathToCamera` 成功提示迁到 `path.copySuccess`;早期 runtime error bar 前缀迁到 `error.runtimePrefix`。`zh-CN` 与 `en-US` 同步新增 key,中文显示和原拼接结果保持一致。`src/app.js` 顶部错误可视化注释与数据模型分区注释改为英文 ASCII;不做 P9-0 历史文案清债。
6. **测试语义修正**:`测试/冒烟测试.mjs` 中 `clearStage` 源码级断言只放宽函数声明与左大括号的空白匹配,仍必须证明 `clearStage` 函数体中调用 `disposeOwnedObject3D(a.obj)`;`buildSky`/`rebuildViz` 子断言语义不变。

## 替代方案

- **让 factory/environment 直接 import runtime**:否。会形成 `runtime -> factory/environment` 与 `factory/environment -> runtime` 的环,破坏 P7a corrected scope。
- **把 preview state、timing UI 和 ground quick UI 一并迁入 runtime**:否。这些状态与 DOM/inspector 控件绑定,属 app/UI 留守清单。
- **为源码断言增加注释锚点或死代码锚点**:否。函数 census 与 smoke 需要验证真实函数关系,不通过伪造 source-anchor 通过测试。
- **顺手清理全部历史中文文案**:否。P7a 只迁两项裁决文案,其余留给 P9-0。

## 后果

- `src/stage/runtime.js` 成为舞台运行时所有权模块,后续 P7b/P8/P9 可以在更窄边界上继续拆分 UI、捕获和剩余 app 残文。
- 模块依赖图新增合法边:`app -> stage/runtime`,`stage/runtime -> core/store/core/project-data/core/timing-math/stage/environment/stage/factory`,`export/prompt -> stage/runtime`,`features/storyboard -> stage/runtime`。core 仍不 import stage;factory/environment 仍不 import runtime。
- `src/stage/runtime.js` 遵守 src 代码 i18n 政策,不含裸汉字。
- 根 `预见PreVision.html` 仍仅由 `npm run build` 生成。

## 验证方式(P7a 落地要求)

- `npm run build`;重复 build SHA-256 一致。
- `node 测试/回归/C1_previz_roundtrip.mjs` 与 `node 测试/回归/C2_legacy_migration.mjs` 字节级不变。
- `node 测试/回归/run_all.mjs`,各影响模块测试,`npm run test:app`,`npm run test:i18n`,`npm run test:foundation`,`npm run test:full`,`npm run test:impact -- --base <baseline>`。
- `node scripts/census-functions.mjs --ref <baseline>` 保持 484 -> 484,函数集合差异 0。
- 构建产物 `refresh.register(` 总数 22;`qa/golden/**`、build/census 脚本、package/lock、`qa/test-impact-map.yaml` 无变化。

## 撤销条件

`git revert` 本阶段提交即可回到 P6 形态。若手工回退:删除 `src/stage/runtime.js`,把 F+J 和随迁 helper 原文放回 `src/app.js` 原位,移除 runtime import 与 prompt/storyboard runtime aliases,恢复 factory/environment/project-data 的调用期桥注释和调用点,移除两项新增 language key 与 smoke regex 空白容忍改动,再运行 `npm run build` 生成根 HTML。`qa/golden/**` 不需要修改。

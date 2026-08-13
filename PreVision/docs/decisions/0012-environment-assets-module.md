# ADR-0012:环境与资产模块搬迁(重构 P6:stage/environment.js)

- 状态:accepted
- 日期:2026-07-19
- 范围:重构 P6 —— 子系统 B(渲染器、场景、相机、灯光、太阳、阴影、Three 资源释放、地面网格与 orbit)和子系统 H(项目图片资产、天空、地面外观、标签尺度/显隐、导出观感与资产 GC)从 `src/app.js` 纯搬运至 `src/stage/environment.js`;承接 ADR-0006~0011,不改变产品行为、项目数据格式、导出观感或 RefreshHub 语义。

## 背景

P5 已将建模工厂、分镜规划器和提示词分析器迁出单文件应用,但它们仍通过桥读取大量环境自由引用。P6 的目标是把环境和资产所有权收束到 `src/stage/environment.js`,为后续舞台运行时、捕获和 UI 拆分降低自由引用面。施工前核实了四个决定性边界:

1. `configuredRendererCount`、`assetTex`、`sky`、`exportLookActive` 会被既有残文或冒烟测试 live 读取/写入;普通桥 `Object.assign` 只能提供快照,必须沿用 ADR-0009/0011 的 `globalThis` 访问器 shim。
2. `GROUND_QUICK_PRESETS`、`GROUND_QUICK_BUTTONS`、`currentGroundQuickPreset` 属 inspector/UI,`CAMERA_VIZ_VISIBILITY`、`cameraVizVisibleIn` 属相机可视化;它们留在 `src/app.js`,通过桥读取环境模块导出的地面常量和当前外观。
3. `refreshSunUI`、`refreshGroundUI`、`refreshBgUI` 是 UI 刷新 handler,不随 B/H 搬迁;B/H 本身没有 RefreshHub handler/register。本阶段注册数必须保持 app.js 21 + prompt.js 1 = 22。
4. `src/core/project-data.js` 是 core 层,不得反向 import stage。它对 `DEFAULT_SUN`/`SKY_BASE_R` 的调用期全局依赖保留,仅更新所有权注释。

## 决定

1. **新增 `src/stage/environment.js`**:整块承接 B/H 所有权。B 侧包括 `canvas/configureRenderer/configuredRendererCount`、`renderer/scene/viewCam/shotCam`、灯光与太阳配置、Three 资源 owner/dispose 函数族、checker 地面纹理/网格/边框、`orbit/applyOrbit/setOrbitPivotKeepView`。H 侧包括 `assetTex/assetTextureReady/sky/SKY_BASE_R`、图片导入和资产纹理缓存、天空、地面材质与外观、标签尺度和显隐、`setExportLook` 与 `gcAssets`。
2. **四个 live shim 明确保留**:`environment.js` 在模块求值时安装 `configuredRendererCount`、`assetTex`、`sky`、`exportLookActive` 的 `globalThis` getter/setter,且不通过桥导出同名快照。`groundHelpersVisible` 没有外部 live 读写需求,保持模块私有。
3. **形成真 import 而不是扩大自由引用**:`environment.js` 从 `core/store.js` import `curScene`;`stage/factory.js` 从 `stage/environment.js` import `scene`、`disposeOwnedObject3D`、`assetTexture`;`export/prompt.js` 从 `stage/environment.js` import `shotCam`、`hasBg`、`currentSun`。`project-data.js` 不 import stage。
4. **RefreshHub 保持原地边界**:`refreshSunUI`、`refreshGroundUI`、`refreshBgUI` 和三条 register 留在 `app.js`;`prompt.js` 的 `refresh.register('prompt',updatePrompt)` 维持 P5 所有权。构建产物自查 `refresh.register(` 恰 22 处,无 `syncAll`/`invalidate` 再入迁移。
5. **记录内偏差**:模块注释使用英文;`app.js` 保留一个源文本锚点注释,使既有 smoke 对 `function buildSky(){ if(sky){ scene.remove(sky); disposeOwnedObject3D(sky); sky=null; }` 的源码级正则仍可定位。该锚点不参与运行时逻辑,函数 census 以具名函数集合验证未新增函数语义。

## 替代方案

- **用桥导出四个可变状态**:否。桥暴露的是求值时属性值,不能证明 live binding;冒烟测试和残文裸读会有陈旧值风险。
- **把 inspector 地面快捷预设一并迁入 environment**:否。快捷 preset、按钮和 `currentGroundQuickPreset` 选择函数属于 UI/inspector 所有权,正式边界裁决要求三者留守 `app.js`。
- **让 core/project-data import environment**:否。会形成 core -> stage 反向依赖,破坏 ADR-0008 之后 core 层作为底层契约的方向。
- **把三条背景/太阳/地面 refresh register 随迁**:否。迁出的 B/H 没有 handler 所有权;handler 读写 DOM,仍属 app/UI 阶段。

## 后果

- `src/` 新增 `stage/environment.js`;环境/资产状态从 `app.js` 残文移出,后续 P7/P8/P9 可以围绕更窄的舞台、捕获和 UI 边界继续拆分。
- 模块依赖图新增合法边:`stage/environment -> core/store`,`stage/factory -> stage/environment`,`export/prompt -> stage/environment`。无 stage 反向 import core 以外上层,无 core -> stage 回边。
- `app.js` 继续拥有 viewport 取景、相机可视化、舞台运行时、捕获/播放、inspector UI 与 RefreshHub UI handler。P6 不迁 `stageCoord/clampStagePoint/finiteBox/frameBounds/fitAllActors/focusActor/v3/configureObjectShadows`,也不迁 `GROUND_QUICK_PRESETS/GROUND_QUICK_BUTTONS/currentGroundQuickPreset`。
- 构建产物仍由 `npm run build` 生成,根 `预见PreVision.html` 不是手写源。

## 验证方式(P6 落地当日实测)

- `npm run build`:通过;重复构建后 C8 哈希一致。
- `node 测试/回归/run_all.mjs`:C1/C2/C3/C4/C6/U1/U2/U3/U4/U5/C8 全绿;V1 保持原有真机 GPU 基准未启用 SKIP;`qa/golden/**` 零变动。
- `node scripts/census-functions.mjs --ref 5e271f1095202601a186e830b07643e71b694055`:baseline 484,current 484,差异 0。
- `npm run test:module -- lighting/background/display/capture/viewport/project`:全部通过。
- `npm run test:app`,`npm run test:i18n`,`npm run test:foundation`,`npm run test:full`:全部通过。
- `refresh.register(` 构建产物总数 22;app.js 21,prompt.js 1。

## 撤销条件

`git revert` 本阶段提交即可回到 P5 形态。若只做手工回退:删除 `src/stage/environment.js`,把 B/H 原文放回 `src/app.js` 原位,移除 `app.js`/`factory.js`/`prompt.js` 的 environment import,恢复 `project-data.js` 所有权注释,并重新 `npm run build` 生成根 HTML。`qa/golden/**` 不需要修改。

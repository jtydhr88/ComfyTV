# ADR-0011:独立功能块搬迁(重构 P5:stage/factory.js + features/storyboard.js + export/prompt.js)

- 状态:accepted
- 日期:2026-07-18
- 范围:重构 P5 —— 建模工厂(子系统 C)、离线分镜规划器(子系统 P)、genPrompt 运镜分析器(子系统 S)从 `src/app.js` 纯搬运至 `src/stage/factory.js`、`src/features/storyboard.js`、`src/export/prompt.js`;P4 固化的 P5–P9 迁移纪律首次落实(register 随迁 + handler 清欠自查)。承接 ADR-0006~0010,不改变任何交付契约。

## 背景

P4 落地后拆分方案 P5 要求迁出三个自包含度最高的功能块,验收生死线是 **C3(genPrompt 逐镜头逐字符不变)**。施工前核实了三个决定性事实:

1. **冒烟测试钩子对分镜规划器的可变状态做 live getter**(`get pendingStoryboardPlan(){return pendingStoryboardPlan}` 等 5 个):桥的 `Object.assign` 只能快照值,状态迁为模块级 `let` 后外部裸读必须走访问器 —— 即 ADR-0009 已确立的 globalThis 访问器 shim 机制;
2. **三个区域内不存在任何手拼 refresh 组合**(逐区 grep `rebuildViz/updatePrompt/refresh[A-Z]*/syncAll` 零命中),P4 预告的"每迁一模块顺手替换该模块 handler 的份"在 P5 实际工作量为零;唯一涉及 Hub 的是 `refresh.register('prompt',updatePrompt)` 必须随函数迁走(纪律 ①);
3. **冒烟的源文本钉子均不指向 P5 函数**:`appSrc` 级正则钉的是 clearStage/rebuildViz/buildSky(均不动),`String(fn)`/`String(el.onclick)` 钉的是 capture 家族(P8);`appSrc.includes('STORYBOARD_ANALYSIS_LEXICON')` 是标识符存在性断言,esbuild 重排印不破坏。

## 决定

1. **`src/stage/factory.js`(43 个导出)**:方案清单 32 名(19 建模 + 5 语义代理 + 4 姿态关节 + 4 常量)逐一搬迁;另有 **11 名内部助手强制随迁**——`mat`/`envMat`/`flatMat`(材质简写)、`SEMANTIC_PROXY_BY_ID`(semanticProxyType 的索引)、`applySemanticMaterial`、`actorRebuildData`、`LEGACY_RIDE_JOINT_DEFAULTS`、`horseRideHost`、`DESERT_SIZE`/`DESERT_SEGMENTS`/`DESERT_EDGE_HEIGHT`(地形常量)——判据:经逐名 grep,它们**只被搬迁的工厂函数引用**(ADR-0008 `repairIndexTimes` 先例;DESERT_SIZE/SEGMENTS 另被残文的沙漠采样函数读取,经桥全局直通,P7 收编)。`actorRebuildData` 的 `normalizeEaseSpec` 引用改**真 import**(P2 先例)。**明确不迁**(区间内但不属方案清单、且被残文使用):`stageCoord/clampStagePoint/finiteBox/frameBounds/fitAllActors/focusActor`(视口取景,P6/P8)、`semanticLabel/cleanDimensions`(检查器共用,P9)、`POSE_ZH/poseText/actorJointsFromData`(残文与钩子在用)、`v3/configureObjectShadows`(舞台运行时,P7)。
2. **`src/features/storyboard.js`(77 个导出)**:P 全家**整段连续搬迁**(分析词典与纯函数、规划/校验/物化、对话框窗口族、顶层 DOM/window 绑定 5125–5832 对应段全部)。顶层绑定随模块在桥块求值时执行——仍在同一个 body 末尾 script 内、先于 app.js 残文,DOM 可用性与迁移前一致。**6 个可变模块级 `let`**(`pendingStoryboardPlan/pendingStoryboardSource/storyboardPlanStale/storyboardDialogFullscreen/storyboardDialogRestoreBounds/storyboardDialogResizeSession`)不经桥暴露,改由模块顶层安装 **globalThis 访问器 shim**(ADR-0009 机制,getter/setter 裸代理,`configurable:true`,P9 随店 shim 一并拆除)——冒烟钩子的 5 个 live getter 与一切外部裸读写继续直通。模块真 import:`$`/`curScene`(store)、`SCENE_TEMPLATES`(project-data)。
3. **`src/export/prompt.js`(5 个导出)**:`focalOf/charNDC/sampleShotState/genPrompt/updatePrompt` 逐字节搬迁。**`refresh.register('prompt',updatePrompt)` 随函数迁入本模块**(P5–P9 迁移纪律 ①:Hub 注册表是引用快照,register 必须与函数同模块;app.js 注册块剩 21 条,总数自查 21+1=22)。genPrompt 的汉字串是**输出契约数据值**(地图 §5.4,锁定哨兵 `'手动朝向'`/`'全局'`、焦段/机位/运镜词表),按 ADR-0008 ascii 机制在模块源码转 `\uXXXX`(字符串值不变,C3 golden 逐字符钉死)。模块真 import:`$`/`clock`/`curShot`/`refresh`(store)、`ensureCamKeys`/`shotCurve`(project-data)、`ENV_KINDS`(stage/factory —— export→stage→core,方向合法)。`copyPrompt` 剪贴板绑定不属方案清单,留守 app.js。
4. **P4 迁移纪律逐条落实**:① prompt register 随迁(见上);② 三模块的注册函数体内无 `syncAll`/`invalidate` 再入(updatePrompt 仅写 DOM);③ 注册总数自查 22(产物 grep 实证);④ scheduleThumbs 形状未触碰。**handler 手拼 refresh 组合替换:0 处替换、0 处跳过**——三区域内经 grep 确认不存在此类组合(背景 2),P4 预告的清欠份额在 P5 为空集。
5. **记录内偏差(全部有先例)**:随迁中文注释译英(工厂 18 行、提示词 5 行,ADR-0007 政策"模块注释一律英文";施工脚本对解码 `\uXXXX` 后的文本逐行比对,**仅这 23 行注释有差异,其余逐字节一致**,storyboard 段 0 差异);storyboard 的 `'×'`(U+00D7)转 `×`(值不变);app.js 残文一行中文注释译英(`previewActorPoints` 行——大段删除使 git diff 对齐漂移,该未改动行在 i18n 增量扫描中呈"新增行",按 ADR-0007 施工纠偏先例译英,非搬运改动)。

## 替代方案

- **storyboard 可变状态经桥 `Object.assign` 暴露**:否。快照值不是活绑定,冒烟 live getter 会读到陈旧值(背景 1);访问器 shim 是 P3 已付学费的既定机制。
- **可变状态留守 app.js、模块经全局读写**:可行但状态与其唯一读写者分家,违背"register 与函数同模块"同源的归属原则;方案明文将三个全局列入 storyboard 模块。
- **mat/envMat/flatMat 等助手留守 app.js 当自由引用**:否。它们只被搬迁函数引用,留守即残文孤儿代码,且工厂函数在残文 `const` 求值前被调用的 TDZ 面暴露(boot 虽在末尾,防御面无谓扩大)。
- **genPrompt 汉字改语言键**:否。是 .previz/提示词输出契约数据值,改键=改输出=违背 C3 生死线(ADR-0008 同款裁决)。
- **copyPrompt 绑定随 S 区间一并搬迁**:否。方案 prompt.js 清单只有 5 函数;绑定含遗留硬编码中文 UI 文案,留守 app.js 免于本阶段处置,归属 P9。

## 后果

- `src/` 从 3 模块扩到 6(core/store、core/project-data、core/timing-math、stage/factory、features/storyboard、export/prompt);app.js 剩 ~4,380 行;`stage/`、`features/`、`export/` 三个目录首次出现,后续 P6/P8 直接落位。
- 桥暴露 69 → **194 名**(+factory 43 +storyboard 77 +prompt 5;storyboard 6 个可变状态经访问器 shim 而非桥)。搬迁的 `const` 从脚本全局词法绑定变为 globalThis 数据属性,对标识符读写语义等价(ADR-0008 已记录的同类差异)。
- RefreshHub 注册进入"分布注册"形态:app.js 21 + prompt.js 1;后续每阶段迁出时按纪律 ③ 自查合计恒为 22。
- 模块依赖图新增合法边:export/prompt → stage/factory(ENV_KINDS);storyboard/factory/prompt → core/*。无回边、无新环。
- genPrompt 是最高频迭代区(方案语),从此改提示词只读 145 行的 prompt.js;分镜规则引擎(172 断言的冒烟 storyboard 段)只读 823 行的 storyboard.js。

## 验证方式(P5 落地当日实测)

- `node 测试/回归/run_all.mjs`:C1/C2/**C3**/C4/C6/U1–U5/C8 全绿(**C3 genPrompt 逐镜头逐字符不变** —— 本阶段生死线;qa/golden/ 全程零变动);
- `npm run test:app`:冒烟 968 通过 0 失败(与 P0–P4 基线同数;含 storyboard 对话框窗口族、全按键扫描、seedance/导出源文本断言段);
- `node scripts/census-functions.mjs --ref ac77880`:484=484,差异 = 0;
- 施工脚本抽取比对:三模块正文对解码 `\uXXXX` 后的原文逐行比对,storyboard 708 行 0 差异,factory/prompt 仅 23 行注释翻译差异,其余逐字节一致;
- `npm run test:module -- storyboard`172 / `actor`147 / `project`112 / `camera`84 / `capture`140 / `lighting`32,全过;
- `npm run test:foundation` 全绿(仓库基础 151、C8 11、协调 553、i18n 21、探针启动 11);
- `npm run test:project-input` 真机 Electron 探针 22 项通过(含 inspector rail 段,P3 记录的环境性偶发未复现);
- 注册总数自查:产物 `refresh.register(` 恰 22 处(app.js 21 + prompt.js 1)。

## 撤销条件

`git revert` 本阶段提交串即可回到 P4 形态。仅回退搬迁:删除 app.js 三个 import 块、把三模块函数原文(注释还原中文、`\uXXXX` 还原裸字)放回原位、恢复 6 个 storyboard `let` 声明与 app.js 的 `refresh.register('prompt',…)` 行、删除三个模块文件与三个新目录,qa/golden/ 全程无需变动。

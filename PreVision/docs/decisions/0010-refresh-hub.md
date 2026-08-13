# ADR-0010:RefreshHub 刷新总调度上线(重构 P4,耦合点 3)

- 状态:accepted
- 日期:2026-07-17
- 范围:重构 P4 —— `RefreshHub`(标脏 + 定序冲刷)落户 `src/core/store.js`;22 个 topic 在 app.js 一次性注册;`syncAll` 函数体改为 `refresh.all()`(调用点零改动)。现有 22 个 refresh 函数**一个都不改**。承接 ADR-0006~0009,不改变任何交付契约。

## 背景

UI 刷新扇出是三大耦合点之三(架构地图 §2.2):`rebuildViz` 被 19 个函数调 33 处、`updatePrompt` 14 个函数 32 处、`syncAll` 是 11 个 refresh 的手工总闸;每个编辑 handler 自选 refresh 组合,顺序与遗漏全靠人记。拆分方案 §2.3 给出 RefreshHub 设计(约 40 行,无订阅、无 diff),P4 行要求:Hub 上线、22 topic 注册、syncAll 改 `refresh.all()`、handler 组合机械替换为 `invalidate`。

施工前核实了两个决定性事实(上一阶段施工者预警,本阶段逐一验证):

1. **冒烟测试大量"调 handler 后同步断言 DOM"**,方案草图的 `queueMicrotask` 合并冲刷会把刷新推迟到断言之后 —— 时序冲突是结构性的,不是个别断言;
2. **冒烟对部分 handler 有运行时源文本断言**(如 `String(el('seedancePack').onclick)` 必须含 `after:()=>{btn.disabled=false`、`prepareAutomaticCapture('seedance')` 与 `beginCaptureTransaction` 的相对顺序),散点替换 handler 体的每一处都要逐段核对;另有 `appSrc` 级正则钉住 `rebuildViz` 等函数体开头(本阶段不动这些函数,不受影响)。

## 决定

1. **`RefreshHub` 落户 `src/core/store.js`**(方案指定位置,三大耦合点的家),对外一个 `refresh` 对象:
   - `REFRESH_TOPICS` 固定冲刷顺序(数据列表 → 面板 → 可视化 → 提示词 → 播放条),22 个 topic 与方案 §2.3 清单逐一相同;
   - `register(topic, fn)`:各 refresh 函数注册一次;`invalidate(...topics)`:标脏 + 冲刷;`flush()`:按 TOPICS 序执行并去重;`all()` = 全量 invalidate,即旧 `syncAll` 语义;
   - **未知 topic 快速失败**(对方案草图的小增补):草图里拼错的 topic 会被定序冲刷静默丢弃(flush 只遍历 TOPICS),这正是 Hub 要消灭的"AI 改 UI 时最容易漏"一类;register/invalidate 一律先校验并 throw。
2. **记录内偏差 ①:`invalidate` 同步冲刷,不做微任务合并**(方案草图为 `queueMicrotask` 合并)。理由见背景 1;`refresh.invalidate(...)` 因此与"就地调那几个 refresh"时序完全一致,仅顺序归一为 TOPICS 序。API 形状与方案相同,后续阶段若引入微任务合并只改 Hub 内部,调用点零改动。
3. **22 个 topic 在 app.js 注册**(函数声明整脚本提升,注册块置于 `syncAll` 原位、boot() 之前执行,前向引用安全)。注册是过渡态:P5–P9 各 UI 模块迁出时,把自己的 `refresh.register(...)` 带走,即方案"各 UI 模块 init 时注册一次"的目标态。
4. **`syncAll(){refresh.all();}`**,3 个调用点(loadScene / restoreProjectOpenSnapshot / restoreAutomaticCaptureState)零改动。语义变化(方案有意为之,"消灭遗漏"):旧 syncAll 直调 11 个 refresh(经 refreshShotPanel/refreshObjList/refreshObjectTransformUI 传递闭包覆盖 18 个 topic),`all()` 冲刷全部 22 个 —— 新增执行的是 `timing/ground/bg/thumbs` 四个:全部是带守卫的幂等 DOM 回写。**计数口径(时序审计澄清)**:"18 topic / 新增四个"按**保证执行面**计——静态传递闭包实为 19 个(`rebuildViz` 尾部无条件调 `refreshTimingUI`,src/app.js:1982),但 `rebuildViz` 开头 `if(!s)return` 早退,无当前镜头的边缘态下 timing 不保证执行,故不计入旧保证面;常态(有镜头)下净新增仅 ground/bg/thumbs 三个,timing 经 viz 槽与自身槽双跑(幂等,见后果·遗留)。`scheduleThumbs` 恒设 180ms 防抖 timer,no-op 守卫在 `renderShotThumbs` 内(无 `canvas.shot-thumb` 或无镜头时直接 return):每次 syncAll 在镜头层级多一次防抖重绘,幂等无害;场景层级无缩略图 canvas,timer 到期即空转返回。旧序中 shotPanel 先于 objList,TOPICS 序反之,两者无相互依赖。以上全部经冒烟 968 + 真机探针实证。
5. **记录内偏差 ②:方案 P4 行的"全部 handler 的 refresh 组合机械替换为 `invalidate`"本阶段不做**,只迁 syncAll 这一个方案点名的接入点。理由:背景 2 的源文本断言要求每个散点替换逐段核对(方案本就给 P4 预算 1–2 会话);同步冲刷下 `invalidate` 已可用且时序等价,替换可以渐进 —— 后续阶段(P5–P9 每迁一个模块顺手替换该模块内的 handler 组合)零成本推进,Hub 的 topic 校验保证替换写错立刻炸而不是静默丢刷新。`markDirty` 与刷新继续分流(与今天一致)。
6. 新增代码零 `function 名(` 声明(Hub 全部对象方法/箭头函数),census 集合不变;`refresh` 经桥按原名暴露 globalThis(共 69 名),全库无同名冲突。

## 替代方案

- **微任务合并冲刷(方案草图原文)**:否,见背景 1。冒烟的同步断言模式覆盖全部 handler 路径,改冒烟本体在重构期间是禁区(346KB 不动本体,ADR-0007);留给 handler 替换完成、测试钩子随 P9 模块化改造之后评估。
- **Hub 独立成 `core/refresh-hub.js`**:否。方案 §1/§2.3 明文 Hub 住 store.js(三大耦合点同居依赖图根部);拆文件是 P9 之后的自由。
- **只注册 syncAll 用到的 11 个函数**:否。方案明文 22 topic;`all()` 覆盖全 UI 恰是"总闸不再挑食"的机制收益,且实测无回归。
- **本阶段强行做全量 handler 替换**:否,见决定 5 —— 60+ 处散点各带源文本断言/顺序敏感风险,收益(去重复刷新)在同步冲刷下只是省几次幂等 DOM 回写,不值一次性吃下全部风险。

## 后果

- 编辑 handler 从此可以写 `refresh.invalidate('shotPanel','viz','prompt')` 替代手工组合;刷新顺序由 Hub 一处定序,拼错 topic 立刻抛错。存量 handler 的机械替换成为纯粹的渐进式清欠(与 clock 动词清欠同类),P5–P9 每迁一模块顺手做该模块的份。
- 跨模块回边(stage 想刷 ui)自此一律走 `refresh`,esbuild 循环依赖告警条款(方案 §3.1)有了指定出口。
- `syncAll` 调用点的实际刷新面从 18 topic 扩到 22(timing/ground/bg/thumbs),右栏时序/地面/背景控件在 loadScene/撤销恢复/捕获恢复后不再依赖"上次谁顺手刷过"。
- 桥暴露清单 68 → 69(`refresh`)。
- **遗留(双跑,幂等无害,P5–P9 清欠时顺手消除)**:flush 全量冲刷时部分 topic 执行两次——timing 经 viz 槽(`rebuildViz` 尾部直调 `refreshTimingUI`)+ 自身槽;同类还有 camPt/aim/lock/monitor(经 shotPanel 直调)、mount(经 objList)、semantic(经 transform),各经父级直调 + 自身槽。全部幂等,现阶段不动;P5–P9 迁移相应模块、把 handler 组合替换为 `invalidate` 时一并消除父级内的直调。
- **P5–P9 迁移纪律(时序审计固化)**:
  1. **Hub 注册表是引用快照**:`register` 存函数引用,注册后替换 `globalThis.refreshX` 不再影响冲刷(旧 syncAll 直调是晚绑定,行为不同)。迁移 refresh 函数时必须连 `refresh.register(...)` 一起迁走,禁止旧引用留在 app.js。
  2. **flush 无再入防护**:注册的 refresh 函数体内禁止调 `syncAll`/`invalidate`(现状 22 个均不调——靠纪律不靠机制,迁移时保持;函数间交叉刷新继续直调)。
  3. **flush 对"合法但未注册"的 topic 静默跳过**:这是 register 迁出 app.js 时的回归点——漏带一个 register 不报错、只静默丢刷新,冒烟"全按键扫描"与真机探针兜底之外,迁移 PR 应自查注册总数仍为 22(或模块拆分后的合计)。
  4. `scheduleThumbs` 恒设 180ms 防抖 timer,no-op 守卫在 `renderShotThumbs` 内;多余触发幂等无害,迁移时不要"顺手优化"改变该形状(缩略图防抖合并依赖它)。

## 验证方式(P4 落地当日实测)

- `node 测试/回归/run_all.mjs`:C1–C4/C6/U1–U5/C8 全绿(golden 全程零变动);
- `npm run test:app`:冒烟 968 通过 0 失败(与 P0–P3 基线同数,含"全按键扫描"段与 seedance/导出源文本断言段);
- `node scripts/census-functions.mjs --ref 5d1208d`:484=484,差异 = 0;
- C8 构建守门 11/11(重建幂等 + 与工作区字节一致);`npm run test:foundation` 全绿(仓库基础、协调 553、i18n 21、探针启动 11);
- `npm run test:project-input` 真机 Electron 探针 22 项通过,连跑两次无偶发(P3 记录的 inspector rail 环境性偶发未复现)。

## 撤销条件

`git revert` 本阶段提交串即可回到 P3 形态。仅回退 Hub:app.js 删注册块与 import 中的 `refresh`、`syncAll` 函数体还原 11 连调原文、store.js 删 RefreshHub 段,qa/golden/ 全程无需变动。

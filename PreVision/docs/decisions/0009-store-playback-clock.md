# ADR-0009:Store + PlaybackClock 收编八核心全局(重构 P3,耦合点 1)

- 状态:accepted
- 日期:2026-07-17
- 范围:重构 P3 —— 应用 Store(`project/sceneIdx/shotIdx/actors/shots/selected/time/playing` 八个核心全局)、访问器 `curScene/curShot/sceneDur/shotStart` 与 `$` 迁入 `src/core/store.js`;`PlaybackClock` 与 globalThis 访问器 shim 上线;拆分方案 §2.1 借用者改造。承接 ADR-0006/0007/0008,不改变任何交付契约。

## 背景

`time`/`playing` 是全应用头号雷区(架构地图 §2.2):11/12 个函数直接写、30+ 个函数读,`sampleShotState` 等借用者靠手工"快照→改写→还原",一处遗漏即播放态污染。拆分方案 P3 要求把八个核心全局收进 `core/store.js`(依赖图的根,不 import 任何业务模块),`time`/`playing` 由 `PlaybackClock`(五动词 + `lease()` 借用-归还)接管,并以 globalThis shim 让未迁移写点原样工作。

施工前核实了一个决定性的语言事实:**方案的 shim(`Object.defineProperty(globalThis,'time',…)`)与 app.js 残文的脚本级 `let time` 声明互斥** —— 脚本顶层 `let/const` 是全局词法绑定,对同名裸标识符的解析优先于(遮蔽)globalThis 访问器属性。因此 shim 要生效,残文中对应 `let` 声明必须删除;且 shim 必须由 store.js **模块顶层自己** defineProperty 安装 —— 桥的 `Object.assign(globalThis,…)`(ADR-0007)只能制造数据属性,造不出访问器;桥块先于 app.js 残文执行的既有时序恰好保证 shim 先于一切读写就位。

## 决定

1. **`src/core/store.js` 上线**,依赖图的根(零 import,人人可 import):
   - `clock`(PlaybackClock):`seek/play/pause/tick` 四个写动词 + `time/playing` 读 + `lease()`(借用-归还的唯一合法姿势,`restore()` 幂等)+ `withFrozen(t,fn)` 语法糖,实现为拆分方案 §2.1 原文(注释译英);`time/playing` 的状态与初值(0/false)收进 `clock._t/_playing`;
   - 六个数据全局以模块级 `let` 落户(声明与初值来自 app.js 原文):`project=null, sceneIdx=0, shotIdx=0`、`actors=[]`、`shots=[]`、`selected=null`;
   - **globalThis 访问器 shim(过渡设施,P9 拆除)**:模块顶层为八个名字 `Object.defineProperty(globalThis, name, {get, set, configurable:true})` —— `time/playing` 代理到 `clock._t/_playing`,其余六个代理到模块级 `let`。setter 一律裸写、零副作用,语义与原脚本级绑定逐点一致(方案 §2.1"shim 的 setter 是裸写"条款);`configurable:true` 留给 P9 拆除;不设 `enumerable`(默认 false,最接近原 `let` 不上 globalThis 的可见性);
   - `curScene/curShot/sceneDur/shotStart` 与 `$` 函数体逐字节纯搬运迁入(施工比对一致),经桥按原名暴露;四个访问器在模块内直接读模块级 `let`(与原读全局语义一致且更直接)。
2. **app.js 删除八个全局的顶层 `let` 声明**(shim 互斥所迫,本阶段"非纯搬运"改动第一类,逐处清单见下);同一行内不属于 Store 的变量(`sceneRailLevel`、`dragging/dragMode/rotStartX/rotStart`、`playAllMode`)保留原声明拆行留守。app.js 其余 **30+ 处裸读写零改动**,经 shim 继续工作(冒烟 `__T` 钩子与回归 harness 钩子的 `time=v`/`sceneIdx=si` 类裸赋值同理,实测直通 shim)。
3. **方案 §2.1 借用者改造**(本阶段"非纯搬运"改动第二类,共 4 函数):
   - `sampleShotState`:手工 `saveT/saveP` 快照-还原 → `clock.lease()` + `clock.pause()` + `clock.seek(0/s.dur)` + `lease.restore()`,控制流不变(不加 try/finally,与原函数异常路径行为一致;C3 golden 逐字符钉死);
   - `scrubSceneTime`:`time=…;playing=false;` → `clock.seek(…);clock.pause();`;
   - `previewCameraPoint`/`previewActorPathPoint` 强制暂停:`playing=false;` → `clock.pause();`。
4. **记录内偏差:`recordBlob` 与 seedancePack 不在本阶段改造**(方案 §2.1 原文将其列入 5 借用者)。方案写就后代码已演进:两者的"借用-归还"已被捕获事务体系收编 —— 快照/还原统一走 `captureAutomaticCaptureState()/restoreAutomaticCaptureState()`(15+ 字段的完整状态对象,经 shim 读写 `time/playing`),函数体内已不存在可改造成 `lease()` 的手工 time/playing 快照对;残留的 `time=0`/`time+=1/REC_FPS`/`playing=true` 是**驱动写**而非借用写。此时引入 `lease()` 等于给事务还原体系叠加第二套还原层,徒增竞态面。这些驱动写点经 shim 原样工作,留待 P8(capture 迁移)随模块化改为 clock 动词。
5. `scheduleThumbs`/`renderShotThumbs` 的 `saveT/saveI/saveP` 借用与 `restoreProjectOpenSnapshot` 等其余写点,按"逐阶段迁移"原则本阶段一律不动(方案 §2.1:"逐阶段把 11+12 个写者改为五个动词,最后一阶段删 shim")。
6. `core/project-data.js` 头注释中"`deepCopy/sceneTemplateById/sceneTemplateText/liveSceneDuration` 属 P3 目标"的预告注记修正为实况(不在方案 store 清单内,留守 app.js 至其归属模块阶段)。

### app.js 声明删除清单(非纯搬运改动全录)

| 原行(P2 末态) | 原文 | 处置 |
|---|---|---|
| 12 | `const $=id=>document.getElementById(id);` | 逐字节迁入 store.js |
| 962 | `let project=null, sceneIdx=0, shotIdx=0, sceneRailLevel='scenes';` | 前三个迁 store(初值同);`sceneRailLevel` 留守独立成行 |
| 963 | `let actors=[];`(注释译英随迁) | 迁 store |
| 964 | `let shots=[];`(注释译英随迁) | 迁 store |
| 965 | `let selected=null, dragging=null, dragMode='move', rotStartX=0, rotStart=0;` | `selected` 迁 store;其余留守独立成行 |
| 966 | `let playing=false, playAllMode=false, time=0;` | `playing/time` 收进 `clock._playing/_t`(初值同);`playAllMode` 留守独立成行 |
| 972–975 | `function curScene/curShot/sceneDur/shotStart` | 逐字节迁入 store.js |

## 替代方案

- **桥内(bundle 入口)装 shim 而非 store 模块顶层**:否。shim 属于 Store 的语义(状态与代理必须同源同模块),桥是机械打包设施;且拆桥(P9)时 shim 的去留应随 store 模块自身演进,不应耦合在构建脚本里。
- **保留 `let` 声明、改为每处读写显式 `clock.…`/`store.…`**:否。一次性机械改写 30+ 读点 + 23 写点,违背"渐进式、每阶段最小改动面"的方案主线,且失去 shim 期"未迁移代码原样能跑"的回退空间。
- **六个数据全局用一个 `storeState` 对象承载而非模块级 `let`**:等价方案。选择模块级 `let` 是因为声明文本可从 app.js 原样搬运(连同初值),`curScene` 等函数体逐字节不动即可直读模块绑定,审计面更小。
- **`recordBlob`/seedancePack 强行按方案原文改 `lease()`**:否,见决定 4 —— 方案基于的"手工还原"形态已不存在,机械执行反而制造双还原竞态。
- **shim 的 time setter 走 `clock.seek()`**:否。方案明文"setter 是裸写,不夹带副作用";seek 今日虽亦裸写,语义上是"动词",留给显式调用者。

## 后果

- `src/` 出现第三个真实模块;app.js 剩 ~5,650 行;`time/playing` 首次有了唯一属主(`clock`),后续阶段每迁一个模块顺手把该模块内的写点改成动词,P9 删 shim 后"只剩五动词 + lease"的目标态(方案 §6)即达成。
- 桥暴露清单新增 6 名(`$`、`clock`、`curScene/curShot/sceneDur/shotStart`),共 68 名;八个核心全局从"脚本词法绑定"变为 globalThis 访问器属性 —— 对裸标识符读写语义等价(实测冒烟 968 全过),差异仅在 `Object.getOwnPropertyDescriptor(globalThis,…)` 可见(shim 探针以此断言就位)与 `window.time` 类限定访问从 undefined 变为可读(全库无此用法)。
- 每帧渲染循环对 `time/playing/shots` 等的裸读从词法绑定读取变为 getter 调用,量级微秒/帧,实测冒烟与真机探针无感。
- 新增写点**必须**优先用 clock 动词;继续裸写 `time/playing` 虽在 shim 期可用,但会加长 P9 前的清欠清单(工作手册"不要发明第五种借法"条款继续有效)。

## 验证方式(P3 落地当日实测)

- `node 测试/回归/run_all.mjs`:C1/C2/**C3**/C4/C6/U1–U5/C8 全绿 —— C3(genPrompt 逐镜头逐字符 + 每镜头 `time===0` 借用归还断言)是 `sampleShotState` lease 化行为等价的直接证据;
- `npm run test:app`:冒烟 968 通过 0 失败(与 P0/P1/P2 基线同数)。其中镜头导出("exactly-once 恢复完整导航/播放/选择/预览状态")、场景导出("恢复起始 sceneIdx/shotIdx/time/playing/playAllMode")、Seedance 素材包(`T.time===seedanceState.time && T.playing===seedanceState.playing` 精确断言)三段即"录制导出与素材包导出路径的 time 借用-归还在 shim 下行为不变"的针对性覆盖点;
- 产物 VM shim 探针(临时施工脚本,21 断言):八个名字均为 configurable 访问器而非数据属性;裸写↔clock 动词双向一致;`lease()` 还原精确且幂等;`withFrozen` 正常/异常路径均还原;harness `setTime` 直通 shim;`genPrompt` 后 time/playing 逐位还原;
- `node scripts/census-functions.mjs --ref 70f1eb3`:484=484,差异 = 0(删声明不减函数;四访问器在桥 bundle 中按原名可见);
- 迁移函数体(`curScene/curShot/sceneDur/shotStart/$`)与 HEAD 原文逐字节比对一致;
- `npm run test:foundation` 全绿(仓库基础 151、C8 11、协调 553、i18n 21、探针启动 11);`npm run test:module -- project` 112 通过;
- `npm run test:project-input` 真机 Electron 探针通过;其"inspector rail 滚动稳定性"段存在**先于本阶段的环境性偶发**(在基线提交 70f1eb3 上 6 跑 2 挫,错误同为 `inspector … rail … unstable` 布局漂移;P3 分支 5 跑 2 挫,比率相当,失败样本与基线同形),与本阶段改动无因果,按工作手册记录不追;该探针在两分支上均能通过。

## 撤销条件

`git revert` 本阶段提交串即可回到 P2 形态。仅回退 Store:删除 app.js 的 store import 块、恢复被删的 8 个 `let` 声明与 4 个访问器函数及 `$` 原文、4 个借用者函数体还原手工快照写法、删除 `src/core/store.js`,qa/golden/ 全程无需变动。

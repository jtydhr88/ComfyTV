# ADR-0007:esbuild 进场与首次模块搬迁(重构 P1:core/timing-math.js)

- 状态:accepted
- 日期:2026-07-17
- 范围:重构 P1 —— E 子系统(时间采样纯数学)16 个纯函数从 `src/app.js` 搬入 `src/core/timing-math.js`;esbuild 作为唯一获批新增 devDependency 进场;确立"桥打包"过渡机制与 U1/U2/U3/U5 纯函数单测。承接 ADR-0006,不改变任何交付契约。

## 背景

P0 已把根 HTML 变为字节级可证的构建产物(纯字符串拼接)。P1 按拆分方案要求迁出第一个 ES 模块,esbuild 从"第一个 import 出现"起接管 app-bundle 占位符。但施工前核实了三个既有事实,排除了"app.js 整体交给 esbuild bundle"的直接路径:

1. **冒烟测试(346KB,重构期间不动本体)对块 2 源文本做逐字符正则断言**(如 `/function clearStage\(\)\{/`、storyboard 词典存在性),esbuild 重排印(pretty-print)必然破坏;
2. **VM 测试钩子与冒烟测试的 `__T` 钩子以"script 顶层声明=上下文全局"取函数**,IIFE 整体包裹会使全部顶层声明不可见,回归安全网 C1–C4/U4 与冒烟测试同时失明;
3. 162 处历史 `on*=` 语义与 `var` 提升语义同理依赖顶层作用域(拆分方案风险表已列)。

## 决定

1. **桥打包(bridge bundling)过渡机制**:`src/app.js` 用标准 ES `import { … } from './core/timing-math.js'` 声明依赖(AI/IDE 可读的真实依赖边);构建时 `scripts/build-app.mjs` 把 import 语句剥离,按 import 清单生成桥入口交给 esbuild 打包为 IIFE 前置块,末尾 `Object.assign(globalThis, {…})` 按**原名**暴露 —— 运行时全局语义与拆分前逐点一致(模块函数成为全局、app.js 残文逐字节保留、顶层声明仍是上下文全局)。块 2 = 桥 bundle + app.js 残文,产物形状(恰好 2 个无属性 script 块、外链白名单)不变,由 C8 继续守门。
   - 构建契约:app.js 只允许顶层具名 import(无别名/默认/命名空间导入,仅相对路径),剥离器 fail-closed;
   - `src/app.js` 无 import 时自动退回 P0 纯拼接(逐字节原文),构建脚本对 P0 形态保持后向兼容。
2. **esbuild 0.28.1 锁定精确版本**写入 devDependencies(`--save-exact`),参数全部内联在 build 脚本:`bundle + format:'iife' + charset:'utf8' + minify:false + write:false`。**不设 `target:'es2019'`(偏离方案 §3.2)**:降级目标会把源码的 `?.`/`??` 等改写为兼容展开,违背"纯搬运、产物最小差异"的更高原则;交付环境(Electron 43/Chromium)原生支持现代语法,故让 esbuild 语法直通。
3. **首批搬迁(纯搬运,函数体一字不动,已逐函数字节级比对)**:`normalizeEaseSpec / cubicBezierEase / applyEaseSpec / segmentArcParameter / timedPathState / timedValueState / curveProgressAtControlPoint / unwrapAngles / hermiteAt / sampleCameraKey / sampleTimedCameraKey / actorCurve / pointIndexedPosition / pointIndexedTangent / inverseSmoothProgress / nodeArrivalTime` 共 16 个,与拆分方案 timing-math 清单逐一对应。模块保留过渡期自由引用(`THREE`、`distributedPathTimes`、`ensureCamKeys` 等 app.js 全局,P2 迁入 project-data 后改真 import),在模块头注释显式登记。方案地图中标注 E 区间内但不属于 timing-math 清单的 `ensureEaseArray / cameraKeyProgress / actorPointProgress / cameraAimDirection` 留在 app.js(分属 P2/其他模块)。
4. **U1/U2/U3/U5 纯函数单测**随拆迁落地(回归测试清单 §2),挂入 `测试/回归/run_all.mjs`:
   - golden 基准 `qa/golden/timing/timing-math.json` 由**拆分前的未拆分实现**在固定输入上打表录制(record_golden.mjs 扩展,fixture 共享于 `timing_fixtures.mjs`),拆出模块逐位复现 —— "搬运未改行为"的直接证据;端点/对称性/钳制已人工验算;
   - U1/U3 及 U2/U5 的纯函数部分直接 `import` 模块(`harness/timing-env.mjs` 装载 vendor Three.js 到全局);`sampleCameraKey/sampleTimedCameraKey` 与 timedPathState 的 times 兜底分支因过渡期依赖 app.js 全局,经交付产物 VM(bootApp)回放**真实实现**,零 stub —— P2 迁入依赖后可改直接 import,断言不变。
5. **验收让位声明**(ADR-0006 预告):P1 起根 HTML 与上一版字节级一致不再成立,验收改由"回归安全网全绿 + 函数清点差异 0 + 冒烟全量 + U 系"承担。

## 替代方案

- **app.js 整体 esbuild bundle(方案 §3.2 原文形态)**:P1 不可行,理由见背景 1/2(冒烟源文本断言 + VM 顶层取函数)。该形态是 P9(main.js 显式初始化 + exposeGlobal 契约 + 测试钩子随模块化改造)之后的目标态,届时另立记录。
- **纯 Node 拼接走到底**:仍是回退备选(方案 §3.1);桥机制失败时删桥、把 import 改回函数原文即回到 P0 形态。
- **模块经 `globalName` 暴露命名空间(如 `TimingMath.applyEaseSpec`)**:否,需机械改写全部调用点函数体,违背纯搬运纪律。

## 后果

- `src/` 下第一次出现真实模块边界;后续阶段沿同一桥机制逐模块扩容 import 清单,直到 P9 拆桥。
- 桥 bundle 是 esbuild 重排印的模块代码(缩进/空白与源不同,注释被剥离),但**语义等价、函数名齐全**:census 函数清点(声明正则)与 C8 ④(顶层声明扫描)均不受影响,已实测 484=484。
- `qa/i18n-policy.json` 的 `^src/(?!app\.js$)` 扫描对新模块生效:`core/timing-math.js` 及后续新模块的注释一律英文;随迁的中文注释不进模块(译为英文),app.js 中新增注释也须英文(构建产物 diff 会被 i18n 政策扫描,施工中已被抓红一次并改正)。
- record_golden.mjs 新增 timing 录制段:任何阶段 `--update` 录到的都是"当前交付产物"的行为(sandbox 全局取函数,拆分前=顶层声明,拆分后=桥暴露)。

## 验证方式(P1 落地当日实测)

- `node 测试/回归/run_all.mjs`:C1–C4/C6/U4/**U1/U2/U3/U5**/C8 全绿(U 系新增 313 断言);
- `npm run test:app`:冒烟 968 通过 0 失败(与 P0 基线同数);
- `node scripts/census-functions.mjs --ref b3a76ac`:484=484,差异 = 0;
- 16 个函数体与 HEAD 原文逐字节比对一致(施工脚本抽取比对);
- `npm run test:foundation` 全绿(仓库基础 151、C8 11、协调 553、i18n 21);`npm run test:project-input` 真机 Electron 探针全绿;
- 已知历史问题(与本阶段无关,P0 基线同样失败):`测试/Web压力测试工装测试.mjs` 的 "check mode is read-only JSON and does not claim Windows on macOS" 1 例,属本机环境判定,已按工作手册记录不追。

## 撤销条件

`git revert` 本阶段提交串即可回到 P0 形态(根 HTML 仍是完整可用单文件)。仅回退桥机制:删除 app.js 的 import、把 timing-math.js 函数原文放回原位、build 脚本退回 P0 版,esbuild 从 devDependencies 移除。

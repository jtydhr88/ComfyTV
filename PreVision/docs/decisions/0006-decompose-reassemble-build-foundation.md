# ADR-0006:单文件应用的"拆解-重组"构建底座(重构 P0)

- 状态:accepted
- 日期:2026-07-17
- 范围:确立模块化重构(P0–P9)的构建形态与验收纪律;不改变任何交付契约。配套施工图为知识库《预见/拆分方案》,回归护栏为 `qa/regression-safety-net` 安全网(测试/回归/ + qa/golden/)。

## 背景

`预见PreVision.html` 已达 6900+ 行 / 1.1MB,两个内联 `<script>` 块(内嵌 Three.js r128 + 全部应用逻辑)使 AI 每次改动都要面对超长单文件,改动面与回归风险不可控。既有硬约束不变:交付形态必须是单文件 HTML(Three.js 内嵌、禁止外链),Electron `file://` 加载、`web:build`、冒烟测试(依赖"恰好 2 个无属性 script 块"的提取正则)、`app:deliver` 全部指向根 HTML。

直接引入打包器一步到位的风险不可接受:无法区分"构建底座引入的差异"与"代码搬运引入的差异"。需要一个先证明"构建不改变任何东西"、再逐阶段搬运代码的路径。

## 决定

1. **源文件成为事实源头**,根 `预见PreVision.html` 变为构建产物但**继续提交进 git**(下游链路零改动):
   - `app-shell.html` —— HTML 壳模板(head/CSS/body DOM),用 `<!--@inline:vendor/three.r128.min.js-->` 与 `<!--@inline:app-bundle-->` 两个占位注释标记内联位置;模板内禁止出现无属性 `<script>` 块。
   - `vendor/three.r128.min.js` —— 从 HTML 抽出的内嵌 Three.js 原文(构建时重新内联,交付仍单文件)。
   - `src/app.js` —— 应用逻辑块逐字节原文(P1 起逐阶段拆为 ES 模块)。
2. **`scripts/build-app.mjs` 单命令重组**(`npm run build`;`npm run dev` = `--watch` 监听重建):把两个占位符替换为无属性 `<script>…</script>` 内联块,写出根 HTML。P0 阶段为**纯字符串拼接**——不引 esbuild、不做任何转换,产物与拆解前**逐字节相同**(SHA-256:`bf889ba7034ae3b8ec175c8968258b2a8f4be7be3dc8206498018f11ebd237bb`)。esbuild(唯一获批新增 devDependency)从 P1 第一个 `import` 出现时才进场,届时 `app-bundle` 占位符接 bundle 输出。
3. **守门测试 C8 扩为四项**并接入 `test:foundation`:①重建幂等 + 构建输出与工作区根 HTML 字节一致(防"改了 src 忘 build 就提交");②产物恰好 2 个无属性 script 块;③外链白名单;④`on*=` 内联处理器全局名完整性。①在 P0 期间同时是"构建底座未改变任何东西"的验收生死线。
4. **函数清点工具** `scripts/census-functions.mjs`:对比构建产物与任意基准提交的应用层具名函数名集合,纯搬运阶段要求差异 = 0(防搬丢搬重)。实现偏差说明:方案原文建议 acorn AST,因仓库零新增依赖原则(获批清单仅 esbuild 且尚未进场),改用正则收集 `function 名(` 声明——对"逐字节搬运"的清点目的等价。
5. **纪律**:重构一阶段一分支;根 HTML 每阶段重建提交;回退 = `git revert` 单个合并提交;`qa/golden/` 只进不改。

## 替代方案

- **一步引入 esbuild/Vite 打包**:否。无法区分"构建差异"与"搬运差异",首步必须字节级可证;Vite/Rollup 的配置与插件生态是本项目不需要的重量(拆分方案 §3.1)。
- **纯 Node 拼接走到底(永不引 esbuild)**:备选保留。源码将无法使用 import/export 显式声明依赖,放弃 AI 可读性的一半收益;若 P1 esbuild 输出出现不可控行为差异,回退到此方案。
- **维持单文件手工编辑现状**:否,重构动机本身。

## 后果

- 自本记录起,**手改根 `预见PreVision.html` 即错误**(C8 会红):改内容一律改 `src/`/`app-shell.html`/`vendor/three.r128.min.js` 后 `npm run build` 回灌。
- 冒烟测试、Electron、web:build、交付脚本对产物的所有假设由 C8 ②③④ 钉死,构建演进(P1 引 esbuild)不得破坏产物形状。
- i18n 政策(`qa/i18n-policy.json`)对 `src/app.js` 做负向排除:其内容是根 HTML 中既往豁免代码的逐字节搬运,且 C8 ① 保证两者字节一致——任何向 src/app.js 新增的中文必然同步出现在根 HTML 的 diff 中,被政策既有的 `^预见PreVision\.html$` 扫描规则抓住,覆盖面零损失。P1 起 src/ 下新拆模块不在豁免内(仍受 `^src/` 扫描);搬运携带的存量中文届时按同一"根 HTML diff 兜底"逻辑处理。
- P1 起字节级一致不再可能(bundle 转换),验收改由回归安全网(C1–C4/C6/U4)+ 函数清点 + 冒烟全量承担;字节级门在 P7(字段表改写)以 C1/C2 golden 形式重现。

## 验证方式

- `node 测试/回归/C8_build_gate.mjs`(已挂入 `npm run test:foundation`):重建幂等、与工作区字节一致、产物形状、外链白名单、on*= 全局名。
- `node 测试/回归/run_all.mjs` 全绿(C1–C4/C6/U4/C8);`node scripts/census-functions.mjs` 差异 = 0。
- P0 落地当日实测:构建前后根 HTML SHA-256 同为 `bf889ba7…`,git diff 为空。

## 撤销条件

若后续阶段发现构建链路与 Electron/交付脚本存在不可调和冲突,`git revert` 本阶段合并提交即可回到"根 HTML 手工编辑"形态——根 HTML 始终是完整可用的单文件,源文件与构建脚本删除后不留任何运行时痕迹。

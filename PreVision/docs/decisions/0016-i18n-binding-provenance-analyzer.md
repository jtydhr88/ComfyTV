# ADR-0016：国际化绑定溯源分析器

状态：Accepted
日期：2026-07-19

## 背景

ADR-0002 已要求运行时代码新增用户文案必须使用 language key。当前 `npm run test:i18n` 能检查语言包一致、key 引用和新增直接中文 diff，但对“字符串从哪里来”没有绑定级溯源能力。若测试只按函数名、变量名或全 AST 同名搜索推断 producer/consumer，重构 P9 阶段的 shadow、alias、默认参数、wrapper 转发和 return 形态可能产生误判：测试以为某个文案已被证明不可达或已被 key 覆盖，实际却只是同名绑定、不同作用域或不完整 provenance。

因此需要在不引入依赖、不改变产品代码的前提下，为国际化测试建立一个小而严格的同文件静态分析基础。它不尝试成为 JavaScript 通用解释器；它只在可唯一证明的语法子集内消费结果，其他情况统一 fail closed。

## 激活边界

P9-0a 只建立 synthetic conformance foundation 和 fixture oracle：新 analyzer 在合成 fixture 矩阵中证明 binding identity、provenance 和 fail-closed 语义，不立即扫描真实 `src/app.js`、`预见PreVision.html` 或其他产品 runtime producer，也不改变当前产品门禁结论。

现有 `test:i18n` 门禁继续保留并保持原语义：locale/key 集合一致、browser/Node runtime 行为、应用 key 引用完整性，以及基于 ADR-0002 起点的 direct-Han diff 守卫仍是本轮对真实产品代码生效的检查。真实 runtime producer 接入、历史文案清欠或 P9 拆分后的跨文件 producer 分析属于 P9-0b/P9 后续独立任务。

P9-0b 若接入真实 runtime，应由独立 adapter 负责从产品文件提取 root/sink candidate（例如 `textContent`、`title`、`value`、ARIA、alert/prompt、`t()` terminal 或 `data-i18n`），再把候选片段交给本 bounded evaluator。复杂语法不会污染整份真实文件，因为本任务不对完整 runtime 文件运行 evaluator；但单个 synthetic candidate 内任何未列节点都必须 fatal `I`。

## Parser 决策

本轮允许复用当前 lockfile 与 `npm ci` 已可提供的 Acorn `8.17.0` 作为 test-only parser。仓库既有 P8 回归测试已使用 Acorn；P9-0a 不新增依赖、不修改 `package.json` 或 `package-lock.json`，也不把 Acorn 宣称为本轮新引入依赖。

若未来需要把 parser 升级为 direct dependency、替换 parser、扩展跨文件 module graph 或改变安装契约，必须另立任务和范围。若当前锁文件环境缺失 Acorn，`test:i18n` 必须明确失败或 fail closed，不能退回正则 fallback。

## 决定

1. `测试/国际化测试.mjs` 引入 binding/provenance 分析基础，统一使用 `Resolution={binding,complete,ambiguous}`。
2. binding identity 是 top-level unique declaration AST 节点。name 只用于 bounded top-level unique lookup 与诊断：lookup 必须先得到唯一声明节点，后续消费与 provenance 判断均使用该节点身份；未获得唯一声明时不得按 name 消费。
3. consumer 只在 `complete===true && ambiguous===false` 时消费 producer 结果。任一相关 provenance incomplete，整体 producer 必须为 producer-incomplete；即使找到了目标文案，也不能 PASS。
4. 唯一声明但存在写入、cycle 或 unsupported 形态时，结果为 `complete=false, ambiguous=false`。多声明、多目标 merge 或无法排除多个 binding 时，结果为 `complete=false, ambiguous=true`。
5. P9-0a 只分析 top-level unique declaration identity；nested lexical scope、shadow 和局部 binding 不建模，出现即由中央 gate fail closed，不能回退到同名 top-level declaration。
6. parse 后先执行唯一中央 positive-syntax gate；collector、summary 和 eval 只消费 gate 已接受的 AST/binding。binding lookup 仅可用 name 在当前 synthetic candidate 的 bounded top-level table 中定位候选，且必须解析为唯一声明节点后才可消费；禁止按函数名 walk、name map 直接消费、program/top-level fallback、全 AST 同名搜索、正则 fallback，或在 collector/summary/eval 各自新增语法能力。
7. P9-0a 是 bounded recognizer，不是 JavaScript 解释器。支持范围仅限同一已解析文件内的正向白名单：
   - 唯一、非 async、非 generator 的 top-level `FunctionDeclaration`
   - 简单且名称互不重复的 `Identifier` 参数，或右侧为 literal 的 `AssignmentPattern`
   - 每个函数体必须非空且角色互斥：全部 statement 要么都是结构化 consumer assignment，要么都是 direct-call wrapper；mixed、empty 或其他 body 一律 incomplete
   - direct call，callee 必须是唯一 resolved top-level `FunctionDeclaration`
   - 最多一层直接参数 wrapper/monitor
   - call argument 只支持 literal 或 `Identifier`；nested `CallExpression` argument 一律 incomplete
   - expression 只支持 direct literal、direct `Identifier`，以及最多一层不可写 `const Identifier -> terminal literal`
   - default 只支持 literal default
   - top-level harmless `EmptyStatement`（额外分号）可与其他白名单 statement 共存
   - parameter monitor 只支持当前函数体内直接调用已解析 UI consumer；不支持 closure capture、callee alias、多层 wrapper 或 `return sink(v)` 形态
8. alias 仅支持最多一层不可写 `const Identifier` 指向 terminal literal。任何更长链、`=` / 复合赋值 / update / 解构写 / `for` / `for-in` / `for-of` / 闭包写 / cycle / control-flow merge / 不能唯一证明的 alias 都 incomplete。
9. default producer 只读取 resolved unique Function node 的 literal `params[index]` default；external const default、default 参数依赖另一参数、self/later parameter、参数 alias、call default 或 body 声明环境均 fail closed。monitor 只追踪 resolved parameter binding identity 的直接 consumer 调用。
10. async/generator `FunctionDeclaration`、重复参数名、mixed/empty/未知函数体角色、nested call argument、`FunctionExpression`、callable Arrow、return literal/Identifier/call/alias producer、regular/module export、try/catch/finally、nested function、let/var、catch/object/array/destructure/rest binder、object/array/template/class 容器、import/require、dynamic `import()`、top-level `await`、`export *` / `export * as`、`import.meta`、member/computed/optional（唯一例外是结构化 consumer sink 的 `<identifier>.textContent = <resolved parameter identifier>`）、call/apply/bind、callback/高阶、跨文件、反射/eval/`Function`、parse error 等均 fail closed。
11. 分析器和测试不得有产品函数名、fixture 名、注释或字符串特判。

## Threat Model

分析器主要防止测试误绿，而不是证明任意 JavaScript 运行时语义。攻击或事故模型包括：

- 同名函数、参数或变量在不同词法 scope 中 shadow，导致 name map 把错误 producer 当成目标。
- alias 链中存在写入、循环、条件分支或控制流 merge，导致 producer 来源不再唯一。
- wrapper、默认参数、return 或参数转发只在某一层完整，外层 provenance incomplete，却被内层命中文案误判为 PASS。P9-0a 不实现完整参数执行环境：多层 wrapper、callee alias、external const default、复杂 default 参数依赖、所有 return producer 和 closure 参数读取一律 fail closed。
- 注释、普通字符串、fixture 命名或产品函数名被测试当成结构证据。
- unsupported 动态能力如 import、require、member call、optional call、`eval` 或 `new Function` 被静态测试猜测为可分析。

对应防线是：只消费唯一完整 binding；任何不支持语法或不完整 provenance 都产生 `I` 或 `A` oracle，而不是静默 0 或 PASS。

## Oracle

自动矩阵使用四个统一 oracle：

| Oracle | complete | ambiguous | 发现 |
| --- | --- | --- | --- |
| H | true | false | 精确一个发现 |
| 0 | true | false | 无发现 |
| I | false | false | provenance incomplete |
| A | false | true | ambiguous |

## 精确 Fixture 矩阵

所有 fixture 使用合成目标字符串 `TARGET_TEXT`。`payload=target:1` 表示 finding payload 精确包含一个目标字符串发现；`payload=none:0` 表示完整分析且无发现；`payload=none:*` 表示 incomplete 或 ambiguous 不得消费 finding。重复顶层 `FunctionDeclaration` / function+var 在 module sourceType 下是 parser SyntaxError，因此 ambiguous oracle 必须使用 script sourceType 或其他合法可解析结构；parse-error 单独作为 `I` 覆盖，不能把 SyntaxError 偷换成 `A`。

| ID | sourceType | 最小语法/目标 binding | producer 类型 | 期望 | finding payload/count |
| --- | --- | --- | --- | --- | --- |
| B-01 | script | 后置 `FunctionDeclaration make` | unsupported return producer | I | none:* |
| B-02 | module | `export function make` + exported consumer | unsupported export/return | I | none:* |
| B-03 | script | nested shadow `make` 与 top-level `make` | unsupported nested function | I | none:* |
| B-04 | script | 同名参数 `make` + return producer | unsupported return producer | I | none:* |
| B-05 | script | 重复 top-level return function | unsupported return producer | I | none:* |
| B-06 | script | 重复 top-level return function 换序 | unsupported return producer | I | none:* |
| B-07 | script | `function make` + `var make` | unsupported var/return | I | none:* |
| B-08 | script | 未声明 `make` | unresolved binding | I | none:* |
| AL-01 | script | `const text = TARGET_TEXT` | const literal alias | H | target:1 |
| AL-02 | script | 3 级 `const a -> b -> c` | alias chain beyond whitelist | I | none:* |
| AL-03 | script | block 内层 alias shadow 外层 | unsupported block | I | none:* |
| AL-04 | script | `let a = TARGET_TEXT` | mutable alias | I | none:* |
| AL-05 | script | `var a = TARGET_TEXT` | mutable alias | I | none:* |
| AL-06 | script | `const a` 后同值写回 | illegal write | I | none:* |
| AL-07 | script | target binding 本身被写入 | illegal write | I | none:* |
| AL-08 | script | `+=` / compound assignment | illegal write | I | none:* |
| AL-09 | script | `++` update | illegal write | I | none:* |
| AL-10 | script | destructuring assignment 写入 | unsupported write | I | none:* |
| AL-11 | script | `for-of` 写入 | unsupported write | I | none:* |
| AL-12 | script | 闭包写入 captured binding | closure write | I | none:* |
| AL-13 | script | self cycle `const a = a` | alias cycle | I | none:* |
| AL-14 | script | mutual cycle `a -> b -> a` | alias cycle | I | none:* |
| AL-15 | script | conditional merge | control-flow merge | I | none:* |
| AL-16 | script | logical merge | control-flow merge | I | none:* |
| AL-17 | script | sequence merge | control-flow merge | I | none:* |
| AL-18 | script | TDZ use before `const` declaration | unresolved at position | I | none:* |
| AL-19 | script | member alias `box.value` | unsupported member | I | none:* |
| AL-20 | script | `bind` alias | unsupported bind | I | none:* |
| AL-21 | script | destructured alias declaration | unsupported destructure | I | none:* |
| D-01 | script | `FunctionDeclaration` default param | default literal | H | target:1 |
| D-02 | script | `const FunctionExpression` default param | unsupported callable | I | none:* |
| D-03 | script | Arrow default param | unsupported callable | I | none:* |
| D-04 | script | alias-chain resolves function default | unsupported callee alias | I | none:* |
| D-05 | script | resolved function 内出现 nested function | unsupported nested function | I | none:* |
| D-06 | script | nested block shadow of default param | unsupported block | I | none:* |
| D-07 | script | duplicate top-level default function | duplicate declaration | A | none:* |
| D-08 | script | 缺省不存在 | missing default | 0 | none:0 |
| D-09 | script | 显式参数覆盖 default | call argument | 0 | none:0 |
| D-10 | script | 第二参数 default 精确 | default literal | H | target:1 |
| D-11 | script | destructured default param | unsupported param | I | none:* |
| D-12 | script | rest param | unsupported param | I | none:* |
| D-13 | script | dynamic default expression | unsupported producer | I | none:* |
| D-14 | script | 参数被写入 | illegal param write | I | none:* |
| F-01 | script | 直接 wrapper 参数转发 | call argument | H | target:1 |
| F-02 | script | 2 层 wrapper 参数转发 | unsupported multi-wrapper | I | none:* |
| F-03 | script | wrapper 通过 `const` alias 调 consumer | unsupported callee alias | I | none:* |
| F-04 | script | closure 读取参数并消费 | unsupported closure capture | I | none:* |
| F-05 | script | duplicate wrapper function | duplicate declaration | A | none:* |
| F-06 | script | nested parameter shadow | unsupported nested function | I | none:* |
| F-07 | script | block shadow | unsupported block | I | none:* |
| F-08 | script | catch param shadow | unsupported try/catch | I | none:* |
| F-09 | script | nested arrow parameter shadow | unsupported nested function | I | none:* |
| F-10 | script | 参数写入 | illegal param write | I | none:* |
| F-11 | script | spread argument | unsupported spread | I | none:* |
| F-12 | script | callback consumer | unsupported higher-order | I | none:* |
| F-13 | script | return callback / 高阶 | unsupported higher-order | I | none:* |
| F-14 | script | 转发 cycle | call cycle | I | none:* |
| R-01 | script | declaration return literal | unsupported return producer | I | none:* |
| R-02 | script | arrow expression return literal | unsupported callable/return | I | none:* |
| R-03 | script | alias callee return literal | unsupported callee alias/return | I | none:* |
| R-04 | script | nested/internal same name | unsupported nested function | I | none:* |
| R-05 | script | duplicate top-level return function | unsupported return producer | I | none:* |
| R-06 | script | multiple return | control-flow return | I | none:* |
| R-07 | script | conditional return expression | control-flow merge | I | none:* |
| R-08 | script | logical return expression | control-flow merge | I | none:* |
| R-09 | script | return cycle | call cycle | I | none:* |
| R-10 | script | 跨函数 return 未支持 | unsupported return producer | I | none:* |
| U-01 | module | `import` present | unsupported import | I | none:* |
| U-02 | script | `require()` present | unsupported require | I | none:* |
| U-03 | script | member call | unsupported member | I | none:* |
| U-04 | script | computed member call | unsupported computed | I | none:* |
| U-05 | script | `globalThis` member | unsupported global | I | none:* |
| U-06 | script | call/apply/bind | unsupported call adapter | I | none:* |
| U-07 | script | optional call | unsupported optional | I | none:* |
| U-08 | script | sequence callee | unsupported sequence | I | none:* |
| U-09 | script | `eval` string | unsupported reflection | I | none:* |
| U-10 | script | `new Function` | unsupported reflection | I | none:* |
| U-11 | script | object container | unsupported container | I | none:* |
| U-12 | script | array container | unsupported container | I | none:* |
| U-13 | script | complex destructuring | unsupported destructure | I | none:* |
| U-14 | script | parser SyntaxError | parse error | I | none:* |
| M-01 | script | alpha-renamed consumer | direct literal | H | target:1 |
| M-02 | script | 注释含目标名/参数名/analyzer 名 | comment ignored | H | target:1 |
| M-03 | script | 普通字符串含 analyzer 名 | inert string ignored | H | target:1 |
| M-04 | script | duplicate return declaration 换序 | unsupported return producer | I | none:* |
| M-05 | script | 空白/顶层额外分号变化 | direct literal / harmless `EmptyStatement` | H | target:1 |
| M-06 | script | 函数位置变化/hoist | direct consumer function | H | target:1 |
| M-07 | script | 同拼写不同 scope 写入 | unsupported nested function/write | I | none:* |

### P1 精确 Snippet

以下四组是阶段 A 冻结的逐字规范片段。阶段 B 的实现 fixture source 必须逐字匹配这些代码片段；命名、空白和字符串内容不作为 analyzer 语义来源，但测试输入本身要与本节一致，便于 reviewer 复现。

| ID | sourceType | snippet | 精确 target binding | producer | 期望 | finding payload/count |
| --- | --- | --- | --- | --- | --- | --- |
| AL-P1-01 | script | `const out = null; function sink(v){ out.textContent = v; } const top = '待迁移文案'; const mid = top; const leaf = mid; mid = top; sink(leaf);` | `leaf` 的 `VariableDeclarator` binding，经 `mid` 指向 `top`，最终进入 `sink` 参数 `v` 的 `out.textContent` 写入 | 3 级 const alias 与写入均超出白名单 | I | none:* |
| AL-P1-02 | script | `const out = null; function sink(v){ out.textContent = v; } const top = '待迁移文案'; const mid = top; const leaf = mid; top = 'safe'; sink(leaf);` | `leaf` 的 `VariableDeclarator` binding，经 `mid` 指向 `top`，最终进入 `sink` 参数 `v` 的 `out.textContent` 写入 | 3 级 const alias 与写入均超出白名单 | I | none:* |
| D-P1-01 | script | `const out = null; function sink(v){ out.textContent = v; } const outerA = function same(v = '待迁移文案'){ sink(v); }; const outerB = function same(v = 'safe'){ sink(v); }; outerA();` | 外部 `outerA` 的 `VariableDeclarator` binding；内部函数名 `same` 只属于函数内部 scope | `FunctionExpression` callable 超出白名单 | I | none:* |
| D-P1-02 | script | `const out = null; function sink(v){ out.textContent = v; } const outerA = function same(v = '待迁移文案'){ sink(v); }; const outerB = function same(v = 'safe'){ sink(v); }; outerB();` | 外部 `outerB` 的 `VariableDeclarator` binding；内部函数名 `same` 只属于函数内部 scope | `FunctionExpression` callable 超出白名单 | I | none:* |
| F-P1-01 | script | `const out = null; function sink(v){ out.textContent = v; } function ui(value){ sink(value); } function nonUi(value){ return value; } nonUi('待迁移文案'); ui('safe');` | `ui` 函数参数可监控，但同一 candidate 中 `nonUi` return producer 超出白名单 | return producer fatal | I | none:* |
| F-P1-02 | script | `const out = null; function sink(v){ out.textContent = v; } function ui(value){ sink(value); } function nonUi(value){ return value; } nonUi('safe'); ui('待迁移文案');` | `ui` 函数参数可监控，但同一 candidate 中 `nonUi` return producer 超出白名单 | return producer fatal | I | none:* |
| AL-P1-03 | script | `const out = null; function sink(v){ out.textContent = v; } const flag = true; const target = '待迁移文案'; const alias = flag ? target : target; sink(alias);` | `alias` 的 `VariableDeclarator` binding，最终进入 `sink` 参数 `v` 的 `out.textContent` 写入 | conditional alias merge 超出白名单 | I | none:* |
| AL-P1-04 | script | `const out = null; function sink(v){ out.textContent = v; } const flag = true; const target = '待迁移文案'; const safe = 'safe'; const alias = flag ? target : safe; sink(alias);` | `alias` 的 `VariableDeclarator` binding，最终进入 `sink` 参数 `v` 的 `out.textContent` 写入 | conditional alias merge 超出白名单 | I | none:* |

### Bounded Recognizer 复探针矩阵

以下复探针按 00 架构裁决收敛为有限白名单。它们用于防止 analyzer 在 collector、summary 或 eval 的某一层偷偷放宽。

| ID | sourceType | 最小语法/目标 binding | producer 类型 | 期望 | finding payload/count |
| --- | --- | --- | --- | --- | --- |
| BR-01 | script | `catch({phrase})` shadow 外层 target | unsupported catch binder | I | none:* |
| BR-02 | script | object pattern `{phrase: local}` 与外层 `phrase` | unsupported object binder | I | none:* |
| BR-03 | script | `for-of` 后再调用 `sink(target)` | unsupported loop statement | I | none:* |
| BR-04 | script | `for-in` 后再调用 `sink(target)` | unsupported loop statement | I | none:* |
| BR-05 | script | default `v=text`，body 内同名 `text` | unsupported external const default | I | none:* |
| BR-06 | script | default `b=a` 依赖 earlier parameter | unsupported default parameter dependency | I | none:* |
| BR-07 | script | default self / later parameter | unsupported default parameter dependency | I | none:* |
| BR-08 | script | `const a=v; return a` 后 sink call | unsupported return alias to parameter | I | none:* |
| BR-09 | script | `return sink(v)` / block arrow return consumer call | unsupported return consumer call | I | none:* |
| BR-10 | script | `v => sink(v)` concise arrow consumer call | unsupported concise consumer call | I | none:* |
| BR-11 | script | object/template/class 容器内含 `import()` / `await` | fatal unsupported descendant | I | none:* |
| BR-12 | module | `export *`, `export * as`, `import.meta` | unsupported module meta/export | I | none:* |
| BR-13 | script | async/generator consumer 或 wrapper `FunctionDeclaration` | unsupported callable flags | I | none:* |
| BR-14 | script | 两个同名参数，交换 target 实参顺序 | duplicate parameter binding | I | none:* |
| BR-15 | script | consumer assignment 与 unknown/empty direct call 混合且换序 | mixed function body role | I | none:* |
| BR-16 | script | empty function 单独调用或位于 supported sink 前后 | empty function body role | I | none:* |
| BR-17 | script | `sink(make(TARGET_TEXT))` | nested call argument | I | none:* |
| BR-18 | script | direct const literal / 恰一 alias edge / 两层 alias edge | bounded const provenance | H / H / I | target:1 / target:1 / none:* |

R3 reviewer 可在该矩阵之外运行同类变异；测试实现不能只为列举 fixture 通过。

## 替代方案

- 继续使用正则或名字搜索：实现小，但无法区分 shadow、alias 写入和 incomplete provenance，容易误绿。
- 新增 Babel/Acorn/ESLint direct dependency：能力更强，但本阶段禁止修改依赖契约，也会扩大供应链和维护面；P9-0a 仅复用现有 lockfile 下可用的 test-only Acorn。
- 直接做产品文案清欠：会混入 P9-0b 运行时变更，不利于先建立测试基础。

## 后果

- `npm run test:i18n` 会更保守：遇到 unsupported 结构时失败或报告 incomplete，而不是猜测通过。
- 新增测试 fixture 必须描述 oracle 和 provenance，不得依赖产品函数名白名单。
- 该分析器是测试基础设施，不改变 runtime、language pack 或用户项目数据。
- 若未来需要跨文件、module graph、高阶函数或对象容器分析，应单独立项并扩展 ADR，而不是在本分析器中静默放宽 fail-closed 边界。

## 验证方式

- `npm run test:i18n`
- `npm run test:foundation`
- `node 测试/回归/run_all.mjs`
- `npm run test:impact -- --base 1fae3e6ff4205e5ec052ed8ec56b2ba9fa947cd5`
- `npm run test:full`
- `git diff --check`

## 撤销条件

若后续采用成熟 parser 或完整静态分析框架，新实现可以替代本地 parser，但必须保留 binding identity、只消费唯一完整 provenance 和 unsupported fail-closed 三条原则。

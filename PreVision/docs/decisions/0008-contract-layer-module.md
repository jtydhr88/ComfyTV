# ADR-0008:契约层收编进 core/project-data.js(重构 P2)

- 状态:accepted
- 日期:2026-07-17
- 范围:重构 P2 —— .previz.json v5 契约层(归一化全家、工厂/模板、ensure*/repair* 轨道修复、契约常量)从 `src/app.js` 纯搬运至 `src/core/project-data.js`;timing-math 在 P1 登记的自由引用收编为真 import。承接 ADR-0006/0007,不改变任何交付契约。

## 背景

P1 已确立桥打包机制(ADR-0007):`src/app.js` 用标准 ES import 声明模块依赖,构建时剥离 import、esbuild 把模块打成 IIFE 前置块并按原名暴露 globalThis。`core/timing-math.js` 头部登记了 6 个"待 P2 收编"的自由引用(`distributedPathTimes`/`ensureCamKeys`/`ensureCamAimTimes`/`ensureCamFovTimes`/`ensureEaseArray`/`cameraKeyProgress`),U2/U5 中依赖它们的断言只能经交付产物 VM 回放。拆分方案 P2 要求把契约层(不可信输入的唯一边界)收进 `core/project-data.js`,验收生死线是 C1/C2/C4 字节级 golden 不变。

## 决定

1. **纯搬运 46 个导出**(函数体逐字节不动,施工脚本抽取比对),与拆分方案 project-data 清单逐一对应:
   - 工厂/模板:`newProject / makeFirstRunWelcomeProject / SCENE_TEMPLATES / materializeSceneTemplate`,外加 **`DEFAULT_ACTORS`**(清单未列名,但 `SCENE_TEMPLATES` 在模块顶层求值即引用它,桥块先于 app.js 残文执行,不随迁必然 ReferenceError——属"依赖强制随迁");
   - 轨道修复:`shotCurve / ensureCamKeys / ensureCamTimes / ensureCamAimTimes / ensureCamFovTimes / ensureActorTimes / repairPathTimes / ensureEaseArray`,外加内部助手 **`repairIndexTimes`**(ensureCamAimTimes/ensureCamFovTimes 的实现体,属"ensure*/repair* 系");
   - timing-math 自由引用收编:**`distributedPathTimes` / `cameraKeyProgress`**(P1 模块头登记的 P2 目标);
   - 归一化全家:`normalizeProjectData / normalizeProjectScene / normalizeProjectActor / normalizeProjectShot / normalizeProjectAssets / normalizeProjectGround / normalizeProjectSun / normalizeProjectBackground / normalizeProjectJoints / normalizeProjectDimensions / normalizeProjectEase / normalizeProjectArray / validateProjectSceneReferences / invalidProject / projectOwn / projectString / projectFinite / projectTuple / projectDistributedTimes / repairProjectPathTimes / repairProjectIndexTimes / repairProjectEases / isPlainRecord`;
   - 常量:`PROJECT_VERSION` + 枚举 `PROJECT_EASE_TYPES / PROJECT_LOCK_GLOBAL / PROJECT_LOCK_MANUAL / PROJECT_LOCK_SENTINELS / PROJECT_POSES / PROJECT_JOINT_KEYS`。
   - **明确不迁**:`AUTOSAVE_KEY`、`isRestorableProject`、`cloneProjectAssets`(持久化家族,P9 目标——`cloneProjectAssets` 虽落在原 2476–2692 行区间内,但既不匹配 normalizeProject*/project* 白名单命名,调用者又全是撤销/快照/保存路径);`liveSceneDuration`、`deepCopy`、`sceneTemplateById`、`sceneTemplateText`(读运行时状态或被 app.js 广泛使用,分属后续阶段);字段描述表 ACTOR_FIELDS/SHOT_FIELDS 按方案属 **P7**,本阶段不做。
2. **timing-math ↔ project-data 形成有意的 core 内环**:timing-math 的两个 sampleCameraKey 变体真 import 本模块的 ensure*/cameraKeyProgress 家族,而 project-data 的 `ensureEaseArray` 反向 import timing-math 的 `normalizeEaseSpec`。这是方案给定模块边界的内生结果(两个函数家族互为实现依赖);所有交叉引用都是**调用期函数调用**(无模块顶层交叉求值),在 ESM 与 esbuild 求值序下均安全。实测 esbuild 平铺两模块为顺序声明,未引入懒初始化包装,census/C8 扫描不受影响。方案"循环依赖告警"条款针对 stage/ui 层回边(应改走 RefreshHub),core 内此环记录在两模块头注释中,P7 字段表落地时可顺势评估是否消解。
3. **桥 esbuild `charset` 由 `utf8` 改为 `ascii`**(修订 ADR-0007 的参数选择):契约层携带汉字**数据串**(锁定哨兵 `'全局'`/`'手动朝向'`、默认对象标签),它们是写进 `.previz` 文件与 localStorage 的数据值,**不能**改造成语言键;`charset:'utf8'` 会把源码里已 `\uXXXX` 转义的字面量还原成裸汉字输出,撞上 i18n 政策对产物新增行的直接汉字扫描(施工中被 21 项 i18n 测试抓红,随即改正)。`ascii` 输出对字符串值零影响,后续阶段(P5 分镜词典等大量中文数据)一并受益。
4. **随迁内容的两处既定处理**(均有 ADR-0007 先例):模块源码中 `DEFAULT_ACTORS` 标签的裸汉字转 `\uXXXX` 转义(字符串值不变,已用运行时断言验证);`cameraKeyProgress` 前的中文注释译为英文。`src/core/project-data.js` 头注释登记过渡期自由引用:`THREE`(vendor 契约全局)、`PreVisionI18n`(i18n 运行时)、`deepCopy / sceneTemplateById / sceneTemplateText / liveSceneDuration`(app.js,P3 目标)、`SEED_RES`(P8)、`DEFAULT_SUN / SKY_BASE_R`(P6)——全部仅在调用期经全局解析。
5. **U2/U5 过渡断言兑现直接 import**(回归测试清单 §2 预告):sampleCameraKey/sampleTimedCameraKey 的 golden 回放与 timedPathState 兜底分支不再经交付产物 VM,改为直接调用 import 的模块;断言内容与数量不变(41/44),U2 另保留一条产物断言钉住桥继续按原名暴露全局。

## 替代方案

- **timing-math 继续经全局解析这 6 个引用(不真 import)**:否。P1 模块头与拆分方案均预告 P2 收编;不收编则 U2/U5 永远依赖整机 VM,模块在 node 里不自洽,"AI 只读一个小模块"的目标落空。
- **为消环把 `ensureEaseArray` 留在 app.js 或把 `normalizeEaseSpec` 迁入 project-data**:否。前者违背方案清单(ensureEaseArray 明列 project-data),后者拆散 P1 已 golden 钉死的 timing-math 清单;两者都为"图上好看"而牺牲方案对齐度。
- **DEFAULT_ACTORS 汉字标签改语言键**:否。是数据值不是 UI 文案,改键=改 .previz 内容=契约变更,违背 P2"字节级不变"的生死线。
- **桥输出后处理正则重转义汉字(保住 charset:utf8)**:否。对 bundle 全文做盲替换,比声明式 `charset:'ascii'` 多一层自造机制与出错面。

## 后果

- `src/` 出现第二个真实模块;app.js 剩 ~5,600 行;契约层从此有唯一定义点,P7 字段表改造有了落脚文件。
- 46 个名字经桥 `Object.assign(globalThis,…)` 暴露(P1 是 16 个,现共 62)。9 个搬运的 `const`(DEFAULT_ACTORS/SCENE_TEMPLATES/PROJECT_* 枚举)从"脚本全局词法绑定"变为 globalThis 属性——对标识符读取语义等价,全应用无对其赋值处。
- 桥 bundle 含 `\uXXXX` 转义(ascii 输出);产物中的字符串值不变,C1–C4 golden 与冒烟逐字符断言实测零影响。
- timing-math 模块头的"待 P2 收编"登记清零,仅剩 `THREE` 一个契约全局;U1/U2/U3/U5 全部纯 node 直测(bootApp 仅剩 U2 一条桥暴露断言在用)。

## 验证方式(P2 落地当日实测)

- `node 测试/回归/run_all.mjs`:C1/C2/C3/C4/C6/U4/U1/U2/U3/U5/C8 全绿(**C1/C2/C4 字节级 golden 不变**——归一化搬运后行为逐字节一致的直接证据);
- `npm run test:app`:冒烟 968 通过 0 失败(与 P0/P1 基线同数);`npm run test:module -- project`:112 通过;
- `node scripts/census-functions.mjs --ref 04eba4b`:484=484,差异 = 0;
- 移动函数体与 HEAD 原文逐字节比对一致(施工脚本抽取比对;DEFAULT_ACTORS 转义与注释译英为仅有的两处记录内偏差,字符串值经运行时断言相等);
- `npm run test:foundation` 全绿(仓库基础、C8 11、协调 553、i18n 21、探针启动 11);`npm run test:project-input` 真机 Electron 探针全绿;
- U2 41 / U5 44 断言数与改造前一致。

## 撤销条件

`git revert` 本阶段提交串即可回到 P1 形态。仅回退收编:删除 timing-math 的 project-data import(恢复头部自由引用登记)、把 project-data.js 各函数原文放回 app.js 原位、删除 app.js 的 46 名 import 块、build 脚本 charset 还原 utf8、U2/U5 恢复 VM 回放,qa/golden/ 全程无需变动。

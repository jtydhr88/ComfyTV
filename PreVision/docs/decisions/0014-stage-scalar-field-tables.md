# ADR-0014:标量字段表等价改写(重构 P7b)

- 状态:accepted
- 日期:2026-07-19
- 范围:重构 P7b —— 在 `src/core/project-data.js` 定义 actor/shot 标量字段描述表,并让归一化、舞台运行时构建、序列化和镜头运行时重建消费同一字段清单;承接 ADR-0013,不改变 project v5 数据格式、键序、数值精度、golden、依赖方向或产品行为。

## 背景

P7a 已把舞台运行时搬到 `src/stage/runtime.js`,但数据字段仍有四处手写清单: `normalizeProjectActor/Shot`、`buildActor`、`stageToData`、`loadScene` 的 shot 重建。未来新增 actor/shot 字段时,漏改任何一处都会造成静默丢字段或运行时/存档不一致。

本阶段只处理"归一化后必有的标量字段",并把 P7 的最高风险拆小:先让稳定标量字段共享清单,不触碰路径、关键帧、挂载、rig、asset、Three 对象或引用校验。

## 决定

1. **新增纯数据字段表**:`src/core/project-data.js` export `ACTOR_FIELDS` 与 `SHOT_FIELDS`。字段表不含函数、stage 闭包、THREE 引用、DOM 引用、供应商 API 或运行时对象。
   - `ACTOR_FIELDS`: `kind,label,pose,rotY,height,scale,pathMode,timeLink,timeOffset`
   - `SHOT_FIELDS`: `name,desc,dur,lock,fov,camMode,timingMode,syncActor,yaw,pitch`
2. **phase-specific semantics/order**:字段表只是共享"有哪些标量字段"和基础校验元数据,不统一各 phase 的对象输出顺序。
   - normalize phase 先遍历字段表得到标量值,再用旧对象字面量顺序构造输出,保留现有 `Object.keys` 顺序。
   - buildActor phase 从字段表白名单读取运行时标量,但继续在 runtime 层执行 stage clamp、kind 兜底、height legacy `y` 兼容和 Three 对象构建。
   - stageToData phase 通过字段表白名单读取标量,但继续按旧 JSON 顺序显式写对象,保留 `rotY/height/scale/timeOffset` 精度和 `dur/fov/yaw/pitch` 非舍入语义。
   - loadScene shot phase 通过字段表白名单重建运行时 shot 标量,但 `camPts/camKeys` 和三套 times/ease 继续手写。
3. **合法依赖方向**:`src/stage/runtime.js` 真 import `ACTOR_FIELDS`/`SHOT_FIELDS`。不新增 core -> stage,不新增 factory/environment -> runtime,不新增 globalThis bridge/exposure。
4. **手写例外保持显式**:
   - actor: `pos/path/pathTimes/pathEase`、`mount`、`joints/rig`、`semanticType/dimensions`、`asset`、`terrainVersion`、`timeLinkShot`、运行时 `pathPts`、Three 对象和挂载骑乘。
   - shot: `cam/camAim`、`camTimes/camEase/camAimTimes/camAimEase/camFovTimes/camFovEase`、`camPts/camKeys`。
   - scene 引用校验、legacy `syncActor` 推断、资产降级、地面/太阳/背景归一化均不进本字段表。
5. **C1 字段表护栏**:C1 直接 import 真实字段表,断言 key 非空唯一、首批字段精确匹配、字段表与手写白名单互斥、golden actor/shot key 集合被字段表或显式手写白名单覆盖。测试不使用源码字符串锚点。

## 等价语义

- normalize 仍只做类型、结构和枚举校验;有限越界 `pos/height/scale` 不在 normalize 层钳制。
- `height` 继续兼容 legacy `y`。
- 未知 `kind` 继续保留到 project v5,由 runtime 兜底为通用 proxy。
- 不枚举或 spread 不可信输入;未知键、`__proto__` 和 `constructor` 不穿透输出对象。
- `normalizeProjectShot` 的 `dur` repair 上界继续使用归一化后的 `scalars.dur`。
- C1/C2 golden 不变是生死线;任何字节差异都必须回退或重新审查,不能改 golden 过关。

## 替代方案

- **用单一字段表直接生成 normalize/stageToData 对象顺序**:否。表顺序与既有 JSON 键序不完全相同,会制造无产品价值的 golden diff。
- **把复杂字段也纳入字段表**:否。路径、关键帧、挂载、rig、asset 和 Three 对象都有 phase-specific 行为,现在通用化会扩大风险。
- **在 core 字段表中放 toRuntime/toData 函数**:否。会把 stage 语义和运行时闭包带入 core,破坏 ADR-0013 的依赖边界。
- **通过源码字符串断言字段表消费**:否。C1 直接 import 真实字段表并检查 golden key coverage。

## 后果

- 新增 actor/shot 标量字段时有单一清单入口,并由 C1 覆盖断言提醒是否登记。
- `src/core/project-data.js` 仍是 project v5 契约层,但字段表保持供应商中立;`src/stage/runtime.js` 是唯一消费字段表的 stage 模块。
- 函数 census 因真实 helper 增加出现合理差异:484 -> 491,新增 `actorDataScalars`、`normalizeProjectScalarField`、`normalizeProjectScalars`、`projectScalarSource`、`scalarMap`、`shotDataScalars`、`shotRuntimeScalars`。这些 helper 是字段表分 phase 消费、保持 normalize 首错顺序和 runtime/data adapter 分离所需的自然具名函数;不得通过箭头函数、对象方法、死代码、伪锚点或注释锚点规避 census。

## 验证方式(P7b 落地要求)

- `npm run build`;重复 build SHA-256 一致。
- `node 测试/回归/C1_previz_roundtrip.mjs`、`node 测试/回归/C2_legacy_migration.mjs`、`node 测试/回归/U4_normalize_malformed.mjs`、`node 测试/回归/run_all.mjs`。
- `npm run test:module -- actor|camera|project|timeline|playback`、`npm run test:app`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:impact -- --base 0178240bb6f4d2fb51c210311e3d279df7f11f0b`、`npm run test:full`。
- `node scripts/census-functions.mjs --ref 0178240bb6f4d2fb51c210311e3d279df7f11f0b`;优先保持 484 -> 484,若真实 helper 造成合理差异,在验收证据中解释。
- 构建产物 `refresh.register(` 总数仍为 22;`qa/golden/**`、`package-lock.json`、`qa/test-impact-map.yaml`、build/census 脚本无变化。

## 撤销条件

`git revert` 本阶段提交即可回到 P7a 形态。若手工回退:删除 `ACTOR_FIELDS`/`SHOT_FIELDS` 与 normalize/runtime helper,恢复 `normalizeProjectActor/Shot`、`buildActor`、`stageToData`、`loadScene` 的 P7a 手写标量逻辑,移除 C1 字段表断言和本 ADR 索引,再运行 `npm run build` 生成根 HTML。`qa/golden/**` 不需要修改。

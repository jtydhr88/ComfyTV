# 任务：02.5｜快速预览模型包：沉船、海马骑乘与可调巫师

- 状态：completed
- 日期：2026-07-25
- 对话：独立侧栏 Worktree 任务（canonical thread/client 已核对并去敏）
- 分支：`feat/02.5-fast-preview-model-pack`
- 基线：`b8da5f4f36a40010541700171cb246f2ca9de17b`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`；`app:status` 为 contains=yes、exact=yes
- 负责人：`worker:02.5-fast-preview-model-pack`

## 并行任务声明

- 任务 ID：`02.5-fast-preview-model-pack`
- 模式：write
- 分管 owner：02
- 模块：`actor,playback,project,history,camera,capture,layout,testing,i18n`
- UI 表面：`app-shell,viewport,inspector`
- 数据区域：`actor-rig,object-paths,project-v5,autosave,shot-camera,qa-metadata,i18n-resources`
- 预计修改文件：
  - `app-shell.html`
  - `src/stage/factory.js`
  - `src/stage/runtime.js`
  - `src/playback/engine.js`
  - `src/ui/inspector.js`
  - `src/export/prompt.js`
  - `src/core/project-data.js`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `预见PreVision.html`
  - `测试/冒烟测试.mjs`
  - `测试/回归/C1_previz_roundtrip.mjs`
  - `测试/回归/U4_normalize_malformed.mjs`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `qa/feature-registry.yaml`
  - `docs/plans/active/2026-07-25-fast-preview-model-pack.md`
  - `docs/plans/completed/2026-07-25-fast-preview-model-pack.md`
  - `docs/plans/completed/README.md`
  - `docs/qa/fast-preview-model-pack/README.md`
  - `docs/qa/fast-preview-model-pack/1440x900-ship-four-views.png`
  - `docs/qa/fast-preview-model-pack/1440x900-seahorse-rider-four-views.png`
  - `docs/qa/fast-preview-model-pack/1440x900-wizard-joints-four-views.png`
  - `docs/qa/fast-preview-model-pack/1440x900-model-pack-playback.png`
- reservation：已预留（凭据仅用于 claim，未写入仓库）
- reserve request key：已核对/已去敏
- 协调登记：schema v3；受控 `task:status` 与 claim 均成功，persistence=confirmed
- 权威生命周期：本轮由 REVIEW 退回 ACTIVE；最小返工提交后重新 stop verification → REVIEW（以 registry 当前值为准）
- 当前 actor / 下一责任人：`worker:02.5-fast-preview-model-pack` / 返工完成后 `reviewer:02.5-fast-preview-model-pack-r2-recheck`
- 状态更新时间 / 原因：2026-07-25；最近一轮全新独立 R2 因 expected 与生产 tangent 共因判定 FAIL（P2=1），旧 review/stop 证据已清除，claim 保留并继续同一后台 turn
- 侧栏去重证据：task id 已核对；client id / thread id 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得从后台 turn 推断 Desktop live
- WAITING checkpoint：已完成只读 checkpoint 并等待同一任务正式开工
- turn stop verification：本轮提交后重新执行；不得复用已失效的旧证据
- 失败补偿：无
- `task:check` 结果：未运行；reservation 已由固定 02 原子创建
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：不适用；由独立 reviewer PASS 后按治理流程处理
- `task:release`：未释放
- `task:archive`：未开始

## 用户问题

为 PreVision 增加一组不依赖外部二进制资产的快速预览模型：大型程序化沉船、带专用骑乘约束的程序化海马，以及复用现有全身 rig 的 fallback 巫师 foundation。三者须进入模型库，保持 project v5、撤销、自动保存、路径播放、摄影机和提示词兼容，并提供可重复的自动与人工证据；程序化巫师不再作为最终高精度人物方案。

## 目标

- 新增稳定 `kind:'shipwreck'` 的轻量程序化大型破损木质帆船，默认约 24m，内部视觉倾斜但根变换稳定。
- 新增独立 `kind:'seahorse'` 的直立程序化海马、专用骑乘 anchor/joint preset 和窄尺度支持范围。
- 在现有 `kind:'char'` 上新增可选 `characterStyle:'wizard'`，作为 fallback/性能基线保留完整人物关节 rig，并让帽子随头/颈、魔杖随右腕/手。
- 三类对象在直线/曲线路径、摄影机锁定、提示词、保存重开、撤销和 autosave 中保持确定性。
- 模型库在窄栏中可用；新增用户文案全部使用同步的中英文 language key。
- 生成 1440×900 隔离 Electron 人工证据与基础性能记录，不更新固定 App。

## 非目标

- 不引入 GLTFLoader、通用 GLB 导入或任何 GLB/PNG/二进制运行时资产。
- 不把巫师加入新的 `wizard` kind，也不改动 11 类 semantic proxy catalog。
- 不实现沉船凹形船舱穿行、破碎动画、水体、雾、鱼群或照片级贴图。
- 不实现海马任意 `0.3–3` 尺度、极端手调姿态或多人同鞍自动零穿模。
- 不实现巫师布料模拟、服装滑块或高面数外观；不把程序化脸/长袍包装为“尽量保持原文件精度”的最终人物。
- 不引入高精度人物资产、骨骼绑定 POC、原 GLB 或任何新资产文件；原人物高精度直绑骨由独立后续任务承担。
- 不改变 PROJECT_VERSION 5，不回归白马、车辆或普通挂载语义。
- 不调用真实付费 AI 服务，不更新固定 App、稳定预览、GitHub、Pages 或公开发布物。

## 证据与现状

- 代码：程序化建模归 `src/stage/factory.js`；运行时往返/碰撞/挂载归 `src/stage/runtime.js`；播放归 `src/playback/engine.js`；UI 归 `src/ui/inspector.js`；归一化归 `src/core/project-data.js`。
- Git：基线与固定 App installed source 均为 `b8da5f4f36a40010541700171cb246f2ca9de17b`，任务分支从该提交创建。
- 测试/运行：依赖按 lockfile 用 Node 22 `npm ci` 安装；首次 `app:status` 因依赖缺失失败，安装后重跑通过。
- 文档/历史线索：已阅读仓库入口、ADR-0002/0003/0004/0005/0013/0015，以及 AI-Assets/Mirror 中的 PreVision 架构、工程纪律、海马解剖与沉船参考说明。
- 外观参考：只读本机参考资产仅用于观察轮廓与结构，不复制、不提交、不加入运行时；具体本机路径不写入 Git。

## 影响范围

- 模块：`actor,playback,project,history,camera,capture,layout,testing,i18n`
- 文件：仅限“并行任务声明”中的精确列表；需要扩展时先停止并向固定 02 申请扩 scope。
- 数据格式：有；project v5 actor 白名单新增兼容字段 `characterStyle`，旧 v1–v5 缺字段安全回退，版本号保持 5。
- 平台：macOS Apple Silicon 开发预览；浏览器/项目数据自动测试保持跨平台语义。

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：High
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：开启（用户明确要求快速；该标签不是质量证据）
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：首轮 R2 为 FAIL；沉船等返工后的全新独立 R2 因可假阳性的 path-yaw 证据判定 FAIL；第二轮最小修复后的全新独立 R2 又因 expected 与生产共享 tangent 的唯一共因 P2 判定 FAIL。完成本轮最小返工后仍须由固定 02 安排又一轮全新独立 R2，风险等级不得降级
- 数据：`characterStyle`、mount、pose、joints、scale 和路径字段必须在 normalize/build/stageToData/autosave/history 往返中一致。
- UI/交互：模型库窄栏、骑乘尺度边界、关节联动和四视图需要真实 Electron 检查。
- 安全：不载入外部模型或新增远程/文件解析边界；碰撞代理不得把桅杆和索具变成巨大实心障碍。
- 发布：仅开发预览；临时工不运行 `app:deliver`。

## 兼容与冻结语义

### 沉船

- `kind:'shipwreck'`；程序化轻量大型木质破损帆船，默认约 24m。
- 侧面/三分之四视角须读出断裂倾斜船体、破损甲板/舱口、断桅/残桅、横梁、外露肋骨和少量低成本索具。
- 视觉模型内部倾斜，编辑器根变换稳定；支持添加、旋转、统一缩放、保存重开、撤销、autosave 与有限确定的路径方向。
- 碰撞仅使用合理船体代理，桅杆/索具不扩张为巨大实心障碍。

### 海马

- `kind:'seahorse'`；直立轮廓、骨板/棘刺、长吻、背鳍、卷尾、鞍座、胸带和左右脚蹬。
- 不可简化长吻、卷尾、背鳍，以及鞍座/胸带/左右吊镫之间的结构关系；首版只可简化微刺、锈斑和皮革压纹。
- 不暴露 `horseLegs`，不套用马步态；直/曲路径 yaw 对齐切线，x/z 保持直立。
- 使用专用 anchor 与 joint preset；在明确记录的窄尺度范围、四向和路径五点采样内保持臀部落鞍、腿膝脚贴合躯干/脚蹬，无明显穿插、漂移或重复偏移。
- 超范围输入钳制或以双语提示说明；白马、车辆和普通挂载保持原语义。

### 巫师

- 复用 `kind:'char'` 与完整 rig，仅用 `characterStyle:'wizard'` 表达 fallback 外观与性能基线。
- 程序化帽、袍和魔杖仅用于辨识与 rig foundation 验证，不代表或承诺原人物高精度。
- 帽子真实挂到头/颈，魔杖真实挂到右腕/手；头、躯干、肩肘腕、髋膝踝调节继续真实生效。
- 检查肩肘腕、髋膝支持活动与附件跟随；魔杖不脱手，缺字段的旧项目回退普通角色。
- 本轮不继续美化程序化脸/长袍；高精度原人物直绑骨明确移交独立后续任务。

### 共同语义

- 三者可从 inspector 模型库添加；窄栏不裁切、不重叠、可点击。
- 沉船不可简化破损开口/断裂走向、至少一根主桅、主要索具层次和俯视甲板可读性。
- 新模型标签与摄影机 `lockTarget` 高度合理。
- 提示词把海马归为动物/骑乘、巫师归为角色、沉船归为场景道具；既有白马与 prompt golden 不变。
- 所有新增或触及的用户文案使用 language key，并同步 `zh-CN` / `en-US`。

## 验收条件

- [x] 沉船分段定向船体代理通过 0°/45°/90° 船外不阻挡、真实接触阻挡与路径 yaw 回归；白马/普通道具碰撞不回归。
- [x] 海马在默认与边界尺度的正/侧/背/俯视，以及非共线曲线路径 0/25/50/75/100% 近景中，骨盆落鞍、腿脚姿态稳定，播放无漂移；五点逐点 expected/measured yaw 以 wrap-angle 对齐并覆盖至少 3 种方向，承诺限定为支持范围内无明显持续穿插。
- [x] fallback 巫师的全身 rig、帽/杖随骨、兼容与性能基线保持；不宣称程序化外观达到原人物高精度。
- [x] `characterStyle`、pose、joints、mount、scale 保存/重开/撤销/autosave 往返；v1–v5 缺字段兼容且 PROJECT_VERSION 保持 5。
- [x] 白马、车辆、普通挂载、11 类 semantic proxy 和既有 prompt golden 无回归。
- [x] 真实 280px inspector 模型库无裁切/重叠且按钮可点击，触及的历史 inspector 文案完成 language key 双语言迁移。
- [x] 相关自动测试、影响测试与全量回归通过，重复构建字节稳定。
- [x] 四张 1440×900 隔离 Electron 证据保持；同名 playback PNG 已以固定世界相机重拍，五点逐格标注 expected/measured yaw、误差与 anchor，真实 inspector、实际播放性能和其它三图保持原有效语义。
- [x] `git diff --check`、敏感信息、绝对路径、意外文件和构建产物检查通过。
- [ ] 实现者之外的独立 R2 只读 reviewer 已完成，阻塞问题已关闭。
- [x] 文档与功能登记准确记录首轮 R2 FAIL、返工结果、fallback wizard foundation 与 `IMPLEMENTED_UNVERIFIED` 状态。
- [x] 固定 App 交付不适用：本任务仅为开发预览，由 `00` 后续集成后决定稳定预览/正式交付。

## 测试计划

- 影响映射模块：actor、playback、project、history、camera、capture、layout、testing、i18n。
- 主应用模块参数：`actor playback project history camera capture layout`
- 最小与契约命令：
  - `npm run build` 两次并比对 SHA-256
  - `node 测试/回归/C1_previz_roundtrip.mjs`
  - `node 测试/回归/U4_normalize_malformed.mjs`
  - `npm run test:module -- actor`
  - `npm run test:module -- playback`
  - `npm run test:module -- project`
  - `npm run test:module -- history`
  - `npm run test:module -- camera`
  - `npm run test:module -- capture`
  - `npm run test:module -- layout`
  - `npm run test:i18n`
  - `npm run test:app`
  - `npm run test:impact -- --base b8da5f4f36a40010541700171cb246f2ca9de17b --module actor`
  - `npm run test:impact -- --base b8da5f4f36a40010541700171cb246f2ca9de17b --module playback`
  - `npm run test:impact -- --base b8da5f4f36a40010541700171cb246f2ca9de17b --module project`
  - `npm run test:full`
- 升级到全量的条件：本任务已触及 project v5、autosave、history、playback、capture 与生成产物，因此无条件运行全量。
- 人工检查尺寸/步骤：隔离 userData 的 Electron 1440×900；三模型单体正/侧/背/俯视，海马+巫师默认/边界尺度四向及路径 0/25/50/75/100%，巫师头/腕/髋/膝连续调节与最大支持活动，沉船近中远与路径/碰撞，模型库窄栏，撤销/autosave 重开，三模型同场基础 FPS。
- 视觉证据标注：四张截图及 README 必须写明 build/模型包标识、视口方向、缩放值、动作或播放时刻，并逐项记录 `PASS`、可接受残余或阻断。
- 固定 App 交付：不适用；本任务不得更新 `~/Applications/PreVision.app`。

## 实施记录

- 假设：首版优先使用低复杂度 Three.js primitive/自定义轻量几何，模型内部结构可读性优先于照片级外观。
- 关键决定：
  - `shipwreck` 视觉根组内部完成倾斜和断裂，编辑器 actor 根保持稳定；`actorWorldBox` 继续完整取景，碰撞/贴地/步长单独使用船体代理。
  - `seahorse` 使用专用 mount anchor、ride joints 和 `0.85–1.15` scale 钳制；挂载骑手继承宿主尺度，不进入白马 `horseLegs` 步态。
  - 巫师不新增 kind，不进入 11 类 semantic proxy；帽/袍/杖作为现有 `char` rig 的 `characterStyle:'wizard'` fallback foundation，帽挂 neck、杖挂右 wrist；程序化外观不作为高精度人物最终方案。
  - project 版本保持 5；`characterStyle` 仅接受 `char + wizard`，缺字段回退普通角色，未知/错类型 fail closed。
  - 外观参考只读观察，未复制、提交或加入运行时；没有引入 GLTFLoader、GLB、PNG 或其他二进制模型资产。
- 实际修改：
  - 新增程序化沉船、海马与巫师装饰，补齐标签/lock target、路径朝向、骑乘迁移、碰撞代理、尺度联动和 stage/project v5 往返。
  - 模型库改为两列窄栏网格并新增三入口；所有新增用户文案同步 `zh-CN` / `en-US` language key。
  - 提示词将海马归为动物/骑乘、巫师归为角色、沉船归为场景道具；既有白马 golden 保持。
  - C1、U4 与 actor 冒烟增加保存重开、缺字段/恶意字段、路径、挂载、撤销/autosave、提示词和结构断言。
  - 新增四张 1440×900 隔离 Electron 证据和 `docs/qa/fast-preview-model-pack/README.md`，并登记 `SCN-009`。
  - R2 返工把沉船 actor 间碰撞改为 9 段 yaw 定向船体代理，同时保留非沉船的旧 AABB 路径；触及的角色/道具 inspector 历史中文迁入双语 language key。
  - 第一轮返工证据曾把海马五点改为宿主 yaw 相对近景并嵌入真实 280px inspector DOM，同时用实际 `clock.play()` 的 5 秒播放采样替代静态 rAF；后续全新 R2 判定宿主共转相机仍会掩盖常量/反向 yaw。
  - 第二轮最小返工把自动夹具改为明显非共线的 Catmull-Rom 曲线，五点独立计算 tangent expected yaw 并以 wrap-angle 比较海马/骑手 measured yaw；同名 playback PNG 改用完全固定的世界 target/distance/theta/phi，逐格标注 expected/measured/Δ/anchor。
  - 第三轮最小返工只把自动与图证的 expected 改为实际播放宿主位置有限差分，不调用 `actorCurve`、`getTangent` 或 `timedPathState`；增加 measured 整体 `+90°`/反向而位置不变时必须出现大误差的负向敏感性证明。生产运行时与其它三图保持不变。
  - 00 产品裁决后停止程序化巫师外观美化；现有实现只作为 fallback rig foundation 与性能基线。
- 中断/恢复：
  - 第一次 impact 内嵌 full 的 Electron DOM probe 在 1316×768 peek 快捷入口发生一次时序失败；同命令独立重跑通过 3 个视口 × 4 模式 × 4 入口，第二次及最终 impact/full 全部通过，未以改业务语义掩盖该抖动。
  - 最终 actor 定向测试首次运行发现测试钩子直接引用了未暴露到旧全局桥的内部海马迁移函数；运行时模块本身可用。测试改为通过真实 `loadScene` 触发迁移，并验证专用关节更新且 `neckY` 手调值保留，随后 actor/app/impact 全绿。
- app-server 通知消费：当前为后台施工，不作为 Desktop live 证据。

## 首轮 R2 FAIL 与聚焦返工

- 首轮独立 R2 结论：**FAIL**。沉船单一 local AABB 在 45° 世界轴重包围后产生约 `20.86 × 20.86m` 的假障碍；原点沉船沿 45° 路径时，会被位于 `(9, 0)`、真实船体外的普通道具误判碰撞并回滚 yaw。
- 修复 1｜碰撞：以确定性的分段定向船体代理替代 actor 间的单一世界轴 AABB 判定；补 0°/45°/90° 船外不阻挡、中心/船首真实接触阻挡、45° 路径 yaw 正常，以及旧白马/普通道具不回归。
- 修复 2｜inspector：四图中加入真实 Electron DOM 的 280px 右栏/模型库实景，能直接检查两列按钮无裁切、无重叠并可命中；同步迁移本次触及区域的历史内联中文。
- 修复 3｜海马：路径 `0/25/50/75/100%` 改为宿主相对固定构图近景，逐点显示骨盆落鞍、双腿/脚蹬、yaw 切线朝向、直立与无漂移。
- 修复 4｜性能：改为真实播放状态下的有时长采样，记录配置时长、实际时长、frame/sample count、median、p10、空场基线、比例与复现步骤，不再用静态 3 秒 rAF 自报代替。
- 修复 5｜巫师证据与产品裁决：首轮证据不足；随后 00 已裁决本任务收敛为 fallback wizard foundation。本轮只复核现有全身 rig、帽/杖随骨、project v5/autosave/undo/旧项目兼容与性能基线，不再投入程序化脸/长袍美化，也不宣称满足原人物高精度。
- 登记修正：`SCN-009` 在新独立 R2 和中央集成验证前保持 `IMPLEMENTED_UNVERIFIED`；旧 review、stop 和视觉证据不可复用。

## 全新独立 R2 FAIL 与单项最小返工

- 沉船碰撞、280px inspector、骑乘贴合与 anchor、动态 FPS、fallback wizard 诚实登记、`SCN-009` 状态、双语迁移和 project-v5/autosave/undo 均通过三路全新只读 R2 交叉复核。
- 唯一 P2：旧 actor 回归仍使用 `pathMode='line'` 且五点共线，只断言 yaw 为 finite；旧 playback 图的五格相机使用“宿主 yaw + 固定偏角”，会把宿主朝向视觉归一化。常量或反向 yaw 因而可能同时骗过自动与目检证据；该结论不是已证明运行时代码错误。
- 自动修复契约：夹具改为明显非共线的 `pathMode='curve'`；在 `0/25/50/75/100%` 五点分别以曲线 tangent 计算 `expected = atan2(tangent.x, tangent.z)`，使用 `atan2(sin Δ, cos Δ)` 比较海马与骑手 measured yaw，误差 `<0.002rad`，并证明至少 3 个不同 yaw；原 position/upright/anchor 断言保留。
- 视觉修复契约：只重做既有 `1440x900-model-pack-playback.png`。五格统一使用固定世界 target `(-0.8, 1.9, -0.2)`、distance `6m`、theta `0.62rad`、phi `1.04rad`，逐格标出 expected/measured yaw、Δ 和 anchor。实测五点为 `-172.9°`、`-180.0°`、`131.4°`、`45.0°`、`-0.2°`，measured 逐点相等，wrap-angle Δ 均为 `0.0°`，anchor 均为 `0.0000m`。
- 本轮不改运行时产品逻辑，不重做其它三图或已通过功能；`SCN-009` 继续保持 `IMPLEMENTED_UNVERIFIED`。任务级结果不得预称独立 PASS 或 `HANDED_OFF`。

## 第三轮全新独立 R2 FAIL 与共因 oracle 最小返工

- 固定世界机位的 playback 图证由视觉 R2 判定 PASS；主审与对抗 R2 交叉确认唯一 P2：自动 expected 与生产 `src/playback/engine.js` 都调用 `actorCurve().getTangent(.999)`，共享 tangent 若整体旋转或反向、路径位置不变，旧自动回归仍可能全绿。该证据缺口不是已证明的运行时代码错误。
- 自动修复契约：继续使用既有非共线曲线和五个 exact-f 播放点；expected 只从实际宿主位置取有限差分，0% 用 `[0, .002]`，内部点用 `[f-.002, f+.002]`，100% 用 `[.998, 1]`，以 `atan2(Δx, Δz)` 计算，不调用 `T.actorCurve`、`getTangent`、`timedPathState`，也不复制生产 tangent 算法。保留至少 3 个 measured yaw、position/upright/anchor/rider 断言。
- 负向敏感性契约：保持五点位置不变，把 measured heading 统一 `+90°` 或反向；独立位置 oracle 必须分别报告全部 `>1.4rad` 或 `>3rad` 的大误差，证明共享 tangent 故障不能继续假通过。
- 视觉契约：只重拍同名 `1440x900-model-pack-playback.png`，保持固定世界 target/distance/theta/phi、五格骑乘近景、三模型性能格和 280px inspector inset 不动；标签 expected 使用同一位置有限差分 oracle。实测五点 expected/measured 为 `-172.8/-172.9°`、`-179.9/-180.0°`、`131.4/131.4°`、`45.0/45.0°`、`-0.2/-0.2°`，显示 Δ 为 `0.1/0.1/0.0/0.0/0.0°`，anchor 均为 `0.0000m`。
- 本轮不改运行时、其它三图、280px/FPS/模型或任何已通过功能；`SCN-009` 继续保持 `IMPLEMENTED_UNVERIFIED`。当前结果仅是任务级修复，不预称独立 PASS 或 `HANDED_OFF`。

## 第一轮验证（历史，已被 R2 FAIL 作废）

以下结果只记录首轮施工历史，不得作为本轮 REVIEW 或视觉验收证据。首轮独立 R2 复现沉船 45° 假碰撞，并判定 280px inspector、海马五点近景、真实播放性能和巫师可辨识证据不足；旧 stop/review/视觉证据已全部失效。

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| `npm ci`（Node 22） | 通过 | 12s | 安装锁定依赖；未执行 audit fix |
| `npm run app:status` | 通过 | <1s | installed/current 均为任务基线；contains=yes、exact=yes |
| `npm run build` ×2 + SHA-256 | 通过 | <1s/次 | 两次均为 `7fff6c265eb1150142259ce67907b71ef276c86ba4a77446c70ea55c4cb1f6dc` |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 通过 | <1s | 47 通过，0 失败 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 通过 | <1s | 43 通过，0 失败 |
| `npm run test:module -- actor` | 通过 | — | 166 通过，0 失败 |
| `npm run test:module -- playback` | 通过 | — | 32 通过，0 失败 |
| `npm run test:module -- project` | 通过 | — | 112 通过，0 失败 |
| `npm run test:module -- history` | 通过 | — | 29 通过，0 失败 |
| `npm run test:module -- camera` | 通过 | — | 84 通过，0 失败 |
| `npm run test:module -- capture` | 通过 | — | 140 通过，0 失败 |
| `npm run test:module -- layout` | 通过 | — | 143 通过，0 失败 |
| `npm run test:i18n` | 通过 | — | 217 通过，0 失败 |
| `npm run test:app` | 通过 | — | 987 通过，0 失败；故障注入 warning 为预期恢复路径 |
| `npm run test:project-input`（首次 impact 失败后的独立复核） | 通过 | 约 44s | 3 个视口 × 4 模式 × 4 快捷入口全部稳定 |
| `npm run test:impact -- --base b8da5f4f36a40010541700171cb246f2ca9de17b` | 通过 | 174.20s | 最终 22 个变化文件升级执行 `test:full`；完整通过 |
| `npm run test:full` | 通过 | — | 先独立运行通过；最终状态又由 impact 实际调用并通过 app、project-input、Web、desktop、local-install、foundation/coordination/i18n 全链路 |
| 隔离 Electron 1440×900 人工验收 | 通过 | — | 三模型四视图/三档骑乘/五点路径/关节边界/280px 模型库/撤销/autosave；详见 QA README |
| 三模型性能 | 通过 | 3s + 3s | 中位 59.9 FPS；空场 59.9 FPS；100%，无明显持续卡顿 |
| PNG 尺寸、`jq empty`、`git diff --check`、敏感信息/绝对路径检查 | 通过 | <1s | 四图均精确 1440×900；登记可解析；未命中凭据或本机资产路径 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本任务不得启动或更新固定 App。

## 沉船等首轮聚焦返工验证（path-yaw 证据已由下表替换）

| 命令/步骤 | 当前结果 | 备注 |
| --- | --- | --- |
| `npm run build` ×2 + SHA-256 | 通过 | 两次均为 `343a67d52c29e69cbdc3992f0fc93fd731947b14e85c2965ea0206affa687074` |
| `npm run test:module -- actor` | 169 通过，0 失败 | 含 0°/45°/90°、尖艏/分段对角、路径 yaw 和旧白马/道具碰撞回归 |
| `npm run test:module -- playback` | 32 通过，0 失败 | Node 22 |
| `npm run test:module -- project` | 112 通过，0 失败 | Node 22 |
| `npm run test:module -- history` | 29 通过，0 失败 | Node 22 |
| `npm run test:module -- camera` | 84 通过，0 失败 | Node 22 |
| `npm run test:module -- capture` | 140 通过，0 失败 | Node 22 |
| `npm run test:module -- layout` | 143 通过，0 失败 | Node 22 |
| `npm run test:i18n` | 217 通过，0 失败 | inspector 关联历史中文已迁移，双语言 key 对齐 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 47 通过，0 失败 | project v5 往返 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 43 通过，0 失败 | 旧项目/恶意字段回退 |
| `npm run test:app` | 990 通过，0 失败 | 故障注入 cleanup warning 为预期路径 |
| 隔离 Electron 1440×900 四图 | 任务级证据通过 | 真实 280px inspector 7/7 命中；海马五点近景 anchor 误差 0；fallback wizard foundation 明示非高精度声明 |
| 真实播放性能 | 任务级证据通过 | 空场 5000.4ms/301 帧/median 59.9/p10 58.1；模型包 5000.0ms/301 帧/median 59.9/p10 59.2，宿主移动 3.470m |
| impact `--module actor` | 通过，190.04s | 当前变化不允许模块参数缩小覆盖，实际升级运行 `test:full` |
| impact `--module playback` | 通过，196.17s | 当前变化不允许模块参数缩小覆盖，实际升级运行 `test:full` |
| impact `--module project` | 通过，190.24s | 当前变化不允许模块参数缩小覆盖，实际升级运行 `test:full` |
| `npm run test:full` | 通过 | 额外显式执行；app 990、项目输入 Web/Electron、Web 10+14、desktop 47、local-install 36+13、foundation 151、C8 11、coordination 553、i18n 217、wrapper 11 均 0 失败 |
| 最终差异/敏感信息/绝对路径/意外文件检查 | 通过 | `git diff --check` 无输出；baseline..工作区 22 路径均在 claim scope；未命中凭据、本机绝对路径或未声明文件；四图均精确 1440×900 |

## 第二轮单项 path-yaw P2 验证

| 命令/步骤 | 当前结果 | 备注 |
| --- | --- | --- |
| `npm run build` ×2 + SHA-256 | 通过 | 两次均为 `343a67d52c29e69cbdc3992f0fc93fd731947b14e85c2965ea0206affa687074`，生成 HTML 字节未因测试/证据修正漂移 |
| `npm run test:module -- actor` | 169 通过，0 失败 | 非共线 Catmull-Rom 五点逐点 expected/measured yaw、wrap-angle `<0.002rad`、至少 3 个方向、位置/upright/anchor 均通过 |
| `npm run test:app` | 990 通过，0 失败 | 覆盖同一 actor 断言；故障注入 cleanup warning 为预期路径 |
| `npm run test:i18n` | 217 通过，0 失败 | 本轮未新增用户文案，双语言契约保持 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 47 通过，0 失败 | project v5 往返保持 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 43 通过，0 失败 | 旧项目/恶意字段回退保持 |
| 隔离 Electron 同名 playback PNG | 任务级通过 | 1440×900；固定世界相机；5 个 expected/measured yaw 均可见且 Δ=`0.0°`、anchor=`0.0000m`；280px inspector inset 保留 |
| `npm run test:project-input` | 通过 | 首次 impact 在既有 `1600×900 peek` 可见性等待处发生一次时序失败；独立原命令随即通过 3 视口 × 4 模式 × 4 入口，未修改无关代码 |
| impact `--base b8da5f4… --module actor` | 通过，166.09s | 首次因上述已知 DOM probe 时序失败；独立复核后原 impact 重跑通过，并按真实 CLI 升级执行 `test:full` |
| `npm run test:full` | 通过 | 额外显式执行；app 990、project-input、Web 10+14、desktop 47、local-install 36+13、foundation 151、C8 11、coordination 553、i18n 217、wrapper 11 均 0 失败 |

## 第三轮共因 oracle P2 验证

| 命令/步骤 | 当前结果 | 备注 |
| --- | --- | --- |
| `npm run test:module -- actor` | 170 通过，0 失败 | 五点 expected 来自实际宿主位置有限差分；exact-f 海马/骑手 measured wrap-angle 最大误差约 `0.001656rad`，至少 3 个 yaw、位置/upright/anchor 保持；`+90°`/反向负向敏感性下误差分别全部 `>1.4rad` / `>3rad` |
| 隔离 Electron 同名 playback PNG | 任务级通过 | 1440×900；固定世界相机与原布局保持；标签 expected 来自位置有限差分，显示 Δ 为 `0.1/0.1/0.0/0.0/0.0°`，anchor 均 `0.0000m`；其它三图未重拍 |
| `npm run build` ×2 + SHA-256 | 通过 | Node 22.23.1；两次均为 `343a67d52c29e69cbdc3992f0fc93fd731947b14e85c2965ea0206affa687074`，生成 HTML 字节稳定 |
| `npm run test:app` | 991 通过，0 失败 | 覆盖新增 actor oracle 与负向敏感性断言；故障注入 cleanup warning 为预期路径 |
| `npm run test:i18n` | 217 通过，0 失败 | 本轮未新增用户文案，双语言契约保持 |
| C1 / U4 | 47 / 43 通过，0 失败 | project v5 往返与旧项目/恶意字段回退保持 |
| impact 首次执行 | 失败，87.95s | 仅既有 Electron DOM probe 的 `1600×900 rail` 入口在 2 秒后从可见变不可见；actor 已先完成 991/0，未改无关探针代码 |
| impact 同命令第一次重跑 | 失败，89.30s | 仍仅 `1600×900 rail`，这次入口未滚入可见视口；按固定 02 止损要求不循环、不改探针 |
| 独立 `npm run test:project-input` | 通过，40.11s | 3 视口 × 4 模式 × 4 入口，48 个稳定 rect/scroll 样本；用于复核上述历史/环境时序点 |
| impact 最终原命令重试 | 通过，165.59s | 真实 CLI：`--base b8da5f4f36a40010541700171cb246f2ca9de17b --module actor`；检测 22 个 baseline 变化文件并按映射升级执行 full |
| `npm run test:full` | 通过，164.59s | 额外显式执行；app 991、project-input、Web 10+14、desktop 47、local-install 36+13、foundation 151、C8 11、coordination 553、i18n 217、wrapper 11 均 0 失败 |
| 最终 diff / scope / 敏感信息 / oracle / PNG 检查 | 通过 | 本轮恰为已声明的 4 个文件，baseline..工作区 22 个路径均在 claim；`git diff --check`、绝对路径/凭据形态、未跟踪文件检查无异常；oracle 块不含禁用调用；PNG 为 1440×900 |

## 未覆盖与后续

- Seedance 实机生成一致性不调用付费服务，不在本任务验收范围。
- 正式固定 App 交付、GitHub/PR、Pages 与对外发布由 `00`/后续流程处理。

## 交接

- 最终提交：本验收单随任务提交冻结；精确 HEAD 与 baseline..HEAD 有序列表由 Git 和 `task:transition` 持久化。
- PR：无
- reviewer 结论：首轮 R2 为 FAIL；沉船等返工后的全新独立 R2 因可假阳性的 path-yaw 证据判定 FAIL；第二轮最小修复后的全新独立 R2 又因 expected 与生产共享 tangent 的唯一共因 P2 判定 FAIL。本轮最小返工完成后等待又一轮全新独立 R2，不预称 PASS
- 生命周期交接：实现 turn 完成后运行 stop verification，并转 REVIEW；claim 保持，不 release。
- 工作区状态：提交前仅声明 scope 内的实现、测试、文档与四张证据为预期改动。
- 下一步：固定 02 安排实现者之外的又一轮全新独立 R2 只读 reviewer；PASS 后再由治理流程处理验收单 closeout 与 `00` 集成。

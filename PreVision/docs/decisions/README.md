# 决策记录

重要架构或工作流变化在本目录新增不可变记录，文件名使用：

`NNNN-简短标题.md`

每份记录包含：状态、日期、背景、决定、替代方案、后果、验证方式和撤销条件。新决定替代旧决定时，新建记录并链接旧文件，不静默改写历史。

适合记录：数据格式迁移、拆分单文件应用、启用 Electron sandbox、正式签名、公有云/协作、许可证和插件接口。

## 当前记录

- [ADR-0001：以仓库文件和分层测试作为开发上下文](0001-development-foundation.md)
- [ADR-0002：用户界面文案统一使用 language key](0002-language-key-internationalization.md)
- [ADR-0003：用户可见任务必须交付到唯一固定 Mac App](0003-canonical-local-app-delivery.md)
- [ADR-0004：短期 Worktree 任务与写前冲突门禁](0004-short-lived-tasks-and-conflict-gate.md)
- [ADR-0005：分管自治派发与原子写槽预留](0005-department-autonomous-dispatch-and-atomic-write-reservations.md)（替代 ADR-0004 中只有 `00` 可派发的部分，并定义权威生命周期、Desktop live/后台施工可见性与侧栏补偿）
- [ADR-0006：单文件应用的"拆解-重组"构建底座（重构 P0）](0006-decompose-reassemble-build-foundation.md)（源文件成为事实源头，根 HTML 变为字节级可证的构建产物；C8 守门 + 函数清点纪律）
- [ADR-0007：esbuild 进场与首次模块搬迁（重构 P1：core/timing-math.js）](0007-esbuild-bridge-and-first-module-move.md)（"桥打包"过渡机制保全既有测试网的顶层全局语义；U1/U2/U3/U5 纯函数单测与 timing golden 落地）
- [ADR-0008：契约层收编进 core/project-data.js（重构 P2）](0008-contract-layer-module.md)（.previz.json v5 契约唯一定义点；timing-math 自由引用收编为真 import 并记录 core 内环；桥 charset 改 ascii 以守 i18n 政策）
- [ADR-0009：Store + PlaybackClock 收编八核心全局（重构 P3，耦合点 1）](0009-store-playback-clock.md)（core/store.js 成依赖图的根；time/playing 归 PlaybackClock 五动词 + lease；globalThis 访问器 shim 上线并删除 app.js 对应 let 声明；recordBlob/seedancePack 借用已被捕获事务收编的记录内偏差）
- [ADR-0010：RefreshHub 刷新总调度上线（重构 P4，耦合点 3）](0010-refresh-hub.md)（标脏 + 定序冲刷落户 store.js，22 topic 注册，syncAll 改 refresh.all()；记录内偏差：同步冲刷不做微任务合并、handler 组合替换留给渐进式后续）
- [ADR-0011：独立功能块搬迁（重构 P5：stage/factory.js + features/storyboard.js + export/prompt.js）](0011-standalone-feature-modules.md)（建模工厂、离线分镜规划器、genPrompt 运镜分析器纯搬运；prompt register 随迁；storyboard 可变状态使用 globalThis 访问器 shim）
- [ADR-0012：环境与资产模块搬迁（重构 P6：stage/environment.js）](0012-environment-assets-module.md)（渲染/太阳/Three 资源/orbit 与项目资产/天空/地面/标签/导出观感纯搬运；四个 live shim 保留；RefreshHub UI handler 留守 app.js）
- [ADR-0013：舞台运行时模块搬迁（重构 P7a：stage/runtime.js）](0013-stage-runtime-module.md)（F+J 与随迁 helper 纯搬运；9 个显式调用期访问；prompt/storyboard 别名真 import；两项 i18n 裁决和 clearStage smoke 语义修正）
- [ADR-0014：标量字段表等价改写（重构 P7b）](0014-stage-scalar-field-tables.md)（ACTOR_FIELDS/SHOT_FIELDS 供应商中立纯数据表；normalize/runtime 各 phase 独立 adapter 和旧键序；复杂字段继续手写；C1 直接 import 字段表做 golden key coverage）
- [ADR-0015：播放、视口与导出模块搬迁（重构 P8）](0015-playback-viewport-capture-modules.md)（playback/viewport/capture 三 owner 串行迁出；capture 保持 Node-safe direct import；Seedance/C6/P8 边界测试落地）
- [ADR-0016：国际化绑定溯源分析器](0016-i18n-binding-provenance-analyzer.md)（为 `test:i18n` 建立同文件 binding identity/provenance 基础；只消费唯一完整 binding，unsupported 形态 fail closed）
- [ADR-0017：P9 UI、持久化与主入口模块](0017-ui-persist-main-modules.md)（以确定性脚本片段组装替代整体 bundle，保留单一运行时词法环境与既有交付形态）

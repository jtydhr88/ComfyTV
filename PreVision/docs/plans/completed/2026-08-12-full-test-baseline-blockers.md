# 任务：01.18｜全量测试两项历史阻断修复

- 状态：completed
- 日期：2026-08-12
- 对话：01.18｜全量测试两项历史阻断修复
- 分支：fix/01.18-full-test-baseline-blockers
- 基线：135825bd3ab715fa48783d668980f7d8c7a3f492
- 固定 App 来源：只读 `app:status` 因固定入口缺少 `app.asar` 无法核验；本任务禁止更新或交付固定 App
- 负责人：worker:01.18-full-test-baseline-blockers

## 并行任务声明

- 任务 ID：01.18-full-test-baseline-blockers
- 模式：write
- 分管 owner：01
- 模块：background、robustness、testing、i18n
- UI 表面：app-shell、viewport、dialogs
- 数据区域：qa-metadata、i18n-resources
- 预计修改文件：
  - `测试/冒烟测试.mjs`
  - `src/export/prompt.js`
  - `src/main.js`
  - `预见PreVision.html`
  - `i18n/locales/zh-CN.js`
  - `i18n/locales/en-US.js`
  - `docs/CURRENT_STATE.md`
  - `docs/KNOWN_ISSUES.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/plans/active/2026-08-12-full-test-baseline-blockers.md`
  - `docs/plans/completed/2026-08-12-full-test-baseline-blockers.md`
  - `docs/plans/completed/README.md`
- reservation：已从续期 reservation 原子转换为 claim；reservation id 已在 common-dir 权威登记核对，不记录 token
- reserve request key：已由固定 01 核对并去敏
- 协调登记：schema v3 revision=`1e2bb0c5-7365-48b0-980c-91c8b797708f`；persistence=confirmed
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：01 / worker:01.18-full-test-baseline-blockers
- 状态更新时间 / 原因：2026-08-13T12:04:26.787Z；同一 canonical thread 完成恢复握手并启动正式开工 turn
- 侧栏去重证据：task id、canonical client/thread 已在本机核对并去敏
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；没有 Desktop-owned 当前 turn 与实际观察证据，不宣称 DESKTOP_LIVE
- WAITING checkpoint：固定 01 已为原 canonical thread 完成独立 stop verification 并续期至 WAITING；本轮已转换 ACTIVE
- turn stop verification：实现与验证已完成；本 turn 结束后由固定 01 执行 `task:verify-stop` 并转 REVIEW
- 失败补偿：无；恢复同一 canonical task/thread/Worktree，未创建副本
- `task:check` 结果：固定 01 已完成续期与范围复核；claim 原子转换无硬冲突
- `task:claim --reservation`：已从 reservation 转换
- REVIEW commit list：未冻结
- 机械 closeout：reviewer PASS 后才允许 sole-parent closeout；当前不执行
- `task:release`：未释放；由 `00` 中央集成与最终回归后处理
- `task:archive`：未开始

## 用户问题

Node 24 的中央 `test:app` 在 1187 个通过断言外保留两项历史失败：“提示词含树木指代”和“无 modal 时既有 Space、方向键、G/R/C/F 与 Delete 工作区命令全部恢复”。要求先证明它们是测试夹具泄漏、陈旧断言还是产品回归，再做不改变业务语义的最小修复。

## 目标

- 复现并记录精确 Node 24 RED，区分测试状态泄漏、陈旧断言与真实产品回归。
- 让树木提示词夹具确定性建立真实语义树对象并验证 `genPrompt` 的树木指代，不删除语义要求。
- 让无 modal 快捷键回归验证 Space、方向键、G/R/C/F 的既有调用，以及 Delete 由统一 timeline 路由消费、`defaultPrevented` 和零意外项目/对象写入，不恢复误删演员语义。
- 最终 `test:app` 0 失败，并通过 background、robustness、i18n、build 与 diff-check。

## 非目标

- 不改变 prompt 产品语义、统一 Delete 路由、project/history/autosave 或对象删除合同。
- 不修复 BlendMotion，不运行 `test:full`、`test:impact` 或 `app:deliver`。
- 不更新固定 App、稳定预览指针、GitHub、Pages，也不扩大到未声明文件。

## 证据与现状

- 代码：待以本轮 RED 和执行级最小 oracle 核对。
- Git：cwd、分支、clean 与精确 baseline 已在恢复握手核对。
- 测试/运行：01.17 验收记录同一失败集合；本轮不以历史记录替代现场复现。
- 文档/历史线索：Delete 自 `6cdfffa` 起统一走 `routeTimelineDeleteCommand`；提示词测试可能依赖前序 camera/scene 可见性状态，均须自行验证。

## 影响范围

- 模块：background、robustness、testing、i18n
- 文件：仅限并行任务声明中的精确路径
- 数据格式：无
- 平台：macOS；Node v24.18.0 自动回归

## 风险

- 风险档：R2
- 请求模型：Sol
- 实际模型：不可观察，未验证
- 请求 reasoning：未指定
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：由固定 01 在实现提交和 REVIEW 后组织 R2，不以本模型自证
- 数据：修复必须证明项目、history、autosave 与对象集合无意外写入
- UI/交互：Delete 应由当前统一路由消费，不能为了旧 click counter 恢复演员误删
- 安全：不放宽关键断言、不调用真实付费服务、不扩大文件或发布权限
- 发布：任务级测试修复；固定 App 与任何发布面均不更新

## 验收条件

- [x] Node 24 `test:app` 现场复现精确两项失败，并保存 expected/actual 与根因。
- [x] 树木测试确定性证明真实树对象参与当前镜头提示词，且执行级负向 oracle 能检出错误夹具/语义。
- [x] 无 modal 测试证明 Space、方向键、G/R/C/F 恢复，Delete 统一消费、`defaultPrevented` 且项目/对象/history/autosave 零意外写入。
- [x] 相关自动测试通过：background、robustness、`test:app`、`test:i18n`、build、diff-check。
- [x] 不运行 full/impact/app:deliver，不触碰禁止范围。
- [ ] 实现者之外的独立 R2 已由固定 01 组织；阻塞问题在后续返工中关闭。
- [x] active 验收单按实际根因和验证结果更新。

## 测试计划

- 影响映射模块：background、robustness
- 主应用模块参数：background、robustness
- 最小命令：Node 24 `npm run test:app` RED；定向 background/robustness；最终 `test:app`、`test:i18n`、`npm run build`、`git diff --check`
- 升级到全量的条件：本任务明确禁止 full/impact；若证据表明范围外真实产品回归则停止并升级固定 01
- 人工检查尺寸/步骤：不适用；测试夹具与业务合同修复，无 UI 视觉变更
- 固定 App 交付：不适用；禁止 `app:deliver`

## 实施记录

- 假设：两项失败分别可能来自环境夹具状态泄漏与 Delete 旧 counter 断言；必须由本轮执行证据确认。
- 关键决定：先 RED；优先修夹具隔离/陈旧断言，只有证据显示产品回归时才修改产品源。
- 根因：树木断言选中了前序 semantic tree 且未建立确定镜头可见性，产品 `genPrompt` 正常；Delete 断言仍期待 `delActor +1`，与 `6cdfffa` 后统一 timeline 路由消费且不 fallback 删除演员的合同矛盾。
- 实际修改：仅修改 `测试/冒烟测试.mjs`。树木夹具按本段新建 actor 身份建立确定镜头的精确正/负向 prompt oracle 并恢复状态；Delete 验证统一路由反馈、`defaultPrevented`、无 actor fallback 及 project/stage/history/autosave 零写入。产品源零修改。
- 中断/恢复：旧 reservation 过期后在同一 canonical task/thread/Worktree 完成 stop verification、续期和恢复；未创建副本。
- app-server 通知消费：当前后台 turn 已 started；登记为 BACKGROUND_ONLY，不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status` | 无法核验 | <1s | 固定入口缺少 `app.asar`；不把环境缺失包装成来源结论 |
| Node 24 `task:claim` | PASS | 约 2m | revision=`1e2bb0c5-7365-48b0-980c-91c8b797708f`；ACTIVE/BACKGROUND_ONLY；scope 精确一致 |
| Node 24 `npm run test:app` RED | 1187/2 | — | 仅“提示词含树木指代”和“无 modal 时既有 Space、方向键、G/R/C/F 与 Delete 工作区命令全部恢复”失败；故障注入 warning 不计入失败 |
| Node 24 `npm run test:module -- background` | 81/0 | — | PASS；树木断言实际归 actor section，最终门禁是 `test:app` |
| Node 24 `npm run test:module -- robustness` | 58/0 | — | PASS；包含无 modal Delete 统一路由零写 oracle |
| Node 24 `npm run test:module -- actor` | 178/0 | — | PASS；树木正/负向 oracle 与后续地形/骑乘夹具一并通过 |
| Node 24 `npm run test:app` 最终 | 1191/0 | — | PASS；故障注入 warning 不计入失败 |
| Node 24 `npm run test:i18n` | 217/0 | — | PASS；无用户文案或 locale 变更 |
| Node 24 `npm run build` | PASS | 473ms | 重建单一离线 HTML（1407502 字节），生成文件无 Git diff |
| `git diff --check` | PASS | — | 无空白错误 |

固定 App installed source：无法核验；本任务不更新固定 App。

固定 App 人工启动结果：不适用；禁止启动或交付固定 App。

## 未覆盖与后续

- `test:full`、`test:impact`、中央集成、正式全量、固定 App 和发布面均由本任务外流程负责。

## 交接

- 最终提交：本验收单与实现将形成一个聚焦本地提交；精确 baseline..HEAD 列表由固定 01 在 stop→REVIEW 时冻结
- PR：无
- reviewer 结论：未评审；由固定 01 组织独立 R2
- 生命周期交接：ACTIVE（claim 保留）
- 工作区状态：实现、文档、验证与本地提交完成后保持 clean
- 下一步：本 turn 结束后由固定 01 执行 stop verification、转 REVIEW 并组织实现者之外的独立 R2；claim 保留至 `00` 集成。

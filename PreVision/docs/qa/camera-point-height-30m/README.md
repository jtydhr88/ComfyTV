# 机位点作者期高度 0.2–30m 验收记录

- 日期：2026-07-26
- 任务：`02.6c-camera-point-height-30m`
- 分支：`feat/02.6c-camera-point-height-30m`
- 精确基线：`c981658745e4a345c5484c35ec731cafd95651ac`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（未更新）
- Node：`v24.18.0`
- 生成 HTML SHA-256：`49001547fb23c0ae8f8834b7470b29434e90b905d3e4be87102d71926057a156`

## 来源与迁移

固定 00 明确授权在 claim 成功后机械承接旧任务提交
`a9a1aceda0f3082003490ee331f91d9ab861bfb2` 的 30m 产品语义。02.6c 使用
`git cherry-pick -n` 取得三方合并结果，再逐文件审查；唯一 add/add 冲突是 active 验收单，
已保留本任务新基线版本。基线中的 04.16 inspector rail 稳定性实现与断言未被旧文件覆盖。

授权中提到的旧 `3b81` Worktree 在本轮核对时已经不存在，因此没有从旧 Worktree 复制 QA
或测试文件；迁移来源仅为可验证 Git 对象。旧截图没有作为本轮证据，也没有替代新 HEAD 的
BrowserWindow QA。

## 独立 R2 P2 与返修

第一轮三路独立 R2 中，测试 reviewer 与视觉 reviewer PASS；代码/数据 reviewer 发现一个 P2：
`camPtY` 对 NaN/Infinity/-Infinity 调用 authoring clamp 后虽保留 legacy 47m，仍会登记
preview pending edit 并调用 `markDirty()`。Auto Key 开启时可能提交 preview key/history，
800ms 后还会改写 `project.modified` 与 autosave/localStorage，因此不满足“拒绝”的原子零写入语义。

本轮使用同一 canonical worker 与既有 ACTIVE claim 最小返修，没有新建 reservation、任务或 claim。
新增回归先在旧实现稳定红 6 项，再验证 legacy 47m × NaN/Infinity/-Infinity × Auto Key 开/关；
每项都独立比较 camPts、stage/project 序列化、preview pending/auto transaction、undo/history 深度与
当前快照、dirty/history timer、autosave 内容/localStorage 写次数及 `project.modified`。生产修复只把
非有限解析/拒绝移到所有项目、preview、history 和 autosave 副作用之前，拒绝时仅恢复控件显示。

根 HTML 字节已变化，上一轮 HTML `e1476d…f46` 与发布 PNG `994064…d42de` 只作为历史佐证，
不作为本轮 PASS。本页以下 BrowserWindow 证据均在 P2 新 HEAD 上重新生成。

## 自动验证

生产 helper 只供 authoring 写入使用；测试 expected 使用独立 `{min: 0.2, max: 30}` oracle，
没有复用生产 helper 自证。覆盖 inspector、新点、pull/crane、当前视图、首尾帧、Alt 拖、
对象路径复制、timeline camera key 粘贴、project v1–v5 加载兼容、30m 往返、输入不可变性和
15→30 路径播放/预览：

- P2 回归修复前：六种非有限输入/Auto Key 组合全部按预期失败并捕获副作用。
- `npm run test:module -- camera`（修复后）：106 通过，0 失败。
- `npm run test:module -- project`：113 通过，0 失败。
- `npm run test:module -- playback`：35 通过，0 失败。
- `npm run test:module -- timeline`：130 通过，0 失败。
- `npm run test:module -- viewport`：31 通过，0 失败。
- `npm run test:i18n`：217 通过，0 失败。
- `npm run test:app`：1031 通过，0 失败。
- `node 测试/回归/U4_normalize_malformed.mjs`：23 个用例、53 个断言通过，0 失败。
- `npm run test:project-input`：三档 viewport × 四种 inspector 模式及 48 个快速入口稳定样本全部通过。
- `npm run test:impact -- --base c981658745e4a345c5484c35ec731cafd95651ac --module camera`：
  因声明内生成 HTML 与未知映射文件升级为 full，P2 返修轮 209.03s 全部通过。
- 显式 `npm run test:full`：P2 返修轮全部通过；不是复用 impact 内部全量结果。
- 文档与 QA 登记完成后再次运行 `npm run test:foundation`、`npm run build` 和
  `git diff --check`，结果记录在 active 验收单。

04.16 rail 探针没有豁免：1316×768、1440×900、1600×900 的
peek/rail/expanded/director-focus 全部通过；48 个 quick-entry rect/scroll/ownership
样本稳定。

## BrowserWindow-owner Electron 1440×900 QA

结果：**PASS**。证据：
[electron-1440x900-30m.png](./electron-1440x900-30m.png)。

- owner PID：`39891`（该隔离 QA 进程已正常退出）
- URL：`file://<task-worktree>/%E9%A2%84%E8%A7%81PreVision.html`；运行时断言
  `webContents.getURL() === pathToFileURL(<task-worktree>/预见PreVision.html).href`
- title：`PreVision 02.6c QA — NOT INTEGRATED`
- window bounds：`x=560, y=270, 1440×932`
- content bounds：`x=560, y=302, 1440×900`
- CSS viewport：`1440×900`
- DPR：`2`

由 BrowserWindow owner 投递真实控件点击、键盘、canvas Alt 指针拖动和 timeline lane 事件，
四项均在生成 PNG 前 fail-closed 断言：

1. Inspector range 取得 `point=30`、`input=30`，可见标签为
   `点1/2 · 0.0s · 高 30.0m`。
2. 选中机位点经真实 canvas 拾取与 Alt 拖动，上界为 `30m`、下界为 `0.2m`。
3. timeline 复制 legacy `47m` camera key 后粘贴：新点 `30m`、源点仍 `47m`、点数
   `2→3`，可见状态为 `已粘贴 1 个关键帧。`。
4. line/custom `15→30m`：真实播放推进至 `0.4834s / 16.81275m`；按整场景偏移点击
   timeline 得到 `1.9960s / 22.4851m`（像素点击误差范围内等价于 2.0s / 22.5m）；
   下一机位点按钮预览的 point、shot camera 与选中点均为 `30m`。

### PNG 取证

- 原始 capture：`2880×1800`，`775223` bytes，SHA-256
  `423b10a517e68b442f111bcf80f3003bed47bd05fb0886cae8abd25929527300`
  （仅保存在临时 QA 目录，不提交）。
- 发布 PNG：`1440×900`，`587125` bytes，SHA-256
  `1a9fa070aba1889d79083e05009573005d2b74d3bfb6098e7e3153c0c1d13b32`。
- 规范化：DPR 2 原始图使用 Electron `nativeImage.resize({width:1440,height:900,quality:'best'})`
  等比缩小；未裁切、未重绘产品区域。截图中的 QA overlay 只显示已从运行时观测并通过断言的
  四项数值，明确标记 `NOT INTEGRATED`。

## 结论与残余风险

- 本任务分支的新 authoring 写入统一限制为 0.2–30m，历史有限 `>30m` 项目数据继续无损载入；
  project schema 保持 v5。
- 自动测试与新 BrowserWindow QA 均支持冻结产品语义；固定 App 仍不包含本任务。
- 第一轮独立 R2 已因一个 P2 总结 FAIL；该 P2 已返修，但仍须固定 02 组织全新独立 R2。
  00 中央集成/最终回归也尚未开始。本记录不构成自审结论。
- 本任务没有运行 `app:deliver`，没有修改 `~/Applications/PreVision.app`，也没有 push、PR、
  GitHub/Pages 或发布操作。

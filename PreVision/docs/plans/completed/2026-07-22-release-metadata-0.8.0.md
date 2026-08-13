# 任务：04.10 v0.8.0 桌面发行元数据同步

- 状态：completed
- 日期：2026-07-22
- 对话：canonical thread 已核对（去敏）
- 分支：`chore/04.10-release-metadata-0.8.0`
- 基线：`ce4b51e896c1af77f111a1d381bf89fe7e567f66`
- 固定 App 来源：预检时为 0.7.2；本任务不安装、打开或替换 `~/Applications/PreVision.app`
- 负责人：04 临时工

## 并行任务声明

- 任务 ID：04.10-release-metadata-0.8.0
- 模式：write
- 分管 owner：04
- 模块：release
- UI 表面：无
- 数据区域：build-provenance、local-install
- 预计修改文件：`package.json`、`package-lock.json`、本验收单；closeout 时仅可移动本验收单并追加 completed README。
- reservation：已由同一 canonical reservation 转换为 active claim；token 未写入仓库。
- 协调登记：schema v3；claim 已持久化。
- 权威生命周期：ACTIVE（00 加速裁决后重开证据收口）
- 当前 actor / 下一责任人：worker:04.10-release-metadata-0.8.0 / 独立 reviewer
- 侧栏去重证据：canonical thread/client 已核对并去敏。
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present。
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background。
- 执行可见性：BACKGROUND_ONLY（后台施工）
- Desktop live 证据：不适用；不得宣称 Desktop live。
- `task:claim --reservation`：已从 reservation 转换。
- turn stop verification：未完成。
- REVIEW commit list：未冻结。
- 机械 closeout：仅在独立 reviewer PASS 后执行。
- `task:release`：未释放；仅 00 可执行。

## 目标与边界

将发行版本的唯一源 `package.json.version` 及 lockfile 的根版本、`packages[""].version` 从 0.7.2 同步为 0.8.0，并用一次隔离 macOS arm64 Forge package 验证成品 `CFBundleShortVersionString` 与 `CFBundleVersion` 均为 0.8.0。

不修改依赖、Forge 配置、产品代码、网页 SVG、双语资源、`Info.plist` 源文件或固定 App；不运行 `app:update`、`app:deliver`、签名、公证、联网或发布。

## 证据与风险

- 基线：HEAD 精确为 `ce4b51e896c1af77f111a1d381bf89fe7e567f66`，预修改工作树 clean。
- 版本链：`forge.config.cjs` 未设置 `appVersion`、`buildVersion` 或 `extendInfo` 覆盖，故 package manifest version 是 Forge/Packager 的版本源；若构建观察不符则停止并升级。
- 固定 App：预检 `app:status` 在未安装依赖时无法加载 `@electron/asar`；Node 24 离线安装后将复核，绝不更新该 App。
- 风险档：R2（打包发行元数据与本地安装来源相邻，但没有安装动作）。
- 独立只读 reviewer：待派发；任何 P0–P2 阻塞问题将停止 closeout。
- 回退：将三处版本字段恢复为 0.7.2；不重写历史。
- 临时产物：Forge 只写入本任务创建的 `mktemp` 目录，成功包先保留供 reviewer 只读核验；reviewer 完成后把成功包与先前 CLI 失败的空目录精确移入废纸篓。仓库不得出现 `out/`、`dist/` 或临时产物。

## 验收与测试矩阵

- [x] 三处版本值均为 0.8.0，lockfile 无其他漂移。
- [x] 最终加速合同不以 `test:impact` 为门禁：早期命令曾启动并在回传中断前执行 desktop、进入映射的 foundation/web；00 后续裁决明确不重复运行，作为非门禁诊断记录。
- [x] `npm run test:desktop` 通过。
- [x] Node 24 隔离 Forge package 成功，成品两个 Info.plist 字段均严格为 0.8.0。
- [x] 首页 SVG 及 zh-CN/en-US opening alt 的 0.8.0 值经只读精确检查。
- [x] `git diff --check`、精确范围、固定 App 来源未变。
- [ ] 独立只读 reviewer PASS；最终合同无 P0–P2。
- [ ] 用户可见固定 App 交付：不适用，本任务不得执行 `app:deliver`。

## 实施记录

- Node 24.14.0 通过 `npm ci --offline` 安装本 Worktree 依赖，未使用系统 Node 26，未联网。
- 仅修改 manifest 与 lockfile 的三处版本字段：0.7.2 → 0.8.0；Git diff 为 3 行新增、3 行删除，未漂移依赖。
- Forge 7.11.2 CLI 的 `--out` 选项在开始打包前被拒绝；按同一任务的续作指令，改用 `@electron-forge/core` 的 `api.package({ dir, platform, arch, outDir, interactive })` 一次实际隔离打包，完成且保留成功产物供 reviewer 只读核验。
- 成功包的 `CFBundleShortVersionString=0.8.0`、`CFBundleVersion=0.8.0`。临时目录只在本地交接中去敏记录，不写入仓库。
- `test:desktop`：47 通过、0 失败。早期 impact 命令识别 `foundation, build-config` 并启动 desktop/foundation/web，但最终回传未到达；00 最终加速裁决已将其降为非门禁诊断并禁止重复运行。
- `app:status`：固定 App 来源仍为 `7ff9aa5…`（0.7.2）；当前任务提交尚未创建，包含 installed source、但非 exact source。仓库 `out/`、`dist/` 均不存在。

## 交接

- 最终提交：待定
- PR：无（无 remote）
- reviewer 结论：未评审
- 生命周期交接：REVIEW，然后 HANDED_OFF（保持 claim）

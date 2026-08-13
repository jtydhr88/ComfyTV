# 任务：Windows Chrome/Edge 真机压力验证

- 状态：completed
- outcome：cancelled/superseded by final-candidate Windows matrix
- 日期：2026-07-15
- 对话：04.2｜Windows Chrome/Edge 真机压测
- 分支：`test/windows-web-stress`
- 基线：`dcde6f0602c902f8f831ab4e340095d75ae6811e`
- 固定 App 来源：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`；当前基线已包含该来源
- 负责人：Codex 04.2

## 并行任务声明

- 任务 ID：`04.2-windows-web-stress`
- 模式：write
- 模块：`testing,repository`
- UI 表面：无
- 数据区域：无
- 预计修改文件：`docs/WEB_PERFORMANCE.md`、`docs/CURRENT_STATE.md`、`docs/KNOWN_ISSUES.md`、`docs/TEST_STRATEGY.md`、`qa/web-stress-matrix.json`、`qa/test-impact-map.yaml`、`docs/qa/web-cross-platform-stress/**`、本验收单及完成归档索引
- `task:check` 结果：无硬冲突；与 `03.web-landing-design` 仅在 `qa/test-impact-map.yaml` 存在文件软冲突，本任务最终未修改该文件
- `task:claim`：已登记
- `task:release`：待本次归档提交后释放

## 用户问题

在已授权的局域网 Windows 真机上，使用真实 Chrome 和 Edge 各执行至少三次全新冷会话的 PreVision Web 固定压力矩阵，形成去敏且可重复的平台证据。

## 目标

- 优先通过 Negotiate/受限 WinRM 和必要的 SMB 传输安全接入 `WORKGROUP/AI-STATION-01`，不在 HTTP Basic 中传送密码。
- 在 Windows 内确认 `process.platform=win32`、Node 20–24、Chrome、Edge、GPU/WebGL 和有效登录用户会话。
- Chrome 与 Edge 各执行至少三次 standard 全新冷会话，覆盖固定 9 场景，记录 Windows Working Set 及其他必需指标。
- 完成远端和本机清理，只提交不含凭据、主机名、用户名、绝对路径、PID、profile 或项目/媒体内容的证据。

## 非目标

- 不修改 PreVision 业务行为、`03` 页面、layout、i18n 或 app-shell。
- 不部署公网、不连接付费服务、不更新固定 App、不运行 `app:deliver`。
- 不用 CI、macOS、headless 或模拟指标代替 Windows 真机。
- 不开放无来源限制的 DevTools/CDP TCP 端口，不擅自大规模安装软件。

## 证据与现状

- 代码：现有 `npm run web:stress` 已支持 Windows Chrome/Edge、有界面 CDP pipe、临时 profile 和 Working Set 采样。
- Git：HEAD 精确为用户指定集成基线 `dcde6f0`；工作区初始干净。
- 测试/运行：macOS Chrome standard 已有一轮证据；Windows Chrome/Edge 原状态为 `not_run`。
- 网络：`192.168.1.22` 可达；445/5985 开放，5985 声明 Negotiate/Basic；22/3389/5986/9222/9223 关闭。

## 影响范围

- 模块：`testing`、`repository`
- 文件：压测去敏证据、性能/当前状态/已知问题文档、QA 矩阵与验收归档；如无必要不改工装代码。
- 数据格式：无业务数据变化；只写严格 schema 的去敏测试 JSON。
- 平台：Windows 10/11 真机 Chrome/Edge；macOS 仅用于调度与本地回归。

## 风险

- 数据：不读取普通浏览器 profile 或用户项目；只用合成数据与临时 profile。
- UI/交互：压测会在 Windows 当前登录用户会话中短暂打开真实浏览器窗口。
- 安全：禁止 HTTP Basic 传密、禁止无约束 CDP；远端命令、文件、临时任务和防火墙规则必须可定向清理。
- 发布：纯测试/证据任务，不产生对外发行包或更新固定 App。

## 验收条件

> 取消说明：以下 Windows 最终矩阵条件未勾选。总协调确认上线候选版前还将修改主 HTML 的项目输入安全、Three.js 资源释放、Web 存储保护/提示与旧成果救援；继续对 `e256a36` 执行 3+3 会话只会产生过期证据，因此本任务被最终候选矩阵任务取代。

- [ ] Windows 内已确认真实平台、Node 20–24、Chrome、Edge、GPU/WebGL 与交互式登录会话。
- [ ] Chrome 与 Edge 各至少三次全新 standard 冷会话，每轮固定 9 场景完成且证据 schema/去敏校验通过。
- [ ] 记录首载、FPS/长帧、JS heap（可用时）、Windows Working Set、WebGL、崩溃/context lost 和资源增长，并明确与 macOS RSS 的口径差异。
- [ ] 远端与本地临时 profile、任务、预览服务、规则、文件和构建产物已清理，无遗留 CDP 监听。
- [ ] Node 20–24 的 `test:web`、`test:foundation`、`test:i18n` 和 `test:full` 通过。
- [ ] 用户可见任务已执行 `npm run app:deliver`，并从固定 App 看到本次变化；不适用，本任务严禁更新固定 App。
- [ ] 验收单、性能报告和必要的 QA/状态登记已更新；产品缺陷只诊断/登记，未顺手修改业务。

## 测试计划

- 影响映射模块：`web-stress`、`foundation`
- 主应用模块参数：无
- 最小命令：Node 24 `npm run test:web`、`npm run test:foundation`、`npm run test:i18n`
- 升级到全量的条件：本任务交接前固定执行 `npm run test:full`。
- 人工检查尺寸/步骤：Windows 真实有界面 1440×900 Chrome/Edge，每浏览器三次全新会话。
- 固定 App 交付：不适用；纯测试/证据任务，禁止运行 `app:deliver`。

## 实施记录

- 假设：仅在安全认证与当前 Windows 交互会话均可用时执行真机压测。
- 关键决定：优先 Negotiate/受限 WinRM；SMB 只用于必要的受控文件传输；不开放 DevTools TCP。
- 实际修改：完成 Windows 安全接入与环境审计；使用去敏只读脚本确认 `win32`、Windows x64、交互式 Explorer 会话、Chrome 150、Edge 150、Intel Graphics 与 RTX 5090。初次诊断证据暴露 CDP GPU 分类把混合显卡列表中的 SwiftShader 回退设备误判为当前软件渲染；工装现优先使用实际 `glRenderer`，缺失时只有全部设备均为软件设备才判软件渲染，并增加混合 GPU/实际 SwiftShader/纯软件回退三组回归。使用修正后工装重跑 macOS Chrome standard，恢复当前 harness hash 的严格证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status` | 通过 | <1s | installed source `7ff9aa5`；当前基线 contains=yes、exact=no。 |
| Windows 去敏环境审计 | 通过 | <1 min | `process.platform=win32`；Node 原未安装，以官方 SHA-256 校验的 portable Node 24.14.0 临时运行；Chrome/Edge 150；Intel + RTX 5090；交互会话有效。 |
| Windows 旧 harness 诊断 3+3 | 仅诊断 | 约 15 min | 每轮 9/9、0 crash、0 context lost、cleanup passed；但混合 GPU 被误判 `software-rendering-detected`，证据未入库且不计入最终矩阵。 |
| 修正后 macOS Chrome standard | 通过 | 146s | 9/9，`matrixEvidenceEligible=true`，0 crash，0 context lost，cleanup passed；已刷新严格 harness identity 证据。 |
| Node 24 `npm run test:web` | 通过 | 2s 内 | Web runtime 9/9，压力工装 13/13；含新增混合 GPU 分类回归。 |
| Node 24 `npm run test:foundation` | 通过 | 2s 内 | Foundation 81/81，协调 20/20，i18n 21/21。 |
| Node 24 `npm run test:i18n` | 通过 | <1s | 21/21；本任务未修改用户文案。 |
| Node 24 `npm run test:full` | 通过 | 约 12s | App 562、Web 9+13、Desktop 43、安装 36、交付门禁 13、Foundation 81、协调 20、i18n 21 全通过。 |
| 远端/本地临时产物清理 | 通过 | <5s | `PreVision-Handoff` 中 portable Node/MinGit、测试包、启动器、审计结果与 Finder 元数据已定向删除，剩余项目数 0；本地 `dist/` 与 `/tmp` 分片已清理。 |

固定 App installed source：`7ff9aa583b4e51fb4d888aa1815792b747d275d7`

固定 App 人工启动结果：不适用；本任务不修改或交付固定 App。

## 未覆盖与后续

- 修正后提交 `e256a36` 的 Windows Chrome/Edge 最终 3+3 冷会话六份 JSON 未生成；不得把旧 harness 的误判诊断当作最终证据。
- 未来最终候选矩阵必须基于已集成项目输入安全、Three.js 资源释放、Web 存储保护/提示和旧成果救援的最终候选 commit；Chrome/Edge 各 3 次全新 standard 冷会话，每轮 9/9，实际 `glRenderer`/资格、Working Set、JS heap、FPS/长帧、崩溃/context lost、schema、去敏和清理必须全部通过。
- 不再要求用户对 `e256a36` 运行过期矩阵，避免重复消耗时间与算力。

## 交接

- 可集成提交：`984698670f7581fd85be64d7f2cef1220a50a83f`（混合 GPU 分类与回归）、`e256a36ea93e3d485ac51a7674dd79f57fb15139`（刷新 macOS Chrome 严格证据）。
- PR：无；不连接远程。
- 工作区状态：取消收口后 clean。
- 下一步：由 00 集成上述两个提交；主 HTML 最终候选收口后新建 Windows 矩阵任务，只对最终候选 commit 执行 3+3。

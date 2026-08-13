# PreVision Web 跨平台压力验证

更新：2026-07-16

## 结论先行

原始压力轮只做真浏览器诊断，没有新增录屏时长或普通 2:1 全景尺寸限制。其修复前基线保留在本文中；后续 04.5 资源生命周期修复已经进入当前源码，但固定 App 尚未更新。

- macOS Chrome 的标准矩阵全部执行成功：4096×2048 全景、播放、PNG 截图、2 秒录屏和 Seedance ZIP 都生成成功，观察期间没有崩溃或 WebGL context lost。
- 修复前，场景反复切换出现显著的 Three.js 资源计数、JS heap 与浏览器进程树 RSS 增长。40 次切换后 geometry 从 537 增到 17,216，texture 从 30 增到 990，RSS 增加 801,980,416 B；随后 120 秒长会话结束时 geometry 达 41,750，texture 达 2,406，JS heap 增加 161,546,059 B，RSS 增加 492,208,128 B。这是资源滞留风险的强信号，但单次 120 秒观察仍不足以证明无界内存泄漏或推导用户上限。
- 当前源码已集成 04.5 的资源 owner/dispose 修复。修复后的正式 Chrome 证据为：40 次切换 geometry `452→451`、texture `27→27`；120 秒 geometry `451→448`、texture `27→27`；短播放 60 FPS、p95 17.7ms，且零 console error/context lost/crash。
- Safari 26.6 已安装，但用户尚未启用 Remote Automation；工装按规则拒绝自动修改该系统设置，因此 Safari 是 `blocked`，不是“已测”。
- 当前未发现可用或已获批的真实 Windows 主机/VM，Windows Chrome/Edge 均为 `not_run/no_real_windows_host`。CI、macOS Edge 和模拟数值不作为替代证据。
- 固定 App installed source 仍为 `7ff9aa5`，没有包含当前源码的 04.5 修复；本文的“已集成”不等于“固定 App 已交付”，也不等于“Web 已公网部署”。

## 执行状态

| 操作系统 | 浏览器 | 状态 | 证据/阻塞 |
| --- | --- | --- | --- |
| macOS 26.6 arm64 | Chrome 150.0.7871.124 | measured | 本机物理硬件声明；真实有界面 Chrome、临时 profile、私有 CDP pipe；最终 standard 9/9 通过。 |
| macOS 26.6 arm64 | Safari 26.6 | blocked | Safari 与 `safaridriver` 已安装，但 WebDriver authorization right 未建立；未执行 `safaridriver --enable`。 |
| Windows 10/11 | Chrome | not_run | 没有真实 Windows 环境或已批准连接。 |
| Windows 10/11 | Edge | not_run | 没有真实 Windows 环境或已批准连接。 |

环境审计见 `docs/qa/web-cross-platform-stress/environment-audit.json`；macOS Chrome 去敏原始指标见 `docs/qa/web-cross-platform-stress/evidence/macos-chrome-standard.json`。“原始”表示未聚合的允许指标样本，不包含项目内容、录屏/截图字节、PID、主机名、用户名、绝对路径或浏览器 profile。

## 固定压力矩阵

`qa/web-stress-matrix.json` 是唯一矩阵契约，顺序执行：

1. 默认场景冷启动与 Navigation/Paint Timing。
2. 24 个合成对象、4 个场景的典型多对象项目。
3. 浏览器内生成并真实解码/上传为 WebGL 纹理的 4096×2048 JPEG 全景。
4. standard 模式下 40 次场景切换。
5. 2 秒短镜头播放及独立 rAF 采样。
6. 真实 `#snap` PNG 截图链路。
7. `recordBlob(2)` 短录屏链路。
8. 真实 `#seedancePack` 首尾帧、录屏和 ZIP 打包链路。
9. 120 秒长会话，每 2 秒切换场景/镜头，观察内存和呈现节拍增长。

这些是测试夹具参数，不是用户项目限制。

## macOS Chrome 修复前标准轮证据

测试对象为基线 `d0c7815d64a7b3458809ff9ccfe6f6b1f76042d8` 的静态 Web 导演台；外窗请求 1440×900，实际页面为 1440×757、DPR 2，主 WebGL canvas 为 1648×812 物理像素。运行使用 Node 24.14.0，证据带 `physical-machine` 操作者声明。本轮是一台本机的单次标准轮，不代表全部设备的 P50/P95。

| 指标 | 结果 |
| --- | ---: |
| HTTP response start | 340 ms |
| DOMContentLoaded | 789 ms |
| load event | 792 ms |
| first contentful paint | 644 ms |
| 闲置屏幕刷新基线 | 60.00 FPS / 16.70 ms |
| 4096×2048 全景 | 解码与纹理上传成功；`MAX_TEXTURE_SIZE=16384` |
| 2 秒播放采样 | 60.00 FPS，p95 17.30 ms，按实测基线估计 missed-vsync 0 |
| PNG 截图 | 375,039 bytes |
| 2 秒录屏 | MP4，1,151,347 bytes |
| Seedance 素材包 | ZIP，2,283,998 bytes |
| 全程采样峰值 | 浏览器进程树 RSS 2,397,274,112 bytes；JS heap 339,825,253 bytes |
| 崩溃 / context lost / console exception | 0 / 0 / 0 |

### 场景切换增长

| 观察区间 | 开始 | 结束 | 增量/变化 |
| --- | ---: | ---: | ---: |
| 40 次快速切换的 renderer geometry | 537 | 17,216 | +16,679 |
| 40 次快速切换的 renderer texture | 30 | 990 | +960 |
| 40 次快速切换的进程树 RSS | 1,366,720,512 B | 2,168,700,928 B | +801,980,416 B；区间峰值 2,169,274,368 B |
| 120 秒/59 循环的 renderer geometry | 17,279 | 41,750 | +24,471 |
| 120 秒/59 循环的 renderer texture | 990 | 2,406 | +1,416 |
| 120 秒/59 循环的 JS heap | 143,665,441 B | 305,211,500 B | +161,546,059 B |
| 120 秒/59 循环的进程树 RSS | 1,814,003,712 B | 2,306,211,840 B | +492,208,128 B；区间峰值 2,397,274,112 B |

120 秒期间平均 58.73 FPS，p95 17.10 ms，p99 17.70 ms，相对实测 16.70 ms 刷新基线估计 152 个 missed-vsync；66 个帧间隔超过 33.3 ms，36 个超过 50 ms，最长帧 83.40 ms。每次场景切换会产生周期性长帧，但本轮未崩溃。

该轮对应修复前代码：当时 `clearStage()` 会从 scene 移除对象，但诊断任务没有改动或证明所有 geometry/material/texture 的释放语义。实测资源计数、JS heap 与进程树 RSS 均呈上升，足以建立独立的“场景切换资源释放”任务；单次观察仍不等于证明无界泄漏。此段作为原始基线保留，不能被修复后数字覆盖。

## 04.5 修复后正式证据

当前集成线包含 `d4bb4be`（场景独占资源释放）、`f0f0572`（共享纹理 owner 生命周期）和 `62e20fe`（去敏证据归档）。同一物理机、同一 Chrome standard 口径的正式结果：

| 观察区间 | geometry | texture | 呈现与稳定性 |
| --- | ---: | ---: | --- |
| 4 场景 × 24 对象，预热后 40 次切换 | `452→451` | `27→27` | 每轮 scene/object identity oracle 通过 |
| 120 秒长会话 | `451→448` | `27→27` | 56.83 FPS、p95 18.0ms；每轮 identity oracle 通过 |
| 2 秒短播放 | — | — | 60.00 FPS、p95 17.7ms |

正式轮还验证 4096×2048 全景 texture ready、PNG/MP4/Seedance ZIP 格式，以及零 console error、exception、WebGL context lost；未观察到 crash/detach。证据位于 `docs/qa/three-resource-lifecycle/`。这些结果证明修复后本轮资源计数不再按原基线线性增长，但仍只覆盖 macOS Chrome 的单机正式轮；Safari/Windows 未验证，固定 App 未交付，Web 未公网部署。

## 指标口径

| 指标 | Chromium | Safari | 跨平台说明 |
| --- | --- | --- | --- |
| 首载 | Navigation/Paint Timing | 同 | 可比较，但需多次冷会话取中位数。 |
| JS heap | `performance.memory` 周期采样 | `unsupported` | Safari 不填 0、不估算。 |
| 浏览器进程内存 | macOS 为本次临时 Chrome 进程树 RSS 之和；Windows 为 Working Set 之和 | `unsupported` | RSS 与 Windows Working Set 不作为完全同口径数值。Safari WebDriver 无法可靠归属 Safari/WebContent/GPU 进程集。 |
| GPU/WebGL | 页面 WebGL 能力 + 去指纹化的 CDP GPU 类别 | 页面 WebGL 能力 | 零依赖工装不声称测得 GPU 利用率或显存。 |
| FPS/掉帧 | rAF 帧间隔 | 同 | 先实测当前屏幕空闲基线；不固定假设 60Hz。Chromium 关闭被遮挡/后台时的自动降频，但仍将 visibility 变化判为无效样本。 |
| 崩溃 | CDP target + 本次根进程 | WebDriver 命令通道 | 未观察到写 `not-observed`，不写成“不可能崩溃”。 |

“峰值”只是固定采样间隔观察到的峰值；“长会话增长”是观察窗口起止差，不单独等价于内存泄漏定性。

## 工装与安全边界

```bash
npm run web:stress:check
npm run web:stress -- --browser chrome --profile standard --attestation physical-machine
npm run web:stress -- --browser edge --profile standard --attestation physical-machine
npm run web:stress -- --browser safari --profile standard --attestation physical-machine
```

- 使用 Node 20–24，浏览器串行、有界面，不使用 `--disable-gpu` 或 headless 冒充真机。Chromium/Edge 显式关闭后台计时、渲染与遮挡窗口降频，该调度策略写入证据；页面 visibility 变化仍使 FPS 样本失效。
- Chromium/Edge 使用仅属于本轮的临时 profile；POSIX 上权限为 `0700`，Windows 上继承当前用户临时目录 ACL。通过私有 CDP pipe 控制，不开放 DevTools TCP。
- 页面只访问 `127.0.0.1`；Chromium/Edge 进程及子进程代理指向未监听回环端口，外部域名解析拒绝，Crashpad 报告关闭且数据库限于临时 profile。本工装未做系统级抓包，因此不把这些控制表述为“已证明零外连尝试”。
- Safari 只使用 WebDriver 隔离会话。工装绝不执行 `safaridriver --enable`，不代替用户修改系统授权。
- 只生成合成项目和全景，不读取现有项目、不读取普通浏览器 profile、不上传数据、不调用 AI。
- `dl()` 在页面主世界中被临时截获，仅记录类型/MIME/字节数，不落盘截图、视频、ZIP 或项目数据；Chromium 另使用 download deny 兜底。
- `SIGINT`/`SIGTERM`/`SIGHUP` 触发幂等清理；页面计时器、媒体轨、本次浏览器、预览服务、profile 和唯一构建目录全部清理后才写证据。任一清理失败会令 verdict 失败。
- `--attestation` 必须由执行者显式选择；默认 `unattested` 只产生诊断结果，不计入跨平台矩阵。只有本机物理硬件，或 Windows 上明确批准的 3D GPU VM，可获得对应资格。CI、浏览器模拟和 macOS 冒充 Windows 不计入。
- Windows 进程内存采样使用 PowerShell/CIM 完整进程表，有效间隔不快于 2 秒，且证据会标注该采样开销；不与 macOS 500 ms RSS 样本当作完全同口径。

## 解除阻塞的最小用户动作

### Safari

用户亲自在系统提示中完成授权：

```bash
/usr/bin/safaridriver --enable
```

也可在 Safari 开发菜单中开启 Allow Remote Automation。不要在聊天中发送管理员密码。启用后重新运行 `web:stress:check` 和 Safari standard 矩阵。

### Windows Chrome/Edge

二选一：

1. 准备开启 3D 加速的真实 Windows 10/11 主机或 Windows 11 ARM VM，安装 Node 20–24 和 Chrome（Edge 使用系统安装版），让该任务 Worktree 可在 Windows 内读取。
2. 明确授权一台已运行的真实 Windows 10/11 主机和连接方式；凭据由用户在系统客户端中自行输入，不写入仓库或聊天。

必须在 Windows 内确认 `process.platform === "win32"`，然后在该系统本地运行回环预览和 Chrome/Edge 临时 profile 工装。Windows Working Set 指标不写成 POSIX RSS。

## 后续决策点

1. 用同一工装补齐 Safari、Windows Chrome 和 Windows Edge，每种浏览器最少三次全新冷会话后再建立跨平台阈值。
2. 固定 App 后续由 00 在用户可见集成交付时统一更新；更新前继续把 installed `7ff9aa5` 与当前源码分开描述。
3. 必要时增加更长 soak 和多机重复轮，继续观察内存趋势与切换长帧；不得把测试时长转成用户录屏时长限制。

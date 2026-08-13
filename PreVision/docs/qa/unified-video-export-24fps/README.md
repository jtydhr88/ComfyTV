# 普通视频与白模导出统一 24fps 证据

日期：2026-08-03

任务：`02.14-unified-video-export-24fps`

状态：首轮独立 R2 因普通 WebM 回退被禁用而 FAIL；同一 canonical worker/claim 已完成最小返修与定向验证，等待同一 reviewer 复审

## 结论

- 底部“导出当前镜（视频）”、“导出本场景（视频）”、普通 Seedance 参考视频与 Seedance 2.5 白模参考包现在共用同一导出权威 FPS=24。
- 顶部摄影机录屏与工作区录屏继续使用独立的 30fps 手动录制语义；`captureStream(30)` 和 `1000/30` 原样保留。
- 普通当前镜/本场景保留既有 `MP4/H.264 → WebM` 容器回退顺序。MP4 在保存前从最终 ISO-BMFF 字节重读 H.264 sample 数、时长和 fps；WebM 从最终 EBML 字节重读视频轨、Block sample 数、TimecodeScale、逐 sample 时间码与时长。两条路径的 wrong-fps、drop/extra sample 或最终 24fps 不匹配都不保存。
- Seedance 2.5 白模仍为 H.264/MP4-only；普通 WebM 回退不会进入或放宽白模严格合同。
- 5 秒白模计划为 120 个半开样本，时间戳从 0 到 `5-1/24`；严格媒体验证要求最终 MP4 为精确 120 samples / 24fps，并保留既有一帧时钟容差。

## 真实 Chrome 媒体探针

使用 macOS Google Chrome 150.0.0.0、本任务分支的临时 loopback Web 构建、隔离 profile 和 0.5 秒当前镜。页面实际内容区为 1512×808 CSS px，外框 1512×895，DPR=2。

| 产物 | 严格项目 inspector | ffprobe 8.1.2 | SHA-256 |
| --- | --- | --- | --- |
| 当前镜普通 MP4 | H.264，13 samples，24fps，0.541667s | `avc1` 1920×1080，13 packets，`24/1`，0.541667s | `c0a9e595fe14edbc596f12213deffa40e04ada3f02dbb39d8ddc05426a202db4` |
| 白模包内 MP4 | H.264，12 samples，24fps，0.5s | `avc1` 1920×1080，12 packets，`24/1`，0.500000s | `aa2dcf879604da4037655fe75424b5adb196d76b8a14bf70d1f65f83f8c0d37a` |

普通 0.5 秒导出保留既有包含终点的采样语义，因此是 `round(0.5*24)+1=13` 个 sample，媒体时长为 13/24 秒；白模是半开计划，因此为 12 个 sample / 0.5 秒。这是冻结合同中要求保留的两种采样语义，不是帧数漂移。

白模 MediaRecorder 原始容器为 12 samples / 0.572667s / 20.954598fps；既有安全 normalizer 在 sample 数精确等于 12 时将容器时间轴归一为 12 / 0.5 / 24，然后 inspector 从最终字节重读严格放行。capture ledger 为 planned/rendered/requested=12/12/12，primer=1，`startSource=listener-after-primer`。生成阶段下载数仍为 0，第二次显式点击后才下载 96,278-byte ZIP（SHA-256 `fabc6b12ede2766fce6f6c9037a1194b05af05e82790b1f6db8e7fd821a0dfb4`）。

普通视频的产品导出返回成功，严格 inspector 元数据为 13/24；但该隔离 Chrome 自动化会话没有观察到异步 anchor 自动下载事件。ffprobe 文件是从同一次真实导出的最终 Blob 以临时探针只读提取，不写回项目。因此本证据只证明真实编码字节和严格媒体合同，不冒充普通 Web 自动下载已完成。

## 隔离 Electron 预览

- 标题：`PreVision 02.14 Preview — NOT INTEGRATED`
- 来源：当前任务 Worktree 的生成 HTML
- 实际内容区：1512×862 CSS px
- 外框：1512×894，DPR=2
- 状态：进程保持运行；未更新固定 App、稳定预览指针、GitHub 或 Pages

## 自动验证与限制

- Node 24.18.0：capture 162/162，C7 114/114，C5 41/41，i18n 217/217；build 和 `git diff --check` 通过。
- C7 直接从 ISO-BMFF 字节验证 5 秒白模 120/24，并对 wrong-fps、118-frame drop、121-frame extra 等错误闭合路径做 fail-closed 断言。
- capture 冒烟对当前镜与本场景的最终 MP4 字节分别执行 24fps/sample-count 探针；另模拟 MP4 全部不可用而 WebM/VP9 可用，分别证明当前镜、本场景保存有效 24fps WebM，并对 wrong-fps、drop、extra WebM 证明零保存。成功/取消/错误继续覆盖 capture 恢复与 project/history/autosave 零写。
- 同一执行级回归确认顶部手动录制常量和工作区 `captureStream` 仍为 30fps。
- 真实 Chrome 只做了 0.5 秒当前镜普通 MP4 与 0.5 秒当前镜白模。R2 返修明确禁止 UI/Electron/Chrome，因此没有补造真实 WebM 浏览器探针；真实 WebM、本场景长媒体、长录制、Safari/Windows、R2 复审、中央集成和固定 App 最终回归尚未执行。
- 本轮按合同未运行 impact/full，未调用付费 Seedance 或上传素材。

结构化数值见 [evidence.json](evidence.json)。

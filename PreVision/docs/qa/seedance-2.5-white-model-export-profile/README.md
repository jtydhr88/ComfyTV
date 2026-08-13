# 02.13｜Seedance 2.5 白模参考包 QA

状态：修复后真实 Desktop UI 已到达 `ready-for-download`；未点击下载、未观察到落盘 ZIP。实现证据等待原两路 reviewer 聚焦 round2，未集成、未更新固定 App。

## 预览事实

- 来源：`feat/02.13-seedance-2.5-white-model-export-profile`，精确基线 `17a70c379db4c0d6a37fb51ef5ba7ee496c85bc4`。
- 窗口标题：`PreVision 02.13 Preview — NOT INTEGRATED`。
- Electron 使用独立临时 profile 启动；预览只载入本 Worktree 生成的 `预见PreVision.html`，未改 Electron main/preload，也未触碰固定 App。
- 当前 `electron-1440x900.png` 文件名沿用原证据名，但本轮隔离环境实际内容视口为 1440×861、DPR 2，PNG 实际为 2880×1722；不把它称为 1440×900 证据。需要能提供 900 CSS 高度的桌面环境后重取主尺寸截图。
- 1316×768 内容视口实测 `documentElement` client/scroll 均为 1316；390×844 实测均为 390。Seedance 区域 client/scroll 分别为 302/302、359/359，无横向溢出。

## 已验证

- 白模覆盖只包住一次同步 `renderer.render`；真实 Chromium/WebGL 探针比较全部 mesh 的 material identity、color、map、visible 与 scene background/fog，单帧前后精确一致。
- 中性浅灰 clay 保留轮廓和接触阴影，隐藏 grid、标签、控制器、gizmo、选中辅助与 UI；证据含真实 1920×1080 和 1080×1920 渲染帧。
- planner 统一驱动 clip、逐帧实际 `updateShotCam`/`updateActors` 采样、timestamp script 与 manifest；边界、续写分组、Follow/offset、暂停/播放/drag/scrub、v1–v5 均有执行级断言。
- 每镜一 clip、单镜最长 29.5s；超限和空镜头表在首个编码帧前拒绝。场景总长超过 30s 只生成确定性 continuation group，不截断视频。
- manifest 从实际 stored ZIP 条目反算 filename、MIME、bytes、SHA-256、segment、fps、resolution、aspect、scene/shot 与上传顺序，并拒绝篡改、重复、额外或错序条目。
- success、取消、render/encoder/ZIP 异常、迟到 `onstop` 与连续 A/B transaction 均通过隔离断言；每轮 project、stageToData、history、autosave 与起点一致，普通导出不串白。
- 真实 GUI 复核确认白模 profile、当前镜头/本场景范围、用途说明、阶段状态、双语/a11y；空闲态不显示取消按钮，成功文案不称上传。
- 修复后真实 Desktop UI 生成：单镜 5 秒/150 帧成功进入 `ready-for-download`，严格 planned↔actual 媒体门禁通过；诊断摘要 61,643 bytes，SHA-256 `1be1afb8f4534c4cb276d7bfd547b5d59e46f601bda05fd9df25564d81be4437`，zero-write 对 project/stage/history/dirty/localStorage/material/pending transaction 全部 PASS，autosave/localStorage 写计数均为 0。本轮严格未点击下载，无 `will-download`/`download-done`，无落盘 ZIP。

## 定向门禁

下表保留任务累计历史结果；本轮 R2 返修仅重跑 C7、capture、C5、i18n、build 与 `git diff --check`，未运行 foundation/impact/full。

| 命令 | 结果 |
| --- | --- |
| `node 测试/回归/C7_seedance_white_model_profile.mjs` | 87/87 |
| `node 测试/回归/C5_seedance_package.mjs` | 41/41 |
| `node 测试/回归/U6_reframe_math.mjs` | 17/17 |
| `npm run test:module -- capture` | 155/155 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 52/52 |
| `node 测试/回归/P8_module_boundaries.mjs` | 41/41 |
| `npm run test:module -- actor` | 177/177 |
| `npm run test:module -- project` | 121/121 |
| `npm run test:module -- history` | 29/29 |
| `npm run test:module -- camera` | 106/106 |
| `npm run test:module -- playback` | 42/42 |
| `npm run test:module -- timeline` | 209/209 |
| `npm run test:module -- layout` | 160/160 |
| `npm run test:i18n` | 217/217 |
| `node 测试/仓库基础测试.mjs` | 151/151 |
| `npm run build` | 通过，单文件 1,368,637 bytes |
| `git diff --check` | 通过 |

`U4_normalize_malformed.mjs` 为 112/114；仅失败两项既有 02.7 镜头时长合同，本任务新增 C7 与白模断言全绿，不把既有失败当作本任务豁免。按快速 NOT INTEGRATED 合同未运行 `test:impact` 或 `test:full`。

## 证据文件

- `electron-1440x900.png`：文件名保留，实际 CSS 1440×861 / DPR 2 / PNG 2880×1722 的隔离 Electron 主界面。
- `white-model-16x9.png`：真实 renderer 输出 1920×1080。
- `white-model-9x16.png`：真实 renderer 输出 1080×1920。
- `evidence.json`：尺寸、哈希、恢复探针、布局与测试的机器可读记录。

## 明确缺口

- 浏览器下载链沿用当前 C5；为保留真实用户激活，生成与下载分为两次明确点击。Electron 的浏览器下载会显示系统默认保存面板；本应用不提供 Finder 路径选择、Electron chooser、原子替换或 electron-ipc。
- 3,039,069-byte / SHA-256 `d7bdccb2cb708f09cb22c00a6c791ad71c2c7a0e8261dfda16bbceb5c5b58b3a` 旧 ZIP 是媒体门禁之前的已作废反例，不是修复后成功证据。它的实际帧数为 148/120/119/104，planner 为 151/121/121/106；四镜全部 `SEEDANCE_MEDIA_MISMATCH`。
- 修复后真机 H.264/MP4 生成与严格媒体校验已通过，但本轮仅证明 pending 包已达 `ready-for-download`；尚缺修复后第二次真实点击、`download-done=completed` 与落盘 ZIP 重验。无 MP4/H264、不可解析 H.264/avc1、sample-description 索引不指向唯一 avc1，或 actual/planned 不一致时均 fail closed。
- 仍需实现者之外的独立 R2，以及 00 的中央集成和最终回归；固定 App 未更新。

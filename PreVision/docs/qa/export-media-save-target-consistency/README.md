# 导出媒体保存位置一致性 QA

## 验证对象

- 任务：`04.18-export-media-save-target-consistency`
- 基线：`25cfb350af1321c80d99910705f4bc4f41bd196b`
- 分支：`fix/04.18-export-media-save-target-consistency`
- Node：`v24.18.0`
- 阶段：快速预览，`NOT INTEGRATED`

## 自动化合同

`测试/冒烟测试.mjs` 对右下导出入口增加以下回归：

| 场景 | 断言 |
| --- | --- |
| 当前帧 PNG 取消 | 目标选择先于渲染；零保存、零 project/history/autosave/busy 副作用 |
| 当前镜对话框失败 | 零编码、零冻结、零保存；只反馈一次并清除 pending |
| 本场景取消 | 零编码、零冻结、零保存；完整恢复状态 |
| PNG 成功 | 目标选择后才渲染；非空字节只经一次性 token 写入；显示真实路径 |
| 非法/过期 token | 明确失败，不回退固定 export 目录 |
| 当前镜成功 | 沿用既有编码链，只替换最终 token 写入；显示真实路径 |
| 本场景成功 | 沿用既有逐镜编码链，只替换最终 token 写入；显示真实路径 |
| 编码失败 | 不写目标、不回退固定目录；恢复 project/history/autosave/busy |

Electron 主进程既有桌面壳回归继续覆盖 token 的 renderer/type 绑定、重复使用、非法值、写入失败消费，以及 12 小时过期。

## 自动化结果

| 命令 | 结果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:module -- capture` | PASS，150/150 |
| `npm run test:desktop` | PASS，47/47 |
| `npm run test:i18n` | PASS，217/217 |
| `npm run test:core` | PASS，19/19 |
| `git diff --check` | PASS |

未运行 `test:full`、`app:deliver`；未更新最新预览指针或固定 App。

## 真实 Electron UI

- 独立临时应用与独立 profile 启动，窗口标题精确为 `PreVision 04.18 Preview — NOT INTEGRATED`。
- 真实点击“导出当前镜（视频）”“导出本场景（视频）”“截帧 PNG”。
- 三个入口都先显示原生保存位置选择器；分别取消后回到“就绪”，未进入录制 busy。
- 三个入口随后分别成功保存到隔离临时目录：
  - `PreVision_S1C1_frame.png`：有效 1920×1080 RGBA PNG，403247 bytes。
  - `PreVision_S1C1_previz_1920x1080.mp4`：有效 ISO MP4，2794913 bytes。
  - `PreVision_S1_full_previz.mp4`：有效 ISO MP4，8308450 bytes。
- 每次成功后，底部状态都显示既有 `export.saved` 文案及对应真实保存路径。
- 固定 App 来源仍为 `b8da5f4f36a40010541700171cb246f2ca9de17b`，本轮未启动或修改固定 App。

## 边界

- 顶部摄影机/工作区截图与录屏流程未改。
- 浏览器回退仍使用原有 `dl()`。
- JSON、ZIP 与其他下载入口未全局改写。
- 未新增 language key，路径反馈复用既有 `export.saved`，失败复用既有失败 key。
- 当前证据仅代表任务 Worktree 的隔离预览，不代表已集成、已安装或已发布。

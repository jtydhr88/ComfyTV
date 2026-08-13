# 02.9｜9:16 当前镜头独立重构图 QA

状态：任务级实现与定向自动验证完成；真实隔离预览已启动，未集成、未更新固定 App。

## 预览事实

- 来源：当前 `feat/02.9-shot-reframe-9x16` Worktree。
- 窗口标题：`PreVision 02.9 Preview — NOT INTEGRATED`。
- 运行：Electron 43.1.0 使用独立临时 profile 启动，进程在交接时保持存活。
- P1 刷新探针：页面 URL 指向 fa14；画幅为 9:16、右栏为 expanded、右侧入口可见，按钮 317px / 内容区 335px，`rightTop` 无横向溢出。
- 固定 App：未运行 `app:deliver`，`~/Applications/PreVision.app` 未改变。

## 已验证

- Leo 真实截图发现 toolbar 入口在属性与监视器展开布局中不可发现后，P1 返修在右侧 monitor 与播放控制之间增加了全宽同命令入口；9:16 显示、16:9 隐藏。
- 右侧与 toolbar 入口共用唯一 `reframeEditMode` 和 toggle router，`aria-pressed` 同步；右侧点击一步进入后聚焦主画布，不改变用户右栏布局。
- 右侧按钮使用 `width/max-width:100%`、`min-width:0`、内容裁切与省略，layout 断言覆盖无横向溢出。
- `shot.reframeByAspect['9:16']` 是唯一 canonical 持久字段；identity 不落盘，project 版本仍为 5。
- v1–v5 缺字段按 identity；非法非有限值拒绝；原 camera 数组、路径、FOV 与 times 的序列化字节保持不变。
- 纯共享 helper 对 contain-fit、offset、zoom、viewOffset、viewport/scissor 计算有独立数学断言。
- monitor、Follow/编辑导演台、PNG、当前镜视频、本场景视频均接入同一 resolved reframe。
- pointer move 只改 draft；pointerup/Enter/blur 单次提交 history/autosave；Escape、取消与 gate 拒绝零写；切镜/切场景清草稿。
- 导出 success/cancel/error 与显式 fault injection 覆盖 camera aspect/zoom/viewOffset、renderer viewport/scissor、exportLook 与播放状态恢复。
- capture 模块保持无生产静态 import 的 P8 边界。

## 定向门禁

| 命令 | 结果 |
| --- | --- |
| `node 测试/回归/U6_reframe_math.mjs` | 17/17 |
| `node 测试/回归/C1_previz_roundtrip.mjs` | 52/52 |
| `node 测试/回归/U4_normalize_malformed.mjs` | 114/114 |
| `node 测试/回归/P8_module_boundaries.mjs` | 41/41 |
| `npm run test:module -- project` | 121/121 |
| `npm run test:module -- history` | 29/29 |
| `npm run test:module -- camera` | 106/106 |
| `npm run test:module -- playback` | 41/41 |
| `npm run test:module -- viewport` | P1 返修后 49/49 |
| `npm run test:module -- layout` | P1 返修后 160/160 |
| `npm run test:module -- capture` | 155/155 |
| `npm run test:i18n` | 217/217 |
| `npm run build` | 通过，生成单文件 HTML |
| `git diff --check` | 通过 |

按任务快速预览门禁，未运行 `test:impact` 与 `test:full`。

## 明确缺口

- Leo 已用真实截图证明首版 P1 可发现性缺陷；P1 代码和执行级断言已返修。仍未生成仓库内 `electron-1440x900.png`，也未完成拖动、滚轮、键盘、reset、Follow ON/OFF 的完整真实点击矩阵；这是 P3 人工证据缺口，不伪装为通过。
- 尚未由实现者之外的独立 R2 reviewer 使用独立 landmark/NDC oracle 复核。
- 尚未中央集成、最终回归或正式交付。

# 01.15 播放头与尺规吸附一致性：隔离预览证据

## 证据级别

- 本目录中的 PNG 仅是 **NOT INTEGRATED 隔离 Electron 的静态 UI 呈现证据**。
- 人工原生拖拽未验证，不能把截图、自动 pointer 回归或失败的坐标调用写成真实拖拽 PASS。
- 自动回归已覆盖播放头、尺规、lane 和关键帧的真实 PointerEvent 序列；人工缺口仍交由实现者之外的独立 R2 reviewer 评估。

## 隔离方式

- 窗口标题：`PreVision 01.15 Preview — NOT INTEGRATED`
- 只读 launcher 来源：中央工作树中与本工作树相同版本的 Electron 43.1.0 二进制。
- 运行内容：当前任务工作树的 `electron/main.cjs` 与构建产物。
- 隔离：临时 bundle id、独立 userData/sessionData、临时 bootstrap 与日志；未启动或修改固定 App，也未更新稳定预览指针。
- 结束时仅关闭本任务临时进程；主进程 exit 0，PID 不再存在，临时 clone/profile/bootstrap/log 已全部删除，其他 Electron 实例未操作。

## 实际尺寸

- 可见屏幕 work area：`x=0, y=31, 2560×1409 CSS px`，DPR 2。
- 隔离窗口 bounds：`x=0, y=31, 2560×1409 CSS px`。
- renderer：outer `2560×1409`、inner `2560×1377` CSS px。
- 时间轴尺规：`x=444, y=1056, 1764×25 CSS px`。
- 第一条 lane：`x=444, y=1082, 1764×29 CSS px`。
- 保存截图的实际像素：`1396×768`。文件名中的 `1440x900` 是声明阶段冻结的目标路径，不代表截图实际尺寸。

## 操作与结果

1. 隔离窗口成功加载当前任务工作树，标题精确包含 `PreVision 01.15 Preview — NOT INTEGRATED`，时间轴、红色播放头、尺规、lane 和吸附按钮可见。
2. 首次坐标调用在动作前被 Computer Use 拒绝，提示必须先刷新 app state；未作为 UI 证据。
3. 后续一次坐标调用到达 renderer 并观察到 pointer 事件，但播放头没有形成可验收的目标拖动；该结果无效，未记为 PASS。
4. 窗口只重定位一次，使其完整落入 `2560×1409` 可见 work area。最后一次允许的原生拖拽在动作前再次被 Computer Use 拒绝，错误为：`The user changed '<isolated-temp>/PreVision 01.15 Preview.app'. Re-query the latest state with get_app_state before sending more actions.` 仓库文档按安全规则去除了临时绝对路径。
5. 最后一次失败没有产生可归因的新 pointer 事件。关闭前只读状态为 `tc=00:01.3 / 00:16.5`、status=`位置 · 第 1 段 · 0.00s → 5.00s · 已选 1 个关键帧`、`motionSnap=false`。

因此，人工原生拖拽的 on/off、Option/Alt、guide/status/highlight、拖离、blur、pointercancel 与 lostpointercapture 均标记为 **未验证**。截图产生后，用户真实预览反馈进一步修正了合同：snap OFF 与 Option/Alt 必须连续，且 pointermove 时显示实时读数；本截图早于该返修，只能继续作为静态呈现证据。

## 自动证据

- 精确 baseline 的同一 Node 24 timeline 命令：188 通过 / 1 失败，失败为既有 AutoKey 夹具的 `A·主体.scale 1→0.81`。
- 首轮夹具最小返修后的 Node 24 timeline：192 通过 / 0 失败。
- 用户修正合同后的执行级 RED：192 通过 / 2 失败；播放头 OFF/Option 实际为 `1.4/2.0`，关键帧 OFF/Option 实际为 `1.4/2.0`，且 pointermove 前 status 未显示 1.437/2.043。
- 最小返修后的 Node 24 timeline：194 通过 / 0 失败。
- pointer 回归覆盖：snap ON 时 playhead `1.44→1.5`、ruler `2.04→2.0`、lane `1.46→1.5` 与既有关键帧 0.1s/8px 强吸附；snap OFF / Option 时播放头和关键帧分别保持 `1.437/2.043` 连续值，并在 pointerup 前把三位小数实时写入可见 status；另覆盖 snap→unsnap、blur、pointercancel、lostpointercapture、程序播放 `1.43`、shot-local / scene-global 和 project/history/autosave 零写。
- playback：42 通过 / 0 失败；layout：160 通过 / 0 失败；i18n：217 通过 / 0 失败；build 与 `git diff --check` 通过。

## 文件

- `electron-1440x900.png`：1396×768 的静态 UI 呈现证据；不含用户项目、凭据、绝对路径或固定 App 内容。

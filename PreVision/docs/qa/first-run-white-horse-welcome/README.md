# 首次启动白马欢迎场景 QA

日期：2026-07-15

分支：`feat/first-run-white-horse-welcome`

基线：`204722994e5f9e23050e40ac608a926e6f5fad89`

## 验收结论

- 缺少 `previz_autosave_v3` 时进入 `firstRun`，加载一个普通 project v5：白马有 3 点调度路径，骑手挂载白马，侧向太阳启用，4 镜共 16.5 秒。
- 无操作刷新仍为欢迎项目且不创建 autosave；真实编辑项目名并等待既有 debounce 后会保存，刷新以 `restored` 精确恢复。
- 有效 v5、缺版本和结构兼容的旧版本可恢复并只在内存迁移到 v5；显式未来版本、JSON/必需字段/数值损坏按 `invalid` 处理。
- `window.localStorage` getter 或 `getItem()` 抛错按 `unavailable` 处理。invalid/unavailable 都在内存打开标准双人对话，启动阶段不写 `previz_autosave_v3`；主题/栏位等 UI 偏好不属于该保证。原 raw 是否保持由 VM storage mock 和隔离 Electron 直接断言。
- 实际点击 New Project 并确认后仍建立 `dialogue` 标准项目，不复用欢迎种子。

## 自动证据

- 核心冒烟覆盖 fresh、四态分类、旧版本迁移、未来版本拒绝、坏场景/镜头/演员字段、storage getter 和真实 New Project 点击。
- 项目、演员、摄影机、光影与布局模块分别覆盖项目往返、骑乘/路径、机位、太阳和界面层级。
- `test:i18n` 覆盖中英文 key 对齐和运行时直接中文守卫；`test:web` 覆盖静态构建/回环契约；`test:impact` 与 `test:full` 结果记录在任务验收单。

## Web 人工验证

- 隔离本地 origin，显式 1440×900 视口。
- fresh 显示“一个小彩蛋”、白马骑手、4 镜/16.5 秒、太阳与专业摄影机；主 viewport 含编辑摄影机，monitor 不含编辑辅助模型。
- 无操作刷新、编辑后恢复、损坏数据警告和 New Project 均已实际观察；浏览器证据不声称直接读取 raw 字节，raw/写次数以 VM 与隔离 Electron 为直接证据。
- [雾白日间 1440×900](web-1440x900-light.jpg)

## Electron 人工验证

- Electron 43.1.0，以临时 `--user-data-dir` 启动当前 Worktree；未 package、未安装、未触碰固定 App 或真实用户 autosave。
- 配置外层窗口 1680×1050，实际内容区 1680×1018；仓库截图按当前宿主显示缩放为 1229×768。
- fresh：`startupState=firstRun`、autosave 为 null、欢迎场景 4 镜/16.5 秒；无操作 reload 后保持一致。
- 将项目名真实改为“欢迎场景验收”后出现自动保存状态，reload 得到 `restored` 和精确名称。
- 写入隔离 profile 的损坏 JSON 后 reload：标准 dialogue、损坏警告、原 raw 保持；清空隔离 key 再 reload 回到欢迎场景。
- 实际点击 New Project + 确认后得到 dialogue、A·主体/B/道具和 4 镜。
- [Electron 深色主题实际窗口](electron-actual-dark.jpg)

## 边界

- 未运行 `app:deliver`，固定 App 仍为 0.7.2 来源 `7ff9aa5`。
- 未修改 Web 首页、版本号、网络/IPC 或项目数据版本，也未公网部署。
- 启动结构门禁只保证 boot 不接收会让当前运行时崩溃的 autosave；大小、资源 URL、DOM XSS 与更完整归一化属于后续项目输入安全任务。

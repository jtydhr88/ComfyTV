# 本机 App 与网页入口刷新验收

- 日期：2026-07-14
- 分支：`fix/local-app-web-entry-refresh`
- 平台：macOS Apple Silicon、Electron 43、本机 Chromium
- 目标：确认实际打开的 App 与本地网页均加载当前 B「电影控制台」、C「导演专注」和四主题版本，不再指向旧开发包。

## 根因与修复边界

- 旧入口实际启动桌面旧工作树的开发构建；其包内 HTML SHA-256 为 `1622fe9d905418e0d614380d1d250532d2440c721579eeed5b7b2209b7dbdcb1`，不含主题和导演专注标记。
- 当前工作树 HTML SHA-256 为 `9652d40e727644f5c807e94da616217e9bef6951569f21d7250f3ef1b6e1d01c`。使用 Node 24 重新打包后，构建包、用户 Applications 目录中的稳定 App 和旧点击路径中的替换包均与该哈希一致。
- 独立网页副本同样与当前工作树哈希一致；其引用的品牌图标、`html2canvas` 与许可证文件同步保留，并通过仅绑定 `127.0.0.1` 的本机静态服务访问。
- 本任务没有修改 `预见PreVision.html` 的业务代码、项目 v5、摄影机、时间轴、路径、撤销或自动保存逻辑，也没有删除或替换 Electron 用户数据目录。启动验证只产生正常的 Electron/Chromium 状态写入，用户项目/导出区元数据未见安装后变化。
- 项目仍无公开在线部署；本机回环地址不是可分享的公网发布地址。

## 截图索引

| 截图 | 状态 | 结果 |
| --- | --- | --- |
| [`1316x768-web-graphite.png`](./1316x768-web-graphite.png) | 石墨深海；左右栏展开；时间轴镜头条 | B 主界面、统一图标、主题菜单及主工作区全部可达；页面无水平或垂直溢出。 |
| [`1440x900-web-mist-focus.png`](./1440x900-web-mist-focus.png) | 雾白日间；C 导演专注 | 场景内容和属性面板临时收拢，模式轨保留；退出后恢复进入前基础栏位状态。 |

## 目标尺寸、前后状态与人工步骤

### 安装 App

1. 从用户 Applications 目录启动 `PreVision.app`，确认实际页面 URL 来自该 App 的 `app.asar`，而不是桌面旧工作树。
2. 初始状态确认全局命令栏、左模式轨、场景栏、导演台、右监视器/属性栏、时间轴和四主题按钮存在。
3. 点击「导演专注」：按钮 `aria-pressed` 从 `false` 变为 `true`，场景内容与右属性面板临时收拢。
4. 再次点击退出：`aria-pressed` 恢复 `false`，进入前的左栏、右栏和时间轴基础偏好保持不变。
5. 结果：通过；App 的辅助功能树和实际渲染画面均确认是新版界面，ad-hoc `codesign --verify --deep --strict` 通过。

### 1316×768 本地网页

1. 交互前：石墨深海、左栏 `expanded`、右栏 `expanded`、时间轴 `filmstrip`。
2. 打开主题菜单，确认石墨深海、雾白日间、暮光靛蓝、胶片琥珀四项均存在；切换到雾白日间。
3. 交互后：主题为 `mist`，栏位基础状态不变；`innerWidth/innerHeight` 与 `scrollWidth/scrollHeight` 均为 `1316×768`。
4. 结果：通过；控制台 0 条运行错误。

### 1440×900 本地网页

1. 交互前：雾白日间、左栏 `expanded`、右栏 `expanded`、时间轴 `filmstrip`。
2. 进入 C 导演专注，确认 `director-focus` 生效且按钮 `aria-pressed=true`；基础 `data-left/data-right/data-timeline` 仍为进入前值。
3. 退出专注，确认 `director-focus` 移除、`aria-pressed=false`，三项基础状态仍为 `expanded/expanded/filmstrip`。
4. 交互后：`innerWidth/innerHeight` 与 `scrollWidth/scrollHeight` 均为 `1440×900`。
5. 结果：通过；控制台 0 条运行错误。

## 产物核验

- `npm run package`：生成 macOS arm64 App；包内 HTML 与源码 SHA-256 完全一致。
- `codesign --verify --deep --strict`：构建包与稳定安装包均通过；仍是本地 ad-hoc 签名，不代表 Developer ID 签名或公证。
- `curl` 逐项检查 HTML、品牌图标和 `html2canvas`：均返回 HTTP 200；网页副本与仓库对应静态资源哈希一致。
- 旧开发构建已保留为带原提交标识的备份，没有覆盖用户项目或偏好数据。
- 本地网页入口：`http://127.0.0.1:4174/%E9%A2%84%E8%A7%81PreVision.html`；仅本机可见，并依赖本次启动的回环静态服务。

# 发布流程

本流程适用于 macOS Apple Silicon。当前构建不是正式签名/公证版本，不应对外宣称为正式发行。

## 日常固定本机 App 更新

本机开发只把 `~/Applications/PreVision.app` 作为固定用户入口。首次安装依赖或 lockfile 变化后先在 Node 20–24（推荐 Node 22）执行 `npm ci`。每一个完成的 Bug 修复、新功能、UI/交互和其他用户可见优化都必须进入固定 App；先关闭所有 PreVision 实例并在干净提交上运行：

```bash
npm run app:deliver
```

`app:deliver` 先运行完整回归，再调用底层 `app:update`。更新器会在任何打包动作前拒绝 Node 25/26、脏工作区、detached HEAD，以及不包含当前固定 App 来源提交的兄弟/落后分支；随后写入 commit/branch 构建来源，恢复中断事务并取得同级锁，再显式构建 macOS arm64 包。新包的来源、bundle ID、签名和 `app.asar` 哈希通过后，通过与锁硬链接绑定的恢复工作区更新固定路径，并自动打开固定 App。

该命令只替换固定 App bundle，并在固定入口安装结果再次通过身份与哈希校验后，删除本次生成的 `out/.../PreVision.app`。安装失败会保留构建 App 供诊断；清理失败只报告警告，不回滚已验证的固定入口。命令不扫描删除其他构建目录、用户项目、Application Support 或导出目录。首次整理 Dock 时应移除旧开发包图标，再从 `~/Applications/PreVision.app` 固定正确入口。单独运行 `npm run package` 仍会保留分发构建包。

更新后核对：

```bash
npm run app:status
/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$HOME/Applications/PreVision.app/Contents/Info.plist"
codesign --verify --deep --strict "$HOME/Applications/PreVision.app"
```

## 前置条件

- 发布提交已经通过 PR 或项目所有者的本地审查。
- 工作区干净，分支和提交明确。
- 版本号与 `CHANGELOG.md` 一致。
- 使用 Node 22；不得用 Node 25/26 打包。
- `npm ci` 基于 lockfile 成功。
- 许可证和对外发布权限已经确认。

## 自动验证

```bash
npm run test:full
npm run package
npm run make:mac
npm run make:mac:dmg
```

检查签名和校验：

```bash
codesign --verify --deep --strict out/PreVision-darwin-arm64/PreVision.app
shasum -a 256 out/make/**/*.zip out/make/*.dmg
```

DMG maker 只适用于 macOS，并依赖系统 `/usr/sbin/bless`。

## 真机清单

- 从 `.app` 启动，确认菜单和中文名为“预见”。
- 新建项目、保存、关闭、重新打开。
- 验证自动保存恢复不破坏旧数据版本。
- 在 MacBook 常见窗口和大屏各检查一次布局。
- 展开、缩小、隐藏调度轨道，确认导演台无拉伸。
- 摄影机点和对象点分别快速预览。
- 截取摄影机画面和工作区。
- 各录制 10 秒摄影机画面和工作区，确认红点、停止、文件可播放和范围正确。
- 打开导出目录，确认文件名不覆盖旧文件。
- 从 DMG 拖入应用目录并首次启动。

## 正式签名与公证

在取得 Apple Developer ID 后单独建立签名任务：

- 使用 Developer ID Application 证书。
- 恢复 Hardened Runtime。
- 明确 entitlements，特别是媒体和文件权限。
- 使用 Apple notarization 并 stapling。
- 在无开发环境的新 Mac 用户账户验证 Gatekeeper。

不得把当前 ad-hoc 签名描述为正式签名。

## Git 与 GitHub

1. 只从审查通过的 `main` 提交创建版本 tag。
2. 不强推 tag，不覆盖已有 Release。
3. GitHub 已连接时创建草稿 Release，附 ZIP、DMG、SHA-256、更新日志和已知问题。
4. 项目所有者确认后再发布；开发代理不自动公开 Release。
5. GitHub 未连接时把产物和校验值保留在本地交接，不阻塞其他开发。

## 回退

- 不重写历史。
- 发现问题时从上一个已知良好 tag/commit 创建修复分支。
- 保留失败产物的版本记录，不覆盖用户已有文件。
- 数据格式问题必须先保护用户项目文件，再决定迁移或回滚。

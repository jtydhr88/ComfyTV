# PreVision 静态 Web 运行底座

## 定位

首版 PreVision Web 是离线优先、纯浏览器客户端。当前工程已经在静态 Web 运行底座上接入 `web/home/` 首页开场动画，并在完成后进入同源 `/director/`；它仍不是业务后端：没有账号、数据库、云存储、付费 API、AI 调用或项目上传。公开分享链接未来需要一个静态托管地址，但不需要自建常驻 Node 服务。

本地 Node 预览器只用于在回环地址模拟生产路由、MIME 和安全响应头，不能部署成公网业务服务。

## 固定命令

```bash
npm run web:build
npm run web:preview
npm run test:web
npm run preview:lan:install
npm run preview:lan:status
```

- `web:build` 读取 `web/runtime-contract.json`，确定性生成 `dist/web/`。该目录可删除、不可提交。
- `web:preview` 读取并校验构建清单，默认只监听 `127.0.0.1:4173`。
- `test:web` 只在系统临时目录构建测试夹具，不生成仓库内 `dist/`。
- `preview:lan:*` 是独立用户级 LaunchAgent 控制面；它不改变 `web:preview`、固定 App 或稳定预览 pointer。

`web:build -- --output dist/example` 可指定 `dist/` 下的相对输出目录；源码目录、绝对路径、反斜杠、空段和 `..` 会被拒绝。`web:preview -- --port 0` 可选择临时端口；`--host` 只接受 `127.0.0.1`。

## 固定局域网最新预览

局域网入口与开发回环预览是两个独立安全域：

- `web:preview` 继续只监听 `127.0.0.1:4173`，只接受显式 loopback Host。
- LAN 服务固定使用 `4174`，只绑定当前默认路由的单一 `en*` 物理接口私有 IPv4；不监听 `0.0.0.0`。
- 首选 URL 是 `http://<LocalHostName>.local:4174/`，fallback 是同一接口当前私有 IPv4。当前机器实测为 `http://MacBook-Pro.local:4174/` 和 `http://192.168.1.200:4174/`，换网后必须以 `preview:lan:status` 的去敏状态为准。
- Host 必须精确等于当前 LocalHostName 或当前私有 IPv4，并显式带 `4174`；远端源必须来自同一 IPv4 子网。`utun*`、Tailscale、Clash TUN、其他 VPN、公网地址和任意 Host 均不进入允许面。
- 默认路由、接口、地址或 netmask 变化时服务 fail closed、记录 `LAN_NETWORK_CHANGED_RESTART_REQUIRED` 并退出，由 LaunchAgent 重新启动并重新证明网络；不会把动态换网降级为无过滤监听。

服务不会直接读取或服务 Worktree。每次请求先安全读取既有 schema 2 `current.json`；pointer fingerprint 与当前 ready snapshot 不一致时，请求等待新的核验构建。构建链为：

```text
0600 schema 2 pointer
  → 精确 HEAD + clean Worktree + pointer fingerprints
  → GIT_NO_REPLACE_OBJECTS 下读取 sourceCommit 的 Web 契约白名单 blobs
  → 私有 Application Support/Staging 临时源
  → buildWeb + 完整 manifest/hash/type 校验
  → fsync + 原子 rename 到不可变 Snapshot
  → 0600 ready.json 原子切换
```

新构建失败会保留上一份已核验快照，但静态请求返回 `503`，不会把旧 commit 冒充 pointer 当前 commit。去敏 health 只返回状态、hostname/IP/port、目标与 ready commit、错误 code 和更新时间，不包含用户名、绝对路径、项目内容或日志。服务文件系统根为 `~/Library/Application Support/PreVision Latest Preview/LanService/`，权限为用户私有；它不会扫描 HOME、repo、项目数据、Electron profile 或日志。

浏览器仍按既有 Web 能力运行：各设备 localStorage/项目数据独立，不做同步；截图/录屏使用浏览器能力，系统文件对话框按浏览器行为降级，不伪装 Electron IPC。该服务使用明文 HTTP，只适合受信任的私有物理 LAN，不是公网分享、加密协作或远程访问方案。

## 构建输入与输出

构建器只读取契约白名单，不扫描或复制用户目录、Electron 数据、日志、`node_modules/` 或项目文件。

固定输入：

- `预见PreVision.html`：导演台浏览器运行时。
- `i18n/runtime.js`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`。
- `vendor/html2canvas.min.js` 及许可证。
- `assets/PreVisionIcon-128.png`。
- `web/home/`：当前已接入的首页开场动画、样式与本地媒体/SVG 素材；底座仍保留缺失时的确定性回退契约。

固定输出：

```text
dist/web/
  ├─ index.html
  ├─ director/index.html
  ├─ assets/PreVisionIcon-128.png
  ├─ i18n/runtime.js
  ├─ i18n/locales/{zh-CN,en-US}.js
  ├─ vendor/{html2canvas.min.js,html2canvas.LICENSE.txt}
  ├─ prevision-web-contract.json
  └─ prevision-web-manifest.json
```

当前仓库存在 `web/home/index.html`，因此构建后的根 `index.html` 是响应式开场首页；ACTION 启动本地影片与溶解动画，`prevision:intro-complete` 完成处理返回后单次同源导航到 `/director/`。导演台构建器只把已登记的 `assets/`、`i18n/` 和 `vendor/` 引用改为根绝对路径；SVG `href="#..."` 等文档内片段仍保持原样，因此 `/director/` 能正确解析资源和图标。

`web/home/` 会原样复制到输出根，当前首页素材位于自身的 `home-assets/` 命名空间；它不能占用 `assets/`、`director/`、`i18n/`、`vendor/` 和两个 PreVision 清单文件。若未来某条分支确实不提供 `web/home/index.html`，构建器才使用导演台文档作为根首页的确定性回退。构建会检查 HTML/CSS 中常见的 `src`、`poster`、`srcset`、样式表/图标链接、`url()` 和 `@import`，远程依赖或缺失本地素材直接失败。符号链接、FIFO/特殊文件、未登记 MIME、隐藏文件和保留路径冲突也会在替换旧输出前失败。

每次成功构建会清除旧输出，并生成不含时间戳、本机路径或随机值的部署清单。清单按路径排序，记录每个受信文件的字节数和 SHA-256；预览器启动前逐项验证。

## 路由与资源契约

| 请求 | 行为 |
| --- | --- |
| `/` | 当前为 `web/home/` 开场首页；只有构建输入缺少该首页时才显示导演台回退。 |
| `/director` | `308` 规范化到 `/director/`。 |
| `/director/` | 导演台入口。 |
| 受清单保护的资源路径 | 精确、区分大小写地返回对应文件。 |
| 无扩展名且 `Accept: text/html` 的 `/director/*` 导航 | 回退到导演台 HTML。 |
| 其他未知导航 | `404`；首页当前没有通用 SPA 回退。 |
| 缺失 `.js`、`.json`、图片、字体等静态资源 | `404`，不回退 HTML。 |

查询参数不参与文件选择。服务端不得提供目录列表，也不得把未知路径映射到清单以外的文件。

## 生产托管契约

静态托管/CDN 必须复现 `prevision-web-manifest.json` 中的 MIME、路由和安全响应头。最低要求：

- HTTPS；HTML、清单和当前未指纹化资源使用 `Cache-Control: no-store`。
- `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`。
- `Cross-Origin-Opener-Policy: same-origin` 和 `Cross-Origin-Resource-Policy: same-origin`。
- 禁用摄像头、麦克风、定位、支付、USB 和串口；保留当前截图/录屏、剪贴板和全屏能力。
- CSP 只允许同源脚本/资源，不允许 `unsafe-eval` 或外部 HTTP 来源。

现有单体页面含内联脚本、内联样式及 html2canvas iframe，因此当前 CSP 必须暂时允许 `script-src/style-src 'unsafe-inline'`、`frame-src 'self'`。导演台不使用 `<base>`，CSP 固定为 `base-uri 'none'`。图片和媒体功能需要已登记的 `data:` / `blob:`。这些都是当前兼容边界，不是未来默认安全标准。

部署方还负责域名、TLS、CDN/静态主机规则、可用性监控、隐私政策和下线流程。仓库内预览器不处理这些生产责任。

## 数据与安全边界

- 浏览器继续在本机内存和 localStorage 中运行；构建与预览不读取、不上传项目数据。
- `/` 与 `/director/` 当前同源，会共享 localStorage。首页不得接第三方脚本；长期应把营销首页与 Web App 拆到不同子域。
- 当前项目名和对象标签仍有写入 `innerHTML` 的历史路径，同时兼容 CSP 允许内联脚本。打开不受信任 `.previz` 或未来远程分享项目存在存储型 DOM XSS 风险。
- 因此本底座只支持可信内容的本地/受控体验，不能被描述为“已安全支持公开项目分享”。公开分享前必须另立安全任务，完成项目白名单解析、文本 sink 收敛、内容限额、资源隔离和更严格 CSP。
- 账号、权限、撤回、访问日志、云端持久化和分享令牌若未来需要，应作为独立业务服务设计，不能塞进本地静态预览器。

## 当前组装与部署顺序

1. 静态运行底座、`web/home/` 首页和完成后进入 `/director/` 的组装均已进入当前源码。
2. 每次变更运行 `npm run test:web`、`npm run test:i18n` 和影响测试，并用回环预览核对首页、导演台直达/刷新/返回。
3. 由后续发布任务选择静态主机、域名和私有预览环境；当前仓库没有公网部署。
4. Safari/Windows 真机与公开分享安全审计完成前，不得把当前本地/回环结果描述为跨平台公开上线，也不得发布不受信任项目数据。

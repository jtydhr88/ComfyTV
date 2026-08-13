# 04.19 固定局域网最新预览 QA

## 范围

- 任务：`04.19-stable-lan-latest-preview`
- 分支：`chore/04.19-stable-lan-latest-preview`
- 基线：`6058255777ceb78db6fd0627094710a8dfe19937`
- 状态：任务级实现、首轮独立 R2 指定的三项返修、定向自动验证、真实 LaunchAgent 原位升级/重启与本机 LAN 请求已完成；返修 HEAD 的独立 R2 与第二真实 LAN 设备仍待补。
- 固定 App：不适用；禁止更新或启动固定 `~/Applications/PreVision.app`。
- stable pointer：只读使用既有 schema 2 `current.json`；本任务禁止改写。

## 自动证据

Node：`v24.18.0`

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `npm run test:latest-preview-lan` | 9 通过，0 失败 | policy/网络、Git-object 私有快照、root/foreign owner/严格 plist、verified-bytes loader 路径替换反例、manifest/asset/symlink/FIFO 损坏失效与恢复、LaunchAgent 事务回滚 |
| `npm run test:web` | Web runtime 11 通过；stress harness 14 通过 | 原 `127.0.0.1` 绑定/Host/route/MIME/header 零漂移；新增共享 handler 只接受显式注入 allowlist |
| `npm run test:latest-preview` | 56 通过，0 失败 | schema 2 pointer、精确来源、原 launcher 安装与回滚 |
| `npm run test:desktop` | 47 通过，0 失败 | Electron 壳边界未漂移 |
| `npm run test:i18n` | 217 通过，0 失败 | 双语 key、对齐与新增中文守卫 |
| `npm run test:foundation` | 通过 | foundation 151/0、C8 11/0、coordination 553/0、i18n 217/0、project-input wrapper 11/0 |
| `npm run build` | 通过 | 生成 HTML 1,301,806 bytes |
| `npm run web:build` | 通过 | 19 个 manifest files；provided-home |

## 冻结安全合同

- 固定 `4174`，只绑定默认路由的单一 `en*` 私有 IPv4，不使用 `0.0.0.0`。
- Host 只接受当前 `<LocalHostName>.local:4174` 或 `<private-ip>:4174`。
- 远端源必须与绑定地址处于同一 IPv4 子网；`utun*`、Tailscale、Clash TUN、公网和其他子网拒绝。
- 每次请求先读取 0600 schema 2 pointer；pointer fingerprint 不同则等待构建/核验。
- 构建只读取 pointer sourceCommit 的 `web/runtime-contract.json`、director、required files 与 `web/home/` Git blobs；禁用 replace refs，不扫描 Worktree/HOME。
- 私有 staging 完成 manifest/hash/type 校验和 fsync 后才原子发布不可变 snapshot 与 0600 ready record。
- 构建失败保留旧 snapshot/ready，但静态请求 503；health 只暴露去敏状态和 commit/error code。
- 浏览器数据按设备独立，不做账号、同步、协作或公网。

## 独立 R2 指定返修

- P2-1：install/start/stop/restart/status/uninstall 共用 non-root/current-UID guard；所有 managed root/version/active/loader/plist/ready/state 条目在使用前核对 owner/type/mode。既有 plist 必须与 legacy 或 schema2 active 确定性生成的完整 managed plist 精确一致，comment/lookalike 和普通 foreign plist 都在任何 `launchctl`/删除动作前拒绝。
- P2-2：schema2 active 记录独立 loader hash，plist 中的短 bootstrap 以安全 FD 核验 loader owner/mode/hash；loader 从安全 FD 读取并 hash 声明模块，Node 24 `registerHooks` 只为精确 file URL 返回已验证 bytes。固定反例在 hash 后以同版本 regular file 替换 pathname，断言只执行原已验证模块。
- P2-3：`ensureCurrent()` 不再凭内存 fingerprint/sourceCommit 跳过 active snapshot 核验；每次 serving 前复核 manifest 与全部 asset 的 type/owner/size/hash。manifest 截断、普通 asset 截断、symlink、FIFO 和 serving race 均原子撤销 ready、写入去敏 error 并返回 503；恢复原文件后须完整复核才重新 ready。

## 真实本机证据

- 首版两次 `preview:lan:install` 成功；返修后从既有 schema1 服务真实原位升级到 schema2 安装态，安装来源为 `c0fb7d05fc5715960a03eaacb6e2dd63821e1a83`，Node `v24.18.0`，active 绑定独立 loader hash，LaunchAgent `com.prevision.latest-preview-lan` 处于 running。
- 返修原位升级启动 PID=`45262`；`preview:lan:restart` 后 PID=`45651` 且 health 恢复 200。首版的 stop/start 证据继续有效，本轮按 R2 要求未对真实服务做破坏性 tamper。
- `lsof` 只显示 `192.168.1.200:4174`，没有 `0.0.0.0`、`127.0.0.1`、IPv6 wildcard 或 utun listener。默认路由为 `192.168.1.1`/`en12`，物理地址为 `192.168.1.200/24`；Clash TUN 为 `utun1`/`198.18.0.1`。
- `http://MacBook-Pro.local:4174/` 与 `http://192.168.1.200:4174/` 的 `/` 均为 200；`/director/`、`/i18n/runtime.js`、`/prevision-web-manifest.json` 为 200；未知路径为 404。
- 错误 Host、缺端口 Host 与 `localhost:4174` 均为 403；编码穿越为 400；POST 为 405。loopback 独立源连接物理 IP 得到 403；Clash TUN `198.18.0.1` 作为源地址时请求为 000/网络不可达，属于网络级阻断，不冒充应用层 403。
- 响应带 CSP、`nosniff`、`DENY`、`no-referrer`、COOP/CORP、Permissions Policy 与 `no-store`；health 只含 schema/status、commit、错误 code、hostname/IP/port 和更新时间。
- health 的 target/ready commit 均为 pointer `6058255777ceb78db6fd0627094710a8dfe19937`。root/active/ready/state/plist mode 分别为 0700/0600/0600/0600/0600；6 个安装资源 hash 和 manifest hash 一致；snapshot 21 个 regular files、0 special entry，staging 为空。
- stable pointer 在返修原位升级与 restart 前后 SHA-256 均为 `eb48c2dcd853d8ff5aa005e7219fa530470d0f3c7c44afb3dc31fcb9879cb5bf`，schema 2/0600，未修改。固定 App 来源前后均为 `b8da5f4f36a40010541700171cb246f2ca9de17b`，未更新、未启动。

## 证据限制

- 当前任务没有可从第二真实 LAN 设备执行浏览器或命令的受支持通道，因此没有第二设备页面 PASS。现有证据只覆盖本机经物理 LAN 地址访问、精确 listener、loopback 来源 403、Clash TUN 独立源网络级不可达，以及自动化同子网/跨子网请求授权矩阵。
- 为遵守“不得改稳定 pointer”，真实环境未做 pointer 故障注入；更新失败保留上一 ready、安装 bootstrap 失败回滚由临时 HOME 定向测试覆盖。
- 未主动断开或切换用户网络；动态换网 fail-closed 由 route/interface 守卫与定向测试覆盖，真实破坏性换网演练留待有明确维护窗口时执行。
- 本任务仍为 `IMPLEMENTED_UNVERIFIED`：固定 04 需对返修 HEAD 另组实现者之外的独立 R2，之后才可推进 REVIEW/集成。

# 任务：PreVision 局域网最新预览固定入口

- 状态：completed
- 日期：2026-07-29
- 对话：`04.19｜局域网最新预览固定入口`（canonical task/thread 已核对，去敏）
- 分支：`chore/04.19-stable-lan-latest-preview`
- 基线：`6058255777ceb78db6fd0627094710a8dfe19937`
- 固定 App 来源：`b8da5f4f36a40010541700171cb246f2ca9de17b`（`chore/integrate-04.9-before-product`）
- 负责人：`worker:04.19-stable-lan-latest-preview`

## 并行任务声明

- 任务 ID：`04.19-stable-lan-latest-preview`
- 模式：write
- 分管 owner：04
- 模块：`desktop,repository,testing,release`
- UI 表面：无
- 数据区域：`build-provenance,local-install,qa-metadata`
- 预计修改文件：
  - `package.json`
  - `README.md`
  - `scripts/latest-preview-lan-runtime.mjs`
  - `scripts/latest-preview-lan-service.mjs`
  - `scripts/install-latest-preview-lan-service.mjs`
  - `scripts/web-runtime-lib.mjs`
  - `qa/latest-preview-lan-policy.json`
  - `qa/test-impact-map.yaml`
  - `qa/feature-registry.yaml`
  - `测试/Web运行底座测试.mjs`
  - `测试/局域网最新预览测试.mjs`
  - `docs/WEB_RUNTIME.md`
  - `docs/CURRENT_STATE.md`
  - `docs/FEATURE_REGISTRY.md`
  - `docs/KNOWN_ISSUES.md`
  - `docs/qa/latest-preview-lan/README.md`
  - `docs/plans/active/2026-07-29-stable-lan-latest-preview.md`
  - `docs/plans/completed/2026-07-29-stable-lan-latest-preview.md`
  - `docs/plans/completed/README.md`
- reservation：已从同一 reservation 转换为 active claim；token 不提交。
- reserve request key：已核对/已去敏。
- 协调登记：schema v3 revision=`4953fd2f-246f-4aeb-ac00-d2237f32f164`；persistence=confirmed。
- 权威生命周期：ACTIVE
- 当前 actor / 下一责任人：`worker:04.19-stable-lan-latest-preview` / `worker:04.19-stable-lan-latest-preview`
- 状态更新时间 / 原因：2026-07-29T10:38:30.214Z；固定 04 将独立 R2 的三项 P2 返修从 REVIEW 转回同一 canonical task 的 ACTIVE，旧 review/stop evidence 已作废。
- 侧栏去重证据：task id、client id、thread id 已核对/已去敏。
- 外部三方状态：rollout=present；thread/list/DB=present；sidebar=present。
- 侧栏命名 / turn：name=set；turn=started；turnOwner=background。
- 执行可见性：BACKGROUND_ONLY（后台施工）。
- Desktop live 证据：不适用；`desktopLiveObserved=no`，不得宣称 DESKTOP_LIVE。
- WAITING checkpoint：前一 turn 已明确回复 `WAITING / next=固定04正式开工单` 并结束；本 turn 恢复同一 canonical task/thread。
- turn stop verification：未完成；进入 REVIEW 前由固定 04 另行组织。
- 失败补偿：标准 claim 明确命中既有 `spawnSync git ENOBUFS` 且未转换；核对协调器工作树 blob 与基线 blob 精确一致后，用一次性非落盘 64MiB `execFileSync` wrapper、`syncBuiltinESMExports()` 与显式 `process.argv` 成功转换同一 reservation，未修改协调器、registry 语义或锁。
- `task:check` 结果：固定 04 已完成原子 reserve；claim 成功后为 1/2 write slots，无其他 active write claim。
- `task:claim --reservation`：已从 reservation 转换。
- REVIEW commit list：未冻结。
- 机械 closeout：独立 R2 PASS 后按治理要求另行执行；本轮不得自行 closeout。
- `task:release`：未释放；仅 `00` 可在中央集成后释放。
- `task:archive`：未开始。

## 用户问题

建立固定 `4174` 端口的用户级局域网“最新预览”服务。它必须始终从既有 schema 2 最新预览指针指向的精确 clean Git commit 构建、核验并原子发布 Web 快照；同一局域网设备可通过固定 hostname/IP URL 打开，但各设备浏览器数据完全独立，不提供同步、账号、协作或公网访问。

## 目标

- 安装可重复、可回滚的用户级 LaunchAgent，不需要 root，不修改固定 `PreVision.app` 或稳定预览 pointer。
- 每次新开或刷新均服务与 `current.json.sourceCommit` 精确一致且经过 manifest/hash 核验的 ready 快照。
- 构建失败时保留上一份可用快照，并用去敏 health/error 明确当前 pointer 与已服务 commit 是否一致。
- 固定端口 `4174`；只接受明确登记的本机 hostname、当前私有物理 LAN IP 与对应 Host/port。
- 拒绝公网、VPN/Tailscale/utun 地址、任意 Host、目录列表、路径穿越、symlink、FIFO 和清单外文件。
- 复用既有 Web MIME、路由和安全响应头，并证明 `web:preview` 的 `127.0.0.1`/Host 合同零漂移。
- 提供 install/start/stop/status/uninstall 或等价命令，完成本机真实安装、启动和重启验证。

## 非目标

- 不改 `web:preview` 的 loopback-only 合同，不把 `0.0.0.0` 无过滤监听当作安全边界。
- 不修改稳定预览 pointer，不扫描或服务 repo、HOME、项目数据、日志、Electron profile。
- 不做设备间 localStorage/项目同步，不新增账号、协作、云服务或公开分享。
- 不更新固定 App，不执行 `app:deliver`，不发布 GitHub、Pages、公网或远程仓库。
- 不运行 `test:full`、`test:impact` 或主应用全量测试。

## 证据与现状

- 代码：现有 `web-runtime-lib.mjs` 已有白名单构建、manifest/hash、MIME、路由、安全头、路径与 Host 校验；现有 `web:preview` 明确只允许 `127.0.0.1`。
- Git：从精确 clean baseline `6058255777ceb78db6fd0627094710a8dfe19937` 创建唯一任务分支。
- 测试/运行：Node v24.18.0；首次 `app:status` 只因未安装 `@electron/asar` 失败，`npm ci` 后成功确认固定 App installed source 为 `b8da5f4...`，当前分支包含该来源但并非精确来源。
- 文档/历史线索：04.17 已建立 schema 2 pointer、精确 clean Worktree/commit、生成 HTML 与 Electron binary hash 门禁；LAN 服务必须复用其权威 pointer 语义而不是另建来源选择器。

## 影响范围

- 模块：desktop、repository、testing、release。
- 文件：仅“预计修改文件”白名单。
- 数据格式：不改变 project v5；新增项目外私有 LAN service policy、ready snapshot、health state 与 LaunchAgent。
- 平台：macOS Apple Silicon；同一可信私有物理局域网中的现代浏览器。

## 风险

- 风险档：R3
- 请求模型：不可观察，未验证
- 实际模型：不可观察，未验证
- 请求 reasoning：不可观察，未验证
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：不可观察，未验证
- Ultra：不可观察，未验证
- Max/升级原因：范围涉及 LAN 暴露、构建 provenance、原子快照、LaunchAgent 回滚与 Host/接口安全。
- 独立只读 reviewer：由固定 04 在任务实现、证据与 clean commit 后另组独立 R2；本实现者不自审、不自行转 REVIEW。
- 数据：浏览器 localStorage 按 origin/设备独立；服务不得读取、复制、记录或同步项目数据。
- UI/交互：浏览器 desktop-only 能力按既有 Web fallback 降级；不得伪装 Electron IPC。
- 安全：只从已核验 pointer 与精确 clean commit 构建清单白名单；监听、Host、来源接口、文件类型、hash、路径和错误输出均 fail closed。
- 发布：仅本机用户级局域网预览服务；不是固定 App 正式交付或公网发布。

## 验收条件

- [x] 固定 LAN URL 首选 `http://MacBook-Pro.local:4174/`，当前私有 IP fallback `http://192.168.1.200:4174/`；动态网络无法可靠证明时明确 fail closed 并提供可审计 restart/reinstall。
- [x] 每次请求/刷新只服务与 schema 2 pointer `sourceCommit` 精确一致的已核验 ready 快照。
- [x] pointer、Git commit/clean、Web build、manifest/hash、文件类型或允许接口/Host 任一异常均 fail closed。
- [x] 新 build 以私有 Application Support 临时目录生成，完整核验后原子发布；失败保留上一份可用快照并去敏报告 stale/error。
- [x] 固定 `4174`；明确允许 hostname/IP+port，拒绝公网、VPN/Tailscale、任意 Host 与非私有远端来源。
- [x] 无目录列表、路径穿越、symlink、FIFO 或清单外文件；MIME、route 与安全头复用既有 Web 合同。
- [x] 原 `web:preview` 继续仅绑定 `127.0.0.1`，Host 合同零漂移。
- [x] 用户级 LaunchAgent 可重复安装并支持 start/stop/status/uninstall；安装和更新原子、失败可回滚。
- [x] 本机 `/`、`/director/`、资源、404、安全头、Host/非 LAN 拒绝、sourceCommit 与 LaunchAgent 重启完成真实检查。
- [x] 第二设备执行通道不可用；已用物理默认路由、精确监听、loopback 源 403 与 Clash TUN 独立源不可达证据替代，并在 QA 中准确记录限制。
- [x] Node 24 定向 LAN 测试、更新/回滚、`test:web`、`test:foundation`、`test:i18n` 与必要 build 全部通过。
- [ ] 实现者之外的独立只读 R2 由固定 04 完成；阻塞问题关闭后方可进入后续生命周期。
- [x] 固定 App、稳定预览 pointer、GitHub/Pages/远程均未修改。
- [x] 文档、机器可读功能登记、影响映射与去敏 QA 证据已更新。

## 测试计划

- 影响映射模块：web-runtime、foundation、build-config、latest-preview-lan。
- 主应用模块参数：无。
- 最小命令：Node 24 定向 `test:latest-preview-lan`、`npm run test:web`、`npm run test:foundation`、`npm run test:i18n`、`npm run web:build`。
- 升级到全量的条件：本任务明确禁止 `test:full`/`test:impact`；若实现需要超出 claim scope，立即停止并升级固定 04。
- 人工检查尺寸/步骤：本机 hostname 与私有 IP 请求 `/`、`/director/`、资源、404、Host/来源拒绝和安全头；LaunchAgent stop/start/restart；真实第二设备若可用则补同网浏览器。
- 固定 App 交付：不适用；目标固定路径仅只读核对 provenance，禁止更新。

## 实施记录

- 假设：schema 2 pointer 保持 04.17 契约；当前物理 LAN 可由 macOS route/interface 信息确定，`utun*`/Tailscale/Clash TUN 不计入允许接口。
- 关键决定：LAN runtime 不直接服务 Worktree；它只服务私有 Application Support 中已核验、不可变的 ready snapshot。
- 实际修改：新增固定 4174 的用户级 LaunchAgent、安装/启停/状态/卸载入口、物理 LAN/Host/同子网请求门禁、schema 2 pointer 精确来源验证、Git-object Web 白名单构建、私有 staging/不可变 snapshot/原子 ready、失败保留旧 ready 与去敏 health；共享 Web handler 仅增加显式 allowlist 注入，原 loopback 默认合同不变。
- R2 最小返修：所有 installer/service 动作统一拒绝 root/非当前 UID，并对 managed owner/type/mode 与完整确定性 plist fail closed；plist bootstrap hash 锚定 loader，Node 24 loader 只执行安全 FD 已核验的声明模块 bytes；active snapshot 每次 serving 前完整复核，任何 manifest/asset/type/hash 损坏都会撤销 ready、去敏报错并返回 503。
- 中断/恢复：首个 turn 仅 WAITING；本 turn 从同一 canonical task/thread 正式开工。
- app-server 通知消费：当前 turn 为后台施工；不作为 Desktop live 证据。

## 验证结果

| 命令/步骤 | 结果 | 耗时 | 备注 |
| --- | --- | ---: | --- |
| Node 24 `npm run app:status`（安装依赖前） | 失败 | <1s | 缺少锁定依赖 `@electron/asar`；未修改固定 App |
| Node 24 `npm ci` | 通过 | 约 7s | 仅安装 lockfile 依赖；报告既有 npm audit 风险，未自动修改依赖 |
| Node 24 `npm run app:status`（安装依赖后） | 通过 | <1s | installed source=`b8da5f4...`；contains=yes；exact=no |
| 标准 `task:claim --reservation` | 失败且未转换 | 约 55s | 已知 `spawnSync git ENOBUFS` |
| 批准的一次性 64MiB wrapper claim | 通过 | 约 92s | ACTIVE/BACKGROUND_ONLY；revision=`3949b29f...` |
| Node 24 `npm run test:latest-preview-lan`（R2 返修 HEAD） | 9 通过，0 失败 | 约 4s | 增加 root/foreign owner/完整 plist、verified-bytes loader 同路径替换、manifest/asset/symlink/FIFO 损坏失效与恢复固定反例 |
| Node 24 `npm run test:latest-preview` | 56 通过，0 失败 | <1s | schema 2 pointer、来源和安装回滚门禁 |
| Node 24 `npm run test:web` | 25 通过，0 失败 | <1s | runtime 11/0；stress 14/0；loopback 监听/Host 合同零漂移 |
| Node 24 `npm run test:desktop` | 47 通过，0 失败 | <1s | Electron 壳未回归 |
| Node 24 `npm run test:i18n` | 217 通过，0 失败 | <1s | 双语 key 与新增中文守卫 |
| Node 24 `npm run test:foundation` | 通过 | 约 1m25s | foundation 151/0、C8 11/0、coordination 553/0、i18n 217/0、project-input wrapper 11/0 |
| Node 24 `npm run build` | 通过 | <1s | `预见PreVision.html` 1,301,806 bytes |
| Node 24 `npm run web:build` | 通过 | <1s | 19 个 manifest files；provided-home |
| 真实 `preview:lan:install`（R2 原位升级） | 通过 | 约 11s | 从已运行 schema1 安装态升级为 schema2；Node v24.18.0；安装来源 `c0fb7d0...`；loader hash 已锚定 |
| 真实 `preview:lan:restart`（R2） | 通过 | 约 10s | PID `45262→45651`；health 恢复 200；target/ready 均为 `6058255...` |
| R2 HTTP/监听复核 | 通过 | <1s | `/`、`/director/`、asset=200；missing=404；bad Host/loopback source=403；仅 `192.168.1.200:4174`；安全头完整 |
| 真实 `preview:lan:install`（首次） | 通过 | 约 14s | Node v24.18.0；用户级 LaunchAgent ready；安装来源 `16317c7...` |
| 真实 `preview:lan:install`（重复） | 通过 | 约 11s | 相同版本/资源 hash；重新 ready |
| 真实 restart 与 stop/start | 通过 | 约 22s | PID 更新；stop 后 4174 无 listener；start 后 health 200 |
| 本机 HTTP/Host/路径矩阵 | 通过 | <5s | hostname/IP `/`、director、asset、manifest=200；missing=404；bad/no-port/loopback Host=403；traversal=400；POST=405 |
| 真实监听与独立源证据 | 通过但有限制 | <5s | 仅 `192.168.1.200:4174`，非 wildcard；loopback 源=403；Clash TUN `198.18.0.1` 源=000/网络不可达；无第二设备执行通道 |
| 私有快照/安装落盘审计 | 通过 | <1s | root=0700；active/ready/state/plist=0600；6 个资源 hash 与 manifest hash 一致；21 regular files、0 special；staging 为空 |
| pointer 前后 SHA-256 | 一致 | <1s | `eb48c2dcd853d8ff5aa005e7219fa530470d0f3c7c44afb3dc31fcb9879cb5bf`；未改稳定 pointer |
| 实施前后 `npm run app:status` | 一致 | <1s | 固定 App source 始终 `b8da5f4...`；未更新、未启动 |

固定 App installed source：`b8da5f4f36a40010541700171cb246f2ca9de17b`

固定 App 人工启动结果：不适用；本任务禁止启动或更新固定 App。

## 未覆盖与后续

- 无第二真实 LAN 设备的可执行浏览器/命令通道；本机只证明物理 LAN URL、精确物理绑定、loopback 来源拒绝和 Clash TUN 来源网络级不可达，不能冒充第二设备 PASS。
- 网络切换的自动 fail-closed 由定向测试和 route/interface 守卫覆盖；本轮不主动切断用户网络，未做真实换网破坏性演练。
- 自动更新/失败回滚使用临时 HOME 与注入失败验证；稳定 pointer 明令禁止修改，因此未对真实 pointer 做故障注入。
- 独立 R2、中央集成、release、archive 均由固定 04/00 后续处理。

## 交接

- 实现提交：首版 `16317c7b0e4ab3214ac2ecad210d547b76f03a9d`；R2 三项最小返修 `c0fb7d05fc5715960a03eaacb6e2dd63821e1a83`。
- 证据提交：本验收单与 QA 证据所在任务 HEAD；由固定 04 在独立 R2 前冻结完整 `baseline..HEAD` 有序列表。
- PR：无。
- reviewer 结论：未评审。
- 生命周期交接：ACTIVE（保持 claim）。
- 工作区状态：实现、定向验证、真实安装/启动/重启与本机 HTTP 验收已完成；证据提交后 clean。
- 下一步：固定 04 另组实现者之外的独立 R2；本实现者不自行转 REVIEW、release、archive 或集成。

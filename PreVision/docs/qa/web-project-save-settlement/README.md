# Web 项目保存失败结算 QA 证据

- 任务：`01.13-web-project-save-settlement`
- 基线：`e3826edd1907a7be155a030d186a577ce1bbc0fb`
- 分支：`fix/01.13-web-project-save-settlement`
- 日期：2026-07-16
- 数据边界：仅使用合成 project v5、临时下载目录、随机 loopback origin、隔离 Chrome profile 与隔离 Electron userData；未读取用户项目或正式 userData。

## 回归先行

- 在实现修复前，执行级 `#btnSave.onclick` / Promise 回归已能稳定复现错误结算。
- 当 `document.body.appendChild()` 注入失败时，旧实现先写成功状态并遗留未处理 rejection。
- 当时 `npm run test:module -- project` 为 `108 passed, 2 failed`；执行级 onclick/Promise 断言证明 Web 保存失败仍误报成功/产生 unhandled rejection，且本地化失败终态契约尚未满足。

## 自动验证

- `npm run test:module -- project`：`112 passed, 0 failed`。
- `npm run test:i18n`：`21 passed, 0 failed`。
- `npm run test:project-input`：通过；真实 Chromium renderer 与真实 Electron preload/IPC 均在隔离环境完成。
- `npm run test:impact -- --base e3826edd1907a7be155a030d186a577ce1bbc0fb --module project`：最终源码通过 app、foundation、project-input 与 Web 安全集。
- `npm run test:full`：最终源码通过 app 936、project-input、Web 24、desktop 47、local install 49 与 foundation 156 项。
- 项目保存边界覆盖：
  - `createObjectURL` 抛错；
  - anchor `createElement`、append、click 抛错；
  - remove/revoke 清理告警；
  - 底层带类型的下载 reject；
  - 每次失败仅一个本地化终态，`0 uncaught`、`0 unhandledrejection`；
  - append 失败后可立即重试成功，anchor 与 Blob URL 按既有契约清理。
- Electron bridge 覆盖实际 preload/IPC 的 ok、cancel、error：
  - ok 写入本地化保存路径状态；
  - cancel 保持原状态，不误报成功或失败；
  - error 仅显示一次原有 alert 语义；
  - 三次 payload 均保持 `.previz.json` 文件名规则与 project v5 内容。

## 真 Google Chrome 隔离验证

使用系统 Google Chrome、全新临时 profile、临时下载目录和随机 loopback origin；未复用任何已有浏览器会话。

- 允许下载：`saveProjectFile()` 返回成功，本地化状态为“项目文件已保存到本地”；实际下载文件存在，解析为 project v5，项目名与合成输入一致。
- 注入失败：阻止 anchor append 后返回失败；状态仅写入一次“项目保存失败：chrome injected append failure”，无成功状态。
- 立即重试：恢复 DOM 后返回成功；实际下载文件存在并可解析为 project v5。
- 清理与控制台：剩余下载 anchor 为 0；DevTools console error、runtime error、uncaught 和 unhandled rejection 均为 0。
- 为避免与产品逻辑无关的 favicon 404 干扰，隔离测试服务器对该请求返回空 204；未修改产品文件。

## 状态与数据不变量

- 保存失败与重试未额外改变 scene/shot、selection、history 或 autosave 写入计数。
- 保留保存前既有的 `syncScene()`、资产 GC、项目名、宽高比和 modified 元数据更新。
- Electron IPC、保存位置、project v5、JSON 内容结构和文件名规则未修改。
- 固定 App installed source 保持 `7ff9aa583b4e51fb4d888aa1815792b747d275d7`；本任务未运行交付、更新、打包或安装命令。

## 残余边界

- 页面只能把现有 `dl()` Promise resolve 视为浏览器端可观察的下载启动成功；浏览器在此后由用户或系统取消下载不属于页面可获知范围。
- remove/revoke 在 click 已成功后属于延迟清理告警；既有契约会尝试清理并记录 warning，但不会把已经启动的下载反转为失败。

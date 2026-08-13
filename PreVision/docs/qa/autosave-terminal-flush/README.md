# Autosave terminal flush QA

本目录只记录合成状态和隔离环境结果，不包含项目字节、正式 userData、用户路径、Cookie 或 profile 内容。

- Node：24.18.0
- 基线：`a706161afd10daf3b090bf67c7b656599d344414`
- 固定 App：未连接、未关闭、未更新；installed source 保持 `7ff9aa583b4e51fb4d888aa1815792b747d275d7`
- 回归先行：修复前 `project` 模块以“缺少唯一同步末次结算入口”失败。
- 隔离 Chromium：Web 与 Electron 分别使用随机临时 partition；编辑后不等待 800ms，reload、reloadIgnoringCache 和 close/relaunch 均恢复对应合成项目名。
- 异常：完整写与 lite 写连续失败、循环引用序列化失败均无 uncaught，且此前有效 autosave 保持不变。
- 独立 Chrome.app：当前会话未暴露安全浏览器控制运行时，因此未连接用户现有 Chrome；不把 Electron Chromium 冒充为独立 Chrome.app 人工证据。

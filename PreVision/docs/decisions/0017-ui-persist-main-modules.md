# ADR-0017：P9 UI、持久化与主入口模块

- 状态：accepted
- 日期：2026-07-22
- 范围：P9 行为保持型模块化重构

## 背景

P8 完成后，`src/app.js` 仍同时承载 UI shell、时间轴、检查器、项目持久化、初始化和顶层命令路由。现有产物必须继续是离线单文件，并且应用逻辑仍在同一个无属性 `<script>` 块中执行；许多历史函数、顶层状态和 HTML inline handler 依赖这一共同的脚本词法环境。

## 决定

P9 按以下所有权迁移：

- `src/ui/shell.js`：A + M，主题、栏位、菜单、专注模式、场景 rail、右栏尺寸和 UI chrome。
- `src/ui/timeline.js`：N，轨道、预览动画状态、时间轴交互和缩略图调度。
- `src/ui/inspector.js`：O + U，检查器/监视器刷新、对象列表、确认框及其绑定。
- `src/persist/persistence.js`：G 后半 + Q，history、autosave、打开/保存和下载。
- `src/main.js`：V，明确的初始化顺序、剩余顶层命令路由和 boot。

构建器会以确定性的源清单把这些脚本片段拼接回同一应用 script block；已有 core/stage/playback/viewport/capture/prompt 的 esbuild bridge 继续先行执行。片段不以 ES module 的独立词法作用域执行，避免把行为保持型迁移变成全局状态重写。

## 不变量

- 输出仍恰好有两个 bare script blocks，内嵌 Three.js，连续构建字节一致。
- RefreshHub 注册保持 22；回调内部不引入 `invalidate` 或 `syncAll`。
- `scheduleThumbs` 保持 180ms；capture 保持 Node 直接 import 安全；禁止 engine/capture 循环依赖。
- project-v5、autosave、history、相机、actor/rig、默认对象名称、Seedance、截图/录屏、播放和视口无语义变化。
- 只有当前代码、HTML inline handler、测试与模块图共同证明无消费者时才删除 shim；其余 bridge 作为明确的残余风险保留。

## 验证

新增 P9 boundary guard，并保留 C1-C8、U1-U5、P8 boundary、i18n、DOM probe、构建守门和全量回归。`qa/golden/**` 不在本 ADR 允许的改动范围内。V1 仍需要真机 Electron/GPU；若未启用，报告为 SKIP 而非 PASS。

## 后果

源文件的模块边界变得可审计，而交付形态与历史全局运行时兼容。未来若要消除剩余 bridge，应作为独立任务，以显式 capability injection 逐项替换，不在 P9 顺带改变产品语义。

# Web 开场动画与导演台组装检查

日期：2026-07-15
基线：`6da46a0ff3e226a8d30b58bd9918f828a0e1ac34`
分支：`feat/web-intro-director-assembly`
阶段：Web 上线前组装验证；未更新固定 App，未公开部署。

## 自动行为证据

- `prevision:intro-complete` 先同步完成事件派发和既有回调，再通过微任务发起导航。
- `navigationQueued` 与完成态/run id 双重门禁保证同一轮只调用一次 `location.assign('/director/')`；目标不读取事件或外部输入。
- VM 行为测试真实执行首页脚本：连续两次完成调用只发一个事件、只排一个微任务，微任务前导航计数为 0，执行后唯一目标为 `/director/`。
- 返回/BFCache、媒体错误和公开 reset 共用恢复路径，恢复时清除导航门禁并显式取消所有 `piece.hidden`，避免完成白场返回后死锁。
- `stalled`/`waiting` 仅在播放态启动 8 秒无进度 watchdog；`playing`/`timeupdate`/`ended`/`pagehide` 清理。行为测试确认短暂 stall 续播不回退、永久 stall 恢复 `idle`，完成后的旧 watchdog 不会把页面拉回。
- 正常播放、减少动效和既有声音/颗粒/隐藏延时未改动；导航只接在既有完成函数末端。

## 真浏览器结果

使用仓库确定性 `web:build` 输出和 `127.0.0.1:4174` 回环生产预览。

| 场景 | 结果 |
| --- | --- |
| 1440×900 首页 | ACTION 可见，首页无溢出；截图 `1440x900-home.png`。 |
| ACTION 媒体失败 | 内嵌浏览器拒绝有声影片后恢复 `idle`，按钮重新启用，隐藏元素为 0；没有进入空白页或错误导航。 |
| 1440×900 `/director/` | 直接访问成功，标题、`appWorkspace` 和 WebGL canvas 存在；截图 `1440x900-director.png`。 |
| 导演台刷新 | URL 保持 `/director/`，导演台重新启动。 |
| 导演台返回首页 | 返回 `/` 后首页为 `idle`，隐藏元素为 0，无白场死锁。 |
| 390×844 首页 | ACTION 可见，页面宽度与视口同为 390；截图 `390x844-home.png`。 |
| 390×844 `/director/` | 导演台和 canvas 启动，无控制台 warning/error；现有桌面导演台最小布局宽约 739px，产生横向滚动，此任务不改导演台响应式业务。截图 `390x844-director.png`。 |

## 未覆盖与残余风险

- 内嵌浏览器的有声媒体策略使 ACTION 真点按进入失败恢复路径，未在本轮真浏览器看到正常影片结尾的白场到导演台跳转；该路径由 VM 行为测试覆盖，仍应在允许有声播放的外部 Chrome/Safari 做发布前复核。
- `prefers-reduced-motion` 的既有分支由契约测试保护，本轮浏览器控制面未提供媒体偏好覆盖，未单独取得截图。
- Safari、Windows Chrome/Edge 和公网静态托管仍由相应平台/发布任务验证。
- 390px 下导演台横向滚动是既有桌面优先布局，不属于本次组装范围；首页本身没有横向溢出。

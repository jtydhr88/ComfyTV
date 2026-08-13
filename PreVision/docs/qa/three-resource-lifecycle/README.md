# Three.js 场景资源生命周期验收证据

日期：2026-07-16
任务：`04.5-three-resource-lifecycle`

## 结论

在同一台 macOS arm64 物理机、同一 Chrome 150.0.7871.124、Node 24.18.0、1440×900、standard profile 下，修复前后都使用 4 场景 × 24 对象、40 次切换、2 秒短播放和 120 秒长会话。修复后 geometry/texture 不再随场景切换线性增长，短播放达到 `≥55 FPS` 且 `p95 <25ms` 的门槛。

| 指标 | 基线 `7658220` | 修复 `8dcb0ed` |
| --- | ---: | ---: |
| 40 次切换 geometry | 565 → 17,244（+16,679） | 452 → 451（-1） |
| 40 次切换 texture | 28 → 988（+960） | 27 → 27（0） |
| 40 次切换 JS heap 差 | +141,730,986 B | +22,886,259 B |
| 切换后短播放 FPS | 60.00 | 60.00 |
| 切换后短播放 p95 | 16.8 ms | 17.7 ms |
| 120 秒 geometry | 17,307 → 41,778（+24,471） | 451 → 448（-3） |
| 120 秒 texture | 988 → 2,404（+1,416） | 27 → 27（0） |
| 120 秒 FPS / p95 | 58.58 / 17.8 ms | 56.83 / 18.0 ms |
| 120 秒 JS heap 差 | +180,735,891 B | +30,214,437 B |

修复后 formal run 完成 58 个长会话循环；40 次切换和每个长会话循环都以打开项目前建立的独立、深冻结 oracle 校验实际 `sceneIdx/name`、24 个 actor 的顺序、label、kind，以及无路径对象位置或有路径对象的完整运行时路径。公开证据保留 `sceneCount=4`、`objectCount=24`；零 alert、零 console error、零 exception、零 WebGL context lost，未观察到 crash/detach，页面清理通过。

## 原始去敏 JSON

- `baseline.json`：来源提交 `76582209564a2e2cfc91144bea41fe7686303f4b`；SHA-256 `6abf3e2c94cc8501fec457c67ea09f1c080604016ab1bb57189ca15ad16cab5b`。
- `after.json`：来源提交 `8dcb0ed8ca79b2d2a2096babcf152c1132bdf4d5`；SHA-256 `4c26c425b5ed3b1fe218bd35453a6af1706703a56e4dfb81da68d58bfc2c083d`。

两份证据的 matrix、standard 参数、浏览器/系统和真实物理机口径一致。修复后工装仅增加 fail-closed 场景身份 oracle 与公开 `sceneCount/objectCount`，不改变 4×24、切换次数、播放时长、录制、全景或长会话工作负载；因此 harness 文件哈希按预期不同。JSON 排除了用户名、主机名、PID、浏览器 profile、绝对路径、项目/媒体字节和私有场景内容。

正式命令：

```text
npm run web:stress -- --browser chrome --profile standard --attestation physical-machine --output dist/web-stress-evidence/04-5-after-8dcb0ed.json
```

## 共享资源与可见性链

- 真 Chrome formal run 的 4096×2048 全景场景通过，`textureReady=true`、自然尺寸 4096×2048、最大纹理尺寸 16384。
- 真 Chrome 当前构建的导演视口人工检查中，对象标签与专业摄影机辅助模型均可见；formal run 同时确认每轮 24 个对象身份正确。
- 使用真实内嵌 Three.js r128 的执行级回归验证：全景与图板在 A→B 成功打开、失败回滚、跨场景共享、orphan GC 后继续引用同一存活 `assetTex`；旧 owner 只释放一次，不产生丢材质。
- 标签连续重命名逐次释放旧 SpriteMaterial/CanvasTexture，新标签可见；Three r128 引擎共享 Sprite geometry 与显式共享 texture 不被误释放，再次清场不双重处置。
- 摄影机 overlay、renderer、导演台地面/网格不进入场景 disposer 的所有权树；截图、MP4 录制和 Seedance ZIP 在 formal run 中均通过格式验证。

本轮没有通过文件上传保留一张图板像素截图；“图板无丢材质”由真实 Three r128 材质引用、场景重建和项目事务执行级断言证明，未把该断言表述为像素级视觉比较。

## 残余观察

- 逐帧 `shotCurve` / `actorCurve` / 碰撞计算缓存仍是后续性能观察项，本任务没有扩张实现。
- `disposeAssetTextureCache` 会在单个 texture 的 `dispose()` 抛错时删除该 owner 引用、记录错误并继续清理后续项；该极端对象已进入不可重试状态，按 P3 保留，不在本任务扩大为资源管理框架。
- Safari Remote Automation 和真实 Windows Chrome/Edge 仍按现有矩阵阻塞/未运行；本证据只声明 macOS Chrome 物理机结论。

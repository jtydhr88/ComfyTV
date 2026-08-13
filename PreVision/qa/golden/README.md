# qa/golden —— 回归安全网基准(只进不改)

重构期间对外契约的字节级/字符级固化基准。配套测试在 `测试/回归/`,总入口:

```bash
node 测试/回归/run_all.mjs
```

## 纪律(回归测试清单.md §5 规程)

1. **只进不改**:本目录内文件在重构分支上禁止修改。测试红 = 先怀疑代码,
   不许"顺手更新基准让它绿"。
2. **合法换基准只有两种**:
   - 产品有意变更(提示词模板迭代、格式升 v6 等)——用
     `node 测试/回归/record_golden.mjs --update` 重录,单独 commit,
     message 写明"基准变更:<原因>",diff 里基准与代码变更同现;
   - V 系环境变更(换机/升系统)——重录并记录环境。
3. **录制前置**:基准必须从当前 git HEAD 的应用生成,录制当日测试全绿。
4. 录制器默认拒绝覆盖已存在的基准文件(防手滑),`--update` 才放行。
5. 确定性:录制与回放共用同一 VM 环境(`测试/回归/harness/vm-app.mjs`),
   Date 冻结为 `2026-01-01T00:00:00.000Z`、`Math.random` 固定种子。

## 目录清单(录制登记)

录制日期:2026-07-17 · 应用版本:git HEAD(分支 qa/regression-safety-net 基点,
`预见PreVision.html` 1,085,813 字节)· 录制器:`测试/回归/record_golden.mjs`

### projects/ —— C1 round-trip 基准(输入即期望输出)

| 文件 | 场景内容 | 覆盖的字段/特性 |
|---|---|---|
| `welcome.previz.json` | 首启白马骑手欢迎项目(firstRun boot 由应用自己存出) | 骑乘挂载 mount、pose:ride、4 镜头锁定跟拍、默认 sun/ground、马匹调度路径 |
| `ride-pano.previz.json` | 骑手+白马+猎犬穿越沙漠,720°全景背景 | assets(pano/地面贴图/图板)、bg.gp 地面投影、ground:image、desert+terrainVersion、semanticType+dimensions、joints、pathTimes/字符串与 custom 贝塞尔 pathEase、pointSync/arcLength、camMode line/curve、多演员 |
| `camwork.previz.json` | 双场景运镜实验(9:16) | lock:手动朝向、逐点 camAim、camTimes/camAimTimes/camFovTimes、custom 贝塞尔 camEase、timingMode custom/pointSync、timeLink:cameraNodes+timeLinkShot、多场景序列化、ground color/white、sun 关闭分支 |

> golden 项目同时是 C1/C3(以及将来 V1)的输入——一鱼三吃;新增覆盖场景时
> 优先扩充现有 golden 项目而不是加新文件。
> 备注:预览关键帧(preview animation)是会话态,不进 `.previz.json` v5 契约,
> 故不在 C1 覆盖面内(见 架构地图 §5.1)。

### prompts/ —— C3 genPrompt 逐镜头基准

`<项目>_S{n}C{m}.txt`,共 10 份(welcome 4 + ride-pano 3 + camwork 3)。
录制时人工审读:焦段/机位高度/运镜速度数字、【角色:/【动物:/【道具:标记、
骑乘"全程不下马"、数量声明、结尾负面约束均与场景相符。
**有意改提示词模板必须 `--update` 重录并在 commit message 注明"提示词模板变更"。**

### legacy/ —— C2 迁移基准 + C4 启动种子

| 文件 | 说明 |
|---|---|
| `v3-input.json` | 按 normalize 源码反推的 v3 老格式(actor.y、字符串 pathEase、缺 camAim/camTimes/settings/ground/sun) |
| `v3-expected.json` | 当前版本 `normalizeProjectData` 实际输出(行为固化) |
| `v4-input.json` | v4 老格式(有 camAim 缺 camAimTimes/camFovTimes、越界 pathTimes、settings 缺 labels、bg 缺 gp) |
| `v4-expected.json` | 同上,含 pathTimes [0,3,99]→[0,3,6] 修复的人工验算 |
| `corrupt-input.txt` | JSON 截断样本 → 启动分类 invalid |
| `future-input.json` | version:6 → invalidProject 拒绝(不静默降写) |

### zip/ —— C6 makeZip 字节基准

`makezip-basic.bin`:两个固定文件(ASCII 文本 + 含中文文件名的 0–255 二进制)
经 `makeZip` 的完整输出。录制时经 Python `zipfile.testzip()` 全 CRC 校验、
UTF-8 flag(0x0800)与中文文件名解码确认合法。

### frames/ —— V1 视觉基准(待办)

尚未录制。VM 环境 WebGLRenderer 是 stub 没有像素,需在项目主人机器上用
playwright-core 驱动 Electron 壳按清单 §3 录制;录制时在此登记环境
(机器/系统/Electron 版本)。

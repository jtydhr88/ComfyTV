# 任务：03.12｜开场版本号可见层同步 v0.8.0

- 状态：completed
- 日期：2026-07-22
- 对话：03.12｜开场版本号可见层同步 v0.8.0
- 分支：`fix/03.12-opening-version-ui-0.8.0`
- 基线：`5c6b95bee57b7bf12be73e89c67fe7e7aaf774b9`
- 固定 App 来源：待 `npm run app:status` 在 Node 24 依赖环境中复核；本任务不更新固定 App。
- 负责人：worker:03.12-opening-version-ui-0.8.0

## 并行任务声明

- 任务 ID：03.12-opening-version-ui-0.8.0
- 模式：write
- 分管 owner：03
- 模块：layout, i18n, testing
- UI 表面：app-shell
- 数据区域：i18n-resources, qa-metadata
- 预计修改文件：`web/home/home-assets/6.svg`、`i18n/locales/zh-CN.js`、`i18n/locales/en-US.js`、`测试/Web运行底座测试.mjs`、本验收单
- reservation：已预留（token 不写入仓库）
- 权威生命周期：WAITING；claim 成功后为 ACTIVE
- 当前 actor / 下一责任人：worker:03.12-opening-version-ui-0.8.0 / worker:03.12-opening-version-ui-0.8.0
- 执行可见性：BACKGROUND_ONLY（后台施工）
- turn stop verification：未完成
- `task:claim --reservation`：待登记
- `task:release`：未释放

## 目标

- 把首页右下角 SVG 可见版本从 `v0.7.2` 精确同步为 `v0.8.0`，不改变画布、位置、渐变、响应式布局或溶解动画合同。
- 将双语 `landing.versionAlt` 同步至 0.8.0，并增加稳定的 Web 运行底座回归。

## 非目标

- 不改 `package.json`、锁文件、Forge/Electron 或固定 App 元数据；这些由 04 后续同步。
- 不更新固定 App、不运行 `app:deliver`、不部署。

## 影响范围与风险

- 数据格式：无；只修改 i18n 资源与 Web QA 断言。
- 平台：响应式 Web 首页。
- 风险档：R1
- 请求模型：Terra
- 实际模型：不可观察，未验证
- 请求 reasoning：Medium
- 实际 selected reasoning：不可观察，未验证
- Fast/priority：关闭
- Ultra：关闭
- Max/升级原因：无
- 独立只读 reviewer：待固定 03 指派
- 风险：SVG 为路径轮廓字，必须证明确实可见为 0.8.0，且不得以 package 仍为 0.7.2 伪装一致。

## 验收条件

- [ ] SVG 声明可机器识别的可见版本 `v0.8.0`，且保持原视觉合同。
- [ ] 两种 `landing.versionAlt` 都为 0.8.0。
- [ ] `npm run test:web`、`npm run test:i18n`、`npm run test:foundation` 与 impact 测试通过。
- [ ] 在 1316×768、1440×900、390×844 隔离人工检查首帧、右下角位置和无裁切；交互前后溶解/响应式状态不变。
- [ ] 独立只读 reviewer 已完成。
- [ ] `app:deliver` 不适用：00 将在 04 元数据同步后统一正式交付。

## 测试计划

- 影响映射模块：web-runtime、i18n-browser、foundation-test。
- 最小命令：`npm run test:web`、`npm run test:i18n`、`npm run test:foundation`、`npm run test:impact -- --base 5c6b95bee57b7bf12be73e89c67fe7e7aaf774b9`。
- 升级到全量的条件：impact 测试要求，或首页结构/资源合同失败。
- 人工检查：在 1316×768、1440×900、390×844 读取右下角 `v0.8.0`；首帧与溶解后的页面均无溢出或裁切，除字形外位置不变。
- 固定 App 交付：不适用；00 在 04 元数据同步后统一正式交付。

## 实施记录

- 开工基线和工作区：已核对为干净的 `5c6b95bee57b7bf12be73e89c67fe7e7aaf774b9`。
- `app:status`：默认 Node 26 环境缺少 `@electron/asar`，将在 Node 24 依赖环境复核。

## 验证结果

| 命令/步骤 | 结果 | 备注 |
| --- | --- | --- |
| `npm run app:status` | passed | Node 24；installed `7ff9aa5`，current `5c6b95b`，未更新固定 App |
| `npm run task:status` | passed | 同一任务 reservation 为 WAITING |
| `npm run test:web` | passed | Web runtime 10 + stress harness 14，0 failed |
| `npm run test:i18n` | passed | 217 passed，0 failed |
| `npm run test:foundation` | passed | foundation 151、C8 11，后续 coordination/i18n 均通过 |
| `npm run test:impact -- --base 5c6b95bee57b7bf12be73e89c67fe7e7aaf774b9` | passed | 命中 foundation/i18n-browser/web-runtime，并运行 app/foundation/web |
| SVG XML 校验 | passed | `xmllint --noout` |
| 1316×768 首帧 | passed | `/tmp/opening-1316x768-final.png`；右下角显示 `v0.8.0` |
| 1440×900 首帧 | passed | `/tmp/opening-1440x900-final.png`；未见版本层裁切 |
| 390×844 首帧 | follow-up | `/tmp/opening-390x844-final.png`；既有 ACTION 区域覆盖版本层，未改 CSS 以保持本任务范围 |

## 未覆盖与后续

- 04 必须精确同步：`package.json`、`package-lock.json` 根版本、Forge 打包后 `Contents/Info.plist` 的 `CFBundleShortVersionString`/`CFBundleVersion`，以及最终 `~/Applications/PreVision.app` 实际版本。
- 最终交付门禁必须同时比对这些元数据值、SVG 可见 `v0.8.0` 与双语 alt。
- 390×844 的既有 ACTION/version 重叠应由后续独立 UI 任务处理；本任务不改 `web/home/home.css`。

## 交接

- 最终提交：待完成（仅 active 验收单与已 claim 文件）
- reviewer 结论：未评审
- 生命周期交接：ACTIVE（保持 claim）
- 工作区状态：待完成
- 下一步：在同一 canonical task 领取 claim 后实施最小改动。

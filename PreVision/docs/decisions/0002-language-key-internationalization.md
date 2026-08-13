# ADR-0002：用户界面文案统一使用 language key

状态：Accepted
日期：2026-07-14

## 背景

主应用和 Electron 原型长期直接内联中文。继续沿用会让语言切换、文案一致性、多人开发和后续国际化成本持续上升，也无法自动判断新代码是否遵守规范。

## 决定

1. 从本决策生效起，运行时 HTML、JavaScript 和 Electron 逻辑不得直接新增中文用户文案。
2. 翻译只存放在 `i18n/locales/`，浏览器与 Electron 使用同一 key 集合。
3. 浏览器使用 `PreVisionI18n.t()` 或 `data-i18n*`；Electron 使用 `i18n/node.cjs` 的 `t()`。
4. 每个 key 必须同时存在于全部受支持语言包，当前为 `zh-CN` 与 `en-US`。
5. 历史内联中文不在本次一次性迁移；以后触碰相关界面时就地迁移。
6. `npm run test:i18n` 作为强制契约测试，拦截缺失 key、语言包分叉和规范生效后新增的直接中文。

## 后果

- 新功能和 Bug 修复必须先命名稳定 key，再编写各语言翻译。
- 用户文案修改不再散落在业务逻辑中，浏览器和桌面菜单可以共享资源。
- 在遗留迁移完成前，应用只能视为“国际化基础已建立”，不能宣称完整英文界面可用。
- 自动守卫需要完整 Git 历史以识别规范生效基线，因此 CI checkout 使用 `fetch-depth: 0`。

## 验证

- `npm run test:i18n`
- `npm run test:desktop`
- `npm run test:full`

## 撤销条件

若未来引入成熟国际化框架，可用新 ADR 替换运行时实现；language key、语言资源集中管理和禁止运行时代码直接中文的原则继续保留。

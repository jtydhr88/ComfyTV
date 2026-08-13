/*
 * C4 · localStorage 启动分类与自动保存迁移
 * 契约(架构地图 §3.2 / §5.2, docs/ARCHITECTURE.md 启动边界):
 *   previz_autosave_v3 精确不存在 → firstRun(白马骑手欢迎项目);
 *   v1–v5 可归一化 → restored(内存迁移到 v5, 启动不回写);
 *   JSON 损坏 / 未来版本 → invalid(回退标准 dialogue 项目 + 本地化警告);
 *   storage 读取抛错 → unavailable。
 *   外加 quota-lite 降级恢复: 去 assets 的 autosave 能正常恢复(悬挂引用降级)。
 *   纪律: boot 全程不得写 previz_autosave_v3(启动不 markDirty)。
 * 每个种子一次真实 boot(不是只调纯函数), 断言分类 + 项目关键字段 + 零回写。
 * 运行: node 测试/回归/C4_startup_classification.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, root, AUTOSAVE_KEY } from './harness/vm-app.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const legacyDir = path.join(root, 'qa', 'golden', 'legacy');
const projectsDir = path.join(root, 'qa', 'golden', 'projects');
const welcomeGolden = fs.readFileSync(path.join(projectsDir, 'welcome.previz.json'), 'utf8');
const ridePanoGolden = fs.readFileSync(path.join(projectsDir, 'ride-pano.previz.json'), 'utf8');
const v3Raw = fs.readFileSync(path.join(legacyDir, 'v3-input.json'), 'utf8');
const corruptRaw = fs.readFileSync(path.join(legacyDir, 'corrupt-input.txt'), 'utf8');
const futureRaw = fs.readFileSync(path.join(legacyDir, 'future-input.json'), 'utf8');

function autosaveWrites(app) { return app.storage._setLog.filter(([k]) => k === AUTOSAVE_KEY); }
function assertNoBootWriteback(app, label) {
  assert(autosaveWrites(app).length === 0, `${label}: boot 不回写 ${AUTOSAVE_KEY}(启动不 markDirty)`);
  /* 现状钉死: boot 期唯一的 storage 写入是 UI 主题镜像(previz_ui_theme) */
  assert(app.storage._setLog.every(([k]) => k === 'previz_ui_theme'),
    `${label}: boot 期 storage 写入仅限 UI 主题镜像(实际 ${JSON.stringify(app.storage._setLog.map(([k]) => k))})`);
  assert(app.T.dirtyTimer === null || app.T.dirtyTimer === undefined,
    `${label}: boot 后无待触发的 autosave 定时器`);
}
function statusText(app, key) { return key ? app.sandbox.PreVisionI18n.t(key) : ''; }

/* 1. firstRun: key 精确不存在 → 白马骑手欢迎项目 */
console.log('· firstRun(无 autosave)');
{
  const app = bootApp();
  assert(app.T.startupState === 'firstRun', `分类 firstRun(实际 ${app.T.startupState})`);
  const scene = app.T.project.scenes[0];
  const horse = scene.actors.find(a => a.kind === 'horse');
  const rider = scene.actors.find(a => a.mount === horse?.label);
  assert(!!horse && rider?.pose === 'ride' && scene.shots.length === 4,
    'firstRun 加载白马骑手欢迎项目(马+骑乘者+4 镜)');
  assert(app.el('saveState').textContent === '', 'firstRun 不显示启动状态文案(startupStatusKey 为空)');
  assertNoBootWriteback(app, 'firstRun');
}

/* 2. restored: v5 golden autosave */
console.log('· restored(v5 autosave)');
{
  const app = bootApp({ autosaveRaw: welcomeGolden });
  assert(app.T.startupState === 'restored', `分类 restored(实际 ${app.T.startupState})`);
  assert(app.T.project.version === 5 && app.T.project.name === JSON.parse(welcomeGolden).name,
    'restored 项目为 v5 且项目名与 autosave 一致');
  assert(app.el('saveState').textContent === statusText(app, 'startup.restored'),
    'restored 显示本地化恢复文案');
  assertNoBootWriteback(app, 'restored-v5');
}

/* 3. restored: v3 老版本 autosave → 内存迁移 v5, 启动不回写(迁移结果只在内存) */
console.log('· restored(v3 老版本 autosave, 内存迁移)');
{
  const app = bootApp({ autosaveRaw: v3Raw });
  assert(app.T.startupState === 'restored', `v3 分类 restored(实际 ${app.T.startupState})`);
  assert(app.T.project.version === 5, 'v3 autosave 在内存迁移为 project v5');
  assert(app.storage._d[AUTOSAVE_KEY] === v3Raw, '启动后 storage 里仍是原 v3 串(迁移不落盘)');
  assert(app.T.project.scenes[0].actors[0].height === 0.5, 'v3 actor.y 迁移为 height');
  assertNoBootWriteback(app, 'restored-v3');
}

/* 4. restored: quota-lite 降级样本(assets 被清空, 引用悬挂) */
console.log('· restored(quota-lite 去 assets 降级)');
{
  const lite = Object.assign(JSON.parse(ridePanoGolden), { assets: {} });
  const app = bootApp({ autosaveRaw: JSON.stringify(lite) });
  assert(app.T.startupState === 'restored', `quota-lite 分类 restored(实际 ${app.T.startupState})`);
  const scene = app.T.project.scenes[0];
  assert(scene.bg === null && scene.ground.style === 'checker' && scene.actors.every(a => a.asset === undefined),
    'quota-lite 悬挂资产降级: 背景清空 / 地面回退棋盘 / 对象去引用');
  assert(scene.actors.length === JSON.parse(ridePanoGolden).scenes[0].actors.length,
    'quota-lite 不丢对象, 仅降外观');
  assertNoBootWriteback(app, 'restored-lite');
}

/* 5. invalid: JSON 损坏 */
console.log('· invalid(JSON 损坏)');
{
  const app = bootApp({ autosaveRaw: corruptRaw });
  assert(app.T.startupState === 'invalid', `分类 invalid(实际 ${app.T.startupState})`);
  assert(app.T.project.scenes[0].templateId === 'dialogue', 'invalid 回退标准双人对话项目');
  assert(app.el('saveState').textContent === statusText(app, 'startup.invalidAutosave'),
    'invalid 显示本地化警告文案');
  assert(app.storage._d[AUTOSAVE_KEY] === corruptRaw, '损坏的 autosave 原样保留(boot 不清除用户数据)');
  assertNoBootWriteback(app, 'invalid-corrupt');
}

/* 6. invalid: version 6 未来版本(不静默降写) */
console.log('· invalid(version:6 未来版本)');
{
  const app = bootApp({ autosaveRaw: futureRaw });
  assert(app.T.startupState === 'invalid', `future 分类 invalid(实际 ${app.T.startupState})`);
  assert(app.T.project.scenes[0].templateId === 'dialogue', 'future 回退标准双人对话项目');
  assertNoBootWriteback(app, 'invalid-future');
}

/* 7. unavailable: autosave 读取抛错 */
console.log('· unavailable(storage 读取抛错)');
{
  const app = bootApp({ autosaveGetThrows: true });
  assert(app.T.startupState === 'unavailable', `分类 unavailable(实际 ${app.T.startupState})`);
  assert(app.T.project.scenes[0].templateId === 'dialogue', 'unavailable 回退标准双人对话项目');
  assert(app.el('saveState').textContent === statusText(app, 'startup.storageUnavailable'),
    'unavailable 显示本地化警告文案');
  assertNoBootWriteback(app, 'unavailable');
}

/* 8. 分类↔文案映射自检(纯函数面) */
console.log('· startupStatusKey 映射');
{
  const app = bootApp();
  assert(app.T.startupStatusKey('restored') === 'startup.restored'
    && app.T.startupStatusKey('invalid') === 'startup.invalidAutosave'
    && app.T.startupStatusKey('unavailable') === 'startup.storageUnavailable'
    && app.T.startupStatusKey('firstRun') === '',
    'startupStatusKey 四分类映射不变');
}

console.log(`\nC4 启动分类: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

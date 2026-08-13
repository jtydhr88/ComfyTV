/*
 * C2 · 版本迁移快照(v3/v4 → v5)+ corrupt/future 拒绝分支
 * 契约: 旧版本输入经 normalizeProjectData 的输出与期望 v5 快照完全一致(迁移行为固化);
 *       JSON 损坏样本与 version:6 未来样本走 invalidProject 拒绝分支(架构地图 §5.1)。
 * fixture 来源: v3/v4 输入按 normalizeProjectData 源码反推的老字段形态手工构造
 *       (actor.y→height、字符串 pathEase、缺 camAim/camTimes/settings/ground/sun 等);
 *       expected = 录制日当前版本 normalizeProjectData 的实际输出(行为固化)。
 * 运行: node 测试/回归/C2_legacy_migration.mjs
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
const read = name => fs.readFileSync(path.join(legacyDir, name), 'utf8');
const app = bootApp();
const T = app.T;

for (const version of ['v3', 'v4']) {
  console.log(`· ${version} → v5 迁移快照`);
  const input = JSON.parse(read(`${version}-input.json`));
  const expected = JSON.parse(read(`${version}-expected.json`));
  let out = null, error = null;
  try { out = JSON.parse(JSON.stringify(T.normalizeProjectData(input))); } catch (e) { error = e; }
  assert(!error, `${version}: normalizeProjectData 不抛异常(${error?.message || ''})`);
  if (out) {
    assert(out.version === 5, `${version}: 迁移输出 version=5(实际 ${out.version})`);
    assert(JSON.stringify(out, null, 2) === JSON.stringify(expected, null, 2),
      `${version}: 迁移输出与期望快照逐字段一致`);
  }
}

/* 关键迁移语义抽查(录制时人工验算, 防"盲录"): */
console.log('· 迁移语义抽查');
const v3out = T.normalizeProjectData(JSON.parse(read('v3-input.json')));
assert(v3out.scenes[0].actors[0].height === 0.5, 'v3: 老字段 y 迁移为 height(0.5)');
assert(v3out.scenes[0].actors[0].pathEase.every(e => typeof e === 'object' && e.type),
  'v3: 字符串 pathEase 归一化为 {type} 对象');
assert(v3out.scenes[0].shots[0].camAim === undefined,
  'v3: 输入无 camAim 时 normalize 不注入 camAim(由 loadScene/ensureCamKeys 运行时补齐)');
assert(Array.isArray(v3out.scenes[0].shots[0].camTimes) && v3out.scenes[0].shots[0].camTimes.length === 2,
  'v3: camTimes 由 repair 补齐至与 cam 等长');
assert(v3out.scenes[0].ground.style === 'checker' && v3out.scenes[0].sun.enabled === true && v3out.scenes[0].bg === null,
  'v3: 缺失的 ground/sun/bg 补默认值');
const v4out = T.normalizeProjectData(JSON.parse(read('v4-input.json')));
const v4times = v4out.scenes[0].actors[0].pathTimes;
assert(v4times.length === 3 && v4times[2] <= 6 && v4times.every((t, i) => i === 0 || t > v4times[i - 1]),
  `v4: 越界 pathTimes[0,3,99] 修复到场景时长内且严格递增(实际 ${JSON.stringify(v4times)})`);
assert(v4out.scenes[0].shots[0].camAim.length === 3 && v4out.settings.labels === true && v4out.scenes[0].bg.gp === true,
  'v4: camAim 对齐 cam 长度、settings.labels/bg.gp 补默认 true');

/* 拒绝分支 */
console.log('· corrupt / future 拒绝分支');
const corruptRaw = read('corrupt-input.txt');
let corruptParseError = null;
try { JSON.parse(corruptRaw); } catch (e) { corruptParseError = e; }
assert(corruptParseError instanceof SyntaxError, 'corrupt-input: JSON.parse 必然失败(样本自检)');
const corruptStartup = T.readStartupProject({ getItem: k => k === AUTOSAVE_KEY ? corruptRaw : null, setItem() { throw new Error('启动分类不得写 storage'); } });
assert(corruptStartup.state === 'invalid' && corruptStartup.raw === corruptRaw,
  'corrupt-input: 启动分类走 invalid 且保留原 raw');

const futureData = JSON.parse(read('future-input.json'));
let futureError = null;
try { T.normalizeProjectData(futureData); } catch (e) { futureError = e; }
assert(futureError?.code === 'PREVISION_INVALID_PROJECT' && String(futureError.message).includes('version'),
  `future-input(version:6): invalidProject 拒绝且指明 version(实际 ${futureError?.code}/${futureError?.message})`);
assert(T.isRestorableProject(futureData) === false, 'future-input: isRestorableProject 判 false');
const futureStartup = T.readStartupProject({ getItem: k => k === AUTOSAVE_KEY ? JSON.stringify(futureData) : null, setItem() { throw new Error('启动分类不得写 storage'); } });
assert(futureStartup.state === 'invalid', 'future-input: 启动分类走 invalid, 不静默降写版本');

console.log(`\nC2 版本迁移: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

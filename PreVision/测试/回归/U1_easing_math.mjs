/*
 * U1 · 缓动数学(E 子系统 → core/timing-math.js)
 * 两条腿:
 *   a) golden 回放 —— P1 拆分前由未拆分实现在固定输入上打表(0.1 步长, record_golden.mjs),
 *      拆出的模块必须逐位复现(搬运未改行为的直接证据);
 *   b) 数学性质(人工验算, 抗"合法重构"误报): 端点 f(0)=0/f(1)=1、单调性、
 *      easeIn(.5)=.25 / easeOut(.5)=.75 / easeInOut(.5)=.5、越界钳制、
 *      normalizeEaseSpec 对枚举与非法输入的兜底。
 * 运行: node 测试/回归/U1_easing_math.mjs
 */
import { importTimingMath, loadTimingGolden, sameAsGolden, diffText } from './harness/timing-env.mjs';
import { NORMALIZE_EASE_INPUTS, APPLY_EASE_SPECS, EASE_TS, CUBIC_BEZIER_SPEC, CUBIC_BEZIER_XS } from './timing_fixtures.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const { tm } = await importTimingMath();
const golden = loadTimingGolden().U1;
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

/* ---- a) golden 回放 ---- */
console.log('· normalizeEaseSpec golden 回放');
NORMALIZE_EASE_INPUTS.forEach((input, i) => {
  const actual = tm.normalizeEaseSpec(clone(input));
  assert(sameAsGolden(actual, golden.normalizeEaseSpec[i]),
    `normalizeEaseSpec case ${i} (${JSON.stringify(input)}): ${diffText(actual, golden.normalizeEaseSpec[i])}`);
});

console.log('· applyEaseSpec golden 回放(0.1 步长打表 + 越界点)');
APPLY_EASE_SPECS.forEach(({ name, spec }, si) => {
  const values = EASE_TS.map(t => tm.applyEaseSpec(clone(spec), t));
  assert(sameAsGolden(values, golden.applyEaseSpec[si].values), `applyEaseSpec[${name}]: 打表与基准不逐位一致`);
});

console.log('· cubicBezierEase golden 回放');
{
  const values = CUBIC_BEZIER_XS.map(x => tm.cubicBezierEase(x, { ...CUBIC_BEZIER_SPEC }));
  assert(sameAsGolden(values, golden.cubicBezierEase), 'cubicBezierEase 打表与基准不逐位一致');
}

/* ---- b) 数学性质(人工验算) ---- */
console.log('· 端点 / 定点 / 单调性 / 钳制');
for (const { name, spec } of APPLY_EASE_SPECS) {
  const f = t => tm.applyEaseSpec(clone(spec), t);
  assert(Math.abs(f(0)) < 1e-6 && Math.abs(f(1) - 1) < 1e-6, `${name}: f(0)=0 且 f(1)=1(实际 ${f(0)}, ${f(1)})`);
  assert(f(-0.5) === f(0) && f(1.5) === f(1), `${name}: t 越界钳到 [0,1]`);
  let monotone = true;
  for (let i = 1; i <= 100; i++) if (f(i / 100) < f((i - 1) / 100) - 1e-9) monotone = false;
  assert(monotone, `${name}: [0,1] 上单调不减`);
}
assert(Math.abs(tm.applyEaseSpec('easeIn', 0.5) - 0.25) < 1e-9, 'easeIn(.5)=.25');
assert(Math.abs(tm.applyEaseSpec('easeOut', 0.5) - 0.75) < 1e-9, 'easeOut(.5)=.75');
assert(Math.abs(tm.applyEaseSpec('easeInOut', 0.5) - 0.5) < 1e-9, 'easeInOut(.5)=.5');
assert(tm.applyEaseSpec('linear', 0.37) === 0.37 && tm.applyEaseSpec('constant', 0.37) === 0.37,
  'applyEaseSpec 对 linear/constant 都返回 t(constant 的特殊性在 timedPathState 的弧长分支)');

console.log('· normalizeEaseSpec 兜底语义');
assert(tm.normalizeEaseSpec({ type: 'bogus' }).type === 'linear', '非法对象 type 兜底为 linear');
assert(tm.normalizeEaseSpec(null).type === 'linear' && tm.normalizeEaseSpec(42).type === 'linear', 'null/数字兜底为 linear');
assert(tm.normalizeEaseSpec('bogus-string').type === 'bogus-string',
  '字符串输入原样透传(行为固化: 字符串分支不做白名单, 下游 applyEaseSpec 未知型返回 t)');
{
  const c = tm.normalizeEaseSpec({ type: 'custom', x1: 2, y1: -1, x2: 0.5, y2: 0.25 });
  assert(c.x1 === 1 && c.y1 === 0 && c.x2 === 0.5 && c.y2 === 0.25, 'custom 控制点钳到 [0,1]');
  const d = tm.normalizeEaseSpec({ type: 'custom' });
  assert(d.x1 === 0.33 && d.y1 === 0 && d.x2 === 0.67 && d.y2 === 1, 'custom 缺省控制点 (.33,0,.67,1)');
}
{
  const f = x => tm.cubicBezierEase(x, { ...CUBIC_BEZIER_SPEC });
  assert(Math.abs(f(0)) < 1e-4 && Math.abs(f(1) - 1) < 1e-4, 'cubicBezier 端点(18 轮二分公差内)');
}

console.log(`\nU1 缓动数学: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

/*
 * U5 · 弧长参数化与路径采样(E 子系统 → core/timing-math.js)
 * 覆盖(回归测试清单 U5):
 *   - timedPathState / timedValueState: t=0/t=dur 端点、乱序/重复 times 行为、
 *     单点/空值退化(golden 回放 + 性质)
 *   - times 缺失/长度不符的兜底(→ distributedPathTimes, P2 起已迁 core/project-data.js
 *     并被 timing-math 真 import, 改为直接 import 回放, 断言不变)
 *   - pointIndexedPosition / pointIndexedTangent: 控制点处位置精确(line 与 curve
 *     两模式下 u=i/(n-1) 都应精确过控制点), 打表回放
 * 运行: node 测试/回归/U5_arclength_sampling.mjs
 */
import { importTimingMath, loadTimingGolden, sameAsGolden } from './harness/timing-env.mjs';
import { TIMED_PATH_CASES, TIMED_PATH_POINTS, TIMED_VALUE_CASES, POINT_INDEXED_US, POINT_INDEXED_PATHS, buildPathActor } from './timing_fixtures.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const { tm, THREE } = await importTimingMath();
const golden = loadTimingGolden().U5;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));

console.log('· timedPathState: golden 回放 + 端点/退化性质');
{
  const actor = buildPathActor(THREE, TIMED_PATH_POINTS, 'curve');
  const curve = tm.actorCurve(actor);
  TIMED_PATH_CASES.forEach((c, ci) => {
    const states = c.ats.map(at => tm.timedPathState(actor.pathPts, c.times.slice(), at, clone(c.eases), curve));
    assert(sameAsGolden(states, golden.timedPathState[ci].states), `timedPathState[${c.name}]: 打表与基准不逐位一致`);
  });
  /* 端点性质(times=[0,2,8]) */
  const t0 = tm.timedPathState(actor.pathPts, [0, 2, 8], 0, null, curve);
  const tEnd = tm.timedPathState(actor.pathPts, [0, 2, 8], 8, null, curve);
  assert(t0.u === 0 && t0.active === false && tEnd.u === 1 && tEnd.active === false && tEnd.local === 1,
    'at=首点 → {u:0,inactive}; at=末点 → {u:1,inactive}');
  /* 单点/空点退化 */
  assert(sameAsGolden(tm.timedPathState([actor.pathPts[0]], [0], 1, null, null), { u: 0, active: false, segment: 0, local: 0 }),
    '单点路径退化 {u:0,active:false}');
  assert(sameAsGolden(tm.timedPathState([], [], 1, null, null), { u: 0, active: false, segment: 0, local: 0 }),
    '空路径退化 {u:0,active:false}');
}

console.log('· timedPathState 兜底(times 缺失/长度不符, P2 起直接 import)');
{
  const actor = buildPathActor(THREE, TIMED_PATH_POINTS, 'curve');
  const curve = tm.actorCurve(actor);
  golden.timedPathStateFallback.forEach(({ times, states }) => {
    const actual = [0, 0.25, 0.5, 1].map(at => tm.timedPathState(actor.pathPts, times, at, null, curve));
    assert(sameAsGolden(actual, states), `times=${JSON.stringify(times)} 兜底行为与基准不逐位一致`);
  });
}

console.log('· timedValueState: golden 回放 + 端点/退化性质');
TIMED_VALUE_CASES.forEach((c, ci) => {
  const states = c.ats.map(at => tm.timedValueState(c.values.slice(), c.times.slice(), at, clone(c.eases)));
  assert(sameAsGolden(states, golden.timedValueState[ci].states), `timedValueState[${c.name}]: 打表与基准不逐位一致`);
});
assert(sameAsGolden(tm.timedValueState([10, 20, 40], [0, 1, 4], 0, null), { i: 0, f: 0 }), 'at=首点 → {i:0,f:0}');
assert(sameAsGolden(tm.timedValueState([10, 20, 40], [0, 1, 4], 4, null), { i: 1, f: 1 }), 'at=末点 → {i:n-2,f:1}');
assert(sameAsGolden(tm.timedValueState([7], [0], 3, null), { i: 0, f: 0 }), '单值退化 {i:0,f:0}');
assert(sameAsGolden(tm.timedValueState([], [], 0, null), { i: 0, f: 0 }), '空值退化 {i:0,f:0}');

console.log('· pointIndexedPosition/Tangent: golden 回放 + 控制点精确');
POINT_INDEXED_PATHS.forEach(({ name, mode, points }, pi) => {
  const actor = buildPathActor(THREE, points, mode);
  const curve = tm.actorCurve(actor);
  const positions = POINT_INDEXED_US.map(u => tm.pointIndexedPosition(actor.pathPts, mode, curve, u).toArray());
  const tangents = POINT_INDEXED_US.map(u => tm.pointIndexedTangent(actor.pathPts, mode, curve, u).toArray());
  assert(sameAsGolden(positions, golden.pointIndexed[pi].positions), `${name}: 位置打表与基准不逐位一致`);
  assert(sameAsGolden(tangents, golden.pointIndexed[pi].tangents), `${name}: 切向打表与基准不逐位一致`);
  actor.pathPts.forEach((p, i) => {
    const u = actor.pathPts.length < 2 ? 0 : i / (actor.pathPts.length - 1);
    const got = tm.pointIndexedPosition(actor.pathPts, mode, curve, u);
    assert(got.distanceTo(p) < 1e-9, `${name}: u=${u} 精确过控制点 ${i}(偏差 ${got.distanceTo(p)})`);
  });
  tangents.forEach((t, i) => {
    const len = Math.hypot(t[0], t[1], t[2]);
    assert(Math.abs(len - 1) < 1e-6, `${name}: 切向为单位向量(样本 ${i} 长度 ${len})`);
  });
});
assert(tm.pointIndexedPosition([], 'line', null, 0.5).length() === 0, '空点集退化为原点');
assert(sameAsGolden(tm.pointIndexedTangent([new THREE.Vector3()], 'line', null, 0.5).toArray(), [0, 0, 1]),
  '单点切向退化为 +Z');

console.log(`\nU5 弧长采样: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

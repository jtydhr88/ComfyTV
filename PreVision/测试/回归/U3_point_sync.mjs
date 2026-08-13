/*
 * U3 · pointSync 节点同步(E 子系统 → core/timing-math.js)
 * 覆盖(回归测试清单 U3):
 *   - nodeArrivalTime / inverseSmoothProgress: 到达时刻严格递增、首点 t=0 末点 t=dur、
 *     inverseSmoothProgress(smoothProgress(x))≈x 往返 <1e-6; golden 回放
 *   - segmentArcParameter / curveProgressAtControlPoint: 等距与极不等距控制点
 *     两组样例(line/curve 双模式)的采样表; 端点与单调性质
 * 运行: node 测试/回归/U3_point_sync.mjs
 */
import { importTimingMath, loadTimingGolden, sameAsGolden, diffText } from './harness/timing-env.mjs';
import { INV_SMOOTH_US, NODE_ARRIVAL_CASES, PATH_EQUIDISTANT, PATH_UNEVEN_S, ARC_RATIOS, buildPathActor } from './timing_fixtures.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const { tm, THREE } = await importTimingMath();
const golden = loadTimingGolden().U3;

console.log('· inverseSmoothProgress: golden 回放 + 往返/单调');
{
  const table = INV_SMOOTH_US.map(u => tm.inverseSmoothProgress(u));
  assert(sameAsGolden(table, golden.inverseSmoothProgress), 'inverseSmoothProgress 打表与基准不逐位一致');
  const smooth = x => x * x * (3 - 2 * x);
  for (let i = 0; i <= 20; i++) {
    const x = i / 20;
    assert(Math.abs(tm.inverseSmoothProgress(smooth(x)) - x) < 1e-6, `往返 inv(smooth(${x}))≈${x}(<1e-6)`);
  }
  for (let i = 1; i < table.length; i++) assert(table[i] >= table[i - 1], 'inverseSmoothProgress 单调不减');
  assert(tm.inverseSmoothProgress(-1) === tm.inverseSmoothProgress(0) && tm.inverseSmoothProgress(2) === tm.inverseSmoothProgress(1),
    'u 越界钳到 [0,1]');
}

console.log('· nodeArrivalTime: golden 回放 + 严格递增/端点');
{
  const table = NODE_ARRIVAL_CASES.map(c => tm.nodeArrivalTime(c.index, c.count, c.dur));
  assert(sameAsGolden(table, golden.nodeArrivalTime), 'nodeArrivalTime 打表与基准不逐位一致');
  for (const count of [2, 3, 4, 5]) {
    const dur = 6;
    const times = Array.from({ length: count }, (_, i) => tm.nodeArrivalTime(i, count, dur));
    assert(Math.abs(times[0]) < 1e-5, `count=${count}: 首点 t≈0(二分公差内, 实际 ${times[0]})`);
    assert(Math.abs(times[count - 1] - dur) < 1e-5, `count=${count}: 末点 t≈dur(实际 ${times[count - 1]})`);
    for (let i = 1; i < count; i++) assert(times[i] > times[i - 1], `count=${count}: 到达时刻严格递增`);
  }
  assert(tm.nodeArrivalTime(0, 1, 6) === 0, 'count<2 退化返回 0');
}

const arcConfigs = [
  ['equidistant-line', PATH_EQUIDISTANT, 'line'],
  ['equidistant-curve', PATH_EQUIDISTANT, 'curve'],
  ['uneven-line', PATH_UNEVEN_S, 'line'],
  ['uneven-curve', PATH_UNEVEN_S, 'curve'],
];

console.log('· segmentArcParameter: golden 回放 + 端点/单调');
arcConfigs.forEach(([name, pathData, mode], ci) => {
  const actor = buildPathActor(THREE, pathData, mode);
  const curve = tm.actorCurve(actor);
  const count = actor.pathPts.length;
  for (let segment = 0; segment < count - 1; segment++) {
    const row = ARC_RATIOS.map(ratio => tm.segmentArcParameter(curve, segment, count, ratio));
    assert(sameAsGolden(row, golden.segmentArcParameter[ci].segments[segment]),
      `${name} 段 ${segment}: 打表与基准不逐位一致`);
    assert(Math.abs(row[0] - segment / (count - 1)) < 1e-9 && Math.abs(row[row.length - 1] - (segment + 1) / (count - 1)) < 1e-9,
      `${name} 段 ${segment}: ratio 0/1 落在段端点 u`);
    for (let i = 1; i < row.length; i++) assert(row[i] >= row[i - 1] - 1e-12, `${name} 段 ${segment}: 随 ratio 单调`);
  }
  assert(tm.segmentArcParameter(null, 1, 3, 0.5) === (1 + 0.5) / 2, `${name}: 无曲线退化为线性参数`);
});

console.log('· curveProgressAtControlPoint: golden 回放 + 端点/递增');
arcConfigs.forEach(([name, pathData, mode], ci) => {
  const actor = buildPathActor(THREE, pathData, mode);
  const curve = tm.actorCurve(actor);
  const values = actor.pathPts.map((p, i) => tm.curveProgressAtControlPoint(curve, p, i, actor.pathPts.length));
  assert(sameAsGolden(values, golden.curveProgressAtControlPoint[ci].values), `${name}: 打表与基准不逐位一致`);
  assert(values[0] === 0 && values[values.length - 1] === 1, `${name}: 首点 0 / 末点 1`);
  for (let i = 1; i < values.length; i++) assert(values[i] > values[i - 1], `${name}: 控制点进度严格递增`);
});

console.log(`\nU3 pointSync: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

/*
 * U2 · 朝向样条与解卷绕(E 子系统 → core/timing-math.js)
 * 覆盖(回归测试清单 U2):
 *   - unwrapAngles: 跨 ±180° 不回跳(相邻差 ≤180)且 mod 360 等价; golden 回放
 *   - hermiteAt: 节点处精确过点; C1 连续(左右差商之差随步长线性消失); golden 回放
 *   - sampleCameraKey / sampleTimedCameraKey: 首尾帧等于首尾 camKey; golden 回放
 *     (P2 起 ensureCamKeys/cameraKeyProgress/ensure*Times 已迁 core/project-data.js
 *      并被 timing-math 真 import —— 改为直接 import 模块回放, 断言不变;
 *      另保留一条产物断言钉住桥继续按原名暴露这两个全局)
 * 运行: node 测试/回归/U2_orientation_spline.mjs
 */
import { bootApp } from './harness/vm-app.mjs';
import { importTimingMath, loadTimingGolden, sameAsGolden, diffText } from './harness/timing-env.mjs';
import { UNWRAP_CASES, HERMITE_FIXTURE, HERMITE_US, buildCameraShot, CAMERA_SHOT_DATA, CAMERA_SAMPLE_US, CAMERA_SAMPLE_ATS } from './timing_fixtures.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const { tm, THREE } = await importTimingMath();
const golden = loadTimingGolden().U2;

/* ---- unwrapAngles ---- */
console.log('· unwrapAngles: golden 回放 + 不回跳/mod360 性质');
UNWRAP_CASES.forEach((values, i) => {
  const out = tm.unwrapAngles(values.slice());
  assert(sameAsGolden(out, golden.unwrapAngles[i]), `unwrapAngles case ${i}: ${diffText(out, golden.unwrapAngles[i])}`);
  for (let k = 1; k < out.length; k++) {
    assert(Math.abs(out[k] - out[k - 1]) <= 180 + 1e-9, `case ${i}: 相邻角差 ≤180(第 ${k} 步 ${out[k] - out[k - 1]})`);
    const mod = ((out[k] - (values[k] || 0)) % 360 + 360) % 360;
    assert(mod < 1e-9 || Math.abs(mod - 360) < 1e-9, `case ${i}: 解卷绕后与原角 mod 360 等价`);
  }
});
assert(sameAsGolden(tm.unwrapAngles([170, -170]), [170, 190]), '[170,-170] → [170,190](人工验算样例)');

/* ---- hermiteAt ---- */
console.log('· hermiteAt: golden 回放 + 节点精确过点 + C1 连续');
{
  const { values, us } = HERMITE_FIXTURE;
  const table = HERMITE_US.map(u => tm.hermiteAt(values.slice(), us.slice(), u));
  assert(sameAsGolden(table, golden.hermiteAt), 'hermiteAt 打表与基准不逐位一致');
  us.forEach((u, i) => assert(Math.abs(tm.hermiteAt(values, us, u) - values[i]) < 1e-9,
    `节点 u=${u} 精确过点 values[${i}]=${values[i]}`));
  /* C1: 内部节点左右差商之差应随 h 线性消失(真拐点则不收敛) */
  for (const u of us.slice(1, -1)) {
    const gap = h => {
      const left = (tm.hermiteAt(values, us, u) - tm.hermiteAt(values, us, u - h)) / h;
      const right = (tm.hermiteAt(values, us, u + h) - tm.hermiteAt(values, us, u)) / h;
      return Math.abs(right - left);
    };
    const g1 = gap(1e-3), g2 = gap(1e-4);
    assert(g2 < g1 * 0.2 + 1e-9 && g2 < 0.05, `u=${u} 处 C1 连续(差商差 ${g1.toExponential(2)}→${g2.toExponential(2)} 线性消失)`);
  }
  assert(tm.hermiteAt([7], [0], 0.5) === 7, '单值退化返回 values[0]');
}

/* ---- sampleCameraKey / sampleTimedCameraKey(P2 起直接 import 回放)---- */
console.log('· sampleCameraKey: golden 回放 + 首尾帧性质');
const app = bootApp();
const S = app.sandbox;
assert(typeof S.sampleCameraKey === 'function' && typeof S.sampleTimedCameraKey === 'function',
  '交付产物暴露 sampleCameraKey/sampleTimedCameraKey 全局(P1 桥契约)');
golden.sampleCameraKey.forEach(({ nodeAligned, samples }) => {
  const shot = buildCameraShot(THREE);
  const actual = CAMERA_SAMPLE_US.map(u => tm.sampleCameraKey(shot, u, nodeAligned));
  assert(sameAsGolden(actual, samples), `sampleCameraKey(nodeAligned=${nodeAligned}) 打表与基准不逐位一致`);
  const keys = CAMERA_SHOT_DATA.camKeys;
  const first = actual[0], last = actual[actual.length - 1];
  const modEq = (a, b) => { const m = ((a - b) % 360 + 360) % 360; return m < 1e-6 || Math.abs(m - 360) < 1e-6; };
  assert(modEq(first.yaw, keys[0].yaw) && first.pitch === keys[0].pitch && first.fov === keys[0].fov,
    `nodeAligned=${nodeAligned}: u=0 等于首 camKey`);
  assert(modEq(last.yaw, keys[keys.length - 1].yaw) && last.pitch === keys[keys.length - 1].pitch && last.fov === keys[keys.length - 1].fov,
    `nodeAligned=${nodeAligned}: u=1 等于尾 camKey`);
});

console.log('· sampleTimedCameraKey: golden 回放 + 首尾帧性质');
{
  const shot = buildCameraShot(THREE);
  const actual = CAMERA_SAMPLE_ATS.map(at => tm.sampleTimedCameraKey(shot, at));
  assert(sameAsGolden(actual, golden.sampleTimedCameraKey), 'sampleTimedCameraKey 打表与基准不逐位一致');
  const keys = CAMERA_SHOT_DATA.camKeys;
  const first = actual[0], last = actual[actual.length - 1];
  assert(first.yaw === keys[0].yaw && first.pitch === keys[0].pitch && first.fov === keys[0].fov, 'at=0 等于首 camKey');
  assert(last.yaw === keys[keys.length - 1].yaw && last.pitch === keys[keys.length - 1].pitch && last.fov === keys[keys.length - 1].fov,
    'at=dur 等于尾 camKey');
}

console.log(`\nU2 朝向样条: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

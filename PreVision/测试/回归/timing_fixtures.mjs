/*
 * U1/U2/U3/U5 · 时间采样纯函数测试的共享 fixture(回归测试清单 §2)
 * 录制(record_golden.mjs)与回放(U*_*.mjs)共用同一份输入, 保证"基准=当前实现在固定输入上的输出"。
 * 全部输入 JSON 可序列化; 需要 THREE.Vector3 的 fixture 提供 build 函数, 由调用方注入 THREE
 * (录制期来自 VM sandbox, 回放期来自 vendor/three.r128.min.js 装入的沙盒)。
 */

/* ---- U1 缓动数学 ---- */
export const NORMALIZE_EASE_INPUTS = [
  'linear', 'constant', 'easeIn', 'easeOut', 'easeInOut', 'custom', 'bogus-string',
  null, undefined, 42, {}, { type: 'bogus' },
  { type: 'custom' },
  { type: 'custom', x1: 2, y1: -1, x2: 0.5, y2: 0.25 },
  { type: 'custom', x1: '0.9', y1: '0.2', x2: '0.1', y2: '0.8' },
  { type: 'easeIn', x1: 0.9 },
];
export const APPLY_EASE_SPECS = [
  { name: 'constant', spec: 'constant' },
  { name: 'linear', spec: 'linear' },
  { name: 'easeIn', spec: 'easeIn' },
  { name: 'easeOut', spec: 'easeOut' },
  { name: 'easeInOut', spec: 'easeInOut' },
  { name: 'custom-standard', spec: { type: 'custom', x1: 0.33, y1: 0, x2: 0.67, y2: 1 } },
  { name: 'custom-extreme', spec: { type: 'custom', x1: 1, y1: 0, x2: 0, y2: 1 } },
];
/* 0.1 步长打表 + 越界钳制点(清单 U1: 端点/单调性人工核对) */
export const EASE_TS = [-0.5, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5];
export const CUBIC_BEZIER_SPEC = { x1: 0.2, y1: 0.1, x2: 0.8, y2: 0.9 };
export const CUBIC_BEZIER_XS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];

/* ---- U2 朝向样条与解卷绕 ---- */
export const UNWRAP_CASES = [
  [170, -170],
  [170, -170, -90],
  [-170, 170, 150, -150],
  [0, 350, -350],
  [10],
  [],
];
export const HERMITE_FIXTURE = { values: [0, 10, -5, 3], us: [0, 0.3, 0.7, 1] };
export const HERMITE_US = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
/* 机位样条 fixture: 非等距 3 点 + 跨 ±180° yaw(解卷绕路径) */
export const CAMERA_SHOT_DATA = {
  dur: 5, fov: 40, camMode: 'curve',
  camPts: [[0, 2, 6], [2, 2, 3], [5, 2, 2]],
  camKeys: [
    { yaw: 170, pitch: 0, fov: 40 },
    { yaw: -170, pitch: 30, fov: 60 },
    { yaw: -90, pitch: -20, fov: 50 },
  ],
};
export const CAMERA_SAMPLE_US = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
export const CAMERA_SAMPLE_ATS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
export function buildCameraShot(THREE) {
  const d = CAMERA_SHOT_DATA;
  return {
    dur: d.dur, fov: d.fov, camMode: d.camMode,
    camPts: d.camPts.map(p => new THREE.Vector3(p[0], p[1], p[2])),
    camKeys: d.camKeys.map(k => ({ ...k })),
  };
}

/* ---- U3 pointSync 节点同步 ---- */
export const INV_SMOOTH_US = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5,
  0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
export const NODE_ARRIVAL_CASES = [];
for (const count of [1, 2, 3, 4, 5]) {
  for (let index = 0; index < count; index++) NODE_ARRIVAL_CASES.push({ index, count, dur: 6 });
}
/* 两组控制点: 等距直线 / 极不等距 S 形(清单 U3) */
export const PATH_EQUIDISTANT = [[0, 0, 0], [2, 0, 0], [4, 0, 0], [6, 0, 0]];
export const PATH_UNEVEN_S = [[0, 0, 0], [0.5, 0, 0.2], [6, 0, 2], [6.5, 0, 8], [-2, 0, 9]];
export const ARC_RATIOS = [0, 0.25, 0.5, 0.75, 1];
export function buildPathActor(THREE, pathData, pathMode) {
  return { pathMode, pathPts: pathData.map(p => new THREE.Vector3(p[0], p[1], p[2])) };
}

/* ---- U5 弧长参数化与路径采样 ---- */
export const TIMED_PATH_CASES = [
  { name: '端点与中段', times: [0, 2, 8], ats: [-1, 0, 1, 2, 5, 8, 9], eases: null },
  { name: 'easeIn+linear', times: [0, 2, 8], ats: [1, 3, 6], eases: [{ type: 'easeIn' }, { type: 'linear' }] },
  { name: 'constant 段(弧长参数)', times: [0, 4, 8], ats: [1, 2, 3, 6], eases: [{ type: 'constant' }, { type: 'linear' }] },
  { name: '乱序 times', times: [5, 2, 8], ats: [1, 3, 6, 7], eases: null },
  { name: '重复 times', times: [0, 0, 8], ats: [0, 0.5, 4], eases: null },
];
export const TIMED_PATH_POINTS = [[0, 0, 0], [1, 0, 0], [1, 0, 4]];
export const TIMED_VALUE_CASES = [
  { name: '端点与中段', values: [10, 20, 40], times: [0, 1, 4], ats: [-1, 0, 0.5, 1, 2, 4, 5], eases: null },
  { name: 'easeOut 段', values: [10, 20, 40], times: [0, 1, 4], ats: [0.5, 2], eases: [{ type: 'easeOut' }, { type: 'easeOut' }] },
  { name: '单值退化', values: [7], times: [0], ats: [0, 3], eases: null },
  { name: '空值退化', values: [], times: [], ats: [0, 1], eases: null },
];
export const POINT_INDEXED_US = [0, 0.25, 0.5, 0.75, 1];
export const POINT_INDEXED_PATHS = [
  { name: 'line-uneven', mode: 'line', points: PATH_UNEVEN_S },
  { name: 'curve-uneven', mode: 'curve', points: PATH_UNEVEN_S },
];

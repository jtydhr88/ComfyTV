/*
 * U1/U2/U3/U5 · 直接 import core/timing-math.js 的最小环境
 * (回归测试清单 §2: 对应模块拆出后改直接 import, 断言一字不改)。
 * timing-math 里 actorCurve/pointIndexed* 引用全局 THREE(交付契约: vendor 块先行),
 * 这里把 vendor/three.r128.min.js 装入沙盒后挂到 globalThis, 再动态 import 模块。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { threeSrc, root } from './vm-app.mjs';

export function loadThree() {
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(threeSrc, sandbox, { filename: 'three.min.js' });
  if (!sandbox.THREE?.Vector3) throw new Error('vendor Three.js 未产出 THREE.Vector3');
  return sandbox.THREE;
}

export async function importTimingMath() {
  if (!globalThis.THREE) globalThis.THREE = loadThree();
  return { THREE: globalThis.THREE, tm: await import('../../../src/core/timing-math.js') };
}

export function loadTimingGolden() {
  return JSON.parse(fs.readFileSync(path.join(root, 'qa', 'golden', 'timing', 'timing-math.json'), 'utf8'));
}

/* golden 比对: 实际值经 JSON round-trip canonical 化(-0→0、剔除 undefined 键)后要求逐位相等 ——
 * 纯函数搬运在相同输入上必须产生逐位相同的双精度结果, 有任何浮点漂移都当红灯看待。 */
export function sameAsGolden(actual, golden) {
  return JSON.stringify(JSON.parse(JSON.stringify(actual))) === JSON.stringify(golden);
}
export function diffText(actual, golden) {
  return `实际 ${JSON.stringify(actual)} ≠ 基准 ${JSON.stringify(golden)}`;
}

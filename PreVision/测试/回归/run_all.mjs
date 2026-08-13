/*
 * 回归安全网 · 总入口
 * 依次跑最小回归测试集(回归测试清单 §5)并汇总 PASS/FAIL。
 * 运行: node 测试/回归/run_all.mjs
 * 退出码: 任一项失败 → 1(可直接挂 CI / npm script)。
 *
 * V1(视觉基准)不在本入口内 —— 待办: 需在项目主人机器上以 playwright-core 驱动
 * Electron 壳录制真像素基准(VM 里 WebGLRenderer 是 stub, 没有像素), 见清单 §3。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SUITES = [
  ['C1', 'C1_previz_roundtrip.mjs', '.previz.json v5 加载→保存字节级 round-trip'],
  ['C2', 'C2_legacy_migration.mjs', 'v3/v4→v5 迁移快照 + corrupt/future 拒绝'],
	  ['C3', 'C3_genprompt_baseline.mjs', 'genPrompt 逐镜头逐字符基准'],
	  ['C4', 'C4_startup_classification.mjs', 'localStorage 启动四分类 + 零回写'],
	  ['C5', 'C5_seedance_package.mjs', 'Seedance 五件套 ZIP 结构 + 冻结目标'],
	  ['C6', 'C6_makezip_bytes.mjs', 'makeZip 字节级基准 + zip 结构自检'],
	  ['C7', 'C7_seedance_white_model_profile.mjs', 'Seedance 2.5 白模事务 + 同源采样/manifest'],
	  ['P8', 'P8_module_boundaries.mjs', '播放/视口/导出模块边界守门'],
	  ['P9', 'P9_module_boundaries.mjs', 'UI/持久化/主入口模块边界守门'],
	  ['U4', 'U4_normalize_malformed.mjs', 'normalizeProjectData 畸形输入表'],
  ['U1', 'U1_easing_math.mjs', '缓动数学(core/timing-math golden 回放+性质)'],
  ['U2', 'U2_orientation_spline.mjs', '朝向样条与解卷绕(hermite/unwrap/相机采样)'],
  ['U3', 'U3_point_sync.mjs', 'pointSync 节点同步(到达时刻/弧长参数)'],
  ['U5', 'U5_arclength_sampling.mjs', '弧长参数化与路径采样(timed*/pointIndexed*)'],
  ['U6', 'U6_reframe_math.mjs', '9:16 重构图纯数学 + 故障恢复'],
  ['C8', 'C8_build_gate.mjs', '构建产物形状守门(重建幂等+字节一致+形状)'],
];

const results = [];
for (const [id, file, desc] of SUITES) {
  console.log(`\n━━━ ${id} · ${desc} ━━━`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(dir, file)], { stdio: 'inherit' });
  results.push({ id, desc, ok: run.status === 0, seconds: ((Date.now() - started) / 1000).toFixed(1) });
}

console.log('\n════════ 回归安全网汇总 ════════');
for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  ${r.desc}(${r.seconds}s)`);
console.log('  SKIP  V1  视觉基准(待办: 需真机 Electron+GPU 录制, VM 无像素)');
const failedCount = results.filter(r => !r.ok).length;
console.log(failedCount ? `\n${failedCount} 项失败` : '\n全部通过');
process.exit(failedCount ? 1 : 0);

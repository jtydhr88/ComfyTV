/*
 * golden 基准录制器(回归测试清单 §5 规程)
 * 运行: node 测试/回归/record_golden.mjs [--update]
 *   - 默认拒绝覆盖已存在的基准(qa/golden 只进不改); 有意换基准时用 --update,
 *     并在 commit message 写明"基准变更:<原因>"。
 * 录制内容:
 *   - qa/golden/projects/*.previz.json   C1: 由当前版本应用 open→save canonical 化,
 *     且做"存盘→读回→再存盘"定点校验(两次输出逐字节一致才收录)。
 *   - qa/golden/prompts/<项目>_S{n}C{m}.txt  C3: 逐镜头 genPrompt 文本。
 *   - qa/golden/zip/makezip-basic.bin    C6: makeZip 固定输入字节基准。
 *   - qa/golden/legacy/*                 C2: v3/v4 输入 + 当前 normalizeProjectData 输出快照。
 *   - qa/golden/timing/timing-math.json  U1/U2/U3/U5: 时间采样纯函数在固定输入上的打表
 *     (P1 拆 E 子系统前由未拆分实现录制, 之后由 core/timing-math.js 回放, 钉死"搬运未改行为")。
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, captureSave, root } from './harness/vm-app.mjs';
import { ridePanoSource, camworkSource, v3LegacySource, v4LegacySource, futureSource, zipFixtureFiles } from './golden_sources.mjs';
import {
  NORMALIZE_EASE_INPUTS, APPLY_EASE_SPECS, EASE_TS, CUBIC_BEZIER_SPEC, CUBIC_BEZIER_XS,
  UNWRAP_CASES, HERMITE_FIXTURE, HERMITE_US, buildCameraShot, CAMERA_SAMPLE_US, CAMERA_SAMPLE_ATS,
  INV_SMOOTH_US, NODE_ARRIVAL_CASES, PATH_EQUIDISTANT, PATH_UNEVEN_S, ARC_RATIOS, buildPathActor,
  TIMED_PATH_CASES, TIMED_PATH_POINTS, TIMED_VALUE_CASES, POINT_INDEXED_US, POINT_INDEXED_PATHS,
} from './timing_fixtures.mjs';

const UPDATE = process.argv.includes('--update');
const goldenRoot = path.join(root, 'qa', 'golden');

function writeGolden(relPath, contents) {
  const abs = path.join(goldenRoot, relPath);
  if (fs.existsSync(abs) && !UPDATE) {
    const existing = fs.readFileSync(abs);
    const next = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');
    if (!existing.equals(next)) throw new Error(`拒绝覆盖已存在的基准(只进不改): ${relPath}(如系有意变更, 用 --update)`);
    console.log(`  = 未变化: ${relPath}`);
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
  console.log(`  + 写入: ${relPath}(${Buffer.byteLength(contents)} 字节)`);
}

/* 在全新 VM 里 open→save, 返回序列化文本(canonical 形态) */
async function canonicalize(projectData) {
  const app = bootApp();
  const ok = app.T.openProjectData(projectData);
  if (!ok || app.sandbox.__alerts.length) throw new Error(`openProjectData 失败: alerts=${JSON.stringify(app.sandbox.__alerts)}`);
  return (await captureSave(app.T)).contents;
}

/* 定点校验: 反复 存盘→读回→再存盘, 直到两次输出逐字节一致才收录。
 * (第一轮 canonical 化会把手工构造/boot 态的键序统一成 normalize+stageToData 的键序,
 *  第二轮起必须稳定; 若 4 轮不收敛说明序列化本身不确定 —— 直接报错, 不收录。) */
async function fixpoint(name, sourceData, maxPasses = 4) {
  let prev = await canonicalize(sourceData);
  for (let pass = 2; pass <= maxPasses; pass++) {
    const next = await canonicalize(JSON.parse(prev));
    if (next === prev) return prev;
    prev = next;
  }
  throw new Error(`${name}: 存盘→读回→再存盘 ${maxPasses} 轮未达定点`);
}
async function recordProject(name, sourceData) {
  console.log(`· 录制 golden 项目: ${name}`);
  const text = await fixpoint(name, sourceData);
  writeGolden(path.join('projects', `${name}.previz.json`), text);
  return text;
}

async function recordPrompts(name, goldenText) {
  console.log(`· 录制 genPrompt 基准: ${name}`);
  const app = bootApp();
  if (!app.T.openProjectData(JSON.parse(goldenText))) throw new Error(`${name}: golden 打不开`);
  const project = app.T.project;
  for (let s = 0; s < project.scenes.length; s++) {
    app.T.loadScene(s, true);
    for (let c = 0; c < app.T.shots.length; c++) {
      app.T.setShot(c, true);
      const prompt = app.T.genPrompt();
      if (!prompt || !prompt.includes('【任务类型】')) throw new Error(`${name} S${s + 1}C${c + 1}: genPrompt 输出异常`);
      writeGolden(path.join('prompts', `${name}_S${s + 1}C${c + 1}.txt`), prompt);
    }
  }
}

async function recordZip() {
  console.log('· 录制 makeZip 字节基准');
  const app = bootApp();
  const blob = app.T.makeZip(zipFixtureFiles());
  const bytes = Buffer.from(await blob.arrayBuffer());
  writeGolden(path.join('zip', 'makezip-basic.bin'), bytes);
}

function recordLegacy() {
  console.log('· 录制 legacy 迁移快照(v3/v4 → v5)');
  const app = bootApp();
  for (const [name, source] of [['v3', v3LegacySource()], ['v4', v4LegacySource()]]) {
    writeGolden(path.join('legacy', `${name}-input.json`), JSON.stringify(source, null, 2) + '\n');
    const expected = JSON.parse(JSON.stringify(app.T.normalizeProjectData(source)));
    if (expected.version !== 5) throw new Error(`${name}: 迁移输出 version=${expected.version}, 应为 5`);
    writeGolden(path.join('legacy', `${name}-expected.json`), JSON.stringify(expected, null, 2) + '\n');
  }
  writeGolden(path.join('legacy', 'corrupt-input.txt'), '{"app":"PreVision","version":5,"scenes":[{"name":"截断的');
  writeGolden(path.join('legacy', 'future-input.json'), JSON.stringify(futureSource(), null, 2) + '\n');
  /* 拒绝分支自检: corrupt 走 JSON.parse 失败, future 走 invalidProject */
  let futureRejected = false;
  try { app.T.normalizeProjectData(futureSource()); } catch (e) { futureRejected = e.code === 'PREVISION_INVALID_PROJECT'; }
  if (!futureRejected) throw new Error('future-input 未被 invalidProject 拒绝');
}

/* golden 1: welcome —— 首启白马骑手项目, 由 firstRun boot 的应用自己存出 */
async function recordWelcome() {
  console.log('· 录制 golden 项目: welcome(firstRun 白马骑手)');
  const app = bootApp(); // 无 autosave 种子 → firstRun
  if (app.T.startupState !== 'firstRun') throw new Error('boot 未进入 firstRun');
  const bootSave = (await captureSave(app.T)).contents;
  const text = await fixpoint('welcome', JSON.parse(bootSave));
  writeGolden(path.join('projects', 'welcome.previz.json'), text);
  return text;
}

/* U1/U2/U3/U5: 时间采样纯函数打表。函数取自 VM sandbox 全局(拆分前=script 顶层声明,
 * 拆分后=构建桥 Object.assign(globalThis,…) 暴露的 core/timing-math.js 同名函数),
 * 因此 --update 在任何阶段录到的都是"当前交付产物"的行为。 */
export function computeTimingGolden(S) {
  const THREE = S.THREE;
  const j = value => JSON.parse(JSON.stringify(value)); /* canonical 化: -0→0, undefined 键剔除 */
  const golden = { U1: {}, U2: {}, U3: {}, U5: {} };

  golden.U1.normalizeEaseSpec = NORMALIZE_EASE_INPUTS.map(input => j(S.normalizeEaseSpec(j2(input))));
  golden.U1.applyEaseSpec = APPLY_EASE_SPECS.map(({ name, spec }) => ({
    name, values: EASE_TS.map(t => j(S.applyEaseSpec(j2(spec), t))),
  }));
  golden.U1.cubicBezierEase = CUBIC_BEZIER_XS.map(x => j(S.cubicBezierEase(x, { ...CUBIC_BEZIER_SPEC })));

  golden.U2.unwrapAngles = UNWRAP_CASES.map(values => j(S.unwrapAngles(values.slice())));
  golden.U2.hermiteAt = HERMITE_US.map(u => j(S.hermiteAt(HERMITE_FIXTURE.values.slice(), HERMITE_FIXTURE.us.slice(), u)));
  golden.U2.sampleCameraKey = [false, true].map(nodeAligned => {
    const shot = buildCameraShot(THREE);
    return { nodeAligned, samples: CAMERA_SAMPLE_US.map(u => j(S.sampleCameraKey(shot, u, nodeAligned))) };
  });
  {
    const shot = buildCameraShot(THREE);
    golden.U2.sampleTimedCameraKey = CAMERA_SAMPLE_ATS.map(at => j(S.sampleTimedCameraKey(shot, at)));
  }

  golden.U3.inverseSmoothProgress = INV_SMOOTH_US.map(u => j(S.inverseSmoothProgress(u)));
  golden.U3.nodeArrivalTime = NODE_ARRIVAL_CASES.map(c => j(S.nodeArrivalTime(c.index, c.count, c.dur)));
  const arcConfigs = [
    ['equidistant-line', PATH_EQUIDISTANT, 'line'],
    ['equidistant-curve', PATH_EQUIDISTANT, 'curve'],
    ['uneven-line', PATH_UNEVEN_S, 'line'],
    ['uneven-curve', PATH_UNEVEN_S, 'curve'],
  ];
  golden.U3.segmentArcParameter = arcConfigs.map(([name, pathData, mode]) => {
    const actor = buildPathActor(THREE, pathData, mode);
    const curve = S.actorCurve(actor);
    const count = actor.pathPts.length;
    const segments = [];
    for (let segment = 0; segment < count - 1; segment++) {
      segments.push(ARC_RATIOS.map(ratio => j(S.segmentArcParameter(curve, segment, count, ratio))));
    }
    return { name, segments };
  });
  golden.U3.curveProgressAtControlPoint = arcConfigs.map(([name, pathData, mode]) => {
    const actor = buildPathActor(THREE, pathData, mode);
    const curve = S.actorCurve(actor);
    return { name, values: actor.pathPts.map((p, i) => j(S.curveProgressAtControlPoint(curve, p, i, actor.pathPts.length))) };
  });

  const timedActor = buildPathActor(THREE, TIMED_PATH_POINTS, 'curve');
  const timedCurve = S.actorCurve(timedActor);
  golden.U5.timedPathState = TIMED_PATH_CASES.map(c => ({
    name: c.name,
    states: c.ats.map(at => j(S.timedPathState(timedActor.pathPts, c.times.slice(), at, c.eases && j2(c.eases), timedCurve))),
  }));
  /* times 缺失/长度不符 → distributedPathTimes 兜底(依赖 app.js 全局, 仅经 VM 回放) */
  golden.U5.timedPathStateFallback = [null, [0, 8]].map(times => ({
    times,
    states: [0, 0.25, 0.5, 1].map(at => j(S.timedPathState(timedActor.pathPts, times, at, null, timedCurve))),
  }));
  golden.U5.timedValueState = TIMED_VALUE_CASES.map(c => ({
    name: c.name,
    states: c.ats.map(at => j(S.timedValueState(c.values.slice(), c.times.slice(), at, c.eases && j2(c.eases)))),
  }));
  golden.U5.pointIndexed = POINT_INDEXED_PATHS.map(({ name, mode, points }) => {
    const actor = buildPathActor(THREE, points, mode);
    const curve = S.actorCurve(actor);
    return {
      name,
      positions: POINT_INDEXED_US.map(u => j(S.pointIndexedPosition(actor.pathPts, mode, curve, u).toArray())),
      tangents: POINT_INDEXED_US.map(u => j(S.pointIndexedTangent(actor.pathPts, mode, curve, u).toArray())),
    };
  });
  return golden;
}
/* fixture 深拷贝(undefined 原样透传, 其余走 JSON) */
function j2(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }

function recordTiming() {
  console.log('· 录制时间采样纯函数基准(U1/U2/U3/U5)');
  const app = bootApp();
  const golden = computeTimingGolden(app.sandbox);
  writeGolden(path.join('timing', 'timing-math.json'), JSON.stringify(golden, null, 2) + '\n');
}

const goldenTexts = {};
goldenTexts['welcome'] = await recordWelcome();
goldenTexts['ride-pano'] = await recordProject('ride-pano', ridePanoSource());
goldenTexts['camwork'] = await recordProject('camwork', camworkSource());
for (const [name, text] of Object.entries(goldenTexts)) await recordPrompts(name, text);
await recordZip();
recordLegacy();
recordTiming();
console.log('\n录制完成。请人工核对 qa/golden/ 下的内容后再 commit(见 qa/golden/README.md 规程)。');

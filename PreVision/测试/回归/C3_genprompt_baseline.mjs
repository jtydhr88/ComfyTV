/*
 * C3 · genPrompt 输出基准(逐字符)
 * 契约: golden 项目每个镜头的 genPrompt() 输出与 qa/golden/prompts/<项目>_S{n}C{m}.txt
 *       逐字符相同(架构地图 §5.4)。钉死【角色:/【动物:/【道具:标记体系、数量声明、
 *       焦段/机位高度/运镜速度数字、骑乘"全程不下马"、结尾负面约束 —— 这些是 R1/R2
 *       实测校准的提示词资产。同时间接钉死 sampleShotState 的 time 借用-归还。
 * 注意: 有意改提示词模板时用 record_golden.mjs --update 重录, 并在 commit message
 *       注明"提示词模板变更", 与重构手滑改坏区分开。
 * 运行: node 测试/回归/C3_genprompt_baseline.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { bootApp, root } from './harness/vm-app.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const projectsDir = path.join(root, 'qa', 'golden', 'projects');
const promptsDir = path.join(root, 'qa', 'golden', 'prompts');
const goldenFiles = fs.readdirSync(projectsDir).filter(f => f.endsWith('.previz.json')).sort();
const promptFiles = new Set(fs.readdirSync(promptsDir).filter(f => f.endsWith('.txt')));
const consumed = new Set();

for (const file of goldenFiles) {
  const name = file.replace(/\.previz\.json$/, '');
  console.log('· ' + name);
  const app = bootApp();
  const opened = app.T.openProjectData(JSON.parse(fs.readFileSync(path.join(projectsDir, file), 'utf8')));
  assert(opened === true, `${name}: golden 可打开`);
  if (!opened) continue;
  for (let s = 0; s < app.T.project.scenes.length; s++) {
    app.T.loadScene(s, true);
    for (let c = 0; c < app.T.shots.length; c++) {
      app.T.setShot(c, true);
      const baseFile = `${name}_S${s + 1}C${c + 1}.txt`;
      consumed.add(baseFile);
      if (!promptFiles.has(baseFile)) {
        failed++; console.error(`  ✗ FAIL: 缺基准文件 ${baseFile}(新镜头需 --update 录制)`);
        continue;
      }
      const expected = fs.readFileSync(path.join(promptsDir, baseFile), 'utf8');
      const actual = app.T.genPrompt();
      const timeAfter = app.T.time;
      assert(timeAfter === 0, `${baseFile}: genPrompt 借用 time 后归还(实际 time=${timeAfter})`);
      if (actual === expected) { passed++; continue; }
      failed++;
      console.error(`  ✗ FAIL: ${baseFile}: genPrompt 输出与基准不逐字符一致`);
      const a = expected.split('\n'), b = actual.split('\n');
      for (let i = 0, shown = 0; i < Math.max(a.length, b.length) && shown < 4; i++) {
        if (a[i] !== b[i]) { console.error(`    行 ${i + 1}:\n    基准: ${a[i]}\n    实际: ${b[i]}`); shown++; }
      }
    }
  }
}

const orphans = [...promptFiles].filter(f => !consumed.has(f));
assert(orphans.length === 0, `prompts 目录无孤儿基准(多余: ${orphans.join(', ')})`);
assert(consumed.size >= 8, `基准覆盖 ≥8 个镜头(实际 ${consumed.size})`);

console.log(`\nC3 genPrompt 基准: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

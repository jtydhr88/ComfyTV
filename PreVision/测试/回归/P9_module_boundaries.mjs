/* P9 · UI / persistence / main ownership guard. */
import fs from 'node:fs';
import path from 'node:path';
import { root } from './harness/vm-app.mjs';
import { assembleRuntimeSource, buildHtml, splitAppImports } from '../../scripts/build-app.mjs';

let passed = 0, failed = 0;
function assert(condition, message) {
  if (condition) passed++;
  else { failed++; console.error(`  ✗ FAIL: ${message}`); }
}
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(root, rel));
const main = read('src/main.js');
const shell = read('src/ui/shell.js');
const timeline = read('src/ui/timeline.js');
const inspector = read('src/ui/inspector.js');
const persistence = read('src/persist/persistence.js');
const runtime = assembleRuntimeSource();
const assembledClassic = splitAppImports(runtime).stripped;
const html = buildHtml();
const appBlock = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];

console.log('· P9 source ownership');
assert(!exists('src/app.js'), 'legacy src/app.js is removed after ownership transfer');
assert(main.includes('/* @p9:ui-shell */') && main.includes('/* @p9:timeline */') && main.includes('/* @p9:inspector */') && main.includes('/* @p9:persistence */'),
  'main contains one explicit insertion point for each P9 owner fragment');
assert(/function\s+setUITheme\s*\(/.test(shell) && /function\s+initRightResize\s*\(/.test(shell), 'shell owns A+M theme/layout and right resize');
assert(/function\s+refreshMotionTimeline\s*\(/.test(timeline) && /function\s+scheduleThumbs\s*\(/.test(timeline), 'timeline owns N tracks and thumbnail scheduling');
assert(/function\s+refreshObjectTransformUI\s*\(/.test(inspector) && /function\s+showConfirm\s*\(/.test(inspector), 'inspector owns O+U refresh and confirmation UI');
assert(/function\s+markDirty\s*\(/.test(persistence) && /function\s+openProjectData\s*\(/.test(persistence) && /async\s+function\s+dl\s*\(/.test(persistence),
  'persistence owns history/autosave/open-save/download flows');
assert(/\(function boot\(\)/.test(main) && /window\.addEventListener\('keydown'/.test(main), 'main owns explicit boot and top-level command routing');

console.log('· assembled classic runtime');
assert(!/^\s*import\b/m.test(assembledClassic), 'assembled classic runtime has no browser module import declaration');
assert(runtime.indexOf('function setUITheme') < runtime.indexOf('function refreshMotionTimeline'), 'shell initializes before timeline declarations in the assembled runtime');
assert(assembledClassic.includes('(function boot(){') && appBlock.includes('function normalizeProjectData') && appBlock.includes('function genPrompt'), 'assembled runtime and bridge contain existing contract and boot surfaces');
const registrations = [...appBlock.matchAll(/refresh\.register\(\s*['"][^'"]+['"]/g)];
assert(registrations.length === 22, `RefreshHub registration count is 22 (actual ${registrations.length})`);
assert(/setTimeout\(renderShotThumbs,180\)/.test(timeline), 'scheduleThumbs retains the 180ms debounce');

console.log('· generated delivery shape');
assert([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].length === 2, 'generated HTML retains exactly two bare script blocks');
assert(!html.includes('@p9:'), 'P9 assembly markers do not leak into generated HTML');

console.log(`\nP9 module boundaries: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

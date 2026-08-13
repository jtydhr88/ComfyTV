/*
 * P8 · playback / viewport / capture module boundary guard
 * Run: node 测试/回归/P8_module_boundaries.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { root } from './harness/vm-app.mjs';
import { assembleRuntimeSource } from '../../scripts/build-app.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const app = assembleRuntimeSource();
const shell = read('src/ui/shell.js');
const inspector = read('src/ui/inspector.js');
const persistence = read('src/persist/persistence.js');
const engine = read('src/playback/engine.js');
const viewport = read('src/viewport/interact.js');
const capture = read('src/export/capture.js');
const reframe = read('src/core/reframe.js');
const prompt = read('src/export/prompt.js');

function parseModuleSource(name, src) {
  try { return acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch (error) { throw new Error(`${name} parse failed: ${error.message}`); }
}

function walkAst(node, visitor, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visitor(node, parent);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (Array.isArray(value)) value.forEach(child => walkAst(child, visitor, node));
    else if (value && typeof value.type === 'string') walkAst(value, visitor, node);
  }
}

function exportedNames(ast) {
  const names = new Set();
  for (const node of ast.body) {
    if (node.type !== 'ExportNamedDeclaration') continue;
    if (node.declaration?.id?.name) names.add(node.declaration.id.name);
    for (const specifier of node.specifiers || []) names.add(specifier.exported.name);
  }
  return names;
}

const engineAst = parseModuleSource('playback', engine);
const viewportAst = parseModuleSource('viewport', viewport);
const captureAst = parseModuleSource('capture', capture);
const moduleAsts = [['playback', engineAst], ['viewport', viewportAst], ['capture', captureAst]];

console.log('· dependency direction');
assert(!/from\s+['"][^'"]*export\/capture\.js['"]/.test(engine) && !/from\s+['"][^'"]*capture\.js['"]/.test(engine),
  'playback engine does not import capture');
assert(!/from\s+['"][^'"]*playback\/engine\.js['"]/.test(capture) && !/from\s+['"][^'"]*engine\.js['"]/.test(capture),
  'capture does not import playback engine');
assert(!/^\s*import\b/m.test(capture), 'capture has no static imports and keeps browser collaborators lazy');
assert(/globalThis\.renderWithResolvedReframe/.test(capture)&&/globalThis\.resolveShotReframe/.test(capture),
  'capture consumes the shared runtime-injected reframe projection without a static import');
assert(!/function\s+(?:computeContainRect|computeReframeProjection|renderWithResolvedReframe)\s*\(/.test(capture),
  'capture does not duplicate reframe projection math');
assert(/function\s+renderWithResolvedReframe\s*\(/.test(reframe)&&/finally\s*\{[\s\S]*restoreRendererFrame[\s\S]*restoreCameraProjection/.test(reframe),
  'shared reframe helper owns explicit renderer and camera restoration');

console.log('· capture direct import');
const captureModule = await import('../../src/export/capture.js');
assert(typeof captureModule.makeZip === 'function' && typeof captureModule.initCaptureBindings === 'function', 'capture direct import exposes makeZip and runtime init');
const zip = captureModule.makeZip([{ name: 'p8.txt', data: new TextEncoder().encode('ok') }]);
assert(zip.type === 'application/zip' && (await zip.arrayBuffer()).byteLength > 0, 'makeZip works after direct Node import');

console.log('· no new clock state bare writes');
for (const [name, ast] of moduleAsts) {
  const violations = [];
  walkAst(ast, node => {
    if (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && /^(time|playing)$/.test(node.left.name)) {
      violations.push(`${node.left.name} ${node.operator}`);
    }
    if (node.type === 'UpdateExpression' && node.argument.type === 'Identifier' && /^(time|playing)$/.test(node.argument.name)) {
      violations.push(`${node.operator}${node.argument.name}`);
    }
  });
  assert(violations.length === 0, `${name}: no bare time/playing assignment or update (${violations.join(', ') || 'none'})`);
}

console.log('· RefreshHub ownership');
const refreshSources = [
  ['assembled-runtime', app],
  ['playback', engine],
  ['viewport', viewport],
  ['capture', capture],
  ['prompt', prompt],
];
const registrations = refreshSources.flatMap(([owner, src]) =>
  [...src.matchAll(/refresh\.register\(\s*['"]([^'"]+)['"]/g)].map(match => ({ owner, topic: match[1] }))
);
const vizRegistrations = registrations.filter(entry => entry.topic === 'viz');
assert(registrations.length === 22, `RefreshHub registration count remains 22 (actual ${registrations.length})`);
assert(vizRegistrations.length === 1 && vizRegistrations[0].owner === 'viewport', 'viz registration is unique and owned by viewport');

console.log('· named handlers and module surfaces');
const viewportExports = exportedNames(viewportAst);
for (const name of ['onCanvasPointerDown', 'onCanvasPointerMove', 'onCanvasPointerUp']) {
  const declarations = [];
  walkAst(viewportAst, node => {
    if (node.type === 'FunctionDeclaration' && node.id?.name === name) declarations.push(node);
  });
  assert(declarations.length === 1, `${name} is exactly one real FunctionDeclaration`);
  assert(viewportExports.has(name), `${name} is exported by viewport`);
}
for (const name of ['updateShotCam', 'updateActors', 'resize', 'renderDirectorViewport', 'loop', 'clearPointPreview', 'previewCameraPoint', 'previewActorPathPoint']) {
  assert(new RegExp(`\\b${name}\\b`).test(engine.match(/export\s*\{[\s\S]*?\};/)?.[0] || ''), `${name} is exported by playback`);
}
for (const name of ['makeZip', 'dataURLtoU8', 'recordBlob', 'exportCurrentShotVideo', 'captureWholePageFrame', 'startWholePageRecording', 'stopWholePageRecording', 'initSeedancePack', 'initCaptureBindings']) {
  assert(new RegExp(`\\b${name}\\b`).test(capture.match(/export\s*\{[\s\S]*?\};/)?.[0] || ''), `${name} is exported by capture`);
}

console.log('· leave-behind list');
assert(/\bconst\s+RIGHTW_KEY\b/.test(shell) && /function\s+initRightResize\s*\(/.test(shell), 'right resize shell is owned by shell');
assert(/function\s+refreshObjectTransformUI\s*\(/.test(inspector) && /function\s+refreshSemanticProxyUI\s*\(/.test(inspector) && /function\s+refreshActorPathUI\s*\(/.test(inspector),
  'inspector refresh UI is owned by inspector');
assert(/async\s+function\s+dl\s*\(/.test(persistence), 'dl persistence helper is owned by persistence');
assert(!/function\s+makeZip\s*\(/.test(app) && /function\s+makeZip\s*\(/.test(capture), 'makeZip remains owned by capture');
assert(/function\s+initSeedancePack\s*\(/.test(capture) && !/\$\('seedancePack'\)\.onclick\s*=/.test(app), 'Seedance binding is owned by capture');

console.log(`\nP8 module boundaries: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

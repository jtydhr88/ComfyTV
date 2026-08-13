/*
 * C8 · 构建产物形状守门
 * 覆盖(回归测试清单 C8 的 ①②③④):
 *   ① 重建幂等 + 字节一致: scripts/build-app.mjs 两次组装输出哈希相同,
 *      且与 git 工作区 预见PreVision.html 逐字节相同(防"改了 src 忘 build 就提交";
 *      P0 期间同时是"构建底座未改变任何东西"的生死线, 拆分方案 §3.3);
 *   ② 产物恰好 2 个无属性 <script> 内联块(冒烟测试提取正则的契约),
 *      块 1 含 THREE.REVISION(内嵌 Three.js), 块 2 为应用层;
 *   ③ 无新增外链: <script src= 白名单 = {vendor/html2canvas.min.js, i18n/ 三件},
 *      且 HTML 标记部分(script 内容之外)不出现任何 http(s):// 资源引用(交付红线);
 *   ④ HTML 全部 on*="…" 内联处理器引用的裸全局函数名 ⊆ 应用脚本顶层声明集合
 *      (死按钮预防; 当前唯一内联处理器是 dialog 的 this.closest(…).close(), 无裸全局)。
 * 运行: node 测试/回归/C8_build_gate.mjs
 */
import { createHash } from 'node:crypto';
import { html, threeSrc, appSrc } from './harness/vm-app.mjs';
import { buildHtml } from '../../scripts/build-app.mjs';

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}

/* ① 重建幂等 + 与工作区字节一致 */
console.log('· 重建幂等 + 字节一致');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const build1 = sha256(buildHtml());
const build2 = sha256(buildHtml());
const workingTree = sha256(html);
assert(build1 === build2, `两次构建输出哈希一致(${build1.slice(0, 12)}… vs ${build2.slice(0, 12)}…)`);
assert(build1 === workingTree,
  `构建输出与工作区 预见PreVision.html 逐字节一致(构建 ${build1.slice(0, 12)}… vs 工作区 ${workingTree.slice(0, 12)}…; 不一致 = 改了 src/shell 忘了 npm run build, 或改了根 HTML 没回灌源文件)`);

/* ② 恰好 2 个无属性 script 块 */
console.log('· script 块形状');
const bareBlocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert(bareBlocks.length === 2, `恰好 2 个无属性 <script> 内联块(实际 ${bareBlocks.length})`);
assert(threeSrc.includes('REVISION'), '块 1 是内嵌 Three.js(含 REVISION)');
assert(/function normalizeProjectData/.test(appSrc) && /function genPrompt/.test(appSrc),
  '块 2 是应用层(含 normalizeProjectData/genPrompt)');
assert(!/<script\s+type=/.test(html), '不存在 type= 变体 script 块(提取正则契约)');

/* ③ 外链白名单 */
console.log('· 外链白名单');
const SRC_WHITELIST = new Set([
  'vendor/html2canvas.min.js',
  'i18n/locales/zh-CN.js',
  'i18n/locales/en-US.js',
  'i18n/runtime.js',
]);
const srcRefs = [...html.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
assert(srcRefs.length === SRC_WHITELIST.size && srcRefs.every(src => SRC_WHITELIST.has(src)),
  `<script src= 集合恰为白名单 4 件(实际 ${JSON.stringify(srcRefs)})`);
/* 剥掉两个内联块的 JS 内容后, 标记部分不得出现任何远程资源引用 */
const markupOnly = html.replace(/<script>[\s\S]*?<\/script>/g, '<script></script>');
const remoteRefs = [...markupOnly.matchAll(/(?:src|href)="(https?:\/\/[^"]*)"/g)].map(m => m[1]);
assert(remoteRefs.length === 0, `HTML 标记部分零 http(s) 外链(实际 ${JSON.stringify(remoteRefs)})`);
assert(!/<link\b[^>]*\bhref="https?:/.test(markupOnly) && !/@import\s+url\(\s*['"]?https?:/.test(markupOnly),
  '无远程样式表/字体引入(Three.js 内嵌、全量本地交付的红线)');

/* ④ on*= 内联处理器的裸全局名完整性 */
console.log('· on*= 内联处理器全局名');
const declaredGlobals = new Set();
for (const m of appSrc.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) declaredGlobals.add(m[1]);
for (const m of appSrc.matchAll(/(?:^|\n)\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declaredGlobals.add(m[1]);
const BUILTIN_OK = new Set(['this', 'event', 'window', 'document', 'localStorage', 'alert', 'confirm', 'prompt']);
const handlers = [...markupOnly.matchAll(/\son([a-z]+)="([^"]*)"/g)];
assert(handlers.length >= 1, `on*= 扫描非空(实际 ${handlers.length} 处; 为 0 说明解析正则失效)`);
let danglingNames = [];
for (const [, type, code] of handlers) {
  /* 提取"作为调用目标的裸标识符"(排除 obj.method(…) 形态的成员调用) */
  for (const m of code.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[1];
    if (BUILTIN_OK.has(name) || declaredGlobals.has(name)) continue;
    danglingNames.push(`on${type}: ${name}`);
  }
}
assert(danglingNames.length === 0,
  `on*= 引用的裸全局函数全部存在于应用脚本顶层声明(悬空: ${JSON.stringify(danglingNames)})`);

console.log(`\nC8 构建守门: ${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

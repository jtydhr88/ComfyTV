/*
 * 预见 PreVision · 拆解-重组构建(P1 esbuild 进场版)
 * 拆分方案 §3.2/§3.3 + ADR-0007:把 app-shell.html 的两个占位注释替换为无属性 <script> 内联块,
 * 产出根目录单文件 预见PreVision.html(交付形态不变:Three.js 内嵌、恰好 2 个内联块)。
 *
 *   块 1 = vendor/three.r128.min.js 逐字节原文
 *   块 2 = 「esbuild 桥」+ src/app.js 剥离 import 后的逐字节残文:
 *     - src/app.js 用标准 ES import 声明对 src/core/* 模块的依赖(AI/IDE 可读的真实依赖边);
 *     - 构建时把这些 import 语句剥离, 并生成桥入口交给 esbuild 打包成 IIFE 前置块,
 *       末尾 Object.assign(globalThis,…) 按 import 清单原名暴露 —— 运行时全局语义与拆分前一致
 *       (script 顶层声明=全局)。为什么不整体 bundle:esbuild 会重排印 app.js 全文,
 *       破坏冒烟测试的逐字符源断言与 var 提升语义, 见 ADR-0007;
 *     - app.js 残文不经任何转换, 逐字节保留。
 *   src/app.js 无 import 时退回 P0 纯拼接(产物 = 逐字节原文)。
 *
 * 用法:
 *   node scripts/build-app.mjs           # 构建一次(npm run build)
 *   node scripts/build-app.mjs --watch   # 监听 shell/vendor/src 变更自动重建(npm run dev)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHELL_PATH = path.join(root, 'app-shell.html');
export const THREE_PATH = path.join(root, 'vendor', 'three.r128.min.js');
export const MAIN_SRC_PATH = path.join(root, 'src', 'main.js');
export const APP_SRC_PATH = MAIN_SRC_PATH; // Compatibility export for older build-gate callers.
const P9_FRAGMENT_PATHS = Object.freeze({
  'ui-shell': path.join(root, 'src', 'ui', 'shell.js'),
  timeline: path.join(root, 'src', 'ui', 'timeline.js'),
  inspector: path.join(root, 'src', 'ui', 'inspector.js'),
  persistence: path.join(root, 'src', 'persist', 'persistence.js'),
});
export const OUT_PATH = path.join(root, '预见PreVision.html');

/* 纯字符串替换(indexOf+slice,规避 String.replace 对替换文本中 $ 序列的特殊解释) */
function replaceOnce(text, marker, replacement) {
  const at = text.indexOf(marker);
  if (at < 0) throw new Error(`app-shell.html 缺少占位符 ${marker}`);
  if (text.indexOf(marker, at + marker.length) >= 0) throw new Error(`占位符 ${marker} 出现多于 1 次`);
  return text.slice(0, at) + replacement + text.slice(at + marker.length);
}

/* 提取并剥离 src/app.js 的顶层具名 import 声明(构建契约: 只允许
 * `import { a, b } from './x.js';` 形态 —— 无别名、无默认/命名空间导入)。 */
const IMPORT_RE = /(?:^|(?<=\n))import\s*\{([^{}]*)\}\s*from\s*(["'])([^"'\n]+)\2;?[^\S\n]*\n?/g;
export function splitAppImports(source) {
  const imports = [];
  const stripped = source.replace(IMPORT_RE, (whole, nameList, _q, spec) => {
    const names = nameList.split(',').map(s => s.trim()).filter(Boolean);
    if (!names.length) throw new Error(`空 import 声明: ${whole.trim()}`);
    for (const name of names) {
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) {
        throw new Error(`import 别名/非法名 "${name}" 不受支持(桥按原名暴露全局, 见 ADR-0007)`);
      }
    }
    if (!spec.startsWith('./') && !spec.startsWith('../')) throw new Error(`import 仅允许相对路径模块: ${spec}`);
    imports.push({ names, spec });
    return '';
  });
  if (/(?:^|\n)[^\S\n]*import[\s{"']/.test(stripped)) {
    throw new Error('src/app.js 存在剥离器不支持的 import 形态(仅支持顶层具名 import)');
  }
  return { imports, stripped };
}

/* P9 keeps the generated application in one classic script lexical environment. Source
 * fragments are inserted only at explicit markers in src/main.js; they are not loaded as
 * independent browser modules, which preserves historical top-level state and inline
 * handler visibility while making ownership files auditable. */
export function assembleRuntimeSource() {
  let source = fs.readFileSync(MAIN_SRC_PATH, 'utf8');
  for (const [name, file] of Object.entries(P9_FRAGMENT_PATHS)) {
    const marker = `/* @p9:${name} */`;
    const count = source.split(marker).length - 1;
    if (count !== 1) throw new Error(`src/main.js must contain exactly one ${marker} marker (actual ${count})`);
    source = replaceOnce(source, marker, fs.readFileSync(file, 'utf8'));
  }
  if (source.includes('@p9:')) throw new Error('src/main.js contains an unknown P9 source marker.');
  return source;
}

/* 生成桥入口并打包: import 全部具名符号 → Object.assign(globalThis,…) 原名暴露 */
function bundleCoreBridge(imports) {
  const esbuild = require('esbuild');
  const allNames = imports.flatMap(entry => entry.names);
  const dup = allNames.find((name, i) => allNames.indexOf(name) !== i);
  if (dup) throw new Error(`import 名重复: ${dup}`);
  const entry = imports.map(({ names, spec }) => `import { ${names.join(', ')} } from ${JSON.stringify(spec)};`).join('\n')
    + `\nObject.assign(globalThis, { ${allNames.join(', ')} });\n`;
  const result = esbuild.buildSync({
    stdin: { contents: entry, resolveDir: path.join(root, 'src'), sourcefile: 'p1-core-bridge.js' },
    bundle: true,
    format: 'iife',      /* 桥自包含; 暴露面只有 Object.assign 清单 */
    charset: 'ascii',    /* P2 起改 ascii(ADR-0008): 契约层携带汉字数据串(锁定哨兵/默认
                          * 标签), 它们是 .previz 数据值而非 UI 文案, 不能改语言键; utf8 会把
                          * 源里的 \uXXXX 还原成裸汉字, 撞 i18n 政策对产物新增行的扫描 */
    minify: false,
    write: false,
    logLevel: 'warning',
  });
  const text = result.outputFiles[0].text;
  if (text.includes('</script>')) throw new Error('桥 bundle 含 </script>, 会破坏内联块形状');
  return text;
}

/** 组装单文件 HTML 文本(不落盘;C8 守门测试直接 import 复用) */
export function buildHtml() {
  const appSource = assembleRuntimeSource();
  const { imports, stripped } = splitAppImports(appSource);
  const appBlock = imports.length ? bundleCoreBridge(imports) + stripped : appSource;
  let out = fs.readFileSync(SHELL_PATH, 'utf8');
  out = replaceOnce(out, '<!--@inline:vendor/three.r128.min.js-->', '<script>' + fs.readFileSync(THREE_PATH, 'utf8') + '</script>');
  out = replaceOnce(out, '<!--@inline:app-bundle-->', '<script>' + appBlock + '</script>');
  /* 产物形状自检(冒烟测试提取正则的契约,拆分方案 §3.2) */
  const bare = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (bare.length !== 2) throw new Error(`产物应恰好 2 个无属性 <script> 块, 实际 ${bare.length}`);
  return out;
}

function buildOnce() {
  const started = Date.now();
  const out = buildHtml();
  fs.writeFileSync(OUT_PATH, out);
  console.log(`[build-app] 预见PreVision.html 已重建 (${Buffer.byteLength(out)} 字节, ${Date.now() - started}ms)`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  buildOnce();
  if (process.argv.includes('--watch')) {
    console.log('[build-app] watch 中:app-shell.html / vendor/three.r128.min.js / src/ 变更即重建 (Ctrl-C 退出)');
    let timer = null;
    const schedule = () => { clearTimeout(timer); timer = setTimeout(() => {
      try { buildOnce(); } catch (e) { console.error('[build-app] 重建失败:', e.message); }
    }, 60); };
    fs.watch(SHELL_PATH, schedule);
    fs.watch(THREE_PATH, schedule);
    fs.watch(path.join(root, 'src'), { recursive: true }, schedule);
  }
}

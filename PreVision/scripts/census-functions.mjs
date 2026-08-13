/*
 * 函数清点工具(拆分方案 §5:纯搬运阶段要求"具名函数集合差异 = 0",防搬丢搬重)
 * 对比"当前构建产物"与"某个 git 提交的 预见PreVision.html"中应用层具名函数名集合。
 *
 * 提取方式:正则收集应用 script 块内全部 `function 名(`(含 async)声明。
 * 方案原文建议 acorn AST;本仓库零新增依赖(P0 唯一获批新依赖 esbuild 尚未进场),
 * 正则对"逐字节搬运"的清点目的等价 —— 搬运不改函数体,声明文本原样存在。
 *
 * 用法:
 *   node scripts/census-functions.mjs              # 当前构建输出 vs HEAD 的根 HTML
 *   node scripts/census-functions.mjs --ref <提交>  # 指定基准提交
 * 退出码:集合有差异 → 1(纯搬运阶段即失败)。
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHtml } from './build-app.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refIdx = process.argv.indexOf('--ref');
const ref = refIdx >= 0 ? process.argv[refIdx + 1] : 'HEAD';

function appBlock(html) {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 2) throw new Error(`HTML 应恰好 2 个无属性 <script> 块, 实际 ${blocks.length}`);
  return blocks[1][1]; /* 块 2 = 应用层 */
}

function namedFunctions(src) {
  const names = new Set();
  for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  return names;
}

const baseHtml = execFileSync('git', ['show', `${ref}:预见PreVision.html`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const baseSet = namedFunctions(appBlock(baseHtml));
const currentSet = namedFunctions(appBlock(buildHtml()));

const removed = [...baseSet].filter(name => !currentSet.has(name)).sort();
const added = [...currentSet].filter(name => !baseSet.has(name)).sort();

console.log(`基准 ${ref}: ${baseSet.size} 个具名函数; 当前构建: ${currentSet.size} 个`);
if (!removed.length && !added.length) {
  console.log('差异 = 0(纯搬运清点通过)');
  process.exit(0);
}
if (removed.length) console.log(`丢失 ${removed.length}: ${removed.join(', ')}`);
if (added.length) console.log(`新增 ${added.length}: ${added.join(', ')}`);
process.exit(1);

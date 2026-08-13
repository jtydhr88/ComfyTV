/*
 * PreVision internationalization contract test.
 * It reports only file paths and line numbers when direct Han text is found.
 */
import fs from 'node:fs';
import { assembleRuntimeSource } from '../scripts/build-app.mjs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const acorn = require('acorn');
const policy = JSON.parse(fs.readFileSync(path.join(root, 'qa/i18n-policy.json'), 'utf8'));
const localePacks = Object.fromEntries(policy.supportedLocales.map(locale => [
  locale,
  require(path.join(root, 'i18n', 'locales', `${locale}.js`))
]));
const keyPattern = new RegExp(policy.languageKeyPattern);
const localePattern = new RegExp(policy.localePathPattern);
const runtimePatterns = policy.runtimePathPatterns.map(pattern => new RegExp(pattern));
const hanPattern = /[\u3400-\u9fff\uf900-\ufaff]/u;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) passed += 1;
  else {
    failed += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

console.log('· Locale contracts');
assert(policy.schemaVersion === 1, 'i18n policy schema must be version 1');
assert(policy.supportedLocales.includes(policy.defaultLocale), 'default locale must be supported');
const referenceKeys = Object.keys(localePacks[policy.defaultLocale]).sort();
assert(referenceKeys.length > 0, 'default locale must contain language keys');
for (const [locale, pack] of Object.entries(localePacks)) {
  const keys = Object.keys(pack).sort();
  assert(JSON.stringify(keys) === JSON.stringify(referenceKeys), `${locale} must have the same key set as the default locale`);
  assert(keys.every(key => keyPattern.test(key)), `${locale} contains an invalid language key`);
  assert(Object.values(pack).every(value => typeof value === 'string' && value.trim()), `${locale} contains an empty translation`);
}

console.log('· Browser and Node runtimes');
const localizedNode = {
  dataset: {
    i18n: 'project.new',
    i18nTitle: 'action.undoTitle',
    i18nAriaLabel: 'project.new',
    i18nTooltip: 'project.open'
  },
  textContent: '',
  title: '',
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = String(value); }
};
const storage = new Map();
const documentStub = {
  documentElement: { lang: 'zh-CN' },
  querySelectorAll: () => [localizedNode],
  addEventListener: () => {}
};
const sandbox = {
  console: { warn: () => {} },
  document: documentStub,
  localStorage: {
    getItem: key => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value)
  },
  navigator: { language: 'zh-CN' }
};
vm.createContext(sandbox);
for (const locale of policy.supportedLocales) {
  vm.runInContext(read(`i18n/locales/${locale}.js`), sandbox, { filename: `${locale}.js` });
}
vm.runInContext(read('i18n/runtime.js'), sandbox, { filename: 'runtime.js' });
assert(sandbox.PreVisionI18n?.t('common.itemCount', { count: 3 }) === '共 3 项', 'browser runtime translates and interpolates the default locale');
assert(localizedNode.textContent === '新建项目' && localizedNode.title.includes('撤销'), 'data-i18n attributes are applied');
assert(localizedNode.attributes['aria-label'] === '新建项目' && localizedNode.dataset.tooltip === '打开项目',
  'data-i18n aria labels and custom tooltips are applied');
assert(sandbox.PreVisionI18n?.setLocale('en-US') === 'en-US' && localizedNode.textContent === 'New Project', 'browser runtime switches locale and reapplies the DOM');
assert(sandbox.PreVisionI18n?.t('missing.key') === 'missing.key', 'missing browser keys fail visibly');

const nodeI18n = require(path.join(root, 'i18n/node.cjs'));
nodeI18n.setLocale('zh-CN');
assert(nodeI18n.t('common.itemCount', { count: 2 }) === '共 2 项', 'Node runtime translates and interpolates');
nodeI18n.setLocale('en-US');
assert(nodeI18n.t('project.open') === 'Open Project', 'Node runtime switches locale');

console.log('· Binding provenance analyzer');

const TARGET_TEXT = '待迁移文案';
const UI_SINK_SOURCE = 'const out = null; function sink(v){ out.textContent = v; }';

function okResult(findings = 0) {
  return { complete: true, ambiguous: false, findings };
}

function incompleteResult() {
  return { complete: false, ambiguous: false, findings: 0 };
}

function ambiguousResult() {
  return { complete: false, ambiguous: true, findings: 0 };
}

function mergeResult(results) {
  let findings = 0;
  let incomplete = false;
  for (const result of results) {
    if (result.ambiguous) return ambiguousResult();
    if (!result.complete) {
      incomplete = true;
      continue;
    }
    findings += result.findings;
  }
  if (findings > 1) return ambiguousResult();
  if (incomplete) return incompleteResult();
  return okResult(findings);
}

function oracleOf(result) {
  if (result.ambiguous) return 'A';
  if (!result.complete) return 'I';
  if (result.findings === 1) return 'H';
  if (result.findings === 0) return '0';
  return 'A';
}

function scaffoldFixture(source) {
  return `${UI_SINK_SOURCE} ${source}`;
}

function parseFixture(source, sourceType) {
  try {
    return { ast: acorn.parse(source, { ecmaVersion: 'latest', sourceType, locations: false }) };
  } catch {
    return { parseError: true };
  }
}

function analyzeBindingProvenance(source, options = {}) {
  const targetText = options.targetText || TARGET_TEXT;
  const parsed = parseFixture(source, options.sourceType || 'script');
  if (parsed.parseError) return incompleteResult();

  const ast = parsed.ast;
  const bindings = new Map();
  const functionBindings = new Map();
  const functionRoles = new Map();

  function addBinding(name, kind, node) {
    const binding = { name, kind, node };
    if (!bindings.has(name)) bindings.set(name, []);
    bindings.get(name).push(binding);
    if (kind === 'function') functionBindings.set(node, binding);
    return binding;
  }

  for (const statement of ast.body) {
    if (statement.type === 'FunctionDeclaration' && statement.id) {
      addBinding(statement.id.name, 'function', statement);
    } else if (statement.type === 'VariableDeclaration') {
      for (const declarator of statement.declarations) {
        if (declarator.id?.type === 'Identifier') addBinding(declarator.id.name, statement.kind, declarator);
      }
    }
  }

  function resolve(name) {
    const declarations = bindings.get(name) || [];
    if (declarations.length > 1) return { binding: null, complete: false, ambiguous: true };
    if (declarations.length === 1) return { binding: declarations[0], complete: true, ambiguous: false };
    return { binding: null, complete: false, ambiguous: false };
  }

  function simpleParamName(param) {
    if (param?.type === 'Identifier') return param.name;
    if (param?.type === 'AssignmentPattern' && param.left.type === 'Identifier' && param.right.type === 'Literal') return param.left.name;
    return null;
  }

  function isTerminalExpression(expr) {
    return expr?.type === 'Literal' || expr?.type === 'Identifier';
  }

  function isDirectCallExpression(expr) {
    return expr?.type === 'CallExpression' &&
      !expr.optional &&
      expr.callee?.type === 'Identifier' &&
      expr.arguments.every(isTerminalExpression);
  }

  function isConsumerAssignment(expr, paramNames) {
    return expr?.type === 'AssignmentExpression' &&
      expr.operator === '=' &&
      expr.left?.type === 'MemberExpression' &&
      !expr.left.computed &&
      expr.left.object?.type === 'Identifier' &&
      expr.left.property?.type === 'Identifier' &&
      expr.left.property.name === 'textContent' &&
      expr.right?.type === 'Identifier' &&
      paramNames.includes(expr.right.name);
  }

  function classifyFunctionRole(node) {
    if (node.async || node.generator || node.body?.type !== 'BlockStatement') return null;
    const paramNames = node.params.map(simpleParamName);
    if (paramNames.some(name => name === null) || new Set(paramNames).size !== paramNames.length) return null;
    if (node.body.body.length === 0) return null;

    let role = null;
    const consumerIndexes = [];
    for (const statement of node.body.body) {
      if (statement.type !== 'ExpressionStatement') return null;
      if (isConsumerAssignment(statement.expression, paramNames)) {
        if (role === 'wrapper') return null;
        role = 'consumer';
        consumerIndexes.push(paramNames.indexOf(statement.expression.right.name));
        continue;
      }
      if (isDirectCallExpression(statement.expression)) {
        if (role === 'consumer') return null;
        role = 'wrapper';
        continue;
      }
      return null;
    }
    return role ? { role, consumerIndexes } : null;
  }

  function isAllowedConstDeclarator(declarator) {
    if (declarator.init?.type === 'Literal') return true;
    if (declarator.init?.type !== 'Identifier') return false;
    const resolved = resolve(declarator.init.name);
    return resolved.complete &&
      !resolved.ambiguous &&
      resolved.binding?.kind === 'const' &&
      resolved.binding.node !== declarator &&
      resolved.binding.node.init?.type === 'Literal';
  }

  function hasDuplicateTopLevelFunctionDeclaration() {
    return [...bindings.values()].some(declarations => declarations.filter(({ kind }) => kind === 'function').length > 1);
  }

  function positiveSyntaxGate() {
    for (const statement of ast.body) {
      if (statement.type === 'FunctionDeclaration') {
        if (!statement.id) return false;
        const role = classifyFunctionRole(statement);
        if (!role) return false;
        functionRoles.set(statement, role);
        continue;
      }
      if (statement.type === 'VariableDeclaration') {
        if (statement.kind !== 'const') return false;
        for (const declarator of statement.declarations) {
          if (declarator.id?.type !== 'Identifier') return false;
          if (!isAllowedConstDeclarator(declarator)) return false;
        }
        continue;
      }
      if (statement.type === 'ExpressionStatement' && isDirectCallExpression(statement.expression)) continue;
      if (statement.type === 'EmptyStatement') continue;
      return false;
    }
    return true;
  }

  if (!positiveSyntaxGate()) return incompleteResult();
  if (hasDuplicateTopLevelFunctionDeclaration()) return ambiguousResult();

  function functionFromBinding(binding) {
    return binding?.kind === 'function' ? binding.node : null;
  }

  function parameterIndexByName(functionNode, name) {
    return functionNode.params.findIndex(param => simpleParamName(param) === name);
  }

  const consumerBindings = new Map();
  for (const [functionNode, role] of functionRoles) {
    if (role.role !== 'consumer') continue;
    consumerBindings.set(functionBindings.get(functionNode), role.consumerIndexes);
  }
  if (consumerBindings.size === 0) return incompleteResult();

  function resolveCallable(callee) {
    if (callee?.type !== 'Identifier') return incompleteResult();
    const resolved = resolve(callee.name);
    if (resolved.ambiguous) return ambiguousResult();
    if (!resolved.binding) return incompleteResult();
    if (resolved.binding.kind !== 'function') return incompleteResult();
    return { complete: true, ambiguous: false, binding: resolved.binding };
  }

  function evalIdentifier(name, position, depth = 0) {
    const resolved = resolve(name);
    if (resolved.ambiguous) return ambiguousResult();
    if (!resolved.binding) return incompleteResult();
    if (resolved.binding.kind !== 'const') return incompleteResult();
    if (position < resolved.binding.node.start) return incompleteResult();
    const init = resolved.binding.node.init;
    if (init?.type === 'Literal') return init.value === targetText ? okResult(1) : okResult(0);
    if (init?.type === 'Identifier' && depth < 1) return evalIdentifier(init.name, init.start, depth + 1);
    return incompleteResult();
  }

  function evalExpr(expr) {
    if (!expr) return okResult(0);
    if (expr.type === 'Literal') return expr.value === targetText ? okResult(1) : okResult(0);
    if (expr.type === 'Identifier') return evalIdentifier(expr.name, expr.start);
    return incompleteResult();
  }

  function argumentOrDefault(callNode, functionNode, index) {
    if (callNode.arguments[index]) return callNode.arguments[index];
    const param = functionNode.params[index];
    if (param?.type === 'AssignmentPattern' && param.right.type === 'Literal') return param.right;
    return null;
  }

  function summarizeFunction(functionNode) {
    if (functionRoles.get(functionNode)?.role !== 'wrapper') return incompleteResult();
    const monitoredParams = [];
    const directResults = [];
    for (const statement of functionNode.body.body) {
      const expr = statement.expression;
      const resolved = resolveCallable(expr.callee);
      if (resolved.ambiguous) return ambiguousResult();
      if (!resolved.complete) return incompleteResult();
      if (!consumerBindings.has(resolved.binding)) return incompleteResult();
      const consumerNode = functionFromBinding(resolved.binding);
      if (!consumerNode) return incompleteResult();
      for (const consumerIndex of consumerBindings.get(resolved.binding)) {
        const arg = argumentOrDefault(expr, consumerNode, consumerIndex);
        if (arg?.type === 'Identifier') {
          const ownIndex = parameterIndexByName(functionNode, arg.name);
          if (ownIndex >= 0) {
            monitoredParams.push({
              index: ownIndex,
              fallback: argumentOrDefault({ arguments: [] }, consumerNode, consumerIndex)
            });
          }
          else directResults.push(evalExpr(arg));
        } else {
          directResults.push(evalExpr(arg));
        }
      }
    }
    return { complete: true, ambiguous: false, monitoredParams, directResults };
  }

  function evalCall(callNode, binding) {
    const functionNode = functionFromBinding(binding);
    if (!functionNode) return incompleteResult();
    if (consumerBindings.has(binding)) {
      return mergeResult([...consumerBindings.get(binding)].map(index => evalExpr(argumentOrDefault(callNode, functionNode, index))));
    }
    const summary = summarizeFunction(functionNode);
    if (summary.ambiguous) return ambiguousResult();
    if (!summary.complete) return incompleteResult();
    const results = [...summary.directResults];
    for (const { index, fallback } of summary.monitoredParams) {
      results.push(evalExpr(argumentOrDefault(callNode, functionNode, index) ?? fallback));
    }
    return mergeResult(results);
  }

  const results = [];
  for (const statement of ast.body) {
    if (statement.type !== 'ExpressionStatement') continue;
    const call = statement.expression;
    const resolved = resolveCallable(call.callee);
    if (resolved.ambiguous) return ambiguousResult();
    if (!resolved.complete) return incompleteResult();
    results.push(evalCall(call, resolved.binding));
  }

  return mergeResult(results);
}

const bindingFixtures = [
  ['binding return producer incomplete', "sink(make()); function make(){ return '待迁移文案'; }", 'I'],
  ['binding exported function incomplete', "export function make(){ return '待迁移文案'; } sink(make());", 'I', { sourceType: 'module' }],
  ['binding nested function incomplete', "function outer(){ function make(){ return 'x'; } } function make(){ return '待迁移文案'; } sink(make());", 'I'],
  ['binding same name parameter with return producer incomplete', "function wrap(make){ sink(make); } function make(){ return '待迁移文案'; } wrap('x');", 'I'],
  ['binding duplicate return functions incomplete', "function make(){ return 'x'; } function make(){ return '待迁移文案'; } sink(make());", 'I'],
  ['binding duplicate return order incomplete', "function make(){ return '待迁移文案'; } function make(){ return 'x'; } sink(make());", 'I'],
  ['binding function plus var incomplete', "function make(){ return '待迁移文案'; } var make = other; sink(make());", 'I'],
  ['binding duplicate direct wrappers ambiguous', "function wrap(v){ sink(v); } function wrap(v){ sink(v); } wrap('待迁移文案');", 'A'],
  ['binding undeclared incomplete', "sink(make());", 'I'],
  ['gate async consumer incomplete', "async function receive(v){ out.textContent = v; } receive('待迁移文案');", 'I'],
  ['gate async wrapper incomplete', "async function wrap(v){ sink(v); } wrap('待迁移文案');", 'I'],
  ['gate generator consumer incomplete', "function* receive(v){ out.textContent = v; } receive('待迁移文案');", 'I'],
  ['gate generator wrapper incomplete', "function* wrap(v){ sink(v); } wrap('待迁移文案');", 'I'],
  ['gate duplicate params first argument target incomplete', "function wrap(v, v){ sink(v); } wrap('待迁移文案', 'safe');", 'I'],
  ['gate duplicate params second argument target incomplete', "function wrap(v, v){ sink(v); } wrap('safe', '待迁移文案');", 'I'],
  ['gate mixed consumer then unknown call incomplete', "function mixed(v){ out.textContent = v; unknown(v); } mixed('待迁移文案');", 'I'],
  ['gate mixed unknown call then consumer incomplete', "function mixed(v){ unknown(v); out.textContent = v; } mixed('待迁移文案');", 'I'],
  ['gate mixed consumer then empty call incomplete', "function empty(){} function mixed(v){ out.textContent = v; empty(); } mixed('待迁移文案');", 'I'],
  ['gate mixed empty call then consumer incomplete', "function empty(){} function mixed(v){ empty(); out.textContent = v; } mixed('待迁移文案');", 'I'],
  ['gate empty function standalone incomplete', "function empty(){} empty();", 'I'],
  ['gate empty function before supported sink incomplete', "function empty(){} empty(); sink('待迁移文案');", 'I'],
  ['gate empty function after supported sink incomplete', "function empty(){} sink('待迁移文案'); empty();", 'I'],
  ['gate nested direct-call argument incomplete', "function make(v){ sink(v); } sink(make('待迁移文案'));", 'I'],
  ['alias direct const literal hit', "const direct = '待迁移文案'; sink(direct);", 'H'],
  ['alias exactly one edge hit', "const a = '待迁移文案'; const b = a; sink(b);", 'H'],
  ['alias second edge incomplete', "const a = '待迁移文案'; const b = a; const c = b; sink(c);", 'I'],
  ['alias single const chain hit', "const text = '待迁移文案'; sink(text);", 'H'],
  ['alias three const chain incomplete', "const a = '待迁移文案'; const b = a; const c = b; sink(c);", 'I'],
  ['alias inner block unsupported incomplete', "const a = 'x'; { const a = '待迁移文案'; const b = a; sink(b); }", 'I'],
  ['alias let incomplete', "let a = '待迁移文案'; sink(a);", 'I'],
  ['alias var incomplete', "var a = '待迁移文案'; sink(a);", 'I'],
  ['alias same value write incomplete', "const a = '待迁移文案'; a = a; sink(a);", 'I'],
  ['alias target write incomplete', "const a = '待迁移文案'; a = 'x'; sink(a);", 'I'],
  ['alias compound write incomplete', "let a = '待迁移文案'; a += '!'; sink(a);", 'I'],
  ['alias update incomplete', "let a = 1; a++; sink(a);", 'I'],
  ['alias destructuring write incomplete', "let a; ({ a } = source); sink(a);", 'I'],
  ['alias for-of write incomplete', "let a; for (a of list) {} sink(a);", 'I'],
  ['alias closure write incomplete', "const a = '待迁移文案'; function edit(){ a = 'x'; } sink(a);", 'I'],
  ['alias self cycle incomplete', "const a = a; sink(a);", 'I'],
  ['alias mutual cycle incomplete', "const a = b; const b = a; sink(a);", 'I'],
  ['alias conditional merge incomplete', "const a = flag ? '待迁移文案' : 'x'; sink(a);", 'I'],
  ['alias logical merge incomplete', "const a = value || '待迁移文案'; sink(a);", 'I'],
  ['alias sequence merge incomplete', "const a = (other, '待迁移文案'); sink(a);", 'I'],
  ['alias tdz incomplete', "sink(a); const a = '待迁移文案';", 'I'],
  ['alias member incomplete', "const a = box.value; sink(a);", 'I'],
  ['alias bind incomplete', "const a = sink.bind(null); a('待迁移文案');", 'I'],
  ['alias destructure incomplete', "const { a } = box; sink(a);", 'I'],
  ['default declaration hit', "function wrap(v = '待迁移文案'){ sink(v); } wrap();", 'H'],
  ['default direct consumer literal hit', "function receive(v = '待迁移文案'){ out.textContent = v; } receive();", 'H'],
  ['default wrapper calls consumer literal hit', "function receive(v = '待迁移文案'){ out.textContent = v; } function wrap(){ receive(); } wrap();", 'H'],
  ['default direct consumer explicit safe override', "function receive(v = '待迁移文案'){ out.textContent = v; } receive('safe');", '0'],
  ['r3 wrapper forwards missing parameter to consumer default hit', "function receive(v = '待迁移文案'){ out.textContent = v; } function wrap(value){ receive(value); } wrap();", 'H'],
  ['r3 wrapper forwards explicit safe parameter to consumer default zero', "function receive(v = '待迁移文案'){ out.textContent = v; } function wrap(value){ receive(value); } wrap('safe');", '0'],
  ['default function expression incomplete', "const wrap = function(v = '待迁移文案'){ sink(v); }; wrap();", 'I'],
  ['default arrow incomplete', "const wrap = (v = '待迁移文案') => { sink(v); }; wrap();", 'I'],
  ['default callee alias incomplete', "const a = wrap; function wrap(v = '待迁移文案'){ sink(v); } a();", 'I'],
  ['default internal same name unsupported incomplete', "function wrap(v = '待迁移文案'){ function other(v = 'x'){ return v; } sink(v); } wrap();", 'I'],
  ['default nested block incomplete', "function wrap(v = 'x'){ { const v = '待迁移文案'; } sink(v); } wrap();", 'I'],
  ['default duplicate top-level ambiguous', "function wrap(v='x'){ sink(v); } function wrap(v='待迁移文案'){ sink(v); } wrap();", 'A'],
  ['default missing zero', "function wrap(v){ sink(v); } wrap();", '0'],
  ['default explicit argument overrides', "function wrap(v = '待迁移文案'){ sink(v); } wrap('x');", '0'],
  ['default second parameter precise', "function wrap(a = 'x', b = '待迁移文案'){ sink(b); } wrap();", 'H'],
  ['default destructured parameter incomplete', "function wrap({ v } = { v: '待迁移文案' }){ sink(v); } wrap();", 'I'],
  ['default rest parameter incomplete', "function wrap(...v){ sink(v); } wrap('待迁移文案');", 'I'],
  ['default dynamic expression incomplete', "function wrap(v = source()){ sink(v); } wrap();", 'I'],
  ['default parameter write incomplete', "function wrap(v = '待迁移文案'){ v = 'x'; sink(v); } wrap();", 'I'],
  ['forward direct hit', "function wrap(v){ sink(v); } wrap('待迁移文案');", 'H'],
  ['forward two layer wrapper incomplete', "function a(v){ sink(v); } function b(v){ a(v); } b('待迁移文案');", 'I'],
  ['forward wrapper alias incomplete', "const a = sink; function b(v){ a(v); } b('待迁移文案');", 'I'],
  ['forward closure read unsupported incomplete', "function b(v){ function inner(){ sink(v); } sink(v); } b('待迁移文案');", 'I'],
  ['forward same function name ambiguous', "function wrap(v){ sink(v); } function wrap(v){ sink('x'); } wrap('待迁移文案');", 'A'],
  ['forward parameter shadow nested function incomplete', "function wrap(v){ function inner(v){ sink(v); } inner('x'); } wrap('待迁移文案');", 'I'],
  ['forward block shadow incomplete', "function wrap(v){ { const v = 'x'; sink(v); } } wrap('待迁移文案');", 'I'],
  ['forward catch shadow incomplete', "function wrap(v){ try {} catch (v) { sink(v); } } wrap('待迁移文案');", 'I'],
  ['forward nested parameter unsupported incomplete', "function wrap(v){ const inner = (v) => sink(v); inner('x'); } wrap('待迁移文案');", 'I'],
  ['forward parameter write incomplete', "function wrap(v){ v = 'x'; sink(v); } wrap('待迁移文案');", 'I'],
  ['forward spread incomplete', "function wrap(v){ sink(...v); } wrap('待迁移文案');", 'I'],
  ['forward callback incomplete', "function wrap(v){ list.map(x => sink(v)); } wrap('待迁移文案');", 'I'],
  ['forward higher-order incomplete', "function wrap(v){ return () => sink(v); } wrap('待迁移文案');", 'I'],
  ['forward cycle incomplete', "function a(v){ b(v); } function b(v){ a(v); } a('待迁移文案');", 'I'],
  ['return declaration incomplete', "function make(){ return '待迁移文案'; } sink(make());", 'I'],
  ['return arrow incomplete', "const make = () => '待迁移文案'; sink(make());", 'I'],
  ['return alias incomplete', "function make(){ return '待迁移文案'; } const alias = make; sink(alias());", 'I'],
  ['return nested internal same name incomplete', "function make(){ function inner(){ return 'x'; } return '待迁移文案'; } sink(make());", 'I'],
  ['return duplicate top-level incomplete', "function make(){ return 'x'; } function make(){ return '待迁移文案'; } sink(make());", 'I'],
  ['return multiple incomplete', "function make(){ if(flag) return '待迁移文案'; return 'x'; } sink(make());", 'I'],
  ['return conditional incomplete', "function make(){ return flag ? '待迁移文案' : 'x'; } sink(make());", 'I'],
  ['return logical incomplete', "function make(){ return value || '待迁移文案'; } sink(make());", 'I'],
  ['return cycle incomplete', "function make(){ return make(); } sink(make());", 'I'],
  ['return unsupported cross function incomplete', "function make(){ return other(); } function other(){ return '待迁移文案'; } sink(make());", 'I'],
  ['unsupported import incomplete', "import x from 'y'; sink('待迁移文案');", 'I', { sourceType: 'module' }],
  ['unsupported require incomplete', "const mod = require('x'); sink('待迁移文案');", 'I'],
  ['unsupported member incomplete', "api.sink('待迁移文案');", 'I'],
  ['unsupported computed incomplete', "api['sink']('待迁移文案');", 'I'],
  ['unsupported globalThis incomplete', "globalThis.sink('待迁移文案');", 'I'],
  ['unsupported call apply incomplete', "sink.call(null, '待迁移文案');", 'I'],
  ['unsupported optional incomplete', "sink?.('待迁移文案');", 'I'],
  ['unsupported sequence incomplete', "(0, sink)('待迁移文案');", 'I'],
  ['unsupported eval incomplete', "eval('sink(\"待迁移文案\")');", 'I'],
  ['unsupported new Function incomplete', "new Function('sink(\"待迁移文案\")');", 'I'],
  ['unsupported object container incomplete', "const box = { value: '待迁移文案' }; sink(box.value);", 'I'],
  ['unsupported array container incomplete', "const box = ['待迁移文案']; sink(box[0]);", 'I'],
  ['unsupported complex destructuring incomplete', "const { a: { b } } = box; sink(b);", 'I'],
  ['unsupported parse error incomplete', "function sink(v) {", 'I'],
  ['edge tdz write pollutes nearest lexical binding', "a = 'x'; const a = '待迁移文案'; sink(a);", 'I'],
  ['edge closure-only captured parameter incomplete', "function wrap(v){ function inner(){ sink(v); } inner(); } wrap('待迁移文案');", 'I'],
  ['edge unresolved plus unsupported incomplete', "function make(){ return 'x'; } function make(){ return '待迁移文案'; } sink(missing); sink(make());", 'I'],
  ['edge duplicate findings ambiguous', "sink('待迁移文案'); sink('待迁移文案');", 'A'],
  ['r3 duplicate consumer assignment ambiguous', "function receive(v){ out.textContent = v; out.textContent = v; } receive('待迁移文案');", 'A'],
  ['r3 wrapper invokes sink twice ambiguous', "function wrap(v){ sink(v); sink(v); } wrap('待迁移文案');", 'A'],
  ['r3 wrapper forwards one parameter to two consumers ambiguous', "function first(v){ out.textContent = v; } function second(v){ out.textContent = v; } function wrap(v){ first(v); second(v); } wrap('待迁移文案');", 'A'],
  ['r3 single consumer event remains hit', "function receive(v){ out.textContent = v; } receive('待迁移文案');", 'H'],
  ['edge if direct sink incomplete', "if (ready) { sink('待迁移文案'); }", 'I'],
  ['edge while direct sink incomplete', "while (ready) { sink('待迁移文案'); }", 'I'],
  ['edge switch direct sink incomplete', "switch (mode) { case 1: sink('待迁移文案'); }", 'I'],
  ['edge throw unsupported incomplete', "throw new Error('待迁移文案');", 'I'],
  ['edge import expression unsupported incomplete', "import('x').then(() => sink('待迁移文案'));", 'I'],
  ['edge higher-order invoke callback incomplete', "function invoke(callback){ callback('待迁移文案'); } function ui(value){ sink(value); } invoke(ui);", 'I'],
  ['edge eval alpha rename return incomplete', "function eval(){ return '待迁移文案'; } sink(eval());", 'I'],
  ['edge require alpha rename return incomplete', "function require(){ return '待迁移文案'; } sink(require());", 'I'],
  ['edge sourceType explicit ignores export in string', "const note = 'export function nope(){}'; sink('待迁移文案');", 'H'],
  ['edge sourceType explicit ignores export in comment', "// export function nope(){}\nsink('待迁移文案');", 'H'],
  ['edge alias written middle structural snippet', "const out = null; function sink(v){ out.textContent = v; } const top = '待迁移文案'; const mid = top; const leaf = mid; mid = top; sink(leaf);", 'I', { raw: true }],
  ['edge alias written upstream structural snippet', "const out = null; function sink(v){ out.textContent = v; } const top = '待迁移文案'; const mid = top; const leaf = mid; top = 'safe'; sink(leaf);", 'I', { raw: true }],
  ['edge internal function name function expression incomplete', "const out = null; function sink(v){ out.textContent = v; } const outerA = function same(v = '待迁移文案'){ sink(v); }; const outerB = function same(v = 'safe'){ sink(v); }; outerA();", 'I', { raw: true }],
  ['edge internal function name function expression safe incomplete', "const out = null; function sink(v){ out.textContent = v; } const outerA = function same(v = '待迁移文案'){ sink(v); }; const outerB = function same(v = 'safe'){ sink(v); }; outerB();", 'I', { raw: true }],
  ['edge non-ui return function incomplete', "const out = null; function sink(v){ out.textContent = v; } function ui(value){ sink(value); } function nonUi(value){ return value; } nonUi('待迁移文案'); ui('safe');", 'I', { raw: true }],
  ['edge ui with non-ui return function incomplete', "const out = null; function sink(v){ out.textContent = v; } function ui(value){ sink(value); } function nonUi(value){ return value; } nonUi('safe'); ui('待迁移文案');", 'I', { raw: true }],
  ['edge conditional same target structural snippet', "const out = null; function sink(v){ out.textContent = v; } const flag = true; const target = '待迁移文案'; const alias = flag ? target : target; sink(alias);", 'I', { raw: true }],
  ['edge conditional different target structural snippet', "const out = null; function sink(v){ out.textContent = v; } const flag = true; const target = '待迁移文案'; const safe = 'safe'; const alias = flag ? target : safe; sink(alias);", 'I', { raw: true }],
  ['r3 unused second const alias incomplete', "const a = '待迁移文案'; const b = a; const c = b;", 'I'],
  ['r3 unused const alias cycle incomplete', "const a = b; const b = a;", 'I'],
  ['r3 unused unresolved const alias incomplete', "const alias = missing;", 'I'],
  ['r3 unused callee alias incomplete', "const alias = sink;", 'I'],
  ['r3 uncalled duplicate top-level functions ambiguous', "function receive(v){ out.textContent = v; } function receive(v){ out.textContent = v; }", 'A'],
  ['edge unsupported destructuring shadows outer binding', "const out={}; function send(v){out.textContent=v;} const value='待迁移文案'; { const {value}=box; send(value); }", 'I', { raw: true }],
  ['edge unsupported rest parameter shadows outer binding', "const out={}; function send(v){out.textContent=v;} const value='待迁移文案'; function wrap(...value){send(value)} wrap('safe');", 'I', { raw: true }],
  ['edge unsupported class shadows outer function binding', "const out={}; function send(v){out.textContent=v;} const target='待迁移文案'; const make=()=>target; { send(make()); class make{} }", 'I', { raw: true }],
  ['edge unsupported object method subtree incomplete', "const out={}; function send(v){out.textContent=v;} const target='待迁移文案'; const value=target; const box={method(value){send(value)}};", 'I', { raw: true }],
  ['edge unsupported class method subtree incomplete', "const out={}; function send(v){out.textContent=v;} const target='待迁移文案'; const value=target; class Box{method(value){send(value)}};", 'I', { raw: true }],
  ['edge unsupported for statement incomplete', "const out={}; function send(v){out.textContent=v;} const target='待迁移文案'; const value=target; for (const value='safe'; ready;) { send(value); }", 'I', { raw: true }],
  ['edge external const default incomplete', "const text='待迁移文案'; function wrap(v=text){ sink(v); } function caller(text){ wrap(); } caller('safe');", 'I'],
  ['edge caller same name default incomplete', "const text='safe'; function wrap(v=text){ sink(v); } function caller(text){ wrap(); } caller('待迁移文案');", 'I'],
  ['edge return identifier block incomplete', "function make(){ const text='safe'; { const text='待迁移文案'; return text; } } sink(make());", 'I'],
  ['edge implicit arrow call return incomplete', "function other(){return '待迁移文案';} const make=()=>other(); sink(make());", 'I'],
  ['edge unsupported object property call incomplete', "const target='待迁移文案'; const box = { value: sink(target) };", 'I'],
  ['edge unsupported plain for statement incomplete', "const target='待迁移文案'; for (; ready;) { } sink(target);", 'I'],
  ['edge unsupported module top-level await incomplete', "await ready; const target='待迁移文案'; sink(target);", 'I', { sourceType: 'module' }],
  ['edge unsupported export specifier incomplete', "export { sink }; const target='待迁移文案'; sink(target);", 'I', { sourceType: 'module' }],
  ['edge unsupported bare import expression incomplete', "import('x'); const target='待迁移文案'; sink(target);", 'I'],
  ['edge catch destructuring shadows outer binding', "const phrase='待迁移文案'; try{}catch({phrase}){sink(phrase)}", 'I'],
  ['edge object pattern key unsupported incomplete', "const phrase='待迁移文案'; {const {phrase:local}=bag; sink(phrase)}", 'I'],
  ['edge for-of after loop incomplete', "const target='待迁移文案'; for(const unused of items){} sink(target);", 'I'],
  ['edge for-in after loop incomplete', "const target='待迁移文案'; for(const unused in items){} sink(target);", 'I'],
  ['edge default initializer body declaration incomplete', "const text='待迁移文案'; function wrap(v=text){ const text='safe'; sink(v); } wrap();", 'I'],
  ['edge default earlier parameter provenance incomplete', "function wrap(a='待迁移文案',b=a){sink(b)} wrap();", 'I'],
  ['edge default self parameter incomplete', "function wrap(a=a){sink(a)} wrap();", 'I'],
  ['edge default later parameter incomplete', "function wrap(a=b,b='待迁移文案'){sink(a)} wrap();", 'I'],
  ['edge return const alias to parameter incomplete', "function make(v){{const a=v;return a}} sink(make('待迁移文案'));", 'I'],
  ['edge explicit return direct consumer incomplete', "function wrap(v){ return sink(v); } wrap('待迁移文案');", 'I'],
  ['edge block arrow return direct consumer incomplete', "const wrap = (v) => { return sink(v); }; wrap('待迁移文案');", 'I'],
  ['edge direct consumer alias return incomplete', "const send=sink; function wrap(v){ return send(v); } wrap('待迁移文案');", 'I'],
  ['edge concise arrow direct consumer incomplete', "const wrap = v => sink(v); wrap('待迁移文案');", 'I'],
  ['edge unsupported object import descendant incomplete', "const target='待迁移文案'; const box={value: import('x')}; sink(target);", 'I'],
  ['edge unsupported template import descendant incomplete', "const target='待迁移文案'; const value = `${import('x')}`; sink(target);", 'I'],
  ['edge unsupported class import descendant incomplete', "const target='待迁移文案'; class Box{ method(){ import('x'); } } sink(target);", 'I'],
  ['edge unsupported export all incomplete', "export * from 'x'; const target='待迁移文案'; sink(target);", 'I', { sourceType: 'module' }],
  ['edge unsupported export namespace incomplete', "export * as ns from 'x'; const target='待迁移文案'; sink(target);", 'I', { sourceType: 'module' }],
  ['edge unsupported import meta incomplete', "const meta = import.meta; const target='待迁移文案'; sink(target);", 'I', { sourceType: 'module' }],
  ['metamorphic alpha rename stable', "function receive(v){ out.textContent = v; } const out = null; receive('待迁移文案');", 'H', { raw: true }],
  ['metamorphic comment ignored', "// sink resolveUniqueBinding 待迁移文案\nsink('待迁移文案');", 'H'],
  ['metamorphic ordinary string ignored', "const note = 'sink resolveUniqueBinding'; sink('待迁移文案');", 'H'],
  ['metamorphic duplicate reorder incomplete', "function make(){ return '待迁移文案'; } function make(){ return 'x'; } sink(make());", 'I'],
  ['metamorphic whitespace stable', "\n\n sink( '待迁移文案' )", 'H'],
  ['metamorphic top-level extra semicolons stable', ";;; sink('待迁移文案');;", 'H'],
  ['metamorphic function position stable', "receive('待迁移文案'); function receive(v){ out.textContent = v; } const out = null;", 'H', { raw: true }],
  ['metamorphic same spelling different scope unsupported', "const a = '待迁移文案'; function edit(){ let a = 'x'; a = 'y'; } sink(a);", 'I']
];

for (const [name, source, expected, options = {}] of bindingFixtures) {
  const actual = oracleOf(analyzeBindingProvenance(options.raw ? source : scaffoldFixture(source), { ...options, sourceType: options.sourceType || 'script' }));
  assert(actual === expected, `binding provenance fixture failed: ${name} (expected ${expected}, got ${actual})`);
}

console.log('· Runtime UI candidate adapter');
function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(child => walkAst(child, visit)); return; }
  if (typeof node.type === 'string') visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'start' && key !== 'end') walkAst(value, visit);
  }
}

function runtimeUiCandidates(source) {
  let ast;
  try { ast = acorn.parse(source, { ecmaVersion: 'latest', locations: true, sourceType: 'module' }); }
  catch { return [{ complete: false, reason: 'parse-error' }]; }
  const candidates = [];
  const bindings = new Map();
  walkAst(ast, statement => {
    if (statement.type !== 'VariableDeclaration') return;
    for (const declarator of statement.declarations) {
      if (declarator.id?.type !== 'Identifier') continue;
      const entries = bindings.get(declarator.id.name) || [];
      entries.push({ kind: statement.kind, declarator });
      bindings.set(declarator.id.name, entries);
    }
  });
  walkAst(ast, node => {
    if (node.type !== 'AssignmentExpression' || node.left?.type !== 'Identifier') return;
    const entries = bindings.get(node.left.name) || [];
    for (const entry of entries) {
      entry.writes = entry.writes || [];
      entry.writes.push(node.right);
    }
  });
  const sinkProperty = node => node?.type === 'MemberExpression' && !node.computed &&
    node.property?.type === 'Identifier' && ['textContent', 'title', 'value'].includes(node.property.name);
  const sinkCall = node => node?.type === 'CallExpression' && node.callee?.type === 'Identifier' &&
    ['alert', 'prompt', 'showConfirm'].includes(node.callee.name);
  const terminal = node => node?.type === 'Literal' && typeof node.value === 'string' && hanPattern.test(node.value);
  const containsHanLiteral = node => { let found = false; walkAst(node, child => { if (terminal(child)) found = true; }); return found; };
  const hanProducer = (node, depth = 0, seen = new Set()) => {
    if (!node) return { han: false, complete: true };
    if (terminal(node)) return { han: true, complete: true };
    if (node.type !== 'Identifier') return { han: containsHanLiteral(node), complete: !containsHanLiteral(node) };
    if (seen.has(node.name)) return { han: false, complete: false };
    const entries = bindings.get(node.name) || [];
    const hasHanEvidence = entry => containsHanLiteral(entry.declarator.init) || (entry.writes || []).some(containsHanLiteral);
    if (entries.length !== 1 || entries[0].kind !== 'const') {
      return { han: entries.some(hasHanEvidence), complete: false };
    }
    if ((entries[0].writes || []).length) return { han: hasHanEvidence(entries[0]), complete: false };
    const init = entries[0].declarator.init;
    if (!init || (depth >= 2 && init.type === 'Identifier')) return { han: false, complete: false };
    return hanProducer(init, depth + 1, new Set([...seen, node.name]));
  };
  const compositeHasHanProducer = node => {
    if (!node) return false;
    if (node.type === 'Identifier') return hanProducer(node).han;
    if (node.type === 'TemplateLiteral') return node.expressions.some(compositeHasHanProducer);
    if (node.type === 'BinaryExpression') return compositeHasHanProducer(node.left) || compositeHasHanProducer(node.right);
    if (node.type === 'CallExpression') return node.arguments.some(compositeHasHanProducer);
    if (node.type === 'ConditionalExpression') return compositeHasHanProducer(node.consequent) || compositeHasHanProducer(node.alternate);
    if (node.type === 'MemberExpression') return compositeHasHanProducer(node.object) || (node.computed && compositeHasHanProducer(node.property));
    return false;
  };
  const collect = (node, sink) => {
    if (terminal(node)) candidates.push({ complete: true, sink, text: node.value, source: source.slice(node.start, node.end), line: node.loc.start.line });
    else if (node?.type === 'TemplateLiteral') {
      for (const quasi of node.quasis) if (hanPattern.test(quasi.value.cooked || '')) candidates.push({ complete: false, sink, reason: 'template-producer', line: quasi.loc.start.line });
      if (!node.quasis.some(quasi => hanPattern.test(quasi.value.cooked || '')) && compositeHasHanProducer(node)) candidates.push({ complete: false, sink, reason: 'composite-identifier-producer', line: node.loc?.start.line });
    } else if (node?.type === 'ConditionalExpression') { collect(node.consequent, sink); collect(node.alternate, sink); }
    else if (node?.type === 'Identifier' && hanProducer(node).han) candidates.push({ complete: false, sink, reason: 'identifier-producer', line: node.loc?.start.line });
    else if (compositeHasHanProducer(node)) candidates.push({ complete: false, sink, reason: 'composite-identifier-producer', line: node.loc?.start.line });
    else if (node && containsHanLiteral(node)) candidates.push({ complete: false, sink, reason: 'unsupported-producer', line: node.loc?.start.line });
  };
  walkAst(ast, node => {
    if (node.type === 'AssignmentExpression' && sinkProperty(node.left)) collect(node.right, node.left.property.name);
    if (sinkCall(node)) node.arguments.forEach(arg => collect(arg, node.callee.name));
  });
  return candidates;
}

function runtimeAdapterResult(source) {
  const candidates = runtimeUiCandidates(source);
  return candidates.map(candidate => candidate.complete
    ? analyzeBindingProvenance(`const out=null; function sink(v){out.textContent=v;} sink(${candidate.source});`, { targetText: candidate.text })
    : incompleteResult());
}

assert(oracleOf(runtimeAdapterResult("node.textContent='待迁移文案';")[0]) === 'H', 'runtime adapter detects a direct textContent Chinese UI sink');
assert(oracleOf(runtimeAdapterResult("alert('待迁移文案');")[0]) === 'H', 'runtime adapter detects a direct alert Chinese UI sink');
assert(oracleOf(runtimeAdapterResult("showConfirm(flag ? '待迁移文案' : '安全');")[0]) === 'H', 'runtime adapter extracts conditional UI branches');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; node.textContent=copy;")[0]) === 'I', 'runtime adapter fails closed for an identifier producer');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; const alias=copy; alert(alias);")[0]) === 'I', 'runtime adapter fails closed for a one-hop const alias producer');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; const alias=copy; const second=alias; prompt(second);")[0]) === 'I', 'runtime adapter fails closed for a two-hop const alias producer');
assert(oracleOf(runtimeAdapterResult("function f(){ const copy='待迁移文案'; node.textContent=copy; }")[0]) === 'I', 'runtime adapter finds a function-local identifier producer');
assert(oracleOf(runtimeAdapterResult("{ const copy='待迁移文案'; node.textContent=copy; }")[0]) === 'I', 'runtime adapter finds a block-local identifier producer');
assert(oracleOf(runtimeAdapterResult("let copy='待迁移文案'; node.textContent=copy;")[0]) === 'I', 'runtime adapter fails closed for a mutable Han producer');
assert(oracleOf(runtimeAdapterResult("let copy='safe'; copy='待迁移文案'; node.textContent=copy;")[0]) === 'I', 'runtime adapter fails closed for a Han-bearing binding write');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; node.title=`${copy}`;")[0]) === 'I', 'runtime adapter detects a Han identifier in a template sink producer');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; node.value=copy+'safe';")[0]) === 'I', 'runtime adapter detects a Han identifier in a binary sink producer');
assert(oracleOf(runtimeAdapterResult("const copy='待迁移文案'; node.textContent=make(copy);")[0]) === 'I', 'runtime adapter detects a Han identifier in a call sink producer');
assert(runtimeAdapterResult("const safe='safe'; node.value=safe;").length === 0, 'runtime adapter ignores a uniquely resolved safe const producer');
assert(runtimeAdapterResult("const copy='safe'; node.title=`${copy}`;").length === 0, 'runtime adapter accepts a safe template producer');
assert(runtimeAdapterResult("const copy='safe'; node.value=copy+'safe';").length === 0, 'runtime adapter accepts a safe binary producer');
assert(runtimeAdapterResult("const copy='safe'; node.textContent=make(copy);").length === 0, 'runtime adapter accepts a safe call producer');
assert(oracleOf(runtimeAdapterResult("node.title=`待迁移文案 ${name}`;")[0]) === 'I', 'runtime adapter fails closed for a template UI producer');
assert(runtimeUiCandidates(assembleRuntimeSource()).length === 0, 'runtime adapter finds no direct Han UI candidates in assembled runtime source');

console.log('· Referenced language keys');
const referenceFiles = ['预见PreVision.html', 'electron/main.cjs'];
const referencedKeys = new Set();
for (const file of referenceFiles) {
  const source = read(file);
  for (const match of source.matchAll(/data-i18n(?:-[a-z-]+)?=["']([^"']+)["']/g)) referencedKeys.add(match[1]);
  for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) referencedKeys.add(match[1]);
}
const unknownKeys = [...referencedKeys].filter(key => !Object.hasOwn(localePacks[policy.defaultLocale], key));
assert(unknownKeys.length === 0, `application references unknown language keys (${unknownKeys.join(', ')})`);
assert(read('预见PreVision.html').includes('src="i18n/runtime.js"'), 'main application loads the browser i18n runtime');
assert(read('electron/main.cjs').includes("require('../i18n/node.cjs')"), 'Electron loads the Node i18n runtime');

console.log('· No new direct Chinese in runtime code');
let policyCommitExists = true;
try {
  git(['cat-file', '-e', `${policy.policyStartCommit}^{commit}`]);
} catch {
  policyCommitExists = false;
}
assert(policyCommitExists, 'policy start commit is unavailable; full Git history is required');

const trackedChanges = policyCommitExists
  ? git(['diff', '--name-only', '-z', policy.policyStartCommit, '--']).split('\0').filter(Boolean)
  : [];
const untrackedChanges = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
const changedRuntimeFiles = [...new Set([...trackedChanges, ...untrackedChanges])]
  .filter(file => runtimePatterns.some(pattern => pattern.test(file)) && !localePattern.test(file));
const directChineseFindings = [];
const p9MovedRuntimeFiles = new Set([
  'src/main.js',
  'src/ui/shell.js',
  'src/ui/timeline.js',
  'src/ui/inspector.js',
  'src/persist/persistence.js',
  '预见PreVision.html',
]);
const baselineRuntimeLines = new Set();
if (policyCommitExists) {
  for (const baselineFile of ['src/app.js', '预见PreVision.html']) {
    try {
      execFileSync('git', ['cat-file', '-e', `${policy.policyStartCommit}:${baselineFile}`], { cwd: root, stdio: 'ignore' });
      git(['show', `${policy.policyStartCommit}:${baselineFile}`]).split(/\r?\n/)
        .forEach(line => baselineRuntimeLines.add(line));
    } catch {
      // The existing policy-start assertion already reports a missing baseline commit.
    }
  }
}
const isP9MovedLegacyLine = (file, line) => p9MovedRuntimeFiles.has(file) && baselineRuntimeLines.has(line);

for (const file of changedRuntimeFiles) {
  const isUntracked = untrackedChanges.includes(file);
  if (isUntracked) {
    read(file).split(/\r?\n/).forEach((line, index) => {
      if (hanPattern.test(line) && !isP9MovedLegacyLine(file, line)) directChineseFindings.push(`${file}:${index + 1}`);
    });
    continue;
  }
  const diff = git(['diff', '--unified=0', '--no-color', policy.policyStartCommit, '--', file]);
  let nextLine = 0;
  for (const line of diff.split(/\r?\n/)) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      nextLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith('+++')) continue;
    if (line.startsWith('+')) {
      const added = line.slice(1);
      if (hanPattern.test(added) && !isP9MovedLegacyLine(file, added)) directChineseFindings.push(`${file}:${nextLine}`);
      nextLine += 1;
    } else if (!line.startsWith('-')) {
      nextLine += 1;
    }
  }
}
assert(directChineseFindings.length === 0, `direct Chinese must be replaced by language keys: ${directChineseFindings.join(', ')}`);

console.log(`\ni18n result: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

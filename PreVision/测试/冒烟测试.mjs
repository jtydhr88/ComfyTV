/*
 * 预见 PreVision 运行时冒烟测试(Node)
 * 规范: 每次改动必须跑,不能只做语法检查。
 * 方法: 提取两个 <script> 块,vm 沙盒中真实运行 Three.js(stub WebGLRenderer/MediaRecorder/localStorage/DOM),
 *       执行初始化 + 渲染循环 + 模拟点击所有按键 + 断言核心状态。
 * 运行: node 测试/冒烟测试.mjs
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { assembleRuntimeSource } from '../scripts/build-app.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, '..', '预见PreVision.html'), 'utf8');
const localeZhSrc = fs.readFileSync(path.join(dir, '..', 'i18n', 'locales', 'zh-CN.js'), 'utf8');
const localeEnSrc = fs.readFileSync(path.join(dir, '..', 'i18n', 'locales', 'en-US.js'), 'utf8');
const i18nRuntimeSrc = fs.readFileSync(path.join(dir, '..', 'i18n', 'runtime.js'), 'utf8');
const storyboardCorpus = JSON.parse(fs.readFileSync(path.join(dir, '..', 'qa', 'storyboard-corpus.json'), 'utf8'));
const semanticProxyCatalog = JSON.parse(fs.readFileSync(path.join(dir, '..', 'qa', 'semantic-proxy-catalog.json'), 'utf8'));
const captureEvidenceRaw = fs.readFileSync(path.join(dir, '..', 'docs', 'qa', 'recording-export-single-transaction', 'evidence.json'), 'utf8');
const appModuleSrc = assembleRuntimeSource();
const playbackModuleSrc = fs.readFileSync(path.join(dir, '..', 'src', 'playback', 'engine.js'), 'utf8');
const captureModuleSrc = fs.readFileSync(path.join(dir, '..', 'src', 'export', 'capture.js'), 'utf8');
const viewportModuleSrc = fs.readFileSync(path.join(dir, '..', 'src', 'viewport', 'interact.js'), 'utf8');
const stageRuntimeSrc = fs.readFileSync(path.join(dir, '..', 'src', 'stage', 'runtime.js'), 'utf8');
const stageEnvironmentSrc = fs.readFileSync(path.join(dir, '..', 'src', 'stage', 'environment.js'), 'utf8');

const coreOnly = process.argv.includes('--core');
const moduleArg = process.argv.indexOf('--module');
const requestedModule = moduleArg >= 0 ? process.argv[moduleArg + 1] : null;
const appModules = {
  display: {
    sections: ['缩小视图的地面可读性'],
    last: '缩小视图的地面可读性'
  },
  capture: {
    sections: ['顶部快捷截图与录屏'],
    last: '顶部快捷截图与录屏'
  },
  lighting: {
    sections: ['场景太阳: 方向光 + 全输出阴影一致性'],
    last: '场景太阳: 方向光 + 全输出阴影一致性'
  },
  history: {
    sections: ['多步撤销 + ⌘Z'],
    last: '多步撤销 + ⌘Z'
  },
  camera: {
    sections: [
      '复杂无人机运镜: 逐点朝向/FOV 平滑插值',
      '路径时间逻辑: 摄影机与对象按同序号节点同步',
      '对象路径一键复制为运镜 + 整轨拖动',
      '近景运镜控制点固定屏幕尺寸',
      '点选机位/调度点即时预览'
    ],
    last: '点选机位/调度点即时预览'
  },
  timeline: {
    sections: ['多轨调度时间轴: 独立起止时间 + 路径节点关键帧', '速度曲线、轨道联动与摄影机子轨道'],
    last: '速度曲线、轨道联动与摄影机子轨道'
  },
  playback: {
    sections: ['渲染循环 + 播放'],
    last: '渲染循环 + 播放'
  },
  actor: {
    sections: [
      '近景标签: 屏幕尺寸上限 + 显隐开关',
      '程序化人物与道具: 五官方向、材质分层与细节件',
      '快速预览模型包: 高识别人物代理、沉船与海马骑乘',
      '环境库: 墙体/柱子/树木/山体/房子/石头/连续沙漠',
      '人物姿态库: 站/坐/蹲/倒地 + 关节微调',
      '骑乘挂载: 马匹 + 人马绑定',
      '调度路径: 右栏增删点 / 直曲线 / 画布拖已有点',
      '对象高度 + 一键贴地',
      '对象失踪恢复: 坐标保护 / 定位选中 / 全局取景',
      '对象碰撞: 接触允许 / 大步防穿透 / 高度错层'
    ],
    last: '对象碰撞: 接触允许 / 大步防穿透 / 高度错层'
  },
  storyboard: {
    sections: ['剧本 → 分镜规则引擎'],
    last: '剧本 → 分镜规则引擎'
  },
  project: {
    sections: ['自动保存 + 项目文件往返'],
    last: '自动保存 + 项目文件往返'
  },
  viewport: {
    sections: ['视口交互'],
    last: '视口交互'
  },
  background: {
    sections: ['场景背景: 全景天空球 + 场景图板'],
    last: '场景背景: 全景天空球 + 场景图板'
  },
  layout: {
    sections: ['UI v3: 主题、面板状态、专注模式与菜单', '项目→场景→镜头层级与底栏去重', 'UI v2: 时间线 + 监视器 + 确认框 + 场景栏', '右栏宽度拖拽'],
    last: '右栏宽度拖拽'
  },
  robustness: {
    sections: ['模态命令所有权与背后快捷键隔离', '全按键扫描'],
    last: '全按键扫描'
  }
};
if (process.argv.includes('--list-modules')) {
  console.log(Object.keys(appModules).join('\n'));
  process.exit(0);
}
if (moduleArg >= 0 && (!requestedModule || !appModules[requestedModule])) {
  console.error(`未知主应用模块: ${requestedModule || '(空)'}。可用模块: ${Object.keys(appModules).join(', ')}`);
  process.exit(2);
}

let passed = 0, failed = 0;
let currentTestModule = 'core';
let previousSection = null;
function finish(label) {
  console.log(`\n${label}: ${passed} 通过, ${failed} 失败`);
  process.exit(failed ? 1 : 0);
}
function assert(cond, msg) {
  if (requestedModule && currentTestModule !== 'core' && currentTestModule !== requestedModule) return;
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ FAIL: ' + msg); }
}
function section(t) {
  if (requestedModule && previousSection === appModules[requestedModule].last) {
    finish(`模块 ${requestedModule} 结果`);
  }
  currentTestModule = t === '载入内嵌 Three.js' || t === '运行应用层脚本(boot)'
    ? 'core'
    : (Object.entries(appModules).find(([, config]) => config.sections.includes(t))?.[0] || 'other');
  previousSection = t;
  if (!requestedModule || currentTestModule === 'core' || currentTestModule === requestedModule) console.log('· ' + t);
}

/* ---- 提取 script 块 ---- */
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert(blocks.length === 2, 'HTML 应含 2 个 script 块(Three.js + 应用层), 实际 ' + blocks.length);
const [threeSrc, appSrc] = blocks;

/* ---- HTML 中声明的 id 集(校验 JS 引用的 id 都真实存在) ---- */
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const missingIds = new Set();
const htmlElementMeta = new Map();
for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
  if (!htmlElementMeta.has(match[3])) htmlElementMeta.set(match[3], { tag: match[1], attrs: match[2] });
}

/* ---- DOM / 环境 stub ---- */
const noop = () => {};
const make2d = () => new Proxy({}, { get: (t, k) => (k in t) ? t[k] : noop, set: (t, k, v) => { t[k] = v; return true; } });
function makeEvent(init = {}) {
  return Object.assign({
    defaultPrevented: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    stopImmediatePropagation() { this.immediatePropagationStopped = true; this.propagationStopped = true; },
  }, init);
}
function dataKey(name) { return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
function makeStyle() {
  return {
    setProperty(name, value) { this[name] = String(value); },
    getPropertyValue(name) { return this[name] || ''; },
    removeProperty(name) { const old = this[name] || ''; delete this[name]; return old; },
  };
}
function matchesSimpleSelector(node, rawSelector) {
  const selector = String(rawSelector || '').trim();
  if (!selector || !node) return false;
  const hasClass=name=>node.classList?.contains(name)||String(node.className||'').split(/\s+/).includes(name);
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  const classAttr = selector.match(/^\.([\w-]+)\[([\w:-]+)=["']?([^\]"']+)["']?\]$/);
  if (classAttr) {
    const value=classAttr[2].startsWith('data-')?node.dataset?.[dataKey(classAttr[2].slice(5))]:node.getAttribute?.(classAttr[2]);
    return hasClass(classAttr[1])&&String(value)===classAttr[3];
  }
  if (selector.startsWith('.')) return hasClass(selector.slice(1));
  const attr = selector.match(/^\[([\w:-]+)(?:=["']?([^\]"']+)["']?)?\]$/);
  if (attr) {
    const value = node.getAttribute?.(attr[1]);
    return attr[2] === undefined ? value !== null : value === attr[2];
  }
  return node.tagName === selector.toUpperCase();
}
function matchesSelector(node, selector) {
  return String(selector || '').split(',').some(part => matchesSimpleSelector(node, part));
}
let simulatedMarkupExecutions = 0,lastCaptureStreamTrack=null,lastCaptureStreamFps=null;
function makeEl(tag = 'div') {
  const attributes = {};
  const el = {
    id: '', tagName: String(tag).toUpperCase(), style: makeStyle(), dataset: {}, attributes, children: [], _html: '', parentElement: null,
    value: '', textContent: '', checked: true, disabled: false, files: [],
    width: 300, height: 300, clientWidth: 800, clientHeight: 600,
    classList: (() => { const s = new Set(); return {
      add: (...classes) => classes.forEach(c => s.add(c)), remove: (...classes) => classes.forEach(c => s.delete(c)),
      toggle: (c, force) => {
        if (force === true) s.add(c);
        else if (force === false) s.delete(c);
        else s.has(c) ? s.delete(c) : s.add(c);
        return s.has(c);
      },
      contains: c => s.has(c) }; })(),
    appendChild(c) { c.parentElement = this; this.children.push(c); if(c.id)elements[c.id]=c; return c; },
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; },
    close() {
      this.open = false;this._modal = false;
      if (documentStub.activeElement === this || this.contains(documentStub.activeElement)) documentStub.activeElement = documentStub.body;
      this.dispatch('close', makeEvent());
    },
    showModal() { this.open = true;this._modal = true;documentStub.activeElement = this; },
    show() { this.open = true;this._modal = false;documentStub.activeElement = this; },
    setAttribute(name, value) {
      const stringValue = String(value);
      attributes[name] = stringValue;
      if (name === 'id') this.id = stringValue;
      if (name === 'class') stringValue.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
      if (name === 'type') this.type = stringValue;
      if (name.startsWith('data-')) this.dataset[dataKey(name.slice(5))] = stringValue;
      if (name === 'title') this.title = stringValue;
    },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name); },
    removeAttribute(name) {
      delete attributes[name];
      if (name.startsWith('data-')) delete this.dataset[dataKey(name.slice(5))];
    },
    addEventListener(type, fn) { (this._ev ||= {}); (this._ev[type] ||= []).push(fn); },
    removeEventListener(type, fn) { if (this._ev?.[type]) this._ev[type] = this._ev[type].filter(listener => listener !== fn); },
    dispatch(type, rawEvent = {}) {
      const event = typeof rawEvent.preventDefault === 'function' ? rawEvent : makeEvent(rawEvent);
      if (!event.target) event.target = this;
      event.currentTarget = this;
      for (const fn of (this._ev?.[type] || []).slice()) {
        fn.call(this, event);
        if (event.immediatePropagationStopped) break;
      }
      return event;
    },
    dispatchEvent(event) { return this.dispatch(event.type, event); },
    click() {
      const event = makeEvent({ target: this, currentTarget: this });
      if (this.onclick) this.onclick.call(this, event);
      if (!event.immediatePropagationStopped) this.dispatch('click', event);
      return event;
    },
    querySelector(selector) { return dynamicDescendants(this,node=>matchesSelector(node,selector))[0] || queryElements(selector)[0] || makeEl('div'); },
    querySelectorAll(selector) { return queryElements(selector); },
    getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; },
    getContext() { return make2d(); },
    toDataURL() { return 'data:image/png;base64,AAAA'; },
    captureStream(fps) {
      const track = { stopped: false, requestFrame: noop, stop() { this.stopped = true; } };
      lastCaptureStreamTrack=track;lastCaptureStreamFps=fps;
      return { getVideoTracks: () => [track], getTracks: () => [track] };
    },
    scrollIntoView: noop,
    contains(node) { return node === this || this.children.some(child => child.contains?.(node)); },
    matches(selector) { return selector === ':modal' ? !!this._modal : matchesSelector(this, selector); },
    closest(selector) { let node = this; while (node) { if (matchesSelector(node, selector)) return node; node = node.parentElement; } return null; },
    setPointerCapture: noop, releasePointerCapture: noop,
    focus() { documentStub.activeElement = this; },
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) {
      this._html = String(v);this.children = [];
      if(/<(?:img|svg|iframe|script)\b/i.test(this._html)&&/\bon(?:error|load)\s*=/i.test(this._html))simulatedMarkupExecutions++;
    },
  });
  return el;
}
const elements = {};
function hydrateElement(id, node, meta) {
  node.id = id;
  node.setAttribute('id', id);
  if (!meta) return node;
  for (const attr of meta.attrs.matchAll(/\s([:\w-]+)="([^"]*)"/g)) node.setAttribute(attr[1], attr[2]);
  if (/\sdisabled(?:\s|>|$)/.test(meta.attrs)) node.disabled = true;
  if (/\schecked(?:\s|>|$)/.test(meta.attrs)) node.checked = true;
  return node;
}
function queryElements(selector) {
  const out = [];
  for (const [id, meta] of htmlElementMeta) {
    const node = elements[id] || hydrateElement(id, makeEl(meta.tag), meta);
    if (matchesSelector(node, selector)) {
      if (!elements[id]) elements[id] = node;
      out.push(node);
    }
  }
  return out;
}
const docListeners = {};
const winListeners = {};
const documentElement = makeEl('html');
const documentBody = makeEl('body');
const inspectorSections = Array.from({ length: 4 }, () => { const node = makeEl('details'); node.classList.add('sec'); return node; });
documentBody.parentElement = documentElement;
documentElement.children.push(documentBody);
const documentStub = {
  documentElement: { lang: 'zh-CN' },
  getElementById(id) {
    if (!htmlIds.has(id)) {
      if(id==='motionSnapGuide')return elements[id]||null;
      missingIds.add(id);
    }
    const meta = htmlElementMeta.get(id);
    if (!elements[id]) elements[id] = hydrateElement(id, makeEl(meta?.tag || (id === 'gl' || id === 'pipgl' ? 'canvas' : 'div')), meta);
    return elements[id];
  },
  createElement: tag => makeEl(tag),
  createElementNS: (ns, tag) => makeEl(tag),
  querySelector: selector => queryElements(selector)[0] || null,
  querySelectorAll: selector => selector === '#rightScroll > details.sec' ? inspectorSections : queryElements(selector),
  documentElement,
  body: documentBody,
  activeElement: documentBody,
  addEventListener(type, fn) { (docListeners[type] ||= []).push(fn); },
  removeEventListener(type, fn) { if (docListeners[type]) docListeners[type] = docListeners[type].filter(listener => listener !== fn); },
  dispatchEvent(event) { return fireDocument(event.type, event); },
};
const el = id => documentStub.getElementById(id);

function dynamicDescendants(root, predicate) {
  const out = [];
  const visit = node => {
    for (const child of (node?.children || [])) {
      if (predicate(child)) out.push(child);
      visit(child);
    }
  };
  visit(root);
  return out;
}
function dynamicHasClass(node, className) {
  return !!node && (node.classList?.contains(className) || String(node.className || '').split(/\s+/).includes(className));
}
function dynamicByClass(root, className) {
  return dynamicDescendants(root, node => dynamicHasClass(node, className));
}
function dynamicContainsClass(root, className) {
  if (dynamicHasClass(root, className)) return true;
  if (new RegExp(`class=["'][^"']*\\b${className}\\b`).test(root?.innerHTML || '')) return true;
  return dynamicByClass(root, className).length > 0;
}

function fireDocument(type, init = {}) {
  const event = typeof init.preventDefault === 'function' ? init : makeEvent(init);
  for (const fn of (docListeners[type] || []).slice()) {
    fn.call(documentStub, event);
    if (event.immediatePropagationStopped) break;
  }
  return event;
}
function fireWindow(type, init = {}) {
  const event = typeof init.preventDefault === 'function' ? init : makeEvent(init);
  for (const fn of (winListeners[type] || []).slice()) {
    fn.call(sandbox, event);
    if (event.immediatePropagationStopped) break;
  }
  return event;
}
function pressNativeDialogEscape(dialogStack, target = dialogStack.at(-1)) {
  const keydown = fireWindow('keydown', { key: 'Escape', code: 'Escape', target });
  const topmost = [...dialogStack].reverse().find(dialog => dialog.open);
  let cancel = null;
  if (!keydown.defaultPrevented && topmost) {
    cancel = topmost.dispatch('cancel', makeEvent());
    if (!cancel.defaultPrevented) topmost.close();
  }
  return { keydown, cancel, topmost };
}
function triggerResizeObservers() {
  resizeObservers.forEach(observer => observer.callback(observer.targets.map(target => ({ target })), observer));
}

let rafQueue = [], nowMs = 0;
const timeouts = [];
let timeoutId = 0;
const intervals = new Map();
let intervalId = 0;
const resizeObservers = [];
let testRandomState = 1;
const testMath = Object.create(Math);
testMath.random = () => {
  testRandomState = (Math.imul(testRandomState, 1664525) + 1013904223) >>> 0;
  return testRandomState / 4294967296;
};
const sandbox = {
  console, document: documentStub,
  // UI placement uses randomness in production. Keep the smoke fixture deterministic;
  // randomized placement coverage belongs in an explicit fuzz test with a reported seed.
  Math: testMath,
  __alerts: [],__throwImageLoad:false,
  alert(m) { sandbox.__alerts.push(String(m)); },
  confirm: () => true, prompt: () => null,
  localStorage: { _d: {}, _writes:0, _setLog:[], getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._writes++;this._setLog.push([k,String(v)]);this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  navigator: {},
  performance: { now: () => nowMs },
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
  setTimeout(fn, ms) { const item={ id:++timeoutId, fn, ms, canceled:false };timeouts.push(item);return item.id; },
  clearTimeout(id) { const item=timeouts.find(candidate=>candidate.id===id);if(item)item.canceled=true; },
  setInterval(fn, ms) { const id = ++intervalId; intervals.set(id, { fn, ms }); return id; },
  clearInterval(id) { intervals.delete(id); },
  devicePixelRatio: 1,
  innerWidth: 1600, innerHeight: 900,
  URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: noop },
  Blob, TextEncoder, TextDecoder, atob, btoa,
  addEventListener(t, f) { (winListeners[t] ||= []).push(f); },
  removeEventListener(t, f) { if (winListeners[t]) winListeners[t] = winListeners[t].filter(listener => listener !== f); },
  ResizeObserver: class {
    constructor(callback) { this.callback = callback; this.targets = []; resizeObservers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve(target) { this.targets = this.targets.filter(item => item !== target); }
    disconnect() { this.targets = []; }
  },
  FileReader: class { readAsText() { if (this.onload) this.onload(); } readAsDataURL() { this.result = 'data:image/jpeg;base64,AAAA'; if (this.onload) this.onload(); } },
  Image: class {
    constructor() { this.width = 0; this.height = 0; this.complete = false; }
    set src(v) { if(sandbox.__throwImageLoad){if(typeof sandbox.__throwImageLoad==='number')sandbox.__throwImageLoad--;throw new Error('Synthetic image load failure');}this._s = v; this.width = 64; this.height = 32; this.complete = true; if (this.onload) this.onload(); }
    get src() { return this._s; }
  },
};
Object.assign(sandbox.localStorage._d, {
  previz_ui_theme: 'amber',
  previz_railc: '1',
  previz_rightc: '1',
  previz_timeline_state: 'full',
});
sandbox.window = sandbox; sandbox.self = sandbox;
vm.createContext(sandbox);

vm.runInContext(localeZhSrc, sandbox, { filename: 'i18n/locales/zh-CN.js' });
vm.runInContext(localeEnSrc, sandbox, { filename: 'i18n/locales/en-US.js' });
vm.runInContext(i18nRuntimeSrc, sandbox, { filename: 'i18n/runtime.js' });
assert(sandbox.PreVisionI18n?.t('project.new') === '新建项目', '语言资源在应用脚本前加载');
assert(html.includes('data-i18n="project.new"') && html.includes('src="i18n/runtime.js"'), '主界面使用 language key 并加载国际化运行时');

/* ---- 载入真实 Three.js, stub WebGLRenderer ---- */
section('载入内嵌 Three.js');
vm.runInContext(threeSrc, sandbox, { filename: 'three.min.js' });
assert(sandbox.THREE && sandbox.THREE.Vector3, 'THREE 已定义且含 Vector3');
sandbox.__renderers = [];
sandbox.THREE.WebGLRenderer = class {
  constructor() { this.shadowMap = {}; this.domElement = makeEl('canvas'); this.autoClear = true; this.clearDepthCalls = 0; this.setSizeCalls = 0; this.pixelRatioCalls = 0; this.renderCalls = 0; this.operations = []; this.lastOperation = null; this.lastSize = null;this.viewport={x:0,y:0,z:300,w:300};this.scissor={x:0,y:0,z:300,w:300};this.scissorTest=false;sandbox.__renderers.push(this); }
  setSize(width, height, updateStyle) { this.lastSize = [width, height, updateStyle]; this.setSizeCalls++; this.lastOperation = 'size'; }
  setPixelRatio(value) { this.pixelRatio = value; this.pixelRatioCalls++; this.lastOperation = 'size'; }
  getViewport(target){return target.copy(this.viewport);}
  getScissor(target){return target.copy(this.scissor);}
  getScissorTest(){return this.scissorTest;}
  setViewport(x,y,width,height){this.viewport={x,y,z:width,w:height};this.operations.push({type:'viewport',x,y,width,height});}
  setScissor(x,y,width,height){this.scissor={x,y,z:width,w:height};this.operations.push({type:'scissor',x,y,width,height});}
  setScissorTest(value){this.scissorTest=!!value;this.operations.push({type:'scissorTest',value:!!value});}
  clear(){this.operations.push({type:'clear'});}
  render(scene, camera) { this.renderCalls++; this.lastOperation = 'render'; this.operations.push({ type: 'render', scene, camera,
    cameraState:{aspect:camera.aspect,zoom:camera.zoom,view:camera.view?Object.assign({},camera.view):null} }); }
  clearDepth() { this.clearDepthCalls++; this.lastOperation = 'clearDepth'; this.operations.push({ type: 'clearDepth' }); }
  dispose() {}
};

/* ---- 运行应用层 + 测试钩子 ---- */
section('运行应用层脚本(boot)');
const hook = `;globalThis.__T={
  get project(){return project}, get actors(){return actors}, get shots(){return shots},
  get selected(){return selected}, get sceneIdx(){return sceneIdx}, get shotIdx(){return shotIdx}, get dragging(){return dragging},
  get time(){return time}, get playing(){return playing},
  get assetTex(){return assetTex}, get dirtyTimer(){return dirtyTimer}, get historyTimer(){return historyTimer},
  get aspectSize(){return [aspectW,aspectH]},get renderLayoutCache(){return renderLayoutCache},flushScheduledUIResize,
  get previewCamPt(){return previewCamPt}, get previewActorPoint(){return previewActorPoint},get previewActorCount(){return previewActorPoints.size},
  select, genPrompt, sceneJSON, stageToData, syncScene, curShot, curScene, shotCurve, applyPose, applyJoints, actorJointsFromData, migrateHorseRideJoints, POSE_JOINTS, syncMountedTransform, loadScene, setShot, setPose, tweakJoint, setOrbitPivotKeepView, JOINT_DEFS,
  newProject,makeFirstRunWelcomeProject,makeNeutralShot,makeBlankScene,normalizeProjectData,isRestorableProject,readStartupProject,startupStatusKey,activateStartupProject,get startupState(){return startupState},
  openProjectData,activateNewProject,saveProjectFile,markDirty,flushPendingAutosave:typeof flushPendingAutosave==='function'?flushPendingAutosave:null,refreshObjList,refreshLockSel,refreshCopyPathUI,refreshTimingUI,refreshShotPanel,deleteShot,newBlankScene,newSceneFromTpl, genStoryboard, parseBeats, detectStoryTemplate, resolveStoryTemplateId, materializeSceneTemplate, SCENE_TEMPLATES, POSE_ZH,
  analyzeStoryboardScript, buildStoryboardPlan, validateStoryboardPlan, materializeStoryboardPlanShots, storyboardPlanToScene,
  currentStoryboardSourceSnapshot, analyzeStoryboardFromDialog, applyPendingStoryboardPlan, clearStoryboardPlan, markStoryboardPlanStale,
  get pendingStoryboardPlan(){return pendingStoryboardPlan},get pendingStoryboardSource(){return pendingStoryboardSource},get storyboardPlanStale(){return storyboardPlanStale},
  clampStoryboardDialogBounds,getStoryboardDialogBounds,applyStoryboardDialogBounds,resetStoryboardDialogWindow,setStoryboardDialogFullscreen,fitStoryboardDialogToViewport,
  beginStoryboardDialogResize,moveStoryboardDialogResize,finishStoryboardDialogResize,resizeStoryboardDialogByKeyboard,storyboardDialogHeaderDoubleClick,
  get storyboardDialogFullscreen(){return storyboardDialogFullscreen},get storyboardDialogResizeSession(){return storyboardDialogResizeSession},
  addAsset,importImage,assetTexture,buildSky,hasBg,setExportLook,buildActor,gcAssets,clearStage,
  disposeOwnedObject3D,disposeAssetTextureCache,markSharedThreeTexture,isSharedThreeTexture,
  SEMANTIC_PROXY_TYPES, semanticProxyType, semanticLabel, cleanDimensions, applySemanticDimensions, setActorSemanticType, replaceActorSemanticType, collisionExemptKind,
  cleanGroundAppearance:typeof cleanGroundAppearance==='function'?cleanGroundAppearance:null,
  applyGroundAppearance:typeof applyGroundAppearance==='function'?applyGroundAppearance:null,
  currentGroundAppearance:typeof currentGroundAppearance==='function'?currentGroundAppearance:null,
  setGroundAppearance:typeof setGroundAppearance==='function'?setGroundAppearance:null,
  configureRenderer, cleanSun, kelvinColor, currentSun, applySunSettings, fitSunShadowCamera, configureObjectShadows, refreshSunUI, setSunPreset,
  renderShotFrame, setupRec, recordBlob, exportCurrentFrame, exportCurrentShotVideo, captureWholePageFrame, startWholePageRecording, stopWholePageRecording, closeTopCaptureMenus, updateRecordingUI,
  beginCaptureTransaction,releaseCaptureTransaction,ownsCaptureTransaction,stopActiveCapture,reportCaptureError,finalizeCaptureTransaction,
  captureAutomaticCaptureState,restoreAutomaticCaptureState,armAutomaticCapturePrelude,
  automaticExportFps:typeof automaticExportFps==='function'?automaticExportFps:null,
  automaticExportMediaContract:typeof automaticExportMediaContract==='function'?automaticExportMediaContract:null,
  inspectAutomaticExportWebm:typeof inspectAutomaticExportWebm==='function'?inspectAutomaticExportWebm:null,
  assertAutomaticExportWebm:typeof assertAutomaticExportWebm==='function'?assertAutomaticExportWebm:null,
  normalizeAndValidateAutomaticExportBlob:typeof normalizeAndValidateAutomaticExportBlob==='function'?normalizeAndValidateAutomaticExportBlob:null,
  inspectSeedanceMp4:typeof inspectSeedanceMp4==='function'?inspectSeedanceMp4:null,
  captureAutomaticExportTarget:typeof captureAutomaticExportTarget==='function'?captureAutomaticExportTarget:null,
  prepareAutomaticCapture:typeof prepareAutomaticCapture==='function'?prepareAutomaticCapture:null,
  prepareAutomaticCaptureTextures:typeof prepareAutomaticCaptureTextures==='function'?prepareAutomaticCaptureTextures:null,
  bindAutomaticCaptureTarget:typeof bindAutomaticCaptureTarget==='function'?bindAutomaticCaptureTarget:null,
  activateAutomaticCaptureShot:typeof activateAutomaticCaptureShot==='function'?activateAutomaticCaptureShot:null,
  renderSeedanceWhiteModelFrame:typeof renderSeedanceWhiteModelFrame==='function'?renderSeedanceWhiteModelFrame:null,
  setSeedanceProgress:typeof setSeedanceProgress==='function'?setSeedanceProgress:null,
  updateSeedanceProfileUI:typeof updateSeedanceProfileUI==='function'?updateSeedanceProfileUI:null,
  exportSeedanceWhiteModelPackage:typeof exportSeedanceWhiteModelPackage==='function'?exportSeedanceWhiteModelPackage:null,
  planSeedanceWhiteModelPackage:typeof planSeedanceWhiteModelPackage==='function'?planSeedanceWhiteModelPackage:null,
  seedanceTimestampScript:typeof seedanceTimestampScript==='function'?seedanceTimestampScript:null,
  buildSeedanceManifest:typeof buildSeedanceManifest==='function'?buildSeedanceManifest:null,
  verifySeedanceZipManifest:typeof verifySeedanceZipManifest==='function'?verifySeedanceZipManifest:null,
  withAutomaticPointPreviewSuppressed:typeof withAutomaticPointPreviewSuppressed==='function'?withAutomaticPointPreviewSuppressed:null,
  automaticCaptureMutationBlocked:typeof automaticCaptureMutationBlocked==='function'?automaticCaptureMutationBlocked:null,
  deferAutomaticCaptureMutation:typeof deferAutomaticCaptureMutation==='function'?deferAutomaticCaptureMutation:null,
  blockAutomaticCaptureUIEvent:typeof blockAutomaticCaptureUIEvent==='function'?blockAutomaticCaptureUIEvent:null,
  preferredRecordingSpec, normalizeWorkspaceCaptureColors, chooseTopCaptureTarget, saveTopCaptureBytes, saveTopCaptureBlob, setCaptureSaveState, setCaptureSaveStateSafely, dl,
  resize,
  setUITheme:typeof setUITheme==='function'?setUITheme:null,
  setLeftPanelState:typeof setLeftPanelState==='function'?setLeftPanelState:null,
  setRightPanelState:typeof setRightPanelState==='function'?setRightPanelState:null,
  setTimelineState:typeof setTimelineState==='function'?setTimelineState:null,
  initialTimelineState:typeof initialTimelineState==='function'?initialTimelineState:null,
  setDirectorFocus:typeof setDirectorFocus==='function'?setDirectorFocus:null,
  openInspector:typeof openInspector==='function'?openInspector:null,
  inspectorScrollIsSettled:typeof inspectorScrollIsSettled==='function'?inspectorScrollIsSettled:null,
  closeUIMenus:typeof closeUIMenus==='function'?closeUIMenus:null,
  showCommandModal,currentModalCommandOwner,currentCommandOwner,workspaceOwnsGlobalCommand,runWorkspaceCommand,bindDesktopProjectCommands,isProjectFileAccelerator,isBareWorkspaceShortcut,
  actorCurve, addActorPathPoint, removeActorPathPoint, rebuildViz, updateActors,
  writeCurrentView,setEndpointFromView,applySemanticDimensionInput,scrubSceneTime,
  effectiveActorPaths, copyActorPathToCamera, translateCameraRoute, updateVizScales, worldUnitsPerCssPixel,
  previewCameraPoint, previewActorPathPoint, clearPointPreview,
  actorWorldBox, boxesPenetrate, actorPenetrates, moveActorSafely,applyPreset,
  setActorElevation, setActorScaleSafely, snapActorToGround, desertHeightProfile, desertLocalSurfaceHeight, desertSurfaceHeightAt, terrainSupportHeight, alignActorToTerrain, alignAllActorsToTerrain,
  fitAllActors, focusActor,
  undoLast, initHistory,
  ensureCamKeys, cameraKeyProgress, sampleCameraKey, cameraAimDirection, updateShotCam, lockTarget,
  REFRAME_ASPECT,REFRAME_IDENTITY,getShotReframe,resolveShotReframe,setShotReframe,resetShotReframe,
  computeContainRect,computeReframeProjection,renderWithResolvedReframe,
  currentResolvedReframe,reframeEditorActive,refreshReframeUI,clearReframeDraft,toggleReframeEditor,adjustReframeZoom,resetCurrentShotReframe,
  pointIndexedPosition, pointIndexedTangent, inverseSmoothProgress, nodeArrivalTime, syncTargetForShot, isPointSyncShot, refreshTimingUI,
  distributedPathTimes, repairPathTimes, ensureCamTimes, ensureCamAimTimes, ensureCamFovTimes, ensureActorTimes, timedPathState, timedValueState,
  normalizeEaseSpec, applyEaseSpec, cubicBezierEase, ensureEaseArray, sampleTimedCameraKey,
  refreshMotionTimeline, refreshMotionInspector, seekSceneTime, motionTrack, motionTimelineDuration, resolveMotionDragTime, applyActorTimeLink, copyMotionKeys, pasteMotionKeys,
  planCameraPositionPointDeletion,applyCameraPositionPointDeletion,executeCameraPositionPointDeletion,routeTimelineDeleteCommand,
  currentUnifiedCameraPose,currentUnifiedCameraDraftPose,beginUnifiedCameraDraft,updateUnifiedCameraDraft,cancelUnifiedCameraDraft,cameraEditUsesTransientDraft,recordUnifiedCameraKeyframe,clearUnifiedCameraAnimation,
  SHOT_DURATION_MIN,planShotDurationChange,applyShotDurationChange,materializeShotDurationCamera,shotDurationPreviewKeys,
  planRuntimeShotDurationChange,applyRuntimeShotDurationChange,previewShotDurationValue,commitShotDurationDraft,cancelShotDurationDraft,
  setTimelineCameraPositionSelection,currentCameraPositionCommandIndices,clearTimelineCameraPositionSelection,
  setMotionSelected(value){motionSelected=Object.assign({},value);refreshMotionInspector()},get motionSelected(){return Object.assign({},motionSelected)},
  clearMotionSelection(){motionSelection.clear()},get motionSelectionIds(){return Array.from(motionSelection)},
  recordPreviewKeyGroup:typeof recordPreviewKeyGroup==='function'?recordPreviewKeyGroup:null,
  previewOwnerState:typeof previewOwnerState==='function'?previewOwnerState:null,
  movePreviewChannelKey:typeof movePreviewChannelKey==='function'?movePreviewChannelKey:null,
  movePreviewKeyGroup:typeof movePreviewKeyGroup==='function'?movePreviewKeyGroup:null,
  previewGroupRange:typeof previewGroupRange==='function'?previewGroupRange:null,
  previewSupportedChannels:typeof previewSupportedChannels==='function'?previewSupportedChannels:null,
  samplePreviewChannel:typeof samplePreviewChannel==='function'?samplePreviewChannel:null,
  serializePreviewAnimationState:typeof serializePreviewAnimationState==='function'?serializePreviewAnimationState:null,
  restorePreviewAnimationState:typeof restorePreviewAnimationState==='function'?restorePreviewAnimationState:null,
  clearPreviewAnimationState:typeof clearPreviewAnimationState==='function'?clearPreviewAnimationState:null,
  get previewPendingSnapshot(){return Array.from(previewPendingEdits.entries(),([ownerKey,channels])=>[ownerKey,Array.from(channels.entries())])},
  get previewAutoTransactionOwners(){return Array.from(previewAutoTransactions)},
  get previewAutoChannelSnapshot(){return Array.from(previewAutoChannels.entries(),([ownerKey,channels])=>[ownerKey,Array.from(channels)])},
  get previewAutoKey(){return previewAutoKey},
  get motionSnapEnabled(){return motionSnapEnabled},
  get motionAdvancedOpen(){return motionAdvancedOpen},
  get motionSceneGlobal(){return motionSceneGlobal},
  previewActorOwnerKey:typeof previewActorOwnerKey==='function'?previewActorOwnerKey:null,
  previewCameraOwnerKey:typeof previewCameraOwnerKey==='function'?previewCameraOwnerKey:null,
  notePreviewEdit:typeof notePreviewEdit==='function'?notePreviewEdit:null,
  commitPendingPreviewKeys:typeof commitPendingPreviewKeys==='function'?commitPendingPreviewKeys:null,
  finishPreviewEdit:typeof finishPreviewEdit==='function'?finishPreviewEdit:null,
  commitPreviewHistoryTransaction:typeof commitPreviewHistoryTransaction==='function'?commitPreviewHistoryTransaction:null,
  applyPreviewActorAnimation:typeof applyPreviewActorAnimation==='function'?applyPreviewActorAnimation:null,
  applyPreviewElevationSafely:typeof applyPreviewElevationSafely==='function'?applyPreviewElevationSafely:null,
  clearPreviewChannels:typeof clearPreviewChannels==='function'?clearPreviewChannels:null,
  remapPreviewOwnerKeys:typeof remapPreviewOwnerKeys==='function'?remapPreviewOwnerKeys:null,
  retimePreviewForShotDuration:typeof retimePreviewForShotDuration==='function'?retimePreviewForShotDuration:null,
  removePreviewShotTimeRange:typeof removePreviewShotTimeRange==='function'?removePreviewShotTimeRange:null,
  animatableJointKeys:typeof animatableJointKeys==='function'?animatableJointKeys:null,
  setTime(v){time=v},
  get captureState(){return {sceneIdx,shotIdx,time,playing,playAllMode,selected,selCamPt,selActorPt,recTick,recTrack,recStop,recStep,previewCamPt,previewActorPoint}},
  get REC_FPS(){return REC_FPS},
  get captureTargetPending(){return captureTargetPending},
  setRecording(v){recording=!!v;updateRecordingUI()}, get recording(){return recording}, get screenRecording(){return screenRecording},get captureTransaction(){return captureTransaction},
  get exportLookActive(){return exportLookActive},
  get recRenderer(){return recRenderer},get recCanvas(){return recCanvas},get workspaceCanvas(){return workspaceCanvas},
  get workspaceRuntime(){return {workspaceSnapshotTimer,workspaceFrameTimer,screenRecorder}},
  setSelCamPt(v){selCamPt=v},setSelActorPt(v){selActorPt=v},
  forceCaptureNavigation(si,ci){sceneIdx=si;shotIdx=ci},
  forceCaptureRuntimeScene(i){return withAutomaticCaptureMutation(captureTransaction,()=>loadScene(i,true))},
  attachScrub:typeof attachScrub==='function'?attachScrub:null,
  get undoDepth(){return undoStack.length},get historyCurrent(){return historyCurrent},get historyPending(){return historyPending},get historyLifecycleSequence(){return historyLifecycleSequence},get historyCommitSequence(){return historyCommitSequence},
  get orbit(){return orbit},
  updateLabelScales, updateLabelVisibility,
  get viewCam(){return viewCam}, get shotCam(){return shotCam},
  get camHandles(){return camHandles},
  get camBall(){return camBall},
  get cameraVizScene(){return cameraVizScene},get cameraVizCam(){return cameraVizCam},get scene(){return scene},cameraVizVisibleIn,cameraVizResourceStats,syncCameraVizCamera,renderDirectorViewport,
  setCamDriveMode(v){camDriveMode=!!v},get camDriveMode(){return camDriveMode},
  get pathHandles(){return pathHandles},
  get sky(){return sky},
  get groundIsShadow(){return ground.material===shadowOnlyMat},
  get groundMaterial(){return groundDefaultMat},
  get groundSurfaceMaterial(){return ground.material},
  get groundAppearance(){return curScene()&&curScene().ground},
  get groundTexture(){return groundTex},
  get groundCheckerColors(){return {light:GROUND_CHECKER_LIGHT,dark:GROUND_CHECKER_DARK}},
  get groundBorder(){return groundBorder},
  get sunLight(){return key}, get ambientLight(){return ambientLight}, get sunTarget(){return sunTarget}, get sunHandle(){return sunHandle},
  get renderer(){return renderer}, get pipRenderer(){return pipRenderer}, get configuredRendererCount(){return configuredRendererCount}, get recRenderer(){return recRenderer},
  get sceneFog(){return scene.fog},
  get sceneBackground(){return scene.background},
  get gridMaterials(){return [].concat(grid.material)},
  get gridVisible(){return grid.visible},
};`;
try {
  vm.runInContext(appSrc + hook, sandbox, { filename: 'app.js' });
} catch (e) {
  console.error('应用层脚本执行崩溃: ' + e.stack);
  process.exit(1);
}
const T = sandbox.__T;
const CAMERA_POINT_HEIGHT_ORACLE=Object.freeze({min:.2,max:30});
const authoredCameraHeightIsValid=value=>Number.isFinite(value)&&value>=CAMERA_POINT_HEIGHT_ORACLE.min&&value<=CAMERA_POINT_HEIGHT_ORACLE.max;
assert(T.project && T.project.scenes.length >= 1, 'boot: 项目已创建且含场景');
assert(T.actors.length > 0, 'boot: 舞台对象已构建');
assert(T.shots.length > 0, 'boot: 镜头已构建');
const firstRunScene=T.project.scenes[0],firstRunHorse=firstRunScene.actors.find(actor=>actor.kind==='horse');
const firstRunRider=firstRunScene.actors.find(actor=>actor.mount===firstRunHorse?.label);
assert(T.startupState==='firstRun'&&firstRunScene.name===sandbox.PreVisionI18n.t('welcome.scene.name')&&
  firstRunScene.desc===sandbox.PreVisionI18n.t('welcome.scene.description')&&firstRunHorse&&firstRunRider?.pose==='ride',
  'fresh boot 明确进入 firstRun，并加载本地化白马骑手欢迎场景');
assert(firstRunScene.shots.length===4&&Math.abs(firstRunScene.shots.reduce((sum,shot)=>sum+shot.dur,0)-16.5)<1e-9&&
  JSON.stringify(firstRunScene.shots.map(shot=>shot.fov))===JSON.stringify([38,42,42,30])&&
  JSON.stringify(firstRunScene.sun?.pos)===JSON.stringify([-12.3,14,-7.3])&&firstRunScene.sun?.intensity===.9,
  '欢迎项目包含精确 4 镜/16.5s、焦段序列和侧向太阳');
assert(firstRunHorse.path.length===3&&firstRunRider.path.length===0&&!firstRunScene.templateId&&
  !Object.prototype.hasOwnProperty.call(sandbox.localStorage._d,'previz_autosave_v3'),
  '首次 boot 保留白马调度/骑手挂载且不冒充模板，不写 autosave');
function startupStorage(raw,{unavailable=false}={}){
  return {reads:0,writes:0,getItem(){this.reads++;if(unavailable)throw new Error('SecurityError');return raw;},setItem(){this.writes++;}};
}
const validStartupRaw=JSON.stringify(T.makeFirstRunWelcomeProject()),validStartupStore=startupStorage(validStartupRaw);
const validStartup=T.readStartupProject(validStartupStore);
const invalidStartupStore=startupStorage('{broken json'),invalidStartup=T.readStartupProject(invalidStartupStore);
const structuralStartupStore=startupStorage(JSON.stringify({app:'PreVision',version:5,scenes:[{actors:[],shots:[{dur:5,cam:[[0,0]]}]}]}));
const structuralStartup=T.readStartupProject(structuralStartupStore);
const unavailableStartupStore=startupStorage(null,{unavailable:true}),unavailableStartup=T.readStartupProject(unavailableStartupStore);
assert(validStartup.state==='restored'&&validStartup.project.version===5&&validStartup.project!==validStartupRaw&&validStartup.raw===validStartupRaw&&
  validStartupStore.reads===1&&validStartupStore.writes===0,
  '有效 autosave 经统一纯归一化分类为 restored，保留原 raw 且启动分类零写入');
assert(invalidStartup.state==='invalid'&&invalidStartup.raw==='{broken json'&&invalidStartup.project.scenes[0].templateId==='dialogue'&&invalidStartupStore.writes===0&&
  structuralStartup.state==='invalid'&&structuralStartupStore.writes===0,
  'JSON 或结构损坏的 autosave 保留原 raw、零写入，并回退标准 dialogue 项目');
assert(unavailableStartup.state==='unavailable'&&unavailableStartup.project.scenes[0].templateId==='dialogue'&&unavailableStartupStore.writes===0&&
  T.startupStatusKey('invalid')==='startup.invalidAutosave'&&T.startupStatusKey('unavailable')==='startup.storageUnavailable',
  'storage 读取异常与损坏数据分别分类并映射双语警告，不冒充首次启动');
const futureStartup=T.readStartupProject(startupStorage(JSON.stringify(Object.assign(T.makeFirstRunWelcomeProject(),{version:6}))));
assert(futureStartup.state==='invalid','未来项目版本不会在 boot 中被静默降写为 project v5');
const legacyStartupData=T.makeFirstRunWelcomeProject();legacyStartupData.version=4;
const legacyStartup=T.readStartupProject(startupStorage(JSON.stringify(legacyStartupData)));
assert(legacyStartup.state==='restored'&&T.activateStartupProject(legacyStartup).version===5&&T.startupState==='restored',
  '结构兼容的显式旧版本 autosave 恢复后只在内存迁移到 project v5');
const versionlessStartupData=T.makeFirstRunWelcomeProject();
delete versionlessStartupData.version;delete versionlessStartupData.assets;delete versionlessStartupData.settings;
delete versionlessStartupData.scenes[0].ground;delete versionlessStartupData.scenes[0].sun;
const versionlessStartup=T.readStartupProject(startupStorage(JSON.stringify(versionlessStartupData)));
assert(versionlessStartup.state==='restored'&&T.activateStartupProject(versionlessStartup).version===5&&T.shots.length===4,
  '缺 version/assets/settings/ground/sun 的结构兼容 autosave 仍可启动并在内存迁移');
const brokenStartupCases=[
  Object.assign(T.makeFirstRunWelcomeProject(),{scenes:[Object.assign({},T.makeFirstRunWelcomeProject().scenes[0],{name:null})]}),
  Object.assign(T.makeFirstRunWelcomeProject(),{scenes:[Object.assign({},T.makeFirstRunWelcomeProject().scenes[0],{shots:[{dur:5,fov:40,cam:[[0,2,3]]}]})]}),
  Object.assign(T.makeFirstRunWelcomeProject(),{scenes:[Object.assign({},T.makeFirstRunWelcomeProject().scenes[0],{shots:[{name:'bad',dur:'5',fov:40,cam:[[0,2,3]]}]})]}),
  Object.assign(T.makeFirstRunWelcomeProject(),{scenes:[Object.assign({},T.makeFirstRunWelcomeProject().scenes[0],{shots:[{name:'bad',dur:5,fov:40,cam:[[null,2,3]]}]})]}),
  Object.assign(T.makeFirstRunWelcomeProject(),{scenes:[Object.assign({},T.makeFirstRunWelcomeProject().scenes[0],{actors:[{kind:'horse',label:'',pos:[0,0],path:[]} ]})]})
];
let brokenStartupLoaded=true,brokenStartupWrites=0;
brokenStartupCases.forEach(value=>{
  const storage=startupStorage(JSON.stringify(value)),result=T.readStartupProject(storage);brokenStartupWrites+=storage.writes;
  try{T.activateStartupProject(result);}catch(_error){brokenStartupLoaded=false;}
  brokenStartupLoaded=brokenStartupLoaded&&result.state==='invalid'&&T.startupState==='invalid'&&T.project.scenes[0].templateId==='dialogue';
});
assert(brokenStartupLoaded&&brokenStartupWrites===0,
  '缺场景/镜头名、字符串时长、空坐标或空演员标签均按 invalid 走完整加载回退且零写入');
const originalLocalStorage=sandbox.localStorage;
Object.defineProperty(sandbox,'localStorage',{configurable:true,get(){throw new Error('SecurityError getter');}});
const getterUnavailableStartup=T.readStartupProject();
Object.defineProperty(sandbox,'localStorage',{configurable:true,writable:true,value:originalLocalStorage});
assert(getterUnavailableStartup.state==='unavailable'&&getterUnavailableStartup.project.scenes[0].templateId==='dialogue',
  'window.localStorage getter 自身抛错也安全分类为 unavailable');
sandbox.document.getElementById('btnNew').click();sandbox.document.getElementById('confirmOk').click();
assert(T.project.scenes[0].templateId==='dialogue'&&T.actors.some(actor=>actor.label==='A·主体')&&T.actors.some(actor=>actor.label==='B'),
  '用户真实点击 New Project 并确认后仍进入标准双人对话，不复用欢迎种子');

if (coreOnly) {
  finish('核心冒烟结果');
}

T.openProjectData(T.newProject());flushTimeouts();T.initHistory();
assert(T.project.scenes[0].templateId==='dialogue'&&T.actors.some(actor=>actor.label==='A·主体')&&T.actors.some(actor=>actor.label==='B'),
  '用户主动 New Project 的工厂保持标准双人对话，后续回归使用同一标准项目夹具');

section('缩小视图的地面可读性');
assert(T.sceneBackground.getHex() === 0x0a0a0a, '导演台保持黑色背景');
assert(T.groundMaterial.fog === false && T.gridMaterials.every(m => m.fog === false),
  '地面与网格不受距离雾影响，缩小时远端不融入黑色');
assert(T.groundTexture.repeat.x === 2.5 && T.groundTexture.repeat.y === 2.5,
  '棋盘格单格边长扩大到原来的 4 倍以减少视觉密度');
assert(T.groundBorder && T.groundBorder.material.fog === false && T.groundBorder.material.opacity >= .8,
  '地面外边界在远景中保持可见');
assert(T.sceneFog.near >= 75, '场景雾推远，不压暗主要工作区');

section('顶部快捷截图与录屏');
assert(typeof el('topSnap').onclick==='function'&&typeof el('topRecord').onclick==='function','顶部截图/录屏按钮均已绑定行为');
el('topSnap').click();
assert(el('topSnapMenu').classList.contains('open'),'点击顶部截图先打开范围选择菜单');
el('aspect').value='16:9';el('topSnapCamera').click();
assert(el('topSnapLabel').textContent==='已截图','顶部截图后即时显示完成反馈');
flushTimeouts();assert(el('topSnapLabel').textContent==='截图','截图反馈一秒后恢复');
const reframeCaptureShot=T.curShot(),reframeCaptureBefore=JSON.stringify(reframeCaptureShot.reframeByAspect);
el('aspect').value='9:16';T.setShotReframe(reframeCaptureShot,{offsetX:.2,offsetY:-.3,zoom:1.6});
const frozenReframeTarget=T.captureAutomaticExportTarget('scene'),frozenReframeValue=JSON.stringify(frozenReframeTarget.shots[0].reframe);
T.setShotReframe(reframeCaptureShot,{offsetX:-.4,offsetY:.1,zoom:2.2});
assert(frozenReframeValue==='{"offsetX":0.2,"offsetY":-0.3,"zoom":1.6}'&&
  JSON.stringify(frozenReframeTarget.shots[0].reframe)===frozenReframeValue&&Object.isFrozen(frozenReframeTarget.shots[0].reframe),
  '场景导出开始时逐镜头冻结 resolved reframe，后续项目变化不污染捕获计划');
const reframeFaultCameraBefore=JSON.stringify({aspect:T.shotCam.aspect,zoom:T.shotCam.zoom,view:T.shotCam.view}),reframeFaultExportLook=T.exportLookActive;
const originalCaptureRender=sandbox.THREE.WebGLRenderer.prototype.render;
sandbox.THREE.WebGLRenderer.prototype.render=function(){throw new Error('injected reframe capture render fault');};
let reframeCaptureFault=false;
try{T.renderShotFrame(1080,1920,{offsetX:.2,offsetY:-.3,zoom:1.6});}catch(error){reframeCaptureFault=error.message==='injected reframe capture render fault';}
sandbox.THREE.WebGLRenderer.prototype.render=originalCaptureRender;
const faultRenderer=sandbox.__renderers.at(-1);
assert(reframeCaptureFault,'PNG 重构图渲染故障注入到达 production render path');
assert(JSON.stringify({aspect:T.shotCam.aspect,zoom:T.shotCam.zoom,view:T.shotCam.view})===reframeFaultCameraBefore,
  `PNG 故障恢复 camera aspect/zoom/viewOffset (${reframeFaultCameraBefore} → ${JSON.stringify({aspect:T.shotCam.aspect,zoom:T.shotCam.zoom,view:T.shotCam.view})})`);
assert(T.exportLookActive===reframeFaultExportLook,'PNG 故障恢复 exportLook');
assert(faultRenderer.viewport.x===0&&faultRenderer.viewport.y===0&&faultRenderer.viewport.z===300&&faultRenderer.viewport.w===300&&
  faultRenderer.scissor.x===0&&faultRenderer.scissor.y===0&&faultRenderer.scissor.z===300&&faultRenderer.scissor.w===300&&!faultRenderer.scissorTest,
  `PNG 故障恢复 renderer viewport/scissor (${JSON.stringify({viewport:faultRenderer.viewport,scissor:faultRenderer.scissor,scissorTest:faultRenderer.scissorTest})})`);
if(reframeCaptureBefore===undefined)delete reframeCaptureShot.reframeByAspect;
else reframeCaptureShot.reframeByAspect=JSON.parse(reframeCaptureBefore);
el('aspect').value='16:9';
el('topRecordMore').click();
assert(el('topRecordMenu').classList.contains('open'),'更多录屏方式按钮打开页面录屏菜单');
assert(typeof el('topRecordPage').onclick==='function'&&typeof el('topRecordMore').onclick==='function'&&el('exportShot').onclick===T.exportCurrentShotVideo,
  '主录屏按钮直录摄影机画面，次级菜单保留整个页面录屏入口');
assert(String(T.startWholePageRecording).includes('html2canvas')&&!String(T.startWholePageRecording).includes('getDisplayMedia'),
  '预见工作区录屏使用应用内画面合成，不触发浏览器屏幕共享确认');
assert(html.includes('data-i18n="record.workspace"')&&html.includes('data-i18n="record.workspaceHint"')&&
  sandbox.PreVisionI18n.t('record.workspaceHint').includes('保存位置')&&fs.existsSync(path.join(dir,'..','vendor','html2canvas.min.js')),
  '工作区录屏范围说明由 language key 提供、明确先选保存位置且本地离线渲染组件存在');
	const compactSource=source=>source.replace(/\s+/g,'');
	const captureCompact=compactSource(captureModuleSrc);
	const sourceBetween=(start,next)=>{
	  const a=captureModuleSrc.indexOf(start),b=next?captureModuleSrc.indexOf(next,a+start.length):-1;
	  return a<0?'':captureModuleSrc.slice(a,b<0?captureModuleSrc.length:b);
	};
	const frameExportSource=sourceBetween('async function exportCurrentFrame', 'function closeTopCaptureMenus'),
	  snapCameraSource=sourceBetween("$('topSnapCamera').onclick", "$('topSnapPage').onclick"),
	  snapWorkspaceSource=sourceBetween('async function captureWholePageFrame', 'function tag'),
	  recordCameraSource=sourceBetween('async function topRecordCamera', 'async function exportWholeSceneVideo'),
	  recordWorkspaceSource=sourceBetween('async function startWholePageRecording', 'function stopWholePageRecording'),
	  recordBlobSource=sourceBetween('function recordBlob', 'async function exportCurrentShotVideo'),
	  shotExportSource=sourceBetween('async function exportCurrentShotVideo', 'async function topRecordCamera'),
	  sceneExportSource=sourceBetween('async function exportWholeSceneVideo', 'function makeZip'),
	  seedanceExportSource=sourceBetween('function initSeedancePack', 'function initCaptureBindings');
	const frameExportCompact=compactSource(frameExportSource),snapCameraCompact=compactSource(snapCameraSource),snapWorkspaceCompact=compactSource(snapWorkspaceSource),
	  recordCameraCompact=compactSource(recordCameraSource),recordWorkspaceCompact=compactSource(recordWorkspaceSource),
	  recordBlobCompact=compactSource(recordBlobSource),shotExportCompact=compactSource(shotExportSource),
	  sceneExportCompact=compactSource(sceneExportSource),seedanceExportCompact=compactSource(seedanceExportSource);
	assert(snapCameraCompact.includes("chooseTopCaptureTarget('screenshot'")&&snapWorkspaceCompact.includes("chooseTopCaptureTarget('screenshot'")&&
	  recordCameraCompact.includes("chooseTopCaptureTarget('recording'")&&recordWorkspaceCompact.includes("chooseTopCaptureTarget('recording'"),
	  '桌面端顶部两种截图与两种录屏均先请求系统保存位置');
	assert(snapWorkspaceCompact.indexOf('target.canceled')<snapWorkspaceCompact.indexOf('captureWorkspace(target.token)')&&
	  recordCameraCompact.indexOf('target.canceled')<recordCameraCompact.indexOf('recordBlob(')&&
	  recordWorkspaceCompact.indexOf('target.canceled')<recordWorkspaceCompact.indexOf('screenRecording=true'),
	  '取消保存位置会在截图写入或录屏开始前退出');
	assert(captureCompact.includes('if(captureTargetPending)return{canceled:true,pending:true};')&&
	  captureCompact.includes('finally{captureTargetPending=false;}'),
	  '系统保存对话框等待期间拒绝重复打开，完成或取消后释放入口');
	assert(recordBlobCompact.includes('if(options.recordSpec)returnrejectInitialization(e)')&&
	  recordCameraCompact.includes('manual:true,recordSpec,transaction'),
	  '顶部摄影机录屏不在预选容器失败后静默回退，避免文件后缀与实际容器不一致');
	assert(captureCompact.includes('bridge.saveCaptureTarget(target.token,bytes)')&&
	  captureCompact.includes('blob.arrayBuffer()')&&captureCompact.includes('catch(e){'),
	  '顶部捕获结果通过一次性目标 token 落盘，录屏 Blob 不走普通固定目录导出');
	const frameChooseIndex=frameExportCompact.indexOf("chooseTopCaptureTarget('screenshot'"),frameDesktopRenderIndex=frameExportCompact.lastIndexOf('renderShotFrame('),
	  shotChooseIndex=shotExportCompact.indexOf("chooseTopCaptureTarget('recording'"),sceneChooseIndex=sceneExportCompact.indexOf("chooseTopCaptureTarget('recording'");
	assert([frameChooseIndex,frameDesktopRenderIndex,shotChooseIndex,sceneChooseIndex].every(index=>index>=0)&&
	  frameChooseIndex<frameDesktopRenderIndex&&shotChooseIndex<shotExportCompact.indexOf("prepareAutomaticCapture('shot')")&&
	  sceneChooseIndex<sceneExportCompact.indexOf("prepareAutomaticCapture('scene')"),
	  '右下当前帧、当前镜与本场景在任何渲染、冻结快照或编码前先选择一次性保存目标');
	assert(frameExportCompact.includes("saveTopCaptureBytes(target,bytes,'export'")&&
	  shotExportCompact.includes("saveTopCaptureBlob(saveTarget,b,'export'")&&
	  sceneExportCompact.includes("saveTopCaptureBlob(saveTarget,b,'export'"),
	  '右下三类媒体成功后只通过 capture:save-target 落盘，并用既有 export.saved 路径反馈');
	assert(snapCameraCompact.indexOf('try{bytes=')<snapCameraCompact.indexOf("chooseTopCaptureTarget('screenshot'")&&
	  snapCameraCompact.includes('returnfalse;}')&&recordCameraCompact.includes('success=!out.canceled')&&recordCameraCompact.includes('+b.ext'),
	  '摄影机截图渲染异常有反馈且不会遗留授权；录屏保存失败返回失败，浏览器文件名跟随实际容器');
	assert(recordWorkspaceCompact.includes('workspaceRecordingRun')&&recordWorkspaceCompact.includes('run!==workspaceRecordingRun')&&
	  recordWorkspaceCompact.includes('6*60*60*1000')&&captureCompact.includes('transaction.stop()'),
	  '工作区录屏以运行代次隔离异步初始化，并在授权期限内设置六小时安全上限');
	assert(recordWorkspaceCompact.includes('onclone:normalizeWorkspaceCaptureColors')&&
	  captureCompact.includes("'box-shadow'")&&captureCompact.includes('getImageData'),
	  '工作区 html2canvas clone 在专用捕获边界把现代计算颜色转换为像素等价的 legacy RGB，不改全局主题 token');
	const recordBlobStartIndex=recordBlobCompact.indexOf('rec.start();'),recordBlobOwnershipIndex=recordBlobCompact.indexOf('if(settled||!ownsCaptureTransaction(transaction))return;',recordBlobStartIndex),
	  recordBlobStateIndex=recordBlobCompact.indexOf("$('speed').value='1.0x'",recordBlobOwnershipIndex);
	assert(recordBlobCompact.includes('rec.onerror=failRecording')&&recordBlobCompact.includes('cleanupRecordingRuntime')&&
	  recordBlobStartIndex>=0&&recordBlobOwnershipIndex>recordBlobStartIndex&&recordBlobStateIndex>recordBlobOwnershipIndex,
	  '摄影机录屏 start/onerror 失败统一恢复播放、速度、提示和计时器状态');
	assert([shotExportCompact,sceneExportCompact,recordCameraCompact,seedanceExportCompact].every(source=>source.includes('finalizeCaptureTransaction'))&&
	  seedanceExportCompact.includes('after:()=>{btn.disabled=false'),
	  '镜头/场景/摄影机/Seedance 外层事务都通过异常安全 finally 释放，Seedance 始终恢复按钮');
	const prepareSource=compactSource(sourceBetween('function prepareAutomaticCapture', 'function beginCaptureTransaction'));
	const shotPrepareIndex=shotExportCompact.indexOf("prepareAutomaticCapture('shot')"),shotBeginIndex=shotExportCompact.indexOf("beginCaptureTransaction('shot-export')"),
	  scenePrepareIndex=sceneExportCompact.indexOf("prepareAutomaticCapture('scene')"),sceneBeginIndex=sceneExportCompact.indexOf("beginCaptureTransaction('scene-export')"),
	  seedancePrepareIndex=seedanceExportCompact.indexOf("prepareAutomaticCapture('seedance')"),seedanceBeginIndex=seedanceExportCompact.indexOf("beginCaptureTransaction('seedance-export')"),
	  settleIndex=prepareSource.indexOf('settleAutomaticCaptureAuthoring()'),captureStateIndex=prepareSource.indexOf('captureAutomaticCaptureState()'),
	  cameraSpecIndex=recordCameraCompact.indexOf('preferredRecordingSpec()'),cameraBeginIndex=recordCameraCompact.indexOf("beginCaptureTransaction('camera-recording'"),
	  workspaceSpecIndex=recordWorkspaceCompact.indexOf('preferredRecordingSpec()'),workspaceBeginIndex=recordWorkspaceCompact.indexOf("beginCaptureTransaction('workspace-recording'");
assert([shotPrepareIndex,shotBeginIndex,scenePrepareIndex,sceneBeginIndex,seedancePrepareIndex,seedanceBeginIndex,settleIndex,captureStateIndex,
    cameraSpecIndex,cameraBeginIndex,workspaceSpecIndex,workspaceBeginIndex].every(index=>index>=0)&&
  shotPrepareIndex<shotBeginIndex&&scenePrepareIndex<sceneBeginIndex&&seedancePrepareIndex<seedanceBeginIndex&&settleIndex<captureStateIndex&&
  cameraSpecIndex<cameraBeginIndex&&workspaceSpecIndex<workspaceBeginIndex,
  '自动导出先结算在途 authoring 再冻结快照/target；手动容器/文件名前置到 acquire 之前，acquire 后由 finally 托底');
assert((captureEvidenceRaw.match(/"impact"\s*:/g)||[]).length===1,
  'capture QA evidence automated 只有一个 impact key，不会被 JSON 解析静默覆盖');

const beginPreviewActor=T.actors.find(actor=>actor.pathPts.length>=2),beginPreviewCamera=Math.max(0,T.curShot().camPts.length-1);
T.previewCameraPoint(beginPreviewCamera);if(beginPreviewActor)T.previewActorPathPoint(beginPreviewActor,beginPreviewActor.pathPts.length-1);
const beginPreviewBefore={camera:T.previewCamPt,actor:T.previewActorPoint,count:T.previewActorCount,
  shotCamera:T.shotCam.position.toArray(),shotQuaternion:T.shotCam.quaternion.toArray(),camBall:T.camBall.position.toArray(),
  actorPositions:T.actors.map(actor=>actor.obj.position.toArray()),actorQuaternions:T.actors.map(actor=>actor.obj.quaternion.toArray())};
const originalTopRecordToggle=el('topRecord').classList.toggle;let beginRollbackThrew=false;
el('topRecord').classList.toggle=()=>{throw new Error('record UI failed');};
try{T.prepareAutomaticCapture('seedance');T.beginCaptureTransaction('begin-ui-failure');}catch(_error){beginRollbackThrew=true;}
el('topRecord').classList.toggle=originalTopRecordToggle;T.updateRecordingUI();
assert(beginRollbackThrew&&!T.captureTransaction&&T.previewCamPt===beginPreviewBefore.camera&&T.previewActorPoint?.actor===beginPreviewBefore.actor?.actor&&
  T.previewActorPoint?.idx===beginPreviewBefore.actor?.idx&&T.previewActorCount===beginPreviewBefore.count&&
  JSON.stringify(T.shotCam.position.toArray())===JSON.stringify(beginPreviewBefore.shotCamera)&&JSON.stringify(T.shotCam.quaternion.toArray())===JSON.stringify(beginPreviewBefore.shotQuaternion)&&
  JSON.stringify(T.camBall.position.toArray())===JSON.stringify(beginPreviewBefore.camBall)&&
  JSON.stringify(T.actors.map(actor=>actor.obj.position.toArray()))===JSON.stringify(beginPreviewBefore.actorPositions)&&
  JSON.stringify(T.actors.map(actor=>actor.obj.quaternion.toArray()))===JSON.stringify(beginPreviewBefore.actorQuaternions),
  'Seedance target 构建后 begin UI 同步失败会精确恢复 point-preview runtime/变量并回滚所有权');
T.clearPointPreview();T.updateActors();T.updateShotCam();
let armUiCalls=0;const armUiAlerts=sandbox.__alerts.length;
el('topRecord').classList.toggle=function(...args){armUiCalls++;if(armUiCalls===2)throw new Error('armed stop UI failed');return originalTopRecordToggle.apply(this,args);};
const armUiResult=await T.exportCurrentShotVideo();el('topRecord').classList.toggle=originalTopRecordToggle;T.updateRecordingUI();
assert(armUiResult===false&&armUiCalls===3&&!T.captureTransaction&&sandbox.__alerts.length===armUiAlerts+1,
  'automatic prelude 安装 stop 后的真实 UI 刷新若抛错，外层执行路径仍恢复并释放事务且只反馈一次');
const originalDocumentQueryAll=documentStub.querySelectorAll,automaticSnapshotAlerts=sandbox.__alerts.length;
documentStub.querySelectorAll=selector=>{if(selector==='#rightScroll > details.sec')throw new Error('capture snapshot failed');return originalDocumentQueryAll(selector);};
const automaticSnapshotResult=await T.exportCurrentShotVideo();documentStub.querySelectorAll=originalDocumentQueryAll;
assert(automaticSnapshotResult===false&&!T.captureTransaction&&sandbox.__alerts.length===automaticSnapshotAlerts+1,
  '自动导出快照 getter 在 acquire 前抛错，仅外层反馈一次且不会占用捕获事务');

const originalMediaRecorder=sandbox.MediaRecorder,originalHtml2canvas=sandbox.html2canvas,originalGetComputedStyle=sandbox.getComputedStyle,originalBlob=sandbox.Blob;
const mp4Bytes=(...values)=>new Uint8Array(values),mp4Text=value=>mp4Bytes(...[...value].map(char=>char.charCodeAt(0))),
  mp4U16=value=>mp4Bytes((value>>>8)&255,value&255),mp4U32=value=>mp4Bytes((value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255),
  mp4Join=(...parts)=>{const out=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;},
  mp4Box=(type,...parts)=>{const payload=mp4Join(...parts);return mp4Join(mp4U32(payload.length+8),mp4Text(type),payload);};
function makeCaptureH264Mp4({frameCount,fps,sampleDelta=null}){
  const timescale=24000,delta=sampleDelta??timescale/fps;
  const mdhd=mp4Box('mdhd',mp4Bytes(0,0,0,0),mp4U32(0),mp4U32(0),mp4U32(timescale),mp4U32(frameCount*delta),mp4Bytes(0,0,0,0));
  const hdlr=mp4Box('hdlr',mp4Bytes(0,0,0,0),mp4U32(0),mp4Text('vide'),mp4Bytes(0,0,0,0));
  const avcC=mp4Box('avcC',mp4Join(mp4Bytes(1,0x64,0,0x1f,0xff,0xe1),mp4U16(2),mp4Bytes(0x67,0),mp4Bytes(1),mp4U16(2),mp4Bytes(0x68,0)));
  const avc1=mp4Join(mp4U32(86+avcC.length),mp4Text('avc1'),mp4Join(new Uint8Array(6),mp4U16(1),new Uint8Array(70)),avcC);
  const stsd=mp4Box('stsd',mp4Bytes(0,0,0,0),mp4U32(1),avc1),stts=mp4Box('stts',mp4Bytes(0,0,0,0),mp4U32(1),mp4U32(frameCount),mp4U32(delta));
  const stsz=mp4Box('stsz',mp4Bytes(0,0,0,0),mp4U32(4),mp4U32(frameCount)),stsc=mp4Box('stsc',mp4Bytes(0,0,0,0),mp4U32(1),mp4U32(1),mp4U32(frameCount),mp4U32(1));
  const moovForOffset=offset=>mp4Box('moov',mp4Box('trak',mp4Box('tkhd',mp4Bytes(0,0,0,0),mp4U32(0),mp4U32(0),mp4U32(1),mp4U32(0)),mp4Box('mdia',mdhd,hdlr,mp4Box('minf',mp4Box('stbl',stsd,stts,stsz,stsc,mp4Box('stco',mp4Bytes(0,0,0,0),mp4U32(1),mp4U32(offset)))))));
  const ftyp=mp4Box('ftyp',mp4Text('isom'),mp4U32(0),mp4Text('isom')),placeholder=moovForOffset(0),mdat=mp4Box('mdat',new Uint8Array(frameCount*4));
  return mp4Join(ftyp,moovForOffset(ftyp.length+placeholder.length+8),mdat);
}
const webmId=(...values)=>mp4Bytes(...values);
function webmSize(value){
  let width=1,wide=BigInt(value);while(width<8&&wide>((1n<<BigInt(width*7))-2n))width++;
  const out=new Uint8Array(width);for(let index=width-1;index>=0;index--){out[index]=Number(wide&255n);wide>>=8n;}out[0]|=1<<(8-width);return out;
}
function webmElement(id,payload){return mp4Join(id,webmSize(payload.length),payload);}
function webmUInt(id,value){
  let wide=BigInt(value),width=1;while(wide>=(1n<<BigInt(width*8)))width++;const out=new Uint8Array(width);
  for(let index=width-1;index>=0;index--){out[index]=Number(wide&255n);wide>>=8n;}return webmElement(id,out);
}
function webmFloat(id,value){const buffer=new ArrayBuffer(8);new DataView(buffer).setFloat64(0,value,false);return webmElement(id,new Uint8Array(buffer));}
function makeCaptureWebm({frameCount,fps,timestampFps=fps}){
  const timecodeScaleNs=1000000,framePeriodMs=1000/timestampFps;
  const ebml=webmElement(webmId(0x1a,0x45,0xdf,0xa3),webmElement(webmId(0x42,0x82),mp4Text('webm')));
  const info=webmElement(webmId(0x15,0x49,0xa9,0x66),mp4Join(
    webmUInt(webmId(0x2a,0xd7,0xb1),timecodeScaleNs),webmFloat(webmId(0x44,0x89),frameCount*1000/timestampFps)
  ));
  const trackEntry=webmElement(webmId(0xae),mp4Join(
    webmUInt(webmId(0xd7),1),webmUInt(webmId(0x83),1),webmUInt(webmId(0x23,0xe3,0x83),Math.round(1e9/timestampFps)),webmElement(webmId(0x86),mp4Text('V_VP9'))
  )),tracks=webmElement(webmId(0x16,0x54,0xae,0x6b),trackEntry),clusters=[];
  let clusterStart=null,blocks=[];
  const flushCluster=()=>{if(clusterStart===null)return;clusters.push(webmElement(webmId(0x1f,0x43,0xb6,0x75),mp4Join(webmUInt(webmId(0xe7),clusterStart),...blocks)));};
  for(let frame=0;frame<frameCount;frame++){
    const absolute=Math.round(frame*framePeriodMs);if(clusterStart===null||absolute-clusterStart>30000){flushCluster();clusterStart=absolute;blocks=[];}
    const relative=absolute-clusterStart,payload=mp4Bytes(0x81,(relative>>8)&255,relative&255,0x80,frame&255);
    blocks.push(webmElement(webmId(0xa3),payload));
  }
  flushCluster();return mp4Join(ebml,webmElement(webmId(0x18,0x53,0x80,0x67),mp4Join(info,tracks,...clusters)));
}
let constructedRecorders=0,lastRecorder=null;
class TestMediaRecorder{
  static isTypeSupported=()=>true;
  constructor(_stream,options={}){constructedRecorders++;this.mimeType=options.mimeType||'video/webm';this.state='inactive';lastRecorder=this;}
  start(){this.state='recording';}
  stop(){this.state='inactive';const target=T.captureTransaction?.target,contract=target&&!T.captureTransaction?.manual?T.automaticExportMediaContract(target):null;
    this.ondataavailable?.({data:new Blob([contract?makeCaptureH264Mp4(contract):'frame'],{type:this.mimeType})});this.onstop?.();}
  pause(){this.state='paused';}
  resume(){this.state='recording';}
}
sandbox.MediaRecorder=TestMediaRecorder;
sandbox.getComputedStyle=()=>({getPropertyValue:()=>'',backgroundColor:'#0C1016'});
const automaticIdentityApi=typeof T.captureAutomaticExportTarget==='function'&&typeof T.prepareAutomaticCapture==='function'&&typeof T.bindAutomaticCaptureTarget==='function'&&
  typeof T.activateAutomaticCaptureShot==='function'&&typeof T.automaticCaptureMutationBlocked==='function'&&typeof T.blockAutomaticCaptureUIEvent==='function';
assert(automaticIdentityApi,
  '自动导出提供冻结 scene/shot 内容身份、绑定事务、逐帧激活目标与统一 UI/程序入口门禁');
if(automaticIdentityApi){
  const finishAutomaticRun=async(run,maxFrames=2400)=>{
    await new Promise(resolve=>setImmediate(resolve));
    for(let i=0;i<maxFrames&&T.captureTransaction&&T.captureState.recStep;i++)T.captureState.recStep();
    flushTimeouts();return await run;
  };
  flushTimeouts();T.setShot(0,true);T.initHistory();
  const exportSideEffectState=()=>JSON.stringify({
    project:T.project,stage:T.stageToData(),sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,time:T.time,playing:T.playing,
    undo:T.undoDepth,history:T.historyCurrent,historyPending:T.historyPending,historyTimer:T.historyTimer,dirtyTimer:T.dirtyTimer,
    autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes
  });
  const exportTargetQueue=[],exportTargetPaths=new Map(),exportChooseCalls=[],exportSaveCalls=[];
  let exportChooseError=null,exportSaveError=null,exportFallbackCalls=0,exportTokenSequence=0;
  const queueExportTarget=(pathValue,canceled=false)=>{
    const target=canceled?{canceled:true}:{canceled:false,token:`export-target-${++exportTokenSequence}`,path:pathValue};
    if(!canceled)exportTargetPaths.set(target.token,pathValue);exportTargetQueue.push(target);return target;
  };
  sandbox.previsionDesktop={
    async chooseCaptureTarget(kind,suggestedName){
      exportChooseCalls.push({kind,suggestedName});
      if(exportChooseError){const error=exportChooseError;exportChooseError=null;throw error;}
      return exportTargetQueue.shift()||{canceled:true};
    },
    async saveCaptureTarget(token,bytes){
      exportSaveCalls.push({token,bytes:Array.from(bytes||[])});
      if(exportSaveError){const error=exportSaveError;exportSaveError=null;throw error;}
      return {canceled:false,path:exportTargetPaths.get(token)};
    },
    async saveExport(){exportFallbackCalls++;return {canceled:false,path:'/unexpected/fixed-export'};}
  };

  const frameCancelState=exportSideEffectState(),frameCancelRenderers=sandbox.__renderers.length,frameCancelSaves=exportSaveCalls.length;
  queueExportTarget('',true);const frameCancelResult=await T.exportCurrentFrame();
  assert(frameCancelResult===false&&exportSideEffectState()===frameCancelState&&sandbox.__renderers.length===frameCancelRenderers&&
    exportSaveCalls.length===frameCancelSaves&&!T.captureTransaction&&!T.captureTargetPending,
    '右下当前帧取消目标选择时零渲染、零写入、零项目/history/autosave/busy 副作用');

  const dialogFailureState=exportSideEffectState(),dialogFailureRecorders=constructedRecorders,dialogFailureAlerts=sandbox.__alerts.length;
  exportChooseError=new Error('dialog failed');const dialogFailureResult=await T.exportCurrentShotVideo();
  assert(dialogFailureResult===false&&exportSideEffectState()===dialogFailureState&&constructedRecorders===dialogFailureRecorders&&
    sandbox.__alerts.length===dialogFailureAlerts+1&&!T.captureTransaction&&!T.captureTargetPending,
    '当前镜头保存对话框失败在编码/冻结前退出，只反馈一次且零项目/history/autosave/busy 副作用');

  const sceneCancelState=exportSideEffectState(),sceneCancelRecorders=constructedRecorders;
  queueExportTarget('',true);const sceneCancelResult=await el('exportAll').onclick();
  assert(sceneCancelResult===false&&exportSideEffectState()===sceneCancelState&&constructedRecorders===sceneCancelRecorders&&
    !T.captureTransaction&&!T.captureTargetPending,
    '本场景取消目标选择时零编码、零冻结、零项目/history/autosave/busy 副作用');

  const pngPath='/selected/current-frame.png',pngSavesBefore=exportSaveCalls.length,pngRenderersBefore=sandbox.__renderers.length;
  queueExportTarget(pngPath);const pngSuccess=await T.exportCurrentFrame();
  assert(pngSuccess&&exportSaveCalls.length===pngSavesBefore+1&&exportSaveCalls.at(-1).bytes.length>0&&
    sandbox.__renderers.length===pngRenderersBefore+1&&el('saveState').textContent===sandbox.PreVisionI18n.t('export.saved',{path:pngPath}),
    '右下当前帧选择目标后才渲染，并通过一次性 token 保存非空 PNG 与反馈真实路径');

  const invalidTokenAlerts=sandbox.__alerts.length,invalidTokenSaves=exportSaveCalls.length;
  queueExportTarget('/selected/rejected-frame.png');exportSaveError=new Error('desktop.error.captureTargetInvalid');
  const invalidTokenResult=await T.exportCurrentFrame();
  assert(invalidTokenResult===false&&exportSaveCalls.length===invalidTokenSaves+1&&sandbox.__alerts.length===invalidTokenAlerts+1&&
    exportFallbackCalls===0&&!T.captureTransaction&&!T.captureTargetPending,
    '右下当前帧非法/过期 token 明确失败且不回退固定 export 目录');

  const shotPath='/selected/current-shot.mp4',shotSavesBefore=exportSaveCalls.length;
  queueExportTarget(shotPath);const targetedShotExpected=Math.max(2,Math.round(T.curShot().dur*24)+1),targetedShotRun=T.exportCurrentShotVideo(),targetedShotResult=await finishAutomaticRun(targetedShotRun),
    targetedShotMedia=T.inspectSeedanceMp4(new Uint8Array(exportSaveCalls.at(-1)?.bytes||[]));
  assert(targetedShotResult&&exportSaveCalls.length===shotSavesBefore+1&&targetedShotMedia.fps===24&&targetedShotMedia.frameCount===targetedShotExpected&&
    el('saveState').textContent===sandbox.PreVisionI18n.t('export.saved',{path:shotPath})&&!T.captureTransaction,
    '当前镜头对最终 MP4 字节探针确认精确 24fps/计划 sample 数后，才通过一次性 token 写入');

  const scenePath='/selected/current-scene.mp4',sceneSavesBefore=exportSaveCalls.length;
  queueExportTarget(scenePath);const targetedSceneExpected=Math.max(2,Math.round(T.shots.reduce((sum,shot)=>sum+shot.dur,0)*24)+1),targetedSceneRun=el('exportAll').onclick(),targetedSceneResult=await finishAutomaticRun(targetedSceneRun),
    targetedSceneMedia=T.inspectSeedanceMp4(new Uint8Array(exportSaveCalls.at(-1)?.bytes||[]));
  assert(targetedSceneResult&&exportSaveCalls.length===sceneSavesBefore+1&&targetedSceneMedia.fps===24&&targetedSceneMedia.frameCount===targetedSceneExpected&&
    el('saveState').textContent===sandbox.PreVisionI18n.t('export.saved',{path:scenePath})&&!T.captureTransaction,
    '本场景对最终 MP4 字节探针确认精确 24fps/计划 sample 数后，才通过一次性 token 写入');

  for(const fault of [{kind:'shot',delta:-1,label:'drop'},{kind:'scene',delta:1,label:'extra'}]){
    sandbox.MediaRecorder=class extends TestMediaRecorder{stop(){this.state='inactive';const target=T.captureTransaction?.target,contract=T.automaticExportMediaContract(target),bytes=makeCaptureH264Mp4({...contract,frameCount:contract.frameCount+fault.delta});this.ondataavailable?.({data:new Blob([bytes],{type:this.mimeType})});this.onstop?.();}};
    const faultSaves=exportSaveCalls.length,faultAlerts=sandbox.__alerts.length;queueExportTarget(`/selected/${fault.label}.mp4`);
    const faultRun=fault.kind==='shot'?T.exportCurrentShotVideo():el('exportAll').onclick(),faultResult=await finishAutomaticRun(faultRun);
    assert(faultResult===false&&exportSaveCalls.length===faultSaves&&sandbox.__alerts.length===faultAlerts+1&&!T.captureTransaction,
      `普通${fault.kind==='shot'?'当前镜':'本场景'} ${fault.label} sample 实体字节与 24fps 计划不同时 fail closed 且零下载`);
  }
  sandbox.MediaRecorder=TestMediaRecorder;

  let webmFixture={frameDelta:0,timestampFps:24};
  class WebmOnlyMediaRecorder extends TestMediaRecorder{
    static isTypeSupported(type){return /^video\/webm(?:;|$)/i.test(type);}
    stop(){this.state='inactive';const contract=T.automaticExportMediaContract(T.captureTransaction?.target),bytes=makeCaptureWebm({
      ...contract,frameCount:contract.frameCount+webmFixture.frameDelta,timestampFps:webmFixture.timestampFps
    });this.ondataavailable?.({data:new Blob([bytes],{type:this.mimeType})});this.onstop?.();}
  }
  sandbox.MediaRecorder=WebmOnlyMediaRecorder;
  const webmShotPath='/selected/current-shot.webm',webmShotSaves=exportSaveCalls.length;
  queueExportTarget(webmShotPath);const webmShotRun=T.exportCurrentShotVideo(),webmShotResult=await finishAutomaticRun(webmShotRun),
    webmShotContract=T.automaticExportMediaContract(T.captureAutomaticExportTarget('shot')),
    webmShotMedia=T.inspectAutomaticExportWebm(new Uint8Array(exportSaveCalls.at(-1)?.bytes||[]));
  assert(webmShotResult===true&&exportSaveCalls.length===webmShotSaves+1&&exportChooseCalls.at(-1).suggestedName.endsWith('.webm')&&
    T.assertAutomaticExportWebm(webmShotContract,webmShotMedia)===webmShotMedia&&webmShotMedia.frameCount===webmShotContract.frameCount,
    '仅 WebM 可用时，当前镜保留 MP4→WebM 回退并在实际 EBML block/timecode 严格确认 24fps/sample 数后保存');

  const webmScenePath='/selected/current-scene.webm',webmSceneSaves=exportSaveCalls.length;
  queueExportTarget(webmScenePath);const webmSceneRun=el('exportAll').onclick(),webmSceneResult=await finishAutomaticRun(webmSceneRun),
    webmSceneContract=T.automaticExportMediaContract(T.captureAutomaticExportTarget('scene')),
    webmSceneMedia=T.inspectAutomaticExportWebm(new Uint8Array(exportSaveCalls.at(-1)?.bytes||[]));
  assert(webmSceneResult===true&&exportSaveCalls.length===webmSceneSaves+1&&exportChooseCalls.at(-1).suggestedName.endsWith('.webm')&&
    T.assertAutomaticExportWebm(webmSceneContract,webmSceneMedia)===webmSceneMedia&&webmSceneMedia.frameCount===webmSceneContract.frameCount,
    '仅 WebM 可用时，本场景保留 MP4→WebM 回退并在实际 EBML block/timecode 严格确认 24fps/sample 数后保存');

  for(const fault of [
    {kind:'shot',frameDelta:0,timestampFps:25,label:'wrong-fps'},
    {kind:'shot',frameDelta:-1,timestampFps:24,label:'drop'},
    {kind:'scene',frameDelta:1,timestampFps:24,label:'extra'}
  ]){
    webmFixture=fault;const faultSaves=exportSaveCalls.length,faultAlerts=sandbox.__alerts.length;queueExportTarget(`/selected/webm-${fault.label}.webm`);
    const faultRun=fault.kind==='shot'?T.exportCurrentShotVideo():el('exportAll').onclick(),faultResult=await finishAutomaticRun(faultRun);
    assert(faultResult===false&&exportSaveCalls.length===faultSaves&&sandbox.__alerts.length===faultAlerts+1&&!T.captureTransaction,
      `普通 WebM ${fault.label} 实体 block/sample/timecode 与 24fps 计划不同时 fail closed 且零保存`);
  }
  webmFixture={frameDelta:0,timestampFps:24};sandbox.MediaRecorder=TestMediaRecorder;

  const encodingFailureState=exportSideEffectState(),encodingFailureSaves=exportSaveCalls.length,encodingFailureAlerts=sandbox.__alerts.length;
  sandbox.MediaRecorder=undefined;queueExportTarget('/selected/encoding-failure.webm');
  const encodingFailureResult=await T.exportCurrentShotVideo();sandbox.MediaRecorder=TestMediaRecorder;
  assert(encodingFailureResult===false&&exportSaveCalls.length===encodingFailureSaves&&sandbox.__alerts.length===encodingFailureAlerts+1&&
    exportSideEffectState()===encodingFailureState&&exportFallbackCalls===0&&!T.captureTransaction&&!T.captureTargetPending,
    '当前镜头编码失败不写一次性目标、不回退固定目录，并完整恢复项目/history/autosave/busy 状态');
  delete sandbox.previsionDesktop;

  const automaticFixtureProject=JSON.parse(JSON.stringify(T.project));
  automaticFixtureProject.scenes[T.sceneIdx]=T.stageToData();
  const automaticFixtureState={sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,time:T.time,selectedLabel:T.selected?.label||'',
    previewAnimation:T.serializePreviewAnimationState(),autosave:sandbox.localStorage.getItem('previz_autosave_v3'),
    writes:sandbox.localStorage._writes,setLogLength:sandbox.localStorage._setLog.length};
  const extraScene=JSON.parse(JSON.stringify(T.project.scenes[0]));extraScene.name='identity-other-scene';T.project.scenes.push(extraScene);
  const selectedForIdentity=T.actors.find(actor=>actor.kind==='char')||T.actors[0];T.select(selectedForIdentity);
  const pendingPose=selectedForIdentity.pose==='crouch'?'stand':'crouch';T.setPose(pendingPose);
  const pendingStage=JSON.stringify(T.stageToData()),pendingSceneRef=T.project.scenes[T.sceneIdx],pendingHistoryId=T.historyTimer,pendingDirtyId=T.dirtyTimer;
  const pendingHistoryTask=timeouts.find(item=>item.id===pendingHistoryId),pendingDirtyTask=timeouts.find(item=>item.id===pendingDirtyId);
  const pendingWritesBefore=sandbox.localStorage._writes,pendingRun=T.exportCurrentShotVideo(),pendingTxn=T.captureTransaction,pendingTarget=pendingTxn?.target;
  T.forceCaptureNavigation(0,Math.min(2,T.shots.length-1));pendingHistoryTask?.fn();pendingDirtyTask?.fn();
  const pendingAutosave=JSON.parse(sandbox.localStorage.getItem('previz_autosave_v3'));
  assert(pendingHistoryTask&&pendingDirtyTask&&T.historyTimer===null&&T.dirtyTimer===null&&T.project.scenes[0]===pendingSceneRef&&
    sandbox.localStorage._writes===pendingWritesBefore+1&&JSON.stringify(pendingAutosave.scenes[0])===pendingStage&&T.captureTransaction===pendingTxn,
    '导出开始后既有 history/autosave timer 未被 cancel/reschedule，并在原回调中提交起始语义快照');
  T.project.scenes[0]=JSON.parse(pendingStage);const equivalentSyncedScene=T.project.scenes[0];
  const pendingResult=await finishAutomaticRun(pendingRun);
  assert(pendingResult===true&&pendingTarget?.sceneRef===pendingSceneRef&&equivalentSyncedScene!==pendingSceneRef&&
    JSON.stringify(equivalentSyncedScene)===pendingTarget.content.sceneJson&&!T.captureTransaction,
    '导出前合法编辑的 250/800ms history/autosave 按原 timer 触发，写入冻结起始内容且等价 sync 不撞掉捕获身份');
  T.initHistory();
  if(!T.curScene().bg)T.curScene().bg={asset:'capture-test-pano',yaw:7,radius:60,y:1.6,gp:true};
  T.recordPreviewKeyGroup(T.previewCameraOwnerKey(T.shotIdx),{fov:T.curShot().fov},0,'manual');
  const captureFovShot=T.curShot();captureFovShot.lock=selectedForIdentity.label;captureFovShot.timingMode='custom';captureFovShot.fov=39;
  T.ensureCamKeys(captureFovShot)[0].fov=79;T.ensureCamFovTimes(captureFovShot)[0]=0;T.setTime(0);T.updateShotCam();
  selectedForIdentity.joints=Object.assign({},selectedForIdentity.joints,{neckY:17});T.applyJoints(selectedForIdentity);
  const identityBefore={project:JSON.stringify(T.project),sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,time:T.time,playing:T.playing,
    selected:selectedForIdentity.label,pose:selectedForIdentity.pose,stage:JSON.stringify(T.stageToData()),undo:T.undoDepth,history:T.historyCurrent,
    historyPending:T.historyPending,historyTimer:T.historyTimer,dirty:T.dirtyTimer,
    autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes};
  const samplingActor=T.actors.find(actor=>actor.pathPts.length>=2),samplingTime=T.time;
  T.setTime(0);T.updateActors();const expectedActor0=samplingActor?.obj.position.clone();T.setTime(1/24);T.updateActors();const expectedActor1=samplingActor?.obj.position.clone();T.setTime(samplingTime);T.updateActors();
  const shotFrameSamples=[],shotIdentityRender=T.recRenderer.render;T.recRenderer.render=function(_scene,camera){shotFrameSamples.push({time:T.time,aspect:camera.aspect,fov:camera.fov,actor:samplingActor?.obj.position.clone()});return shotIdentityRender.apply(this,arguments);};
  lastRecorder=null;const shotIdentityRun=T.exportCurrentShotVideo(),shotTxn=T.captureTransaction,shotTarget=shotTxn?.target;
  await new Promise(resolve=>setImmediate(resolve));
  const shotUiClick=fireDocument('click',{target:el('nextShot')}),shotShortcut=fireWindow('keydown',{key:'ArrowRight',code:'ArrowRight',target:documentBody});
  const directStageBefore=JSON.stringify(T.stageToData()),cameraPathBefore=JSON.stringify(T.curShot().camPts.map(point=>point.toArray())),
    directPreviewBefore=T.serializePreviewAnimationState(),
    directShotRefs=T.shots.slice(),directActorRefs=T.actors.slice(),sunBefore=JSON.stringify(T.currentSun()),aspectBefore=T.aspectSize.slice(),cameraAspectBefore=T.shotCam.aspect;
  const fovGateBefore={project:JSON.stringify(T.project),stage:directStageBefore,scalar:T.curShot().fov,key:JSON.stringify(T.ensureCamKeys(T.curShot())),
    draft:JSON.stringify(T.currentUnifiedCameraDraftPose()),runtime:T.shotCam.fov,history:T.historyCommitSequence,undo:T.undoDepth,historyTimer:T.historyTimer,
    dirty:T.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes};
  T.setMotionSelected({type:'camera',label:'camera',index:0});el('motionEase').value='easeInOut';
  const blockedShot=T.setShot(1,true),blockedScene=T.loadScene(1,true),blockedNew=T.activateNewProject(),blockedOpen=T.openProjectData(T.newProject()),
    blockedDelete=T.deleteShot(1),blockedBlankSceneCreate=T.newBlankScene(),blockedSceneCreate=T.newSceneFromTpl(0),blockedPose=T.setPose('crouch'),
    blockedApplyPose=T.applyPose(selectedForIdentity),blockedActorTime=T.applyActorTimeLink(samplingActor),blockedPreset=T.applyPreset('push'),
    blockedShotDur=el('shotDur').oninput({target:{value:T.curShot().dur+2}}),blockedLock=el('lockSel').onchange({target:{value:'全局'}}),
    blockedCamY=el('camPtY').oninput({target:{value:T.curShot().camPts[0].y+2}}),blockedAddPt=el('addPt').onclick(),blockedDelPt=el('delPt').onclick(),
    blockedPathTiming=el('pathTimingMode').onchange({target:{value:'arcLength'}}),blockedSyncActor=el('syncActorSel').onchange({target:{value:selectedForIdentity.label}}),
    blockedFov=el('fov').oninput({target:{value:73}}),blockedMotionEase=el('motionEase').onchange(),
    blockedPano=el('panoYaw').oninput({target:{value:123}}),blockedPanoClear=el('clearPano').onclick(),
    blockedSemanticReset=el('semanticResetSize').onclick(),blockedMount=el('mountSel').onchange({target:{value:'__none__'}}),
    blockedActorDelete=el('delActor').onclick(),blockedActorAdd=el('addAdultMale').onclick(),blockedShotAdd=el('addshot').onclick(),
    blockedJoint=T.tweakJoint('neckY',33),blockedGround=T.cleanGroundAppearance&&T.currentGroundAppearance?T.setGroundAppearance({style:'color',color:'#ff0000'}):false,
    blockedView=T.writeCurrentView(true),blockedEndpoint=T.setEndpointFromView(true),blockedSemantic=T.applySemanticDimensionInput(),
    blockedMove=T.moveActorSafely(selectedForIdentity,selectedForIdentity.obj.position.x+2,selectedForIdentity.obj.position.z+2),
    blockedElevation=T.setActorElevation(selectedForIdentity,(selectedForIdentity.elev||0)+2),blockedSun=T.setSunPreset([1,2,3],4200,.8,.2,2),
    blockedSunToggle=el('sunOn').onchange({target:{checked:!el('sunOn').checked}}),blockedSeek=T.seekSceneTime(T.shots.reduce((sum,shot)=>sum+shot.dur,0)),
    blockedPreviewClear=T.clearPreviewAnimationState(),blockedPreviewRestore=T.restorePreviewAnimationState(JSON.stringify({serial:0,entries:[]})),
    blockedCopyActorPath=T.copyActorPathToCamera(samplingActor?.label||selectedForIdentity.label),
    blockedAddActorPath=T.addActorPathPoint(samplingActor||selectedForIdentity,new sandbox.THREE.Vector3(9,0,9)),
    blockedRemoveActorPath=T.removeActorPathPoint(samplingActor||selectedForIdentity,0),
    blockedTranslateCamera=T.translateCameraRoute(T.curShot().camPts.map(point=>point.clone()),2,2),blockedPasteMotion=T.pasteMotionKeys();
  const liveAspectForGuard=el('aspect').value;el('aspect').value=liveAspectForGuard==='9:16'?'16:9':'9:16';const blockedAspect=el('aspect').onchange({target:el('aspect')});el('aspect').value=liveAspectForGuard;
  const fovGateAfter={project:JSON.stringify(T.project),stage:JSON.stringify(T.stageToData()),scalar:T.curShot().fov,key:JSON.stringify(T.ensureCamKeys(T.curShot())),
    draft:JSON.stringify(T.currentUnifiedCameraDraftPose()),runtime:T.shotCam.fov,history:T.historyCommitSequence,undo:T.undoDepth,historyTimer:T.historyTimer,
    dirty:T.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes};
  assert(blockedFov===false&&JSON.stringify(fovGateAfter)===JSON.stringify(fovGateBefore),
    `capture gate 下 FOV input 在 authored/draft/runtime/project/history/autosave 首写前完整拒绝：before=${JSON.stringify(fovGateBefore)} after=${JSON.stringify(fovGateAfter)}`);
  T.setTime(shotTarget.duration*.8);T.forceCaptureNavigation(0,2);T.captureState.recStep?.();
  assert(shotTarget?.kind==='shot'&&shotTarget.sceneRef===T.project.scenes[0]&&shotTarget.shots.length===1&&
    shotTarget.shots[0].ref===T.shots[0]&&shotTarget.fps===24&&T.shotIdx===0&&T.curShot()===shotTarget.shots[0].ref&&Math.abs(T.time-1/24)<1e-9,
    '当前镜头导出冻结 scene/shot 且时间由 frame index 唯一派生，迟到 shotIdx/time 污染在下一编码帧前失效');
  assert(shotUiClick.defaultPrevented&&shotUiClick.immediatePropagationStopped&&shotShortcut.defaultPrevented&&
    blockedShot===false&&blockedScene===false&&blockedNew===false&&blockedOpen===false&&blockedDelete===false&&blockedBlankSceneCreate===false&&blockedSceneCreate===false&&blockedPose===false&&
    blockedApplyPose===false&&blockedActorTime===false&&blockedPreset===false&&blockedShotDur===false&&blockedLock===false&&blockedCamY===false&&blockedAddPt===false&&blockedDelPt===false&&
    blockedPathTiming===false&&blockedSyncActor===false&&blockedFov===false&&blockedMotionEase===false&&blockedPano===false&&blockedPanoClear===false&&
    blockedSemanticReset===false&&blockedMount===false&&blockedActorDelete===false&&blockedActorAdd===false&&blockedShotAdd===false&&
    blockedJoint===false&&blockedGround===false&&blockedView===false&&blockedEndpoint===false&&blockedSemantic===false&&blockedMove===false&&blockedElevation===false&&
    blockedSun===false&&blockedSunToggle===false&&blockedSeek===false&&blockedPreviewClear===false&&blockedPreviewRestore===false&&blockedAspect===false&&
    blockedCopyActorPath===false&&blockedAddActorPath===false&&blockedRemoveActorPath===false&&blockedTranslateCamera===false&&blockedPasteMotion===false&&
    T.serializePreviewAnimationState()===directPreviewBefore&&JSON.stringify(T.stageToData())===directStageBefore&&
    JSON.stringify(T.curShot().camPts.map(point=>point.toArray()))===cameraPathBefore&&
    T.shots.length===directShotRefs.length&&T.shots.every((shot,index)=>shot===directShotRefs[index])&&T.actors.length===directActorRefs.length&&T.actors.every((actor,index)=>actor===directActorRefs[index])&&
    JSON.stringify(T.currentSun())===sunBefore&&JSON.stringify(T.aspectSize)===JSON.stringify(aspectBefore)&&T.shotCam.aspect===cameraAspectBefore,
    '自动导出期间 UI/快捷键及 camera、actor/path、timeline、preview store、背景、delete/add 等程序入口全部在首次 authoring 写之前拒绝');
  const shotIdentityResult=await finishAutomaticRun(shotIdentityRun);
  T.recRenderer.render=shotIdentityRender;
  const actorSamplingOk=!samplingActor||shotFrameSamples.length>1&&shotFrameSamples[0].actor.distanceTo(expectedActor0)<1e-6&&
    shotFrameSamples[1].actor.distanceTo(expectedActor1)<1e-6&&shotFrameSamples[0].actor.distanceTo(shotFrameSamples[1].actor)>1e-6;
  assert(shotIdentityResult===true&&!T.captureTransaction&&T.sceneIdx===identityBefore.sceneIdx&&T.shotIdx===identityBefore.shotIdx&&
    T.time===identityBefore.time&&T.playing===identityBefore.playing&&T.selected?.label===identityBefore.selected&&selectedForIdentity.pose===identityBefore.pose&&
    JSON.stringify(T.project)===identityBefore.project&&JSON.stringify(T.stageToData())===identityBefore.stage&&T.undoDepth===identityBefore.undo&&T.historyCurrent===identityBefore.history&&
    T.historyPending===identityBefore.historyPending&&T.historyTimer===identityBefore.historyTimer&&
    T.dirtyTimer===identityBefore.dirty&&sandbox.localStorage.getItem('previz_autosave_v3')===identityBefore.autosave&&sandbox.localStorage._writes===identityBefore.writes&&
    actorSamplingOk&&shotFrameSamples[0]?.fov===79&&shotFrameSamples.every(frame=>Math.abs(frame.aspect-shotTarget.resolution[0]/shotTarget.resolution[1])<1e-9),
    '当前镜头成功导出至少一帧使用当前 camKey 的 79° shotCam FOV，并 exactly-once 恢复完整导航/播放/选择/预览状态，project/history/autosave 与既有 pending timer 零副作用');

  const deferredFailureTxn=T.beginCaptureTransaction('deferred-finalize-failure'),deferredFailureState=T.captureAutomaticCaptureState();
  T.deferAutomaticCaptureMutation(()=>{throw new Error('deferred finalize failed');});
  const deferredFinalizeError=T.finalizeCaptureTransaction(deferredFailureTxn,{restoreState:deferredFailureState});
  assert(deferredFinalizeError?.message==='deferred finalize failed'&&!T.captureTransaction&&deferredFailureTxn.finalized,
    'deferred callback 抛错仍在 restore 后释放事务，且 finalize 显式返回失败而非静默吞掉');

  const restoreFailureState=T.captureAutomaticCaptureState(),restoreFailureAlerts=sandbox.__alerts.length,
    restoreFailureRun=T.exportCurrentShotVideo(),restoreFailureTxn=T.captureTransaction;
  await Promise.resolve();const restoreFailureQueryAll=documentStub.querySelectorAll;
  documentStub.querySelectorAll=selector=>{if(selector==='#rightScroll > details.sec')throw new Error('automatic restore failed');return restoreFailureQueryAll(selector);};
  const restoreFailureResult=await finishAutomaticRun(restoreFailureRun);documentStub.querySelectorAll=restoreFailureQueryAll;
  assert(restoreFailureResult===false&&!T.captureTransaction&&restoreFailureTxn.finalized&&sandbox.__alerts.length===restoreFailureAlerts+1,
    'success 媒体后的 restore 故障不报告成功：仍 release，wrapper 返回 false 并显式反馈一次');
  T.restoreAutomaticCaptureState(restoreFailureState);flushTimeouts();T.initHistory();

  const resolutionTarget=T.captureAutomaticExportTarget('shot'),resolutionTxn=T.beginCaptureTransaction('shot-export');
  T.bindAutomaticCaptureTarget(resolutionTxn,resolutionTarget);const liveAspectBefore=el('aspect').value;
  el('aspect').value=liveAspectBefore==='9:16'?'16:9':'9:16';
  const maliciousStageBefore=JSON.stringify(T.stageToData()),maliciousActorRefs=T.actors.slice();let blockedOnStartPreset,blockedOnStartDelete;
  const resolutionRun=T.recordBlob(resolutionTarget.duration,()=>{blockedOnStartPreset=T.applyPreset('push');blockedOnStartDelete=el('delActor').onclick();},{transaction:resolutionTxn,owner:'shot-export',retainTransaction:true,target:resolutionTarget});
  const frozenRecorderSize=T.recRenderer.lastSize?.slice();T.stopActiveCapture();let resolutionCancel='';
  try{await resolutionRun;}catch(error){resolutionCancel=error.code;}finally{el('aspect').value=liveAspectBefore;T.finalizeCaptureTransaction(resolutionTxn);}
  assert(resolutionCancel==='CAPTURE_CANCELLED'&&JSON.stringify(frozenRecorderSize)===JSON.stringify([...resolutionTarget.resolution,false])&&
    blockedOnStartPreset===false&&blockedOnStartDelete===false&&JSON.stringify(T.stageToData())===maliciousStageBefore&&
    T.actors.length===maliciousActorRefs.length&&T.actors.every((actor,index)=>actor===maliciousActorRefs[index]),
    'recordBlob 只用 target.resolution，且 onStart 不持有全局 mutation bypass，意外 camera/delete mutator 仍被拒绝');

  T.markDirty();const pendingCancelTimer=T.dirtyTimer,pendingCancelHistoryTimer=T.historyTimer;
  const pendingCancelAutosave=sandbox.localStorage.getItem('previz_autosave_v3'),pendingCancelWrites=sandbox.localStorage._writes;
  const pendingCancelRun=T.exportCurrentShotVideo(),pendingCancelTxn=T.captureTransaction;
  const firstPendingStop=T.stopActiveCapture(),secondPendingStop=T.stopActiveCapture();const pendingCancelResult=await pendingCancelRun;
  assert(pendingCancelResult===false&&firstPendingStop===true&&secondPendingStop===false&&!T.captureTransaction&&pendingCancelTxn.finalized&&
    T.dirtyTimer===pendingCancelTimer&&T.historyTimer===pendingCancelHistoryTimer&&
    sandbox.localStorage.getItem('previz_autosave_v3')===pendingCancelAutosave&&sandbox.localStorage._writes===pendingCancelWrites,
    'cancel 与重复 stop 只 finalize 一次，导出前既有 dirty/history timer 及 pending autosave 不清除、不重建、不延后');
  flushTimeouts();T.initHistory();

  T.markDirty();const noOpHistoryTimer=T.historyTimer,noOpDirtyTimer=T.dirtyTimer,noOpHistoryCurrent=T.historyCurrent,
    noOpLifecycle=T.historyLifecycleSequence,noOpHistoryTask=timeouts.find(item=>item.id===noOpHistoryTimer);
  const noOpRun=T.exportCurrentShotVideo();noOpHistoryTask?.fn();
  assert(noOpHistoryTask&&T.captureTransaction&&T.historyTimer===null&&!T.historyPending&&T.historyCurrent===noOpHistoryCurrent&&
    T.historyLifecycleSequence===noOpLifecycle+1&&T.dirtyTimer===noOpDirtyTimer,
    '合法 pending history 的 250ms no-op 回调在自动导出中按原计划消费，且不触碰既有 autosave timer');
  T.stopActiveCapture();await noOpRun;
  assert(!T.captureTransaction&&T.historyTimer===null&&!T.historyPending&&T.historyCurrent===noOpHistoryCurrent&&T.dirtyTimer===noOpDirtyTimer,
    'finalize 不会复活已消费的 no-op history timer 或制造无实际 timer 的幽灵 pending');
  flushTimeouts();T.initHistory();

  const crossSceneBefore={scene:T.sceneIdx,shot:T.shotIdx,stage:JSON.stringify(T.stageToData()),history:T.historyCurrent,undo:T.undoDepth};
  const crossSceneFrames=[],crossRender=T.recRenderer.render;T.recRenderer.render=function(...args){crossSceneFrames.push({scene:T.sceneIdx,ref:T.curShot()});return crossRender.apply(this,args);};
  const crossSceneRun=T.exportCurrentShotVideo(),crossSceneTarget=T.captureTransaction?.target;
  await new Promise(resolve=>setImmediate(resolve));
  T.forceCaptureRuntimeScene(1);let crossSceneError=null;try{T.captureState.recStep?.();}catch(error){crossSceneError=error;}
  lastRecorder?.onerror?.(crossSceneError);const crossSceneResult=await crossSceneRun;T.recRenderer.render=crossRender;
  assert(crossSceneResult===false&&crossSceneError?.code==='CAPTURE_TARGET_LOST'&&!T.captureTransaction&&
    crossSceneFrames.every(frame=>frame.scene===crossSceneTarget.sceneIndex&&frame.ref===crossSceneTarget.shots[0].ref)&&
    T.sceneIdx===crossSceneBefore.scene&&T.shotIdx===crossSceneBefore.shot&&JSON.stringify(T.stageToData())===crossSceneBefore.stage&&
    T.historyCurrent===crossSceneBefore.history&&T.undoDepth===crossSceneBefore.undo,
    '真正载入另一 scene runtime 的迟到回调在下一编码帧前 fail closed，错误收尾恢复起始 scene/runtime/history 且不渲染异场景');

  const originalLateFileReader=sandbox.FileReader;let lateReader=null,lateImportCommits=0,lateReadCount=0,blockedDuringImportCommits=0;
  sandbox.FileReader=class{readAsDataURL(){lateReadCount++;lateReader=this;}};
  const groundBefore=JSON.parse(JSON.stringify(T.currentGroundAppearance())),assetIdsBefore=Object.keys(T.project.assets||{});
  T.importImage({name:'late-ground.jpg'},2048,2048,id=>{lateImportCommits++;T.setGroundAppearance({style:'image',asset:id});});
  const lateImportRun=T.exportCurrentShotVideo(),lateImportTxn=T.captureTransaction,
    blockedDuringImport=T.importImage({name:'during-export.jpg'},2048,2048,()=>{blockedDuringImportCommits++;});
  lateReader.result='data:image/jpeg;base64,AAAA';lateReader.onload?.();lateReader.onload?.();
  assert(blockedDuringImport===false&&lateReadCount===1&&blockedDuringImportCommits===0&&lateImportTxn?.deferredMutations.length===1&&lateImportCommits===0&&Object.keys(T.project.assets||{}).length===assetIdsBefore.length&&
    JSON.stringify(T.currentGroundAppearance())===JSON.stringify(groundBefore),
    '导出前已启动的图片导入迟到回调在 addAsset/ground 首次写之前排队，不留下未入 history/autosave 的半提交');
  T.stopActiveCapture();const lateImportResult=await lateImportRun;sandbox.FileReader=originalLateFileReader;
  const assetIdsAfter=Object.keys(T.project.assets||{}),lateAssetId=assetIdsAfter.find(id=>!assetIdsBefore.includes(id));
  assert(lateImportResult===false&&lateImportCommits===1&&blockedDuringImportCommits===0&&lateAssetId&&T.currentGroundAppearance().asset===lateAssetId&&!T.captureTransaction,
    '导出中才调用 importImage 不启动 FileReader 且取消后无提交；导出前迟到 import 在释放后 exactly-once 提交');
  T.curScene().ground=groundBefore;if(lateAssetId)delete T.project.assets[lateAssetId];T.applyGroundAppearance();flushTimeouts();T.initHistory();

  const originalTextureImage=sandbox.Image,delayedGround=T.currentGroundAppearance(),delayedAssetId='capture-delayed-texture',textureRandomState=testRandomState;let delayedTextureImage=null;
  sandbox.Image=class{constructor(){this.width=0;this.height=0;this.complete=false;delayedTextureImage=this;}set src(value){this._src=value;}get src(){return this._src;}};
  T.project.assets[delayedAssetId]={d:'data:image/jpeg;base64,DELAYED',w:64,h:32};T.curScene().ground={style:'image',asset:delayedAssetId};T.applyGroundAppearance();
  const delayedRecorderCount=constructedRecorders,delayedRenderCount=T.recRenderer.renderCalls,delayedTextureRun=T.exportCurrentShotVideo(),delayedTextureTxn=T.captureTransaction;
  await Promise.resolve();
  assert(delayedTextureTxn&&delayedTextureImage&&constructedRecorders===delayedRecorderCount&&T.recRenderer.renderCalls===delayedRenderCount,
    '自动捕获 preflight 在目标纹理 ready/error 前不构造 MediaRecorder、也不渲染首帧');
  delayedTextureImage.width=64;delayedTextureImage.height=32;delayedTextureImage.complete=true;delayedTextureImage.onload?.();await Promise.resolve();
  const delayedTextureResult=await finishAutomaticRun(delayedTextureRun);sandbox.Image=originalTextureImage;
  assert(delayedTextureResult===true&&constructedRecorders===delayedRecorderCount+1&&!T.captureTransaction,
    '目标地面纹理 ready 后才开始编码，避免同一视频前帧空白、后帧突然出现');
  T.curScene().ground=delayedGround;T.applyGroundAppearance();delete T.project.assets[delayedAssetId];T.gcAssets();flushTimeouts();T.initHistory();

  const failedTextureId='capture-failed-texture';let failedTextureImage=null;
  sandbox.Image=class{constructor(){this.width=0;this.height=0;this.complete=false;failedTextureImage=this;}set src(value){this._src=value;}get src(){return this._src;}};
  T.project.assets[failedTextureId]={d:'data:image/jpeg;base64,FAILED',w:64,h:32};T.curScene().ground={style:'image',asset:failedTextureId};T.applyGroundAppearance();
  const failedTextureRecorders=constructedRecorders,failedTextureRenders=T.recRenderer.renderCalls,failedTextureAlerts=sandbox.__alerts.length,
    failedTextureRun=T.exportCurrentShotVideo(),failedTextureTxn=T.captureTransaction;
  await Promise.resolve();failedTextureImage.onerror?.(new Error('texture failed'));const failedTextureResult=await failedTextureRun;
  assert(failedTextureTxn&&failedTextureResult===false&&constructedRecorders===failedTextureRecorders&&T.recRenderer.renderCalls===failedTextureRenders&&
    sandbox.__alerts.length===failedTextureAlerts+1&&!T.captureTransaction,
    '任一目标纹理 onerror 时 preflight fail closed：不构造 recorder、不渲首帧、一次明确反馈并恢复状态');
  T.curScene().ground=delayedGround;T.applyGroundAppearance();delete T.project.assets[failedTextureId];T.gcAssets();

  const hangingTextureId='capture-hanging-texture';let hangingTextureImage=null;
  sandbox.Image=class{constructor(){this.width=0;this.height=0;this.complete=false;hangingTextureImage=this;}set src(value){this._src=value;}get src(){return this._src;}};
  T.project.assets[hangingTextureId]={d:'data:image/jpeg;base64,HANGING',w:64,h:32};T.curScene().ground={style:'image',asset:hangingTextureId};T.applyGroundAppearance();
  const hangingRecorders=constructedRecorders,hangingRenders=T.recRenderer.renderCalls,hangingRun=T.exportCurrentShotVideo(),hangingTxn=T.captureTransaction;
  await Promise.resolve();const hangingStopEnabled=!el('topRecord').disabled&&el('topRecordLabel').textContent==='停止录屏';el('topRecord').click();
  const hangingResult=await Promise.race([hangingRun,new Promise(resolve=>setTimeout(()=>resolve('timeout'),150))]);
  assert(hangingTextureImage&&hangingTxn&&hangingStopEnabled&&hangingResult===false&&constructedRecorders===hangingRecorders&&
    T.recRenderer.renderCalls===hangingRenders&&!T.captureTransaction&&!el('topRecord').disabled&&!el('topRecord').classList.contains('recording')&&el('topRecordLabel').textContent==='录屏',
    '目标纹理永不 load/error 时 automatic prelude 刷新真实 disabled 语义，用户可点击顶部停止；export 短期限 false settle 且 UI/事务无残留');
  sandbox.Image=originalTextureImage;T.curScene().ground=delayedGround;T.applyGroundAppearance();delete T.project.assets[hangingTextureId];T.gcAssets();testRandomState=textureRandomState;flushTimeouts();T.initHistory();

  T.rebuildViz();let pointerHandle=T.camHandles.find(handle=>handle.userData.hitTargetOnly),pointerPoint=T.curShot().camPts[pointerHandle.userData.idx];
  const pointerView={position:T.viewCam.position.clone(),quaternion:T.viewCam.quaternion.clone(),aspect:T.viewCam.aspect};
  T.viewCam.position.copy(pointerPoint).add(new sandbox.THREE.Vector3(0,0,10));T.viewCam.lookAt(pointerPoint);T.viewCam.updateMatrixWorld(true);T.updateVizScales(T.viewCam);pointerHandle.updateMatrixWorld(true);
  const captureCanvas=el('gl'),pointerX=captureCanvas.clientWidth/2,pointerY=captureCanvas.clientHeight/2;
  T.initHistory();const authoredDragBefore=JSON.stringify(T.stageToData());
  captureCanvas.dispatch('pointerdown',{pointerId:776,button:0,clientX:pointerX,clientY:pointerY,shiftKey:false});
  captureCanvas.dispatch('pointermove',{pointerId:776,buttons:1,clientX:pointerX,clientY:pointerY,movementX:0,movementY:-25,altKey:true});
  const authoredDragMoved=JSON.stringify(T.stageToData()),authoredDragWasMoved=!!T.dragging?.moved;
  const authoredDragRun=T.exportCurrentShotVideo(),authoredDragTarget=T.captureTransaction?.target;
  const authoredDragSettled=!T.dragging,authoredDragHistoryTimer=T.historyTimer;T.stopActiveCapture();await authoredDragRun;flushTimeouts();
  T.undoLast();const authoredDragUndone=JSON.stringify(T.stageToData())===authoredDragBefore;flushTimeouts();T.initHistory();
  assert(authoredDragWasMoved&&authoredDragMoved!==authoredDragBefore&&authoredDragSettled&&authoredDragHistoryTimer&&
    authoredDragTarget?.content.sceneJson===authoredDragMoved&&authoredDragUndone&&!T.captureTransaction,
    'pointerdown+move 的已发生 authoring 在冻结前结算；立即取消并冲刷 timer 后仍可 undo 回拖前状态');
  T.rebuildViz();pointerHandle=T.camHandles.find(handle=>handle.userData.hitTargetOnly);pointerPoint=T.curShot().camPts[pointerHandle.userData.idx];
  T.viewCam.position.copy(pointerPoint).add(new sandbox.THREE.Vector3(0,0,10));T.viewCam.lookAt(pointerPoint);T.viewCam.updateMatrixWorld(true);T.updateVizScales(T.viewCam);pointerHandle.updateMatrixWorld(true);
  captureCanvas.dispatch('pointerdown',{pointerId:777,button:0,clientX:pointerX,clientY:pointerY,shiftKey:false});
  const pointerDownActive=T.dragging?.handle===pointerHandle,pointerStageBefore=JSON.stringify(T.stageToData()),pointerRestore=T.captureAutomaticCaptureState();
  const pointerTxn=T.beginCaptureTransaction('pointer-freeze');
  captureCanvas.dispatch('pointermove',{pointerId:777,buttons:1,clientX:pointerX,clientY:pointerY,movementX:0,movementY:-25,altKey:true});
  const pointerStageAfter=JSON.stringify(T.stageToData());T.finalizeCaptureTransaction(pointerTxn,{restoreState:pointerRestore});
  assert(pointerDownActive&&!T.dragging&&pointerStageAfter===pointerStageBefore&&!T.captureTransaction,
    'authoring pointerdown 会话在自动事务 begin 时先结算，随后迟到 pointermove 在首次 camera/path 写之前被隔离');
  T.viewCam.position.copy(pointerView.position);T.viewCam.quaternion.copy(pointerView.quaternion);T.viewCam.aspect=pointerView.aspect;T.viewCam.updateProjectionMatrix();T.viewCam.updateMatrixWorld(true);T.clearPointPreview();T.rebuildViz();

  const previousWindowEvent=sandbox.Event,previousWindowDispatch=sandbox.dispatchEvent;
  sandbox.Event=class{constructor(type){this.type=type;}};sandbox.dispatchEvent=event=>fireWindow(event.type,event);
  const motionRuler=el('motionRuler'),timelineRestore=T.captureAutomaticCaptureState();
  motionRuler.dispatch('pointerdown',{pointerId:778,button:0,clientX:motionRuler.clientWidth*.37,preventDefault:noop,stopPropagation:noop});
  const timelineTimeAtBegin=T.time,timelineTxn=T.beginCaptureTransaction('timeline-pointer-freeze');
  fireWindow('pointermove',{pointerId:778,clientX:motionRuler.clientWidth*.82});frames(1);
  const timelineTimeAfterLateMove=T.time,timelineSessionClosed=!motionRuler.classList.contains('scrubbing');
  T.finalizeCaptureTransaction(timelineTxn,{restoreState:timelineRestore});
  const timelineExpectedShot=T.shotIdx,timelineExpectedDuration=T.curShot().dur,
    timelineExpectedTime=T.resolveMotionDragTime(timelineExpectedDuration*.82,{min:0,max:timelineExpectedDuration,pixelsPerSecond:motionRuler.clientWidth/timelineExpectedDuration}).time;
  motionRuler.dispatch('pointerdown',{pointerId:779,button:0,clientX:motionRuler.clientWidth*.12,preventDefault:noop,stopPropagation:noop});
  fireWindow('pointermove',{pointerId:779,clientX:motionRuler.clientWidth*.82});
  const pendingScrubRun=T.exportCurrentShotVideo(),pendingScrubTarget=T.captureTransaction?.target;T.stopActiveCapture();await pendingScrubRun;
  const pendingScrubFrozen=pendingScrubTarget?.shotIndex===timelineExpectedShot&&pendingScrubTarget?.shots[0]?.ref===T.shots[timelineExpectedShot]&&
    T.shotIdx===timelineExpectedShot&&Math.abs(T.time-timelineExpectedTime)<1e-6&&!motionRuler.classList.contains('scrubbing');
  if(previousWindowEvent===undefined)delete sandbox.Event;else sandbox.Event=previousWindowEvent;
  if(previousWindowDispatch===undefined)delete sandbox.dispatchEvent;else sandbox.dispatchEvent=previousWindowDispatch;
  assert(timelineSessionClosed&&timelineTimeAfterLateMove===timelineTimeAtBegin&&!T.captureTransaction,
    '自动事务 begin 通过 blur 可靠结算既有 timeline scrub，会话移除后迟到 pointermove 不再改写捕获时间');
  assert(pendingScrubFrozen&&!T.captureTransaction,
    'pending timeline scrub 的最后位置在 restoreState/target 之前由统一 prepare 边界结算，取消后恢复结算后的镜头与时间');

  const sceneRefs=T.shots.slice(),sceneStartShot=Math.min(2,sceneRefs.length-1),sceneStartTime=Math.min(.37,sceneRefs[sceneStartShot].dur*.5);
  T.setShot(sceneStartShot,true);T.setTime(sceneStartTime);T.updateActors();T.updateShotCam();
  const sceneIdentityState=T.captureAutomaticCaptureState();lastRecorder=null;
  const renderedSceneRefs=[],sceneRender=T.recRenderer.render;
  T.recRenderer.render=function(...args){renderedSceneRefs.push({scene:T.sceneIdx,shot:T.shotIdx,ref:T.curShot(),time:T.time});return sceneRender.apply(this,args);};
  const sceneIdentityRun=el('exportAll').onclick(),sceneTarget=T.captureTransaction?.target;
  T.forceCaptureNavigation(0,sceneRefs.length-1);const sceneIdentityResult=await finishAutomaticRun(sceneIdentityRun);T.recRenderer.render=sceneRender;
  const renderedSceneShotOrder=Array.from(new Set(renderedSceneRefs.map(frame=>frame.shot)));
  assert(sceneIdentityResult===true&&sceneTarget?.kind==='scene'&&sceneTarget.shots.length===sceneRefs.length&&
    sceneTarget.shots.every((item,index)=>item.ref===sceneRefs[index])&&renderedSceneRefs.length>1&&renderedSceneRefs[0].shot===0&&renderedSceneRefs[0].time===0&&
    renderedSceneRefs[1].shot===0&&sceneTarget.fps===24&&Math.abs(renderedSceneRefs[1].time-1/24)<1e-9&&
    renderedSceneRefs.every(frame=>frame.scene===sceneTarget.sceneIndex&&sceneTarget.shots.some(item=>item.index===frame.shot&&item.ref===frame.ref))&&
    JSON.stringify(renderedSceneShotOrder)===JSON.stringify(sceneTarget.shots.map(item=>item.index)),
    '本场景从非首镜头/非零时间启动仍以 C1@0、C1@1/24 开始，并逐一按序捕获冻结计划中的所有镜头');
  assert(T.sceneIdx===sceneIdentityState.sceneIdx&&T.shotIdx===sceneIdentityState.shotIdx&&T.time===sceneIdentityState.time&&
    T.playing===sceneIdentityState.playing&&T.captureState.playAllMode===sceneIdentityState.playAllMode,
    '本场景成功导出恢复起始 sceneIdx/shotIdx/time/playing/playAllMode');

  const seedancePreviewActor=T.actors.find(actor=>actor.pathPts.length>=2),seedanceCameraPreview=Math.max(0,T.curShot().camPts.length-1);
  T.previewCameraPoint(seedanceCameraPreview);if(seedancePreviewActor)T.previewActorPathPoint(seedancePreviewActor,seedancePreviewActor.pathPts.length-1);
  const seedancePreviewState={camera:T.previewCamPt,actor:T.previewActorPoint,count:T.previewActorCount},seedanceFrameSamples=[],seedanceVideoSamples=[];
  const seedancePrototypeRender=sandbox.THREE.WebGLRenderer.prototype.render,seedanceRecorderRender=T.recRenderer.render;
  sandbox.THREE.WebGLRenderer.prototype.render=function(scene,camera){if(this!==T.recRenderer)seedanceFrameSamples.push({time:T.time,camera:camera.position.clone(),actor:seedancePreviewActor?.obj.position.clone()});return seedancePrototypeRender.apply(this,arguments);};
  T.recRenderer.render=function(scene,camera){seedanceVideoSamples.push({time:T.time,camera:camera.position.clone(),actor:seedancePreviewActor?.obj.position.clone()});return seedanceRecorderRender.apply(this,arguments);};
  let seedanceZip=null;const seedanceCreateObjectURL=sandbox.URL.createObjectURL;
  class SeedanceIdentityRecorder extends TestMediaRecorder{
    stop(){this.state='inactive';const contract=T.automaticExportMediaContract(T.captureTransaction?.target);
      this.ondataavailable?.({data:new Blob([makeCaptureH264Mp4(contract)],{type:this.mimeType})});this.onstop?.();}
  }
  sandbox.MediaRecorder=SeedanceIdentityRecorder;
  sandbox.URL.createObjectURL=blob=>{if(blob?.type==='application/zip')seedanceZip=blob;return 'blob:identity-export';};
  lastRecorder=null;const seedanceState=T.captureAutomaticCaptureState(),seedanceRun=el('seedancePack').onclick(),seedanceTarget=T.captureTransaction?.target;
  T.forceCaptureNavigation(0,Math.min(2,T.shots.length-1));const seedanceResult=await finishAutomaticRun(seedanceRun);sandbox.URL.createObjectURL=seedanceCreateObjectURL;
  sandbox.MediaRecorder=TestMediaRecorder;sandbox.THREE.WebGLRenderer.prototype.render=seedancePrototypeRender;T.recRenderer.render=seedanceRecorderRender;
  const parseStoredZip=bytes=>{const entries=new Map(),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();let offset=0;
    while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){const compression=view.getUint16(offset+8,true),size=view.getUint32(offset+18,true),nameLength=view.getUint16(offset+26,true),extraLength=view.getUint16(offset+28,true),nameStart=offset+30,dataStart=nameStart+nameLength+extraLength;
      entries.set(decoder.decode(bytes.slice(nameStart,nameStart+nameLength)),{compression,data:bytes.slice(dataStart,dataStart+size)});offset=dataStart+size;}
    return entries;};
  const seedanceZipEntries=seedanceZip?parseStoredZip(new Uint8Array(await seedanceZip.arrayBuffer())):new Map(),seedanceDecoder=new TextDecoder(),
    seedanceVideoEntry=Array.from(seedanceZipEntries.entries()).find(([name])=>name.startsWith('01_previz_refvideo.')),
    seedanceVideoMedia=seedanceVideoEntry?T.inspectSeedanceMp4(seedanceVideoEntry[1].data):null,seedanceVideoContract=T.automaticExportMediaContract(seedanceTarget),seedancePromptEntry=seedanceZipEntries.get('04_prompt.txt'),seedanceJsonEntry=seedanceZipEntries.get('05_shotdata.json');
  const seedanceVideoFirst=seedanceVideoSamples.find(sample=>Math.abs(sample.time)<1e-9),
    seedanceVideoLast=seedanceVideoSamples.findLast(sample=>Math.abs(sample.time-seedanceTarget.shots[0].duration)<1e-9),
    seedanceFirst=seedanceFrameSamples[0],seedanceLast=seedanceFrameSamples[1];
  assert(seedanceResult===true&&seedanceTarget?.kind==='seedance'&&seedanceTarget.prompt&&seedanceTarget.sceneJson&&
    seedanceZipEntries.size===5&&Array.from(seedanceZipEntries.values()).every(entry=>entry.compression===0&&entry.data.length>0)&&
    seedancePromptEntry&&seedanceDecoder.decode(seedancePromptEntry.data)===seedanceTarget.prompt&&seedanceJsonEntry&&seedanceDecoder.decode(seedanceJsonEntry.data)===seedanceTarget.sceneJson&&
    seedanceVideoMedia?.fps===24&&seedanceVideoMedia?.frameCount===seedanceVideoContract.frameCount&&
    seedanceZipEntries.has('02_firstframe.png')&&seedanceZipEntries.has('03_lastframe.png')&&
    seedanceFirst&&seedanceLast&&seedanceVideoFirst&&seedanceVideoLast&&seedanceFirst.camera.distanceTo(seedanceVideoFirst.camera)<1e-6&&
    seedanceLast.camera.distanceTo(seedanceVideoLast.camera)<1e-6&&(!seedancePreviewActor||seedanceFirst.actor.distanceTo(seedanceVideoFirst.actor)<1e-6&&seedanceLast.actor.distanceTo(seedanceVideoLast.actor)<1e-6),
    `Seedance 忽略起始 point-preview 采样，首尾 PNG 与视频 t=0/t=dur 一致，prompt/JSON 只用冻结目标 (result=${seedanceResult}, frames=${seedanceFrameSamples.length}, video=${seedanceVideoSamples.length}, first=${!!seedanceVideoFirst}, last=${!!seedanceVideoLast}, cam0=${seedanceFirst&&seedanceVideoFirst?seedanceFirst.camera.distanceTo(seedanceVideoFirst.camera):'n/a'}, cam1=${seedanceLast&&seedanceVideoLast?seedanceLast.camera.distanceTo(seedanceVideoLast.camera):'n/a'}, actor0=${seedancePreviewActor&&seedanceFirst&&seedanceVideoFirst?seedanceFirst.actor.distanceTo(seedanceVideoFirst.actor):'n/a'}, actor1=${seedancePreviewActor&&seedanceLast&&seedanceVideoLast?seedanceLast.actor.distanceTo(seedanceVideoLast.actor):'n/a'}, frame1=${seedanceLast?.actor?.toArray()}, video1=${seedanceVideoLast?.actor?.toArray()}, t1=${seedanceLast?.time}/${seedanceVideoLast?.time})`);
  assert(T.sceneIdx===seedanceState.sceneIdx&&T.shotIdx===seedanceState.shotIdx&&T.time===seedanceState.time&&
    T.playing===seedanceState.playing&&T.captureState.playAllMode===seedanceState.playAllMode&&T.previewCamPt===seedancePreviewState.camera&&
    T.previewActorPoint?.actor===seedancePreviewState.actor?.actor&&T.previewActorPoint?.idx===seedancePreviewState.actor?.idx&&T.previewActorCount===seedancePreviewState.count&&!T.captureTransaction,
    'Seedance success 后 exactly-once 恢复完整自动导出状态、原 point-preview 与事务所有权');

  const staleState=T.captureAutomaticCaptureState(),staleTxn=T.beginCaptureTransaction('stale-generation');
  T.releaseCaptureTransaction(staleTxn);const currentTxn=T.beginCaptureTransaction('current-generation');T.setTime(1.25);let staleAfter=0;
  const staleFinalizeResult=T.finalizeCaptureTransaction(staleTxn,{restoreState:{...staleState,time:99},after:()=>{staleAfter++;}});
  assert(staleFinalizeResult===null&&T.captureTransaction===currentTxn&&T.time===1.25&&staleAfter===0&&staleTxn.finalized,
    '迟到旧 transaction generation 的 restore/after 均为惰性，不会覆盖后续事务且 finalize 只结算一次');
  T.releaseCaptureTransaction(currentTxn);

  const manualStartShot=T.shotIdx,manualHtml2canvas=sandbox.html2canvas;sandbox.html2canvas=async()=>makeEl('canvas');sandbox.MediaRecorder=TestMediaRecorder;
  const manualWorkspaceStartRun=T.startWholePageRecording();frames(1);const manualWorkspaceStarted=await manualWorkspaceStartRun,
    manualShortcut=fireWindow('keydown',{key:'ArrowRight',code:'ArrowRight',target:documentBody}),manualWorkspaceStop=T.stopWholePageRecording();
  await new Promise(resolve=>setImmediate(resolve));flushTimeouts();sandbox.html2canvas=manualHtml2canvas;
  assert(manualWorkspaceStarted===true&&manualWorkspaceStop===true&&T.REC_FPS===30&&lastCaptureStreamFps===30&&!manualShortcut.defaultPrevented&&T.shotIdx===Math.min(T.shots.length-1,manualStartShot+1)&&
    !T.captureTransaction&&!T.screenRecording,
    '真实 startWholePageRecording 仍用 30fps captureStream，顶部手动录制常量保持 30fps，且运行期间可交互并正常停止收尾');
  flushTimeouts();T.openProjectData(automaticFixtureProject);T.loadScene(automaticFixtureState.sceneIdx,true);T.setShot(automaticFixtureState.shotIdx,true);
  T.setTime(automaticFixtureState.time);T.restorePreviewAnimationState(automaticFixtureState.previewAnimation);
  T.select(T.actors.find(actor=>actor.label===automaticFixtureState.selectedLabel)||null);T.updateActors();T.updateShotCam();
  flushTimeouts();T.initHistory();
  if(automaticFixtureState.autosave===null)delete sandbox.localStorage._d.previz_autosave_v3;
  else sandbox.localStorage._d.previz_autosave_v3=automaticFixtureState.autosave;
  sandbox.localStorage._writes=automaticFixtureState.writes;sandbox.localStorage._setLog.length=automaticFixtureState.setLogLength;
  constructedRecorders=0;lastRecorder=null;
}
const supportedRecordingType=TestMediaRecorder.isTypeSupported,preflightAlertsBefore=sandbox.__alerts.length;
TestMediaRecorder.isTypeSupported=()=>{throw new Error('recording spec failed');};
const cameraPreflightResult=await el('topRecord').onclick(),workspacePreflightResult=await T.startWholePageRecording();
TestMediaRecorder.isTypeSupported=supportedRecordingType;
assert(cameraPreflightResult===false&&workspacePreflightResult===false&&!T.captureTransaction&&sandbox.__alerts.length===preflightAlertsBefore+2,
  '摄影机/工作区的容器和文件名前置抛错时尚未 acquire，各只反馈一次且锁为空');
const componentAlertsBefore=sandbox.__alerts.length,componentHtml2canvas=sandbox.html2canvas;sandbox.html2canvas=undefined;
const componentMissingResult=await T.startWholePageRecording();sandbox.html2canvas=componentHtml2canvas;
assert(componentMissingResult===false&&!T.captureTransaction&&sandbox.__alerts.length===componentAlertsBefore+1,
  '工作区 component-missing 在 acquire 后仍经统一 finally 释放，可立即再次获锁');
const componentRestart=T.beginCaptureTransaction('component-restart');assert(T.releaseCaptureTransaction(componentRestart)&&!T.captureTransaction,
  '前置/组件失败后捕获事务可立即重启');
let resolveWorkspaceSnapshot=null;
sandbox.html2canvas=()=>new Promise(resolve=>{resolveWorkspaceSnapshot=resolve;});
const interruptedWorkspaceStart=T.startWholePageRecording();
frames(1);await new Promise(resolve=>setImmediate(resolve));
assert(T.screenRecording&&typeof resolveWorkspaceSnapshot==='function',
  `工作区录屏异步初始化已进入可取消状态 (screen=${T.screenRecording}, resolver=${typeof resolveWorkspaceSnapshot}, alerts=${sandbox.__alerts.slice(-1)})`);
T.stopWholePageRecording();resolveWorkspaceSnapshot?.(makeEl('canvas'));
await interruptedWorkspaceStart;
assert(!T.screenRecording&&constructedRecorders===0&&intervals.size===0,
  '工作区录屏初始化期间停止后不构造 MediaRecorder，也不遗留刷新计时器');

const normalizedStyle=makeStyle(),modernColor='color(srgb 0.1 0.2 0.3 / 0.5)';
const colorProbeContext={fillStyle:'#000',clearRect:noop,fillRect:noop,getImageData:()=>({data:new Uint8ClampedArray([26,51,77,128])})};
const clonedDocument={
  defaultView:{getComputedStyle:()=>({getPropertyValue:property=>property==='box-shadow'?`0 0 3px ${modernColor}`:property==='color'?modernColor:''})},
  createElement:()=>({width:0,height:0,getContext:()=>colorProbeContext}),
  querySelectorAll:()=>[{style:normalizedStyle}]
};
T.normalizeWorkspaceCaptureColors(clonedDocument);
assert(normalizedStyle.color==='rgba(26, 51, 77, 0.502)'&&normalizedStyle['box-shadow']==='0 0 3px rgba(26, 51, 77, 0.502)',
  '捕获 clone 的纯色与复合阴影中的 color() 均转换为 html2canvas 1.4.1 可解析的 rgba()');

class ThrowingMediaRecorder extends TestMediaRecorder{
  constructor(stream,options){super(stream,options);throw new Error('constructor failed');}
}
sandbox.MediaRecorder=ThrowingMediaRecorder;constructedRecorders=0;
let workspaceCloneHook=null;
sandbox.html2canvas=async(_root,options)=>{workspaceCloneHook=options.onclone;return makeEl('canvas');};
lastCaptureStreamTrack=null;
const failedWorkspaceStart=T.startWholePageRecording();frames(1);await failedWorkspaceStart;
assert(typeof workspaceCloneHook==='function'&&lastCaptureStreamTrack?.stopped&&!T.screenRecording&&!T.captureTransaction&&intervals.size===0&&
  el('monRec').style.display==='none'&&!el('topRecord').classList.contains('recording'),
  `真实工作区初始化链路在 MediaRecorder 构造失败时停止 stream，并清空录制态、REC、计时器与提示 (txn=${T.captureTransaction?.owner||'none'})`);
sandbox.MediaRecorder=TestMediaRecorder;sandbox.html2canvas=async()=>makeEl('canvas');lastRecorder=null;
const workspaceStopRun=T.startWholePageRecording();frames(1);await workspaceStopRun;
const workspaceStopFirst=T.stopWholePageRecording(),workspaceStopSecond=T.stopWholePageRecording();
await new Promise(resolve=>setImmediate(resolve));
assert(workspaceStopFirst&&!workspaceStopSecond&&!T.captureTransaction&&!T.screenRecording&&intervals.size===0,
  '工作区 recorder.stop 只接受第一次，等待唯一 onstop finalize 后重复 stop 不提前释放或重复保存');
let snapshotCalls=0;sandbox.html2canvas=async()=>{snapshotCalls++;if(snapshotCalls>1)throw new Error('snapshot failed');return makeEl('canvas');};
const workspaceRejectRun=T.startWholePageRecording();frames(1);await workspaceRejectRun;
const snapshotTimer=T.workspaceRuntime.workspaceSnapshotTimer;await intervals.get(snapshotTimer)?.fn?.();await new Promise(resolve=>setImmediate(resolve));
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0,
  '工作区周期 snapshot reject 进入一次性 recorder error 结算，无 unhandled rejection 或事务锁悬挂');
sandbox.html2canvas=async()=>makeEl('canvas');sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;lastCaptureStreamTrack=null;
const workspaceCleanupRun=T.startWholePageRecording();frames(1);await workspaceCleanupRun;
const cleanupAlertsBefore=sandbox.__alerts.length,workspaceCreateObjectURL=sandbox.URL.createObjectURL;let workspaceCleanupSaves=0,workspaceCleanupBytes=0;
sandbox.URL.createObjectURL=blob=>{workspaceCleanupSaves++;workspaceCleanupBytes=blob.size;return 'blob:workspace-cleanup';};
lastCaptureStreamTrack.stop=()=>{throw new Error('track cleanup failed');};T.stopWholePageRecording();await new Promise(resolve=>setImmediate(resolve));
sandbox.URL.createObjectURL=workspaceCreateObjectURL;
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===cleanupAlertsBefore&&workspaceCleanupSaves===1&&workspaceCleanupBytes>0,
  '工作区已完整的非空媒体不因 track cleanup warning 丢弃，仍只保存一次并释放全局引用');
const originalWorkspaceCaptureStream=T.workspaceCanvas.captureStream;let throwWorkspaceGetTracks=false;
T.workspaceCanvas.captureStream=()=>{const track={stop:noop};return {getTracks(){if(throwWorkspaceGetTracks)throw new Error('getTracks cleanup failed');return [track];}};};
lastRecorder=null;const workspaceGetTracksRun=T.startWholePageRecording();frames(1);await workspaceGetTracksRun;throwWorkspaceGetTracks=true;
const getTracksAlertsBefore=sandbox.__alerts.length;lastRecorder.onerror?.({error:new Error('recorder failed')});await new Promise(resolve=>setImmediate(resolve));
T.workspaceCanvas.captureStream=originalWorkspaceCaptureStream;throwWorkspaceGetTracks=false;
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===getTracksAlertsBefore+1,
  '工作区 recorder error 结算时 getTracks 本身抛错也不能跳过 release 或重复反馈');
class WorkspaceBlobThrowRecorder extends TestMediaRecorder{
  stop(){this.state='inactive';this.ondataavailable?.({data:new originalBlob(['frame'],{type:this.mimeType})});const savedBlob=sandbox.Blob;
    sandbox.Blob=class{constructor(){throw new Error('blob construction failed');}};try{this.onstop?.();}finally{sandbox.Blob=savedBlob;}}
}
sandbox.MediaRecorder=WorkspaceBlobThrowRecorder;lastRecorder=null;const workspaceBlobRun=T.startWholePageRecording();frames(1);await workspaceBlobRun;
const blobAlertsBefore=sandbox.__alerts.length;T.stopWholePageRecording();await new Promise(resolve=>setImmediate(resolve));
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===blobAlertsBefore+1,
  '工作区 onstop 的 Blob 构造抛错仍清理并释放外层事务，且只反馈一次');
sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;const workspaceSaveRun=T.startWholePageRecording();frames(1);await workspaceSaveRun;
const originalCreateElement=documentStub.createElement,saveAlertsBefore=sandbox.__alerts.length;
documentStub.createElement=tag=>{if(tag==='a')throw new Error('workspace save failed');return originalCreateElement(tag);};T.stopWholePageRecording();
await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));documentStub.createElement=originalCreateElement;
assert(!T.captureTransaction&&!T.screenRecording&&sandbox.__alerts.length===saveAlertsBefore+1,
  '工作区保存 reject 不在内外层重复反馈，保存 finally 后才释放事务');

class HistoricalWorkspaceRecorder extends TestMediaRecorder{
  set ondataavailable(value){this._ondataavailable=value;if(value)this.lateData=value;}get ondataavailable(){return this._ondataavailable;}
  set onerror(value){this._onerror=value;if(value)this.lateError=value;}get onerror(){return this._onerror;}
  set onstop(value){this._onstop=value;if(value)this.lateStop=value;}get onstop(){return this._onstop;}
}
class SynchronousWorkspaceErrorRecorder extends HistoricalWorkspaceRecorder{
  start(){this.state='recording';this.onerror?.({error:new Error('synchronous start error')});}
}
sandbox.html2canvas=async()=>makeEl('canvas');sandbox.MediaRecorder=SynchronousWorkspaceErrorRecorder;lastRecorder=null;
const syncWorkspaceAlerts=sandbox.__alerts.length,syncWorkspaceRun=T.startWholePageRecording();frames(1);const syncWorkspaceResult=await syncWorkspaceRun,syncWorkspaceRecorder=lastRecorder;
const syncWorkspaceAlertsAfter=sandbox.__alerts.length;syncWorkspaceRecorder.lateError?.({error:new Error('late sync error')});await syncWorkspaceRecorder.lateStop?.();
assert(syncWorkspaceResult===false&&!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&syncWorkspaceAlertsAfter===syncWorkspaceAlerts+1&&sandbox.__alerts.length===syncWorkspaceAlertsAfter,
  'workspace start 同步 onerror 结算后不安装 timer/复活状态，已解绑的迟到 error/stop 不二次反馈');

class SynchronousWorkspaceErrorThenThrowRecorder extends HistoricalWorkspaceRecorder{
  start(){this.state='recording';this.onerror?.({error:new Error('synchronous handled error')});throw new Error('start threw after callback');}
}
sandbox.MediaRecorder=SynchronousWorkspaceErrorThenThrowRecorder;lastRecorder=null;
const syncThrowAlerts=sandbox.__alerts.length,syncThrowRun=T.startWholePageRecording();frames(1);await syncThrowRun;
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===syncThrowAlerts+1,
  'workspace start 同步 handler 已结算后再 throw 也不由 outer catch 二次反馈');

class ThrowingStartWorkspaceRecorder extends HistoricalWorkspaceRecorder{start(){throw new Error('workspace start failed');}}
sandbox.MediaRecorder=ThrowingStartWorkspaceRecorder;lastRecorder=null;
const throwingStartAlerts=sandbox.__alerts.length,throwingStartRun=T.startWholePageRecording();frames(1);await throwingStartRun;const throwingStartRecorder=lastRecorder;
const throwingStartAlertsAfter=sandbox.__alerts.length;throwingStartRecorder.lateError?.({error:new Error('late start error')});await throwingStartRecorder.lateStop?.();
assert(!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&throwingStartAlertsAfter===throwingStartAlerts+1&&sandbox.__alerts.length===throwingStartAlertsAfter,
  'workspace start 抛错时先 sealed+解绑局部 handler，迟到事件不会再结算或提示');

sandbox.MediaRecorder=HistoricalWorkspaceRecorder;lastRecorder=null;const installedSetInterval=sandbox.setInterval;let workspaceIntervalInstalls=0;
sandbox.setInterval=(fn,ms)=>{workspaceIntervalInstalls++;if(workspaceIntervalInstalls===2)throw new Error('snapshot timer install failed');return installedSetInterval(fn,ms);};
const timerInstallAlerts=sandbox.__alerts.length,timerInstallRun=T.startWholePageRecording();frames(1);await timerInstallRun;const timerInstallRecorder=lastRecorder;
sandbox.setInterval=installedSetInterval;const timerInstallAlertsAfter=sandbox.__alerts.length;
timerInstallRecorder.lateError?.({error:new Error('late timer error')});await timerInstallRecorder.lateStop?.();
assert(workspaceIntervalInstalls===2&&!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&timerInstallAlertsAfter===timerInstallAlerts+1&&sandbox.__alerts.length===timerInstallAlertsAfter,
  '工作区第二个 timer 安装抛错会清掉已安装 timer 并 sealed handler，迟到事件无二次反馈');

sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;let workspaceCanvasQueries=0;const drawQueryAll=documentStub.querySelectorAll;
documentStub.querySelectorAll=selector=>{if(selector==='canvas'&&++workspaceCanvasQueries>1)throw new Error('periodic workspace draw failed');return drawQueryAll(selector);};
const drawFailureRun=T.startWholePageRecording();frames(1);await drawFailureRun;const drawFailureTimer=T.workspaceRuntime.workspaceFrameTimer,drawFailureAlerts=sandbox.__alerts.length;
intervals.get(drawFailureTimer)?.fn();documentStub.querySelectorAll=drawQueryAll;
assert(workspaceCanvasQueries===2&&!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===drawFailureAlerts+1,
  '工作区首帧成功后周期 draw 抛错进入同一 failWorkspaceRecorder，清空三类 timer/流/锁');

sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;const clearFailureRun=T.startWholePageRecording();frames(1);await clearFailureRun;
const installedClearInterval=sandbox.clearInterval,clearFailureAlerts=sandbox.__alerts.length;let clearIntervalFailures=0;
sandbox.clearInterval=id=>{if(clearIntervalFailures++===0)throw new Error('clear frame timer failed');return installedClearInterval(id);};
const clearFailureStopped=T.stopWholePageRecording();sandbox.clearInterval=installedClearInterval;await new Promise(resolve=>setImmediate(resolve));
assert(clearFailureStopped&&!T.captureTransaction&&!T.screenRecording&&intervals.size===0&&sandbox.__alerts.length===clearFailureAlerts,
  'workspace stop 的 timer clear warning 不跳过 recorder.stop，有效媒体仍保存并在 cleanup 重试后释放');

sandbox.MediaRecorder=ThrowingMediaRecorder;constructedRecorders=0;
let explicitContainerRejected=false;
try{await T.recordBlob(1,noop,{manual:true,recordSpec:{mimeType:'video/mp4',ext:'mp4'}});}
catch(_error){explicitContainerRejected=true;}
assert(explicitContainerRejected&&constructedRecorders===1&&!T.recording,
  '预选 MP4 构造失败时只尝试一次且不回退为后缀错误的 WebM');

sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;lastCaptureStreamTrack=null;
const speedNode=el('speed'),speedValueBefore=speedNode.value;
Object.defineProperty(speedNode,'value',{configurable:true,get(){throw new Error('speed getter failed');},set:noop});
let speedGetterRejected=false;try{await T.recordBlob(1,noop,{manual:true});}catch(error){speedGetterRejected=error.message==='speed getter failed';}
Object.defineProperty(speedNode,'value',{configurable:true,writable:true,value:speedValueBefore});
assert(speedGetterRejected&&lastCaptureStreamTrack?.stopped&&!T.captureTransaction&&!T.recording&&!T.captureState.recTrack&&intervals.size===0,
  'recordBlob 构造后 savedSpeed getter 抛错也走一次性 cleanup，停流、清全局引用并释放 standalone 锁');

lastRecorder=null;lastCaptureStreamTrack=null;const restoreGetterOptions={};
Object.defineProperty(restoreGetterOptions,'restoreState',{get(){throw new Error('restore state getter failed');}});
let restoreGetterRejected=false;try{await T.recordBlob(1,noop,restoreGetterOptions);}catch(error){restoreGetterRejected=error.message==='restore state getter failed';}
assert(restoreGetterRejected&&lastCaptureStreamTrack?.stopped&&!T.captureTransaction&&!T.captureState.recTrack&&!T.captureState.recStep&&intervals.size===0,
  'recordBlob restoreState 求值抛错不依赖外层调用者，standalone 也完整自清理');

class HandlerSetterThrowRecorder extends TestMediaRecorder{
  set ondataavailable(value){if(value)throw new Error('handler setter failed');this._ondataavailable=value;}get ondataavailable(){return this._ondataavailable;}
}
sandbox.MediaRecorder=HandlerSetterThrowRecorder;lastCaptureStreamTrack=null;
let handlerSetterRejected=false;try{await T.recordBlob(1,noop,{manual:true});}catch(error){handlerSetterRejected=error.message==='handler setter failed';}
assert(handlerSetterRejected&&lastCaptureStreamTrack?.stopped&&!T.captureTransaction&&!T.recording&&!T.captureState.recTrack&&!T.captureState.recStep&&intervals.size===0,
  'recordBlob event handler setter 抛错被 post-construction 统一 catch 清理，不留 recorder/stream/timer/锁');

class SynchronousRecordBlobStopRecorder extends TestMediaRecorder{
  start(){this.state='inactive';this.ondataavailable?.({data:new originalBlob(['sync frame'],{type:this.mimeType})});this.onstop?.();}
}
sandbox.MediaRecorder=SynchronousRecordBlobStopRecorder;lastRecorder=null;
let synchronousStopCode='';try{await T.recordBlob(1,noop);}catch(error){synchronousStopCode=error.code;}
assert(synchronousStopCode==='CAPTURE_INCOMPLETE'&&!T.captureTransaction&&!T.recording&&!T.playing&&!T.captureState.recTick&&!T.captureState.recStep&&intervals.size===0,
  'recordBlob start 同步 onstop 结算后不安装 timer、不复活 recording/playing 且不接受未完整自动媒体');

class SynchronousErrorSetterRecorder extends TestMediaRecorder{
  set onerror(value){this._onerror=value;if(value)value({error:new Error('synchronous onerror setter')});}get onerror(){return this._onerror;}
}
sandbox.MediaRecorder=SynchronousErrorSetterRecorder;lastCaptureStreamTrack=null;let synchronousSetterRejected=false;
try{await T.recordBlob(1,noop,{manual:true});}catch(error){synchronousSetterRejected=error.message==='synchronous onerror setter';}
assert(synchronousSetterRejected&&lastCaptureStreamTrack?.stopped&&!T.captureTransaction&&!T.recording&&!T.captureState.recTick&&!T.captureState.recStep&&intervals.size===0,
  'post-construction setter 若同步触发 onerror，settled/ownership guard 立即返回而不继续 start 或复活状态');

sandbox.MediaRecorder=TestMediaRecorder;constructedRecorders=0;lastRecorder=null;el('speed').value='1.25x';
const runtimeFailure=T.recordBlob(1,noop,{manual:true,recordSpec:{mimeType:'video/mp4',ext:'mp4'}});
lastRecorder.onerror({error:new Error('runtime failed')});
let runtimeRejected=false;try{await runtimeFailure;}catch(_error){runtimeRejected=true;}
assert(runtimeRejected&&!T.recording&&!T.playing&&el('speed').value==='1.25x'&&el('monRec').style.display==='none'&&intervals.size===0,
  'MediaRecorder 运行错误拒绝任务并完整恢复录制 UI、播放状态、速度与计时器');

class EmptyMediaRecorder extends TestMediaRecorder{stop(){this.state='inactive';this.onstop?.();}}
sandbox.MediaRecorder=EmptyMediaRecorder;lastRecorder=null;
const emptyRun=T.recordBlob(1,noop,{manual:true});T.stopActiveCapture();lastRecorder.stop();let emptyRejected=false,emptyErrorCode='';
try{await emptyRun;}catch(error){emptyErrorCode=error.code||error.message;emptyRejected=error.code==='CAPTURE_EMPTY';}
assert(emptyRejected&&!T.captureTransaction&&!T.recording,`手动停止产生 0-byte Blob 时按本地化失败结算且不返回下载内容 (${emptyErrorCode})`);
sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;
const unexpectedRun=T.recordBlob(1,noop);lastRecorder.ondataavailable?.({data:new Blob(['partial'])});lastRecorder.onstop();let incompleteRejected=false;
try{await unexpectedRun;}catch(error){incompleteRejected=error.code==='CAPTURE_INCOMPLETE';}
assert(incompleteRejected&&!T.captureTransaction,'浏览器意外 onstop 即使有部分数据也不冒充自动导出成功');

class MissingOnstopRecorder extends TestMediaRecorder{
  set onstop(value){this._onstop=value;if(value)this.lateStop=value;}get onstop(){return this._onstop;}
  stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['missing-onstop-frame'],{type:this.mimeType})});}
}
sandbox.MediaRecorder=MissingOnstopRecorder;lastRecorder=null;let cancelAfterFinishSettles=0;
const cancelAfterFinishRun=T.recordBlob(.01,noop).then(()=>{cancelAfterFinishSettles++;return 'resolved';},error=>{cancelAfterFinishSettles++;return error.code;});
T.captureState.recStep?.();const cancelAfterFinishRecorder=lastRecorder,cancelAfterFinishStopped=T.stopActiveCapture(),cancelAfterFinishCode=await cancelAfterFinishRun;
cancelAfterFinishRecorder.lateStop?.();await Promise.resolve();
assert(cancelAfterFinishStopped&&cancelAfterFinishCode==='CAPTURE_CANCELLED'&&cancelAfterFinishSettles===1&&!T.captureTransaction&&!T.recording&&!T.captureState.recTick&&intervals.size===0,
  '自然完成已请求 stop 但尚无 onstop 时，自动取消仍可抢占并 exactly-once 拒绝，迟到 onstop 不二次完成');

lastRecorder=null;let missingOnstopSettles=0;
const missingOnstopRun=T.recordBlob(1,noop,{manual:true}).then(()=>{missingOnstopSettles++;return 'resolved';},error=>{missingOnstopSettles++;return error.code;});
const missingOnstopRecorder=lastRecorder,missingOnstopRequested=T.stopActiveCapture(),missingStopRequest=timeouts.findLast(item=>!item.canceled&&item.ms===120);
missingStopRequest.canceled=true;missingStopRequest.fn();const missingStopFallback=timeouts.findLast(item=>!item.canceled&&item.ms===1500);
missingStopFallback.canceled=true;missingStopFallback.fn();const missingOnstopCode=await missingOnstopRun;missingOnstopRecorder.lateStop?.();await Promise.resolve();
assert(missingOnstopRequested&&missingOnstopCode==='CAPTURE_STOP_TIMEOUT'&&missingOnstopSettles===1&&!T.captureTransaction&&!T.recording&&
  !T.captureState.recTick&&!T.captureState.recTrack&&!T.captureState.recStop&&intervals.size===0&&!el('topRecord').classList.contains('recording'),
  'MediaRecorder.stop 永不触发 onstop 时 1500ms 兜底单次失败并释放 Promise/事务/UI，迟到 onstop 保持惰性');
sandbox.MediaRecorder=TestMediaRecorder;

const originalRecCaptureStream=T.recCanvas.captureStream;
let firstVideoFailureTrack={stopped:false,stop(){this.stopped=true;}};
T.recCanvas.captureStream=()=>({getVideoTracks(){throw new Error('first getVideoTracks failed');},getTracks:()=>[firstVideoFailureTrack]});
const firstVideoAlertsBefore=sandbox.__alerts.length,firstVideoFailureResult=await T.exportCurrentShotVideo();
assert(firstVideoFailureResult===false&&firstVideoFailureTrack.stopped&&!T.captureTransaction&&!T.captureState.recTrack&&sandbox.__alerts.length===firstVideoAlertsBefore+1,
  '首条 stream getVideoTracks 同步抛错会停流、清 recTrack，retainTransaction 由外层 finally 释放并只反馈一次');
let legacyStopCaptureCalls=0;const legacyStopFailureTrack={stop(){throw new Error('legacy first stop failed');}};
T.recCanvas.captureStream=()=>{legacyStopCaptureCalls++;return {getVideoTracks:()=>[legacyStopFailureTrack],getTracks:()=>[legacyStopFailureTrack]};};
let legacyStopRejected=false;try{await T.recordBlob(1,noop,{manual:true});}catch(error){legacyStopRejected=error.message==='legacy first stop failed';}
assert(legacyStopRejected&&legacyStopCaptureCalls===1&&!T.captureTransaction&&!T.captureState.recTrack,
  'legacy 首 stream 无法 stop 时立即拒绝而不静默继续第二条 stream，非 retain 事务仍释放');
let secondVideoCaptureCalls=0;const firstLegacyTrack={stopped:false,stop(){this.stopped=true;}},secondVideoFailureTrack={stopped:false,stop(){this.stopped=true;}};
T.recCanvas.captureStream=()=>{secondVideoCaptureCalls++;return secondVideoCaptureCalls===1?
  {getVideoTracks:()=>[firstLegacyTrack],getTracks:()=>[firstLegacyTrack]}:
  {getVideoTracks(){throw new Error('second getVideoTracks failed');},getTracks:()=>[secondVideoFailureTrack]};};
let secondVideoRejected=false;try{await T.recordBlob(1,noop,{manual:true});}catch(error){secondVideoRejected=error.message==='second getVideoTracks failed';}
assert(secondVideoRejected&&firstLegacyTrack.stopped&&secondVideoFailureTrack.stopped&&!T.captureTransaction&&!T.captureState.recTrack,
  'legacy 第二 stream getVideoTracks 抛错会停掉已创建的全部 stream 并清理事务');
const onendedBindingTrack={stopped:false,requestFrame:noop,stop(){this.stopped=true;}};
T.recCanvas.captureStream=()=>({getVideoTracks:()=>[onendedBindingTrack],getTracks(){throw new Error('onended getTracks failed');}});
let onendedBindingRejected=false;try{await T.recordBlob(1,noop,{manual:true});}catch(error){onendedBindingRejected=error.message==='onended getTracks failed';}
assert(onendedBindingRejected&&onendedBindingTrack.stopped&&!T.captureTransaction&&!T.captureState.recTrack&&!T.recording,
  'onended 绑定阶段 getTracks 抛错走 failRecording，借 video track fallback 停流并释放锁');

const legacyTracks=[];let legacyCaptureCalls=0;
T.recCanvas.captureStream=()=>{legacyCaptureCalls++;const track={stopped:false,stop(){this.stopped=true;}};legacyTracks.push(track);return {getVideoTracks:()=>[track],getTracks:()=>[track]};};
lastRecorder=null;const legacyRun=T.recordBlob(1,noop,{manual:true});
assert(legacyCaptureCalls===2&&legacyTracks[0].stopped&&T.captureState.recTrack===null,
  'legacy captureStream fallback 先停首条 stream，无 requestFrame 的实际 track 仅用于 cleanup 而不进入手动推帧');
T.stopActiveCapture();flushTimeouts();const legacyBlob=await legacyRun;T.recCanvas.captureStream=originalRecCaptureStream;
assert(legacyBlob.size>0&&!T.captureTransaction&&!T.recording,'无 requestFrame 的 legacy 录制可以完成首帧与手动停止，不触发 TypeError');

lastRecorder=null;const manualCapRun=T.recordBlob(1,noop,{manual:true}),manualCap=timeouts.filter(item=>!item.canceled&&item.ms===6*60*60*1000).at(-1);
manualCap?.fn();flushTimeouts();const manualCapBlob=await manualCapRun;
assert(manualCapBlob.size>0&&!T.captureTransaction,'摄影机手动录制到 6h hard cap 按 finish 保存已有非空内容');
lastRecorder=null;const automaticCapRun=T.recordBlob(.2,noop),automaticCap=timeouts.filter(item=>!item.canceled&&item.ms===.2*5000+15000).at(-1);
automaticCap?.fn();let automaticCapCode='';try{await automaticCapRun;}catch(error){automaticCapCode=error.code;}
assert(automaticCapCode==='CAPTURE_TIMEOUT'&&!T.captureTransaction&&!T.recording,'自动导出 hard cap 仍按 incomplete failure 丢弃半成品');

sandbox.MediaRecorder=undefined;let unsupportedAlerts=sandbox.__alerts.length;
const unsupportedShotResult=await T.exportCurrentShotVideo();
assert(unsupportedShotResult===false&&!T.captureTransaction&&sandbox.__alerts.length===unsupportedAlerts+1,
  'MediaRecorder unsupported 的当前镜头导出只由最外层本地化反馈一次');
unsupportedAlerts=sandbox.__alerts.length;const unsupportedSceneResult=await el('exportAll').onclick();
assert(unsupportedSceneResult===false&&!T.captureTransaction&&sandbox.__alerts.length===unsupportedAlerts+1,
  'MediaRecorder unsupported 的整场景导出只反馈一次并释放外层事务');
sandbox.MediaRecorder=TestMediaRecorder;

const ownership=T.beginCaptureTransaction('pairwise-owner');
let busyRejected=false;
try{await T.recordBlob(1,noop);}catch(error){busyRejected=error.code==='CAPTURE_BUSY';}
assert(busyRejected&&T.captureTransaction===ownership&&el('exportShot').disabled&&el('exportAll').disabled&&el('seedancePack').disabled,
  '任一入口持有捕获事务时，程序性第二入口 fail-safe 拒绝且不覆盖所有者，相关按钮同步禁用');
assert(!T.releaseCaptureTransaction({id:ownership.id})&&T.captureTransaction===ownership&&T.releaseCaptureTransaction(ownership)&&!T.captureTransaction,
  '错配 token 与重复结算不能释放当前事务，合法所有者只释放一次');
const metadataTxn=T.beginCaptureTransaction('expected-owner',{manual:true});let metadataRejected=false;
try{await T.recordBlob(1,noop,{transaction:metadataTxn,owner:'wrong-owner',manual:false});}catch(error){metadataRejected=error.code==='CAPTURE_MISMATCH';}
assert(metadataRejected&&T.captureTransaction===metadataTxn&&T.releaseCaptureTransaction(metadataTxn),'supplied transaction 的 owner/manual 元数据错配会拒绝且不释放合法所有者');

const stableSelected=T.actors.find(actor=>actor.pathPts?.length>1)||T.actors[0];T.select(stableSelected);T.setSelActorPt(1);if(stableSelected.pathPts?.length>1)T.previewActorPathPoint(stableSelected,1);T.setTime(.42);T.setExportLook(true);
const stableState=T.captureAutomaticCaptureState(),stableSceneCount=T.project.scenes.length;T.project.scenes.push(JSON.parse(JSON.stringify(T.project.scenes[0])));T.loadScene(stableSceneCount,true);T.setTime(1.5);T.setExportLook(false);T.restoreAutomaticCaptureState(stableState);T.project.scenes.pop();
assert(T.sceneIdx===stableState.sceneIdx&&T.selected&&T.selected!==stableSelected&&T.selected.label===stableSelected.label&&T.captureState.time===.42&&T.exportLookActive&&
  T.captureState.selActorPt===1&&T.captureState.previewActorPoint?.idx===1&&T.captureState.previewActorPoint?.actor===T.selected&&
  el('monTitle').textContent.includes('S1')&&el('pathLen').textContent.includes('摄影机路径'),
  '自动事务真实跨 scene 后以稳定 label 重绑 selection，且 select() 不会把非零对象点/预览重置为 0');
T.setExportLook(false);

const malformedRestoreState={...T.captureAutomaticCaptureState(),previewActorPoints:null},malformedPrelude=T.beginCaptureTransaction('seedance-export');
T.armAutomaticCapturePrelude(malformedPrelude,malformedRestoreState);const malformedAlertsBefore=sandbox.__alerts.length;
assert(!T.stopActiveCapture()&&!T.captureTransaction&&sandbox.__alerts.length===malformedAlertsBefore+1,
  'armAutomaticCapturePrelude.stop 即使 restore 抛错也在 finally 释放事务，错误只反馈一次');
const malformedFinalize=T.beginCaptureTransaction('seedance-export');el('seedancePack').disabled=true;let seedanceButtonFinalized=false;
const malformedFinalizeError=T.finalizeCaptureTransaction(malformedFinalize,{restoreState:malformedRestoreState,after:()=>{seedanceButtonFinalized=true;el('seedancePack').disabled=false;}});
assert(malformedFinalizeError&&!T.captureTransaction&&seedanceButtonFinalized&&!el('seedancePack').disabled,
  '外层 restore 抛错不能跳过 release 或 Seedance 按钮 finally，异常后可立即重启');

T.setTime(.6);const preludeState=T.captureAutomaticCaptureState(),prelude=T.beginCaptureTransaction('seedance-export');
T.armAutomaticCapturePrelude(prelude,preludeState);T.setTime(1.8);T.setExportLook(true);
assert(T.stopActiveCapture()&&!T.captureTransaction&&T.captureState.time===.6&&!T.exportLookActive,
  'Seedance 首尾帧预渲染阶段已挂真实停止回调，取消会恢复时间、选择/Inspector 与进入前导出外观');

const retainedState=T.captureAutomaticCaptureState(),retainedTxn=T.beginCaptureTransaction('seedance-export');
const retainedVideo=T.recordBlob(1,noop,{transaction:retainedTxn,owner:'seedance-export',restoreState:retainedState,retainTransaction:true});
for(let i=0;i<31;i++)T.captureState.recStep?.();flushTimeouts();await retainedVideo;T.armAutomaticCapturePrelude(retainedTxn,retainedState);
let packagingBusy=false;try{await T.recordBlob(1,noop);}catch(error){packagingBusy=error.code==='CAPTURE_BUSY';}
assert(packagingBusy&&T.captureTransaction===retainedTxn&&el('seedancePack').disabled,
  'Seedance 视频完成到 ZIP 下载 finally 之间仍由调用方持有事务，二次录制/导出保持 busy');
assert(T.stopActiveCapture()&&!T.stopActiveCapture()&&!T.captureTransaction,
  'Seedance 打包阶段取消与重复停止只结算一次并释放外层事务');

constructedRecorders=0;lastRecorder=null;T.setTime(.75);
const captureProjectBefore=JSON.stringify(T.project),captureUndoBefore=T.undoDepth,captureAutosaveBefore=sandbox.localStorage.getItem('previz_autosave_v3');
const sceneIdentityBefore=T.project.scenes[T.sceneIdx];T.sceneJSON({sync:false});
assert(T.project.scenes[T.sceneIdx]===sceneIdentityBefore&&T.undoDepth===captureUndoBefore&&sandbox.localStorage.getItem('previz_autosave_v3')===captureAutosaveBefore,
  'Seedance sceneJSON no-sync 序列化保持 scene 对象身份、history 与 autosave 写入次数不变');
const autoCancelled=T.recordBlob(2,()=>{T.setTime(0);});
assert(T.captureTransaction?.manual===false&&T.stopActiveCapture(),'自动视频导出显示停止时会真正触发取消');
let cancelCode='';try{await autoCancelled;}catch(error){cancelCode=error.code;}
assert(cancelCode==='CAPTURE_CANCELLED'&&!T.captureTransaction&&!T.recording&&intervals.size===0&&T.captureState.time===.75&&
  JSON.stringify(T.project)===captureProjectBefore&&T.undoDepth===captureUndoBefore&&sandbox.localStorage.getItem('previz_autosave_v3')===captureAutosaveBefore,
  '自动导出取消不产出 Blob，exactly-once 清理并恢复原时间，且 project/autosave/history 零副作用');

lastRecorder=null;T.setTime(.9);T.setExportLook(true);
const originalRecRender=T.recRenderer.render;T.recRenderer.render=()=>{throw new Error('render failed');};
let renderRejected=false;try{await T.recordBlob(1,()=>{T.setTime(0);});}catch(error){renderRejected=error.message==='render failed';}
T.recRenderer.render=originalRecRender;
assert(renderRejected&&!T.captureTransaction&&!T.recording&&T.captureState.time===.9&&T.exportLookActive&&intervals.size===0,
  '同步渲染异常走同一失败结算，恢复进入前时间/导出外观并允许后续重启');
T.setExportLook(false);

lastRecorder=null;
const endedRun=T.recordBlob(1,noop,{manual:true});
const endedTrack=T.captureState.recTrack;endedTrack.onended?.();
let endedRejected=false;try{await endedRun;}catch(error){endedRejected=error.code==='CAPTURE_TRACK_ENDED';}
assert(endedRejected&&!T.captureTransaction&&!T.recording&&!T.captureState.recTick&&!T.captureState.recTrack&&!T.captureState.recStop&&intervals.size===0,
  '视频轨 ended 与 recorder error 共用单次失败结算，清除 track/tick/stop/事务锁');

lastRecorder=null;
const manualStopped=T.recordBlob(2,noop,{manual:true});
assert(T.stopActiveCapture()&&!T.stopActiveCapture(),'手动录制 stop 只接受一次并保持停止保存语义');
flushTimeouts();await manualStopped;
const restartRun=T.recordBlob(1,noop,{manual:true});
assert(!!T.captureTransaction&&T.stopActiveCapture(),'清理后可以立即重新开始并停止新的录制事务');
flushTimeouts();await restartRun;
assert(!T.captureTransaction&&!T.recording&&intervals.size===0,'重复停止与紧接重启后无假录制态或后台计时器');

lastRecorder=null;const disarmWarningRun=T.recordBlob(1,noop,{manual:true}),recordBlobClearInterval=sandbox.clearInterval;let disarmClearFailures=0;
sandbox.clearInterval=id=>{if(disarmClearFailures++===0)throw new Error('record timer clear failed');return recordBlobClearInterval(id);};
const disarmWarningStopped=T.stopActiveCapture();sandbox.clearInterval=recordBlobClearInterval;flushTimeouts();const disarmWarningBlob=await disarmWarningRun;
assert(disarmWarningStopped&&disarmWarningBlob.size>0&&!T.captureTransaction&&!T.recording&&!T.captureState.recTick&&intervals.size===0,
  'recordBlob manual stop 的 timer clear warning 不阻断 intentional finish，cleanup 重试后仍返回非空媒体并释放锁');

const cleanupWarningCaptureStream=T.recCanvas.captureStream,cleanupWarningCreateObjectURL=sandbox.URL.createObjectURL,
  cleanupWarningToggle=el('topRecord').classList.toggle;
let cleanupWarningSaves=0,cleanupWarningBytes=0;
T.recCanvas.captureStream=()=>{const track={requestFrame:noop,stop(){throw new Error('camera track cleanup warning');}};lastCaptureStreamTrack=track;return {getVideoTracks:()=>[track],getTracks:()=>[track]};};
sandbox.URL.createObjectURL=blob=>{cleanupWarningSaves++;cleanupWarningBytes=blob.size;return 'blob:camera-cleanup-warning';};
sandbox.MediaRecorder=TestMediaRecorder;lastRecorder=null;const cleanupWarningAlerts=sandbox.__alerts.length,cleanupWarningCameraRun=el('topRecord').onclick();
el('topRecord').classList.toggle=()=>{throw new Error('recording UI cleanup warning');};
const cleanupWarningStop=T.stopActiveCapture();flushTimeouts();const cleanupWarningCameraResult=await cleanupWarningCameraRun;flushTimeouts();
el('topRecord').classList.toggle=cleanupWarningToggle;T.recCanvas.captureStream=cleanupWarningCaptureStream;sandbox.URL.createObjectURL=cleanupWarningCreateObjectURL;T.updateRecordingUI();
assert(cleanupWarningStop&&cleanupWarningCameraResult===true&&cleanupWarningSaves===1&&cleanupWarningBytes>0&&sandbox.__alerts.length===cleanupWarningAlerts&&
  !T.captureTransaction&&!T.recording&&!T.captureState.recTrack&&!T.captureState.recTick,
  '摄影机手动 stop 已产生完整非空媒体时，track/UI cleanup warning 仅记录诊断，外层仍恰好保存一次且不谎报保存失败');

const saveStateNode=el('saveState'),saveStateTextDescriptor=Object.getOwnPropertyDescriptor(saveStateNode,'textContent'),saveStatusAlerts=sandbox.__alerts.length;
Object.defineProperty(saveStateNode,'textContent',{configurable:true,get(){return saveStateTextDescriptor.value;},set(){throw new Error('save status update failed');}});
let capturePersistenceCalls=0,exportPersistenceCalls=0,statusRevokeCalls=0;
const statusRevoke=sandbox.URL.revokeObjectURL;sandbox.URL.revokeObjectURL=()=>{statusRevokeCalls++;};
const capturePersistenceResult=await T.saveTopCaptureBytes({token:'capture-token'},new Uint8Array([1,2,3]),'recording',{
  bridge:{saveCaptureTarget:async()=>{capturePersistenceCalls++;return {canceled:false,path:'/saved/capture.mp4'};}}
});
const exportPersistenceResult=await T.dl('blob:status-success','saved.zip',{
  bridge:{saveExport:async()=>{exportPersistenceCalls++;return {canceled:false,path:'/saved/export.zip'};}},
  fetcher:async()=>({arrayBuffer:async()=>new Uint8Array([4,5]).buffer})
});
Object.defineProperty(saveStateNode,'textContent',saveStateTextDescriptor);sandbox.URL.revokeObjectURL=statusRevoke;
assert(!capturePersistenceResult.canceled&&!exportPersistenceResult.canceled&&capturePersistenceCalls===1&&exportPersistenceCalls===1&&statusRevokeCalls===1&&sandbox.__alerts.length===saveStatusAlerts,
  '持久化已成功后 saveState UI setter 抛错仅记录诊断，两类保存均恰好调用一次并仍返回成功');

const dlRevoke=sandbox.URL.revokeObjectURL,dlCreateElement=documentStub.createElement,dlAppendChild=documentBody.appendChild;
const revokedURLs=new Map();sandbox.URL.revokeObjectURL=url=>revokedURLs.set(url,(revokedURLs.get(url)||0)+1);
let fetchFailure=false,arrayBufferFailure=false,saveExportFailure=false,failedSaveCalls=0;
try{await T.dl('blob:fetch-failure','fetch.bin',{bridge:{saveExport:async()=>{failedSaveCalls++;}},fetcher:async()=>{throw new Error('fetch failed');}});}
catch(error){fetchFailure=error.code==='EXPORT_FAILED';}
try{await T.dl('blob:buffer-failure','buffer.bin',{bridge:{saveExport:async()=>{failedSaveCalls++;}},fetcher:async()=>({arrayBuffer:async()=>{throw new Error('buffer failed');}})});}
catch(error){arrayBufferFailure=error.code==='EXPORT_FAILED';}
try{await T.dl('blob:save-failure','save.bin',{bridge:{saveExport:async()=>{failedSaveCalls++;throw new Error('save failed');}},fetcher:async()=>({arrayBuffer:async()=>new Uint8Array([1]).buffer})});}
catch(error){saveExportFailure=error.code==='EXPORT_FAILED';}
assert(fetchFailure&&arrayBufferFailure&&saveExportFailure&&failedSaveCalls===1&&
  ['blob:fetch-failure','blob:buffer-failure','blob:save-failure'].every(url=>revokedURLs.get(url)===1),
  'desktop dl 的 fetch/arrayBuffer/saveExport 三类失败都 typed reject，且 Blob URL 各 exactly-once revoke');

let createElementFailure=false,appendFailure=false,clickFailure=false,appendFailureAnchor=null,clickFailureAnchor=null;
documentStub.createElement=()=>{throw new Error('create element failed');};
try{await T.dl('blob:create-element-failure','create.bin',{bridge:null});}catch(error){createElementFailure=error.code==='EXPORT_FAILED';}
documentStub.createElement=tag=>{const node=dlCreateElement(tag);if(tag==='a')appendFailureAnchor=node;return node;};
documentBody.appendChild=()=>{throw new Error('append failed');};
try{await T.dl('blob:append-failure','append.bin',{bridge:null});}catch(error){appendFailure=error.code==='EXPORT_FAILED';}
documentBody.appendChild=dlAppendChild;
documentStub.createElement=tag=>{const node=dlCreateElement(tag);if(tag==='a'){clickFailureAnchor=node;node.click=()=>{throw new Error('click failed');};}return node;};
try{await T.dl('blob:click-failure','click.bin',{bridge:null});}catch(error){clickFailure=error.code==='EXPORT_FAILED';}
assert(createElementFailure&&appendFailure&&clickFailure&&appendFailureAnchor?.parentElement===null&&clickFailureAnchor?.parentElement===null&&
  ['blob:create-element-failure','blob:append-failure','blob:click-failure'].every(url=>revokedURLs.get(url)===1),
  'browser dl 的 createElement/append/click 抛错都 typed reject，移除已创建 anchor 并 exactly-once revoke Blob URL');

let normalAnchor=null;documentStub.createElement=tag=>{const node=dlCreateElement(tag);if(tag==='a'){normalAnchor=node;node.click=noop;}return node;};
const normalDlResult=await T.dl('blob:normal-download','normal.bin',{bridge:null}),normalBeforeCleanup=revokedURLs.get('blob:normal-download')||0;
flushTimeouts();
assert(!normalDlResult.canceled&&normalBeforeCleanup===0&&revokedURLs.get('blob:normal-download')===1&&normalAnchor?.parentElement===null,
  'browser dl 正常成功保留延迟 cleanup 语义，延迟后 anchor 移除且 URL 只 revoke 一次');
let cleanupWarningRemoveCalls=0,cleanupWarningRevokeCalls=0;
documentStub.createElement=tag=>{
  const node=dlCreateElement(tag);
  if(tag==='a'){node.click=noop;node.remove=()=>{cleanupWarningRemoveCalls++;throw new Error('remove failed');};}
  return node;
};
sandbox.URL.revokeObjectURL=()=>{cleanupWarningRevokeCalls++;throw new Error('revoke failed');};
const cleanupWarningDlResult=await T.dl('blob:cleanup-warning','cleanup.bin',{bridge:null});
flushTimeouts();
assert(!cleanupWarningDlResult.canceled&&cleanupWarningRemoveCalls===1&&cleanupWarningRevokeCalls===1,
  'browser dl 已触发 click 后 remove/revoke cleanup warning 不反转成功或产生未捕获异常，且两项清理各尝试一次');
documentStub.createElement=dlCreateElement;documentBody.appendChild=dlAppendChild;sandbox.URL.revokeObjectURL=dlRevoke;

sandbox.MediaRecorder=originalMediaRecorder;sandbox.html2canvas=originalHtml2canvas;sandbox.getComputedStyle=originalGetComputedStyle;sandbox.Blob=originalBlob;
T.setCaptureSaveState('record.saved','/virtual/long-directory/PreVision_S1C1_workspace_record.mp4');
assert(el('saveState').textContent.endsWith('PreVision_S1C1_workspace_record.mp4')&&
  el('saveState').title===el('saveState').textContent&&
  /#saveState\{[^}]*text-align:right[^}]*overflow:visible[^}]*text-overflow:clip/.test(html)&&
  !/#saveState\{[^}]*text-overflow:ellipsis/.test(html)&&
  (html.match(/id=["']saveState["']/g)||[]).length===1&&
  /<div id="statusBar" role="status">[\s\S]*?<span class="grow status-feedback"><span id="saveState"><\/span><\/span>/.test(html)&&
  /#statusBar \.status-feedback\{[^}]*justify-content:flex-end[^}]*overflow:visible/.test(html)&&
  !/director-focus[^}]*#saveState[^}]*\{?[^}]*display:none/.test(html)&&
  !/@media \(max-width:1320px\)\{[\s\S]*?\.brand-copy small,#saveState/.test(html),
  '唯一保存状态源位于底部 role=status 弹性区，完整路径右锚定且不被 1316px 或导演专注规则隐藏');
const uiRecordingTxn=T.beginCaptureTransaction('ui-recording',{manual:true});uiRecordingTxn.stop=()=>true;T.setRecording(true);
assert(!el('topRecord').disabled&&el('topRecordMore').disabled&&el('topRecord').classList.contains('recording')&&el('topRecordLabel').textContent==='停止录屏',
  '录屏期间显示闪烁红点状态，主按钮保持可点击以便手动停止');
assert(el('exportShot').disabled&&el('exportAll').disabled&&el('seedancePack').disabled,'录屏期间其他视频导出入口同步锁定');
T.setRecording(false);T.releaseCaptureTransaction(uiRecordingTxn);
assert(!el('topRecord').disabled&&!el('topRecordMore').disabled&&!el('topRecord').classList.contains('recording')&&el('topRecordLabel').textContent==='录屏','录制结束后顶部按钮和红点恢复');

section('场景太阳: 方向光 + 全输出阴影一致性');
assert(T.renderer.shadowMap.enabled&&T.pipRenderer.shadowMap.enabled,'主导演台与右侧监视器均开启阴影');
assert(T.renderer.shadowMap.type===sandbox.THREE.PCFSoftShadowMap&&T.pipRenderer.shadowMap.type===sandbox.THREE.PCFSoftShadowMap,'两套实时渲染器统一使用柔和阴影');
const sun0=T.currentSun();
assert(sun0.enabled&&sun0.pos.length===3&&T.sunLight.castShadow,'旧场景自动补齐启用的三轴太阳与投影光源');
const sunOffset0=T.sunLight.position.clone().sub(T.sunTarget.position);
assert(sunOffset0.distanceTo(new sandbox.THREE.Vector3(...sun0.pos))<1e-6,'太阳三轴数据转换为相对场景中心的平行光方向');
const solidActor=T.actors.find(a=>a.kind!=='board');let solidMeshes=0,shadowMeshes=0;
solidActor.obj.traverse(o=>{if(o.isMesh){solidMeshes++;if(o.castShadow&&o.receiveShadow)shadowMeshes++;}});
assert(solidMeshes>0&&shadowMeshes===solidMeshes,'普通三维对象全部 Mesh 同时投射并接收阴影');
const sunData0=T.stageToData().sun;
assert(sunData0&&sunData0.temp===5600&&sunData0.quality==='standard','场景序列化保存太阳色温与阴影质量');
el('sunSunset').click();
assert(T.currentSun().temp===3000&&T.sunLight.intensity===.65&&el('sunStatus').textContent.includes('方位'),'黄昏预设同步改变方向、色温、强度与状态说明');
assert(T.genPrompt().includes('3000K')&&T.genPrompt().includes('自然阴影'),'太阳物理参数进入运镜提示词');
el('sunQuality').value='high';el('sunQuality').onchange({target:el('sunQuality')});
assert(T.sunLight.shadow.mapSize.x===4096&&T.sunLight.shadow.mapSize.y===4096,'高质量模式使用 4096 阴影贴图');
el('sunOn').checked=false;el('sunOn').onchange({target:el('sunOn')});
assert(!T.sunLight.visible&&!T.sunHandle&&T.ambientLight.intensity>0,'关闭太阳后隐藏直射光和手柄，但保留环境补光');
el('sunNoon').click();
assert(T.sunLight.visible&&T.sunHandle&&T.sunHandle.userData.type==='sun','重新启用太阳后画布三轴手柄恢复');
const rendererN0=T.configuredRendererCount,hadRecRenderer=!!T.recRenderer;T.renderShotFrame(64,36);T.setupRec(64,36);
assert(T.configuredRendererCount>=rendererN0+(hadRecRenderer?1:2)&&T.recRenderer.shadowMap.enabled,'截图与录像渲染器也经过统一阴影配置');

/* ---- 多步撤销: 起幅/落幅误操作可连续回退 ---- */
section('多步撤销 + ⌘Z');
assert(T.undoDepth === 0 && el('undoBtn').disabled, '初始无历史时撤销按钮禁用');
const undoP0 = T.curShot().camPts[0].clone();
T.viewCam.position.set(10, 15, 10);
el('setStart').click(); flushTimeouts();
assert(Math.abs(T.curShot().camPts[0].y - 15) < .001 && T.undoDepth === 1,
  '视角写入起幅后生成一条撤销历史');
const editableUndoParent=makeEl('div');editableUndoParent.setAttribute('contenteditable','true');
const editableUndoChild=editableUndoParent.appendChild(makeEl('span'));
const editableUndoTargets=[
  ['textarea',el('storyText')],['text input',el('projname')],['number input',el('semanticWidth')],
  ['range input',el('fov')],['select',el('aspect')],['select child',el('aspect').appendChild(makeEl('option'))],
  ['contenteditable',editableUndoParent],['contenteditable child',editableUndoChild]
];
const editableProjectBefore=JSON.stringify(T.project),editableSelectionBefore=T.selected,editableUndoDepthBefore=T.undoDepth;
const editableAutosaveBefore=sandbox.localStorage._d['previz_autosave_v3'],editableWritesBefore=sandbox.localStorage._writes;
const editableUndoEvents=[];
editableUndoTargets.forEach(([,target])=>{
  target.focus();
  editableUndoEvents.push(fireWindow('keydown',{metaKey:true,ctrlKey:false,shiftKey:false,key:'z',target}));
  editableUndoEvents.push(fireWindow('keydown',{metaKey:false,ctrlKey:true,shiftKey:false,key:'Z',target}));
  editableUndoEvents.push(fireWindow('keydown',{metaKey:true,ctrlKey:false,shiftKey:true,key:'z',target}));
});
assert(editableUndoEvents.every(event=>!event.defaultPrevented)&&JSON.stringify(T.project)===editableProjectBefore&&
  T.selected===editableSelectionBefore&&T.undoDepth===editableUndoDepthBefore&&
  sandbox.localStorage._d['previz_autosave_v3']===editableAutosaveBefore&&sandbox.localStorage._writes===editableWritesBefore,
  'textarea/input/select/contenteditable 及子节点内 Cmd/Ctrl+Z 与原生 redo 不被项目 history 抢走，项目/选择/history/autosave 零副作用');
const composingUndo=fireWindow('keydown',{metaKey:true,ctrlKey:false,shiftKey:false,key:'z',target:documentStub.body,isComposing:true});
assert(!composingUndo.defaultPrevented&&JSON.stringify(T.project)===editableProjectBefore&&T.undoDepth===editableUndoDepthBefore,
  '输入法 composing 期间不误触项目快捷键');
documentStub.activeElement=documentStub.body;
const macUndo=fireWindow('keydown',{metaKey:true,ctrlKey:false,shiftKey:false,key:'z',target:documentStub.body});
assert(macUndo.defaultPrevented&&T.curShot().camPts[0].distanceTo(undoP0) < .001, '非编辑画布 ⌘Z 恢复误写入的高机位起幅');
T.viewCam.position.set(10, 18, 10);el('setStart').click();flushTimeouts();
const ctrlUndo=fireWindow('keydown',{metaKey:false,ctrlKey:true,shiftKey:false,key:'Z',target:documentStub.body});
assert(ctrlUndo.defaultPrevented&&T.curShot().camPts[0].distanceTo(undoP0)<.001,
  '焦点离开控件后 Windows/Linux Ctrl+Z 仍执行项目 undo');
const undoY0 = T.curShot().camPts[0].y;
el('camPtY').oninput({ target:{ value:'4' } }); flushTimeouts();
el('camPtY').oninput({ target:{ value:'7' } }); flushTimeouts();
assert(T.undoDepth === 2 && Math.abs(T.curShot().camPts[0].y - 7) < .001, '两次独立修改累积两步历史');
T.undoLast();
assert(Math.abs(T.curShot().camPts[0].y - 4) < .001, '第一次撤销回到上一高度');
T.undoLast();
assert(Math.abs(T.curShot().camPts[0].y - undoY0) < .001 && T.undoDepth === 0 && el('undoBtn').disabled,
  '第二次撤销回到初始高度，历史耗尽后按钮禁用');

section('复杂无人机运镜: 逐点朝向/FOV 平滑插值');
assert(el('camPtY').getAttribute('min')==='0.2'&&el('camPtY').getAttribute('max')==='30'&&
  html.includes('data-i18n="runtime.camera.pointHeight"'),
  '机位点高度 UI 使用 language key，并明确提供 0.2–30m 编辑范围');
const authoredHeightShot=T.curShot(),authoredHeightView={
  position:T.viewCam.position.clone(),quaternion:T.viewCam.quaternion.clone()
};
const authoredHeightSnapshot={
  camPts:authoredHeightShot.camPts.map(point=>point.clone()),camKeys:JSON.parse(JSON.stringify(T.ensureCamKeys(authoredHeightShot))),
  camTimes:T.ensureCamTimes(authoredHeightShot).slice(),camAimTimes:T.ensureCamAimTimes(authoredHeightShot).slice(),camFovTimes:T.ensureCamFovTimes(authoredHeightShot).slice(),
  camEase:JSON.parse(JSON.stringify(authoredHeightShot.camEase||[])),camAimEase:JSON.parse(JSON.stringify(authoredHeightShot.camAimEase||[])),camFovEase:JSON.parse(JSON.stringify(authoredHeightShot.camFovEase||[])),
  camMode:authoredHeightShot.camMode,timingMode:authoredHeightShot.timingMode,lock:authoredHeightShot.lock,
  preview:JSON.parse(JSON.stringify(T.serializePreviewAnimationState()))
};
const HeightV=sandbox.THREE.Vector3;
const installAuthoredHeightRoute=heights=>{
  authoredHeightShot.camPts=heights.map((height,index)=>new HeightV(index*2,height,8-index));
  authoredHeightShot.camKeys=heights.map((_,index)=>({yaw:index*5,pitch:-index,fov:40+index}));
  authoredHeightShot.camTimes=T.distributedPathTimes(authoredHeightShot.camPts,0,authoredHeightShot.dur);
  authoredHeightShot.camAimTimes=authoredHeightShot.camTimes.slice();authoredHeightShot.camFovTimes=authoredHeightShot.camTimes.slice();
  authoredHeightShot.camEase=[];authoredHeightShot.camAimEase=[];authoredHeightShot.camFovEase=[];
  authoredHeightShot.camMode='line';authoredHeightShot.timingMode='custom';T.setSelCamPt(0);
};
installAuthoredHeightRoute([12,12]);
for(const [raw,expected] of [[-9,.2],[.2,.2],[15,15],[29.9,29.9],[30,30],[47,30]]){
  el('camPtY').oninput({target:{value:String(raw)}});
  assert(Math.abs(authoredHeightShot.camPts[0].y-expected)<1e-9,`inspector 高度 ${raw}m 按独立 oracle 写为 ${expected}m`);
}
flushTimeouts();installAuthoredHeightRoute([47,12]);T.restorePreviewAnimationState(authoredHeightSnapshot.preview);T.initHistory();
const invalidHeightInput=el('camPtY');
for(const autoKey of [false,true]){
  if(T.previewAutoKey!==autoKey)el('motionAutoKey').click();
  for(const raw of ['NaN','Infinity','-Infinity']){
    invalidHeightInput.value=raw;
    const before={
      camPts:JSON.stringify(authoredHeightShot.camPts.map(point=>point.toArray())),
      stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),modified:T.project.modified,
      preview:T.serializePreviewAnimationState(),pending:JSON.stringify(T.previewPendingSnapshot),
      autoTransactions:JSON.stringify(T.previewAutoTransactionOwners),autoChannels:JSON.stringify(T.previewAutoChannelSnapshot),
      undoDepth:T.undoDepth,historyCurrent:T.historyCurrent,historyPending:T.historyPending,historyTimer:T.historyTimer,
      dirtyTimer:T.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes
    };
    const rejected=invalidHeightInput.oninput({target:invalidHeightInput});
    invalidHeightInput.dispatch('change');flushTimeouts();
    const unchanged={
      rejected:rejected===false,control:+invalidHeightInput.value===47,
      camPts:JSON.stringify(authoredHeightShot.camPts.map(point=>point.toArray()))===before.camPts,
      stage:JSON.stringify(T.stageToData())===before.stage,project:JSON.stringify(T.project)===before.project,modified:T.project.modified===before.modified,
      preview:T.serializePreviewAnimationState()===before.preview,pending:JSON.stringify(T.previewPendingSnapshot)===before.pending,
      autoTransactions:JSON.stringify(T.previewAutoTransactionOwners)===before.autoTransactions,
      autoChannels:JSON.stringify(T.previewAutoChannelSnapshot)===before.autoChannels,
      undoDepth:T.undoDepth===before.undoDepth,historyCurrent:T.historyCurrent===before.historyCurrent,
      historyPending:T.historyPending===before.historyPending,historyTimer:T.historyTimer===before.historyTimer,
      dirtyTimer:T.dirtyTimer===before.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3')===before.autosave,
      writes:sandbox.localStorage._writes===before.writes
    };
    assert(Object.values(unchanged).every(Boolean),
      `inspector legacy 47m 非有限高度 ${raw} 在 Auto Key ${autoKey?'开':'关'}时原子拒绝，项目/预览/history/autosave 零写入 (${Object.entries(unchanged).filter(([,ok])=>!ok).map(([key])=>key).join(',')||'ok'})`);
  }
}
if(T.previewAutoKey)el('motionAutoKey').click();
const scrubInput=el('camPtY'),scrubLabel=el('cphLabel');
scrubInput.min=scrubInput.getAttribute('min');scrubInput.max=scrubInput.getAttribute('max');scrubInput.step=scrubInput.getAttribute('step');scrubInput.value='29.9';
authoredHeightShot.camPts[0].y=29.9;
scrubLabel.dispatch('pointerdown',{pointerId:811,clientX:0,preventDefault(){}});
fireWindow('pointermove',{pointerId:811,clientX:500});fireWindow('pointerup',{pointerId:811,clientX:500});
assert(authoredHeightShot.camPts[0].y===30&&scrubInput.value===30,'机位点数值拖拽读取 UI max 并在 30m 停止');
installAuthoredHeightRoute([29.9,47]);T.setSelCamPt(1);
const legacyExtrapolationSource=authoredHeightShot.camPts[1];el('addPt').click();
assert(legacyExtrapolationSource.y===47&&authoredHeightShot.camPts[2].y===30,
  '新增点外推把 legacy >30m 的新点夹到30，且不回写历史源点');
installAuthoredHeightRoute([.3,.2]);T.setSelCamPt(1);el('addPt').click();
assert(authoredHeightShot.camPts[2].y===.2,'新增点向下外推在 0.2m 停止');
installAuthoredHeightRoute([25]);T.applyPreset('pull');
assert(authoredHeightShot.camPts.at(-1).y===30&&authoredHeightShot.camPts.every(point=>authoredCameraHeightIsValid(point.y)),
  'pull 预设的所有新机位点保持在 0.2–30m');
T.applyPreset('crane');
assert(authoredHeightShot.camPts.at(-1).y===30&&authoredHeightShot.camPts.every(point=>authoredCameraHeightIsValid(point.y)),
  'crane 预设的所有新机位点保持在 0.2–30m');
installAuthoredHeightRoute([2,3]);T.viewCam.position.set(4,47,6);T.writeCurrentView(true);
assert(authoredHeightShot.camPts[0].y===30,'写入当前视角把 47m 作者期机位夹到30m');
T.viewCam.position.set(5,31,7);T.setEndpointFromView(true);
T.viewCam.position.set(6,-4,8);T.setEndpointFromView(false);
assert(authoredHeightShot.camPts[0].y===30&&authoredHeightShot.camPts.at(-1).y===.2,'起幅/落幅分别执行 30m 上限与 0.2m 下限');
authoredHeightShot.camPts=authoredHeightSnapshot.camPts;authoredHeightShot.camKeys=authoredHeightSnapshot.camKeys;
authoredHeightShot.camTimes=authoredHeightSnapshot.camTimes;authoredHeightShot.camAimTimes=authoredHeightSnapshot.camAimTimes;authoredHeightShot.camFovTimes=authoredHeightSnapshot.camFovTimes;
authoredHeightShot.camEase=authoredHeightSnapshot.camEase;authoredHeightShot.camAimEase=authoredHeightSnapshot.camAimEase;authoredHeightShot.camFovEase=authoredHeightSnapshot.camFovEase;
authoredHeightShot.camMode=authoredHeightSnapshot.camMode;authoredHeightShot.timingMode=authoredHeightSnapshot.timingMode;authoredHeightShot.lock=authoredHeightSnapshot.lock;
T.restorePreviewAnimationState(authoredHeightSnapshot.preview);T.viewCam.position.copy(authoredHeightView.position);T.viewCam.quaternion.copy(authoredHeightView.quaternion);
T.setSelCamPt(0);T.initHistory();flushTimeouts();T.rebuildViz();T.updateShotCam();
const splineShot={fov:50,yaw:0,pitch:0,
  camPts:[new sandbox.THREE.Vector3(0,1,0),new sandbox.THREE.Vector3(1,1,0),new sandbox.THREE.Vector3(4,2,0)],
  camKeys:[{yaw:170,pitch:-40,fov:80},{yaw:-170,pitch:0,fov:50},{yaw:-150,pitch:15,fov:35}]};
const keyUs=T.cameraKeyProgress(splineShot);
assert(Math.abs(keyUs[1]-.25)<.01, '机位关键帧按点间路径长度对齐，不是机械等分时间');
const midKey=T.sampleCameraKey(splineShot,.5);
assert(midKey.yaw>180&&midKey.yaw<220, 'yaw 跨越 +180°/-180° 时走最短路径，不突然反转 ('+midKey.yaw.toFixed(1)+'°)');
assert(midKey.pitch>-5&&midKey.pitch<20&&midKey.fov>35&&midKey.fov<55,
  '俯仰与 FOV 在相邻关键帧之间连续过渡');
let maxYawStep=0,prevYaw=T.sampleCameraKey(splineShot,0).yaw;
for(let i=1;i<=100;i++){const y=T.sampleCameraKey(splineShot,i/100).yaw;maxYawStep=Math.max(maxYawStep,Math.abs(y-prevYaw));prevYaw=y;}
assert(maxYawStep<2, '高密度采样时旋转无跳帧，最大步进 '+maxYawStep.toFixed(2)+'°');
if(requestedModule==='camera'){
const fovLockShot=T.curShot(),fovLockActor=T.actors.find(actor=>actor.kind==='char'),fovLockTime=T.time;
const fovLockSnapshot={
  sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,sceneData:T.stageToData(),
  lock:fovLockShot.lock,fov:fovLockShot.fov,timingMode:fovLockShot.timingMode,syncActor:fovLockShot.syncActor,
  camPts:fovLockShot.camPts,camKeys:fovLockShot.camKeys,camTimes:fovLockShot.camTimes,
  camAimTimes:fovLockShot.camAimTimes,camFovTimes:fovLockShot.camFovTimes,
  camEase:fovLockShot.camEase,camAimEase:fovLockShot.camAimEase,camFovEase:fovLockShot.camFovEase,
  preview:T.serializePreviewAnimationState()
};
const expectedFocal=value=>Math.round(24/(2*Math.tan(value*Math.PI/360)));
if(fovLockActor){
  fovLockShot.lock=fovLockActor.label;fovLockShot.fov=39;fovLockShot.timingMode='custom';fovLockShot.syncActor='';
  fovLockShot.camPts=[new sandbox.THREE.Vector3(0,2,6),new sandbox.THREE.Vector3(2,2,4)];
  fovLockShot.camKeys=[{yaw:11,pitch:-3,fov:40},{yaw:17,pitch:-5,fov:60}];
  fovLockShot.camTimes=[0,fovLockShot.dur];fovLockShot.camAimTimes=[0,fovLockShot.dur];fovLockShot.camFovTimes=[0,fovLockShot.dur];
  fovLockShot.camEase=[{type:'linear'}];fovLockShot.camAimEase=[{type:'linear'}];fovLockShot.camFovEase=[{type:'linear'}];
  T.clearPointPreview();T.setSelCamPt(0);T.setTime(0);T.refreshShotPanel();T.updateShotCam();T.refreshShotPanel();
  const fovControl=el('fov');fovControl.value='79';
  const fovInputResult=fovControl.oninput(makeEvent({type:'input',target:fovControl,currentTarget:fovControl}));
  fovControl.dispatch('change',makeEvent({type:'change',target:fovControl,currentTarget:fovControl}));
  const fovActual={
    inputResult:fovInputResult,uiValue:+fovControl.value,label:el('fovLabel').textContent,
    shotFov:fovLockShot.fov,camKeyFov:fovLockShot.camKeys[0].fov,
    shotCamFov:T.shotCam.fov,monitor:el('monLens').textContent
  };
  assert(fovInputResult===true&&fovActual.uiValue===79&&fovActual.label.includes('79')&&
    fovActual.shotFov===79&&fovActual.camKeyFov===79&&fovActual.shotCamFov===79&&fovActual.monitor.includes('15mm'),
    'actor lock + custom + t=0 的真实 FOV input/change 必须同步 UI、shot.fov、camKey、shotCam、monitor/playback；'+
    `expected={ui:79,shot:79,camKey:79,shotCam:79,monitor:15mm}; actual=${JSON.stringify(fovActual)}`);
  const fovMatrixActorState={pathPts:fovLockActor.pathPts,pathTimes:fovLockActor.pathTimes,pathEase:fovLockActor.pathEase,pathMode:fovLockActor.pathMode};
  fovLockActor.pathPts=[new sandbox.THREE.Vector3(-2,0,0),new sandbox.THREE.Vector3(0,0,0),new sandbox.THREE.Vector3(2,0,0)];
  fovLockActor.pathTimes=[0,fovLockShot.dur/2,fovLockShot.dur];fovLockActor.pathEase=[{type:'linear'},{type:'linear'}];fovLockActor.pathMode='line';
  const fovMatrixFailures=[],fovLocks=[fovLockActor.label,'全局','手动朝向'],fovTimings=['custom','pointSync','arcLength'];
  let fovMatrixSerial=0;
  for(const timingMode of fovTimings)for(const lock of fovLocks){
    const caseName=`${lock}/${timingMode}`,foundationFov=66+(fovMatrixSerial%7),keyFov=74+(fovMatrixSerial%9),draftFov=52+(fovMatrixSerial%11);fovMatrixSerial++;
    T.cancelUnifiedCameraDraft();T.clearPointPreview();
    fovLockShot.lock=lock;fovLockShot.fov=39;fovLockShot.yaw=5;fovLockShot.pitch=-2;fovLockShot.timingMode=timingMode;fovLockShot.syncActor=timingMode==='pointSync'?fovLockActor.label:'';
    fovLockShot.camPts=[new sandbox.THREE.Vector3(0,2,6),new sandbox.THREE.Vector3(2,2,4),new sandbox.THREE.Vector3(4,2,2)];
    fovLockShot.camKeys=[{yaw:11,pitch:-3,fov:40},{yaw:17,pitch:-5,fov:60},{yaw:23,pitch:-7,fov:87}];
    fovLockShot.camTimes=[0,fovLockShot.dur/2,fovLockShot.dur];fovLockShot.camAimTimes=fovLockShot.camTimes.slice();fovLockShot.camFovTimes=fovLockShot.camTimes.slice();
    fovLockShot.camEase=[{type:'linear'},{type:'linear'}];fovLockShot.camAimEase=[{type:'linear'},{type:'linear'}];fovLockShot.camFovEase=[{type:'linear'},{type:'linear'}];
    const commitAt=(index,at,value,positionName)=>{
      T.clearPointPreview();T.setSelCamPt(index);T.setTime(at);T.updateShotCam();T.refreshShotPanel();
      const keyBefore={yaw:fovLockShot.camKeys[index].yaw,pitch:fovLockShot.camKeys[index].pitch},scalarBefore={yaw:fovLockShot.yaw,pitch:fovLockShot.pitch};
      fovControl.value=String(value);const result=fovControl.oninput(makeEvent({type:'input',target:fovControl,currentTarget:fovControl}));
      fovControl.dispatch('change',makeEvent({type:'change',target:fovControl,currentTarget:fovControl}));
      const actual={result,draft:!!T.currentUnifiedCameraDraftPose(),scalar:fovLockShot.fov,key:fovLockShot.camKeys[index].fov,runtime:T.shotCam.fov,
        ui:+fovControl.value,monitor:el('monLens').textContent,yawDisabled:el('yaw').disabled,keyYaw:fovLockShot.camKeys[index].yaw,keyPitch:fovLockShot.camKeys[index].pitch,
        scalarYaw:fovLockShot.yaw,scalarPitch:fovLockShot.pitch};
      if(!(result===true&&!actual.draft&&actual.scalar===value&&actual.key===value&&actual.runtime===value&&actual.ui===value&&
        actual.monitor.includes(`${expectedFocal(value)}mm`)&&actual.yawDisabled===(lock!=='手动朝向')&&actual.keyYaw===keyBefore.yaw&&actual.keyPitch===keyBefore.pitch&&
        actual.scalarYaw===scalarBefore.yaw&&actual.scalarPitch===scalarBefore.pitch))fovMatrixFailures.push({caseName,positionName,expected:value,actual});
    };
    commitAt(0,0,foundationFov,'foundation');
    commitAt(1,fovLockShot.dur/2,keyFov,'key');
    T.previewCameraPoint(2);T.updateShotCam();T.refreshShotPanel();
    const previewOn={runtime:T.shotCam.fov,ui:+fovControl.value,monitor:el('monLens').textContent};
    if(!(previewOn.runtime===87&&previewOn.ui===87&&previewOn.monitor.includes(`${expectedFocal(87)}mm`)))fovMatrixFailures.push({caseName,positionName:'pointPreviewOn',expected:87,actual:previewOn});
    T.clearPointPreview();T.setSelCamPt(1);T.setTime(fovLockShot.dur/2);T.updateShotCam();T.refreshShotPanel();
    const previewOff={runtime:T.shotCam.fov,ui:+fovControl.value,monitor:el('monLens').textContent};
    if(!(previewOff.runtime===keyFov&&previewOff.ui===keyFov&&previewOff.monitor.includes(`${expectedFocal(keyFov)}mm`)))fovMatrixFailures.push({caseName,positionName:'pointPreviewOff',expected:keyFov,actual:previewOff});
    T.setTime(fovLockShot.dur/4);T.updateShotCam();T.refreshShotPanel();
    const draftBefore={stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),scalar:fovLockShot.fov,key:JSON.stringify(fovLockShot.camKeys),
      undo:T.undoDepth,history:T.historyCommitSequence,pending:T.historyPending,historyTimer:T.historyTimer,dirty:T.dirtyTimer,
      autosave:sandbox.localStorage.getItem('previz_autosave_v3'),writes:sandbox.localStorage._writes};
    fovControl.value=String(draftFov);const draftResult=fovControl.oninput(makeEvent({type:'input',target:fovControl,currentTarget:fovControl}));
    T.updateShotCam();T.refreshShotPanel();const draft=T.currentUnifiedCameraDraftPose();
    const draftActual={result:draftResult,draftFov:draft?.key?.fov,runtime:T.shotCam.fov,ui:+fovControl.value,monitor:el('monLens').textContent,
      stage:JSON.stringify(T.stageToData())===draftBefore.stage,project:JSON.stringify(T.project)===draftBefore.project,scalar:fovLockShot.fov===draftBefore.scalar,
      key:JSON.stringify(fovLockShot.camKeys)===draftBefore.key,undo:T.undoDepth===draftBefore.undo,history:T.historyCommitSequence===draftBefore.history,
      pending:T.historyPending===draftBefore.pending,historyTimer:T.historyTimer===draftBefore.historyTimer,dirty:T.dirtyTimer===draftBefore.dirty,
      autosave:sandbox.localStorage.getItem('previz_autosave_v3')===draftBefore.autosave,writes:sandbox.localStorage._writes===draftBefore.writes};
    if(!(draftResult===true&&draftActual.draftFov===draftFov&&draftActual.runtime===draftFov&&draftActual.ui===draftFov&&
      draftActual.monitor.includes(`${expectedFocal(draftFov)}mm`)&&Object.values(draftActual).slice(5).every(Boolean)))fovMatrixFailures.push({caseName,positionName:'transientDraft',expected:draftFov,actual:draftActual});
    T.cancelUnifiedCameraDraft();
  }
  fovLockActor.pathPts=fovMatrixActorState.pathPts;fovLockActor.pathTimes=fovMatrixActorState.pathTimes;fovLockActor.pathEase=fovMatrixActorState.pathEase;fovLockActor.pathMode=fovMatrixActorState.pathMode;
  assert(fovMatrixFailures.length===0,
    '三锁 × custom/pointSync/arcLength 的 0秒基础点、普通 key、非 key draft 与 point preview 开/关保持 FOV authored/draft/runtime/serialized 一致，且不改变 yaw/pitch：'+JSON.stringify(fovMatrixFailures));
}else assert(false,'FOV 锁定回归需要一个真实 actor lock 目标');
fovLockShot.lock=fovLockSnapshot.lock;fovLockShot.fov=fovLockSnapshot.fov;fovLockShot.timingMode=fovLockSnapshot.timingMode;fovLockShot.syncActor=fovLockSnapshot.syncActor;
fovLockShot.camPts=fovLockSnapshot.camPts;fovLockShot.camKeys=fovLockSnapshot.camKeys;fovLockShot.camTimes=fovLockSnapshot.camTimes;
fovLockShot.camAimTimes=fovLockSnapshot.camAimTimes;fovLockShot.camFovTimes=fovLockSnapshot.camFovTimes;
fovLockShot.camEase=fovLockSnapshot.camEase;fovLockShot.camAimEase=fovLockSnapshot.camAimEase;fovLockShot.camFovEase=fovLockSnapshot.camFovEase;
T.project.scenes[fovLockSnapshot.sceneIdx]=JSON.parse(JSON.stringify(fovLockSnapshot.sceneData));T.loadScene(fovLockSnapshot.sceneIdx,true);T.setShot(fovLockSnapshot.shotIdx,true);
T.restorePreviewAnimationState(fovLockSnapshot.preview);T.setTime(fovLockTime);flushTimeouts();T.initHistory();T.refreshShotPanel();T.updateShotCam();
const fovRoundTripOrigin={project:JSON.parse(JSON.stringify(T.project)),sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,time:T.time};
fovRoundTripOrigin.project.scenes[fovRoundTripOrigin.sceneIdx]=T.stageToData();
const fovTransactionActor=T.actors.find(actor=>actor.kind==='char')||T.actors[0],fovTransactionShot=T.curShot();
if(fovTransactionActor){
  fovTransactionShot.lock=fovTransactionActor.label;fovTransactionShot.fov=39;fovTransactionShot.timingMode='custom';fovTransactionShot.syncActor='';
  fovTransactionShot.camPts=[new sandbox.THREE.Vector3(0,2,6),new sandbox.THREE.Vector3(2,2,4)];
  fovTransactionShot.camKeys=[{yaw:11,pitch:-3,fov:39},{yaw:17,pitch:-5,fov:60}];fovTransactionShot.camTimes=[0,fovTransactionShot.dur];
  fovTransactionShot.camAimTimes=fovTransactionShot.camTimes.slice();fovTransactionShot.camFovTimes=fovTransactionShot.camTimes.slice();
  fovTransactionShot.camEase=[{type:'linear'}];fovTransactionShot.camAimEase=[{type:'linear'}];fovTransactionShot.camFovEase=[{type:'linear'}];
  T.clearPointPreview();T.setSelCamPt(0);T.setTime(0);T.updateShotCam();T.syncScene();flushTimeouts();T.initHistory();
  const gestureBefore={undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes};
  const gestureFov=el('fov');for(const value of [61,70,79]){gestureFov.value=String(value);gestureFov.oninput(makeEvent({type:'input',target:gestureFov,currentTarget:gestureFov}));}
  gestureFov.dispatch('change',makeEvent({type:'change',target:gestureFov,currentTarget:gestureFov}));T.updateShotCam();T.refreshShotPanel();flushTimeouts();
  assert(T.undoDepth===gestureBefore.undo+1&&T.historyCommitSequence===gestureBefore.history+1&&sandbox.localStorage._writes===gestureBefore.writes+1&&
    fovTransactionShot.fov===79&&fovTransactionShot.camKeys[0].fov===79&&T.shotCam.fov===79,
    `连续 FOV input 手势只形成一次 history/autosave，且 change 后 authored/runtime 一致 (undo=${T.undoDepth-gestureBefore.undo}, history=${T.historyCommitSequence-gestureBefore.history}, writes=${sandbox.localStorage._writes-gestureBefore.writes})`);
  let savedFovProject='';const fovSaved=await T.saveProjectFile({bridge:{saveProject:async(_name,contents)=>{savedFovProject=contents;return {canceled:false,path:'/isolated/fov-roundtrip.previz.json'};}}});
  const savedFovShot=JSON.parse(savedFovProject).scenes[fovRoundTripOrigin.sceneIdx].shots[fovRoundTripOrigin.shotIdx];
  T.undoLast();T.setTime(0);T.updateShotCam();T.refreshShotPanel();const undoneFovShot=T.curShot();
  assert(fovSaved&&savedFovShot.fov===79&&savedFovShot.camAim[0][2]===79&&undoneFovShot.fov===39&&T.ensureCamKeys(undoneFovShot)[0].fov===39&&T.shotCam.fov===39&&el('monLens').textContent.includes(`${expectedFocal(39)}mm`),
    'Undo 同时恢复兼容标量、camKey、shotCam 与 monitor；保存内容保留 79° 标量/key');
  const reopenedFov=T.openProjectData(JSON.parse(savedFovProject));flushTimeouts();T.loadScene(fovRoundTripOrigin.sceneIdx,true);T.setShot(fovRoundTripOrigin.shotIdx,true);T.setTime(0);T.updateShotCam();T.refreshShotPanel();
  const reopenedFovShot=T.curShot();
  assert(reopenedFov&&reopenedFovShot.fov===79&&T.ensureCamKeys(reopenedFovShot)[0].fov===79&&T.shotCam.fov===79&&el('monLens').textContent.includes(`${expectedFocal(79)}mm`),
    'project v5 保存并重开后标量、camKey、shotCam 与 monitor 继续保持 79° 一致');
}else assert(false,'FOV history/save/reopen 回归需要一个锁定目标');
T.openProjectData(fovRoundTripOrigin.project);flushTimeouts();T.loadScene(fovRoundTripOrigin.sceneIdx,true);T.setShot(fovRoundTripOrigin.shotIdx,true);T.setTime(fovRoundTripOrigin.time);T.updateShotCam();T.refreshShotPanel();T.initHistory();
}
const liveShot=T.curShot(),oldLock=liveShot.lock,oldKeys=JSON.parse(JSON.stringify(T.ensureCamKeys(liveShot)));
liveShot.lock='手动朝向';T.setSelCamPt(0);
const beforeCamN=liveShot.camPts.length;
el('addPt').click();
assert(liveShot.camPts.length===beforeCamN+1&&liveShot.camKeys.length===liveShot.camPts.length,
  '新增机位点时同步插入朝向/FOV 关键帧');
el('delPt').click();
assert(liveShot.camPts.length===beforeCamN&&liveShot.camKeys.length===liveShot.camPts.length,
  '删除机位点时朝向/FOV 关键帧始终同步');
liveShot.lock=oldLock;liveShot.camKeys=oldKeys;
const camData=T.stageToData().shots[T.shotIdx];
assert(camData.camAim.length===camData.cam.length&&camData.camAim[0].length===3,
  '项目序列化保存每个机位点的 yaw/pitch/FOV');

section('路径时间逻辑: 摄影机与对象按同序号节点同步');
const V=sandbox.THREE.Vector3;
const unequalCam=[new V(0,2,0),new V(1,2,0),new V(10,2,0)];
const unequalActor=[new V(0,0,0),new V(8,0,0),new V(10,0,0)];
const camLine=new sandbox.THREE.CurvePath();camLine.add(new sandbox.THREE.LineCurve3(unequalCam[0],unequalCam[1]));camLine.add(new sandbox.THREE.LineCurve3(unequalCam[1],unequalCam[2]));
const actorLine=new sandbox.THREE.CurvePath();actorLine.add(new sandbox.THREE.LineCurve3(unequalActor[0],unequalActor[1]));actorLine.add(new sandbox.THREE.LineCurve3(unequalActor[1],unequalActor[2]));
assert(T.pointIndexedPosition(unequalCam,'line',camLine,.5).distanceTo(unequalCam[1])<1e-6,
  '机位在共享进度 50% 精确到达第2点（不受前后段长度影响）');
assert(T.pointIndexedPosition(unequalActor,'line',actorLine,.5).distanceTo(unequalActor[1])<1e-6,
  '对象在共享进度 50% 精确到达第2点（与机位同刻）');
assert(camLine.getPointAt(.5).distanceTo(unequalCam[1])>.5&&actorLine.getPointAt(.5).distanceTo(unequalActor[1])>.5,
  '原弧长逻辑在不等长分段中不会误判为节点同步');
const syncShot=T.curShot(),syncObj=T.actors.find(a=>!a.mount&&a.pathPts.length===syncShot.camPts.length);
if(syncObj){
  syncShot.timingMode='pointSync';syncShot.syncActor=syncObj.label;T.refreshTimingUI();
  assert(T.isPointSyncShot(syncShot)&&T.syncTargetForShot(syncShot)===syncObj,'点数相同时启用指定对象的严格节点同步');
  assert(el('timingStatus').textContent.includes('同时到达'),'右栏明确显示同时到达/同时结束状态');
  const oldCamPts=syncShot.camPts,oldCamKeys=syncShot.camKeys,oldCamMode=syncShot.camMode;
  const oldActorPts=syncObj.pathPts,oldActorMode=syncObj.pathMode,oldCollision=T.project.settings.collision;
  syncShot.camPts=unequalCam.map(p=>p.clone());syncShot.camMode='line';syncShot.camKeys=syncShot.camPts.map(()=>({yaw:0,pitch:0,fov:40}));
  syncObj.pathPts=unequalActor.map(p=>p.clone());syncObj.pathMode='line';T.project.settings.collision=false;
  T.clearPointPreview();T.setTime(syncShot.dur*.5);T.updateActors();T.updateShotCam();
  assert(T.camBall.position.distanceTo(syncShot.camPts[1])<1e-5&&syncObj.obj.position.clone().setY(0).distanceTo(syncObj.pathPts[1])<1e-5,
    '实际播放到镜头 50% 时，摄影机与对象同时精确落在各自第2点');
  assert(Math.abs(T.nodeArrivalTime(1,3,syncShot.dur)-syncShot.dur*.5)<1e-5,'右栏第2点到达时间与实际同步帧一致');
  syncShot.camPts=oldCamPts;syncShot.camKeys=oldCamKeys;syncShot.camMode=oldCamMode;
  syncObj.pathPts=oldActorPts;syncObj.pathMode=oldActorMode;T.project.settings.collision=oldCollision;T.setTime(0);T.updateActors();T.updateShotCam();
  const savedTiming=T.stageToData().shots[T.shotIdx];
  assert(savedTiming.timingMode==='pointSync'&&savedTiming.syncActor===syncObj.label,'节点同步模式与对象写入项目数据');
  syncObj.pathPts.push(syncObj.pathPts[syncObj.pathPts.length-1].clone().add(new V(1,0,0)));T.refreshTimingUI();
  assert(!T.isPointSyncShot(syncShot)&&el('timingStatus').textContent.includes('无法节点同步'),'点数不一致时拒绝伪同步并给出明确提示');
  syncObj.pathPts.pop();
  syncShot.timingMode='arcLength';T.refreshTimingUI();
  assert(!T.isPointSyncShot(syncShot)&&el('timingStatus').textContent.includes('原逻辑'),'可切回各自按弧长匀速的原逻辑');
  syncShot.timingMode='pointSync';T.refreshTimingUI();
} else assert(false,'当前镜头应有一条点数相同的对象路径用于同步测试');

section('多轨调度时间轴: 独立起止时间 + 路径节点关键帧');
assert(!!el('motionToggle')&&!!el('motionPanel')&&!!el('motionRows')&&!!el('motionRuler'),'多轨调度器、时间标尺与轨道容器存在');
const motionAddKeyControl=htmlIds.has('motionAddKey')?el('motionAddKey'):null;
const motionAutoKeyControl=htmlIds.has('motionAutoKey')?el('motionAutoKey'):null;
const motionSnapControl=htmlIds.has('motionSnap')?el('motionSnap'):null;
const motionAdvancedControl=htmlIds.has('motionAdvanced')?el('motionAdvanced'):null;
const motionClearCameraControl=htmlIds.has('motionClearCamera')?el('motionClearCamera'):null;
const motionTimeScopeControl=htmlIds.has('motionTimeScope')?el('motionTimeScope'):null;
assert(!!motionAddKeyControl&&!!motionAutoKeyControl&&!!motionSnapControl&&!!motionAdvancedControl&&!!motionClearCameraControl&&!!motionTimeScopeControl,
  '时间轴提供摄影机记录、Auto Key、时间吸附、清除动画、高级展开与时间范围入口');
assert(motionAutoKeyControl?.getAttribute('aria-pressed')==='false',
  'Auto Key 初始 aria-pressed=false，默认不自动记录');
assert(motionSnapControl?.getAttribute('aria-pressed')==='true'&&motionSnapControl.title===sandbox.PreVisionI18n.t('timeline.snap.title'),
  '时间吸附默认开启，并通过双语 title/aria-pressed 暴露 Option 临时旁路语义');
const nearHalfSnap=T.resolveMotionDragTime(1.44,{min:0,max:4,pixelsPerSecond:100}),
  outsideMagnet=T.resolveMotionDragTime(1.39,{min:0,max:4,pixelsPerSecond:100}),
  optionBypass=T.resolveMotionDragTime(1.44,{min:0,max:4,pixelsPerSecond:100,bypass:true});
assert(nearHalfSnap.time===1.5&&nearHalfSnap.snapped&&outsideMagnet.time===1.4&&!outsideMagnet.snapped&&optionBypass.time===1.44&&!optionBypass.snapped,
  '统一时间 helper 在吸附开启时保持 0.1s 落点与 8px 内 n.0/n.5 强吸附，Option 临时旁路后保持连续');
const snapStageBefore=JSON.stringify(T.stageToData()),snapDepthBefore=T.undoDepth,snapWritesBefore=sandbox.localStorage._writes;
motionSnapControl.click();const manualOffSnap=T.resolveMotionDragTime(1.44,{min:0,max:4,pixelsPerSecond:100});
motionSnapControl.click();
assert(manualOffSnap.time===1.44&&!manualOffSnap.snapped&&motionSnapControl.getAttribute('aria-pressed')==='true'&&
  JSON.stringify(T.stageToData())===snapStageBefore&&T.undoDepth===snapDepthBefore&&sandbox.localStorage._writes===snapWritesBefore,
  '手动关闭同时取消强吸附与 0.1s 量化；连续拖动不进入 project/history/autosave，Option 不会反向开启');
const motionRulerControl=el('motionRuler');
assert(typeof motionRulerControl.onpointerdown==='function'||(motionRulerControl._ev?.pointerdown||[]).length>0,
  '时间标尺注册指针定位/拖动处理，不再只是静态刻度');
T.refreshMotionTimeline();
let motionTreeChildren=Array.from(el('motionRows').children||[]);
const rulerDuration=T.motionTimelineDuration(),rulerChildren=Array.from(el('motionRuler').children||[]),
  rulerMarks=rulerChildren.filter(child=>dynamicHasClass(child,'motion-ruler-mark')),
  halfMarks=rulerMarks.filter(child=>dynamicHasClass(child,'half')||dynamicHasClass(child,'major')),
  majorMarks=rulerMarks.filter(child=>dynamicHasClass(child,'major'));
assert(rulerMarks.length===Math.floor(rulerDuration*10+1e-7)+1&&halfMarks.length===Math.floor(rulerDuration*2+1e-7)+1&&majorMarks.length===Math.floor(rulerDuration+1e-7)+1&&
  rulerChildren.some(child=>dynamicHasClass(child,'motion-tick')&&child.textContent==='0.0s')&&
  el('motionPanel').style.getPropertyValue('--timeline-minor-step')&&el('motionPanel').style.getPropertyValue('--timeline-half-step'),
  '尺规完整绘制 0.1s 小刻度、0.5s 中刻度与 1.0s 大刻度，并向所有 lane 共享严格对齐网格');
assert(!!motionTreeChildren.find(child=>child.id==='motionSnapGuide'&&child.hidden===true),
  '时间轴准备默认隐藏的竖向吸附 guide，只有强吸附命中时显示');
const defaultMotionRows=motionTreeChildren.filter(row=>row.id!=='motionPlayhead'&&row.id!=='motionSnapGuide'&&!dynamicHasClass(row,'motion-shot-end-line'));
assert(defaultMotionRows.length===1&&defaultMotionRows[0].dataset?.legacy==='true'&&defaultMotionRows[0].dataset?.type==='camera'&&
  defaultMotionRows[0].children?.[0]?.children?.[1]?.textContent?.includes('摄影机')&&
  !!Array.from(el('motionRuler').children||[]).find(child=>dynamicHasClass(child,'motion-shot-end-label'))&&
  !!motionTreeChildren.find(child=>dynamicHasClass(child,'motion-shot-end-line'))&&motionTimeScopeControl.getAttribute('aria-pressed')==='false',
  '默认本镜头局部时间线只有一行统一摄影机轨，并显示镜头结束边界');
const runManualScrubRegression=()=>{
const manualSnapWasOn=motionSnapControl.getAttribute('aria-pressed')==='true',
  manualScopeWasGlobal=motionTimeScopeControl.getAttribute('aria-pressed')==='true';
if(!manualSnapWasOn)motionSnapControl.click();if(manualScopeWasGlobal)motionTimeScopeControl.click();T.refreshMotionTimeline();
const manualScrubBefore={
  project:JSON.stringify(T.project),shotIdx:T.shotIdx,time:T.time,rulerWidth:motionRulerControl.clientWidth,
  preview:T.serializePreviewAnimationState(),undo:T.undoDepth,history:T.historyCommitSequence,
  dirty:T.dirtyTimer,writes:sandbox.localStorage._writes
};
T.clearPreviewAnimationState();motionRulerControl.clientWidth=640;
const motionRowsControl=el('motionRows'),manualScrubDuration=T.motionTimelineDuration(),
  scrubClientX=time=>time/manualScrubDuration*motionRulerControl.clientWidth,
  currentPlayhead=()=>Array.from(motionRowsControl.children||[]).find(child=>child.id==='motionPlayhead'),
  currentLegacyLane=()=>Array.from(motionRowsControl.children||[]).find(row=>row.dataset?.legacy==='true')?.children?.[1],
  dragManualScrub=({target='playhead',rawTime,pointerId,altKey=false,finish='pointerup'}={})=>{
    const captureTarget=target==='ruler'?motionRulerControl:motionRowsControl;
    const eventTarget=target==='ruler'?motionRulerControl:currentPlayhead();
    captureTarget.dispatch('pointerdown',makeEvent({type:'pointerdown',target:eventTarget,pointerId,clientX:scrubClientX(rawTime),button:0,altKey}));
    if(finish==='lostpointercapture')captureTarget.dispatch('lostpointercapture',makeEvent({type:finish,pointerId,clientX:scrubClientX(rawTime),altKey}));
    else fireWindow(finish,{type:finish,pointerId,clientX:scrubClientX(rawTime),altKey});
  };
dragManualScrub({rawTime:1.44,pointerId:191});
const playheadSnapTime=T.time,playheadSnapStatus=el('motionStatus').textContent;
dragManualScrub({target:'ruler',rawTime:2.04,pointerId:192});
const rulerSnapTime=T.time;
const laneClickTarget=currentLegacyLane();laneClickTarget.clientWidth=640;
motionRowsControl.dispatch('pointerdown',makeEvent({type:'pointerdown',target:laneClickTarget,pointerId:193,clientX:1.46/manualScrubDuration*laneClickTarget.clientWidth,button:0}));
const laneSnapTime=T.time;
motionSnapControl.click();
dragManualScrub({rawTime:1.44,pointerId:194});
const manualOffScrubTime=T.time;
motionSnapControl.click();
dragManualScrub({rawTime:1.44,pointerId:195,altKey:true});
const optionScrubTime=T.time;
motionRowsControl.dispatch('pointerdown',makeEvent({type:'pointerdown',target:currentPlayhead(),pointerId:196,clientX:scrubClientX(1.44),button:0}));
const liveSnapGuide=el('motionSnapGuide'),liveSnapPlayhead=currentPlayhead();
const liveSnapState=T.time===1.5&&!liveSnapGuide.hidden&&dynamicHasClass(liveSnapPlayhead,'motion-snapped')&&el('motionStatus').textContent.includes('1.5s');
fireWindow('pointermove',{type:'pointermove',pointerId:196,clientX:scrubClientX(1.3)});
const pendingManualScrubFrame=rafQueue.pop();if(pendingManualScrubFrame)pendingManualScrubFrame(nowMs);
const liveUnsnapState=T.time===1.3&&liveSnapGuide.hidden&&!dynamicHasClass(liveSnapPlayhead,'motion-snapped')&&!el('motionStatus').textContent.includes('已吸附');
fireWindow('pointerup',{type:'pointerup',pointerId:196,clientX:scrubClientX(1.3)});
const cancelScrubState=(finish,pointerId)=>{
  motionRowsControl.dispatch('pointerdown',makeEvent({type:'pointerdown',target:currentPlayhead(),pointerId,clientX:scrubClientX(1.44),button:0}));
  const activePlayhead=currentPlayhead(),activeGuide=el('motionSnapGuide');
  const active=T.time===1.5&&!activeGuide.hidden&&dynamicHasClass(activePlayhead,'motion-snapped');
  if(finish==='lostpointercapture')motionRowsControl.dispatch('lostpointercapture',makeEvent({type:finish,pointerId,clientX:scrubClientX(1.44)}));
  else if(finish==='blur')fireWindow('blur',{type:finish});
  else fireWindow(finish,{type:finish,pointerId,clientX:scrubClientX(1.44)});
  return active&&activeGuide.hidden&&!dynamicHasClass(activePlayhead,'motion-snapped')&&!el('motionStatus').textContent.includes('已吸附');
};
const blurClearsScrub=cancelScrubState('blur',197),
  cancelClearsScrub=cancelScrubState('pointercancel',198),
  lostCaptureClearsScrub=cancelScrubState('lostpointercapture',199);
dragManualScrub({rawTime:1.44,pointerId:200});
const normalPointerUpKeepsStatus=T.time===1.5&&el('motionStatus').textContent.includes('1.5s')&&el('motionStatus').textContent.includes('已吸附')&&
  el('motionSnapGuide').hidden&&!dynamicHasClass(currentPlayhead(),'motion-snapped');
const continuousPixelTolerance=manualScrubDuration/motionRulerControl.clientWidth,
  runManualScrubMove=(pointerId,rawTime,altKey=false)=>{
    motionRowsControl.dispatch('pointerdown',makeEvent({type:'pointerdown',target:currentPlayhead(),pointerId,clientX:scrubClientX(1.2),button:0,altKey}));
    fireWindow('pointermove',{type:'pointermove',pointerId,clientX:scrubClientX(rawTime),altKey});
    const frame=rafQueue.pop();if(frame)frame(nowMs);
    const live={time:T.time,status:el('motionStatus').textContent,tc:el('tc').textContent};
    fireWindow('pointerup',{type:'pointerup',pointerId,clientX:scrubClientX(rawTime),altKey});
    return live;
  };
motionSnapControl.click();
const manualOffContinuous=runManualScrubMove(203,1.437);
motionSnapControl.click();
const optionContinuous=runManualScrubMove(204,2.043,true);
assert(Math.abs(manualOffContinuous.time-1.437)<=continuousPixelTolerance&&
  Math.abs(manualOffContinuous.time-Math.round(manualOffContinuous.time*10)/10)>continuousPixelTolerance&&
  manualOffContinuous.status.includes('1.437')&&
  Math.abs(optionContinuous.time-2.043)<=continuousPixelTolerance&&
  Math.abs(optionContinuous.time-Math.round(optionContinuous.time*10)/10)>continuousPixelTolerance&&
  optionContinuous.status.includes('2.043'),
  `真实 pointer 播放头在 snap OFF/Option 下保持连续值并于 pointermove 实时刷新读数 (tol=${continuousPixelTolerance}, off=${JSON.stringify(manualOffContinuous)}, option=${JSON.stringify(optionContinuous)})`);
let scopeBoundaryCorrect=true,scopeBoundaryShot=T.shotIdx,scopeBoundaryTime=T.time;
if(T.shots.length>1){
  T.setShot(1,true);motionTimeScopeControl.click();
  const sceneOffset=T.shots.slice(0,1).reduce((sum,shot)=>sum+shot.dur,0),sceneRaw=sceneOffset+.44,
    sceneExpected=Math.round(sceneRaw/.5)*.5,sceneDuration=T.motionTimelineDuration(),
    sceneClientX=time=>time/sceneDuration*motionRulerControl.clientWidth;
  motionRulerControl.dispatch('pointerdown',makeEvent({type:'pointerdown',pointerId:201,clientX:sceneClientX(sceneRaw),button:0}));
  fireWindow('pointerup',{type:'pointerup',pointerId:201,clientX:sceneClientX(sceneRaw)});
  const sceneGlobalCorrect=T.shotIdx===1&&Math.abs(T.time-(sceneExpected-sceneOffset))<1e-9;
  motionTimeScopeControl.click();
  const localDuration=T.motionTimelineDuration(),localClientX=time=>time/localDuration*motionRulerControl.clientWidth;
  motionRulerControl.dispatch('pointerdown',makeEvent({type:'pointerdown',pointerId:202,clientX:localClientX(.46),button:0}));
  fireWindow('pointerup',{type:'pointerup',pointerId:202,clientX:localClientX(.46)});
  scopeBoundaryCorrect=sceneGlobalCorrect&&T.shotIdx===1&&Math.abs(T.time-.5)<1e-9;
  scopeBoundaryShot=T.shotIdx;scopeBoundaryTime=T.time;
}
T.setShot(manualScrubBefore.shotIdx,true);T.setTime(manualScrubBefore.time);T.updateActors();T.updateShotCam();
T.restorePreviewAnimationState(manualScrubBefore.preview);motionRulerControl.clientWidth=manualScrubBefore.rulerWidth;T.refreshMotionTimeline();
if(!manualSnapWasOn)motionSnapControl.click();if(manualScopeWasGlobal)motionTimeScopeControl.click();
assert(playheadSnapTime===1.5&&rulerSnapTime===2&&laneSnapTime===1.5&&manualOffScrubTime===1.44&&optionScrubTime===1.44,
  `真实 pointer 手动定位统一吸附：playhead 1.44→1.5、ruler 2.04→2.0、lane 1.46→1.5，manual off/Option 连续保留 1.44 (actual=${[playheadSnapTime,rulerSnapTime,laneSnapTime,manualOffScrubTime,optionScrubTime].join('/')}, status=${JSON.stringify(playheadSnapStatus)})`);
assert(liveSnapState&&liveUnsnapState&&blurClearsScrub&&cancelClearsScrub&&lostCaptureClearsScrub&&normalPointerUpKeepsStatus,
  `播放头吸附反馈区分拖离/取消/完成 (live=${liveSnapState}, unsnap=${liveUnsnapState}, blur=${blurClearsScrub}, cancel=${cancelClearsScrub}, lost=${lostCaptureClearsScrub}, up=${normalPointerUpKeepsStatus})`);
const manualScrubChecks={
  scope:scopeBoundaryCorrect,project:JSON.stringify(T.project)===manualScrubBefore.project,
  undo:T.undoDepth===manualScrubBefore.undo,history:T.historyCommitSequence===manualScrubBefore.history,
  dirty:T.dirtyTimer===manualScrubBefore.dirty,writes:sandbox.localStorage._writes===manualScrubBefore.writes
};
assert(Object.values(manualScrubChecks).every(Boolean),
  `手动播放头定位保持 shot-local/scene-global 边界，并对 project/history/autosave 零写入 (scope=${manualScrubChecks.scope}, project=${manualScrubChecks.project}, undo=${manualScrubChecks.undo}, history=${manualScrubChecks.history}, dirty=${manualScrubChecks.dirty}, writes=${manualScrubChecks.writes}, shot=${scopeBoundaryShot}, time=${scopeBoundaryTime})`);
};
motionAdvancedControl.click();motionTreeChildren=Array.from(el('motionRows').children||[]);
const cameraDetailLabels=motionTreeChildren.filter(row=>row.dataset?.trackRole==='camera-detail').map(row=>row.children?.[0]?.children?.[1]?.textContent||'');
assert(cameraDetailLabels.length===5&&['位置 X','位置 Y','位置 Z','朝向','焦距 FOV'].every(label=>cameraDetailLabels.some(value=>value.includes(label))),
  '高级展开后才显示摄影机 X/Y/Z、朝向与 FOV 派生轨');
assert(!motionTreeChildren.some(row=>row?.dataset?.trackRole==='group'),'本镜头局部时间不混入 actor/prop 场景全局轨');
motionTimeScopeControl.click();motionTreeChildren=Array.from(el('motionRows').children||[]);
const previewParentTrack=motionTreeChildren.find(row=>
  row?.dataset?.trackRole==='group'||String(row?.className||'').split(/\s+/).includes('motion-group-row'));
const previewChildTrack=motionTreeChildren.find(row=>
  row?.dataset?.trackRole==='channel'||String(row?.className||'').split(/\s+/).includes('motion-channel-row'));
assert(!!previewParentTrack&&['true','false'].includes(previewParentTrack.getAttribute('aria-expanded'))&&motionTimeScopeControl.getAttribute('aria-pressed')==='true',
  '场景全局时间视图以 aria-expanded 暴露 actor/prop 父轨');
assert(!!previewChildTrack,'场景全局父轨展开结构包含可独立编辑的属性子轨');
assert(!!el('motionResizeHandle')&&html.includes("HEIGHT_KEY='previz_motion_h'")&&html.includes("cursor:ns-resize"),
  '调度轨道支持上下拖动改变高度，并持久保存笔记本紧凑布局');
assert(/new ResizeObserver\s*\(\s*\(\)\s*=>\s*scheduleUIResize\(false\)\s*\)/.test(playbackModuleSrc)&&
  typeof T.setTimelineState === 'function' && /function setTimelineState\s*\([^)]*\)\s*\{[\s\S]*?scheduleUIResize\(\)/.test(appModuleSrc),
  '轨道展开或隐藏后自动重算导演台画布，避免摄影机宽高比拉伸畸变');
const timelineStyle=(html.match(/<style>([\s\S]*?)<\/style>/)||[,''])[1];
assert(timelineStyle.includes('#timeline.resizing') && timelineStyle.includes('transition:none'),
  '连续拖动轨道高度时关闭时间轴高度过渡，避免布局动画追赶指针');
const timelineZIndex=selector=>Number((timelineStyle.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\{[^}]*z-index:(\\d+)`))||[])[1]);
assert(timelineZIndex('.motion-key')===10&&timelineZIndex('.motion-group-key')===10&&timelineZIndex('.motion-clip-grip')===9&&timelineZIndex('#motionPlayhead')===8,
  '时间轴局部交互层级固定为关键帧/组 > clip grip > 播放头命中条');
assert(/#motionPlayhead\{[^}]*width:13px/.test(timelineStyle)&&!/#motionPlayhead\{[^}]*pointer-events:none/.test(timelineStyle),
  '播放头保留 13px 空白命中条与 pointer 事件，关键帧优先级不以缩窄或禁用 scrub 实现');
frames(2); // 清空 boot 阶段的首帧尺寸任务，仅保留持续渲染循环。
const motionHandle=el('motionResizeHandle'),timelineEl=el('timeline'),motionViewport=el('viewport');
const motionViewportHeight=motionViewport.clientHeight,motionSceneBefore=JSON.stringify(T.stageToData());
motionHandle.dispatch('pointerdown',{pointerId:71,clientY:520});
assert(timelineEl.classList.contains('resizing'),'按下轨道高度手柄后进入无过渡拖拽态');
fireWindow('pointerup',{pointerId:72,clientY:520});
assert(timelineEl.classList.contains('resizing'),'第二指针松开不会提前结束时间轴高度拖动');
fireWindow('pointermove',{pointerId:71,clientY:500});
fireWindow('pointermove',{pointerId:71,clientY:470});
fireWindow('pointermove',{pointerId:71,clientY:440});
motionViewport.clientHeight=motionViewportHeight-60;
const resizeDuringDrag=T.renderer.setSizeCalls;
const pipResizeDuringDrag=T.pipRenderer.setSizeCalls;
frames(1);
assert(T.renderer.setSizeCalls-resizeDuringDrag===1,
  '同一动画帧内多次轨道拖动只重设一次主 renderer 尺寸');
assert(T.pipRenderer.setSizeCalls===pipResizeDuringDrag&&T.renderer.lastOperation==='render'&&T.pipRenderer.lastOperation==='render',
  '轨道高度变化不重设监视器，且两块画布本帧最后操作均为 render 而非清空尺寸');
fireWindow('pointerup',{pointerId:71,clientY:440});
assert(!timelineEl.classList.contains('resizing'),'松开轨道高度手柄后退出拖拽态');
assert(JSON.stringify(T.stageToData())===motionSceneBefore,'调整轨道高度不改变摄影机、路径或时间轴项目数据');
motionViewport.clientHeight=motionViewportHeight;frames(2);
const stableResizeCalls=T.renderer.setSizeCalls;
T.resize();T.resize();
assert(T.renderer.setSizeCalls===stableResizeCalls,'尺寸未变化时不重复清空 WebGL 绘图缓冲区');
const timingPts=[new V(0,0,0),new V(2,0,0),new V(10,0,0)];
const distanceTimes=T.distributedPathTimes(timingPts,1,9);
assert(Math.abs(distanceTimes[0]-1)<1e-6&&Math.abs(distanceTimes[1]-2.6)<1e-6&&Math.abs(distanceTimes[2]-9)<1e-6,
  '旧路径按实际段长迁移为带独立起止时间的默认关键帧');
const repaired=T.repairPathTimes(timingPts,[1,5],0,8);
assert(repaired.length===3&&repaired[0]===0&&repaired[2]===8,'缺失或数量不符的旧时间数据会自动修复');
const stableActor=T.actors.find(a=>a.pathPts.length>=2),stableRef=stableActor.pathTimes;T.ensureActorTimes(stableActor);
assert(stableActor.pathTimes===stableRef,'时间校验原地更新数组，拖拽过程中不会因右栏刷新丢失引用');
const timed=T.timedPathState(timingPts,[1,3,8],2);
assert(timed.active&&Math.abs(timed.u-.25)<1e-6&&timed.segment===0,'任意节点时间可独立决定路径采样进度');
const customShot=T.curShot(),oldCustom={pts:customShot.camPts,keys:customShot.camKeys,times:customShot.camTimes,mode:customShot.camMode,timing:customShot.timingMode};
customShot.camPts=timingPts.map(p=>p.clone().setY(2));customShot.camKeys=customShot.camPts.map(()=>({yaw:0,pitch:0,fov:40}));customShot.camMode='line';customShot.camTimes=[.5,1.5,customShot.dur];customShot.timingMode='custom';
T.clearPointPreview();T.setTime(1.5);T.updateShotCam();
assert(T.camBall.position.distanceTo(customShot.camPts[1])<1e-5,'自定义时间模式在指定时刻精确到达对应机位点');
const customData=T.stageToData();
assert(customData.version===undefined&&customData.shots[T.shotIdx].camTimes.length===3&&customData.actors.every(a=>Array.isArray(a.pathTimes)),
  '摄影机、角色和道具的节点时间写入场景数据');
customShot.camPts=oldCustom.pts;customShot.camKeys=oldCustom.keys;customShot.camTimes=oldCustom.times;customShot.camMode=oldCustom.mode;customShot.timingMode=oldCustom.timing;T.setTime(0);T.updateShotCam();
customShot.timingMode='custom';T.refreshTimingUI();
assert(el('timingStatus').textContent.includes('调度轨道'),'右栏自定义时间模式明确引导用户使用下方多轨调度器');
customShot.timingMode=oldCustom.timing;T.refreshTimingUI();

const previewSidecarApiNames=[
  'recordPreviewKeyGroup','previewOwnerState','movePreviewChannelKey','movePreviewKeyGroup',
  'previewGroupRange','samplePreviewChannel','serializePreviewAnimationState','restorePreviewAnimationState'
];
previewSidecarApiNames.forEach(name=>assert(typeof T[name]==='function',`预览动画 sidecar 暴露 ${name} 契约`));
const previewSidecarReady=previewSidecarApiNames.every(name=>typeof T[name]==='function');
if(previewSidecarReady){
  const previewOwnerKey='qa:soft-key-group';
  const stageBeforePreviewSidecar=JSON.stringify(T.stageToData());
  const previewStateBefore=T.serializePreviewAnimationState();
  const clonePreviewSnapshot=value=>{
    if(typeof value==='string')return value;
    const json=JSON.stringify(value);
    return typeof json==='string'?JSON.parse(json):undefined;
  };
  const previewChannelKeys=(state,channelId)=>{
    if(Array.isArray(state?.keys))return state.keys.filter(key=>(key.channelId||key.channel)===channelId);
    const channels=state?.channels;
    const channel=Array.isArray(channels)
      ?channels.find(item=>(item.channelId||item.id)===channelId)
      :channels&&channels[channelId];
    if(Array.isArray(channel))return channel;
    if(Array.isArray(channel?.keys))return channel.keys;
    if(Array.isArray(channel?.keyframes))return channel.keyframes;
    return [];
  };
  const previewKeyId=key=>key?.id??key?.keyId;
  const previewRangeBounds=range=>Array.isArray(range)
    ?{start:+range[0],end:+range[1]}
    :{start:+(range?.start??range?.min??range?.from),end:+(range?.end??range?.max??range?.to)};

  T.recordPreviewKeyGroup(previewOwnerKey,{x:0,y:10,scale:1},2,'manual');
  let previewState=T.previewOwnerState(previewOwnerKey);
  let xKey=previewChannelKeys(previewState,'x')[0],yKey=previewChannelKeys(previewState,'y')[0],scaleKey=previewChannelKeys(previewState,'scale')[0];
  const initialPreviewGroupReady=!!xKey&&!!yKey&&!!scaleKey&&previewKeyId(xKey)!==undefined&&previewKeyId(yKey)!==undefined&&xKey.groupId!==undefined;
  assert(initialPreviewGroupReady&&xKey.time===2&&yKey.time===2&&scaleKey.time===2&&xKey.groupId===yKey.groupId&&xKey.groupId===scaleKey.groupId,
    '一次手动/Auto 记录把变化通道以同一 groupId 初始写在同一时刻');
  if(initialPreviewGroupReady){
    const firstGroupId=xKey.groupId;
    T.movePreviewChannelKey(previewOwnerKey,'y',previewKeyId(yKey),2.75);
    previewState=T.previewOwnerState(previewOwnerKey);
    xKey=previewChannelKeys(previewState,'x')[0];yKey=previewChannelKeys(previewState,'y')[0];scaleKey=previewChannelKeys(previewState,'scale')[0];
    const staggerRange=previewRangeBounds(T.previewGroupRange(previewState,firstGroupId));
    assert(xKey.time===2&&yKey.time===2.75&&scaleKey.time===2&&staggerRange.start===2&&staggerRange.end===2.75,
      '子通道关键帧可单独错位，父组范围实时反映子键并集');

    T.movePreviewKeyGroup(previewOwnerKey,firstGroupId,1.25);
    previewState=T.previewOwnerState(previewOwnerKey);
    xKey=previewChannelKeys(previewState,'x')[0];yKey=previewChannelKeys(previewState,'y')[0];scaleKey=previewChannelKeys(previewState,'scale')[0];
    const movedRange=previewRangeBounds(T.previewGroupRange(previewState,firstGroupId));
    assert(xKey.time===3.25&&yKey.time===4&&scaleKey.time===3.25&&Math.abs((yKey.time-xKey.time)-.75)<1e-9&&movedRange.start===3.25&&movedRange.end===4,
      '拖动父组整体平移所有子键，并保留已经形成的相对错位');

    T.recordPreviewKeyGroup(previewOwnerKey,{x:20,y:30,scale:2},5.25,'manual');
    previewState=T.previewOwnerState(previewOwnerKey);
    assert(Math.abs(T.samplePreviewChannel(previewState,'x',4.25,-1)-10)<1e-9&&T.samplePreviewChannel(previewState,'missing',4.25,7)===7,
      '子通道在相邻关键帧之间线性采样，缺失通道返回显式 fallback');

    const savedPreviewSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState());
    assert(savedPreviewSnapshot!==undefined,'预览动画 sidecar 可序列化为纯 JSON 快照');
    if(savedPreviewSnapshot!==undefined){
      T.movePreviewChannelKey(previewOwnerKey,'x',previewKeyId(xKey),4.75);
      T.restorePreviewAnimationState(savedPreviewSnapshot);
      const restoredX=previewChannelKeys(T.previewOwnerState(previewOwnerKey),'x')[0];
      assert(restoredX?.time===3.25,'预览动画快照恢复关键帧 ID、数值与错位时间');
    }
  }

  const collisionOwner='qa:collision-safe-keys';
  T.recordPreviewKeyGroup(collisionOwner,{x:1,y:2},1,'manual');
  T.recordPreviewKeyGroup(collisionOwner,{x:3,y:4},2,'manual');
  T.recordPreviewKeyGroup(collisionOwner,{x:30},2,'manual');
  const collisionState=T.previewOwnerState(collisionOwner),collisionX=previewChannelKeys(collisionState,'x');
  assert(collisionX.length===2&&collisionX[1].value===30,
    '同一通道在同一时刻再次打键会更新既有值，不重复堆叠关键帧');
  T.movePreviewChannelKey(collisionOwner,'x',previewKeyId(collisionX[0]),2);
  const clampedX=previewChannelKeys(collisionState,'x');
  assert(clampedX[0].time<clampedX[1].time&&clampedX[1].time-clampedX[0].time>=1/60-1e-9,
    '独立子键拖动不会穿越或堆叠同通道相邻关键帧');
  const firstCollisionGroup=collisionState.groups.find(group=>group.id===clampedX[0].groupId),beforeCollisionGap=previewChannelKeys(collisionState,'y')[0].time-clampedX[0].time;
  T.movePreviewKeyGroup(collisionOwner,firstCollisionGroup.id,20);
  const groupMovedX=previewChannelKeys(collisionState,'x')[0],groupMovedY=previewChannelKeys(collisionState,'y')[0];
  assert(groupMovedX.time<previewChannelKeys(collisionState,'x')[1].time&&Math.abs((groupMovedY.time-groupMovedX.time)-beforeCollisionGap)<1e-9,
    '父组整体移动受同通道邻键约束，并保持组内相对错位');

  const integrationApiNames=['previewActorOwnerKey','previewCameraOwnerKey','previewSupportedChannels','notePreviewEdit','commitPendingPreviewKeys','finishPreviewEdit','commitPreviewHistoryTransaction','applyPreviewActorAnimation','applyPreviewElevationSafely','clearPreviewChannels','remapPreviewOwnerKeys','retimePreviewForShotDuration','removePreviewShotTimeRange','animatableJointKeys'];
  integrationApiNames.forEach(name=>assert(typeof T[name]==='function',`预览打键集成暴露 ${name} 契约`));
  if(integrationApiNames.every(name=>typeof T[name]==='function')){
    const integrationSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),savedTime=T.time;
    const manualActor=T.actors.find(actor=>!actor.mount&&actor.kind!=='desert');
    if(manualActor){
      const ownerKey=T.previewActorOwnerKey(manualActor),savedPosition=manualActor.obj.position.clone(),firstX=savedPosition.x+1,secondX=savedPosition.x+3;
      const ownerLimit=T.shots.reduce((sum,shot)=>sum+shot.dur,0),anchor=Math.min(2,ownerLimit*.4);
      const boundaryGroup=T.recordPreviewKeyGroup(ownerKey,{scale:manualActor.obj.scale.x},anchor,'manual');
      let boundaryState=T.previewOwnerState(ownerKey),boundaryKey=previewChannelKeys(boundaryState,'scale').find(key=>key.groupId===boundaryGroup.id);
      T.movePreviewChannelKey(ownerKey,'scale',previewKeyId(boundaryKey),0);
      boundaryState=T.previewOwnerState(ownerKey);boundaryKey=previewChannelKeys(boundaryState,'scale').find(key=>key.groupId===boundaryGroup.id);
      const boundaryOffset=boundaryKey.time-boundaryState.groups.find(group=>group.id===boundaryGroup.id).time;
      T.movePreviewKeyGroup(ownerKey,boundaryGroup.id,ownerLimit*3);
      boundaryState=T.previewOwnerState(ownerKey);boundaryKey=previewChannelKeys(boundaryState,'scale').find(key=>key.groupId===boundaryGroup.id);
      const boundedGroup=boundaryState.groups.find(group=>group.id===boundaryGroup.id);
      assert(Math.abs(boundedGroup.time-ownerLimit)<1e-9&&boundaryKey.time>=0&&boundaryKey.time<=ownerLimit&&Math.abs((boundaryKey.time-boundedGroup.time)-boundaryOffset)<1e-9,
        '子键先错位到 0 后右拖父组，父组锚点与子键都限制在 owner 区间并保持相对错位');
      T.restorePreviewAnimationState(integrationSnapshot);
      T.setTime(0);manualActor.obj.position.x=firstX;T.notePreviewEdit(ownerKey,['position.x']);T.commitPendingPreviewKeys('manual',ownerKey);
      T.setTime(Math.min(.75,T.curShot().dur*.5));manualActor.obj.position.x=secondX;T.notePreviewEdit(ownerKey,['position.x']);
      T.applyPreviewActorAnimation(manualActor,T.time);
      assert(Math.abs(manualActor.obj.position.x-secondX)<1e-9,'已有关键帧时，待提交候选值不会被 rAF 旧采样覆盖');
      T.commitPendingPreviewKeys('manual',ownerKey);
      const positionKeys=previewChannelKeys(T.previewOwnerState(ownerKey),'position.x');
      assert(positionKeys.length===2&&Math.abs(positionKeys[1].value-secondX)<1e-9,'第二次手动 K 使用编辑结束时冻结的候选值创建新键');
      manualActor.obj.position.copy(savedPosition);
    }else assert(false,'应有可用于二次手动打键集成验证的非挂载对象');
    T.restorePreviewAnimationState(integrationSnapshot);T.setTime(savedTime);

    if(manualActor){
      const pointerSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),pointerShot=T.shotIdx,pointerTime=T.time;
      const pointerOwner=T.previewActorOwnerKey(manualActor),pointerFirstTime=Math.min(.5,T.curShot().dur*.2),
        pointerSecondTime=Math.min(Math.max(pointerFirstTime+.5,1),Math.max(pointerFirstTime+.5,T.curShot().dur*.6)),
        pointerGroup=T.recordPreviewKeyGroup(pointerOwner,{scale:manualActor.obj.scale.x},pointerFirstTime,'manual');
      T.recordPreviewKeyGroup(pointerOwner,{scale:manualActor.obj.scale.x+.1},pointerSecondTime,'manual');
      const motionRows=el('motionRows'),findLane=row=>Array.from(row?.children||[]).find(child=>dynamicHasClass(child,'motion-lane'));
      T.refreshMotionTimeline();
      let pointerRow=Array.from(motionRows.children||[]).find(row=>row.dataset?.previewOwner===pointerOwner&&row.dataset?.channel==='scale');
      if(pointerRow)pointerRow.classList.add('motion-row');
      let pointerTarget=Array.from(findLane(pointerRow)?.children||[]).filter(child=>child.dataset?.role==='preview-key'&&child.dataset?.keyId).at(-1);
      assert(!!pointerRow&&!!pointerTarget,'可从真实预览子轨定位关键帧拖动目标');
      if(pointerRow&&pointerTarget){
        const keyId=pointerTarget.dataset.keyId,beforeTime=previewChannelKeys(T.previewOwnerState(pointerOwner),'scale').find(key=>previewKeyId(key)===keyId).time;
        T.initHistory();const depthBefore=T.undoDepth;
        motionRows.dispatch('pointerdown',makeEvent({target:pointerTarget,pointerId:501,clientX:100,button:0}));
        fireWindow('pointerup',{pointerId:502,clientX:100});
        assert(T.undoDepth===depthBefore,'第二指针松开不会提前提交预览子键拖动');
        fireWindow('pointermove',{pointerId:501,clientX:140});
        const movedTime=previewChannelKeys(T.previewOwnerState(pointerOwner),'scale').find(key=>previewKeyId(key)===keyId).time;
        const livePreviewKeys=previewChannelKeys(T.previewOwnerState(pointerOwner),'scale'),
          livePreviewSegments=Array.from(findLane(pointerRow)?.children||[]).filter(child=>dynamicHasClass(child,'motion-segment')),
          livePreviewDuration=T.shots.reduce((sum,shot)=>sum+shot.dur,0),
          livePreviewSegmentsCurrent=livePreviewSegments.length===Math.max(0,livePreviewKeys.length-1)&&livePreviewSegments.every((segment,index)=>{
            const start=livePreviewKeys[index],end=livePreviewKeys[index+1];
            return Math.abs(parseFloat(segment.style.left)-(start.time/livePreviewDuration*100))<1e-6&&
              Math.abs(parseFloat(segment.style.width)-((end.time-start.time)/livePreviewDuration*100))<1e-6&&
              segment.dataset.ease===T.normalizeEaseSpec(start.ease||'linear').type;
          });
        assert(Math.abs(movedTime-beforeTime)>1e-9&&Math.abs(movedTime*10-Math.round(movedTime*10))<1e-9&&livePreviewSegmentsCurrent&&T.undoDepth===depthBefore,
          `预览/AutoKey 子键拖动在 pointerup 前同步派生相邻 segment 的 left/width/data-ease，且尚未提交历史 (moved=${movedTime-beforeTime}, segments=${livePreviewSegments.length}/${Math.max(0,livePreviewKeys.length-1)}, styles=${JSON.stringify(livePreviewSegments.map(segment=>[segment.style.left,segment.style.width,segment.dataset.ease]))}, depth=${T.undoDepth}/${depthBefore})`);
        fireWindow('pointerup',{pointerId:501,clientX:140});
        assert(T.undoDepth===depthBefore+1,'活动指针松开后预览子键拖动只提交一次历史事务');
      }

      T.refreshMotionTimeline();
      pointerRow=Array.from(motionRows.children||[]).find(row=>row.dataset?.previewOwner===pointerOwner&&row.dataset?.trackRole==='group');
      if(pointerRow)pointerRow.classList.add('motion-row');
      pointerTarget=Array.from(findLane(pointerRow)?.children||[]).find(child=>child.dataset?.role==='preview-group'&&child.dataset?.groupId===pointerGroup.id);
      assert(!!pointerRow&&!!pointerTarget,'可从真实预览父轨定位软分组拖动目标');
      if(pointerRow&&pointerTarget){
        const beforeTime=T.previewOwnerState(pointerOwner).groups.find(group=>group.id===pointerGroup.id).time;
        T.initHistory();const depthBefore=T.undoDepth;
        motionRows.dispatch('pointerdown',makeEvent({target:pointerTarget,pointerId:511,clientX:100,button:0}));
        motionRows.dispatch('lostpointercapture',{pointerId:512});
        assert(T.undoDepth===depthBefore,'第二指针丢失捕获不会提前提交预览父组拖动');
        fireWindow('pointermove',{pointerId:511,clientX:140});
        const movedTime=T.previewOwnerState(pointerOwner).groups.find(group=>group.id===pointerGroup.id).time;
        assert(Math.abs(movedTime-beforeTime)>1e-9&&Math.abs(movedTime*10-Math.round(movedTime*10))<1e-9,
          '忽略第二指针清理事件后，活动指针仍可继续移动预览父组并落在 0.1s');
        fireWindow('pointerup',{pointerId:511,clientX:140});
        assert(T.undoDepth===depthBefore+1,'活动指针松开后预览父组拖动只提交一次历史事务');
      }

      T.restorePreviewAnimationState(pointerSnapshot);
      const genericCancelGroup=T.recordPreviewKeyGroup(pointerOwner,{scale:manualActor.obj.scale.x},.5,'manual');
      T.recordPreviewKeyGroup(pointerOwner,{scale:manualActor.obj.scale.x+.2},3,'manual');
      const genericCancelFixture=clonePreviewSnapshot(T.serializePreviewAnimationState()),
        runGenericSnapCancel=(role,finish,pointerId)=>{
          T.restorePreviewAnimationState(genericCancelFixture);T.refreshMotionTimeline();
          const row=Array.from(motionRows.children||[]).find(candidate=>candidate.dataset?.previewOwner===pointerOwner&&
            (role==='preview-key'?candidate.dataset?.channel==='scale':candidate.dataset?.trackRole==='group'));
          if(row)row.classList.add('motion-row');
          const state=T.previewOwnerState(pointerOwner),
            fixtureKey=previewChannelKeys(state,'scale').find(key=>key.groupId===genericCancelGroup.id),
            lane=findLane(row),target=Array.from(lane?.children||[]).find(child=>role==='preview-key'
              ?child.dataset?.role===role&&child.dataset?.keyId===previewKeyId(fixtureKey)
              :child.dataset?.role===role&&child.dataset?.groupId===genericCancelGroup.id);
          assert(!!row&&!!lane&&!!target,`可从真实 generic ${role} 轨定位 ${finish} 吸附取消目标`);
          if(!row||!lane||!target)return;
          const currentTime=role==='preview-key'
              ?previewChannelKeys(state,'scale').find(key=>key.groupId===genericCancelGroup.id).time
              :state.groups.find(group=>group.id===genericCancelGroup.id).time,
            rawTime=1.44,expectedTime=1.5,startX=100,
            moveX=startX+(rawTime-currentTime)/T.motionTimelineDuration()*lane.clientWidth;
          motionRows.dispatch('pointerdown',makeEvent({type:'pointerdown',target,pointerId,clientX:startX,button:0}));
          fireWindow('pointermove',{type:'pointermove',pointerId,clientX:moveX});
          const snappedTime=role==='preview-key'
              ?previewChannelKeys(T.previewOwnerState(pointerOwner),'scale').find(key=>key.groupId===genericCancelGroup.id).time
              :T.previewOwnerState(pointerOwner).groups.find(group=>group.id===genericCancelGroup.id).time,
            snappedBeforeFinish=Math.abs(snappedTime-expectedTime)<1e-9&&el('motionStatus').textContent.includes('已吸附')&&
              !el('motionSnapGuide').hidden&&dynamicHasClass(target,'motion-snapped');
          if(finish==='lostpointercapture')motionRows.dispatch('lostpointercapture',makeEvent({type:finish,pointerId,clientX:moveX}));
          else fireWindow(finish,{type:finish,...(finish==='blur'?{}:{pointerId,clientX:moveX})});
          assert(snappedBeforeFinish&&el('motionSnapGuide').hidden&&!dynamicHasClass(target,'motion-snapped')&&!el('motionStatus').textContent.includes('已吸附'),
            `generic ${role} 先命中 1.5s 后 ${finish} 独立清除 guide/highlight/完成状态 (status=${JSON.stringify(el('motionStatus').textContent)}, time=${snappedTime})`);
        };
      ['pointercancel','blur','lostpointercapture'].forEach((finish,index)=>runGenericSnapCancel('preview-key',finish,531+index));
      ['pointercancel','blur','lostpointercapture'].forEach((finish,index)=>runGenericSnapCancel('preview-group',finish,541+index));
      T.restorePreviewAnimationState(pointerSnapshot);T.setShot(pointerShot,true);T.setTime(pointerTime);T.initHistory();

      T.refreshMotionTimeline();
      const legacyRow=Array.from(motionRows.children||[]).find(row=>row.dataset?.legacy==='true'&&row.dataset?.type==='camera');
      if(legacyRow)legacyRow.classList.add('motion-row');
      const legacyTarget=Array.from(findLane(legacyRow)?.children||[]).find(child=>child.dataset?.role==='key'&&child.dataset?.index==='1');
      assert(!!legacyRow&&!!legacyTarget,'可从真实旧式摄影机轨定位关键帧拖动目标');
      if(legacyRow&&legacyTarget){
        const legacyTrack=T.motionTrack(legacyRow.dataset.type,legacyRow.dataset.label),originalTimes=legacyTrack.times.slice(),
          originalAimTimes=legacyTrack.owner.camAimTimes.slice(),originalFovTimes=legacyTrack.owner.camFovTimes.slice(),originalMode=legacyTrack.owner.timingMode;
        T.initHistory();const depthBefore=T.undoDepth;
        motionRows.dispatch('pointerdown',makeEvent({target:legacyTarget,pointerId:521,clientX:100,button:0}));
        fireWindow('pointercancel',{pointerId:522,clientX:100});
        assert(T.undoDepth===depthBefore,'第二指针取消不会提前提交旧式轨道拖动');
        fireWindow('pointermove',{pointerId:521,clientX:60});
        const liveLegacyTimes=legacyTrack.times.map(value=>value+legacyTrack.offset),
          liveLegacyDuration=T.shots.reduce((sum,shot)=>sum+shot.dur,0),
          liveLegacySegments=Array.from(findLane(legacyRow)?.children||[]).filter(child=>dynamicHasClass(child,'motion-segment')),
          liveLegacySegmentsCurrent=liveLegacySegments.length===Math.max(0,liveLegacyTimes.length-1)&&liveLegacySegments.every((segment,index)=>
            Math.abs(parseFloat(segment.style.left)-(liveLegacyTimes[index]/liveLegacyDuration*100))<1e-6&&
            Math.abs(parseFloat(segment.style.width)-((liveLegacyTimes[index+1]-liveLegacyTimes[index])/liveLegacyDuration*100))<1e-6&&
            segment.dataset.ease===T.normalizeEaseSpec(legacyTrack.ease[index]||'linear').type);
        assert(legacyTrack.times[0]===0&&Math.abs(legacyTrack.times[1]-originalTimes[1])>1e-9&&Math.abs(legacyTrack.times[1]*10-Math.round(legacyTrack.times[1]*10))<1e-9&&liveLegacySegmentsCurrent&&T.undoDepth===depthBefore,
          `0.0s 基础机位固定，后续摄影机关键帧拖动在 pointerup 前同步派生相邻 segment 且尚未提交历史 (moved=${legacyTrack.times[1]-originalTimes[1]}, segments=${liveLegacySegments.length}/${Math.max(0,liveLegacyTimes.length-1)}, depth=${T.undoDepth}/${depthBefore})`);
        fireWindow('pointerup',{pointerId:521,clientX:60});flushTimeouts();
        assert(T.undoDepth===depthBefore+1,'活动指针松开后旧式轨道拖动只提交一次历史事务');
        legacyTrack.times.splice(0,legacyTrack.times.length,...originalTimes);
        legacyTrack.owner.camAimTimes.splice(0,legacyTrack.owner.camAimTimes.length,...originalAimTimes);
        legacyTrack.owner.camFovTimes.splice(0,legacyTrack.owner.camFovTimes.length,...originalFovTimes);
        legacyTrack.owner.timingMode=originalMode;T.initHistory();
      }
    }else assert(false,'应有可用于指针隔离验证的未挂载对象');

    if(manualActor){
      const cameraChannels=T.previewSupportedChannels({ownerKey:T.previewCameraOwnerKey()},T.previewOwnerState(T.previewCameraOwnerKey()));
      const actorChannels=T.previewSupportedChannels({ownerKey:T.previewActorOwnerKey(manualActor)},T.previewOwnerState(T.previewActorOwnerKey(manualActor)));
      assert(cameraChannels.length===0&&['position.x','position.z','rotation.y','elevation','scale'].every(channel=>actorChannels.includes(channel)),
        '摄影机 generic preview 通道已停止，对象预览通道保持原契约');

      const mountSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),mountOwner=T.previewActorOwnerKey(manualActor),savedMount=manualActor.mount;
      T.recordPreviewKeyGroup(mountOwner,{'position.x':1,'position.z':2,'rotation.y':30,scale:1.1},0,'manual');manualActor.mount='qa-host';
      const mountedChannels=T.previewSupportedChannels({ownerKey:mountOwner},T.previewOwnerState(mountOwner)),clearedRoot=T.clearPreviewChannels(mountOwner,['position.x','position.z','rotation.y']);
      assert(!mountedChannels.includes('position.x')&&!mountedChannels.includes('position.z')&&!mountedChannels.includes('rotation.y')&&clearedRoot===3&&!T.previewOwnerState(mountOwner).channels['position.x'],
        '对象进入挂载状态时隐藏并清理根位移/旋转通道，解除挂载后不会突然恢复旧键导致瞬移');
      manualActor.mount=savedMount;T.restorePreviewAnimationState(mountSnapshot);

      const elevationPosition=manualActor.obj.position.clone(),elevationValue=manualActor.elev;
      T.applyPreviewElevationSafely(manualActor,-10);
      const support=T.terrainSupportHeight(manualActor),safeBox=T.actorWorldBox(manualActor);
      assert(safeBox.min.y>=support-.03&&manualActor.elev===elevationValue,
        '高度关键帧复用安全高度约束，不能沉入当前地形，并在采样后保留 authored 高度');
      manualActor.elev=elevationValue;manualActor.obj.position.copy(elevationPosition);manualActor.obj.updateMatrixWorld(true);
    }

    const cameraSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),cameraShot=T.curShot(),cameraIndex=Math.min(1,cameraShot.camPts.length-1),cameraPoint=cameraShot.camPts[cameraIndex].clone(),cameraKey=T.ensureCamKeys(cameraShot)[cameraIndex],cameraLock=cameraShot.lock,cameraYawDisabled=el('yaw').disabled;
    T.recordPreviewKeyGroup(T.previewCameraOwnerKey(),{'position.x':cameraPoint.x+50,'position.y':cameraPoint.y+20,'position.z':cameraPoint.z+50,yaw:137,fov:99},0,'manual');
    assert(!JSON.parse(T.serializePreviewAnimationState()).entries.some(([ownerKey])=>ownerKey===T.previewCameraOwnerKey()),
      'camera generic preview 旧入口不再序列化为第二套持久真值');
    T.previewCameraPoint(cameraIndex);
    assert(T.shotCam.position.distanceTo(cameraPoint)<1e-6&&Math.abs(T.shotCam.fov-cameraKey.fov)<1e-6,
      '点选既有机位点时保持独立精确预览，不被运行时属性关键帧覆盖');
    T.restorePreviewAnimationState(cameraSnapshot);T.clearPointPreview();
    const lockActor=T.actors.find(actor=>!actor.mount&&actor.kind!=='desert');
    if(lockActor){
      cameraShot.lock=lockActor.label;el('yaw').disabled=true;T.setTime(Math.min(cameraShot.dur*.4,.8));T.updateShotCam();
      T.recordPreviewKeyGroup(T.previewCameraOwnerKey(),{yaw:170,pitch:70,'position.x':T.shotCam.position.x+3},T.time,'manual');T.updateShotCam();
      const lockedDirection=T.lockTarget(lockActor.label).sub(T.shotCam.position).normalize(),cameraDirection=new V(0,0,-1).applyQuaternion(T.shotCam.quaternion).normalize();
      assert(cameraDirection.dot(lockedDirection)>.99999,
        '摄影机锁定主体时，位置预览键会重新 lookAt，手动朝向通道不会覆盖锁定语义');
    }
    cameraShot.lock=cameraLock;el('yaw').disabled=cameraYawDisabled;T.restorePreviewAnimationState(cameraSnapshot);T.setTime(savedTime);T.updateShotCam();

    const poseSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),character=T.actors.find(actor=>actor.kind==='char'),savedSelection=T.selected;
    if(character){
      const savedPose=character.pose,savedJoints=Object.assign({},character.joints||{}),ownerKey=T.previewActorOwnerKey(character);
      T.select(character);T.setTime(0);T.setPose('crouch');T.commitPendingPreviewKeys('manual',ownerKey);
      T.setTime(Math.min(.75,T.curShot().dur*.5));T.setPose('stand');T.commitPendingPreviewKeys('manual',ownerKey);
      const bodyKeys=previewChannelKeys(T.previewOwnerState(ownerKey),'joint.bodyY'),spineKeys=previewChannelKeys(T.previewOwnerState(ownerKey),'joint.spineX');
      assert(T.animatableJointKeys().includes('bodyY')&&bodyKeys.length===2&&bodyKeys[1].value===0&&spineKeys.length===2&&spineKeys[1].value===0,
        '姿态预设记录完整关节集合，切回站立会为先前非零关节显式打 0 键');
      character.pose=savedPose;character.joints=savedJoints;T.applyJoints(character);T.select(savedSelection);
    }else assert(false,'应有可用于姿态归零关键帧验证的人物');
    T.restorePreviewAnimationState(poseSnapshot);T.setTime(savedTime);

    const walkingCharacter=T.actors.find(actor=>actor.kind==='char'&&!actor.mount&&actor.pathPts.length>=2);
    if(walkingCharacter){
      const gaitSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),savedPose=walkingCharacter.pose,savedJoints=Object.assign({},walkingCharacter.joints||{}),gaitTime=Math.min(T.curShot().dur*.45,.9);
      walkingCharacter.pose='stand';walkingCharacter.joints={};T.applyJoints(walkingCharacter);T.setTime(gaitTime);T.updateActors();
      const hipBefore=walkingCharacter.obj.userData.rig.hipL.rotation.x,globalAt=T.shots.slice(0,T.shotIdx).reduce((sum,shot)=>sum+shot.dur,0)+gaitTime;
      T.recordPreviewKeyGroup(T.previewActorOwnerKey(walkingCharacter),{'joint.wristLX':45},globalAt,'manual');T.updateActors();
      const rig=walkingCharacter.obj.userData.rig;
      assert(Math.abs(rig.hipL.rotation.x-hipBefore)<1e-9&&Math.abs(rig.wristL.rotation.x-Math.PI/4)<1e-9,
        '单独腕部通道只覆盖对应关节轴，不会把未打键的程序化步态清零');
      walkingCharacter.pose=savedPose;walkingCharacter.joints=savedJoints;T.applyJoints(walkingCharacter);T.restorePreviewAnimationState(gaitSnapshot);T.setTime(savedTime);T.updateActors();
    }else assert(false,'应有带路径的人物用于独立关节通道与步态共存验证');

    const retimeSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),retimeIndex=T.shotIdx,retimeShot=T.curShot(),retimeOld=retimeShot.dur,retimeNext=retimeOld*1.5,retimeStart=T.shots.slice(0,retimeIndex).reduce((sum,shot)=>sum+shot.dur,0),retimeActor=T.actors.find(actor=>!actor.mount&&actor.kind!=='desert');
    if(retimeActor){
      const actorOwner=T.previewActorOwnerKey(retimeActor),cameraOwner=T.previewCameraOwnerKey();
      T.recordPreviewKeyGroup(cameraOwner,{fov:55},retimeOld*.5,'manual');T.recordPreviewKeyGroup(actorOwner,{scale:1.25},retimeStart+retimeOld*.5,'manual');
      const beforeCameraTime=previewChannelKeys(T.previewOwnerState(cameraOwner),'fov')[0].time,beforeActorTime=previewChannelKeys(T.previewOwnerState(actorOwner),'scale')[0].time;
      T.retimePreviewForShotDuration(retimeIndex,retimeOld,retimeNext);
      assert(previewChannelKeys(T.previewOwnerState(cameraOwner),'fov')[0].time===beforeCameraTime&&previewChannelKeys(T.previewOwnerState(actorOwner),'scale')[0].time===beforeActorTime,
        '镜头时长兼容入口不再按比例重映射 camera/actor sidecar 键');
      if(T.shots.length>1){
        const deleteIndex=0,deleteStart=0,deleteDuration=T.shots[0].dur,afterTime=deleteDuration+Math.min(.5,T.shots[1].dur*.25);
        T.recordPreviewKeyGroup(actorOwner,{elevation:1},deleteDuration*.5,'manual');T.recordPreviewKeyGroup(actorOwner,{elevation:2},afterTime,'manual');T.removePreviewShotTimeRange(deleteIndex,deleteStart,deleteDuration);
        const elevationKeys=previewChannelKeys(T.previewOwnerState(actorOwner),'elevation');
        assert(elevationKeys.length===1&&Math.abs(elevationKeys[0].time-(afterTime-deleteDuration))<1e-9,
          '删除镜头会移除其时间区间内的对象键，并把后续对象键安全前移');
      }
    }
    T.restorePreviewAnimationState(retimeSnapshot);T.setTime(savedTime);

    const DurationV=sandbox.THREE.Vector3;
    const makeDurationShot=(overrides={})=>Object.assign({
      dur:5,timingMode:'custom',syncActor:'',camPts:[new DurationV(0,2,0),new DurationV(2,2,0)],
      camKeys:[{yaw:0,pitch:0,fov:40},{yaw:10,pitch:-2,fov:45}],
      camTimes:[0,2],camAimTimes:[0,2],camFovTimes:[0,2],
      camEase:[{type:'linear'}],camAimEase:[{type:'linear'}],camFovEase:[{type:'linear'}]
    },overrides);
    const makeDurationActor=(label,kind='char',times=[1,2])=>({
      label,kind,timeLink:'independent',timeLinkShot:0,timeOffset:0,
      pathPts:times.map((_,index)=>new DurationV(index,0,index)),pathTimes:times.slice(),pathEase:times.slice(1).map(()=>({type:'linear'}))
    });
    const durationActor=makeDurationActor('Duration Actor'),durationProp=makeDurationActor('Duration Prop','prop',[.5,2.5]);
    let durationShot=makeDurationShot(),durationShots=[durationShot,{dur:4}],durationTracks={camTimes:[0,2],camAimTimes:[0,2],camFovTimes:[0,2]};
    let durationPlan=T.planShotDurationChange(durationShot,6,{shots:durationShots,shotIndex:0,actors:[durationActor,durationProp],materializedCamera:durationTracks,previewKeys:[],previewFingerprint:'qa'});
    const durationActorBefore=durationActor.pathTimes.slice(),durationPropBefore=durationProp.pathTimes.slice(),durationPoseBefore=JSON.stringify([durationShot.camPts,durationShot.camKeys,durationShot.camEase,durationShot.camAimEase,durationShot.camFovEase]);
    const durationApplied=T.applyShotDurationChange(durationPlan);
    assert(durationApplied.ok&&durationShot.dur===6&&JSON.stringify(durationShot.camTimes)==='[0,2.4]'&&
      JSON.stringify(durationShot.camAimTimes)==='[0,2.4]'&&JSON.stringify(durationShot.camFovTimes)==='[0,2.4]'&&
      JSON.stringify([durationShot.camPts,durationShot.camKeys,durationShot.camEase,durationShot.camAimEase,durationShot.camFovEase])===durationPoseBefore&&
      JSON.stringify(durationActor.pathTimes)===JSON.stringify(durationActorBefore)&&JSON.stringify(durationProp.pathTimes)===JSON.stringify(durationPropBefore),
      '拖长镜头按 new/old 等比例重定时三组摄影机局部时间，姿态/ease 与独立 actor/prop 全局时间不变');

    durationShot=makeDurationShot();durationShots=[durationShot,{dur:4}];
    durationPlan=T.planShotDurationChange(durationShot,3,{shots:durationShots,shotIndex:0,actors:[durationActor,durationProp],materializedCamera:durationTracks,previewKeys:[],previewFingerprint:'qa'});
    assert(durationPlan.ok&&T.applyShotDurationChange(durationPlan).ok&&durationShot.dur===3&&JSON.stringify(durationShot.camTimes)==='[0,1.2]'&&
      JSON.stringify(durationShot.camTimes)===JSON.stringify(durationShot.camAimTimes)&&JSON.stringify(durationShot.camTimes)===JSON.stringify(durationShot.camFovTimes),
      '缩短镜头使用同一比例规则，0 秒基础机位保持 0 且三组摄影机时间同步');

    const cameraCutShot=makeDurationShot({camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]});
    const cameraCut=T.planShotDurationChange(cameraCutShot,3,{shots:[cameraCutShot,{dur:4}],shotIndex:0,actors:[],materializedCamera:{camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]},previewKeys:[]});
    const actorBoundary=makeDurationActor('Boundary Actor','char',[1,3]),actorCutShot=makeDurationShot();
    const actorCut=T.planShotDurationChange(actorCutShot,3,{shots:[actorCutShot,{dur:4}],shotIndex:0,actors:[actorBoundary],materializedCamera:durationTracks,previewKeys:[]});
    const previewProp=makeDurationActor('Preview Prop','prop',[.5,2]),previewCutShot=makeDurationShot();
    const previewCut=T.planShotDurationChange(previewCutShot,3,{shots:[previewCutShot,{dur:4}],shotIndex:0,actors:[previewProp],materializedCamera:durationTracks,
      previewKeys:[{domain:'actor',owner:previewProp,channelId:'scale',time:4}]});
    const sceneTail=makeDurationActor('Scene Tail','char',[1,8.5]),sceneCutShot=makeDurationShot();
    const sceneCut=T.planShotDurationChange(sceneCutShot,3,{shots:[sceneCutShot,{dur:4}],shotIndex:0,actors:[sceneTail],materializedCamera:durationTracks,previewKeys:[]});
    assert(cameraCut.ok&&T.applyShotDurationChange(cameraCut).ok&&JSON.stringify(cameraCutShot.camTimes)==='[0,2.4]'&&
      actorCut.ok&&previewCut.ok&&sceneCut.reason==='sceneKeyCut'&&actorCutShot.dur===5&&previewCutShot.dur===5&&sceneCutShot.dur===5,
      '缩短不再因 camera 或 shot-window 内 actor/prop 键拒绝，仅拒绝越过新 sceneDur 的场景全局键');

    const linkedNodes=makeDurationActor('Linked Nodes','char',[0,2]);linkedNodes.timeLink='cameraNodes';
    const linkedFollow=makeDurationActor('Linked Follow','char',[0,1,2]);linkedFollow.timeLink='cameraFollow';
    const linkedCurrentShot=makeDurationShot(),linkedCurrentPlan=T.planShotDurationChange(linkedCurrentShot,6,{shots:[linkedCurrentShot,{dur:4}],shotIndex:0,
      actors:[linkedNodes,linkedFollow],materializedCamera:durationTracks,previewKeys:[]});
    assert(linkedCurrentPlan.ok&&T.applyShotDurationChange(linkedCurrentPlan).ok&&JSON.stringify(linkedNodes.pathTimes)==='[0,2.4]'&&
      linkedFollow.pathTimes[0]===0&&Math.abs(linkedFollow.pathTimes[linkedFollow.pathTimes.length-1]-2.4)<1e-9,
      '当前镜头 cameraNodes/cameraFollow 派生 scene-global 时间与等比例 camera 首尾同步');
    const linkedActor=makeDurationActor('Linked Actor','char',[5,9]);linkedActor.timeLink='cameraFollow';linkedActor.timeLinkShot=1;
    const linkedShot=makeDurationShot(),linkedPlan=T.planShotDurationChange(linkedShot,6,{shots:[linkedShot,{dur:4}],shotIndex:0,actors:[linkedActor],materializedCamera:durationTracks,previewKeys:[]});
    assert(linkedPlan.ok&&T.applyShotDurationChange(linkedPlan).ok&&linkedActor.timeLink==='cameraFollow'&&JSON.stringify(linkedActor.pathTimes)==='[6,10]',
      '修改前置镜头时 cameraFollow 派生全局时间随目标镜头起点平移，联动不解绑');

    const syncActor=makeDurationActor('Sync Actor','char',[0,5]),syncShot=makeDurationShot({timingMode:'pointSync',syncActor:'Sync Actor'}),
      syncActorTimesReference=syncActor.pathTimes;
    const syncPlan=T.planShotDurationChange(syncShot,6,{shots:[syncShot,{dur:4}],shotIndex:0,actors:[syncActor],materializedCamera:{camTimes:[0,5],camAimTimes:[0,5],camFovTimes:[0,5]},
      pointSyncActor:syncActor,pointSyncActorTimes:[0,5],previewKeys:[]});
    const syncApplied=T.applyShotDurationChange(syncPlan);
    assert(syncApplied.ok&&syncShot.timingMode==='custom'&&JSON.stringify(syncShot.camTimes)==='[0,6]'&&
      syncActor.pathTimes===syncActorTimesReference&&JSON.stringify(syncActor.pathTimes)==='[0,5]',
      'pointSync 安全物化后按比例重定时 camera 并转 custom，既有 actor scene-global 时间不重写');
    const unsafeSyncActor=makeDurationActor('Unsafe Sync Actor','char',[1,8]),unsafeSyncShot=makeDurationShot({timingMode:'pointSync',syncActor:'Unsafe Sync Actor'});
    const unsafeSyncBefore=JSON.stringify({shot:unsafeSyncShot,actor:unsafeSyncActor});
    const unsafeSyncPlan=T.planShotDurationChange(unsafeSyncShot,6,{shots:[unsafeSyncShot,{dur:4}],shotIndex:0,actors:[unsafeSyncActor],
      materializedCamera:{camTimes:[0,5],camAimTimes:[0,5],camFovTimes:[0,5]},pointSyncActor:unsafeSyncActor,pointSyncActorTimes:[0,5],previewKeys:[]});
    assert(!unsafeSyncPlan.ok&&unsafeSyncPlan.reason==='unsafePointSync'&&JSON.stringify({shot:unsafeSyncShot,actor:unsafeSyncActor})===unsafeSyncBefore,
      'pointSync 物化值 [0,5] 与既有 actor scene-global pathTimes [1,8] 不逐项相等时首写前原子拒绝');
    const nonfiniteShot=makeDurationShot();nonfiniteShot.camPts[1].x=Infinity;
    const nonfiniteTimes=nonfiniteShot.camTimes,nonfiniteDuration=nonfiniteShot.dur;
    const nonfinitePlan=T.planShotDurationChange(nonfiniteShot,6,{shots:[nonfiniteShot,{dur:4}],shotIndex:0,actors:[],materializedCamera:durationTracks,previewKeys:[]});
    const mismatchedTimesShot=makeDurationShot(),mismatchedTimesRef=mismatchedTimesShot.camTimes;
    const mismatchedTimesPlan=T.planShotDurationChange(mismatchedTimesShot,6,{shots:[mismatchedTimesShot,{dur:4}],shotIndex:0,actors:[],
      materializedCamera:{camTimes:[0,2],camAimTimes:[0],camFovTimes:[0,2]},previewKeys:[]});
    const mismatchedEaseShot=makeDurationShot({camEase:[]}),mismatchedEaseTimes=mismatchedEaseShot.camTimes;
    const mismatchedEasePlan=T.planShotDurationChange(mismatchedEaseShot,6,{shots:[mismatchedEaseShot,{dur:4}],shotIndex:0,actors:[],materializedCamera:durationTracks,previewKeys:[]});
    assert(nonfinitePlan.reason==='malformedCamera'&&nonfiniteShot.dur===nonfiniteDuration&&nonfiniteShot.camTimes===nonfiniteTimes&&
      mismatchedTimesPlan.reason==='unsafeMaterialization'&&mismatchedTimesShot.dur===5&&mismatchedTimesShot.camTimes===mismatchedTimesRef&&
      mismatchedEasePlan.reason==='malformedCamera'&&mismatchedEaseShot.dur===5&&mismatchedEaseShot.camTimes===mismatchedEaseTimes,
      'camera 姿态非有限、三组时间长度失配或 ease 索引失配均在 plan 首写前原子拒绝');
    const arcShot=makeDurationShot({timingMode:'arcLength'}),arcPlan=T.planShotDurationChange(arcShot,6,{shots:[arcShot,{dur:4}],shotIndex:0,actors:[],
      materializedCamera:{camTimes:[0,5],camAimTimes:[0,5],camFovTimes:[0,5]},previewKeys:[]});
    assert(T.applyShotDurationChange(arcPlan).ok&&arcShot.timingMode==='custom'&&JSON.stringify(arcShot.camTimes)==='[0,6]',
      'arcLength 拖长物化当前到达秒数后按比例重定时并转 custom');

    const durationOriginalScene=JSON.parse(JSON.stringify(T.stageToData())),durationOriginalPreview=T.serializePreviewAnimationState(),durationOriginalTime=T.time,
      durationOriginalProject=JSON.parse(JSON.stringify(T.project));
    durationOriginalProject.scenes[T.sceneIdx]=JSON.parse(JSON.stringify(durationOriginalScene));
    const liveShot=T.curShot(),liveSceneDuration=T.shots.reduce((sum,shot)=>sum+shot.dur,0);
    Object.assign(liveShot,makeDurationShot({camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]}));
    T.actors.forEach(actor=>{
      actor.timeLink='independent';actor.timeLinkShot=0;
      actor.pathTimes=Array.from({length:actor.pathPts.length},(_,index)=>actor.pathPts.length<2?0:index/(actor.pathPts.length-1)*Math.min(2,liveSceneDuration));
    });
    T.restorePreviewAnimationState({serial:0,entries:[]});T.refreshShotPanel();
    liveShot.dur=25;T.refreshShotPanel();
    assert(liveShot.dur===25&&+el('shotDurValue').value===25&&+el('shotDur').max>=25,
      '旧项目有限 >20s duration 刷新时保持原值，滑杆上限显式展开而不静默夹回');
    liveShot.dur=5;T.refreshShotPanel();flushTimeouts();T.initHistory();
    const proportionalDurationBefore={undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes};
    el('shotDurValue').value='3.0';el('shotDurValue').onfocus();el('shotDurValue').oninput({target:el('shotDurValue')});
    assert(liveShot.dur===5&&!T.historyPending&&T.dirtyTimer===null,
      '时长输入实时草稿只更新控件，不写 project/history/autosave');
    const proportionalDuration=T.commitShotDurationDraft('3.0');
    assert(proportionalDuration.ok&&liveShot.dur===3&&JSON.stringify(liveShot.camTimes)==='[0,2.4]'&&
      JSON.stringify(liveShot.camTimes)===JSON.stringify(liveShot.camAimTimes)&&JSON.stringify(liveShot.camTimes)===JSON.stringify(liveShot.camFovTimes)&&
      T.historyPending&&T.dirtyTimer!==null&&T.undoDepth===proportionalDurationBefore.undo,
      '真实 UI 缩短镜头按比例重定时三组摄影机关键帧，并只排队一个 history/autosave 事务');
    flushTimeouts();
    assert(T.undoDepth===proportionalDurationBefore.undo+1&&T.historyCommitSequence===proportionalDurationBefore.history+1&&
      sandbox.localStorage._writes===proportionalDurationBefore.writes+1,
      '真实 UI 等比例重定时只形成一次 history 与一次 autosave');
    Object.assign(liveShot,makeDurationShot({camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]}));T.refreshShotPanel();T.initHistory();

    const runtimeRejectActor=T.actors.find(actor=>!actor.mount&&actor.kind!=='desert');
    assert(!!runtimeRejectActor,'真实时长拒绝矩阵需要一个未挂载对象');
    if(runtimeRejectActor){
      const captureRuntimeDurationState=()=>({
        stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),modified:T.project.modified,
        runtime:JSON.stringify({shotIdx:T.shotIdx,time:T.time,playing:T.playing,selected:T.selected?.label||''}),
        preview:T.serializePreviewAnimationState(),undo:T.undoDepth,history:T.historyCurrent,pending:T.historyPending,
        historyTimer:T.historyTimer,historyLifecycle:T.historyLifecycleSequence,historyCommit:T.historyCommitSequence,
        dirty:T.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3'),
        storage:JSON.stringify(sandbox.localStorage._d),writes:sandbox.localStorage._writes
      });
      const durationStateDiff=(before,after)=>Object.keys(before).filter(key=>before[key]!==after[key]);
      const configureRuntimeDurationRejectBase=()=>{
        T.cancelShotDurationDraft();T.restorePreviewAnimationState({serial:0,entries:[]});
        Object.assign(liveShot,makeDurationShot());if(T.shots[1])T.shots[1].dur=4;
        const total=T.shots.reduce((sum,shot)=>sum+shot.dur,0);
        T.actors.forEach(actor=>{
          actor.timeLink='independent';actor.timeLinkShot=T.shotIdx;actor.timeOffset=0;
          actor.pathTimes=actor.pathPts.map((_,index)=>actor.pathPts.length<2?0:index/(actor.pathPts.length-1)*Math.min(2,total));
        });
      };
      const shotStartSeconds=()=>T.shots.slice(0,T.shotIdx).reduce((sum,shot)=>sum+shot.dur,0);
      const runtimeDurationRejectCases=[
        {
          name:'scene-global tail',next:3,reason:'sceneKeyCut',
          setup(){
            const total=T.shots.reduce((sum,shot)=>sum+shot.dur,0);
            runtimeRejectActor.pathPts=[new DurationV(0,0,0),new DurationV(1,0,1)];runtimeRejectActor.pathTimes=[shotStartSeconds()+1,total-.5];
          }
        },
        {
          name:'malformed camera structure',next:6,reason:'unsafeMaterialization',
          setup(){liveShot.camPts=[];liveShot.camKeys=[];liveShot.camTimes=[];liveShot.camAimTimes=[];liveShot.camFovTimes=[];}
        },
        {
          name:'pointSync [1,8] mismatch',next:6,reason:'unsafePointSync',
          setup(){
            liveShot.timingMode='pointSync';liveShot.syncActor=runtimeRejectActor.label;
            runtimeRejectActor.pathPts=[new DurationV(0,0,0),new DurationV(1,0,1)];runtimeRejectActor.pathTimes=[1,8];
          }
        }
      ];
      runtimeDurationRejectCases.forEach(testCase=>{
        configureRuntimeDurationRejectBase();T.refreshShotPanel();testCase.setup();T.initHistory();
        const before=captureRuntimeDurationState(),input=el('shotDurValue');
        input.onfocus();input.value=testCase.next.toFixed(1);input.oninput({target:input});
        const result=T.commitShotDurationDraft(input.value),after=captureRuntimeDurationState(),diff=durationStateDiff(before,after);
        assert(!result.ok&&result.reason===testCase.reason&&!diff.length,
          `真实 UI 拒绝矩阵 ${testCase.name} 在首写前保持 project/runtime/preview sidecar/history/dirty/autosave/localStorage/modified 全零变化 (reason=${result.reason}, diff=${diff.join(',')||'none'})`);
      });
      T.cancelShotDurationDraft();T.restorePreviewAnimationState({serial:0,entries:[]});
      Object.assign(liveShot,makeDurationShot({camTimes:[0,4],camAimTimes:[0,4],camFovTimes:[0,4]}));
      const restoredSceneDuration=T.shots.reduce((sum,shot)=>sum+shot.dur,0);
      T.actors.forEach(actor=>{
        actor.timeLink='independent';actor.timeLinkShot=0;
        actor.pathTimes=actor.pathPts.map((_,index)=>actor.pathPts.length<2?0:index/(actor.pathPts.length-1)*Math.min(2,restoredSceneDuration));
      });
      T.refreshShotPanel();T.initHistory();
    }

    const escapeBefore={
      stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),modified:T.project.modified,
      preview:T.serializePreviewAnimationState(),history:T.historyCurrent,pending:T.historyPending,historyTimer:T.historyTimer,
      dirty:T.dirtyTimer,autosave:sandbox.localStorage.getItem('previz_autosave_v3'),
      storage:JSON.stringify(sandbox.localStorage._d),writes:sandbox.localStorage._writes
    };
    el('shotDurValue').onfocus();el('shotDurValue').value='5.1';el('shotDurValue').oninput({target:el('shotDurValue')});
    T.refreshShotPanel();
    assert(+el('shotDurValue').value===5.1&&+el('shotDur').value===5.1&&liveShot.dur===5&&
      JSON.stringify(T.stageToData())===escapeBefore.stage&&JSON.stringify(T.project)===escapeBefore.project,
      'number 输入 5.1 后即使周期刷新，number/range 仍显示同一草稿且 project duration 保持 5.0');
    el('shotDurValue').onkeydown(makeEvent({key:'Escape',currentTarget:el('shotDurValue')}));
    const escapeChecks={
      stage:JSON.stringify(T.stageToData())===escapeBefore.stage,project:JSON.stringify(T.project)===escapeBefore.project,
      modified:T.project.modified===escapeBefore.modified,preview:T.serializePreviewAnimationState()===escapeBefore.preview,
      history:T.historyCurrent===escapeBefore.history,pending:T.historyPending===escapeBefore.pending,
      historyTimer:T.historyTimer===escapeBefore.historyTimer,dirty:T.dirtyTimer===escapeBefore.dirty,
      autosave:sandbox.localStorage.getItem('previz_autosave_v3')===escapeBefore.autosave,
      storage:JSON.stringify(sandbox.localStorage._d)===escapeBefore.storage,writes:sandbox.localStorage._writes===escapeBefore.writes,
      control:+el('shotDurValue').value===5};
    assert(Object.values(escapeChecks).every(Boolean),
      `Escape 取消时长草稿并恢复控件，零业务写入 (${Object.entries(escapeChecks).filter(([,ok])=>!ok).map(([key])=>key).join(',')||'ok'})`);

    const successBefore={undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes};
    el('shotDurValue').onfocus();el('shotDurValue').value='5.1';el('shotDurValue').oninput({target:el('shotDurValue')});
    T.refreshShotPanel();
    assert(+el('shotDurValue').value===5.1&&+el('shotDur').value===5.1&&liveShot.dur===5,
      'Enter/blur 提交前的周期刷新保持 5.1 草稿，不提前写入 project');
    el('shotDurValue').onkeydown(makeEvent({key:'Enter',currentTarget:el('shotDurValue')}));
    el('shotDurValue').onblur({currentTarget:el('shotDurValue')});
    const successChecks={duration:liveShot.dur===5.1,camera:JSON.stringify(liveShot.camTimes)==='[0,4.08]'&&
      JSON.stringify(liveShot.camTimes)===JSON.stringify(liveShot.camAimTimes)&&JSON.stringify(liveShot.camTimes)===JSON.stringify(liveShot.camFovTimes),
      pending:T.historyPending,dirty:T.dirtyTimer!==null,undo:T.undoDepth===successBefore.undo};
    assert(Object.values(successChecks).every(Boolean),
      `0.1s 数值输入 Enter 提交一次，随后 blur 不重复提交，摄影机关键帧按比例调整 (${Object.entries(successChecks).filter(([,ok])=>!ok).map(([key])=>key).join(',')||'ok'}; feedback=${el('shotDurFeedback').textContent})`);
    const reopenScene=JSON.parse(JSON.stringify(T.stageToData())),reopenProject=JSON.parse(JSON.stringify(T.project));reopenProject.scenes[T.sceneIdx]=reopenScene;
    const normalizedReopen=T.normalizeProjectData(reopenProject),reopenShot=normalizedReopen.scenes[T.sceneIdx].shots[T.shotIdx];
    assert(reopenShot.dur===5.1&&JSON.stringify(reopenShot.camTimes)==='[0,4.08]'&&JSON.stringify(reopenShot.camAimTimes)==='[0,4.08]'&&JSON.stringify(reopenShot.camFovTimes)==='[0,4.08]',
      '成功后的等比例 camera times/ease 保存重开不漂移，project schema 仍为 v5');
    flushTimeouts();
    assert(T.undoDepth===successBefore.undo+1&&T.historyCommitSequence===successBefore.history+1&&sandbox.localStorage._writes===successBefore.writes+1,
      `成功时长修改只形成一次 history 与一次 autosave 调度 (undo=${T.undoDepth-successBefore.undo}, history=${T.historyCommitSequence-successBefore.history}, writes=${sandbox.localStorage._writes-successBefore.writes})`);
    T.undoLast();flushTimeouts();
    assert(T.curShot().dur===5&&JSON.stringify(T.curShot().camTimes)==='[0,4]',
      `Undo 恢复原 duration 与 camera 关键帧时间 (duration=${T.curShot().dur}, times=${JSON.stringify(T.curShot().camTimes)})`);
    T.initHistory();
    const pointerDurationBefore={undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes},durationSlider=el('shotDur');
    durationSlider.value='5.1';durationSlider.onpointerdown({pointerId:901});durationSlider.oninput({target:durationSlider});
    const pointerDraftDuration=T.curShot().dur;
    durationSlider.onpointerup({pointerId:901,currentTarget:durationSlider});
    durationSlider.onchange({target:durationSlider});
    assert(pointerDraftDuration===5&&T.curShot().dur===5.1&&T.historyPending&&T.undoDepth===pointerDurationBefore.undo,
      'range 拖动实时值不写项目，pointerup 提交后 change 不重复生成事务');
    flushTimeouts();
    assert(T.undoDepth===pointerDurationBefore.undo+1&&T.historyCommitSequence===pointerDurationBefore.history+1&&sandbox.localStorage._writes===pointerDurationBefore.writes+1,
      'range pointerup 成功路径只形成一次 history 与一次 autosave');
    T.undoLast();flushTimeouts();
    T.project.scenes[T.sceneIdx]=durationOriginalScene;T.loadScene(T.sceneIdx,true);T.restorePreviewAnimationState(durationOriginalPreview);T.setTime(durationOriginalTime);T.initHistory();

    const makeLegacyDurationProject=version=>{
      const data=JSON.parse(JSON.stringify(durationOriginalProject));data.version=version;
      const scene=data.scenes[0],shot=scene.shots[0],actor=scene.actors[0],prop=scene.actors[1];
      assert(!!scene&&!!shot&&!!actor&&!!prop,`project v${version} legacy >20 夹具具备 camera/actor/prop`);
      if(!scene||!shot||!actor||!prop)return null;
      Object.assign(shot,{
        dur:25.7,timingMode:'custom',syncActor:'',cam:[[0,2,0],[2,3,1]],camAim:[[0,0,40],[12,-3,48]],
        camTimes:[0,20.3],camAimTimes:[0,21.4],camFovTimes:[0,22.5],
        camEase:[{type:'easeIn'}],camAimEase:[{type:'easeOut'}],camFovEase:[{type:'linear'}]
      });
      delete actor.mount;Object.assign(actor,{kind:'char',timeLink:'independent',timeLinkShot:0,path:[[0,0],[1,1]],pathTimes:[1.2,24.4],pathEase:[{type:'easeOut'}]});
      delete prop.mount;Object.assign(prop,{kind:'prop',timeLink:'independent',timeLinkShot:0,path:[[2,0],[3,1]],pathTimes:[.7,23.3],pathEase:[{type:'easeIn'}]});
      return {data,actorLabel:actor.label,propLabel:prop.label};
    };
    const runLegacyDurationRoundTrip=async()=>{
      for(const legacyVersion of [1,3,5]){
        const fixture=makeLegacyDurationProject(legacyVersion);if(!fixture)continue;
        assert(T.openProjectData(fixture.data),`真实打开 project v${legacyVersion} 25.7s 项目`);flushTimeouts();T.initHistory();T.refreshShotPanel();
        const openedShot=T.curShot(),openedActor=T.actors.find(actor=>actor.label===fixture.actorLabel),openedProp=T.actors.find(actor=>actor.label===fixture.propLabel);
        const cameraTimingBefore=[openedShot.camTimes.slice(),openedShot.camAimTimes.slice(),openedShot.camFovTimes.slice()],
          cameraEaseBefore=JSON.stringify([openedShot.camEase,openedShot.camAimEase,openedShot.camFovEase]),
          actorTimingBefore=JSON.stringify([openedActor?.pathTimes,openedActor?.pathEase,openedProp?.pathTimes,openedProp?.pathEase]);
        assert(openedShot.dur===25.7&&+el('shotDurValue').value===25.7&&+el('shotDur').max>=25.7,
          `project v${legacyVersion} 真实打开保留 25.7s，range 不静默钳制`);
        const input=el('shotDurValue');input.onfocus();input.value='25.8';input.oninput({target:input});
        input.onkeydown(makeEvent({key:'Enter',currentTarget:input}));input.onblur({currentTarget:input});flushTimeouts();
        let savedLegacyProject=null;
        const saved=await T.saveProjectFile({bridge:{saveProject:async(_name,contents)=>{
          savedLegacyProject=JSON.parse(contents);return {canceled:false,path:`/isolated/legacy-v${legacyVersion}-25.8.previz.json`};
        }}});
        assert(saved&&savedLegacyProject&&T.openProjectData(savedLegacyProject),`project v${legacyVersion} 25.8s 真实保存并重开`);flushTimeouts();
        const reopenedShot=T.curShot(),reopenedActor=T.actors.find(actor=>actor.label===fixture.actorLabel),reopenedProp=T.actors.find(actor=>actor.label===fixture.propLabel),
          ratio=25.8/25.7,cameraTimesAfter=[reopenedShot.camTimes,reopenedShot.camAimTimes,reopenedShot.camFovTimes],
          cameraScaled=cameraTimesAfter.every((track,trackIndex)=>track.every((value,index)=>{
            const expected=index===0?0:Math.round(cameraTimingBefore[trackIndex][index]*ratio*1000)/1000;
            return Math.abs(value-expected)<1e-9;
          }));
        assert(reopenedShot.dur===25.8&&T.project.version===5&&cameraScaled&&
          JSON.stringify([reopenedShot.camEase,reopenedShot.camAimEase,reopenedShot.camFovEase])===cameraEaseBefore&&
          JSON.stringify([reopenedActor?.pathTimes,reopenedActor?.pathEase,reopenedProp?.pathTimes,reopenedProp?.pathEase])===actorTimingBefore,
          `project v${legacyVersion} 的 25.7→25.8 保存重开保持 camera 等比例结果/ease，并保持 actor/prop 场景全局时间 `+
          `(dur=${reopenedShot.dur}; cameraScaled=${cameraScaled}; camera=${JSON.stringify(cameraTimesAfter)}; `+
          `ease=${JSON.stringify([reopenedShot.camEase,reopenedShot.camAimEase,reopenedShot.camFovEase])===cameraEaseBefore}; `+
          `actor=${JSON.stringify([reopenedActor?.pathTimes,reopenedActor?.pathEase,reopenedProp?.pathTimes,reopenedProp?.pathEase])===actorTimingBefore})`);
        if(legacyVersion===5){
          if(!T.motionAdvancedOpen)el('motionAdvanced').click();
          T.refreshMotionTimeline();const rows=el('motionRows'),laneChildren=row=>{
            const lane=Array.from(row?.children||[]).find(child=>dynamicHasClass(child,'motion-lane'));return Array.from(lane?.children||[]);
          };
          [fixture.actorLabel,fixture.propLabel].forEach((label,index)=>{
            const row=Array.from(rows.children||[]).find(candidate=>candidate.dataset?.legacy==='true'&&candidate.dataset?.type==='actor'&&candidate.dataset?.label===label);
            if(row)row.classList.add('motion-row');
            const children=laneChildren(row),segments=children.filter(child=>dynamicHasClass(child,'motion-segment')),keys=children.filter(child=>child.dataset?.role==='key');
            assert(!!row&&segments.length===keys.length-1&&segments.every(segment=>segment.getAttribute('aria-hidden')==='true'&&segment.getAttribute('tabindex')===null)&&keys.length===2,
              `${index?'prop':'actor'} legacy path 派生 segment 不可聚焦且保留两个 key 命中目标`);
            if(keys[0]){
              rows.dispatch('pointerdown',makeEvent({target:keys[0],pointerId:930+index,clientX:100,button:0}));
              fireWindow('pointerup',{pointerId:930+index,clientX:100});
              assert(T.motionSelected.type==='actor'&&T.motionSelected.label===label&&T.motionSelected.index===0,
                `${index?'prop':'actor'} key 点击仍命中既有选择语义，不被 segment 遮挡`);
            }
          });
          const subtrack=Array.from(rows.children||[]).find(candidate=>candidate.dataset?.trackRole==='camera-detail'&&candidate.dataset?.detailChannel==='aim');
          if(subtrack)subtrack.classList.add('motion-row');
          const subChildren=laneChildren(subtrack),subSegments=subChildren.filter(child=>dynamicHasClass(child,'motion-segment')),subKeys=subChildren.filter(child=>dynamicHasClass(child,'motion-key'));
          assert(!!subtrack&&subSegments.length===subKeys.length-1&&subSegments.every(segment=>segment.getAttribute('aria-hidden')==='true'&&segment.getAttribute('tabindex')===null)&&
            subKeys.length===2&&subKeys.every(key=>key.getAttribute('aria-hidden')==='true'&&key.getAttribute('tabindex')===null),
            '高级 Camera Aim 明细只派生不可聚焦 segment/key，不形成第二套可编辑时间来源');
        }
      }
    };
    if(process.argv.includes('--legacy-duration-isolate')){
      console.log(`[legacy-duration-isolate] parent=${process.env.PREVISION_PARENT_NODE_VERSION||'unknown'} child=${process.version}`);
      await runLegacyDurationRoundTrip();
      finish('legacy duration isolate 结果');
    }else if(!requestedModule||['timeline','project'].includes(requestedModule)){
      const isolated=spawnSync(process.execPath,[fileURLToPath(import.meta.url),'--legacy-duration-isolate'],{
        cwd:path.join(dir,'..'),encoding:'utf8',maxBuffer:16*1024*1024,
        env:{...process.env,PREVISION_PARENT_NODE_VERSION:process.version}
      });
      const versionLine=(isolated.stdout.match(/\[legacy-duration-isolate\] parent=(v\d+\.\d+\.\d+) child=(v\d+\.\d+\.\d+)/)||[]),
        allowedNodeVersion=version=>{const major=Number(String(version||'').match(/^v(\d+)/)?.[1]);return major>=20&&major<=24;};
      if(versionLine.length)console.log(`  legacy duration isolate: parent=${versionLine[1]} child=${versionLine[2]}`);
      assert(isolated.status===0&&versionLine[1]===process.version&&allowedNodeVersion(versionLine[1])&&allowedNodeVersion(versionLine[2]),
        `独立 VM 的 v1/v3/v5 25.7→25.8 打开/编辑/保存/重开链通过，父子 Node 均为 20–24 (${isolated.stderr||isolated.stdout||`status=${isolated.status}`})`);
    }

    flushTimeouts();T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();
    const previewOnlyStage=JSON.stringify(T.stageToData()),previewOnlyDepth=T.undoDepth;
    T.recordPreviewKeyGroup('qa:preview-history-only',{x:5},1,'manual');T.commitPreviewHistoryTransaction();
    assert(T.undoDepth===previewOnlyDepth+1&&JSON.stringify(T.stageToData())===previewOnlyStage,
      '仅拖动预览关键帧使用 sidecar 专用撤销事务，不把播放采样写入项目快照');
    T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();

    const autoActors=T.actors.filter(actor=>!actor.mount&&actor.kind!=='desert');
    if(autoActors.length>=2){
      const firstKey=T.previewActorOwnerKey(autoActors[0]),secondKey=T.previewActorOwnerKey(autoActors[1]),secondScale=autoActors[1].obj.scale.x,depthBeforeAuto=T.undoDepth;
      T.notePreviewEdit(firstKey,['scale']);el('motionAutoKey').click();
      autoActors[1].obj.scale.setScalar(secondScale+.1);T.notePreviewEdit(secondKey,['scale']);autoActors[1].obj.scale.setScalar(secondScale+.2);T.notePreviewEdit(secondKey,['scale']);
      const autoCount=T.finishPreviewEdit(secondKey);flushTimeouts();
      assert(autoCount===1&&T.undoDepth===depthBeforeAuto+1,
        'Auto Key 一次完整操作只生成一个软分组和一次撤销记录，其他手动待提交属性不会阻塞事务');
      el('motionAutoKey').click();autoActors[1].obj.scale.setScalar(secondScale);T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();

      const sameOwner=firstKey,sameActor=autoActors[0],sameScale=sameActor.obj.scale.x,sameElevation=sameActor.elev;
      sameActor.obj.scale.setScalar(sameScale+.1);T.notePreviewEdit(sameOwner,['scale']);el('motionAutoKey').click();
      T.notePreviewEdit(sameOwner,{elevation:sameElevation+1});const sameAutoCount=T.finishPreviewEdit(sameOwner);
      const sameState=T.previewOwnerState(sameOwner),autoElevationKeys=previewChannelKeys(sameState,'elevation'),prematureScaleKeys=previewChannelKeys(sameState,'scale');
      el('motionAutoKey').click();const retainedManualCount=T.commitPendingPreviewKeys('manual',sameOwner);
      assert(sameAutoCount===1&&autoElevationKeys.length===1&&prematureScaleKeys.length===0&&retainedManualCount===1&&previewChannelKeys(sameState,'scale').length===1,
        '同一对象已有手动待提交属性时，后续 Auto 操作只提交本次通道并保留旧手动候选供 K 单独记录');
      sameActor.obj.scale.setScalar(sameScale);sameActor.elev=sameElevation;T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();

      const boundaryActor=T.actors.find(actor=>!actor.mount&&actor.kind!=='desert'),boundarySelection=T.selected,boundaryRandomState=testRandomState;
      if(boundaryActor){
        const boundaryLabel=boundaryActor.label,boundaryScale=boundaryActor.obj.scale.x,scaleInput=el('objScale'),manualScale=Math.max(.2,boundaryScale*.9),firstAutoScale=Math.max(.2,manualScale*.9),secondAutoScale=Math.max(.2,firstAutoScale*.9),boundaryDepth=T.undoDepth;
        T.select(boundaryActor);scaleInput.value=manualScale;scaleInput.oninput({target:scaleInput});el('motionAutoKey').click();
        const manualDepth=T.undoDepth;
        scaleInput.value=firstAutoScale;scaleInput.oninput({target:scaleInput});scaleInput.dispatch('change');
        const firstAutoDepth=T.undoDepth;T.undoLast();
        const afterFirstUndo=T.actors.find(actor=>actor.label===boundaryLabel);
        assert(manualDepth===boundaryDepth+1&&firstAutoDepth===manualDepth+1&&Math.abs(afterFirstUndo.obj.scale.x-manualScale)<1e-9,
          '开启 Auto Key 会先落盘未超过防抖窗口的手动项目修改，撤销首个 Auto 只退回 Auto 操作');
        el('motionAutoKey').click();const restoredAfterFirstUndo=T.actors.find(actor=>actor.label===boundaryLabel);T.select(restoredAfterFirstUndo);T.setActorScaleSafely(restoredAfterFirstUndo,boundaryScale);T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();

        el('motionAutoKey').click();scaleInput.value=firstAutoScale;scaleInput.oninput({target:scaleInput});scaleInput.dispatch('change');const consecutiveDepth=T.undoDepth;
        scaleInput.value=secondAutoScale;scaleInput.oninput({target:scaleInput});scaleInput.dispatch('change');const secondAutoDepth=T.undoDepth;T.undoLast();
        const afterSecondUndo=T.actors.find(actor=>actor.label===boundaryLabel);
        assert(consecutiveDepth===1&&secondAutoDepth===2&&Math.abs(afterSecondUndo.obj.scale.x-firstAutoScale)<1e-9,
          '250ms 内连续完成两次 Auto 调整仍分别形成两个撤销边界，二次撤销仅回到第一次 Auto 结果');
        el('motionAutoKey').click();const restoredAfterSecondUndo=T.actors.find(actor=>actor.label===boundaryLabel);T.setActorScaleSafely(restoredAfterSecondUndo,boundaryScale);T.select(boundarySelection&&T.actors.find(actor=>actor.label===boundarySelection.label)||null);T.restorePreviewAnimationState(integrationSnapshot);T.initHistory();flushTimeouts();testRandomState=boundaryRandomState;
      }else assert(false,'应有可用于 Auto Key 撤销边界验证的未挂载对象');
    }else assert(false,'应有两个对象用于 Auto Key 事务隔离验证');

    const remapSnapshot=clonePreviewSnapshot(T.serializePreviewAnimationState()),sceneIndex=T.sceneIdx;
    const firstOwner=JSON.stringify([sceneIndex,'actor',0]),secondOwner=JSON.stringify([sceneIndex,'actor',1]);
    T.recordPreviewKeyGroup(firstOwner,{scale:1},0,'manual');T.recordPreviewKeyGroup(secondOwner,{scale:2},0,'manual');T.remapPreviewOwnerKeys('actor',0,sceneIndex);
    assert(T.previewOwnerState(firstOwner)?.base?.scale===2&&!T.previewOwnerState(secondOwner),
      '删除索引前的对象后，运行时 owner key 重排且不会把被删动画套到后继对象');
    T.restorePreviewAnimationState(remapSnapshot);
  }
  assert(typeof T.attachScrub==='function'&&String(T.attachScrub).includes("addEventListener('pointercancel'")&&String(T.attachScrub).includes("addEventListener('lostpointercapture'")&&String(T.attachScrub).includes("addEventListener('blur'")&&String(T.attachScrub).includes('setPointerCapture'),
    '数值标签拖拽具备指针捕获、系统取消、捕获丢失与窗口失焦的幂等结束路径');
  T.restorePreviewAnimationState(clonePreviewSnapshot(previewStateBefore));
  const stageAfterPreviewSidecar=JSON.stringify(T.stageToData());
  assert(stageAfterPreviewSidecar===stageBeforePreviewSidecar,
    '预览通道、软分组与其快照始终不进入 stageToData/project v5'+
      (stageAfterPreviewSidecar===stageBeforePreviewSidecar?'':`\n    before=${stageBeforePreviewSidecar}\n    after=${stageAfterPreviewSidecar}`));
}

runManualScrubRegression();
section('速度曲线、轨道联动与摄影机子轨道');
assert(!!el('motionEase')&&!!el('motionCurve')&&!!el('motionLink')&&!!el('motionCopy')&&!!el('motionPaste'),
  '速度预设、贝塞尔曲线、联动和关键帧剪贴板控件存在');
const pasteShot=T.curShot(),pasteSelection=T.motionSelected,pasteTime=T.time;
const pasteSnapshot={
  camPts:pasteShot.camPts,camKeys:pasteShot.camKeys,camTimes:pasteShot.camTimes,camAimTimes:pasteShot.camAimTimes,camFovTimes:pasteShot.camFovTimes,
  camEase:pasteShot.camEase,camAimEase:pasteShot.camAimEase,camFovEase:pasteShot.camFovEase,camMode:pasteShot.camMode,timingMode:pasteShot.timingMode
};
pasteShot.camPts=[new V(0,47,8),new V(8,20,0)];pasteShot.camKeys=[{yaw:17,pitch:-9,fov:61},{yaw:3,pitch:4,fov:39}];
pasteShot.camTimes=[0,pasteShot.dur];pasteShot.camAimTimes=[0,pasteShot.dur];pasteShot.camFovTimes=[0,pasteShot.dur];
pasteShot.camEase=[{type:'linear'}];pasteShot.camAimEase=[{type:'linear'}];pasteShot.camFovEase=[{type:'linear'}];pasteShot.camMode='line';pasteShot.timingMode='custom';
const legacyClipboardSource=pasteShot.camPts[0],legacyClipboardKey=Object.assign({},pasteShot.camKeys[0]),legacyClipboardRefs=new Set(pasteShot.camPts);
T.clearMotionSelection();T.setMotionSelected({type:'camera',label:'',index:0});assert(T.copyMotionKeys(),'legacy camera key 可复制到时间轴剪贴板');
T.setTime(pasteShot.dur/2);const pasteCountBefore=pasteShot.camPts.length;assert(T.pasteMotionKeys(),'legacy >30m camera key 可作为新点粘贴');
const pastedCameraPoint=pasteShot.camPts.find(point=>!legacyClipboardRefs.has(point)),pastedCameraIndex=pasteShot.camPts.indexOf(pastedCameraPoint);
assert(pasteShot.camPts.length===pasteCountBefore+1&&pastedCameraPoint?.y===30&&legacyClipboardSource.y===47,
  'camera key 粘贴只把新增点 47m→30m，历史源点保持47m');
assert(JSON.stringify(pasteShot.camKeys[pastedCameraIndex])===JSON.stringify(legacyClipboardKey)&&
  pasteShot.camAimTimes[pastedCameraIndex]===pasteShot.camTimes[pastedCameraIndex]&&pasteShot.camFovTimes[pastedCameraIndex]===pasteShot.camTimes[pastedCameraIndex],
  'camera key 粘贴保持 yaw/pitch/FOV 与三套关键帧时间对齐');
legacyClipboardSource.y=Infinity;T.clearMotionSelection();T.setMotionSelected({type:'camera',label:'',index:0});assert(T.copyMotionKeys(),'非有限 legacy camera key 可被只读复制');
legacyClipboardSource.y=47;const invalidPasteBefore=JSON.stringify({
  points:pasteShot.camPts.map(point=>point.toArray()),keys:pasteShot.camKeys,times:pasteShot.camTimes,aim:pasteShot.camAimTimes,fov:pasteShot.camFovTimes
});
assert(T.pasteMotionKeys()===false&&JSON.stringify({
  points:pasteShot.camPts.map(point=>point.toArray()),keys:pasteShot.camKeys,times:pasteShot.camTimes,aim:pasteShot.camAimTimes,fov:pasteShot.camFovTimes
})===invalidPasteBefore,'camera clipboard 含 Infinity 时原子拒绝且不污染镜头');
pasteShot.camPts=pasteSnapshot.camPts;pasteShot.camKeys=pasteSnapshot.camKeys;pasteShot.camTimes=pasteSnapshot.camTimes;pasteShot.camAimTimes=pasteSnapshot.camAimTimes;pasteShot.camFovTimes=pasteSnapshot.camFovTimes;
pasteShot.camEase=pasteSnapshot.camEase;pasteShot.camAimEase=pasteSnapshot.camAimEase;pasteShot.camFovEase=pasteSnapshot.camFovEase;pasteShot.camMode=pasteSnapshot.camMode;pasteShot.timingMode=pasteSnapshot.timingMode;
T.clearMotionSelection();T.setMotionSelected(pasteSelection);T.setTime(pasteTime);T.initHistory();flushTimeouts();T.rebuildViz();T.updateShotCam();
assert(Math.abs(T.applyEaseSpec({type:'easeIn'},.5)-.25)<1e-6&&Math.abs(T.applyEaseSpec({type:'easeOut'},.5)-.75)<1e-6&&Math.abs(T.applyEaseSpec({type:'easeInOut'},.5)-.5)<1e-6,
  '缓入、缓出、缓入缓出预设产生正确时间进度');
assert(Math.abs(T.cubicBezierEase(0,{x1:.2,y1:.1,x2:.8,y2:.9}))<1e-4&&Math.abs(T.cubicBezierEase(1,{x1:.2,y1:.1,x2:.8,y2:.9})-1)<1e-4,
  '自定义贝塞尔速度曲线保持 0/1 端点');
const curve=el('motionCurve'),curveTrack=T.motionTrack('camera',''),curveSegment=0,curveSelection=T.motionSelected,curveEaseBefore=JSON.parse(JSON.stringify(curveTrack.ease));
const curvePoint=(x,y,pointerId)=>({pointerId,button:0,isPrimary:true,clientX:(16+x*(curve.width-32))/curve.width*curve.clientWidth,clientY:(16+(1-y)*(curve.height-32))/curve.height*curve.clientHeight});
curveTrack.ease[curveSegment]={type:'linear'};T.setMotionSelected({type:'camera',label:'',index:curveSegment});T.initHistory();flushTimeouts();
const presetWrites=sandbox.localStorage._writes;
curve.dispatch('pointerdown',curvePoint(.33,0,601));fireWindow('pointerup',{pointerId:601});flushTimeouts();
assert(curveTrack.ease[curveSegment].type==='custom'&&T.undoDepth===1&&sandbox.localStorage._writes===presetWrites+1,
  'preset 控制点按下即转为 custom，并在匹配 pointerup 时只形成一次 history/autosave 提交');
T.initHistory();flushTimeouts();const noOpDepth=T.undoDepth,noOpWrites=sandbox.localStorage._writes;
curve.dispatch('pointerdown',curvePoint(.33,0,602));fireWindow('pointerup',{pointerId:602});flushTimeouts();
assert(T.undoDepth===noOpDepth&&sandbox.localStorage._writes===noOpWrites,
  '原本 custom 且没有 move 的曲线会话是 no-op，不污染 history 或 autosave');
T.initHistory();const primaryBefore=JSON.stringify(curveTrack.ease[curveSegment]),otherTrack=T.motionTrack('cameraAim',''),otherSegment=0,curveOtherBefore=JSON.stringify(otherTrack.ease[otherSegment]);
curve.dispatch('pointerdown',curvePoint(.33,0,603));
fireWindow('pointermove',curvePoint(.7,.25,604));fireWindow('pointerup',{pointerId:604});
assert(JSON.stringify(curveTrack.ease[curveSegment])===primaryBefore&&T.undoDepth===0&&curve.style.cursor==='grabbing',
  '错误 pointer 的 move/up 不改值、不提交且不结束第一根指针的曲线会话');
T.setMotionSelected({type:'cameraAim',label:'',index:otherSegment});fireWindow('pointermove',curvePoint(.55,.35,603));
assert(JSON.stringify(curveTrack.ease[curveSegment])!==primaryBefore&&JSON.stringify(otherTrack.ease[otherSegment])===curveOtherBefore,
  '曲线会话绑定启动轨道和段，中途切换选中轨道不会把后续值写入新轨道');
curve.dispatch('lostpointercapture',{pointerId:604});assert(curve.style.cursor==='grabbing'&&T.undoDepth===0,
  '错误 pointer 的 lostpointercapture 不结束活动会话');
curve.dispatch('lostpointercapture',{pointerId:603});const lostValue=JSON.stringify(curveTrack.ease[curveSegment]);
fireWindow('pointermove',curvePoint(.9,.9,603));curve.dispatch('pointerup',{pointerId:603});flushTimeouts();
assert(JSON.stringify(curveTrack.ease[curveSegment])===lostValue&&curve.style.cursor!=='grabbing'&&T.undoDepth===1,
  '匹配 lostpointercapture 提交最后安全值，后续 hover 与乱序结束不再写入且清理 cursor/history');
T.setMotionSelected({type:'camera',label:'',index:curveSegment});T.initHistory();curve.releasePointerCapture=()=>{throw new Error('synthetic release failure')};
curve.dispatch('pointerdown',curvePoint(curveTrack.ease[curveSegment].x1,curveTrack.ease[curveSegment].y1,605));fireWindow('pointermove',curvePoint(.25,.65,605));fireWindow('blur',{});fireWindow('pointercancel',{pointerId:605});flushTimeouts();
const blurValue=JSON.stringify(curveTrack.ease[curveSegment]);curve.releasePointerCapture=noop;
curve.dispatch('pointerdown',curvePoint(curveTrack.ease[curveSegment].x1,curveTrack.ease[curveSegment].y1,606));fireWindow('pointermove',curvePoint(.2,.45,606));fireWindow('pointerup',{pointerId:606});flushTimeouts();
assert(JSON.stringify(curveTrack.ease[curveSegment])!==blurValue&&T.undoDepth===2&&curve.style.cursor!=='grabbing',
  'blur 在 release 失败时仍幂等收尾，恢复后可立即再次拖动并形成独立历史边界');
T.initHistory();curve.isConnected=false;curve.dispatch('pointerdown',curvePoint(curveTrack.ease[curveSegment].x1,curveTrack.ease[curveSegment].y1,607));fireWindow('pointermove',curvePoint(.4,.4,607));curve.isConnected=true;
curve.dispatch('pointerdown',curvePoint(curveTrack.ease[curveSegment].x1,curveTrack.ease[curveSegment].y1,608));fireWindow('pointermove',curvePoint(.3,.3,608));fireWindow('pointerup',{pointerId:608});flushTimeouts();
assert(T.undoDepth===1&&curve.style.cursor!=='grabbing','曲线组件移除会安全结束会话，重新连接后可立即再次拖动');
curveTrack.ease.splice(0,curveTrack.ease.length,...curveEaseBefore);T.setMotionSelected(curveSelection);T.initHistory();flushTimeouts();
const easeState=T.timedPathState(timingPts,[0,2,4],1,[{type:'easeIn'},{type:'linear'}]);
assert(Math.abs(easeState.u-.125)<1e-6&&Math.abs(easeState.raw-.5)<1e-6,'分段缓动只改变段内速度，不改变节点到达时间');
const subShot=T.curShot(),subOld={pts:subShot.camPts,keys:subShot.camKeys,aim:subShot.camAimTimes,fov:subShot.camFovTimes,ae:subShot.camAimEase,fe:subShot.camFovEase};
subShot.camKeys=[{yaw:0,pitch:0,fov:40},{yaw:100,pitch:20,fov:80}];subShot.camPts=[new V(0,2,0),new V(1,2,0)];subShot.camAimTimes=[0,subShot.dur];subShot.camFovTimes=[0,subShot.dur];subShot.camAimEase=[{type:'easeIn'}];subShot.camFovEase=[{type:'easeOut'}];
const subSample=T.sampleTimedCameraKey(subShot,subShot.dur/2);
assert(Math.abs(subSample.yaw-25)<.01&&Math.abs(subSample.pitch-5)<.01&&Math.abs(subSample.fov-70)<.01,'摄影机朝向与焦距子轨道按各自速度曲线独立采样');
assert(T.motionTrack('cameraAim','').times===subShot.camAimTimes&&T.motionTrack('cameraFov','').times===subShot.camFovTimes,'摄影机朝向与焦距作为独立可编辑子轨道');
subShot.camPts=subOld.pts;subShot.camKeys=subOld.keys;subShot.camAimTimes=subOld.aim;subShot.camFovTimes=subOld.fov;subShot.camAimEase=subOld.ae;subShot.camFovEase=subOld.fe;
const linkActor={pathPts:timingPts.map(p=>p.clone()),pathTimes:[0,2,4],timeLink:'cameraFollow',timeOffset:.5,timeLinkShot:T.shotIdx};
T.applyActorTimeLink(linkActor);
assert(linkActor.pathTimes.length===3&&linkActor.pathTimes[0]>=0&&linkActor.pathTimes[2]<=T.shots.reduce((n,s)=>n+s.dur,0),'不同节点数可通过跟随模式映射到摄影机活动时间并应用延迟');
const phaseData=T.stageToData();
assert(phaseData.shots.every(s=>Array.isArray(s.camEase)&&Array.isArray(s.camAimTimes)&&Array.isArray(s.camFovTimes))&&phaseData.actors.every(a=>Array.isArray(a.pathEase)&&typeof a.timeLink==='string'),
  '速度曲线、摄影机子轨道与对象联动配置完整写入项目数据');
flushTimeouts();
const deleteShot=T.curShot(),deleteTime=T.time,deleteSelected=T.selected;
const deleteShotSnapshot={
  timingMode:deleteShot.timingMode,syncActor:deleteShot.syncActor,
  camPts:deleteShot.camPts,camKeys:deleteShot.camKeys,camTimes:deleteShot.camTimes,camAimTimes:deleteShot.camAimTimes,camFovTimes:deleteShot.camFovTimes,
  camEase:deleteShot.camEase,camAimEase:deleteShot.camAimEase,camFovEase:deleteShot.camFovEase
};
const deleteActorSnapshots=T.actors.map(actor=>({actor,timeLink:actor.timeLink,timeLinkShot:actor.timeLinkShot,timeOffset:actor.timeOffset,pathTimes:actor.pathTimes}));
deleteShot.lock='手动朝向';deleteShot.fov=35;deleteShot.timingMode='custom';deleteShot.syncActor='';
deleteShot.camPts=[new V(-2,2,4)];deleteShot.camKeys=[{yaw:0,pitch:0,fov:35}];
deleteShot.camTimes=[0];deleteShot.camAimTimes=[0];deleteShot.camFovTimes=[0];
deleteShot.camEase=[];deleteShot.camAimEase=[];deleteShot.camFovEase=[];
T.actors.forEach(actor=>{actor.timeLink='independent';});
T.clearTimelineCameraPositionSelection(true);T.clearPointPreview();T.setSelCamPt(0);T.setTime(0);T.updateShotCam();T.refreshMotionTimeline();flushTimeouts();T.initHistory();
T.setTime(5);T.clearPointPreview();T.updateShotCam();
const deterministicBefore={
  stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),key0:JSON.stringify({point:deleteShot.camPts[0].toArray(),key:deleteShot.camKeys[0]}),
  undo:T.undoDepth,history:T.historyCommitSequence,pending:T.historyPending,dirty:T.dirtyTimer,writes:sandbox.localStorage._writes
};
const deterministicViewState={position:T.viewCam.position.clone(),quaternion:T.viewCam.quaternion.clone(),fov:T.viewCam.fov,zoom:T.viewCam.zoom};
T.rebuildViz();const deterministicHandle=T.camHandles.find(handle=>handle.userData.idx===0&&handle.userData.hitTargetOnly),deterministicCanvas=el('gl');
T.viewCam.position.copy(deleteShot.camPts[0]).add(new V(0,0,10));T.viewCam.lookAt(deleteShot.camPts[0]);T.viewCam.updateMatrixWorld(true);
deterministicHandle?.updateMatrixWorld(true);
deterministicCanvas.dispatch('pointerdown',{button:0,pointerId:711,clientX:deterministicCanvas.clientWidth/2,clientY:deterministicCanvas.clientHeight/2,shiftKey:false});
const viewportDraftStarted=!!T.currentUnifiedCameraDraftPose()&&JSON.stringify({point:deleteShot.camPts[0].toArray(),key:deleteShot.camKeys[0]})===deterministicBefore.key0;
deterministicCanvas.dispatch('pointermove',{buttons:1,pointerId:711,clientX:deterministicCanvas.clientWidth/2,clientY:deterministicCanvas.clientHeight/2,movementX:0,movementY:-100,altKey:true});
const viewportDraftMoved=T.currentUnifiedCameraDraftPose()?.position.y>deleteShot.camPts[0].y&&
  JSON.stringify({point:deleteShot.camPts[0].toArray(),key:deleteShot.camKeys[0]})===deterministicBefore.key0;
deterministicCanvas.dispatch('pointerup',{pointerId:711});
T.viewCam.position.copy(deterministicViewState.position);T.viewCam.quaternion.copy(deterministicViewState.quaternion);T.viewCam.fov=deterministicViewState.fov;T.viewCam.zoom=deterministicViewState.zoom;T.viewCam.updateProjectionMatrix();T.viewCam.updateMatrixWorld(true);
const deterministicDraft=T.currentUnifiedCameraDraftPose();
T.updateUnifiedCameraDraft({'position.x':-13.28,'position.z':29.4,yaw:28,pitch:-12});
el('camPtY').oninput({target:{value:'14.9'}});el('fov').oninput({target:{value:'62'}});
const deterministicDraftPose=T.currentUnifiedCameraDraftPose();
assert(!!deterministicDraft&&viewportDraftStarted&&viewportDraftMoved&&deterministicDraftPose?.position.distanceTo(new V(-13.28,14.9,29.4))<1e-9&&
  JSON.stringify(T.stageToData())===deterministicBefore.stage&&JSON.stringify(T.project)===deterministicBefore.project&&
  JSON.stringify({point:deleteShot.camPts[0].toArray(),key:deleteShot.camKeys[0]})===deterministicBefore.key0&&
  T.undoDepth===deterministicBefore.undo&&T.historyCommitSequence===deterministicBefore.history&&!T.historyPending&&
  T.dirtyTimer===deterministicBefore.dirty&&sandbox.localStorage._writes===deterministicBefore.writes,
  'AutoKey off 在非关键帧 5s 通过 viewport/inspector 调整 far/high 只写瞬时 camera draft，key0/project/history/autosave 零写');
const deterministicRecord=T.recordUnifiedCameraKeyframe('manual');flushTimeouts();
const deterministicEnd0=deleteShot.camPts[0].clone(),deterministicEnd1=deleteShot.camPts[1].clone(),deterministicPathLength=deterministicEnd0.distanceTo(deterministicEnd1);
T.clearPointPreview();T.setTime(2.5);T.updateShotCam();const deterministicMid=T.shotCam.position.clone();
assert(deterministicRecord.ok&&!deterministicRecord.updated&&deleteShot.camPts.length===2&&deterministicPathLength>0&&
  JSON.stringify(deleteShot.camTimes)==='[0,5]'&&JSON.stringify(deleteShot.camAimTimes)==='[0,5]'&&JSON.stringify(deleteShot.camFovTimes)==='[0,5]'&&
  deterministicMid.distanceTo(deterministicEnd0)>1e-6&&deterministicMid.distanceTo(deterministicEnd1)>1e-6&&
  T.undoDepth===deterministicBefore.undo+1&&T.historyCommitSequence===deterministicBefore.history+1&&sandbox.localStorage._writes===deterministicBefore.writes+1,
  '记录 camera draft 后形成两个不同位置、三组 [0,5]、非零路径与有效 2.5s 插值，并只提交一次 history/autosave');

T.setTime(5);T.clearPointPreview();T.updateShotCam();T.shotCam.position.set(-10,12,25);T.shotCam.rotation.set(-.1,.3,0);T.shotCam.fov=58;
const overwriteCount=deleteShot.camPts.length,deterministicOverwrite=T.recordUnifiedCameraKeyframe('manual');flushTimeouts();
assert(deterministicOverwrite.ok&&deterministicOverwrite.updated&&deleteShot.camPts.length===overwriteCount&&deleteShot.camPts[1].distanceTo(new V(-10,12,25))<1e-9&&
  deleteShot.camKeys[1].fov===58&&JSON.stringify(deleteShot.camTimes)==='[0,5]'&&
  JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camAimTimes)&&JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camFovTimes),
  '同时间 record 原子覆盖完整 pose，不产生重复时间或 position/aim/FOV 分叉');

if(!T.previewAutoKey)el('motionAutoKey').click();
T.clearPointPreview();T.setSelCamPt(1);T.setTime(2.5);T.updateShotCam();const autoDraftHeight=T.shotCam.position.y+2;
el('camPtY').oninput({target:{value:String(autoDraftHeight)}});el('camPtY').dispatch('change');flushTimeouts();
assert(deleteShot.camPts.length===3&&deleteShot.camTimes.some(value=>Math.abs(value-2.5)<1e-9)&&
  JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camAimTimes)&&JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camFovTimes)&&
  !T.currentUnifiedCameraDraftPose(),
  'AutoKey on 在非关键帧调整结束时自动提交当前完整摄影机 pose');
if(T.previewAutoKey)el('motionAutoKey').click();

T.clearPointPreview();T.setTime(1.25);T.updateShotCam();flushTimeouts();T.initHistory();
const draftCancelBefore={stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),history:T.historyCommitSequence,undo:T.undoDepth,dirty:T.dirtyTimer,writes:sandbox.localStorage._writes};
T.beginUnifiedCameraDraft(0);T.updateUnifiedCameraDraft({'position.x':17});T.cancelUnifiedCameraDraft();
const cancelClean=!T.currentUnifiedCameraDraftPose()&&JSON.stringify(T.stageToData())===draftCancelBefore.stage&&JSON.stringify(T.project)===draftCancelBefore.project&&
  T.historyCommitSequence===draftCancelBefore.history&&T.undoDepth===draftCancelBefore.undo&&T.dirtyTimer===draftCancelBefore.dirty&&sandbox.localStorage._writes===draftCancelBefore.writes;
T.setTime(1.25);T.updateShotCam();T.beginUnifiedCameraDraft(0);T.updateUnifiedCameraDraft({'position.x':18});
const originalDraftShotIndex=T.shotIdx,nextDraftShotIndex=T.shots.length>1?(T.shotIdx+1)%T.shots.length:T.shotIdx;
if(nextDraftShotIndex!==originalDraftShotIndex){T.setShot(nextDraftShotIndex,true);T.setShot(originalDraftShotIndex,true);}
const switchClean=!T.currentUnifiedCameraDraftPose();
T.setTime(1.25);T.updateShotCam();T.beginUnifiedCameraDraft(0);T.updateUnifiedCameraDraft({'position.x':19});
const draftCaptureTransaction=T.beginCaptureTransaction('qa-camera-draft');const captureClean=!T.currentUnifiedCameraDraftPose();T.releaseCaptureTransaction(draftCaptureTransaction);
T.setTime(1.25);T.updateShotCam();T.beginUnifiedCameraDraft(0);T.updateUnifiedCameraDraft({'position.x':20});T.undoLast();
const undoClean=!T.currentUnifiedCameraDraftPose();
T.setTime(1.25);T.updateShotCam();T.beginUnifiedCameraDraft(0);T.updateUnifiedCameraDraft({'position.x':21});el('playBtn').click();
const playbackClean=!T.currentUnifiedCameraDraftPose();if(T.playing)el('playBtn').click();
assert(cancelClean&&switchClean&&captureClean&&undoClean&&playbackClean&&JSON.stringify(T.stageToData())===draftCancelBefore.stage&&
  JSON.stringify(T.project)===draftCancelBefore.project&&T.historyCommitSequence===draftCancelBefore.history&&T.undoDepth===draftCancelBefore.undo&&
  sandbox.localStorage._writes===draftCancelBefore.writes,
  '取消、切镜、capture gate、Undo 与播放均清理 transient camera draft，且 project/history/autosave 零写');

deleteShot.timingMode='custom';deleteShot.syncActor='';deleteShot.camPts=[new V(0,2,0),new V(3,2,0)];
deleteShot.camKeys=[{yaw:0,pitch:0,fov:40},{yaw:20,pitch:-5,fov:55}];
deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
deleteShot.camEase=[{type:'easeIn'}];deleteShot.camAimEase=[{type:'easeOut'}];deleteShot.camFovEase=[{type:'linear'}];
T.actors.forEach(actor=>{actor.timeLink='independent';});
T.clearTimelineCameraPositionSelection(true);T.clearPointPreview();T.refreshMotionTimeline();T.initHistory();
T.setTime(deleteShot.dur/2);T.shotCam.position.set(1,3,5);T.shotCam.rotation.x=-.2;T.shotCam.rotation.y=.4;T.shotCam.fov=61;
const unifiedInsert=T.recordUnifiedCameraKeyframe('manual');
assert(unifiedInsert.ok&&!unifiedInsert.updated&&deleteShot.camPts.length===3&&deleteShot.camTimes[1]===deleteShot.dur/2&&
  JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camAimTimes)&&JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camFovTimes)&&
  deleteShot.camKeys[1].fov===61,
  'K/记录主链把完整摄影机位置、朝向、FOV 写入同一 camPts/camKeys/camTimes 索引');
T.shotCam.position.set(2,4,6);T.shotCam.fov=67;
const unifiedUpdate=T.recordUnifiedCameraKeyframe('manual');
assert(unifiedUpdate.ok&&unifiedUpdate.updated&&deleteShot.camPts.length===3&&deleteShot.camPts[1].x===2&&deleteShot.camKeys[1].fov===67,
  '重复时间记录原位更新完整摄影机姿态，不堆叠重复关键帧');
const unifiedClear=T.clearUnifiedCameraAnimation();
assert(unifiedClear.ok&&deleteShot.camPts.length===1&&deleteShot.camKeys.length===1&&
  JSON.stringify(deleteShot.camTimes)==='[0]'&&JSON.stringify(deleteShot.camAimTimes)==='[0]'&&JSON.stringify(deleteShot.camFovTimes)==='[0]',
  '清除摄影机动画只保留 0.0 秒基础机位');
deleteShot.camPts=[new V(0,2,0),new V(3,2,0)];deleteShot.camKeys=[{yaw:0,pitch:0,fov:40},{yaw:20,pitch:-5,fov:55}];
deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
deleteShot.camEase=[{type:'easeIn'}];deleteShot.camAimEase=[{type:'easeOut'}];deleteShot.camFovEase=[{type:'linear'}];T.setTime(0);T.updateShotCam();T.refreshMotionTimeline();T.initHistory();
const cameraPositionKeys=()=>{
  const row=el('motionRows').children.find(child=>child.dataset?.legacy==='true'&&child.dataset?.type==='camera');
  if(row)row.classList.add('motion-row');
  return (row?.children?.[1]?.children||[]).filter(child=>child.dataset?.role==='key');
};
let positionKeys=cameraPositionKeys();
assert(positionKeys.length===2&&positionKeys.every(key=>key.tagName==='BUTTON')&&
  positionKeys[0].dataset.foundation==='true'&&positionKeys[0].getAttribute('aria-label')?.includes('基础机位')&&positionKeys[1].getAttribute('aria-label')?.includes('摄影机位置点'),
  '统一摄影机 keys 可聚焦，0.0 秒基础机位有清楚标识');
const cameraPositionRow=el('motionRows').children.find(child=>child.dataset?.legacy==='true'&&child.dataset?.type==='camera');
const positionSegments=(cameraPositionRow?.children?.[1]?.children||[]).filter(child=>dynamicHasClass(child,'motion-segment'));
assert(positionSegments.length===positionKeys.length-1&&positionSegments[0].tagName==='SPAN'&&positionSegments[0].getAttribute('aria-hidden')==='true'&&
  positionSegments[0].getAttribute('tabindex')===null&&positionSegments[0].dataset.ease===T.normalizeEaseSpec(deleteShot.camEase[0]).type&&
  html.includes('.motion-segment')&&html.includes('pointer-events:none'),
  '相邻关键帧派生 NLE 区间条与 ease 一一对应，区间条不可聚焦且不接管点击命中');
deleteShot.camAimTimes=[0,.01];deleteShot.camFovTimes=[0,.01];T.refreshMotionTimeline();positionKeys=cameraPositionKeys();
el('motionRows').dispatch('pointerdown',makeEvent({target:positionKeys[1],pointerId:700,clientX:180,button:0}));
fireWindow('pointermove',{pointerId:700,clientX:120});fireWindow('pointerup',{pointerId:700,clientX:120});flushTimeouts();
assert(deleteShot.camTimes[1]<deleteShot.dur&&JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camAimTimes)&&
  JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camFovTimes),
  '拖动统一摄影机关键帧会原子同步 position/aim/FOV 三组时间，并修复既有分叉');
deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];T.clearTimelineCameraPositionSelection(true);T.refreshMotionTimeline();T.initHistory();
deleteShot.timingMode='pointSync';T.initHistory();
const clickOnlyBefore={history:T.historyCommitSequence,pending:T.historyPending,dirty:T.dirtyTimer,writes:sandbox.localStorage._writes};
el('motionRows').dispatch('pointerdown',makeEvent({target:positionKeys[0],pointerId:701,clientX:100,button:0}));
fireWindow('pointermove',{pointerId:701,clientX:101});
fireWindow('pointerup',{pointerId:701,clientX:101});
assert(deleteShot.timingMode==='pointSync'&&!T.historyPending&&T.dirtyTimer===clickOnlyBefore.dirty&&
  T.historyCommitSequence===clickOnlyBefore.history&&sandbox.localStorage._writes===clickOnlyBefore.writes,
  'Position 纯点击及 1px 抖动只建立选择，不改 timingMode、不排队 history/autosave');
deleteShot.timingMode='custom';T.clearTimelineCameraPositionSelection(true);T.initHistory();T.refreshMotionTimeline();
const positionTrack=T.motionTrack('camera','');
T.setTimelineCameraPositionSelection(positionTrack,0,false);T.setTimelineCameraPositionSelection(positionTrack,1,true);T.refreshMotionTimeline();
assert(JSON.stringify(T.currentCameraPositionCommandIndices())==='[0,1]'&&cameraPositionKeys().every(key=>key.getAttribute('aria-pressed')==='true'),
  'Position 选择模型建立当前场景/当前镜头同轨多选及 aria-pressed 反馈');

T.clearTimelineCameraPositionSelection(true);T.refreshMotionTimeline();T.initHistory();positionKeys=cameraPositionKeys();
const snapFeedbackGuide=el('motionSnapGuide'),snapFeedbackKey=positionKeys[1];
const snapFeedbackStartX=700,snapFeedbackPointerWidth=800,
  snapFeedbackX=rawTime=>snapFeedbackStartX+(rawTime-deleteShot.dur)/T.motionTimelineDuration()*snapFeedbackPointerWidth;
el('motionRows').dispatch('pointerdown',makeEvent({target:snapFeedbackKey,pointerId:704,clientX:snapFeedbackStartX,button:0}));
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.44)});
const snappedEventDetails={status:el('motionStatus').textContent,hidden:snapFeedbackGuide.hidden,highlight:dynamicHasClass(snapFeedbackKey,'motion-snapped'),time:deleteShot.camTimes[1]},
  snappedEventState=snappedEventDetails.status.includes('1.5s')&&snappedEventDetails.status.includes('已吸附')&&
  snappedEventDetails.hidden===false&&snappedEventDetails.highlight;
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.3)});
const unsnappedEventState=!el('motionStatus').textContent.includes('已吸附')&&snapFeedbackGuide.hidden===true&&!dynamicHasClass(snapFeedbackKey,'motion-snapped');
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.44)});
const resnappedEventDetails={status:el('motionStatus').textContent,hidden:snapFeedbackGuide.hidden,highlight:dynamicHasClass(snapFeedbackKey,'motion-snapped'),time:deleteShot.camTimes[1]},
  resnappedEventState=resnappedEventDetails.status.includes('已吸附')&&resnappedEventDetails.hidden===false&&resnappedEventDetails.highlight;
const unrelatedMotionStatus='unrelated motion status sentinel';el('motionStatus').textContent=unrelatedMotionStatus;
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.3)});
const unsnappedRealtimeStatus=el('motionStatus').textContent.includes('1.300')&&snapFeedbackGuide.hidden===true&&!dynamicHasClass(snapFeedbackKey,'motion-snapped');
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.44)});
fireWindow('pointermove',{pointerId:704,clientX:snapFeedbackX(1.44),altKey:true});
const optionBypassEventState=Math.abs(deleteShot.camTimes[1]-1.44)<1e-9&&el('motionStatus').textContent.includes('1.440')&&!el('motionStatus').textContent.includes('已吸附')&&
  snapFeedbackGuide.hidden===true&&!dynamicHasClass(snapFeedbackKey,'motion-snapped');
fireWindow('pointerup',{pointerId:704,clientX:snapFeedbackX(1.44),altKey:true});flushTimeouts();
assert(snappedEventState&&unsnappedEventState&&resnappedEventState&&unsnappedRealtimeStatus&&optionBypassEventState&&!el('motionStatus').textContent.includes('已吸附'),
  `真实 pointer 事件在 snap→unsnap 与 Option 连续旁路时同步清除 guide/高亮/吸附状态，并实时显示未吸附时间 (snap=${JSON.stringify(snappedEventDetails)}, unsnap=${unsnappedEventState}, resnap=${JSON.stringify(resnappedEventDetails)}, realtime=${unsnappedRealtimeStatus}, bypass=${optionBypassEventState}, status=${JSON.stringify(el('motionStatus').textContent)}, time=${deleteShot.camTimes[1]})`);

const runLegacySnapCancel=(finish,pointerId)=>{
  deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
  T.clearTimelineCameraPositionSelection(true);T.refreshMotionTimeline();positionKeys=cameraPositionKeys();
  const target=positionKeys[1],liveGuide=el('motionSnapGuide');
  el('motionRows').dispatch('pointerdown',makeEvent({type:'pointerdown',target,pointerId,clientX:snapFeedbackStartX,button:0}));
  fireWindow('pointermove',{type:'pointermove',pointerId,clientX:snapFeedbackX(1.44)});
  const snappedBeforeFinish=Math.abs(deleteShot.camTimes[1]-1.5)<1e-9&&el('motionStatus').textContent.includes('已吸附')&&
    !liveGuide.hidden&&dynamicHasClass(target,'motion-snapped');
  if(finish==='lostpointercapture')el('motionRows').dispatch('lostpointercapture',makeEvent({type:finish,pointerId,clientX:snapFeedbackX(1.44)}));
  else fireWindow(finish,{type:finish,...(finish==='blur'?{}:{pointerId,clientX:snapFeedbackX(1.44)})});
  const guideHidden=el('motionSnapGuide').hidden,highlightCleared=!dynamicHasClass(cameraPositionKeys()[1],'motion-snapped'),
    snapStatusCleared=!el('motionStatus').textContent.includes('已吸附');
  assert(snappedBeforeFinish&&guideHidden&&highlightCleared&&snapStatusCleared,
    `legacy key 先命中 1.5s 后 ${finish} 独立清除 guide/highlight/完成状态 (snappedBeforeFinish=${snappedBeforeFinish}, guideHidden=${guideHidden}, highlightCleared=${highlightCleared}, snapStatusCleared=${snapStatusCleared}, status=${JSON.stringify(el('motionStatus').textContent)}, time=${deleteShot.camTimes[1]})`);
};
['pointercancel','blur','lostpointercapture'].forEach((finish,index)=>runLegacySnapCancel(finish,708+index));

const continuousKeyPixelTolerance=T.motionTimelineDuration()/snapFeedbackPointerWidth,
  runContinuousKeyMove=(pointerId,rawTime,{snapOff=false,altKey=false}={})=>{
    deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
    T.clearTimelineCameraPositionSelection(true);T.refreshMotionTimeline();positionKeys=cameraPositionKeys();
    if(snapOff)motionSnapControl.click();
    el('motionRows').dispatch('pointerdown',makeEvent({target:positionKeys[1],pointerId,clientX:snapFeedbackStartX,button:0,altKey}));
    fireWindow('pointermove',{pointerId,clientX:snapFeedbackX(rawTime),altKey});
    const live={time:deleteShot.camTimes[1],status:el('motionStatus').textContent,tc:el('tc').textContent};
    fireWindow('pointerup',{pointerId,clientX:snapFeedbackX(rawTime),altKey});flushTimeouts();
    if(snapOff)motionSnapControl.click();
    return live;
  },
  manualOffContinuousKey=runContinuousKeyMove(706,1.437,{snapOff:true}),
  optionContinuousKey=runContinuousKeyMove(707,2.043,{altKey:true});
assert(Math.abs(manualOffContinuousKey.time-1.437)<=continuousKeyPixelTolerance&&
  Math.abs(manualOffContinuousKey.time-Math.round(manualOffContinuousKey.time*10)/10)>continuousKeyPixelTolerance&&
  manualOffContinuousKey.status.includes('1.437')&&
  Math.abs(optionContinuousKey.time-2.043)<=continuousKeyPixelTolerance&&
  Math.abs(optionContinuousKey.time-Math.round(optionContinuousKey.time*10)/10)>continuousKeyPixelTolerance&&
  optionContinuousKey.status.includes('2.043'),
  `真实 pointer 关键帧在 snap OFF/Option 下保持连续值并于 pointermove 实时刷新读数 (tol=${continuousKeyPixelTolerance}, off=${JSON.stringify(manualOffContinuousKey)}, option=${JSON.stringify(optionContinuousKey)})`);

deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
T.clearTimelineCameraPositionSelection(true);T.setTimelineCameraPositionSelection(T.motionTrack('camera',''),0,false);T.refreshMotionTimeline();T.initHistory();positionKeys=cameraPositionKeys();
const foundationBoundaryBefore={undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes};
el('motionRows').dispatch('pointerdown',makeEvent({target:positionKeys[1],pointerId:705,clientX:700,button:0,shiftKey:true}));
fireWindow('pointermove',{pointerId:705,clientX:-300});fireWindow('pointerup',{pointerId:705,clientX:-300});flushTimeouts();
const foundationBoundaryTime=deleteShot.camTimes[1];
assert(deleteShot.camTimes[0]===0&&foundationBoundaryTime>=.05&&Math.abs(foundationBoundaryTime-.1)<1e-9&&
  Math.abs(foundationBoundaryTime*10-Math.round(foundationBoundaryTime*10))<1e-9&&
  JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camAimTimes)&&JSON.stringify(deleteShot.camTimes)===JSON.stringify(deleteShot.camFovTimes)&&
  T.undoDepth===foundationBoundaryBefore.undo+1&&T.historyCommitSequence===foundationBoundaryBefore.history+1&&sandbox.localStorage._writes===foundationBoundaryBefore.writes+1,
  `Shift 选择 [0,1] 后把第二摄影机 key 拖到最左，静止 foundation 仍作为 min-gap 边界，三套时间一致且成功事务仅一次 (times=${JSON.stringify(deleteShot.camTimes)}/${JSON.stringify(deleteShot.camAimTimes)}/${JSON.stringify(deleteShot.camFovTimes)}, undo=${T.undoDepth-foundationBoundaryBefore.undo}, history=${T.historyCommitSequence-foundationBoundaryBefore.history}, writes=${sandbox.localStorage._writes-foundationBoundaryBefore.writes})`);

deleteShot.camTimes=[0,deleteShot.dur];deleteShot.camAimTimes=[0,deleteShot.dur];deleteShot.camFovTimes=[0,deleteShot.dur];
T.clearTimelineCameraPositionSelection(true);T.setTimelineCameraPositionSelection(T.motionTrack('camera',''),0,false);T.setTimelineCameraPositionSelection(T.motionTrack('camera',''),1,true);T.refreshMotionTimeline();T.initHistory();
const rejectedDeleteBefore={
  stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),actors:T.actors.slice(),undo:T.undoDepth,
  history:T.historyCommitSequence,pending:T.historyPending,dirty:T.dirtyTimer,writes:sandbox.localStorage._writes
};
const rejectedDelete=T.routeTimelineDeleteCommand();
assert(rejectedDelete.owned&&!rejectedDelete.ok&&rejectedDelete.reason==='foundationFrame'&&
  JSON.stringify(T.stageToData())===rejectedDeleteBefore.stage&&JSON.stringify(T.project)===rejectedDeleteBefore.project&&
  T.actors.length===rejectedDeleteBefore.actors.length&&T.actors.every((actor,index)=>actor===rejectedDeleteBefore.actors[index])&&
  T.undoDepth===rejectedDeleteBefore.undo&&T.historyCommitSequence===rejectedDeleteBefore.history&&T.historyPending===rejectedDeleteBefore.pending&&
  T.dirtyTimer===rejectedDeleteBefore.dirty&&sandbox.localStorage._writes===rejectedDeleteBefore.writes,
  '基础机位拒绝删除会消费命令所有权，但 project/演员/history/autosave 零写入');
T.select(T.actors[0]);
assert(T.currentCameraPositionCommandIndices().length===0,'切换到画布演员域会清除 Position 删除所有权');
const actorCountBeforeUnownedDelete=T.actors.length,unownedDelete=T.routeTimelineDeleteCommand();
assert(unownedDelete.owned&&!unownedDelete.ok&&T.actors.length===actorCountBeforeUnownedDelete,
  '无摄影机关键帧选择时 Delete 仍由统一路由消费，绝不 fallback 删除演员');
const actorMotionOwner=T.actors.find(actor=>Array.isArray(actor.pathPts)&&actor.pathPts.length>1);
if(actorMotionOwner){
  flushTimeouts();T.select(actorMotionOwner);T.refreshMotionTimeline();T.initHistory();
  const actorMotionKeys=()=>{const row=Array.from(el('motionRows').children||[]).find(child=>child.dataset?.legacy==='true'&&child.dataset?.type==='actor'&&child.dataset?.label===actorMotionOwner.label);if(row)row.classList.add('motion-row');return (row?.children?.[1]?.children||[]).filter(child=>child.dataset?.role==='key');};
  let actorKeys=actorMotionKeys();
  el('motionRows').dispatch('pointerdown',makeEvent({target:actorKeys[0],pointerId:702,clientX:100,button:0}));
  const actorSelectionAfterFirstDown=T.motionSelectionIds;fireWindow('pointerup',{pointerId:702,clientX:100});
  const actorSelectionAfterFirstUp=T.motionSelectionIds;actorKeys=actorMotionKeys();
  const actorSecondIndex=actorKeys[1]?.dataset?.index;
  el('motionRows').dispatch('pointerdown',makeEvent({target:actorKeys[1],pointerId:703,clientX:120,button:0,shiftKey:true}));
  fireWindow('pointerup',{pointerId:703,clientX:120});actorKeys=actorMotionKeys();
  assert(T.motionSelectionIds.filter(id=>id.startsWith(`actor|${actorMotionOwner.label}|`)).length===2&&
    dynamicHasClass(actorKeys[0],'sel')&&dynamicHasClass(actorKeys[1],'sel'),
    `actor legacy key 的既有 Shift 多选不被画布 select 清空 (down=${JSON.stringify(actorSelectionAfterFirstDown)}, up=${JSON.stringify(actorSelectionAfterFirstUp)}, second=${actorSecondIndex}, final=${JSON.stringify(T.motionSelectionIds)})`);
  assert(!T.historyPending&&T.dirtyTimer===null,
    'actor legacy key 纯选择不写 history/autosave');
}
T.select(T.actors[0]);T.previewCameraPoint(0);T.refreshMotionTimeline();positionKeys=cameraPositionKeys();
assert(T.currentCameraPositionCommandIndices().length===0&&positionKeys.every(key=>key.getAttribute('aria-pressed')==='false'&&!key.classList.contains('sel')),
  '程序化摄影机点预览不伪装成 Position 删除选择，Delete 可安全保留 actor 回退语义');
T.setTimelineCameraPositionSelection(positionTrack,1,false);T.refreshMotionTimeline();
const projectNameBeforeDelete=el('projname').value;el('projname').value=projectNameBeforeDelete+' pending';T.markDirty();
const successfulDeleteBefore={actors:T.actors.slice(),undo:T.undoDepth,history:T.historyCommitSequence,writes:sandbox.localStorage._writes};
const successfulDelete=T.routeTimelineDeleteCommand();
assert(successfulDelete.owned&&successfulDelete.ok&&deleteShot.camPts.length===1&&deleteShot.camKeys.length===1&&
  deleteShot.camTimes.length===1&&deleteShot.camAimTimes.length===1&&deleteShot.camFovTimes.length===1&&
  deleteShot.camEase.length===0&&deleteShot.camAimEase.length===0&&deleteShot.camFovEase.length===0&&
  T.time===0&&!T.playing&&T.previewCamPt===0&&T.actors.length===successfulDeleteBefore.actors.length&&
  T.actors.every((actor,index)=>actor===successfulDeleteBefore.actors[index])&&T.undoDepth===successfulDeleteBefore.undo+1&&
  T.historyCommitSequence===successfulDeleteBefore.history+1&&T.historyPending&&T.dirtyTimer!==null,
  '删除前先结算无关 pending history；删除两点中的第二点后暂停在 0、预览第一点，八组数组一致且不删除演员');
flushTimeouts();
assert(T.undoDepth===successfulDeleteBefore.undo+2&&T.historyCommitSequence===successfulDeleteBefore.history+2&&
  sandbox.localStorage._writes===successfulDeleteBefore.writes+1,
  '成功 Position 删除在既有事务之后单独形成一次 history，并合并为一次待定 autosave');
el('projname').value=projectNameBeforeDelete;
Object.assign(deleteShot,deleteShotSnapshot);
deleteActorSnapshots.forEach(snapshot=>Object.assign(snapshot.actor,{timeLink:snapshot.timeLink,timeLinkShot:snapshot.timeLinkShot,timeOffset:snapshot.timeOffset,pathTimes:snapshot.pathTimes}));
T.clearTimelineCameraPositionSelection(true);T.clearPointPreview();T.setTime(deleteTime);T.select(deleteSelected);T.updateActors();T.updateShotCam();T.syncScene();T.initHistory();T.markDirty();flushTimeouts();T.refreshMotionTimeline();

/* ---- 渲染循环 ---- */
section('渲染循环 + 播放');
function frames(n, dt = 50) {
  for (let i = 0; i < n; i++) {
    nowMs += dt;
    const callbacks = rafQueue;
    rafQueue = [];
    callbacks.forEach(callback => callback(nowMs));
  }
}
function flushTimeouts() { while (timeouts.length) {const item=timeouts.shift();if(!item.canceled)item.fn();} }
const playbackHeightShot=T.curShot(),playbackHeightTime=T.time,playbackHeightSnapshot={
  camPts:playbackHeightShot.camPts,camKeys:playbackHeightShot.camKeys,camTimes:playbackHeightShot.camTimes,camAimTimes:playbackHeightShot.camAimTimes,camFovTimes:playbackHeightShot.camFovTimes,
  camEase:playbackHeightShot.camEase,camAimEase:playbackHeightShot.camAimEase,camFovEase:playbackHeightShot.camFovEase,camMode:playbackHeightShot.camMode,timingMode:playbackHeightShot.timingMode
};
playbackHeightShot.camPts=[new V(0,15,0),new V(10,30,0)];playbackHeightShot.camKeys=[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}];
playbackHeightShot.camTimes=[0,playbackHeightShot.dur];playbackHeightShot.camAimTimes=[0,playbackHeightShot.dur];playbackHeightShot.camFovTimes=[0,playbackHeightShot.dur];
playbackHeightShot.camEase=[{type:'linear'}];playbackHeightShot.camAimEase=[{type:'linear'}];playbackHeightShot.camFovEase=[{type:'linear'}];playbackHeightShot.camMode='line';playbackHeightShot.timingMode='custom';
T.clearPointPreview();T.setTime(playbackHeightShot.dur/2);T.updateShotCam();
assert(Math.abs(T.shotCam.position.y-22.5)<1e-6,'line/custom 路径 15→30m 的播放中点按独立 oracle 到22.5m');
T.setTime(playbackHeightShot.dur);T.updateShotCam();
assert(Math.abs(T.shotCam.position.y-30)<1e-6,'line/custom 路径播放终点保留30m，不回落15m');
const playbackPreviewTime=playbackHeightShot.dur*.37;T.setTime(playbackPreviewTime);T.previewCameraPoint(1);
assert(Math.abs(T.shotCam.position.y-30)<1e-6&&T.time===playbackPreviewTime,'30m 末点独立预览精确保留高度且不跳时间');
T.clearPointPreview();playbackHeightShot.camPts=playbackHeightSnapshot.camPts;playbackHeightShot.camKeys=playbackHeightSnapshot.camKeys;
playbackHeightShot.camTimes=playbackHeightSnapshot.camTimes;playbackHeightShot.camAimTimes=playbackHeightSnapshot.camAimTimes;playbackHeightShot.camFovTimes=playbackHeightSnapshot.camFovTimes;
playbackHeightShot.camEase=playbackHeightSnapshot.camEase;playbackHeightShot.camAimEase=playbackHeightSnapshot.camAimEase;playbackHeightShot.camFovEase=playbackHeightSnapshot.camFovEase;
playbackHeightShot.camMode=playbackHeightSnapshot.camMode;playbackHeightShot.timingMode=playbackHeightSnapshot.timingMode;T.setTime(playbackHeightTime);T.updateShotCam();
el('speed').value = '1.0x';
el('aspect').value = '16:9';   // 真实 select 默认 16:9, 假元素需手动给值
if(T.playing)el('playBtn').click();T.setTime(1.38);el('playBtn').click();frames(1);
const continuousPlaybackTime=T.time;if(T.playing)el('playBtn').click();
assert(Math.abs(continuousPlaybackTime-1.43)<1e-9,
  `程序化播放可经过 1.43s，不被手动播放头的 0.1s 量化或整/半秒吸附改写 (time=${continuousPlaybackTime})`);
frames(10);
el('playBtn').click();
frames(10);
assert(T.playing || T.time > 0, '播放后 time 前进 (time=' + T.time + ')');
if (T.playing) fireWindow('keydown', { code: 'Space', key: ' ', target: documentStub.body });
const spacePlay = fireWindow('keydown', { code: 'Space', key: ' ', target: documentStub.body });
frames(2);
assert(spacePlay.defaultPrevented && T.playing, '空格键保留底栏预演的播放入口');
const spacePause = fireWindow('keydown', { code: 'Space', key: ' ', target: documentStub.body });
assert(spacePause.defaultPrevented && !T.playing, '空格键可暂停预演，不依赖已删除的镜头条');
if(T.camDriveMode)el('camDrive').click();
flushTimeouts();T.initHistory();
const followBefore={stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),undo:T.undoDepth,history:T.historyCommitSequence,dirty:T.dirtyTimer,writes:sandbox.localStorage._writes};
const followRenderStart=T.renderer.operations.length,monitorRenderStart=T.pipRenderer.operations.length;
el('camDrive').click();frames(1);
const followMainRenders=T.renderer.operations.slice(followRenderStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene);
const followMonitorRenders=T.pipRenderer.operations.slice(monitorRenderStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene);
assert(T.camDriveMode&&el('camDrive').getAttribute('aria-pressed')==='true'&&el('camDriveLabel').textContent===sandbox.PreVisionI18n.t('toolbar.followCameraActive')&&
  followMainRenders.at(-1)?.camera===T.shotCam&&followMonitorRenders.at(-1)?.camera===T.shotCam,
  'Follow Camera 开启时 aria-pressed/文案可见，主视口与监视器都使用当前 shotCam');
el('camDrive').click();frames(1);
assert(!T.camDriveMode&&el('camDrive').getAttribute('aria-pressed')==='false'&&el('camDriveLabel').textContent===sandbox.PreVisionI18n.t('toolbar.followCamera')&&
  JSON.stringify(T.stageToData())===followBefore.stage&&JSON.stringify(T.project)===followBefore.project&&
  T.undoDepth===followBefore.undo&&T.historyCommitSequence===followBefore.history&&T.dirtyTimer===followBefore.dirty&&sandbox.localStorage._writes===followBefore.writes,
  'Follow Camera 关闭后恢复默认状态，全程不写 project/history/autosave');

const sharedReframeShot=T.curShot(),sharedReframePrevious=JSON.stringify(sharedReframeShot.reframeByAspect);
el('aspect').value='9:16';el('aspect').onchange({target:el('aspect')});flushTimeouts();T.initHistory();
T.setShotReframe(sharedReframeShot,{offsetX:.25,offsetY:-.5,zoom:1.75});T.refreshReframeUI();
const rightPanelStateBeforeReframe=el('appWorkspace').dataset.right;
T.setRightPanelState('expanded');
assert(el('appWorkspace').dataset.right==='expanded'&&!el('reframeEdit').hidden&&!el('reframeEditRight').hidden&&
  el('reframeEdit').getAttribute('aria-pressed')==='false'&&el('reframeEditRight').getAttribute('aria-pressed')==='false'&&
  typeof el('reframeEditRight').onclick==='function'&&!el('monReframeBadge').hidden&&
  el('reframeEdit').textContent===sandbox.PreVisionI18n.t('reframe.edit'),
  '属性与监视器展开时，9:16 显示可点击右侧/toolbar 同命令入口、同步 aria-pressed 与 monitor badge');
const editorRenderStart=T.renderer.operations.length,editorMonitorStart=T.pipRenderer.operations.length;
el('reframeEditRight').click();frames(1);
const editorRender=T.renderer.operations.slice(editorRenderStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene).at(-1);
const editorMonitor=T.pipRenderer.operations.slice(editorMonitorStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene).at(-1);
const editorViewport=T.renderer.operations.slice(editorRenderStart).find(operation=>operation.type==='viewport'&&Math.abs(operation.width-337.5)<1e-6);
assert(T.reframeEditorActive()&&el('reframeEdit').getAttribute('aria-pressed')==='true'&&el('reframeEditRight').getAttribute('aria-pressed')==='true'&&
  documentStub.activeElement===el('gl')&&editorRender?.camera===T.shotCam&&editorMonitor?.camera===T.shotCam&&
  editorRender.cameraState.zoom===1.75&&editorMonitor.cameraState.zoom===1.75&&Math.abs(editorRender.cameraState.view?.offsetX-42.1875)<1e-6&&
  editorViewport&&Math.abs(editorViewport.width-337.5)<1e-6&&editorViewport.height===600,
  '右侧入口一步进入并聚焦主画布，两入口 pressed 同步；编辑导演台与 monitor 使用同一 resolved reframe');
el('reframeEdit').click();const followReframeRenderStart=T.renderer.operations.length;el('camDrive').click();frames(1);
const followReframeRender=T.renderer.operations.slice(followReframeRenderStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene).at(-1);
assert(T.camDriveMode&&followReframeRender?.camera===T.shotCam&&followReframeRender.cameraState.zoom===1.75&&followReframeRender.cameraState.view?.offsetY>0,
  'Follow ON 使用与 monitor/编辑相同的 9:16 构图');
el('camDrive').click();const freeRenderStart=T.renderer.operations.length;frames(1);
const freeRender=T.renderer.operations.slice(freeRenderStart).filter(operation=>operation.type==='render'&&operation.scene===T.scene).at(-1);
assert(!T.camDriveMode&&freeRender?.camera===T.viewCam&&T.shotCam.zoom===1&&(!T.shotCam.view||!T.shotCam.view.enabled),
  'Follow OFF 恢复自由导演视角，shotCam projection 在每帧后完整恢复');
if(sharedReframePrevious===undefined)delete sharedReframeShot.reframeByAspect;
else sharedReframeShot.reframeByAspect=JSON.parse(sharedReframePrevious);
el('aspect').value='16:9';el('aspect').onchange({target:el('aspect')});flushTimeouts();T.initHistory();
T.setRightPanelState(rightPanelStateBeforeReframe);

const shortcutShotBefore=T.shotIdx,shortcutTimeBefore=T.time,shortcutShotIndex=Math.min(1,T.shots.length-1);
T.setShot(shortcutShotIndex,true);T.setTime(Math.min(.25,T.curShot().dur));
const playButton=el('playBtn'),originalPlayButtonClick=playButton.click;
let shortcutPlayButtonCalls=0;
playButton.click=function(...args){shortcutPlayButtonCalls++;return originalPlayButtonClick.apply(this,args);};
const rightSpaceTargets=[
  ['fov','range'],['lockSel','select'],['semanticWidth','number']
];
rightSpaceTargets.forEach(([id,type])=>{
  const target=el(id);target.focus();const playingBefore=T.playing,callsBefore=shortcutPlayButtonCalls;
  const event=fireWindow('keydown',{code:'Space',key:' ',target,repeat:false});
  assert(event.defaultPrevented&&shortcutPlayButtonCalls===callsBefore+1&&T.playing===!playingBefore&&T.shotIdx===shortcutShotIndex,
    `Space 在右栏 ${type} 控件 #${id} 聚焦时调用 playBtn 切换当前镜头`);
});
if(T.playing)originalPlayButtonClick.call(playButton);
const editableSpaceTargets=[
  ['projname',el('projname')],['storyText',el('storyText')],['contenteditable',Object.assign(makeEl('div'),{isContentEditable:true})]
];
const callsBeforeEditableSpace=shortcutPlayButtonCalls;
const editableSpaceEvents=editableSpaceTargets.map(([,target])=>{
  target.focus();return fireWindow('keydown',{code:'Space',key:' ',target,repeat:false});
});
assert(editableSpaceEvents.every(event=>!event.defaultPrevented)&&shortcutPlayButtonCalls===callsBeforeEditableSpace&&!T.playing&&T.shotIdx===shortcutShotIndex,
  'Space 在项目名、剧本 textarea 与 contenteditable 文字编辑态保留原生输入，不触发播放');
const repeatTarget=el('fov');repeatTarget.focus();
const callsBeforeRepeatStart=shortcutPlayButtonCalls;
const repeatStart=fireWindow('keydown',{code:'Space',key:' ',target:repeatTarget,repeat:false});
const playingAfterRepeatStart=T.playing,callsAfterRepeatStart=shortcutPlayButtonCalls;
assert(repeatStart.defaultPrevented&&callsAfterRepeatStart===callsBeforeRepeatStart+1&&playingAfterRepeatStart,
  'Space 首次 keydown 启动当前镜头播放');
const repeatedSpace=fireWindow('keydown',{code:'Space',key:' ',target:repeatTarget,repeat:true});
assert(repeatedSpace.defaultPrevented&&shortcutPlayButtonCalls===callsAfterRepeatStart&&T.playing===playingAfterRepeatStart,
  '长按 Space 的 repeat keydown 不反复切换播放/暂停');
if(T.playing)originalPlayButtonClick.call(playButton);
playButton.click=originalPlayButtonClick;documentStub.activeElement=documentStub.body;
T.setShot(shortcutShotBefore,true);T.setTime(Math.min(shortcutTimeBefore,T.curShot().dur));

const playbackSceneCards = dynamicByClass(el('scenelist'), 'scene-card');
if (playbackSceneCards.length) {
  (playbackSceneCards[T.sceneIdx] || playbackSceneCards[0]).click();
  let playbackShotCards = dynamicByClass(el('scenelist'), 'shot-card');
  assert(playbackShotCards.length === T.shots.length, '播放前左栏镜头层与当前场景镜头数一致');
  if (T.shots.length > 1 && playbackShotCards.length > 1) {
    el('playAll').click();
    T.setTime(T.curShot().dur - .01);
    frames(1);
    playbackShotCards = dynamicByClass(el('scenelist'), 'shot-card');
    const selectedPlaybackShots = playbackShotCards.filter(card => dynamicHasClass(card, 'sel'));
    assert(T.shotIdx === 1, '播放本场景跨过首镜结尾后进入第二镜');
    assert(selectedPlaybackShots.length === 1 && selectedPlaybackShots[0] === playbackShotCards[1],
      '整场播放跨镜时左栏唯一选中当前镜头');
  } else {
    assert(false, '默认场景至少保留两个镜头用于整场跨镜回归');
  }
  if (T.playing) el('playBtn').click();
  T.seekSceneTime(0);
  el('railBack').click();
} else {
  assert(false, '左栏需提供场景卡以验证整场播放的镜头选中同步');
}

section('近景标签: 屏幕尺寸上限 + 显隐开关');
const labelActor = T.actors.find(a => a.kind === 'char');
const labelSprite = labelActor.obj.children.find(c => c.isSprite);
T.viewCam.position.set(0, 2, 3); T.updateLabelScales(T.viewCam); const nearLabelW = labelSprite.scale.x;
T.viewCam.position.set(0, 2, 30); T.updateLabelScales(T.viewCam); const farLabelW = labelSprite.scale.x;
assert(nearLabelW < farLabelW && nearLabelW < 1, '镜头靠近时标签世界尺寸自动缩小，不再遮挡角色');
el('showLabels').checked = false; el('showLabels').onchange({ target: el('showLabels') });
assert(!labelSprite.visible && T.project.settings.labels === false, '标签可一键隐藏并保存设置');
el('showLabels').checked = true; el('showLabels').onchange({ target: el('showLabels') });
assert(labelSprite.visible && T.project.settings.labels === true, '标签显示可恢复');
const renameSceneIndex=T.sceneIdx,renameOriginalLabel=labelActor.label;
const sharedRenameTexture=T.markSharedThreeTexture(new sandbox.THREE.Texture()),sharedRenameMaterial=new sandbox.THREE.SpriteMaterial({map:sharedRenameTexture});
const sharedRenameSprite=new sandbox.THREE.Sprite(sharedRenameMaterial);sharedRenameSprite.userData={isLabel:false};labelActor.obj.add(sharedRenameSprite);
const sharedSpriteGeometry=labelSprite.geometry;let sharedSpriteGeometryDisposals=0;
sharedSpriteGeometry.addEventListener('dispose',()=>sharedSpriteGeometryDisposals++);
let sharedRenameTextureDisposals=0,sharedRenameMaterialDisposals=0;
sharedRenameTexture.addEventListener('dispose',()=>sharedRenameTextureDisposals++);sharedRenameMaterial.addEventListener('dispose',()=>sharedRenameMaterialDisposals++);
const renameDisposals=[labelSprite],renameCounts=[];
const watchLabelDisposal=sprite=>{
  const counts={material:0,texture:0};
  sprite.material.addEventListener('dispose',()=>counts.material++);sprite.material.map.addEventListener('dispose',()=>counts.texture++);
  renameCounts.push(counts);return counts;
};
watchLabelDisposal(labelSprite);
const renameThroughObjectList=nextLabel=>{
  T.refreshObjList();
  const rows=dynamicByClass(el('objlist'),'objitem'),row=rows[T.actors.indexOf(labelActor)];
  sandbox.prompt=()=>nextLabel;row?.ondblclick?.();sandbox.prompt=()=>null;
  return labelActor.obj.children.find(child=>child.isSprite&&child.userData?.isLabel);
};
const renamedLabelOne=renameThroughObjectList('标签生命周期一');renameDisposals.push(renamedLabelOne);watchLabelDisposal(renamedLabelOne);
assert(renameCounts[0].material===1&&renameCounts[0].texture===1&&renamedLabelOne?.visible&&renamedLabelOne.geometry===sharedSpriteGeometry&&
  sharedRenameSprite.parent===labelActor.obj&&sharedRenameSprite.geometry===sharedSpriteGeometry&&sharedSpriteGeometryDisposals===0&&
  sharedRenameTextureDisposals===0&&sharedRenameMaterialDisposals===0,
  '首次重命名释放旧标签 material/CanvasTexture，新标签可见且引擎共享 Sprite geometry/非标签 Sprite 保持完好');
const renamedLabelTwo=renameThroughObjectList('标签生命周期二');renameDisposals.push(renamedLabelTwo);watchLabelDisposal(renamedLabelTwo);
assert(renameCounts[1].material===1&&renameCounts[1].texture===1&&renamedLabelTwo?.visible&&renamedLabelTwo.geometry===sharedSpriteGeometry&&
  sharedRenameSprite.parent===labelActor.obj&&sharedSpriteGeometryDisposals===0&&
  sharedRenameTextureDisposals===0&&sharedRenameMaterialDisposals===0,
  '连续重命名逐次释放上一标签资源，不移除或处置非标签共享资源');
T.clearStage();T.clearStage();
assert(renameCounts.every(count=>count.material===1&&count.texture===1)&&sharedSpriteGeometryDisposals===0&&
  sharedRenameMaterialDisposals===1&&sharedRenameTextureDisposals===0&&
  renameDisposals.every(sprite=>JSON.stringify(T.disposeOwnedObject3D(sprite))===JSON.stringify({geometries:0,materials:0,textures:0})),
  '清场可重入：当前标签只释放一次，历史标签不双重处置，引擎 Sprite geometry/共享贴图仍由各自 owner 保留');
T.loadScene(renameSceneIndex,true);T.refreshObjList();
assert(T.actors.some(actor=>actor.label===renameOriginalLabel)&&T.actors.find(actor=>actor.label===renameOriginalLabel).obj.children.some(child=>child.isSprite&&child.userData?.isLabel&&child.visible),
  '标签生命周期回归后重建场景仍显示当前对象标签');
T.fitAllActors();

/* ---- 程序化人物与道具细节 ---- */
section('程序化人物与道具: 五官方向、材质分层与细节件');
const detailedProp = T.actors.find(a => a.kind === 'prop');
const propParts = detailedProp && detailedProp.obj.userData.propParts;
assert(propParts && propParts.cornerPosts.length === 4 && propParts.braces.length >= 2 && propParts.handles.length === 2,
  '木箱道具具有四角护条、交叉撑和双侧把手');
const detailedCar = T.buildActor({kind:'car',label:'car-detail-test',pos:[-18,-18],rotY:0,path:[]});
const carParts = detailedCar && detailedCar.obj.userData.carParts;
assert(carParts && carParts.grille.position.x > 2 && carParts.mirrors.length === 2 && carParts.tailLights.length === 2,
  '车辆具有车头格栅、双后视镜和尾灯且保持 +X 车头方向');
T.actors.splice(T.actors.indexOf(detailedCar),1);detailedCar.obj.parent?.remove(detailedCar.obj);

/* ---- 语义代理模型库 ---- */
section('语义代理模型库: 类型与尺寸分离 / 多镜头 Seedance 参考目录');
const semanticIds=['adult_male','adult_female','child','dog','suv','tree_a','tree_b','rock','bush','house_block','road'];
assert(Array.isArray(T.SEMANTIC_PROXY_TYPES)&&T.SEMANTIC_PROXY_TYPES.length===11&&semanticIds.every(id=>T.semanticProxyType(id)),
  '运行时内置 11 个语义代理类型');
assert(semanticProxyCatalog.types.length===11&&semanticIds.every(id=>semanticProxyCatalog.types.some(t=>t.id===id))&&
  semanticProxyCatalog.seedanceValidation.shots.length===3,
  'QA 目录记录 11 个类型与三镜头 Seedance 一致性验证场景');
assert(semanticIds.every(id=>{
  const spec=T.semanticProxyType(id),catalog=semanticProxyCatalog.types.find(t=>t.id===id);
  return catalog&&catalog.kind===spec.kind&&catalog.labelKey===spec.labelKey&&catalog.dimensions.height===spec.dimensions.height;
}), 'QA 目录与运行时语义代理定义保持同步');
assert(html.includes('data-i18n="semantic.libraryTitle"')&&html.includes('data-i18n="semantic.addProxy"')&&
  html.includes('data-i18n-aria-label="semantic.widthAria"')&&html.includes('data-i18n="semantic.resetSize"'),
  '语义代理库界面文案与可访问标签使用 language key');
const semanticActors=semanticIds.map((id,i)=>{
  const spec=T.semanticProxyType(id);
  return T.buildActor({kind:spec.kind,semanticType:id,label:`semantic-${id}`,pos:[-26+(i%4)*2.2,22+Math.floor(i/4)*2.2],rotY:0,path:[]});
});
semanticActors.forEach(a=>{
  const spec=T.semanticProxyType(a.semanticType);
  assert(a.kind===spec.kind&&a.dimensions&&Math.abs(a.dimensions.height-spec.dimensions.height)<.01,
    `语义代理 ${a.semanticType} 构建为 ${spec.kind} 且带默认尺寸`);
});
const childProxy=T.buildActor({kind:'char',semanticType:'child',label:'giant-child',dimensions:{width:.8,height:3,depth:.55},pos:[24,20],rotY:0,path:[]});
const childSaved=T.stageToData().actors.find(a=>a.label==='giant-child');
assert(childSaved.semanticType==='child'&&childSaved.kind==='char'&&childSaved.dimensions.height===3,
  '3 米儿童保存后仍是 child 语义类型，尺寸单独进入项目数据');
const restoredChild=T.buildActor({...childSaved,label:'giant-child-restored',pos:[24,23],path:[]});
assert(restoredChild.semanticType==='child'&&restoredChild.dimensions.height===3&&restoredChild.kind==='char',
  '旧项目/打开往返可恢复 child 语义类型与非默认尺寸');
const switchProxy=T.buildActor({kind:'char',semanticType:'child',label:'switch-size-kept',dimensions:{width:.6,height:3,depth:.4},pos:[20,24],rotY:0,path:[]});
T.select(switchProxy);
const switched=T.replaceActorSemanticType(switchProxy,'adult_male',{resetDimensions:false});
assert(switched.semanticType==='adult_male'&&switched.kind==='char'&&switched.dimensions.height===3,
  '切换语义类型默认保留用户自定义尺寸');
T.setActorSemanticType(switched,'adult_male',{resetDimensions:true});
assert(Math.abs(switched.dimensions.height-T.semanticProxyType('adult_male').dimensions.height)<.01,
  '显式恢复尺寸时才回到类型默认高度');
const roadProxy=T.buildActor({kind:'road',semanticType:'road',label:'semantic-road-collision',pos:[22,-22],rotY:0,path:[]});
const onRoad=T.buildActor({kind:'prop',label:'road-overlap-prop',pos:[22,-22],rotY:0,path:[]});
assert(T.collisionExemptKind('road')&&!T.actorPenetrates(roadProxy)&&!T.actorPenetrates(onRoad),
  '道路是地表型参考代理，不作为巨型碰撞障碍');
const unknownSemantic=T.buildActor({kind:'prop',semanticType:'future_dragon',label:'unknown-semantic-type',dimensions:{width:2,height:2,depth:2},pos:[18,24],rotY:0,path:[]});
assert(unknownSemantic.semanticType==='future_dragon'&&T.stageToData().actors.find(a=>a.label==='unknown-semantic-type').semanticType==='future_dragon',
  '未知未来语义类型不会崩溃或丢失，便于旧/新项目兼容');

const semanticRideInput={kind:'char',semanticType:'child',dimensions:{width:.8,height:3,depth:.55},pose:'ride',mount:'semantic-host',joints:{bodyY:-.7}};
const semanticRideInputSnapshot=JSON.stringify(semanticRideInput),semanticRideJoints=T.actorJointsFromData(semanticRideInput);
assert(JSON.stringify(semanticRideInput)===semanticRideInputSnapshot&&semanticRideJoints!==semanticRideInput.joints&&semanticRideJoints.bodyY===-.7&&
  semanticRideInput.semanticType==='child'&&semanticRideInput.dimensions.height===3,
  '骑姿关节迁移只返回关节副本，不修改语义代理 semanticType 或 dimensions 输入路径');

/* ---- 环境库: 墙/柱/树/山/房/石/沙漠 ---- */
section('环境库: 墙体/柱子/树木/山体/房子/石头/连续沙漠');
const ENV = [['addWall', 'wall'], ['addPillar', 'pillar'], ['addTree', 'tree'], ['addMount', 'mount'], ['addHouse', 'house'], ['addRock', 'rock'], ['addDesert', 'desert']];
const nBefore = T.actors.length;
const environmentActors=new Map();
ENV.forEach(([btn,kind]) => {
  const before=new Set(T.actors);el(btn).click();
  environmentActors.set(kind,T.actors.find(actor=>!before.has(actor)));
});
assert(T.actors.length === nBefore + ENV.length, `添加 ${ENV.length} 个环境件后对象数一致`);
ENV.forEach(([, kind]) => assert(environmentActors.get(kind)?.kind===kind, `环境件 ${kind} 已构建`));
assert(ENV.every(([id])=>/\bdata-i18n="environment\.[^"]+"/.test(htmlElementMeta.get(id)?.attrs||''))&&
  /data-i18n-title="environment\.desertTitle"/.test(htmlElementMeta.get('addDesert')?.attrs||'')&&
  html.includes('data-i18n="environment.libraryTitle"')&&html.includes('data-i18n="environment.note"'),
  '环境库标题、旧入口与沙漠入口均使用 language key');
const wall = T.actors.find(a => a.kind === 'wall');
wall.obj.position.set(0, 0, 0);   // 放到画面中心保证入画
const legacyTree = T.actors.find(a => a.kind === 'tree');
legacyTree.obj.position.set(1.5, 0, 1); // 保留原夹具对前序语义树的隔离，避免改变后续碰撞场
const tree = environmentActors.get('tree');
const desert = T.actors.find(a => a.kind === 'desert');
assert(desert.label===sandbox.PreVisionI18n.t('environment.object.desert',{index:1}),
  '沙漠对象名通过可用的 language key 生成');
const desertSurface = desert.obj.userData.desertSurface;
const desertBounds = desertSurface.geometry.boundingBox;
const desertSize = desertBounds.getSize(new sandbox.THREE.Vector3());
const desertPositions = desertSurface.geometry.attributes.position;
const desertHeights = Array.from({length:desertPositions.count},(_,i)=>desertPositions.getY(i));
assert(desertSurface&&desertSize.x>=20&&Math.abs(desertSize.x-desertSize.z)<.01,
  `沙漠是一整块连续方形地表 (${desertSize.x.toFixed(1)}m × ${desertSize.z.toFixed(1)}m)`);
assert(Math.max(...desertHeights)-Math.min(...desertHeights)>.7,
  '沙漠网格具有明显且连续的高度起伏');
const sampleVertex=desertPositions.count-137,vertexX=desertPositions.getX(sampleVertex),vertexZ=desertPositions.getZ(sampleVertex);
const meshVertexY=desertPositions.getY(sampleVertex),profileVertexY=T.desertHeightProfile(vertexX,vertexZ);
const sampleX=3.17,sampleZ=-2.13;
desert.obj.updateMatrixWorld(true);
const terrainRay=new sandbox.THREE.Raycaster(new sandbox.THREE.Vector3(desert.obj.position.x+sampleX,20,desert.obj.position.z+sampleZ),new sandbox.THREE.Vector3(0,-1,0));
const terrainHit=terrainRay.intersectObject(desertSurface,false)[0];
const desertSample=T.desertSurfaceHeightAt(desert.obj.position.x+sampleX,desert.obj.position.z+sampleZ);
assert(Number.isFinite(desertSample)&&desertSample>0&&terrainHit&&Math.abs(meshVertexY-profileVertexY)<1e-5&&Math.abs(desertSample-terrainHit.point.y)<1e-5,
  '沙漠可见网格与贴地逻辑共用确定性高度曲面');
const openTerrainSpot=(a,candidates)=>{
  for(const [x,z] of candidates){a.obj.position.x=x;a.obj.position.z=z;T.alignActorToTerrain(a);if(!T.actorPenetrates(a))return true;}
  return false;
};
const terrainChar=T.buildActor({kind:'char',label:'terrain-char',pos:[8,8],rotY:0,path:[]});
assert(openTerrainSpot(terrainChar,[[8,8],[8,-8],[-8,8],[-8,-8]]),'沙漠内能找到无景物重叠的人物放置点');
T.snapActorToGround(terrainChar);
let terrainSupport=T.terrainSupportHeight(terrainChar),terrainClearance=T.actorWorldBox(terrainChar).min.y-terrainSupport;
assert(terrainClearance>=-.03&&terrainClearance<=.04,
  `人物贴合沙漠表面且不穿模 (净空 ${terrainClearance.toFixed(3)}m)`);
const terrainMoveStart=terrainChar.obj.position.clone();
T.moveActorSafely(terrainChar,terrainMoveStart.x-.6,terrainMoveStart.z-.6);
terrainSupport=T.terrainSupportHeight(terrainChar);terrainClearance=T.actorWorldBox(terrainChar).min.y-terrainSupport;
assert(Math.hypot(terrainChar.obj.position.x-terrainMoveStart.x,terrainChar.obj.position.z-terrainMoveStart.z)>.1&&terrainClearance>=-.03&&terrainClearance<=.04&&!T.actorPenetrates(terrainChar),
  '人物在沙漠上移动时持续贴合曲面，沙漠不会被当成巨型障碍');
const terrainHorse=T.buildActor({kind:'horse',label:'terrain-horse',pos:[-8,8],rotY:0,path:[]});
assert(openTerrainSpot(terrainHorse,[[-8,8],[-8,-8],[7,7],[7,-7]]),'沙漠内能找到无景物重叠的马匹放置点');
const terrainRider=T.buildActor({kind:'char',label:'terrain-rider',mount:terrainHorse.label,pose:'ride',pos:[0,0],rotY:0,path:[]});
T.snapActorToGround(terrainHorse);T.alignAllActorsToTerrain();
terrainSupport=T.terrainSupportHeight(terrainHorse);terrainClearance=T.actorWorldBox(terrainHorse).min.y-terrainSupport;
let riderSeatY=terrainHorse.obj.position.y+(terrainHorse.obj.userData.seatY||1.3)*terrainHorse.obj.scale.x+(terrainRider.elev||0);
assert(terrainClearance>=-.03&&terrainClearance<=.04&&Math.abs(terrainRider.obj.position.y-riderSeatY)<.001,
  '人骑马组合的马蹄不穿沙丘，骑手仍严格跟随鞯位高度');
const horseMoveStart=terrainHorse.obj.position.clone();
T.moveActorSafely(terrainHorse,horseMoveStart.x+.55,horseMoveStart.z-.55);T.alignAllActorsToTerrain();
terrainSupport=T.terrainSupportHeight(terrainHorse);terrainClearance=T.actorWorldBox(terrainHorse).min.y-terrainSupport;
riderSeatY=terrainHorse.obj.position.y+(terrainHorse.obj.userData.seatY||1.3)*terrainHorse.obj.scale.x+(terrainRider.elev||0);
assert(Math.hypot(terrainHorse.obj.position.x-horseMoveStart.x,terrainHorse.obj.position.z-horseMoveStart.z)>.1&&
  terrainClearance>=-.03&&terrainClearance<=.04&&Math.abs(terrainRider.obj.position.y-riderSeatY)<.001,
  '骑马组合在沙丘上移动后仍保持马蹄接触与骑手鞯位');
const gaitStart=terrainHorse.obj.position.clone(),savedTime=T.time;
const shotBase=T.shots.slice(0,T.shotIdx).reduce((sum,shot)=>sum+shot.dur,0),shotDur=Math.max(.2,T.curShot().dur);
terrainHorse.pathMode='line';terrainHorse.pathPts=[gaitStart.clone(),gaitStart.clone().add(new sandbox.THREE.Vector3(.5,0,.35))];
terrainHorse.pathTimes=[shotBase,shotBase+shotDur];terrainHorse.pathEase=[];T.setTime(shotDur*.45);T.updateActors();
terrainSupport=T.terrainSupportHeight(terrainHorse);terrainClearance=T.actorWorldBox(terrainHorse).min.y-terrainSupport;
riderSeatY=terrainHorse.obj.position.y+(terrainHorse.obj.userData.seatY||1.3)*terrainHorse.obj.scale.x+(terrainRider.elev||0);
const gaitLegs=terrainHorse.obj.userData.horseLegs;
assert(Math.hypot(terrainHorse.obj.position.x-gaitStart.x,terrainHorse.obj.position.z-gaitStart.z)>.1&&
  Object.values(gaitLegs).some(leg=>Math.abs(leg.rotation.x)>.01)&&terrainClearance>=-.03&&terrainClearance<=.04&&Math.abs(terrainRider.obj.position.y-riderSeatY)<.001,
  '路径转向与程序化步态更新后，马蹄和骑手仍以最终姿态贴合沙丘');
const desertPathStart=desert.obj.position.clone();
desert.pathMode='line';desert.pathPts=[desertPathStart.clone(),desertPathStart.clone().add(new sandbox.THREE.Vector3(3,0,2))];
desert.pathTimes=[shotBase,shotBase+shotDur];desert.pathEase=[];T.setTime(shotDur*.7);T.updateActors();
terrainSupport=T.terrainSupportHeight(terrainChar);terrainClearance=T.actorWorldBox(terrainChar).min.y-terrainSupport;
riderSeatY=terrainHorse.obj.position.y+(terrainHorse.obj.userData.seatY||1.3)*terrainHorse.obj.scale.x+(terrainRider.elev||0);
assert(Math.hypot(desert.obj.position.x-desertPathStart.x,desert.obj.position.z-desertPathStart.z)>1&&
  terrainClearance>=-.03&&terrainClearance<=.04&&Math.abs(terrainRider.obj.position.y-riderSeatY)<.001,
  '沙漠路径移动时，无路径人物与骑乘组合会随新地形重新贴地');
T.setTime(savedTime);
T.setExportLook(true);
assert(desert.obj.visible&&desertSurface.visible,'导出外观只切换导演台地面，沙漠作为场景环境仍然可见');
T.setExportLook(false);
const promptShot=T.curShot(),promptShotBefore={
  lock:promptShot.lock,dur:promptShot.dur,fov:promptShot.fov,camMode:promptShot.camMode,timingMode:promptShot.timingMode,syncActor:promptShot.syncActor,
  camPts:promptShot.camPts,camKeys:promptShot.camKeys,camTimes:promptShot.camTimes,camAimTimes:promptShot.camAimTimes,camFovTimes:promptShot.camFovTimes,
  camEase:promptShot.camEase,camAimEase:promptShot.camAimEase,camFovEase:promptShot.camFovEase
};
const promptTreePosition=tree.obj.position.clone(),promptPreviewCam=T.previewCamPt,promptPreviewActor=T.previewActorPoint;
T.clearPointPreview();tree.obj.position.set(0,0,0);
Object.assign(promptShot,{lock:'全局',dur:2,fov:40,camMode:'line',timingMode:'custom',syncActor:'',
  camPts:[new V(0,1,8),new V(0,1,8)],camKeys:[{yaw:0,pitch:0,fov:40},{yaw:0,pitch:0,fov:40}],
  camTimes:[0,2],camAimTimes:[0,2],camFovTimes:[0,2],camEase:[{type:'linear'}],camAimEase:[{type:'linear'}],camFovEase:[{type:'linear'}]});
const pWall = T.genPrompt();
const treePromptToken=`【环境:${tree.label}】`;
assert(pWall.includes('【环境:'), '提示词含【环境:】指代 → ' + (pWall.match(/【环境[^】]*】[^;。\n]*/) || ['未找到'])[0]);
assert(pWall.includes(treePromptToken),`提示词精确引用本段新建且确定入画的树木 ${tree.label}`);
assert(pWall.includes('固定布景'), '提示词声明环境为固定布景');
tree.obj.position.set(100,0,0);
assert(!T.genPrompt().includes(treePromptToken),'同一树木移出摄影机首尾画面后不会被伪报为可见环境，树木 oracle 对夹具可见性敏感');
tree.obj.position.copy(promptTreePosition);Object.assign(promptShot,promptShotBefore);
if(promptPreviewCam!==null)T.previewCameraPoint(promptPreviewCam);
else if(promptPreviewActor?.actor)T.previewActorPathPoint(promptPreviewActor.actor,promptPreviewActor.idx);
else T.clearPointPreview();
T.updateShotCam();
/* 序列化含新类型 */
const sd1 = T.stageToData();
ENV.forEach(([, kind]) => assert(sd1.actors.some(a => a.kind === kind), `序列化含 ${kind}`));
const desertData=sd1.actors.find(a=>a.kind==='desert'),savedDesertSample=desertSample;
assert(desertData.terrainVersion===1,'沙漠文件保留地形版本，后续更新算法时可维持旧项目外观');
const removeTestActor=a=>{const i=T.actors.indexOf(a);if(i>=0)T.actors.splice(i,1);if(a.obj.parent)a.obj.parent.remove(a.obj);};
[terrainRider,terrainHorse,terrainChar,desert].forEach(removeTestActor);T.alignAllActorsToTerrain();
const restoredDesert=T.buildActor(desertData);T.alignAllActorsToTerrain();
assert(Math.abs(T.desertSurfaceHeightAt(restoredDesert.obj.position.x+sampleX,restoredDesert.obj.position.z+sampleZ)-savedDesertSample)<.001,
  '沙漠对象序列化后可确定性恢复同一地形');
removeTestActor(restoredDesert);T.alignAllActorsToTerrain();

/* ---- 快速预览模型包: 高识别人物代理 / 沉船 / 海马骑乘 ---- */
section('快速预览模型包: 高识别人物代理、沉船与海马骑乘');
const modelCountBefore=T.actors.length;
el('addAdultMale').click();el('addAdultFemale').click();el('addChild').click();el('addSeahorse').click();el('addShipwreck').click();
const directorMale=T.actors.find(a=>a.semanticType==='adult_male'&&a.label.startsWith('男人'));
const directorFemale=T.actors.find(a=>a.semanticType==='adult_female'&&a.label.startsWith('女人'));
const directorChild=T.actors.find(a=>a.semanticType==='child'&&a.label.startsWith('小朋友'));
const seahorse=T.actors.find(a=>a.kind==='seahorse');
const shipwreck=T.actors.find(a=>a.kind==='shipwreck');
assert(T.actors.length===modelCountBefore+5&&directorMale?.kind==='char'&&directorFemale?.kind==='char'&&directorChild?.kind==='char'&&seahorse&&shipwreck,
  '模型库三个直接人物入口分别添加 adult_male、adult_female、child，且海马与沉船入口保持');
assert(['addAdultMale','addAdultFemale','addChild','addProp','addShipwreck','addCar','addHorse','addSeahorse'].every(id=>
  /\bdata-i18n="model\.[^"]+"/.test(htmlElementMeta.get(id)?.attrs||''))&&
  html.includes('id="modelLibraryGrid" class="model-library-grid"')&&
  html.includes('grid-template-columns:repeat(2,minmax(0,1fr))')&&
  html.includes('.model-library-grid button{width:100%;min-width:0;min-height:34px'),
  '八个模型入口全部使用 language key，并在 280px 窄栏使用可命中的双列弹性网格');
assert(!html.includes('id="addWizard"')&&!html.includes('model.addWizard')&&!html.includes('model.default.wizard')&&!html.includes('>+ 巫师<'),
  '模型库、构建产物和运行时 language key 均不再暴露 wizard 入口或文案');
assert(!T.SEMANTIC_PROXY_TYPES.some(type=>type.id==='wizard'||type.kind==='wizard'),
  '精确 11 类 semantic proxy 目录不新增 schema 或 wizard 类型');
const directorProfiles=[
  {actor:directorMale,id:'adult_male',color:0x2f6bff,height:1.78},
  {actor:directorFemale,id:'adult_female',color:0xf0445e,height:1.66},
  {actor:directorChild,id:'child',color:0xffd43b,height:1.2}
];
const directorBounds=directorProfiles.map(profile=>{
  const box=new sandbox.THREE.Box3().setFromObject(profile.actor.obj.userData.parts.body),size=box.getSize(new sandbox.THREE.Vector3());
  const primaryMeshes=[];profile.actor.obj.traverse(node=>{if(node.isMesh&&!node.userData?.keepMaterial)primaryMeshes.push(node);});
  const names=[];profile.actor.obj.traverse(node=>{if(node.name)names.push(node.name);});
  return {...profile,size,primaryMeshes,names};
});
assert(directorBounds.every(profile=>Math.abs(profile.size.y-profile.height)<.015),
  '真实 Three geometry bounds 命中男 1.78m、女 1.66m、儿童 1.2m：'+JSON.stringify(directorBounds.map(profile=>({id:profile.id,size:profile.size}))));
assert(directorBounds.every(profile=>profile.primaryMeshes.length>=20&&profile.primaryMeshes.every(mesh=>mesh.material?.color?.getHex()===profile.color)),
  '三类头、躯干、四肢全部保持精确类主色，仅 keepMaterial 五官/朝向/关节标记使用白或深色');
const requiredJointMarkers=['shoulderMarkerL','shoulderMarkerR','elbowMarkerL','elbowMarkerR','wristMarkerL','wristMarkerR','hipMarkerL','hipMarkerR','kneeMarkerL','kneeMarkerR','ankleMarkerL','ankleMarkerR'];
const requiredFaceParts=['eyeL','eyeR','pupilL','pupilR','browL','browR','nose','mouth','earL','earR','torsoForwardMarker'];
assert(directorBounds.every(profile=>requiredJointMarkers.every(name=>profile.names.includes(name))&&requiredFaceParts.every(name=>profile.names.includes(name))),
  '三类代理均有肩肘腕髋膝踝环、放大眼白/瞳孔/眉/鼻/嘴/耳和胸前朝向标记');
const maleRig=directorMale.obj.userData.rig,maleFace=directorMale.obj.userData.face;
assert(directorMale.obj.getObjectByName('shoulderMarkerL').parent===maleRig.shL&&
  directorMale.obj.getObjectByName('elbowMarkerL').parent===maleRig.elL&&directorMale.obj.getObjectByName('wristMarkerL').parent===maleRig.wristL&&
  directorMale.obj.getObjectByName('hipMarkerL').parent===maleRig.hipL&&directorMale.obj.getObjectByName('kneeMarkerL').parent===maleRig.kneeL&&
  directorMale.obj.getObjectByName('ankleMarkerL').parent===maleRig.ankleL&&requiredFaceParts.slice(0,10).every(name=>directorMale.obj.getObjectByName(name).parent===maleFace),
  '主要关节标记挂在对应真实枢轴，五官统一挂在 face/neck 朝向链');
const maleHeadHeight=new sandbox.THREE.Box3().setFromObject(directorMale.obj.userData.parts.head).getSize(new sandbox.THREE.Vector3()).y;
const childHeadHeight=new sandbox.THREE.Box3().setFromObject(directorChild.obj.userData.parts.head).getSize(new sandbox.THREE.Vector3()).y;
assert(directorFemale.obj.userData.parts.body.scale.x<directorMale.obj.userData.parts.body.scale.x&&
  childHeadHeight/directorBounds[2].size.y>maleHeadHeight/directorBounds[0].size.y*1.15,
  '女性实际几何较窄，儿童以更大的头身比形成明显儿童比例');
assert(directorBounds.every(profile=>!profile.names.some(name=>/^wizard/i.test(name))&&!profile.actor.obj.userData.wizardParts&&!profile.actor.obj.userData.characterStyle),
  '新建或渲染的人物代理不含帽、袍、魔杖等 wizard 装饰或 userData');
const plainLegacyChar=T.buildActor({kind:'char',label:'plain-legacy-char',pos:[26,26],rotY:0,scale:1.15,path:[]});
const plainPrimaryMeshes=[];plainLegacyChar.obj.traverse(node=>{if(node.isMesh&&!node.userData?.keepMaterial)plainPrimaryMeshes.push(node);});
const plainSaved=JSON.parse(JSON.stringify(T.stageToData())).actors.find(actor=>actor.label===plainLegacyChar.label);
assert(!plainLegacyChar.semanticType&&plainPrimaryMeshes.length>=20&&plainPrimaryMeshes.every(mesh=>mesh.material?.color?.getHex()===0x2f6bff)&&
  !Object.hasOwn(plainSaved,'semanticType')&&plainSaved.scale===1.15,
  '普通旧 char 无 semanticType 时运行时使用 adult_male 蓝色代理，但保存不静默回写 semanticType 且保留 scale');
const seahorseParts=seahorse.obj.userData.seahorseParts;
assert(seahorseParts&&seahorseParts.snout&&seahorseParts.tail&&seahorseParts.dorsalFin&&seahorseParts.armorPlates.length>=6&&
  seahorseParts.saddle&&seahorseParts.chestBand&&seahorseParts.stirrups.length===2&&seahorseParts.mountAnchor===seahorse.obj.userData.mountAnchor&&
  !seahorse.obj.userData.horseLegs,
  '海马保留长吻、卷尾、背鳍、骨板、鞍座/胸带/左右吊镫，且不暴露 horseLegs');
const shipParts=shipwreck.obj.userData.shipwreckParts,shipVisualBox=T.actorWorldBox(shipwreck);
const shipVisualSize=shipVisualBox.getSize(new sandbox.THREE.Vector3());
assert(shipParts&&shipParts.brokenOpening&&shipParts.exposedRibs.length>=5&&shipParts.mainMast&&shipParts.mastStump&&
  shipParts.yards.length>=3&&shipParts.rigging&&shipParts.decks.length===2&&shipParts.hatchVoid&&
  shipVisualSize.z>=23&&shipVisualBox.max.y-shipwreck.obj.position.y>10&&
  Math.abs(shipwreck.obj.rotation.x)<1e-9&&Math.abs(shipwreck.obj.rotation.z)<1e-9&&Math.abs(shipParts.visual.rotation.z)>.03,
  '沉船约 24m，破口/肋骨、可读甲板舱口、主断桅/残桅/横梁/主要索具齐全，倾斜只在内部视觉组');
const shipSavedBefore=T.stageToData().actors.find(a=>a.label===shipwreck.label);
assert(shipSavedBefore.kind==='shipwreck'&&T.actorWorldBox(shipwreck).max.y>shipwreck.obj.userData.collisionBounds.max[1]+5,
  '沉船保存稳定 kind，完整视觉包围盒保留桅杆而船体碰撞代理不把桅杆高度变成实心障碍');
const shipCollisionProbe=T.buildActor({kind:'prop',label:'ship-collision-probe',pos:[9,0],rotY:0,path:[]});
const legacyHorseProbe=T.buildActor({kind:'horse',label:'legacy-horse-collision-probe',pos:[0,0],rotY:0,path:[]});
const legacyPropProbe=T.buildActor({kind:'prop',label:'legacy-prop-collision-probe',pos:[5,0],rotY:0,path:[]});
const collisionActorSnapshot=T.actors.slice(),collisionEnabledBefore=el('collisionOn').checked;
const collisionProjectSettingBefore=T.project.settings.collision,collisionTimeBefore=T.time;
const shipTransformBefore={position:shipwreck.obj.position.clone(),rotationY:shipwreck.obj.rotation.y,authoredRotY:shipwreck.authoredRotY,elev:shipwreck.elev,
  pathMode:shipwreck.pathMode,pathPts:shipwreck.pathPts.map(point=>point.clone()),pathTimes:shipwreck.pathTimes.slice(),pathEase:shipwreck.pathEase.map(ease=>Object.assign({},ease))};
el('collisionOn').checked=true;T.project.settings.collision=true;
T.actors.splice(0,T.actors.length,shipwreck,shipCollisionProbe);
shipwreck.obj.position.set(0,0,0);shipwreck.elev=0;shipwreck.pathPts=[];shipwreck.pathTimes=[];shipwreck.pathEase=[];
const shipCollisionCases=[
  {label:'0°',yaw:0,outside:[4,0],contact:[2.8,0]},
  {label:'45°',yaw:Math.PI/4,outside:[9,0],contact:[2,2]},
  {label:'90°',yaw:Math.PI/2,outside:[0,4],contact:[2,0]}
];
const shipCollisionResults=shipCollisionCases.map(testCase=>{
  const localToWorld=([x,z])=>[
    x*Math.cos(testCase.yaw)+z*Math.sin(testCase.yaw),
    -x*Math.sin(testCase.yaw)+z*Math.cos(testCase.yaw)
  ];
  shipwreck.obj.rotation.y=testCase.yaw;shipwreck.authoredRotY=testCase.yaw;T.alignActorToTerrain(shipwreck);
  shipCollisionProbe.obj.position.set(testCase.outside[0],0,testCase.outside[1]);shipCollisionProbe.elev=0;T.alignActorToTerrain(shipCollisionProbe);
  const outsideBlocked=T.actorPenetrates(shipwreck)||T.actorPenetrates(shipCollisionProbe);
  const taperedOutside=localToWorld([2.1,11.8]);
  shipCollisionProbe.obj.position.set(taperedOutside[0],0,taperedOutside[1]);T.alignActorToTerrain(shipCollisionProbe);
  const taperedOutsideBlocked=T.actorPenetrates(shipwreck)||T.actorPenetrates(shipCollisionProbe);
  const diagonalOutside=localToWorld([7.5,-2.25]);
  shipCollisionProbe.obj.position.set(diagonalOutside[0],0,diagonalOutside[1]);T.alignActorToTerrain(shipCollisionProbe);
  const diagonalOutsideBlocked=T.actorPenetrates(shipwreck)||T.actorPenetrates(shipCollisionProbe);
  shipCollisionProbe.obj.position.set(testCase.contact[0],0,testCase.contact[1]);T.alignActorToTerrain(shipCollisionProbe);
  const contactBlocked=T.actorPenetrates(shipwreck)&&T.actorPenetrates(shipCollisionProbe);
  const bowContact=localToWorld([0,11.2]);
  shipCollisionProbe.obj.position.set(bowContact[0],0,bowContact[1]);T.alignActorToTerrain(shipCollisionProbe);
  const bowContactBlocked=T.actorPenetrates(shipwreck)&&T.actorPenetrates(shipCollisionProbe);
  return {label:testCase.label,outsideBlocked,taperedOutsideBlocked,diagonalOutsideBlocked,contactBlocked,bowContactBlocked};
});
assert(shipCollisionResults.every(result=>!result.outsideBlocked&&!result.taperedOutsideBlocked&&!result.diagonalOutsideBlocked&&result.contactBlocked&&result.bowContactBlocked),
  '沉船分段方向碰撞在 0°/45°/90° 均放行矩形外、尖艏外和分段对角外道具，中央/艏部真实接触仍阻挡：'+JSON.stringify(shipCollisionResults));
const shipPathBase=T.shots.slice(0,T.shotIdx).reduce((sum,shot)=>sum+shot.dur,0),shipPathDur=T.curShot().dur;
shipwreck.obj.rotation.y=0;shipwreck.authoredRotY=0;shipwreck.pathMode='line';
shipwreck.pathPts=[new sandbox.THREE.Vector3(-2,0,-2),new sandbox.THREE.Vector3(2,0,2)];
shipwreck.pathTimes=[shipPathBase,shipPathBase+shipPathDur];shipwreck.pathEase=[];
shipCollisionProbe.obj.position.set(9,0,0);T.alignActorToTerrain(shipCollisionProbe);
T.setTime(shipPathDur*.5);T.updateActors();
assert(Math.abs(shipwreck.obj.rotation.y-Math.PI/4)<.01&&Math.abs(shipwreck.obj.position.x)<.05&&Math.abs(shipwreck.obj.position.z)<.05,
  '沉船沿 45° 路径播放时，船外 (9,0) 道具不再触发假碰撞回滚，yaw 正常保持切线方向');
T.actors.splice(0,T.actors.length,legacyHorseProbe,legacyPropProbe);
legacyHorseProbe.obj.position.set(0,0,0);legacyHorseProbe.elev=0;T.alignActorToTerrain(legacyHorseProbe);
legacyPropProbe.obj.position.set(5,0,0);legacyPropProbe.elev=0;T.alignActorToTerrain(legacyPropProbe);
const legacyHorseClear=!T.actorPenetrates(legacyHorseProbe);
legacyPropProbe.obj.position.set(0,0,0);T.alignActorToTerrain(legacyPropProbe);
const legacyHorseBlocked=T.actorPenetrates(legacyHorseProbe)&&T.actorPenetrates(legacyPropProbe);
assert(legacyHorseClear&&legacyHorseBlocked,
  '方向正确沉船判定不改变旧白马/普通道具 AABB 语义：船外放行、真实重叠阻挡');
T.actors.splice(0,T.actors.length,...collisionActorSnapshot);
shipwreck.obj.position.copy(shipTransformBefore.position);shipwreck.obj.rotation.y=shipTransformBefore.rotationY;shipwreck.authoredRotY=shipTransformBefore.authoredRotY;
shipwreck.elev=shipTransformBefore.elev;shipwreck.pathMode=shipTransformBefore.pathMode;shipwreck.pathPts=shipTransformBefore.pathPts;
shipwreck.pathTimes=shipTransformBefore.pathTimes;shipwreck.pathEase=shipTransformBefore.pathEase;T.alignActorToTerrain(shipwreck);
[shipCollisionProbe,legacyHorseProbe,legacyPropProbe].forEach(removeTestActor);
el('collisionOn').checked=collisionEnabledBefore;T.project.settings.collision=collisionProjectSettingBefore;T.setTime(collisionTimeBefore);
const rider=T.buildActor({kind:'char',characterStyle:'wizard',label:'seahorse-rider-test',pos:[0,0],rotY:0,path:[]});
assert(rider.semanticType==='adult_male'&&!rider.characterStyle&&!rider.obj.userData.characterStyle&&!rider.obj.userData.wizardParts&&
  !rider.obj.children.some(node=>/^wizard/i.test(node.name||'')),
  '未先 normalize 的 legacy wizard 也直接消费为 adult_male 蓝色代理，不创建帽袍魔杖装饰');
T.select(rider);
const mountOptions=Array.from(el('mountSel').children||[]).map(option=>option.value);
assert(mountOptions.includes(seahorse.label)&&!mountOptions.includes(shipwreck.label),
  '挂载列表包含海马但排除不承诺骑乘的沉船，旧普通挂载入口仍保留');
el('mountSel').onchange({target:{value:seahorse.label}});
T.applyJoints(rider);
T.syncMountedTransform(rider,seahorse);seahorse.obj.updateMatrixWorld(true);rider.obj.updateMatrixWorld(true);
const riderRig=rider.obj.userData.rig,riderPelvis=new sandbox.THREE.Box3().setFromObject(rider.obj.userData.parts.pelvis);
const seahorseSaddle=new sandbox.THREE.Box3().setFromObject(seahorseParts.saddle);
const seahorseSeatClearance=riderPelvis.min.y-seahorseSaddle.max.y;
const leftFoot=riderRig.ankleL.getWorldPosition(new sandbox.THREE.Vector3()),rightFoot=riderRig.ankleR.getWorldPosition(new sandbox.THREE.Vector3());
const leftStirrup=seahorseParts.stirrups[0].ring.getWorldPosition(new sandbox.THREE.Vector3()),rightStirrup=seahorseParts.stirrups[1].ring.getWorldPosition(new sandbox.THREE.Vector3());
assert(rider.mount===seahorse.label&&rider.pose==='ride'&&rider.joints.bodyY===-.84&&rider.joints.hipLZ===-49&&rider.joints.hipRZ===49&&
  seahorseSeatClearance>=-.03&&seahorseSeatClearance<=.08&&leftFoot.distanceTo(leftStirrup)<.7&&rightFoot.distanceTo(rightStirrup)<.7,
  '海马专用 anchor + joint preset 让骨盆落鞍，双膝/脚贴近躯干与左右脚蹬：'+JSON.stringify({seahorseSeatClearance,leftFoot:leftFoot.distanceTo(leftStirrup),rightFoot:rightFoot.distanceTo(rightStirrup)}));
const highScale=T.setActorScaleSafely(seahorse,9),lowScale=T.setActorScaleSafely(seahorse,.1);
assert(highScale===1.15&&lowScale===.85&&rider.obj.scale.x===.85,
  '海马超出窄尺度范围时钳制为 0.85x–1.15x，骑手缩放同步且不重复偏移');
T.setActorScaleSafely(seahorse,1);
T.select(seahorse);
assert(+el('objScale').min===.85&&+el('objScale').max===1.15&&!el('objScale').disabled&&!el('objScaleNote').hidden&&el('objScaleNote').textContent.includes('0.85'),
  '选中海马时缩放滑杆和双语提示公开受支持范围');
T.select(rider);
assert(el('objScale').disabled&&el('objScaleNote').textContent.includes('跟随海马'),
  '选中海马骑手时缩放锁定为跟随宿主，避免形成不受支持的交叉尺度');
const collisionWas=el('collisionOn').checked;el('collisionOn').checked=false;
const pathBase=T.shots.slice(0,T.shotIdx).reduce((sum,shot)=>sum+shot.dur,0),pathDur=T.curShot().dur;
T.clearPointPreview();
seahorse.pathMode='curve';seahorse.pathPts=[
  new sandbox.THREE.Vector3(-4,0,4),new sandbox.THREE.Vector3(-4.5,0,0),new sandbox.THREE.Vector3(-4,0,-4),
  new sandbox.THREE.Vector3(0,0,-4),new sandbox.THREE.Vector3(0,0,0)
];seahorse.pathTimes=[0,.25,.5,.75,1].map(f=>pathBase+pathDur*f);seahorse.pathEase=[];
const pathFractions=[0,.25,.5,.75,1],pathYawProbeEpsilon=.002,pathYawTolerance=.002;
const wrapPathAngle=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
const sampleSeahorsePathPosition=f=>{
  T.setTime(pathDur*Math.max(0,Math.min(1,f)));T.updateActors();
  return {x:seahorse.obj.position.x,z:seahorse.obj.position.z};
};
const pathSamples=pathFractions.map((f,index)=>{
  const probeRange=f<=0?[0,pathYawProbeEpsilon]:f>=1?[.998,1]:[f-pathYawProbeEpsilon,f+pathYawProbeEpsilon];
  const before=sampleSeahorsePathPosition(probeRange[0]),after=sampleSeahorsePathPosition(probeRange[1]);
  const expectedYaw=Math.atan2(after.x-before.x,after.z-before.z);
  T.setTime(pathDur*f);T.updateActors();seahorse.obj.updateMatrixWorld(true);rider.obj.updateMatrixWorld(true);
  const anchor=seahorseParts.mountAnchor.getWorldPosition(new sandbox.THREE.Vector3());
  const measuredYaw=seahorse.obj.rotation.y;
  return {x:seahorse.obj.position.x,z:seahorse.obj.position.z,expectedYaw,measuredYaw,
    yawError:Math.abs(wrapPathAngle(measuredYaw-expectedYaw)),
    riderYawError:Math.abs(wrapPathAngle(rider.obj.rotation.y-expectedYaw)),
    positionError:Math.hypot(seahorse.obj.position.x-seahorse.pathPts[index].x,seahorse.obj.position.z-seahorse.pathPts[index].z),
    upright:Math.abs(seahorse.obj.rotation.x)<1e-9&&Math.abs(seahorse.obj.rotation.z)<1e-9,
    riderError:rider.obj.position.distanceTo(anchor)};
});
assert(pathSamples.every(sample=>sample.upright&&sample.yawError<pathYawTolerance&&sample.riderYawError<pathYawTolerance&&
  sample.positionError<.002&&sample.riderError<.002)&&
  new Set(pathSamples.map(sample=>wrapPathAngle(sample.measuredYaw).toFixed(3))).size>=3,
  '非共线曲线路径 0/25/50/75/100% 五点逐点按实际宿主位置有限差分计算独立 expected yaw，海马/骑手 measured yaw 经 wrap-angle 对齐，位置、直立与 anchor 均稳定：'+JSON.stringify(pathSamples));
const quarterTurnFaultErrors=pathSamples.map(sample=>Math.abs(wrapPathAngle(sample.measuredYaw+Math.PI/2-sample.expectedYaw)));
const reverseFaultErrors=pathSamples.map(sample=>Math.abs(wrapPathAngle(sample.measuredYaw+Math.PI-sample.expectedYaw)));
assert(quarterTurnFaultErrors.every(error=>error>1.4)&&reverseFaultErrors.every(error=>error>3),
  '位置轨迹不变而共享 tangent 整体 +90° 或反向时，独立位置有限差分 oracle 必须报告大角度误差：'+JSON.stringify({quarterTurnFaultErrors,reverseFaultErrors}));
const packOldCam=T.curShot().camPts.map(point=>point.clone()),packOldLock=T.curShot().lock,packOldFov=T.curShot().fov,packOldTime=T.time;
T.curShot().camPts=[new sandbox.THREE.Vector3(0,5,15)];T.curShot().lock=seahorse.label;T.curShot().fov=50;T.setTime(0);T.updateActors();T.updateShotCam();
const packPrompt=T.genPrompt();
assert(packPrompt.includes(`【动物:${seahorse.label}】`)&&packPrompt.includes(`骑在【动物:${seahorse.label}】上`)&&packPrompt.includes('仅1只')&&
  packPrompt.includes(`锁定跟拍【动物:${seahorse.label}】`)&&packPrompt.includes(`【角色:${directorMale.label}】`)&&
  packPrompt.includes(`【道具:${shipwreck.label}】`)&&!packPrompt.includes(`【环境:${shipwreck.label}】`),
  '提示词将海马归为动物/骑乘、人物代理归为角色、沉船归为场景道具，并支持海马镜头锁定');
const packData=T.stageToData().actors;
const maleSaved=packData.find(a=>a.label===directorMale.label),riderSaved=packData.find(a=>a.label===rider.label),seahorseSaved=packData.find(a=>a.label===seahorse.label);
assert(maleSaved.semanticType==='adult_male'&&riderSaved.semanticType==='adult_male'&&!Object.hasOwn(riderSaved,'characterStyle')&&riderSaved.mount===seahorse.label&&
  riderSaved.scale===seahorseSaved.scale&&packData.find(a=>a.label===shipwreck.label).kind==='shipwreck',
  'legacy wizard 保存为 adult_male 且不再写 characterStyle；pose、joints、mount、scale 与模型身份仍进入 project v5');
T.curShot().camPts=packOldCam;T.curShot().lock=packOldLock;T.curShot().fov=packOldFov;T.setTime(packOldTime);el('collisionOn').checked=collisionWas;
T.markDirty();T.flushPendingAutosave?.();
const packAutosave=JSON.parse(sandbox.localStorage._d.previz_autosave_v3||'null');
assert(packAutosave?.scenes?.[T.sceneIdx]?.actors?.some(actor=>actor.kind==='shipwreck')&&
  packAutosave.scenes[T.sceneIdx].actors.some(actor=>actor.kind==='seahorse')&&
  packAutosave.scenes[T.sceneIdx].actors.some(actor=>actor.semanticType==='adult_male'&&actor.mount===seahorse.label)&&
  !packAutosave.scenes[T.sceneIdx].actors.some(actor=>Object.hasOwn(actor,'characterStyle')),
  '人物代理、海马、沉船与 legacy 骑乘关系进入 v5 autosave，autosave 不再写 characterStyle');
T.initHistory();const wristBeforeUndo=directorMale.joints.wristRX;
T.select(directorMale);T.tweakJoint('wristRX',-24);flushTimeouts();
const packUndoDepth=T.undoDepth;T.undoLast();
const restoredMaleAfterUndo=T.actors.find(actor=>actor.label===directorMale.label),restoredLegacyRider=T.actors.find(actor=>actor.label===rider.label);
assert(packUndoDepth===1&&restoredMaleAfterUndo?.semanticType==='adult_male'&&!restoredMaleAfterUndo.characterStyle&&restoredMaleAfterUndo.joints.wristRX===wristBeforeUndo&&
  restoredLegacyRider?.semanticType==='adult_male'&&!restoredLegacyRider.characterStyle&&restoredLegacyRider.mount===seahorse.label&&restoredLegacyRider.pose==='ride'&&
  T.actors.some(actor=>actor.label===seahorse.label&&actor.kind==='seahorse')&&T.actors.some(actor=>actor.label===shipwreck.label&&actor.kind==='shipwreck'),
  '人物代理关节修改形成单次撤销边界，撤销后 active 与 legacy-migrated adult_male 身份、挂载、姿态和原腕部角度恢复');
const migrationScene=T.stageToData(),migrationRiderData=migrationScene.actors.find(actor=>actor.label===rider.label);
const preservedRideNeck=31;
migrationRiderData.joints=Object.assign({},T.POSE_JOINTS.ride,{neckY:preservedRideNeck});
T.project.scenes[T.sceneIdx]=migrationScene;T.loadScene(T.sceneIdx,true);
const migratedSeahorseRider=T.actors.find(actor=>actor.label===rider.label);
assert(migratedSeahorseRider?.joints.neckY===preservedRideNeck&&migratedSeahorseRider.joints.bodyY===-.84&&migratedSeahorseRider.joints.kneeL===82,
  '真实 loadScene 将海马旧通用骑姿迁移为专用 preset，同时保留不相关的手调关节');
[rider.label,directorMale.label,directorFemale.label,directorChild.label,plainLegacyChar.label,seahorse.label,shipwreck.label].map(label=>T.actors.find(actor=>actor.label===label)).filter(Boolean).forEach(removeTestActor);
T.alignAllActorsToTerrain();T.select(null);T.initHistory();

/* ---- 姿态库 + 关节级微调 ---- */
section('人物姿态库: 站/坐/蹲/倒地 + 关节微调');
const ch = T.actors.find(a => a.kind === 'char');
const rig = ch.obj.userData.rig;
assert(rig && rig.neck && rig.spine && rig.shL && rig.elL && rig.wristL && rig.hipL && rig.kneeL && rig.ankleL,
  '人物骨骼含头、躯干、肩肘腕和髋膝踝主要枢轴');
assert(['neckY','neckX','spineX','spineY','shLX','shRX','elL','elR','wristLX','wristRX','hipLX','hipRX','kneeL','kneeR','ankleLX','ankleRX'].every(key=>T.JOINT_DEFS.some(def=>def.k===key)),
  '右栏关节选择覆盖头、躯干和左右主要关节');
T.select(null);
assert(el('characterControls').hidden===true, '未选人物时隐藏人物姿态与全身关节区');
T.select(detailedProp);
assert(el('characterControls').hidden===true, '选中道具时也不显示人物专属关节区');
T.select(ch);
assert(el('characterControls').hidden===false&&el('jointSel').innerHTML.includes('左腕')&&el('jointSel').innerHTML.includes('右踝'),
  '选中人物时显示同一类别的头部和全身关节控件');
const face = ch.obj.userData.face;
assert(face && face.parent === rig.neck && ['eyeL','eyeR','pupilL','pupilR','nose','mouth','browL','browR'].every(name => face.getObjectByName(name)),
  '人物具有明显眼睛、瞳孔、眉毛、鼻子和嘴且五官整体挂在头部关节下');
assert(face&&face.getObjectByName('nose').position.z>0&&
  ch.obj.userData.parts.head.material.color.getHex()===0x2f6bff&&ch.obj.userData.parts.torso.material.color.getHex()===0x2f6bff&&
  face.getObjectByName('nose').material.color.getHex()===0x121826,
  '鼻子朝本地 +Z 明确标示头部正面，头与躯干保持同类蓝色，鼻子只使用允许的深色方向标记');
const noseMesh = face.getObjectByName('nose');
ch.obj.updateMatrixWorld(true);
const noseBeforeTurn = noseMesh.getWorldPosition(new sandbox.THREE.Vector3());
rig.neck.rotation.y = Math.PI / 2; ch.obj.updateMatrixWorld(true);
const noseAfterTurn = noseMesh.getWorldPosition(new sandbox.THREE.Vector3());
assert(Math.hypot(noseAfterTurn.x - noseBeforeTurn.x, noseAfterTurn.z - noseBeforeTurn.z) > .08,
  '五官随头部关节转向，正面方向变化清晰可见');
rig.neck.rotation.y = 0;
T.select(ch);
const posePromptShot=T.curShot(),posePromptCameraState={camPts:posePromptShot.camPts.map(point=>point.clone()),lock:posePromptShot.lock,fov:posePromptShot.fov};
posePromptShot.camPts=[new sandbox.THREE.Vector3(ch.obj.position.x,ch.obj.position.y+1.5,ch.obj.position.z+6)];
posePromptShot.lock=ch.label;posePromptShot.fov=50;T.updateShotCam();
el('poseSit').click();
assert(ch.pose === 'sit', '设置坐姿生效');
assert(rig.hipL.rotation.x < -1.2, '坐姿髋部前摆 (rot=' + rig.hipL.rotation.x.toFixed(2) + ')');
const sitPrompt=T.genPrompt();
assert(sitPrompt.includes('坐姿'), '提示词声明坐姿运动状态：'+sitPrompt);
el('poseLie').click();
assert(ch.pose === 'lie' && rig.body.rotation.x < -1, '倒地姿态整体放倒');
el('poseCrouch').click();
assert(rig.kneeL.rotation.x > 1.5, '蹲姿膝部弯曲 (rot=' + rig.kneeL.rotation.x.toFixed(2) + ')');
el('poseStand').click();
/* 注: 站立+带调度线的角色会被步态实时驱动, 复位断言看关节数据而非实时骨骼角 */
assert(ch.pose === 'stand' && rig.body.rotation.x === 0 && !ch.joints.kneeL, '恢复站立全关节复位');
/* 关节级微调 */
el('jointSel').value = 'spineX';
el('jointSel').onchange({ target: el('jointSel') });
el('jointA').oninput({ target: { value: '45' } });
assert(Math.abs(rig.spine.rotation.x - 45 * Math.PI / 180) < .01, '腰部前倾 45° 生效');
el('jointB').oninput({ target: { value: '-12' } });
assert(Math.abs(rig.spine.rotation.z + 12 * Math.PI / 180) < .01, '躯干侧弯副轴生效');
el('jointSel').value = 'wristLX';el('jointSel').onchange({ target: el('jointSel') });
el('jointA').oninput({ target: { value: '32' } });el('jointB').oninput({ target: { value: '-18' } });
assert(Math.abs(rig.wristL.rotation.x-32*Math.PI/180)<.01&&Math.abs(rig.wristL.rotation.z+18*Math.PI/180)<.01,
  '左腕屈伸和侧弯两轴调整生效');
el('jointSel').value = 'ankleRX';el('jointSel').onchange({ target: el('jointSel') });
el('jointA').oninput({ target: { value: '-25' } });el('jointB').oninput({ target: { value: '12' } });
assert(Math.abs(rig.ankleR.rotation.x+25*Math.PI/180)<.01&&Math.abs(rig.ankleR.rotation.z-12*Math.PI/180)<.01,
  '右踝屈伸和侧弯两轴调整生效');
assert(ch.pose === 'custom', '手动微调后姿态标记为 custom');
const customPosePrompt=T.genPrompt();
assert(customPosePrompt.includes('预演所示姿态'), '提示词按"预演所示姿态"声明：'+customPosePrompt);
posePromptShot.camPts=posePromptCameraState.camPts;posePromptShot.lock=posePromptCameraState.lock;posePromptShot.fov=posePromptCameraState.fov;T.updateShotCam();
const sdJ = T.stageToData().actors.find(a => a.label === ch.label);
assert(sdJ.joints&&sdJ.joints.spineX===45&&sdJ.joints.spineZ===-12&&sdJ.joints.wristLX===32&&sdJ.joints.wristLZ===-18&&sdJ.joints.ankleRX===-25&&sdJ.joints.ankleRZ===12,
  '躯干、腕和踝关节角完整进入序列化');
const restoredJoint=T.buildActor({...sdJ,label:'关节恢复测试',pos:[18,18],path:[]}),restoredRig=restoredJoint.obj.userData.rig;
assert(Math.abs(restoredRig.spine.rotation.z+12*Math.PI/180)<.01&&Math.abs(restoredRig.wristL.rotation.x-32*Math.PI/180)<.01&&Math.abs(restoredRig.ankleR.rotation.x+25*Math.PI/180)<.01,
  '保存的躯干、腕和踝关节角可恢复到新骨架');
removeTestActor(restoredJoint);
const legacyJoint=T.buildActor({kind:'char',label:'旧项目人物',pos:[18,-18],rotY:0,path:[],joints:{neckY:12,elL:-30}}),legacyRig=legacyJoint.obj.userData.rig;
assert(Math.abs(legacyRig.neck.rotation.y-12*Math.PI/180)<.01&&Math.abs(legacyRig.elL.rotation.x+30*Math.PI/180)<.01&&legacyRig.wristL.rotation.x===0&&legacyRig.ankleR.rotation.x===0,
  '旧项目缺少腕踝字段时回退零角，旧头部和肘部角仍恢复');
removeTestActor(legacyJoint);
el('jointReset').click();
assert(ch.pose==='stand'&&!ch.joints.spineX&&!ch.joints.spineZ&&!ch.joints.wristLX&&!ch.joints.ankleRX, 'custom 重置回站立预设并清空新关节角');
el('poseSit').click();   // 留坐姿供序列化/步态守卫测试
const sdS = T.stageToData().actors.find(a => a.label === ch.label);
assert(sdS.pose === 'sit' && sdS.joints.hipLX === -84, '姿态与关节角进入序列化');
/* 步态守卫: 坐姿播放时步态不覆盖关节角 */
el('playBtn').click(); frames(5);
assert(rig.hipL.rotation.x < -1.2, '坐姿播放中步态不覆盖姿态 (rot=' + rig.hipL.rotation.x.toFixed(2) + ')');

/* ---- 骑乘挂载: 马匹 + 人马绑定 ---- */
section('骑乘挂载: 马匹 + 人马绑定');
const V3 = sandbox.THREE.Vector3;
const rideHipLDef=T.JOINT_DEFS.find(def=>def.k==='hipLX'),rideHipRDef=T.JOINT_DEFS.find(def=>def.k==='hipRX');
const genericRideJoints=T.actorJointsFromData({kind:'char',mount:'legacy-generic',pose:'ride'});
assert(genericRideJoints.bodyY===-.92&&genericRideJoints.hipLZ===-42&&genericRideJoints.hipRZ===42&&genericRideJoints.kneeL===70&&genericRideJoints.kneeR===70,
  '无宿主上下文的通用骑乘默认值保持既有车载/其他挂载语义');
el('addHorse').click();
const horse = T.actors.find(a => a.kind === 'horse');
assert(horse && horse.obj.userData.horseLegs && horse.obj.userData.seatY > 1, '马匹构建(含四腿步态组+鞍位)');
const horseParts = horse.obj.userData.horseParts;
assert(horseParts && horseParts.coat.material.color.getHex() === 0xf5f5f2 && horseParts.eyes.length === 2 && horseParts.nostrils.length === 2 && horseParts.mane.length >= 3,
  '马匹使用白色主毛色并具有眼睛、鼻孔和分段鬃毛');
assert(horseParts.coat.scale.z > horseParts.coat.scale.x * 2 && horseParts.neck.rotation.x > .5 && horseParts.legSegments.FL.length === 3 && horseParts.legSegments.BL.length === 4,
  '白马采用收窄长躯、前倾长颈和前后肢不同的解剖分段');
assert(horseParts.shoulders.length === 2 && horseParts.haunches.length === 2 && horseParts.upperNeck && horseParts.cheek && horseParts.jaw && horseParts.hooves.every(h => h.geometry.type === 'CylinderGeometry'),
  '白马具有肩胛臀肌、双段颈部、收窄长脸与锥形马蹄轮廓');
const horseFaceParts = [horseParts.head, horseParts.cheek, horseParts.jaw, horseParts.muzzle, ...horseParts.ears, ...horseParts.eyes, ...horseParts.nostrils, horseParts.bridle, horseParts.bit];
assert(horseParts.headRig && horseFaceParts.every(part => part.parent === horseParts.headRig) && horseParts.muzzle.position.z < .55 && horseParts.jaw.position.y > -.18,
  '口鼻、下颌、五官与衔具统一挂在头部局部坐标系内且无游离几何');
horse.obj.updateMatrixWorld(true);
const horseHeadBox = new sandbox.THREE.Box3().setFromObject(horseParts.head);
assert(horseHeadBox.intersectsBox(new sandbox.THREE.Box3().setFromObject(horseParts.muzzle)) && horseHeadBox.intersectsBox(new sandbox.THREE.Box3().setFromObject(horseParts.jaw)),
  '口鼻与下颌包围盒和长脸主体保持连续接触');
assert(horseParts && horseParts.muzzle && horseParts.saddle && horseParts.saddleBlanket && horse.obj.userData.seatY === 1.555 && horse.obj.userData.seatZ === -.05,
  '白马具有口鼻、鞍具与鞍毯且保持既有骑乘锚点');
const horseSaddleBox = new sandbox.THREE.Box3().setFromObject(horseParts.saddle);
const horseSaddlePackageBox = new sandbox.THREE.Box3();
[horseParts.saddleBlanket,horseParts.saddle,horseParts.saddlePommel,horseParts.saddleCantle]
  .forEach(part=>horseSaddlePackageBox.union(new sandbox.THREE.Box3().setFromObject(part)));
const horseBackBox = new sandbox.THREE.Box3().setFromObject(horseParts.coat);
assert(horseParts.saddle.scale.x<=.38&&horseParts.saddle.scale.y<=.04&&horseParts.saddleBlanket.scale.x<=.55&&horseParts.saddleBlanket.scale.y<=.03&&
  horseParts.saddlePommel.geometry.type==='SphereGeometry'&&horseParts.saddleCantle.geometry.type==='SphereGeometry'&&horseSaddlePackageBox.max.y-horseSaddlePackageBox.min.y<=.1&&
  horseSaddleBox.intersectsBox(horseBackBox),
  '马鞍与鞍毯缩窄压薄并下沉贴合马背，前后鞍桥改为低矮圆脊而非悬浮圆环');
assert(Math.abs(T.actorWorldBox(horse).min.y) < .04, '白马四蹄保持贴地');
horse.obj.position.set(2, 0, 2);
horse.pathPts = [new V3(2, 0, 2), new V3(6, 0, 4)];
T.curShot().camPts = [new V3(0, 2, 10)]; T.curShot().lock = '全局'; T.curShot().fov = 50;
T.select(ch);
el('mountSel').onchange({ target: { value: horse.label } });
assert(ch.mount === horse.label && ch.pose === 'ride', '挂载后自动切骑乘姿态');
assert(ch.joints.bodyY===-.82&&ch.joints.hipLZ===-46&&ch.joints.hipRZ===46&&ch.joints.kneeL===72&&ch.joints.kneeR===72&&
  rideHipLDef.b.min<=ch.joints.hipLZ&&rideHipRDef.b.max>=ch.joints.hipRZ,
  '只在宿主确认为白马时使用贴鞍默认值，且新髋外展仍在右栏可调范围内');
assert(rig.hipL.rotation.z < -.1, '骑乘分腿(髋部侧展 z=' + rig.hipL.rotation.z.toFixed(2) + ')');
frames(2);
assert(Math.abs(ch.obj.position.y - horse.obj.userData.seatY) < .2, '骑手贴鞍位高度 (y=' + ch.obj.position.y.toFixed(2) + ')');
assert(Math.hypot(ch.obj.position.x-horse.obj.position.x,ch.obj.position.z-horse.obj.position.z) < .08,
  '骑手随坐骑位置并对齐鞍座中心');
horse.obj.updateMatrixWorld(true); ch.obj.updateMatrixWorld(true);
const kneeLLocal = horse.obj.worldToLocal(rig.kneeL.getWorldPosition(new V3()));
const kneeRLocal = horse.obj.worldToLocal(rig.kneeR.getWorldPosition(new V3()));
assert(kneeLLocal.x < -.34 && kneeRLocal.x > .34, '骑姿双膝位于马腹两侧，不再穿进马身');
const riderPelvisBox = new sandbox.THREE.Box3().setFromObject(ch.obj.userData.parts.pelvis);
const mountedSaddleBox = new sandbox.THREE.Box3().setFromObject(horseParts.saddle);
const riderSeatClearance=riderPelvisBox.min.y-mountedSaddleBox.max.y;
assert(riderSeatClearance>=-.015&&riderSeatClearance<=.05&&Math.abs(rig.body.position.y+.82)<.001,
  '骑手骨盆落在薄鞍表面而非压入鞍座，默认骑姿同步抬高并扩大髋部侧展：'+JSON.stringify({riderSeatClearance,bodyY:rig.body.position.y}));
const mountedPosition=horse.obj.position.clone(),mountedRotation=horse.obj.rotation.y,mountedRiderPosition=ch.obj.position.clone();
horse.obj.position.set(4,0,3);horse.obj.rotation.y=.73;T.syncMountedTransform(ch,horse);horse.obj.updateMatrixWorld(true);ch.obj.updateMatrixWorld(true);
const movedSeatClearance=new sandbox.THREE.Box3().setFromObject(ch.obj.userData.parts.pelvis).min.y-
  new sandbox.THREE.Box3().setFromObject(horseParts.saddle).max.y;
const expectedMountedOffset=new V3((horse.obj.userData.seatX||0)*horse.obj.scale.x,0,(horse.obj.userData.seatZ||0)*horse.obj.scale.x)
  .applyAxisAngle(new V3(0,1,0),horse.obj.rotation.y);
const expectedMountedPosition=horse.obj.position.clone().add(expectedMountedOffset);
expectedMountedPosition.y=horse.obj.position.y+(horse.obj.userData.seatY||1.3)*horse.obj.scale.x+(ch.elev||0);
assert(Math.abs(movedSeatClearance-riderSeatClearance)<.002&&Math.abs(ch.obj.rotation.y-horse.obj.rotation.y)<.001&&
  ch.obj.position.distanceTo(expectedMountedPosition)<.002&&ch.obj.position.distanceTo(mountedRiderPosition)>.5,
  '坐骑移动和转向后骑手仍跟随旋转后的鞍点，并保持相同鞍面净空与朝向');
horse.obj.position.copy(mountedPosition);horse.obj.rotation.y=mountedRotation;T.syncMountedTransform(ch,horse);
const originalHorseScale=horse.obj.scale.x,originalRiderScale=ch.obj.scale.x;
[[.65,1.35],[1.8,.7]].forEach(([horseScale,riderScale])=>{
  horse.obj.scale.setScalar(horseScale);ch.obj.scale.setScalar(riderScale);horse.obj.rotation.y=-.48;
  T.syncMountedTransform(ch,horse);horse.obj.updateMatrixWorld(true);ch.obj.updateMatrixWorld(true);
  const expectedY=horse.obj.position.y+horse.obj.userData.seatY*horseScale+(ch.elev||0);
  assert([ch.obj.position.x,ch.obj.position.y,ch.obj.position.z,ch.obj.rotation.y].every(Number.isFinite)&&
    Math.abs(ch.obj.position.y-expectedY)<.002&&Math.abs(ch.obj.rotation.y-horse.obj.rotation.y)<.001,
    `马 ${horseScale}x / 骑手 ${riderScale}x 非等比组合仍以有限位置和正确朝向稳定挂载`);
});
horse.obj.scale.setScalar(originalHorseScale);ch.obj.scale.setScalar(originalRiderScale);horse.obj.rotation.y=mountedRotation;T.syncMountedTransform(ch,horse);
T.rebuildViz();
assert(T.pathHandles.filter(h => h.userData.actor === ch).length === 0, '挂载后隐藏不会生效的骑手旧黄色路径');
assert(T.pathHandles.filter(h => h.userData.actor === horse).length === horse.pathPts.length, '挂载组合只显示坐骑的有效黄色路径');
const horsePathN = horse.pathPts.length;
el('addActorPt').click();
assert(horse.pathPts.length === horsePathN + 1, '选中骑手时右栏调度控制实际编辑坐骑路径');
el('delActorPt').click();
T.updateLabelVisibility(false);
const horseLabel = horse.obj.children.find(c => c.isSprite), riderLabel = ch.obj.children.find(c => c.isSprite);
assert(!horseLabel.visible && riderLabel.visible, '挂载时隐藏坐骑标签，只保留骑手标签避免近景叠字');
assert(T.actorWorldBox(horse).max.y > horse.obj.userData.seatY + .7, '坐骑碰撞盒合并骑手为复合体');
const pRide = T.genPrompt();
assert(pRide.includes('骑在【动物:'), '提示词声明骑乘关系');
assert(pRide.includes('仅1匹'), '马匹数量声明');
assert(T.stageToData().actors.find(a => a.label === ch.label).mount === horse.label, '挂载关系进序列化');
el('mountSel').onchange({ target: { value: '__none__' } });
assert(!ch.mount && ch.pose === 'stand' && Math.abs(T.actorWorldBox(ch).min.y) < .03,
  '卸载后恢复站立且模型脚底贴地 (rootY=' + ch.obj.position.y.toFixed(3) + ')');
[
  ['car','generic-mount-car'],
  ['prop','generic-mount-prop'],
].forEach(([kind,label])=>{
  const host=T.buildActor({kind,label,pos:[-24,18],rotY:.41,path:[]});
  const rider=T.buildActor({kind:'char',label:label+'-rider',pos:[-24,18],rotY:0,path:[]});
  T.select(rider);el('mountSel').onchange({target:{value:host.label}});
  assert(rider.mount===host.label&&rider.pose==='ride'&&rider.joints.bodyY===-.92&&rider.joints.hipLZ===-42&&rider.joints.hipRZ===42&&rider.joints.kneeL===70&&rider.joints.kneeR===70,
    `${kind} 宿主继续使用既有通用骑乘默认，不被白马贴鞍姿态迁移`);
  T.syncMountedTransform(rider,host);
  assert(Number.isFinite(rider.obj.position.y)&&Math.abs(rider.obj.rotation.y-(host.obj.rotation.y+(kind==='car'?Math.PI/2:0)))<.001,
    `${kind} 宿主继续保持既有挂载位置与朝向语义`);
  removeTestActor(rider);removeTestActor(host);
});
T.select(ch);
el('poseSit').click();   // 还原坐姿, 供后续自动保存断言使用

/* ---- 调度路径编辑 + 对象高度 + 防穿透 ---- */
section('调度路径: 右栏增删点 / 直曲线 / 画布拖已有点');
let route = T.buildActor({ kind: 'prop', label: '路径测试', pos: [24, 24], rotY: 0, path: [] });
T.select(route);
T.addActorPathPoint(route, new V3(26, 0, 24), new V3(24, 0, 24));
assert(route.pathPts.length === 2, '空路径录点自动生成起点+目标点');
T.rebuildViz();
assert(T.pathHandles.filter(h => h.userData.actor === route).length === 2, '每个调度点都有黄色画布手柄');
route.pathPts = [new V3(24, 0, 24)]; T.rebuildViz();
assert(T.pathHandles.filter(h => h.userData.actor === route).length === 1, '单点路径仍可见、可拖动');
el('actorPathMode').value = 'line'; el('actorPathMode').onchange({ target: el('actorPathMode') });
el('addActorPt').click();
assert(route.pathPts.length === 2, '右栏“增加调度点”生效');
el('delActorPt').click();
assert(route.pathPts.length === 1, '右栏“减少调度点”生效');
el('clearActorPath').click();
assert(route.pathPts.length === 0, '右栏“清空路径”生效');
route.pathPts = [new V3(24,0,24), new V3(26,0,24), new V3(26,0,26)];
route.pathMode = 'line';
const lineCv = T.actorCurve(route);
assert(lineCv instanceof sandbox.THREE.CurvePath && Math.abs(lineCv.getLength() - 4) < .01, '直线模式按折线弧长播放');
route.pathMode = 'curve';
assert(T.actorCurve(route) instanceof sandbox.THREE.CatmullRomCurve3, '曲线模式使用平滑 Catmull-Rom');
route.pathMode = 'line';
assert(!htmlIds.has('canvasPathAdd') && !htmlIds.has('modePath') && typeof el('rightRailPath').onclick === 'function' &&
  !String(el('rightRailPath').onclick).includes('addActorPathPoint'),
  '重复的左侧路径入口已移除，右侧路径图标只打开属性面板；画布自动加点入口仍保持取消');

section('对象路径一键复制为运镜 + 整轨拖动');
T.rebuildViz();
const listedPaths=T.effectiveActorPaths();
assert(listedPaths.includes(route)&&el('copyPathCount').textContent.includes(String(listedPaths.length)),
  '下拉菜单实时统计当前所有有效对象路径');
assert(el('copyPathSel').children.some(option=>option.value===route.label&&option.textContent.includes(route.label)&&option.textContent.includes(String(route.pathPts.length))),
  '路径选项显示对象名和点数');
const srcDeltas=route.pathPts.slice(1).map((p,i)=>p.clone().sub(route.pathPts[i]));
flushTimeouts();T.initHistory();
const copySelectState=()=>({
  stage:JSON.stringify(T.stageToData()),project:JSON.stringify(T.project),selected:T.selected?.label||'',
  undo:T.undoDepth,modified:T.project.modified,autosave:sandbox.localStorage._d['previz_autosave_v3'],
  writes:sandbox.localStorage._writes,dirty:T.dirtyTimer,history:T.historyTimer,note:el('copyPathNote').textContent
});
const copySelectBefore=copySelectState(),copyPathOptions=listedPaths.map(path=>path.label);
for(const value of copyPathOptions.concat(['',route.label])){
  el('copyPathSel').value=value;el('copyPathSel').onchange({target:el('copyPathSel')});
}
T.refreshCopyPathUI();
assert(JSON.stringify(copySelectState())===JSON.stringify(copySelectBefore)&&el('copyPathSel').value===route.label&&!el('copyPathToCam').disabled,
  '反复切换、清空、键盘等价 change 与刷新下拉只保留选择并更新按钮，不改镜头/project/selection/history/modified/autosave/note');
el('copyPathSel').value='';el('copyPathSel').onchange({target:el('copyPathSel')});el('copyPathToCam').click();
assert(el('copyPathToCam').disabled&&JSON.stringify(copySelectState())===JSON.stringify(copySelectBefore),
  '清空选择后复制按钮禁用，误触 click 也不执行');
el('copyPathSel').value=route.label;el('copyPathSel').onchange({target:el('copyPathSel')});
const savedRoutePoints=route.pathPts;route.pathPts=[];const invalidCopyBefore=copySelectState();el('copyPathToCam').click();
assert(JSON.stringify(copySelectState())===JSON.stringify(invalidCopyBefore),'选择后的对象路径失效时显式复制原子失败，不留下半套摄影机数据或状态副作用');
route.pathPts=savedRoutePoints;
T.setSelCamPt(0);const legacyCopyHeightSource=T.curShot().camPts[0];legacyCopyHeightSource.y=47;T.initHistory();
const cameraBeforeCopy=JSON.stringify(T.stageToData().shots[T.shotIdx]),actorPathBeforeCopy=JSON.stringify(route.pathPts),copyWritesBefore=sandbox.localStorage._writes;
el('copyPathToCam').click();flushTimeouts();
assert(T.undoDepth===1&&sandbox.localStorage._writes===copyWritesBefore+1,'显式按钮（含键盘激活的原生 click）只形成一次既有 history/autosave 边界');
assert(T.curShot().camPts.length===route.pathPts.length&&T.curShot().camMode==='line'&&T.shotCurve(T.curShot()) instanceof sandbox.THREE.CurvePath,
  '复制后机位点数与直/曲线类型完全一致');
assert(T.curShot().camPts.every(point=>point.y===30)&&legacyCopyHeightSource.y===47&&JSON.stringify(route.pathPts)===actorPathBeforeCopy,
  '对象路径复制把新机位统一夹到30m，且不修改 legacy 源机位或对象路径');
const sameShape=T.curShot().camPts.slice(1).every((p,i)=>p.clone().sub(T.curShot().camPts[i]).distanceTo(srcDeltas[i])<.001);
assert(sameShape, '复制只增加整体侧向偏移，不改变原路径形状和点位关系');
T.undoLast();flushTimeouts();
assert(JSON.stringify(T.stageToData().shots[T.shotIdx])===cameraBeforeCopy&&JSON.stringify(T.actors.find(actor=>actor.label===route.label)?.pathPts)===actorPathBeforeCopy,
  '一次 undo 精确恢复复制前摄影机数据且对象路径不变');
route=T.actors.find(actor=>actor.label===route.label);
el('copyPathToCam').click();flushTimeouts();
const originalCam=T.curShot().camPts.map(p=>p.clone()),relBefore=originalCam[1].clone().sub(originalCam[0]);
const actualMove=T.translateCameraRoute(originalCam,-2,1.5);
const relAfter=T.curShot().camPts[1].clone().sub(T.curShot().camPts[0]);
assert(Math.abs(actualMove.x)+Math.abs(actualMove.y)>.1&&relAfter.distanceTo(relBefore)<.001,
  '整轨平移保留所有点的相对位置');
assert(/dragging\s*&&\s*dragging\.camRoute\s*&&\s*e\.buttons\s*===\s*2/.test(viewportModuleSrc)&&
  /translateCameraRoute\(dragging\.original,raw\.x,raw\.z\)/.test(viewportModuleSrc),
  '右键拖动绑定到摄影机整条路线');

section('近景运镜控制点固定屏幕尺寸');
T.rebuildViz();
const hitCameraHandle=T.camHandles.find(handle=>handle.userData.hitTargetOnly);
const otherCameraHandles=T.camHandles.filter(handle=>!handle.userData.hitTargetOnly);
const cameraPartNames=['cameraBody','cameraBodySidePanel','cameraRearBattery','cameraBasePlate','cameraBottomRailLeft','cameraBottomRailRight',
  'cameraLensMount','cameraLensBarrel','cameraFocusRing','cameraLensFront','cameraLensGlass','cameraLensHighlight','cameraScreenHinge','cameraSideScreenFrame',
  'cameraSideScreen','cameraScreenLineA','cameraScreenLineB','cameraSideDial','cameraRecordRing','cameraRecordButton','cameraStatusLight','cameraTallyLight',
  'cameraControlButton1','cameraControlButton2','cameraControlButton3','cameraTopPlate','cameraHandleSupportFront','cameraHandleSupportRear','cameraTopHandle',
  'cameraAntennaBasePrimary','cameraAntennaPrimary','cameraAntennaBaseSecondary','cameraAntennaSecondary'];
assert(cameraPartNames.every(name=>!!T.camBall.getObjectByName(name))&&
  T.camBall.getObjectByName('cameraLensGlass').position.z<T.camBall.getObjectByName('cameraBody').position.z&&
  T.camBall.getObjectByName('cameraBody').material.depthTest===true&&T.camBall.getObjectByName('cameraBody').material.depthWrite===true&&
  T.camBall.parent===T.cameraVizScene&&T.cameraVizScene.parent===null,
  '独立 cameraVizScene 内是含长镜头/镜片、盒体、后电池、双底轨、侧屏/旋钮、录制键/灯、顶板/提把和双天线的无品牌专业摄影机');
assert(hitCameraHandle&&hitCameraHandle.material.transparent===true&&hitCameraHandle.material.opacity===0&&hitCameraHandle.material.depthWrite===false&&
  hitCameraHandle.visible===true&&Math.abs(hitCameraHandle.userData.pixelRadius*2-27)<1e-9&&
  otherCameraHandles.length>0&&otherCameraHandles.every(handle=>handle.material.opacity===1&&handle.material.color.getHex()!==0xffffff),
  '当前机位是完全透明的 27px 命中代理，其他路径机位点仍保留红色实体');
T.updateShotCam();
assert(T.camBall.position.distanceTo(T.shotCam.position)<1e-9&&1-Math.abs(T.camBall.quaternion.dot(T.shotCam.quaternion))<1e-9,
  '专业摄影机的位置和 quaternion 精确跟随 shotCam');
assert(T.cameraVizVisibleIn('viewport')&&T.cameraVizVisibleIn('workspace')&&
  ['monitor','camera','thumbnail','seedance'].every(surface=>!T.cameraVizVisibleIn(surface)),
  '可视化策略仅允许主编辑 viewport/workspace 捕获，monitor/纯摄影机/thumbnail/Seedance 隐藏');
T.renderer.operations.length=0;const savedAutoClear=T.renderer.autoClear;T.renderDirectorViewport();
const directorOps=T.renderer.operations.slice(-3);
assert(directorOps.length===3&&directorOps[0].type==='render'&&directorOps[0].scene===T.scene&&
  directorOps[1].type==='clearDepth'&&directorOps[2].type==='render'&&directorOps[2].scene===T.cameraVizScene&&directorOps[2].camera===T.cameraVizCam&&
  T.cameraVizCam.near<T.viewCam.near&&T.cameraVizCam.position.distanceTo(T.viewCam.position)<1e-9&&
  1-Math.abs(T.cameraVizCam.quaternion.dot(T.viewCam.quaternion))<1e-9&&T.cameraVizCam.fov===T.viewCam.fov&&T.cameraVizCam.aspect===T.viewCam.aspect&&T.cameraVizCam.zoom===T.viewCam.zoom&&
  T.renderer.autoClear===savedAutoClear,
  '导演台按主世界 render → clearDepth → 独立近裁剪 camera overlay render 的顺序渲染，且同步投影/位姿并恢复清屏状态');
const successfulRendererRender=T.renderer.render.bind(T.renderer);let overlayFailureCaught=false;
T.renderer.render=(renderScene,renderCamera)=>{if(renderScene===T.cameraVizScene)throw new Error('camera overlay failure');return successfulRendererRender(renderScene,renderCamera);};
try{T.renderDirectorViewport();}catch(error){overlayFailureCaught=error.message==='camera overlay failure';}finally{T.renderer.render=successfulRendererRender;}
assert(overlayFailureCaught&&T.renderer.autoClear===savedAutoClear,
  'camera overlay 渲染异常时 try/finally 仍恢复 renderer.autoClear，不污染后续主场景帧');
const successfulClearDepth=T.renderer.clearDepth.bind(T.renderer);let clearDepthFailureCaught=false;
T.renderer.clearDepth=()=>{throw new Error('camera clearDepth failure');};
try{T.renderDirectorViewport();}catch(error){clearDepthFailureCaught=error.message==='camera clearDepth failure';}finally{T.renderer.clearDepth=successfulClearDepth;}
assert(clearDepthFailureCaught&&T.renderer.autoClear===savedAutoClear,
  'clearDepth 异常时 try/finally 仍恢复 renderer.autoClear，不污染后续主场景帧');
T.setExportLook(true);assert(T.camBall.visible===false,'摄影机画面、monitor、缩略图与导出外观不包含编辑摄影机');
T.setExportLook(false);assert(T.camBall.visible===true,'返回编辑外观后恢复专业摄影机');

const savedViewState={position:T.viewCam.position.clone(),quaternion:T.viewCam.quaternion.clone(),fov:T.viewCam.fov,zoom:T.viewCam.zoom,aspect:T.viewCam.aspect,near:T.viewCam.near,far:T.viewCam.far};
const savedCamBallPos=T.camBall.position.clone(),savedHitPos=hitCameraHandle.position.clone(),savedSunPos=T.sunHandle.position.clone();
const viewportEl=el('viewport'),savedViewportWidth=viewportEl.clientWidth,savedViewportHeight=viewportEl.clientHeight,savedDpr=sandbox.devicePixelRatio;
const projectedDiameterCss=(center,worldDiameter,cam,width,height)=>{
  cam.updateMatrixWorld(true);
  const halfRight=new V3().setFromMatrixColumn(cam.matrixWorld,0).normalize().multiplyScalar(worldDiameter/2);
  const left=center.clone().sub(halfRight).project(cam),right=center.clone().add(halfRight).project(cam);
  return Math.hypot((right.x-left.x)*width/2,(right.y-left.y)*height/2);
};
const cameraPixelCases=[
  {name:'far',position:[0,0,-80],fov:50,zoom:1,width:800,height:600,dpr:1},
  {name:'off-axis',position:[9.9,3,-20],fov:50,zoom:1,width:800,height:600,dpr:1},
  {name:'zoom-2',position:[-3,1.5,-12],fov:50,zoom:2,width:800,height:600,dpr:2},
  {name:'wide-fov-small-viewport',position:[0,0,-3],fov:105,zoom:1,width:640,height:360,dpr:2},
  {name:'extreme-near',position:[0,0,-.006],fov:35,zoom:1,width:1024,height:768,dpr:1},
];
const cameraPixels=[];
T.viewCam.position.set(0,0,0);T.viewCam.quaternion.identity();
cameraPixelCases.forEach(testCase=>{
  T.viewCam.fov=testCase.fov;T.viewCam.zoom=testCase.zoom;T.viewCam.aspect=testCase.width/testCase.height;T.viewCam.updateProjectionMatrix();T.viewCam.updateMatrixWorld(true);
  viewportEl.clientWidth=testCase.width;viewportEl.clientHeight=testCase.height;sandbox.devicePixelRatio=testCase.dpr;T.camBall.position.set(...testCase.position);T.updateVizScales(T.viewCam);
  const overlayCam=T.syncCameraVizCamera(T.viewCam);T.cameraVizScene.updateMatrixWorld(true);
  const coreCenter=T.camBall.localToWorld(T.camBall.userData.baseCoreCenter.clone());
  const ndc=coreCenter.clone().project(overlayCam),forward=new V3();overlayCam.getWorldDirection(forward);
  const depth=coreCenter.clone().sub(overlayCam.position).dot(forward);
  const fullCenter=T.camBall.localToWorld(T.camBall.userData.fullBoundsCenter.clone());
  const fullDepth=fullCenter.clone().sub(overlayCam.position).dot(forward),fullRadius=T.camBall.userData.fullBoundsRadius*T.camBall.scale.x;
  cameraPixels.push({name:testCase.name,pixels:projectedDiameterCss(coreCenter,T.camBall.userData.baseCoreDiameter*T.camBall.scale.x,overlayCam,testCase.width,testCase.height),ndc,depth,
    overlayNear:overlayCam.near,overlayFar:overlayCam.far,fullDepth,fullRadius,
    synced:overlayCam.position.distanceTo(T.viewCam.position)<1e-9&&1-Math.abs(overlayCam.quaternion.dot(T.viewCam.quaternion))<1e-9&&overlayCam.fov===T.viewCam.fov&&overlayCam.aspect===T.viewCam.aspect&&overlayCam.zoom===T.viewCam.zoom});
});
T.viewCam.fov=50;T.viewCam.zoom=1;T.viewCam.aspect=800/600;T.viewCam.updateProjectionMatrix();viewportEl.clientWidth=800;viewportEl.clientHeight=600;
hitCameraHandle.position.set(0,0,-10);T.sunHandle.position.set(0,0,-10);T.updateVizScales(T.viewCam);
const overlayCamForHandles=T.syncCameraVizCamera(T.viewCam);
const hitPixels=projectedDiameterCss(hitCameraHandle.position,hitCameraHandle.userData.baseRadius*2*hitCameraHandle.scale.x,overlayCamForHandles,800,600);
const sunPixels=projectedDiameterCss(T.sunHandle.position,T.sunHandle.userData.baseRadius*2*T.sunHandle.scale.x,overlayCamForHandles,800,600);
const offAxisProjection=cameraPixels.find(result=>result.name==='off-axis'),extremeNearProjection=cameraPixels.find(result=>result.name==='extreme-near');
assert(T.camBall.userData.pixelDiameter===48&&T.camBall.userData.hitPixelDiameter===27,
  '专业摄影机与透明命中代理的 CSS 目标直径分别为 48px / 27px');
assert(cameraPixels.every(result=>result.synced),'每个近远/FOV/zoom/视口案例均同步 overlay camera 的投影参数和位姿');
assert(cameraPixels.every(result=>result.overlayNear<result.fullDepth-result.fullRadius&&result.overlayFar>result.fullDepth+result.fullRadius&&result.overlayFar/result.overlayNear<20),
  'overlay camera 动态 near/far 完整包围含天线的模型球，且深度比低于 20，足以保留机身内部自遮挡精度');
assert(new Set(cameraPixels.map(result=>`${result.overlayNear.toExponential(4)}/${result.overlayFar.toExponential(4)}`)).size>=4,
  'overlay camera 裁剪范围会随近距、远距、偏屏、zoom 和宽 FOV 案例分别收紧，不沿用 viewCam 巨大距离比');
cameraPixels.forEach(result=>assert(Math.abs(result.pixels-48)<.2,
  `真实 Three.js 投影证明 ${result.name} 摄影机核心保持 48±0.2 CSS px（实测 ${result.pixels.toFixed(3)}px）`));
assert(Math.abs(hitPixels-27)<.2&&Math.abs(sunPixels-24)<.2,'真实 Three.js 投影证明命中代理为 27px，太阳仍为 24px');
assert(Math.abs(offAxisProjection.ndc.x)>.7&&Math.abs(offAxisProjection.ndc.x)<.9&&Math.abs(offAxisProjection.ndc.y)<.9,
  '偏屏测例的摄影机核心位于真实 NDC 屏内边缘，而不是完全离屏');
assert(extremeNearProjection.depth>T.cameraVizCam.near&&extremeNearProjection.depth<T.viewCam.near,
  '极近测例深度小于交互 viewCam near 但大于 overlay near，专用投影摄影机不会将其裁掉');
T.camBall.position.copy(savedCamBallPos);hitCameraHandle.position.copy(savedHitPos);T.sunHandle.position.copy(savedSunPos);
T.viewCam.position.copy(savedViewState.position);T.viewCam.quaternion.copy(savedViewState.quaternion);T.viewCam.fov=savedViewState.fov;T.viewCam.zoom=savedViewState.zoom;T.viewCam.aspect=savedViewState.aspect;T.viewCam.near=savedViewState.near;T.viewCam.far=savedViewState.far;T.viewCam.updateProjectionMatrix();T.viewCam.updateMatrixWorld(true);
viewportEl.clientWidth=savedViewportWidth;viewportEl.clientHeight=savedViewportHeight;sandbox.devicePixelRatio=savedDpr;T.updateVizScales(T.viewCam);

const cameraStageBefore=JSON.stringify(T.stageToData()),cameraProjectBefore=JSON.stringify(T.project);
const cameraAutosaveBefore=sandbox.localStorage._d['previz_autosave_v3'],cameraUndoBefore=T.undoDepth,cameraTimeBefore=T.time;
const cameraShotBefore=JSON.stringify({fov:T.curShot().fov,cam:T.curShot().camPts.map(point=>point.toArray()),camTimes:T.curShot().camTimes,camAimTimes:T.curShot().camAimTimes,camFovTimes:T.curShot().camFovTimes});
const cameraResourcesBefore=T.cameraVizResourceStats(),cameraChildrenBefore=T.camBall.children.slice();
const cameraPartRefsBefore=cameraPartNames.map(name=>T.camBall.getObjectByName(name));
for(let i=0;i<12;i++){T.rebuildViz();T.updateShotCam();T.updateVizScales(T.viewCam);T.renderDirectorViewport();}
const cameraResourcesAfterRebuild=T.cameraVizResourceStats();
const cameraNoDataChange={
  stage:JSON.stringify(T.stageToData())===cameraStageBefore,
  project:JSON.stringify(T.project)===cameraProjectBefore,
  autosave:sandbox.localStorage._d['previz_autosave_v3']===cameraAutosaveBefore,
  undo:T.undoDepth===cameraUndoBefore,
  time:T.time===cameraTimeBefore,
  shot:JSON.stringify({fov:T.curShot().fov,cam:T.curShot().camPts.map(point=>point.toArray()),camTimes:T.curShot().camTimes,camAimTimes:T.curShot().camAimTimes,camFovTimes:T.curShot().camFovTimes})===cameraShotBefore,
};
assert(Object.values(cameraNoDataChange).every(Boolean),
  '反复更新/渲染前后 stageToData、project root、autosave、FOV、路径、时间和 undo 为零变化：'+JSON.stringify(cameraNoDataChange));
assert(JSON.stringify(cameraResourcesAfterRebuild)===JSON.stringify(cameraResourcesBefore)&&
  cameraChildrenBefore.length===T.camBall.children.length&&cameraChildrenBefore.every((child,index)=>child===T.camBall.children[index]),
  '反复 rebuild 复用脱离主场景生命周期的同一组 cameraVizScene 几何/材质和子对象，资源计数不增长');

const dragHandle=T.camHandles.find(handle=>handle.userData.hitTargetOnly),dragPoint=T.curShot().camPts[dragHandle.userData.idx];
dragPoint.y=29.9;dragHandle.position.y=29.9;const dragPointBefore=dragPoint.clone();
T.viewCam.position.copy(dragPoint).add(new V3(0,0,10));T.viewCam.lookAt(dragPoint);T.viewCam.updateMatrixWorld(true);T.updateVizScales(T.viewCam);dragHandle.updateMatrixWorld(true);
const glForCamera=el('gl'),centerX=glForCamera.clientWidth/2,centerY=glForCamera.clientHeight/2;
glForCamera.dispatch('pointerdown',{button:0,clientX:centerX,clientY:centerY,shiftKey:false});
const transparentHandleWasPicked=T.dragging?.handle===dragHandle;
glForCamera.dispatch('pointermove',{buttons:1,clientX:centerX,clientY:centerY,movementX:0,movementY:-1000,altKey:true});
const altDragUpper=dragPoint.y;
glForCamera.dispatch('pointermove',{buttons:1,clientX:centerX,clientY:centerY,movementX:0,movementY:2000,altKey:true});
const altDragLower=dragPoint.y,transparentHandleMoved=Math.abs(dragPoint.y-dragPointBefore.y)>.1;
glForCamera.dispatch('pointerup',{});
assert(transparentHandleWasPicked&&transparentHandleMoved&&T.previewCamPt===dragHandle.userData.idx,
  '完全透明命中代理仍能被真实 raycast 点选和 Alt 拖动，且继续触发原机位点独立预览');
assert(altDragUpper===30&&altDragLower===.2,'Alt 拖机位按独立 oracle 限制在 0.2–30m');
dragPoint.copy(dragPointBefore);T.clearPointPreview();T.updateShotCam();T.rebuildViz();
T.viewCam.position.copy(savedViewState.position);T.viewCam.quaternion.copy(savedViewState.quaternion);T.viewCam.fov=savedViewState.fov;T.viewCam.zoom=savedViewState.zoom;T.viewCam.aspect=savedViewState.aspect;T.viewCam.updateProjectionMatrix();T.viewCam.updateMatrixWorld(true);T.updateVizScales(T.viewCam);

section('点选机位/调度点即时预览');
const previewShot=T.curShot();previewShot.lock='手动朝向';
const previewKeys=T.ensureCamKeys(previewShot),previewIdx=Math.min(1,previewShot.camPts.length-1);
previewKeys[previewIdx]={yaw:45,pitch:-12,fov:67};
const independentTime=T.time,actorPositionsBefore=T.actors.map(a=>a.obj.position.clone());
T.previewCameraPoint(previewIdx);
assert(T.previewCamPt===previewIdx&&!T.playing&&T.shotCam.position.distanceTo(previewShot.camPts[previewIdx])<.001,
  '点选红色机位点后停止播放，监视器摄影机精确到该点');
assert(T.time===independentTime&&T.actors.every((a,i)=>a.obj.position.distanceTo(actorPositionsBefore[i])<.001),
  '机位点独立预览：时间不跳、所有角色和道具不动');
assert(Math.abs(T.shotCam.fov-67)<.01&&Math.abs(T.shotCam.rotation.x*180/Math.PI+12)<.1,
  '点位预览使用该点独立 FOV 与俯仰角');
assert(el('monTitle').textContent.includes('机位点'+(previewIdx+1))&&el('monTitle').textContent.includes('独立预览'), '右侧监视器标明当前机位点独立预览');
el('fov').oninput({target:{value:'72'}});frames(1);
assert(Math.abs(T.shotCam.fov-72)<.01, '预览中修改机位点 FOV，监视器下一帧实时更新');
const cameraBeforeActorPreview=T.shotCam.position.clone(),otherActor=T.actors.find(a=>a!==route),otherBefore=otherActor.obj.position.clone();
T.select(route);T.previewActorPathPoint(route,1);frames(1);
assert(T.previewActorPoint&&route.obj.position.distanceTo(new V3(route.pathPts[1].x,route.elev||0,route.pathPts[1].z))<.001,
  '点选黄色调度点后，对象精确落在该点');
assert(T.time===independentTime&&T.shotCam.position.distanceTo(cameraBeforeActorPreview)<.001&&otherActor.obj.position.distanceTo(otherBefore)<.001,
  '调度点独立预览：时间、摄影机和其他对象都不动');
assert(T.previewCamPt===previewIdx&&T.previewActorCount===1,
  '点调度点时保留已选机位，可组合查看“该机位 + 该对象位置”');
assert(el('monTitle').textContent.includes(route.label+'调度点2')&&el('monTitle').textContent.includes('独立预览')&&/(本镜头|全场)/.test(el('actorPtPos').textContent),
  '监视器同步显示组合点位，右栏按当前时间策略保留路径参考时间与空间参数');
T.clearPointPreview();
if(requestedModule==='camera'){
  const cameraSceneSwitchIndex=T.sceneIdx,cameraSceneSwitchShot=T.shotIdx,cameraSceneSwitchTime=T.time;
  const cameraSceneSwitchStage=JSON.stringify(T.stageToData()),cameraSceneSwitchProject=JSON.stringify(T.project);
  const cameraOriginalProjectScene=T.project.scenes[cameraSceneSwitchIndex];
  const cameraDuplicateScene=JSON.parse(cameraSceneSwitchStage);
  cameraDuplicateScene.name+=' camera-viz-resource-check';
  T.project.scenes.push(cameraDuplicateScene);
  const cameraPushedProject=JSON.stringify(T.project),cameraSceneSwitchAutosave=sandbox.localStorage._d['previz_autosave_v3'];
  T.loadScene(T.project.scenes.length-1,true);
  const cameraResourcesAfterSceneSwitch=T.cameraVizResourceStats();
  const cameraPartRefsAfterSceneSwitch=cameraPartNames.map(name=>T.camBall.getObjectByName(name));
  assert(JSON.stringify(T.project)===cameraPushedProject&&sandbox.localStorage._d['previz_autosave_v3']===cameraSceneSwitchAutosave,
    'duplicate scene → loadScene 不改写已压入的 project root 或 autosave');
  assert(JSON.stringify(cameraResourcesAfterSceneSwitch)===JSON.stringify(cameraResourcesBefore)&&
    cameraChildrenBefore.length===T.camBall.children.length&&cameraChildrenBefore.every((child,index)=>child===T.camBall.children[index])&&
    cameraPartRefsBefore.every((part,index)=>part===cameraPartRefsAfterSceneSwitch[index]),
    'duplicate scene → loadScene 仍复用同一组 cameraVizScene 几何/材质、直属子对象和命名部件，资源计数不增长');
  T.project.scenes.pop();
  T.project.scenes[cameraSceneSwitchIndex]=JSON.parse(cameraSceneSwitchStage);
  T.loadScene(cameraSceneSwitchIndex,true);
  T.project.scenes[cameraSceneSwitchIndex]=cameraOriginalProjectScene;
  if(T.shotIdx!==cameraSceneSwitchShot)T.setShot(cameraSceneSwitchShot,false);
  T.setTime(cameraSceneSwitchTime);T.updateShotCam();
  JSON.parse(cameraSceneSwitchStage).actors.forEach((actorData,index)=>{
    const actor=T.actors[index];
    actor.obj.position.x=actorData.pos[0];actor.obj.position.z=actorData.pos[1];
    actor.obj.rotation.y=actorData.rotY;actor.elev=actorData.height;
  });
  const cameraSceneSwitchStageAfter=JSON.stringify(T.stageToData());
  const cameraSceneSwitchStageDiffAt=[...cameraSceneSwitchStage].findIndex((char,index)=>char!==cameraSceneSwitchStageAfter[index]);
  const cameraSceneSwitchRestored={scene:T.sceneIdx===cameraSceneSwitchIndex,shot:T.shotIdx===cameraSceneSwitchShot,time:T.time===cameraSceneSwitchTime,
    stage:cameraSceneSwitchStageAfter===cameraSceneSwitchStage,project:JSON.stringify(T.project)===cameraSceneSwitchProject,
    autosave:sandbox.localStorage._d['previz_autosave_v3']===cameraSceneSwitchAutosave};
  assert(Object.values(cameraSceneSwitchRestored).every(Boolean),
    '隔离切场验证后恢复原 scene/shot/time、运行时 stage、project root 与 autosave：'+JSON.stringify(cameraSceneSwitchRestored)+
    `；stage diff@${cameraSceneSwitchStageDiffAt}: ${cameraSceneSwitchStage.slice(cameraSceneSwitchStageDiffAt-40,cameraSceneSwitchStageDiffAt+100)} <> ${cameraSceneSwitchStageAfter.slice(cameraSceneSwitchStageDiffAt-40,cameraSceneSwitchStageDiffAt+100)}`);
}

section('对象高度 + 一键贴地');
el('objHeight').oninput({ target: { value: '3' } });
assert(Math.abs(route.elev - 3) < .01 && Math.abs(route.obj.position.y - 3) < .01, '高度控件同步对象根节点 Y');
T.updateActors();
assert(Math.abs(route.obj.position.y - 3) < .01, '调度路径播放不再把对象高度清零');
T.snapActorToGround(route);
const groundBox = T.actorWorldBox(route);
assert(Math.abs(groundBox.min.y) < .03, '一键贴地后模型最低点接触地面 (minY=' + groundBox.min.y.toFixed(3) + ')');
T.setActorElevation(route, 2);
assert(T.stageToData().actors.find(a => a.label === route.label).height === 2, '对象高度进入序列化');

section('对象失踪恢复: 坐标保护 / 定位选中 / 全局取景');
const escaped = T.buildActor({ kind: 'prop', label: '越界测试', pos: [999, -999], height: 999, rotY: 0,
  path: [[999, -999], [-999, 999]] });
assert(escaped.obj.position.x === 29.5 && escaped.obj.position.z === -29.5 && escaped.elev === 20,
  '载入时把越界坐标/高度收回有效舞台');
assert(escaped.pathPts.every(p => Math.abs(p.x) <= 29.5 && Math.abs(p.z) <= 29.5), '越界调度点收回 60m 棋盘范围');
T.select(escaped); el('locateActor').click();
const escapedCenter = T.actorWorldBox(escaped).getCenter(new V3());
assert(T.orbit.target.distanceTo(escapedCenter) < .01, '“定位选中”以对象真实包围盒重新取景');
el('fitAll').click();
assert(Number.isFinite(T.orbit.dist) && T.orbit.dist > 20 && T.orbit.target.length() > 5,
  '“全局”按全部对象范围重新取景，不再固定看原点');
escaped.obj.visible = false; T.actors.splice(T.actors.indexOf(escaped), 1); T.select(route);

section('对象碰撞: 接触允许 / 大步防穿透 / 高度错层');
const mover = T.buildActor({ kind: 'prop', label: '碰撞移动体', pos: [-24, -24], rotY: 0, path: [] });
const blocker = T.buildActor({ kind: 'prop', label: '碰撞障碍', pos: [-22, -24], rotY: 0, path: [] });
const moverSize = T.actorWorldBox(mover).getSize(new V3());
assert(moverSize.x < 1.1, '碰撞盒排除 Sprite 标签 (宽=' + moverSize.x.toFixed(2) + 'm)');
assert(!T.actorPenetrates(mover), '碰撞测试初始位置无重叠');
T.moveActorSafely(mover, -19, -24); // 一次跨过障碍，仍应停在近侧接触面
assert(mover.obj.position.x < blocker.obj.position.x - .8, '大步拖动未穿过障碍 (x=' + mover.obj.position.x.toFixed(2) + ')');
assert(!T.boxesPenetrate(T.actorWorldBox(mover), T.actorWorldBox(blocker)), '接触边界合法且没有正重叠');
T.setActorElevation(mover, 3);
T.moveActorSafely(mover, blocker.obj.position.x, blocker.obj.position.z);
assert(Math.abs(mover.obj.position.x - blocker.obj.position.x) < .05, '垂直错层后可从障碍上方通过');
el('collisionOn').checked = false; el('collisionOn').onchange({ target: el('collisionOn') });
T.setActorElevation(mover, 0); T.moveActorSafely(mover, blocker.obj.position.x, blocker.obj.position.z);
assert(T.actorPenetrates(mover), '关闭碰撞后允许特殊穿插效果');
assert(T.project.settings.collision === false, '碰撞开关写入项目设置');
mover.obj.position.set(-24, 0, -24); mover.elev = 0;
el('collisionOn').checked = true; el('collisionOn').onchange({ target: el('collisionOn') });
assert(T.project.settings.collision === true, '碰撞默认/恢复为开启');

/* ---- 剧本 → 分镜 ---- */
section('剧本 → 分镜规则引擎');
const beats = T.parseBeats('他站在门口。她没有回头!「你要走了吗?」他问;她终于转身。\n两人对视良久。');
assert(beats.length === 6, '节拍切分(句号/叹号/问号/分号/换行, 引号内标点也切)= 6, 实际 ' + beats.length);
const screenplayAnalysis=T.analyzeStoryboardScript("MAYA\n(quietly)\nI'm ready.\nMaya says she will go.");
assert(screenplayAnalysis.namedCharacters.length===1&&screenplayAnalysis.namedCharacters[0]==='MAYA'&&
  screenplayAnalysis.beats[0].type==='action'&&screenplayAnalysis.beats[0].speakerName==='MAYA'&&
  screenplayAnalysis.beats.slice(1).every(beat=>beat.speakerName==='MAYA'),
  '英文说话人大小写归一，标准括号表演指示归为角色动作而不是对白');
const templateIds=T.SCENE_TEMPLATES.map(template=>template.id);
assert(JSON.stringify(templateIds)===JSON.stringify(['dialogue','performance','chase','establishing']),
  '新建场景只提供对话、单人表演、动作追逐和环境建立四个常用模板');
const neutralShot=T.makeNeutralShot(),blankScene=T.makeBlankScene(7);
assert(neutralShot.name===sandbox.PreVisionI18n.t('scene.blank.shotName')&&neutralShot.dur===5&&neutralShot.fov===40&&
  neutralShot.lock==='全局'&&neutralShot.timingMode==='custom'&&neutralShot.syncActor===''&&
  JSON.stringify(neutralShot.cam)===JSON.stringify([[6,3,6]])&&!('camAim' in neutralShot)&&!('camTimes' in neutralShot),
  '中性空镜头使用确定性的 project-v5 单机位、全局锁、静止时长/FOV，且不携带 camera sidecar');
assert(blankScene.name===sandbox.PreVisionI18n.t('scene.blank.name',{index:7})&&blankScene.actors.length===0&&blankScene.shots.length===1&&
  blankScene.ground.style==='checker'&&!('templateId' in blankScene)&&!('script' in blankScene)&&!('bg' in blankScene)&&!('sun' in blankScene),
  '空白场景纯工厂不含人物、路径、脚本、背景、太阳、模板标识或自定义地面资产');
const normalizedBlank=T.normalizeProjectData({app:'PreVision',version:5,name:'blank',aspect:'16:9',assets:{},settings:{},scenes:[blankScene]});
assert(normalizedBlank.version===5&&normalizedBlank.scenes[0].actors.length===0&&normalizedBlank.scenes[0].shots.length===1&&
  normalizedBlank.scenes[0].shots[0].lock==='全局'&&normalizedBlank.scenes[0].shots[0].syncActor==='',
  '空白场景保持合法 project-v5，既有归一化只物化中性引擎底座');
assert(!html.includes('一镜到底·情绪沉淀')&&!html.includes('蒙太奇·关系断裂')&&!html.includes('压迫·空间收紧'),
  '旧的导演路线已从运行时模板和新建场景弹窗移除');
T.SCENE_TEMPLATES.forEach(template=>{
  const labels=template.actors.map(actor=>actor.label),materialized=T.materializeSceneTemplate(template);
  assert(template.shots.length>=4&&materialized.templateId===template.id,
    `模板 ${template.id} 至少有 4 个镜头且写入稳定 templateId`);
  template.shots.forEach((shot,index)=>{
    assert(labels.includes(shot.lock)&&shot.fov>=10&&shot.fov<=110&&shot.dur>=1&&shot.dur<=15&&
      Array.isArray(shot.cam)&&shot.cam.length>=1&&shot.cam.every(point=>point.length===3&&point.every(Number.isFinite)),
      `模板 ${template.id} 镜头 ${index+1} 的 lock/FOV/时长/机位合法`);
  });
});
flushTimeouts();T.syncScene();T.initHistory();
const blankSceneCount=T.project.scenes.length,blankHistoryBefore=T.historyCommitSequence,blankWritesBefore=sandbox.localStorage._writes;
el('addScene').click();
const templateButtons=el('tplBtns').children;
assert(el('tplDlg').open===true&&templateButtons.length===5&&templateButtons.every(button=>button.children.length===2),
  '新建场景弹窗渲染独立空白入口和既有四个模板卡片');
templateButtons[0].click();
assert(T.project.scenes.length===blankSceneCount+1&&T.actors.length===0&&T.shots.length===1&&T.selected===null&&
  !T.curScene().templateId&&!T.curScene().bg&&T.curScene().ground.style==='checker'&&
  T.curShot().lock==='全局'&&T.curShot().syncActor===''&&T.historyPending&&T.dirtyTimer!==null,
  '空白入口创建无内容场景和一个可编辑中性镜头，并只排队一次 history/autosave');
flushTimeouts();
assert(T.undoDepth===1&&T.historyCommitSequence===blankHistoryBefore+1&&sandbox.localStorage._writes===blankWritesBefore+1,
  '空白场景成功创建只结算一次 history 事务和一次 autosave');
T.undoLast();assert(T.project.scenes.length===blankSceneCount,'空白场景创建可由一次 Undo 恢复');flushTimeouts();T.initHistory();
const templateSceneCount=T.project.scenes.length;
el('addScene').click();
el('tplBtns').children[2].click();
assert(T.project.scenes.length===templateSceneCount+1&&T.curScene().templateId==='performance'&&T.shots.length===4,
  '从弹窗选择单人表演后创建带稳定 templateId 的四镜场景');
assert(T.detectStoryTemplate('「你来了？」他问。「我来了。」她回答。')==='dialogue',
  '自动识别对白文本为双人正反打');
assert(T.detectStoryTemplate('他骑马冲出城门，追逐的车辆迎面而来。')==='chase',
  '自动识别动作文本为追逐轴线模板');
assert(T.detectStoryTemplate('清晨的沙漠连接远山，天空下只有一座旧屋。')==='establishing',
  '自动识别环境文本为空间交代模板');
assert(T.detectStoryTemplate('她独自站在台上表演，等待灯光亮起。')==='performance',
  '自动识别单人文本为景别递进模板');
const fastChase=T.genStoryboard('他冲出门开始追逐。','action','fast','chase');
const slowChase=T.genStoryboard('他冲出门开始追逐。','action','slow','chase');
assert(fastChase.length===4&&fastChase.every((shot,index)=>shot.name===sandbox.PreVisionI18n.t(`sceneTemplate.chase.shot${index+1}.name`)),
  '剧本生成共用新追逐模板的镜头结构与命名');
assert(fastChase.reduce((sum,shot)=>sum+shot.dur,0)<slowChase.reduce((sum,shot)=>sum+shot.dur,0),
  '节奏只在同一模板结构上微调镜头时长');
assert(storyboardCorpus.schemaVersion===1&&storyboardCorpus.cases.length>=6,
  '合成分镜语料已登记中英文、歧义、长文本与手动覆盖案例');
T.loadScene(0);
const plannerSource=T.currentStoryboardSourceSnapshot().scene;
const networkCalls=[];
const denyStoryboardNetwork=kind=>(...args)=>{networkCalls.push([kind,...args]);throw new Error('network disabled: '+kind);};
const previousNetwork={
  fetch:sandbox.fetch,XMLHttpRequest:sandbox.XMLHttpRequest,WebSocket:sandbox.WebSocket,EventSource:sandbox.EventSource,
  sendBeacon:sandbox.navigator.sendBeacon,
};
sandbox.fetch=denyStoryboardNetwork('fetch');
sandbox.XMLHttpRequest=function(){return denyStoryboardNetwork('XMLHttpRequest')();};
sandbox.WebSocket=function(){return denyStoryboardNetwork('WebSocket')();};
sandbox.EventSource=function(){return denyStoryboardNetwork('EventSource')();};
sandbox.navigator.sendBeacon=denyStoryboardNetwork('sendBeacon');
const corpusPlans=[];
try{
  storyboardCorpus.cases.forEach(testCase=>{
    const first=T.buildStoryboardPlan(testCase.script,testCase.options,plannerSource);
    const second=T.buildStoryboardPlan(testCase.script,testCase.options,plannerSource);
    corpusPlans.push(first);
    assert(first&&JSON.stringify(first)===JSON.stringify(second),
      '相同输入与选项重复分析保持完全确定: '+testCase.id);
    const validation=T.validateStoryboardPlan(first);
    assert(validation.valid,
      '合成语料计划通过角色、覆盖、轴线和数值校验: '+testCase.id+' ('+validation.errors.join(',')+')');
    assert(first.shots.length>=(testCase.expect.minShots||testCase.expect.shotCount)&&
      first.shots.length<=(testCase.expect.maxShots||testCase.expect.shotCount),
      '动态镜头数满足 4–8 或明确期望: '+testCase.id+' = '+first.shots.length);
    if(testCase.expect.templateId)assert(first.templateId===testCase.expect.templateId,
      '模板选择符合合成语料: '+testCase.id+' → '+first.templateId);
    if(testCase.expect.templateReasonCode)assert(first.templateDecision.reasonCode===testCase.expect.templateReasonCode,
      '手动模板覆盖带稳定理由代码: '+testCase.id);
    if(testCase.expect.namedCharacters)assert(JSON.stringify(first.roles.map(role=>role.sourceName))===JSON.stringify(testCase.expect.namedCharacters),
      '中英文说话人顺序稳定: '+testCase.id);
    if(testCase.expect.requiredBeatTypes)assert(testCase.expect.requiredBeatTypes.every(type=>first.beats.some(beat=>beat.type===type)),
      '对白、动作与环境节拍分类覆盖期望: '+testCase.id);
    if(testCase.expect.minAmbiguousBeats)assert(first.beats.filter(beat=>beat.ambiguous).length>=testCase.expect.minAmbiguousBeats,
      '混合文本输出明确的低置信度回退节拍: '+testCase.id);
    assert(first.beats.every(beat=>beat.coverageShotIds.length||beat.mergeReasonCode),
      '每个有效节拍均由镜头覆盖或带合并理由: '+testCase.id);
    assert(first.shots.every(shot=>shot.reasonCode&&shot.confidence>=0&&shot.confidence<=1&&
      shot.cam.every(point=>{
        const cross=(first.axis.direction[0]*(point[2]-first.axis.origin[1])-first.axis.direction[1]*(point[0]-first.axis.origin[0]))*first.axis.side;
        return cross>0;
      })),
      '每镜包含理由/置信度且所有机位保持在同一 180° 轴线侧: '+testCase.id);
    if(testCase.expect.requiresMergeReason)assert(first.beats.some(beat=>beat.mergeReasonCode)&&first.shots.some(shot=>shot.mergeReasonCode),
      '超过八镜的长剧本为相邻节拍记录明确合并理由: '+testCase.id);
  });
  const localeCase=storyboardCorpus.cases[0],localeBefore=sandbox.PreVisionI18n.getLocale();
  sandbox.PreVisionI18n.setLocale('zh-CN');
  const zhPlan=T.buildStoryboardPlan(localeCase.script,localeCase.options,plannerSource);
  sandbox.PreVisionI18n.setLocale('en-US');
  const enPlan=T.buildStoryboardPlan(localeCase.script,localeCase.options,plannerSource);
  sandbox.PreVisionI18n.setLocale(localeBefore);
  assert(JSON.stringify(zhPlan)===JSON.stringify(enPlan),
    '切换 UI locale 不改变分析词典、模板、角色、覆盖或机位业务结果');
}finally{
  if(previousNetwork.fetch===undefined)delete sandbox.fetch;else sandbox.fetch=previousNetwork.fetch;
  if(previousNetwork.XMLHttpRequest===undefined)delete sandbox.XMLHttpRequest;else sandbox.XMLHttpRequest=previousNetwork.XMLHttpRequest;
  if(previousNetwork.WebSocket===undefined)delete sandbox.WebSocket;else sandbox.WebSocket=previousNetwork.WebSocket;
  if(previousNetwork.EventSource===undefined)delete sandbox.EventSource;else sandbox.EventSource=previousNetwork.EventSource;
  if(previousNetwork.sendBeacon===undefined)delete sandbox.navigator.sendBeacon;else sandbox.navigator.sendBeacon=previousNetwork.sendBeacon;
}
assert(networkCalls.length===0&&appSrc.includes('STORYBOARD_ANALYSIS_LEXICON')&&!appSrc.includes('storyboard.keywords.'),
  '分镜分析完全离线，且业务词典不再读取 UI 翻译资源');
assert(new Set(corpusPlans.map(plan=>plan.shots.length)).size>=3&&corpusPlans.some(plan=>plan.shots.length>4),
  '语料得到多种动态镜头数量，不再固定四镜');
const sourceCharacters=plannerSource.actors.filter(actor=>actor.kind==='char');
const mappingCase=storyboardCorpus.cases.find(testCase=>testCase.id==='zh-dialogue-fullwidth-punctuation');
const swappedPlan=T.buildStoryboardPlan(mappingCase.script,Object.assign({},mappingCase.options,{
  roleMappings:{primary:sourceCharacters[1].label,secondary:sourceCharacters[0].label},
}),plannerSource);
assert(swappedPlan.roles[0].actorLabel===sourceCharacters[1].label&&swappedPlan.roles[1].actorLabel===sourceCharacters[0].label&&
  swappedPlan.shots.every(shot=>shot.lockActorLabel===swappedPlan.roles.find(role=>role.id===shot.subjectRole)?.actorLabel),
  '修正主要角色映射会稳定更新镜头主体与视线角色');
const scenesBefore = T.project.scenes.length;
const projectBeforeAnalysis=JSON.stringify(T.project),autosaveBeforeAnalysis=sandbox.localStorage._d['previz_autosave_v3'],undoBeforeAnalysis=T.undoDepth;
el('aiStoryboard').click();
assert(el('storyDlg').open===true&&T.pendingStoryboardPlan===null,
  '打开规划器只建立瞬时来源快照，不预先生成或写入计划');
const selectionBeforeStoryTextDelete=T.selected;
T.select(null);
const alertsBeforeStoryTextDelete=sandbox.__alerts.length,actorsBeforeStoryTextDelete=T.actors.length;
const editableStoryTargets=[el('storyText'),el('projname'),el('aspect'),Object.assign(makeEl('div'),{isContentEditable:true})];
const storyTextDeleteEvents=['Backspace','Delete'].map(key=>fireWindow('keydown',{key,code:key,target:el('storyText')}));
const otherEditableDeleteEvents=editableStoryTargets.slice(1).map(target=>fireWindow('keydown',{key:'Delete',code:'Delete',target}));
assert(sandbox.__alerts.length===alertsBeforeStoryTextDelete&&T.actors.length===actorsBeforeStoryTextDelete&&
  storyTextDeleteEvents.concat(otherEditableDeleteEvents).every(event=>!event.defaultPrevented),
  '剧本输入框及其他可编辑控件内删除文字只交给原生编辑，不触发删除场景对象快捷键');
fireWindow('keydown',{key:'Delete',code:'Delete',target:documentStub.body});
assert(sandbox.__alerts.length===alertsBeforeStoryTextDelete&&T.actors.length===actorsBeforeStoryTextDelete,
  '分镜 modal 打开时即使事件目标异常落到页面 body，Delete 也不穿透到背后对象命令');
T.select(selectionBeforeStoryTextDelete);
const defaultDialogBounds=T.getStoryboardDialogBounds();
assert(defaultDialogBounds.left===320&&defaultDialogBounds.top===70&&defaultDialogBounds.width===960&&defaultDialogBounds.height===760,
  '规划器默认以 960×760 居中打开，并由应用视口而非 macOS 系统全屏控制');
const resizeStageBefore=JSON.stringify(T.stageToData()),resizeSelectedBefore=T.selected;
const resizeHandle=el('storyResizeSE');let capturedPointer=null,releasedPointer=null;
resizeHandle.setPointerCapture=pointerId=>{capturedPointer=pointerId;};
resizeHandle.releasePointerCapture=pointerId=>{releasedPointer=pointerId;};
const resizeDown=makeEvent({clientX:100,clientY:100,pointerId:7,button:0});
resizeHandle.dispatch('pointerdown',resizeDown);
fireWindow('pointermove',{clientX:237,clientY:183,pointerId:7});
let resizedBounds=T.getStoryboardDialogBounds();
assert(resizeDown.defaultPrevented&&resizeDown.propagationStopped&&capturedPointer===7&&
  resizedBounds.width===1097&&resizedBounds.height===843&&documentStub.body.classList.contains('story-dialog-resizing'),
  '右下角手柄按指针连续二维改变宽高，不吸附到预设档位，并阻止选择文字或误触底层导演台');
fireWindow('pointermove',{clientX:-9999,clientY:-9999,pointerId:7});
resizedBounds=T.getStoryboardDialogBounds();
assert(resizedBounds.width===760&&resizedBounds.height===640,
  '连续拖拽不会越过可用的 760×640 最小尺寸');
fireWindow('pointermove',{clientX:9999,clientY:9999,pointerId:7});
resizedBounds=T.getStoryboardDialogBounds();
assert(resizedBounds.left===16&&resizedBounds.top===16&&resizedBounds.width===1568&&resizedBounds.height===868,
  '连续拖拽最大尺寸被夹在当前 1600×900 视口边界内');
fireWindow('pointerup',{pointerId:7});
assert(T.storyboardDialogResizeSession===null&&!documentStub.body.classList.contains('story-dialog-resizing')&&releasedPointer===7&&
  JSON.stringify(T.stageToData())===resizeStageBefore&&T.selected===resizeSelectedBefore,
  '拖拽结束释放指针与防选状态，且不改变场景数据或底层选择');
T.resetStoryboardDialogWindow();
resizeHandle.dispatch('pointerdown',makeEvent({clientX:20,clientY:20,pointerId:8,button:0}));
fireWindow('pointercancel',{pointerId:8});
assert(T.storyboardDialogResizeSession===null&&!documentStub.body.classList.contains('story-dialog-resizing'),
  '指针取消会清理规划器缩放会话');
const widthKey=makeEvent({key:'ArrowRight'}),heightKey=makeEvent({key:'ArrowDown',shiftKey:true});
resizeHandle.dispatch('keydown',widthKey);resizeHandle.dispatch('keydown',heightKey);
resizedBounds=T.getStoryboardDialogBounds();
assert(widthKey.defaultPrevented&&heightKey.defaultPrevented&&resizedBounds.width===976&&resizedBounds.height===824,
  '键盘方向键可达并以 16px / Shift+64px 微调规划器尺寸');
const preFullscreen=T.applyStoryboardDialogBounds({left:80,top:40,width:1001,height:777});
el('storyFullscreen').click();
let fullscreenBounds=T.getStoryboardDialogBounds();
assert(T.storyboardDialogFullscreen&&el('storyDlg').classList.contains('story-fullscreen')&&
  fullscreenBounds.left===0&&fullscreenBounds.top===0&&fullscreenBounds.width===1600&&fullscreenBounds.height===900&&
  el('storyFullscreen').getAttribute('aria-pressed')==='true'&&el('storyFullscreen').textContent===sandbox.PreVisionI18n.t('storyboard.window.restore'),
  '标题栏应用内全屏占满 PreVision 内容视口，并同步双语按钮和 aria 状态');
el('storyFullscreen').click();
resizedBounds=T.getStoryboardDialogBounds();
assert(!T.storyboardDialogFullscreen&&resizedBounds.left===preFullscreen.left&&resizedBounds.top===preFullscreen.top&&
  resizedBounds.width===preFullscreen.width&&resizedBounds.height===preFullscreen.height&&
  el('storyFullscreen').getAttribute('aria-pressed')==='false',
  '从应用内全屏还原时精确恢复进入全屏前的自定义尺寸');
sandbox.innerWidth=900;sandbox.innerHeight=650;fireWindow('resize');
resizedBounds=T.getStoryboardDialogBounds();
assert(resizedBounds.left>=16&&resizedBounds.top>=16&&resizedBounds.left+resizedBounds.width<=884&&resizedBounds.top+resizedBounds.height<=634,
  '主窗口缩小后，普通规划器尺寸和位置被夹回可视区域');
el('storyFullscreen').click();sandbox.innerWidth=760;sandbox.innerHeight=560;fireWindow('resize');
fullscreenBounds=T.getStoryboardDialogBounds();
assert(T.storyboardDialogFullscreen&&fullscreenBounds.left===0&&fullscreenBounds.top===0&&fullscreenBounds.width===760&&fullscreenBounds.height===560,
  '主窗口缩小时，应用内全屏继续精确填满当前内容视口');
el('storyFullscreen').click();
resizedBounds=T.getStoryboardDialogBounds();
assert(!T.storyboardDialogFullscreen&&resizedBounds.left===16&&resizedBounds.top===16&&resizedBounds.width===728&&resizedBounds.height===528,
  '超小视口还原时会按可用边界降低最小值，不会溢出屏幕');
sandbox.innerWidth=1600;sandbox.innerHeight=900;fireWindow('resize');T.resetStoryboardDialogWindow();
const cornerCases=[
  ['storyResizeNW',32,24,{left:352,top:94,width:928,height:736,right:1280,bottom:830},'NW'],
  ['storyResizeNE',32,24,{left:320,top:94,width:992,height:736,right:1312,bottom:830},'NE'],
  ['storyResizeSW',32,24,{left:352,top:70,width:928,height:784,right:1280,bottom:854},'SW'],
  ['storyResizeSE',32,24,{left:320,top:70,width:992,height:784,right:1312,bottom:854},'SE'],
];
cornerCases.forEach(([id,dx,dy,expected,label],index)=>{
  T.resetStoryboardDialogWindow();const handle=el(id),pointerId=20+index;
  handle.dispatch('pointerdown',makeEvent({clientX:100,clientY:100,pointerId,button:0}));
  fireWindow('pointermove',{clientX:100+dx,clientY:100+dy,pointerId});
  const bounds=T.getStoryboardDialogBounds();
  assert(bounds.left===expected.left&&bounds.top===expected.top&&bounds.width===expected.width&&bounds.height===expected.height&&
    bounds.left+bounds.width===expected.right&&bounds.top+bounds.height===expected.bottom,
    `${label} 角缩放保持对边锚定`);
  fireWindow('pointerup',{pointerId});
});
T.resetStoryboardDialogWindow();
const mismatchHandle=el('storyResizeNW');
mismatchHandle.dispatch('pointerdown',makeEvent({clientX:100,clientY:100,pointerId:31,button:0}));
const mismatchBefore=T.getStoryboardDialogBounds();
fireWindow('pointermove',{clientX:50,clientY:50,pointerId:32});fireWindow('pointerup',{pointerId:32});
assert(JSON.stringify(T.getStoryboardDialogBounds())===JSON.stringify(mismatchBefore)&&T.storyboardDialogResizeSession?.pointerId===31,
  '不匹配 pointer 不会改变几何或提前结束缩放');
mismatchHandle.dispatch('lostpointercapture',makeEvent({pointerId:31}));
assert(T.storyboardDialogResizeSession===null,'lostpointercapture 会结束对应四角缩放');
el('storyResizeNE').dispatch('pointerdown',makeEvent({clientX:100,clientY:100,pointerId:33,button:0}));fireWindow('blur',{});
assert(T.storyboardDialogResizeSession===null,'窗口 blur 会结束四角缩放');
T.resetStoryboardDialogWindow();
const nwKey=makeEvent({key:'ArrowLeft'});el('storyResizeNW').dispatch('keydown',nwKey);
let nwKeyBounds=T.getStoryboardDialogBounds();
assert(nwKey.defaultPrevented&&nwKeyBounds.left===304&&nwKeyBounds.width===976&&nwKeyBounds.left+nwKeyBounds.width===1280,
  'NW 键盘方向键按所在角调整并锚定右边');
el('storyResizeNW').dispatch('keydown',makeEvent({key:'Home'}));
assert(T.getStoryboardDialogBounds().left===320&&T.getStoryboardDialogBounds().width===960&&documentStub.activeElement===el('storyResizeNW'),
  '任一角 Home 恢复默认几何并保留角焦点');
const dialogStateBeforeFullscreen={project:JSON.stringify(T.project),autosave:sandbox.localStorage._d['previz_autosave_v3'],selected:T.selected,pending:T.pendingStoryboardPlan};
el('storyText').value='preserve script';el('storyDialogSetup').scrollTop=37;el('storyPlanScroll').scrollTop=91;
const controlDoubleClick=makeEvent({target:el('storyFullscreen'),currentTarget:el('storyDialogHead')});
assert(T.storyboardDialogHeaderDoubleClick(controlDoubleClick)===false&&!T.storyboardDialogFullscreen,
  '标题栏按钮/控件区双击被排除');
const blankDoubleClick=makeEvent({target:el('storyDialogHead'),currentTarget:el('storyDialogHead')});
assert(T.storyboardDialogHeaderDoubleClick(blankDoubleClick)&&T.storyboardDialogFullscreen,
  '标题栏非控件空白区双击进入应用内全屏');
const disabledCorner=el('storyResizeSE'),fullscreenBeforePointer=T.getStoryboardDialogBounds();
disabledCorner.dispatch('pointerdown',makeEvent({clientX:100,clientY:100,pointerId:40,button:0}));
disabledCorner.dispatch('keydown',makeEvent({key:'ArrowRight'}));fireWindow('pointermove',{clientX:300,clientY:300,pointerId:40});
assert(disabledCorner.disabled&&disabledCorner.tabIndex===-1&&disabledCorner.getAttribute('aria-hidden')==='true'&&
  T.storyboardDialogResizeSession===null&&JSON.stringify(T.getStoryboardDialogBounds())===JSON.stringify(fullscreenBeforePointer),
  '全屏时四角不可聚焦，pointer/键盘缩放均无效');
const firstEsc=el('storyDlg').dispatch('cancel',makeEvent());
assert(firstEsc.defaultPrevented&&!T.storyboardDialogFullscreen&&el('storyDlg').open&&el('storyText').value==='preserve script'&&
  el('storyDialogSetup').scrollTop===37&&el('storyPlanScroll').scrollTop===91,
  'Esc 首次只还原并保留文本与滚动位置');
const secondEsc=el('storyDlg').dispatch('cancel',makeEvent());
assert(!secondEsc.defaultPrevented&&JSON.stringify(T.project)===dialogStateBeforeFullscreen.project&&
  sandbox.localStorage._d['previz_autosave_v3']===dialogStateBeforeFullscreen.autosave&&T.selected===dialogStateBeforeFullscreen.selected&&T.pendingStoryboardPlan===null,
  'Esc 第二次允许原生关闭，且 project/autosave/selection/pending plan 零副作用');
el('storyDlg').open=true;T.resetStoryboardDialogWindow();
el('storyText').value = mappingCase.script;
el('storyTemplate').value = 'auto';
el('storyMood').value = 'tension';
el('storyPace').value = 'standard';
el('storyGen').click();
const firstPreviewPlan=T.pendingStoryboardPlan;
assert(T.project.scenes.length===scenesBefore&&JSON.stringify(T.project)===projectBeforeAnalysis&&
  sandbox.localStorage._d['previz_autosave_v3']===autosaveBeforeAnalysis&&T.undoDepth===undoBeforeAnalysis,
  '分析预览不修改项目、autosave 或撤销栈');
assert(firstPreviewPlan?.templateId==='dialogue'&&el('storyPreview').hidden===false&&el('storyApply').disabled===false&&
  el('storyBeatList').children.length===firstPreviewPlan.beats.length&&el('storyShotList').children.length===firstPreviewPlan.shots.length,
  '分析后显示可应用的模板理由、节拍覆盖和动态镜头卡，不直接切换场景 ('+
    [firstPreviewPlan?.templateId,el('storyPreview').hidden,el('storyApply').disabled,
      el('storyBeatList').children.length+'/'+firstPreviewPlan?.beats.length,
      el('storyShotList').children.length+'/'+firstPreviewPlan?.shots.length,
      T.validateStoryboardPlan(firstPreviewPlan).errors.join(',')].join(' | ')+')');
assert(el('storyRoleList').children.length===2&&el('storyShotList').children.every(card=>card.children[2]?.children.length===3),
  '预览提供两名主要角色映射，以及每镜主体、时长和 FOV 编辑控件');
firstPreviewPlan.shots.forEach(s => {
  assert(s.dur >= 1 && s.dur <= 15, `计划镜头 ${s.id} 时长合法 (${s.dur}s)`);
  assert(s.cam.length >= 1 && s.cam.every(p => p.length===3&&p.every(Number.isFinite)), `计划镜头 ${s.id} 机位点坐标有效`);
  assert(s.fov >= 10 && s.fov <= 110, `计划镜头 ${s.id} FOV 合法 (${s.fov})`);
});
const originalPrimary=firstPreviewPlan.roles[0].actorLabel,originalSecondary=firstPreviewPlan.roles[1].actorLabel;
let firstShotFields=el('storyShotList').children[0].children[2];
let subjectEditor=firstShotFields.children[0].children[1];subjectEditor.value=originalSecondary;subjectEditor.onchange();
firstShotFields=el('storyShotList').children[0].children[2];
let durationEditor=firstShotFields.children[1].children[1];durationEditor.value='7.5';durationEditor.onchange();
firstShotFields=el('storyShotList').children[0].children[2];
let fovEditor=firstShotFields.children[2].children[1];fovEditor.value='55';fovEditor.onchange();
assert(T.pendingStoryboardPlan.shots[0].subjectRole==='secondary'&&T.pendingStoryboardPlan.shots[0].dur===7.5&&T.pendingStoryboardPlan.shots[0].fov===55,
  '临时计划允许编辑镜头主体、时长和 FOV，并保持在合法范围');
let roleRows=el('storyRoleList').children;
let secondaryMapping=roleRows[1].children[1].children[1];secondaryMapping.value=originalPrimary;secondaryMapping.onchange();
roleRows=el('storyRoleList').children;
let primaryMapping=roleRows[0].children[1].children[1];primaryMapping.value=originalSecondary;primaryMapping.onchange();
assert(T.pendingStoryboardPlan.roles[0].actorLabel===originalSecondary&&T.pendingStoryboardPlan.roles[1].actorLabel===originalPrimary&&
  T.pendingStoryboardPlan.shots.every(shot=>shot.lockActorLabel===T.pendingStoryboardPlan.roles.find(role=>role.id===shot.subjectRole)?.actorLabel)&&
  T.pendingStoryboardPlan.shots[0].subjectRole==='secondary'&&T.pendingStoryboardPlan.shots[0].dur===7.5&&T.pendingStoryboardPlan.shots[0].fov===55,
  '预览内修正两个主要角色映射会重算角色机位，同时保留逐镜主体、时长和 FOV 编辑');
el('storyText').dispatch('input');
assert(T.storyboardPlanStale&&el('storyApply').disabled&&el('storyPlanState').classList.contains('stale'),
  '剧本或选项变化会把计划标记为过期并禁用应用');
firstShotFields=el('storyShotList').children[0].children[2];
fovEditor=firstShotFields.children[2].children[1];fovEditor.value='56';fovEditor.onchange();
roleRows=el('storyRoleList').children;
primaryMapping=roleRows[0].children[1].children[1];primaryMapping.value=originalPrimary;primaryMapping.onchange();
assert(T.storyboardPlanStale&&el('storyApply').disabled&&T.pendingStoryboardPlan.shots[0].fov===56,
  '过期计划允许继续查看和编辑，但逐镜或角色编辑不能绕过重新分析而启用应用');
el('storyApply').click();
assert(T.project.scenes.length===scenesBefore,
  '过期计划不能应用，项目仍保持分析前场景数');
el('storyFullscreen').click();
const firstEscapeCancel=makeEvent();el('storyDlg').dispatch('cancel',firstEscapeCancel);
assert(firstEscapeCancel.defaultPrevented&&!T.storyboardDialogFullscreen&&T.pendingStoryboardPlan!==null&&el('storyDlg').open,
  '全屏状态下第一次 Esc 只还原规划器，不取消瞬时计划');
const secondEscapeCancel=makeEvent();el('storyDlg').dispatch('cancel',secondEscapeCancel);el('storyDlg').close();
assert(!secondEscapeCancel.defaultPrevented&&!el('storyDlg').open&&T.pendingStoryboardPlan===null&&JSON.stringify(T.project)===projectBeforeAnalysis,
  '还原后再次 Esc 才按既有语义取消分析，且不修改项目');

const manualCase=storyboardCorpus.cases.find(testCase=>testCase.id==='manual-environment-override');
const manualRaw='  '+manualCase.script+'\n';
el('aiStoryboard').click();
el('storyText').value=manualRaw;
el('storyTemplate').value='establishing';
el('storyMood').value='daily';
el('storyPace').value='fast';
el('storyGen').click();
assert(T.project.scenes.length===scenesBefore&&T.pendingStoryboardPlan.templateId==='establishing'&&
  T.pendingStoryboardPlan.templateDecision.reasonCode==='template.manual',
  '手动选择环境模板可覆盖动作文本，但分析阶段仍不写项目');
const plannedShotCount=T.pendingStoryboardPlan.shots.length;
el('storyApply').click();
assert(T.project.scenes.length===scenesBefore+1&&T.curScene().templateId==='establishing'&&T.shots.length===plannedShotCount,
  '用户确认后才创建带稳定 templateId 的动态分镜场景');
assert(T.curScene().script===manualRaw&&JSON.stringify(T.curScene().actors.map(actor=>({kind:actor.kind,label:actor.label,pos:actor.pos})))===
  JSON.stringify(plannerSource.actors.map(actor=>({kind:actor.kind,label:actor.label,pos:actor.pos}))),
  '应用保留原始剧本文本，并复用当前场景的现有人物、对象和位置');
assert(!('storyboardPlan' in T.curScene())&&!JSON.stringify(T.curScene()).includes('templateDecision')&&
  !JSON.stringify(T.curScene()).includes('coverageShotIds')&&!JSON.stringify(T.curScene()).includes('mergeReasonCode'),
  '瞬时分析、置信度与覆盖元数据不会偷偷写入 project v5');
assert(T.genPrompt().includes('【任务类型】'), 'AI 分镜场景可生成提示词');
assert(JSON.stringify(T.curScene().actors.map(actor=>actor.path||[]))===JSON.stringify(plannerSource.actors.map(actor=>actor.path||[])),
  '首轮规划复用现有调度路径，不虚构复杂动作路径自动生成');
T.shots.forEach(s => {
  assert(s.dur>=1&&s.dur<=15&&s.fov>=10&&s.fov<=110&&s.camPts.length>=1&&
    s.camPts.every(point=>Number.isFinite(point.x)&&Number.isFinite(point.y)&&Number.isFinite(point.z)),
    `应用后的镜头 ${s.name} 仍可编辑且时长/FOV/机位合法`);
});

/* ---- 持久化往返 ---- */
section('自动保存 + 项目文件往返');
flushTimeouts();
T.syncScene();T.initHistory();
const blankPreviewActor=T.actors.find(actor=>actor.pathPts.length>=2);
assert(blankPreviewActor&&T.curShot().camPts.length>=1,'空白场景预览清理测试具备旧摄影机点与角色调度点');
const blankPreviewCameraIndex=T.curShot().camPts.length-1,blankPreviewActorIndex=blankPreviewActor.pathPts.length-1;
T.previewCameraPoint(blankPreviewCameraIndex);T.previewActorPathPoint(blankPreviewActor,blankPreviewActorIndex);
assert(T.previewCamPt===blankPreviewCameraIndex&&T.previewActorPoint?.actor===blankPreviewActor&&
  T.previewActorPoint?.idx===blankPreviewActorIndex&&T.previewActorCount===1,
  '创建空白场景前真实建立旧摄影机点与角色调度点组合预览');
const blankPreviewSceneCount=T.project.scenes.length,blankPreviewHistoryBefore=T.historyCommitSequence,blankPreviewWritesBefore=sandbox.localStorage._writes;
T.newBlankScene();
assert(T.previewCamPt===null,`创建空白场景清除旧摄影机点预览（实际 ${T.previewCamPt}）`);
assert(T.previewActorPoint===null,`创建空白场景清除旧角色调度点预览（实际 ${T.previewActorPoint?.actor?.label||'null'}）`);
assert(T.previewActorCount===0,`创建空白场景清空旧角色调度点组合预览（实际 ${T.previewActorCount}）`);
assert(T.project.scenes.length===blankPreviewSceneCount+1&&T.historyPending&&T.dirtyTimer!==null,
  '创建空白场景清理旧点位预览后仍只排队一次 history/autosave');
flushTimeouts();
assert(T.undoDepth===1&&T.historyCommitSequence===blankPreviewHistoryBefore+1&&sandbox.localStorage._writes===blankPreviewWritesBefore+1,
  '空白场景清理旧点位预览仍只结算一次 history 事务和一次 autosave');
T.undoLast();assert(T.project.scenes.length===blankPreviewSceneCount,'清理旧点位预览后的空白场景仍可由一次 Undo 恢复');flushTimeouts();T.initHistory();
const projectSaveState=el('saveState'),projectSaveStateDescriptor=Object.getOwnPropertyDescriptor(projectSaveState,'textContent');
const projectSaveStatusWrites=[],projectSaveUnhandled=[];
Object.defineProperty(projectSaveState,'textContent',{
  configurable:true,
  get(){return projectSaveStateDescriptor.value;},
  set(value){projectSaveStateDescriptor.value=String(value);projectSaveStatusWrites.push(String(value));}
});
const projectSaveAppend=documentBody.appendChild,projectSaveCreateElement=documentStub.createElement;
const projectSaveProjectBefore=JSON.parse(JSON.stringify(T.project)),projectSaveStageBefore=JSON.stringify(T.stageToData()),
  projectSaveSceneBefore=T.sceneIdx,projectSaveShotBefore=T.shotIdx,projectSaveSelectedBefore=T.selected,
  projectSaveUndoBefore=T.undoDepth,projectSaveAutosaveWritesBefore=sandbox.localStorage._writes;
projectSaveProjectBefore.scenes[projectSaveSceneBefore]=JSON.parse(projectSaveStageBefore);
const onProjectSaveUnhandled=reason=>projectSaveUnhandled.push(reason);
process.on('unhandledRejection',onProjectSaveUnhandled);
documentBody.appendChild=()=>{throw new Error('synthetic project download append failure');};
const failedProjectSaveResult=await el('btnSave').onclick();
await new Promise(resolve=>setImmediate(resolve));
documentBody.appendChild=projectSaveAppend;
let projectSaveRetryAnchor=null;
documentStub.createElement=tag=>{
  const node=projectSaveCreateElement(tag);
  if(tag==='a'){projectSaveRetryAnchor=node;node.click=noop;}
  return node;
};
const retryProjectSaveResult=await el('btnSave').onclick();
flushTimeouts();
await new Promise(resolve=>setImmediate(resolve));
const projectDesktopSaveCalls=[],desktopSaveAlertsBefore=sandbox.__alerts.length;
await T.saveProjectFile({bridge:{saveProject:async(name,contents)=>{
  projectDesktopSaveCalls.push({kind:'success',name,contents});return {canceled:false,path:'/isolated/project-success.previz.json'};
}}});
const desktopSuccessStatus=projectSaveState.textContent;
projectSaveState.textContent='desktop-cancel-sentinel';
await T.saveProjectFile({bridge:{saveProject:async(name,contents)=>{
  projectDesktopSaveCalls.push({kind:'cancel',name,contents});return {canceled:true};
}}});
const desktopCancelStatus=projectSaveState.textContent;
projectSaveState.textContent='desktop-error-sentinel';
await T.saveProjectFile({bridge:{saveProject:async(name,contents)=>{
  projectDesktopSaveCalls.push({kind:'error',name,contents});throw new Error('synthetic desktop save failure');
}}});
const desktopErrorStatus=projectSaveState.textContent,desktopSaveAlerts=sandbox.__alerts.slice(desktopSaveAlertsBefore);
process.off('unhandledRejection',onProjectSaveUnhandled);
documentStub.createElement=projectSaveCreateElement;
Object.defineProperty(projectSaveState,'textContent',projectSaveStateDescriptor);
const projectSaveFailureStatus=sandbox.PreVisionI18n.t('project.saveFailed',{message:'synthetic project download append failure'});
const projectSaveSuccessStatus=sandbox.PreVisionI18n.t('project.savedLocal');
assert(failedProjectSaveResult===false&&retryProjectSaveResult===true&&projectSaveUnhandled.length===0&&
  projectSaveStatusWrites.filter(value=>value===projectSaveFailureStatus).length===1&&
  projectSaveStatusWrites.filter(value=>value===projectSaveSuccessStatus).length===1&&
  projectSaveStatusWrites.indexOf(projectSaveFailureStatus)<projectSaveStatusWrites.indexOf(projectSaveSuccessStatus)&&
  projectSaveRetryAnchor?.parentElement===null,
  'Web 保存 onclick 等待 dl：append 失败仅结算一次本地化失败、0 unhandled，恢复后可立即成功重试并清理 anchor');
assert(projectDesktopSaveCalls.length===3&&projectDesktopSaveCalls.every(call=>call.name.endsWith('.previz.json')&&JSON.parse(call.contents).version===5)&&
  desktopSuccessStatus===sandbox.PreVisionI18n.t('project.savedPath',{path:'/isolated/project-success.previz.json'})&&
  desktopCancelStatus==='desktop-cancel-sentinel'&&desktopErrorStatus==='desktop-error-sentinel'&&
  JSON.stringify(desktopSaveAlerts)===JSON.stringify([sandbox.PreVisionI18n.t('project.saveFailed',{message:'synthetic desktop save failure'})]),
  'Electron 项目保存保持 ok/cancel/error 原语义：成功状态本地化、取消无状态、错误只 alert，桥接内容与文件名不变');
assert(JSON.stringify(T.project.scenes)===JSON.stringify(projectSaveProjectBefore.scenes)&&
  JSON.stringify(T.stageToData())===projectSaveStageBefore&&T.sceneIdx===projectSaveSceneBefore&&T.shotIdx===projectSaveShotBefore&&
  T.selected===projectSaveSelectedBefore&&T.undoDepth===projectSaveUndoBefore&&sandbox.localStorage._writes===projectSaveAutosaveWritesBefore,
  'Web 保存失败与重试不额外改变场景/镜头/选择/history/autosave；仅保留既有项目保存元数据更新');

const boundaryState=el('saveState'),boundaryDescriptor=Object.getOwnPropertyDescriptor(boundaryState,'textContent');
const boundaryStatuses=[],boundaryUnhandled=[],boundaryCreateElement=documentStub.createElement,boundaryRevoke=sandbox.URL.revokeObjectURL;
Object.defineProperty(boundaryState,'textContent',{configurable:true,get(){return boundaryDescriptor.value;},set(value){boundaryDescriptor.value=String(value);boundaryStatuses.push(String(value));}});
const onBoundaryUnhandled=reason=>boundaryUnhandled.push(reason);process.on('unhandledRejection',onBoundaryUnhandled);
const createURLFailure=await T.saveProjectFile({bridge:null,createObjectURL:()=>{throw new Error('synthetic createObjectURL failure');}});
let projectBoundaryClickAnchor=null,projectBoundaryClickRevokes=0;
documentStub.createElement=tag=>{const node=boundaryCreateElement(tag);if(tag==='a'){projectBoundaryClickAnchor=node;node.click=()=>{throw new Error('synthetic click failure');};}return node;};
sandbox.URL.revokeObjectURL=url=>{if(url==='blob:project-click-failure')projectBoundaryClickRevokes++;};
const clickBoundaryFailure=await T.saveProjectFile({bridge:null,createObjectURL:()=> 'blob:project-click-failure'});
let projectBoundaryCleanupAnchor=null,projectBoundaryCleanupRevokes=0;
documentStub.createElement=tag=>{
  const node=boundaryCreateElement(tag);
  if(tag==='a'){
    projectBoundaryCleanupAnchor=node;node.click=noop;
    const forceRemove=node.remove.bind(node);node.remove=()=>{throw new Error('synthetic remove warning');};node.__forceRemove=forceRemove;
  }
  return node;
};
sandbox.URL.revokeObjectURL=url=>{if(url==='blob:project-cleanup-warning')projectBoundaryCleanupRevokes++;throw new Error('synthetic revoke warning');};
const cleanupWarningSuccess=await T.saveProjectFile({bridge:null,createObjectURL:()=> 'blob:project-cleanup-warning'});
flushTimeouts();projectBoundaryCleanupAnchor?.__forceRemove();
const typedFailure=Object.assign(new Error('synthetic typed download failure'),{code:'EXPORT_FAILED'});
const typedRejectResult=await T.saveProjectFile({
  bridge:null,
  createObjectURL:()=> 'blob:project-typed-failure',
  download:async()=>{throw typedFailure;}
});
await new Promise(resolve=>setImmediate(resolve));
process.off('unhandledRejection',onBoundaryUnhandled);
documentStub.createElement=boundaryCreateElement;sandbox.URL.revokeObjectURL=boundaryRevoke;
Object.defineProperty(boundaryState,'textContent',boundaryDescriptor);
assert(createURLFailure===false&&clickBoundaryFailure===false&&cleanupWarningSuccess===true&&typedRejectResult===false&&boundaryUnhandled.length===0&&
  projectBoundaryClickAnchor?.parentElement===null&&projectBoundaryClickRevokes===1&&projectBoundaryCleanupRevokes===1&&
  JSON.stringify(boundaryStatuses)===JSON.stringify([
    sandbox.PreVisionI18n.t('project.saveFailed',{message:'synthetic createObjectURL failure'}),
    sandbox.PreVisionI18n.t('project.saveFailed',{message:'synthetic click failure'}),
    sandbox.PreVisionI18n.t('project.savedLocal'),
    sandbox.PreVisionI18n.t('project.saveFailed',{message:'synthetic typed download failure'})
  ]),
  'Web 保存覆盖 createObjectURL、click、remove/revoke warning 与底层 typed reject：0 unhandled 且每次只有一个终态');
assert(typeof T.flushPendingAutosave==='function','自动保存提供唯一可复用的同步末次结算入口');
if(T.flushPendingAutosave){
  flushTimeouts();const terminalWritesBefore=sandbox.localStorage._writes;
  fireWindow('pagehide');fireWindow('beforeunload');
  assert(sandbox.localStorage._writes===terminalWritesBefore,'干净 pagehide/beforeunload 零写入');
  el('projname').value='terminal-flush-under-800ms';T.markDirty();
  const pendingTerminalTimer=T.dirtyTimer;
  fireWindow('pagehide');fireWindow('beforeunload');
  const terminalSaved=JSON.parse(sandbox.localStorage._d.previz_autosave_v3);
  assert(terminalSaved.name==='terminal-flush-under-800ms'&&sandbox.localStorage._writes===terminalWritesBefore+1&&
    T.dirtyTimer===null&&pendingTerminalTimer!==null,
    '不足 800ms 的 dirty 在 pagehide 同步结算，重复 beforeunload 最多一次写入并取消 timer');
  const validTerminalRaw=sandbox.localStorage._d.previz_autosave_v3,originalSetItem=sandbox.localStorage.setItem;
  sandbox.localStorage.setItem=function(){this._writes++;throw new Error('synthetic quota');};
  el('projname').value='terminal-double-failure';T.markDirty();
  let terminalFailureEscaped=false;try{fireWindow('pagehide');}catch(_error){terminalFailureEscaped=true;}
  sandbox.localStorage.setItem=originalSetItem;
  assert(!terminalFailureEscaped&&sandbox.localStorage._d.previz_autosave_v3===validTerminalRaw&&T.dirtyTimer===null,
    '完整写与 lite 二次失败不抛出且保留此前有效 autosave');
  el('projname').value='terminal-serialization-failure';T.project.__cycle=T.project;T.markDirty();
  let serializationEscaped=false;try{fireWindow('beforeunload');}catch(_error){serializationEscaped=true;}
  delete T.project.__cycle;
  assert(!serializationEscaped&&sandbox.localStorage._d.previz_autosave_v3===validTerminalRaw&&T.dirtyTimer===null,
    '序列化异常不产生 uncaught 且不破坏此前有效 autosave');
}
function expectProjectReject(value,message){let rejected=false;try{T.normalizeProjectData(value);}catch(error){rejected=error?.code==='PREVISION_INVALID_PROJECT';}assert(rejected,message);}
const sentinelInput=JSON.parse(JSON.stringify(T.newProject()));
sentinelInput.version=3;sentinelInput.name='sentinel-project';sentinelInput.created='2024-01-02T03:04:05.000Z';sentinelInput.modified='2025-02-03T04:05:06.000Z';sentinelInput.unknownRoot='drop-me';
sentinelInput.assets=JSON.parse('{"__proto__":{"d":"data:image/png;base64,PROTO","w":2,"h":2},"asset-1":{"d":"data:image/png;base64,SAFE","w":1024,"h":512}}');
sentinelInput.settings={collision:false,labels:false,unknownSetting:true};
const sentinelScene=sentinelInput.scenes[0];
sentinelScene.name='sentinel-scene';sentinelScene.desc='scene-desc';sentinelScene.script='scene-script';sentinelScene.templateId='future-template';
sentinelScene.bg={asset:'asset-1',yaw:17,radius:88,y:2.4,gp:false};sentinelScene.ground={style:'image',asset:'asset-1'};
sentinelScene.sun={enabled:false,pos:[-4,12,7],intensity:1.2,temp:6400,ambient:.4,softness:3.2,quality:'high'};
const dangerousJoints=JSON.parse('{"bodyY":-0.5,"bodyRotX":4,"spineZ":7,"wristLX":8,"ankleRZ":9,"__proto__":123,"constructor":456,"toString":789}');
sentinelScene.actors=[
  {kind:'char',characterStyle:'wizard',label:'sentinel-rider',pose:'ride',semanticType:'constructor',dimensions:{width:.8,height:3,depth:.55},asset:'asset-1',mount:'sentinel-host',joints:dangerousJoints,
    pos:[1,2],rotY:.25,y:1.25,pathMode:'line',terrainVersion:2,scale:1.2,pathTimes:[0,2],pathEase:[{type:'custom',x1:.2,y1:.1,x2:.8,y2:.9}],timeLink:'cameraNodes',timeOffset:.4,timeLinkShot:0,path:[[1,2],[3,4]]},
  {kind:'horse',label:'sentinel-host',pose:'stand',pos:[2,3],rotY:0,height:0,scale:1,pathMode:'curve',pathTimes:[0,1,4],pathEase:['linear','easeInOut'],timeLink:'independent',timeOffset:0,timeLinkShot:0,path:[[2,3],[3,3],[4,3]]}
];
sentinelScene.shots=[{name:'sentinel-shot',desc:'shot-desc',dur:5,lock:'sentinel-rider',fov:52,camMode:'line',timingMode:'pointSync',syncActor:'sentinel-host',yaw:13,pitch:-4,
  camTimes:[0,5],camEase:['easeIn'],camAimTimes:[0,5],camAimEase:['easeOut'],camFovTimes:[0,5],camFovEase:[{type:'custom',x1:.25,y1:0,x2:.75,y2:1}],camAim:[[13,-4,52],[21,-2,48]],cam:[[0,2,8],[4,3,5]]}];
const sentinelRawBefore=JSON.stringify(sentinelInput),sentinelNormalized=T.normalizeProjectData(sentinelInput);
assert(JSON.stringify(sentinelInput)===sentinelRawBefore&&sentinelNormalized!==sentinelInput&&sentinelNormalized.scenes[0]!==sentinelInput.scenes[0]&&sentinelNormalized.version===5,
  '统一归一化不修改输入，返回全新 project/scenes 并把 v1–v5 迁移到 v5');
const normalizedScene=sentinelNormalized.scenes[0],normalizedRider=normalizedScene.actors[0],normalizedShot=normalizedScene.shots[0];
assert(sentinelNormalized.created===sentinelInput.created&&sentinelNormalized.modified===sentinelInput.modified&&sentinelNormalized.name==='sentinel-project'&&sentinelNormalized.aspect==='16:9'&&
  sentinelNormalized.settings.collision===false&&sentinelNormalized.settings.labels===false&&!('unknownRoot' in sentinelNormalized)&&!('unknownSetting' in sentinelNormalized.settings),
  'root created/modified/name/aspect/settings 白名单字段完整保留，未知字段丢弃');
assert(normalizedScene.desc==='scene-desc'&&normalizedScene.script==='scene-script'&&normalizedScene.templateId==='future-template'&&
  normalizedScene.bg.asset==='asset-1'&&normalizedScene.bg.yaw===17&&normalizedScene.bg.radius===88&&normalizedScene.bg.y===2.4&&normalizedScene.bg.gp===false&&
  normalizedScene.ground.asset==='asset-1'&&normalizedScene.sun.quality==='high'&&normalizedScene.sun.pos[1]===12,
  'scene bg/ground/sun/script/templateId 全字段 canary 通过');
assert(normalizedRider.height===1.25&&!('y' in normalizedRider)&&!Object.hasOwn(normalizedRider,'characterStyle')&&normalizedRider.semanticType==='adult_male'&&normalizedRider.dimensions.height===3&&normalizedRider.asset==='asset-1'&&
  normalizedRider.mount==='sentinel-host'&&normalizedRider.terrainVersion===2&&normalizedRider.timeLink==='cameraNodes'&&normalizedRider.timeOffset===.4&&normalizedRider.timeLinkShot===0&&
  normalizedRider.pathTimes[1]===2&&normalizedRider.pathEase[0].type==='custom'&&normalizedRider.joints.bodyY===-.5&&normalizedRider.joints.bodyRotX===4&&normalizedRider.joints.spineZ===7&&normalizedRider.joints.wristLX===8&&normalizedRider.joints.ankleRZ===9,
  'actor legacy y、wizard→adult_male、尺寸/资产/挂载/地形/关节/path/link 全字段 canary 通过');
assert(normalizedShot.desc==='shot-desc'&&normalizedShot.fov===52&&normalizedShot.yaw===13&&normalizedShot.pitch===-4&&normalizedShot.camMode==='line'&&normalizedShot.timingMode==='pointSync'&&
  normalizedShot.syncActor==='sentinel-host'&&normalizedShot.camTimes[1]===5&&normalizedShot.camAimTimes[1]===5&&normalizedShot.camFovTimes[1]===5&&normalizedShot.camEase[0].type==='easeIn'&&
  normalizedShot.camAimEase[0].type==='easeOut'&&normalizedShot.camFovEase[0].type==='custom'&&normalizedShot.camAim[1][2]===48,
  'shot 旧 yaw/pitch/fov、camAim 与三套 times/eases 全字段 canary 通过；syncActor 点数不匹配仍可编辑');
assert(Object.getPrototypeOf(sentinelNormalized.assets)===null&&Object.prototype.hasOwnProperty.call(sentinelNormalized.assets,'__proto__')&&
  Object.getPrototypeOf(normalizedRider.joints)===null&&!Object.prototype.hasOwnProperty.call(normalizedRider.joints,'__proto__')&&!Object.prototype.hasOwnProperty.call(normalizedRider.joints,'constructor')&&
  T.semanticProxyType(normalizedRider.semanticType)?.id==='adult_male',
  '危险 asset/joints key 使用无原型容器或白名单，不污染原型；legacy wizard 强制收敛为已知 adult_male');
const sentinelRoundtrip=T.normalizeProjectData(JSON.parse(JSON.stringify(sentinelNormalized)));
assert(JSON.stringify(sentinelRoundtrip)===JSON.stringify(sentinelNormalized),'规范化 v5 JSON 往返稳定且不会夹带 StoryboardPlan/03.5 sidecar');
for(const version of [undefined,1,2,3,4,5]){
  const candidate=JSON.parse(JSON.stringify(sentinelInput));if(version===undefined)delete candidate.version;else candidate.version=version;
  candidate.scenes[0].shots[0].cam=[[0,15,8],[1,29.9,7],[2,30,6],[3,47,5]];
  const before=JSON.stringify(candidate),normalized=T.normalizeProjectData(candidate),heights=normalized.scenes[0].shots[0].cam.map(point=>point[1]);
  assert(normalized.version===5&&JSON.stringify(heights)==='[15,29.9,30,47]'&&JSON.stringify(candidate)===before,
    `version ${version??'less'} 原样载入 15/29.9/30/47m，且 normalize 不修改输入`);
}
for(const version of [0,-1,1.5,6,99]){const candidate=JSON.parse(JSON.stringify(sentinelInput));candidate.version=version;expectProjectReject(candidate,`非法/未来 project version ${version} 被拒绝`);}
for(const version of [undefined,1,2,3,4,5]){
  const legacy=JSON.parse(JSON.stringify(sentinelInput));if(version===undefined)delete legacy.version;else legacy.version=version;
  const actor=legacy.scenes[0].actors[0],shot=legacy.scenes[0].shots[0];
  actor.pathTimes=[99];actor.pathEase=['easeIn','easeOut','linear'];actor.timeLinkShot=99;
  shot.camTimes=[99];shot.camAimTimes=[99,-4];shot.camFovTimes=[2];shot.camEase=[];shot.camAimEase=['easeOut','linear'];shot.camFovEase=['easeIn'];shot.camAim=[[7,8,9]];
  const before=JSON.stringify(legacy),normalized=T.normalizeProjectData(legacy),nextActor=normalized.scenes[0].actors[0],nextShot=normalized.scenes[0].shots[0];
  assert(JSON.stringify(legacy)===before&&normalized!==legacy&&normalized.scenes[0]!==legacy.scenes[0],`version ${version??'less'} 有限历史修复保持输入不变并返回新对象`);
  assert(JSON.stringify(nextActor.pathTimes)==='[0,5]'&&nextActor.pathEase.length===1&&nextActor.pathEase[0].type==='easeIn'&&nextActor.timeLinkShot===0&&nextActor.timeLink==='independent',
    `version ${version??'less'} actor pathTimes/ease/timeLinkShot 按旧运行态语义修复`);
  assert(JSON.stringify(nextShot.camTimes)==='[0,5]'&&JSON.stringify(nextShot.camAimTimes)==='[0,5]'&&JSON.stringify(nextShot.camFovTimes)==='[0,5]'&&
    nextShot.camEase.length===1&&nextShot.camEase[0].type==='linear'&&nextShot.camAimEase.length===1&&nextShot.camAimEase[0].type==='easeOut'&&nextShot.camFovEase.length===1&&nextShot.camFovEase[0].type==='easeIn'&&
    JSON.stringify(nextShot.camAim[0])==='[7,8,9]'&&JSON.stringify(nextShot.camAim[1])==='[13,-4,52]',
    `version ${version??'less'} camera times/ease/partial camAim 按旧运行态语义修复`);
}
const overflowTiming=JSON.parse(JSON.stringify(sentinelInput)),overflowShot=overflowTiming.scenes[0].shots[0];
overflowShot.cam.push([100,3,5]);overflowShot.camTimes=[0,1,5];overflowShot.camAimTimes=[5,5,5];overflowShot.camFovTimes=[2];
overflowShot.camEase=['linear','linear'];overflowShot.camAimEase=['linear','linear'];overflowShot.camFovEase=['linear','linear'];
const repairedOverflow=T.normalizeProjectData(overflowTiming).scenes[0].shots[0];
assert(JSON.stringify(repairedOverflow.camTimes)==='[0,1,5]'&&JSON.stringify(repairedOverflow.camAimTimes)==='[0,2.5,5]'&&JSON.stringify(repairedOverflow.camFovTimes)==='[0,1,5]',
  '3 点非等距镜头中 valid-length overflow 使用 uniform，invalid-length 才 fallback 到非等距 camTimes');
const extremeFinite=JSON.parse(JSON.stringify(sentinelInput)),extremeActor=extremeFinite.scenes[0].actors[0],extremeShot=extremeFinite.scenes[0].shots[0];
extremeActor.path=[[1e308,0],[-1e308,0],[0,0]];extremeActor.pathTimes=[0];extremeActor.pathEase=['linear','linear'];
extremeShot.cam=[[1e308,0,0],[-1e308,0,0],[0,0,0]];extremeShot.camTimes=[];extremeShot.camAimTimes=[];extremeShot.camFovTimes=[];extremeShot.camEase=['linear','linear'];extremeShot.camAimEase=['linear','linear'];extremeShot.camFovEase=['linear','linear'];delete extremeShot.camAim;
const normalizedExtreme=T.normalizeProjectData(extremeFinite).scenes[0];
assert(JSON.stringify(normalizedExtreme.actors[0].pathTimes)==='[0,2.5,5]'&&JSON.stringify(normalizedExtreme.shots[0].camTimes)==='[0,2.5,5]'&&
  normalizedExtreme.actors[0].pathTimes.concat(normalizedExtreme.shots[0].camTimes).every(Number.isFinite),
  'finite 极值坐标导致距离溢出时按 index 均分，所有归一化时间保持 finite');
const overflowDuration=JSON.parse(JSON.stringify(sentinelInput));overflowDuration.scenes[0].shots.push(JSON.parse(JSON.stringify(overflowDuration.scenes[0].shots[0])));overflowDuration.scenes[0].shots.forEach(shot=>{shot.dur=Number.MAX_VALUE;});
expectProjectReject(overflowDuration,'多镜头有限 dur 求和溢出会被拒绝，不产生 Infinity 场景总时长');
const badSecondScene=JSON.parse(JSON.stringify(sentinelInput));badSecondScene.scenes.push(JSON.parse(JSON.stringify(sentinelScene)));badSecondScene.scenes[1].actors[0].pos[0]='NaN';
expectProjectReject(badSecondScene,'未使用的第二场景含错类型也会被完整遍历拒绝');
const duplicateLabels=JSON.parse(JSON.stringify(sentinelInput));duplicateLabels.scenes[0].actors[1].label='sentinel-rider';expectProjectReject(duplicateLabels,'重复 actor label 被拒绝');
const danglingMount=JSON.parse(JSON.stringify(sentinelInput));danglingMount.scenes[0].actors[0].mount='missing-host';expectProjectReject(danglingMount,'悬挂 mount 引用被拒绝');
const selfMount=JSON.parse(JSON.stringify(sentinelInput));selfMount.scenes[0].actors[0].mount='sentinel-rider';expectProjectReject(selfMount,'自引用 mount 被拒绝');
const cyclicMount=JSON.parse(JSON.stringify(sentinelInput));cyclicMount.scenes[0].actors[1].mount='sentinel-rider';expectProjectReject(cyclicMount,'循环 mount 引用被拒绝');
const danglingLock=JSON.parse(JSON.stringify(sentinelInput));danglingLock.scenes[0].shots[0].lock='missing-lock';expectProjectReject(danglingLock,'悬挂 shot.lock 引用被拒绝');
const danglingSync=JSON.parse(JSON.stringify(sentinelInput));danglingSync.scenes[0].shots[0].syncActor='missing-sync';expectProjectReject(danglingSync,'悬挂 shot.syncActor 引用被拒绝');
for(const semanticType of ['__proto__','constructor','toString']){const candidate=JSON.parse(JSON.stringify(sentinelInput));candidate.scenes[0].actors[1].semanticType=semanticType;const normalized=T.normalizeProjectData(candidate);assert(normalized.scenes[0].actors[1].semanticType===semanticType&&T.semanticProxyType(semanticType)===null,`未知危险 semanticType ${semanticType} 原样往返并安全 fallback`);}
const quotaLite=JSON.parse(JSON.stringify(T.newProject()));quotaLite.assets={};quotaLite.scenes[0].bg={asset:'missing-bg',yaw:0,radius:60,y:1.6,gp:true};quotaLite.scenes[0].ground={style:'image',asset:'missing-ground'};
quotaLite.scenes[0].actors.push({kind:'board',label:'missing-board',asset:'missing-board',pos:[0,0],rotY:0,path:[]});
const quotaNormalized=T.normalizeProjectData(quotaLite),quotaScene=quotaNormalized.scenes[0];
assert(quotaScene.bg===null&&quotaScene.ground.style==='checker'&&!quotaScene.actors.find(actor=>actor.label==='missing-board').asset,
  'Quota-lite autosave 的 dangling bg/ground/board 资产确定性降级，不使整个项目 invalid');

/* 非法输入在归一化阶段零写入；既有 dirty timer 仍只保存打开前的合法工作区。 */
flushTimeouts();
el('projname').value='pending-before-invalid';T.markDirty();
const resumeProject=JSON.parse(JSON.stringify(T.project));resumeProject.name='pending-before-invalid';resumeProject.scenes[T.sceneIdx]=T.stageToData();
const invalidWritesBefore=sandbox.localStorage._writes,invalidProjectBefore=JSON.stringify(T.project),invalidSceneBefore=T.sceneIdx,invalidShotBefore=T.shotIdx;
const invalidSelectedBefore=T.selected?.label||'',invalidPreviewBefore=JSON.stringify(T.serializePreviewAnimationState()),invalidUndoBefore=T.undoDepth;
const invalidAssetCacheBefore=T.assetTex,invalidDirtyTimerBefore=T.dirtyTimer;
assert(invalidDirtyTimerBefore&&T.openProjectData({app:'PreVision',version:5,name:'illegal-payload',scenes:[]})===false,
  '非法项目在 commit 前被拒绝且不取消既有 dirty timer');
assert(JSON.stringify(T.project)===invalidProjectBefore&&T.sceneIdx===invalidSceneBefore&&T.shotIdx===invalidShotBefore&&
  (T.selected?.label||'')===invalidSelectedBefore&&JSON.stringify(T.serializePreviewAnimationState())===invalidPreviewBefore&&T.undoDepth===invalidUndoBefore&&
  T.assetTex===invalidAssetCacheBefore&&T.dirtyTimer===invalidDirtyTimerBefore&&sandbox.localStorage._writes===invalidWritesBefore,
  '非法打开立即保持 project/runtime/Three/UI/history/timer/cache/03.5 sidecar 与 autosave 写次数不变');
flushTimeouts();
const pendingSaved=JSON.parse(sandbox.localStorage._d['previz_autosave_v3']);
assert(sandbox.localStorage._writes===invalidWritesBefore+1&&pendingSaved.name==='pending-before-invalid'&&!JSON.stringify(pendingSaved).includes('illegal-payload'),
  'pending dirty timer 超过 800ms 只保存打开前合法编辑，不因非法输入写入 autosave');

/* 合法归一化后的 commit fault 必须回滚全部活动状态，且不排队 autosave。 */
const faultInput=JSON.parse(JSON.stringify(sentinelNormalized));faultInput.name='commit-fault-payload';
const faultProjectBefore=JSON.stringify(T.project),faultStageBefore=JSON.stringify(T.stageToData()),faultSceneBefore=T.sceneIdx,faultShotBefore=T.shotIdx;
const faultSelectedBefore=T.selected?.label||'',faultTimeBefore=T.time,faultPlayingBefore=T.playing,faultPreviewBefore=JSON.stringify(T.serializePreviewAnimationState());
const faultUndoBefore=T.undoDepth,faultWritesBefore=sandbox.localStorage._writes,faultAssetCacheBefore=T.assetTex,faultDirtyBefore=T.dirtyTimer,faultHistoryBefore=T.historyTimer;
sandbox.__throwImageLoad=1;
assert(T.openProjectData(faultInput)===false,'资源预检/装载 commit fault 返回失败');
assert(JSON.stringify(T.project)===faultProjectBefore&&JSON.stringify(T.stageToData())===faultStageBefore&&T.sceneIdx===faultSceneBefore&&T.shotIdx===faultShotBefore&&
  (T.selected?.label||'')===faultSelectedBefore&&T.time===faultTimeBefore&&T.playing===faultPlayingBefore&&JSON.stringify(T.serializePreviewAnimationState())===faultPreviewBefore&&
  T.undoDepth===faultUndoBefore&&T.assetTex===faultAssetCacheBefore&&T.dirtyTimer===faultDirtyBefore&&T.historyTimer===faultHistoryBefore&&sandbox.localStorage._writes===faultWritesBefore,
  'commit fault 回滚 project/runtime/Three/UI/history/timer/cache/03.5 sidecar 且不写 autosave');
flushTimeouts();assert(sandbox.localStorage._writes===faultWritesBefore,'commit fault 后超过 800ms 仍不产生 autosave');

const successInput=JSON.parse(JSON.stringify(sentinelNormalized));successInput.name='successful-transaction';successInput.aspect='9:16';successInput.scenes[0].shots[0].cam[1][1]=30;
const successWritesBefore=sandbox.localStorage._writes;
assert(T.openProjectData(successInput)===true&&T.project.name==='successful-transaction'&&T.sceneIdx===0&&T.shotIdx===0,
  '成功打开把规范化项目设为活动 project 并初始化首场首镜');
const openedThirtyStage=T.stageToData(),openedThirtyProject=JSON.parse(JSON.stringify(T.project));openedThirtyProject.scenes[0]=openedThirtyStage;
const normalizedThirtyAgain=T.normalizeProjectData(openedThirtyProject);
assert(T.curShot().camPts[1].y===30&&openedThirtyStage.shots[0].cam[1][1]===30&&normalizedThirtyAgain.scenes[0].shots[0].cam[1][1]===30,
  '30m 机位经 loadScene→stageToData→normalize 序列化重开仍保持30m');
assert(T.flushScheduledUIResize()&&T.aspectSize[0]===9&&T.aspectSize[1]===16&&Math.abs(T.shotCam.aspect-9/16)<1e-9&&T.renderLayoutCache.pip.aspect===9/16&&
  T.pipRenderer.lastSize?.[1]===Math.round(T.pipRenderer.lastSize[0]*16/9),
  '成功打开 16:9→9:16 后调度 renderer/shotCam/PIP/画幅更新');
flushTimeouts();
assert(sandbox.localStorage._writes===successWritesBefore+1&&JSON.parse(sandbox.localStorage._d['previz_autosave_v3']).name==='successful-transaction',
  '成功打开沿用既有语义排队一次 autosave');
const aspectFault=JSON.parse(JSON.stringify(sentinelNormalized));aspectFault.aspect='16:9';sandbox.__throwImageLoad=1;
assert(T.openProjectData(aspectFault)===false&&T.flushScheduledUIResize()&&T.project.aspect==='9:16'&&T.aspectSize[0]===9&&T.aspectSize[1]===16&&
  el('resLabel').textContent==='1080×1920'&&Math.abs(T.shotCam.aspect-9/16)<1e-9&&T.renderLayoutCache.pip.aspect===9/16&&T.pipRenderer.lastSize?.[1]===Math.round(T.pipRenderer.lastSize[0]*16/9),
  'commit fault 回滚后恢复 resLabel，并重新调度 renderer/shotCam/PIP 与打开前 9:16 画幅');
assert(T.openProjectData(resumeProject)===true,'事务 corpus 后恢复后续模块断言所需的完整工作区');flushTimeouts();
el('groundQuickLight').click();
flushTimeouts();   // 触发防抖自动保存
const saved = JSON.parse(sandbox.localStorage._d['previz_autosave_v3'] || 'null');
assert(saved && saved.scenes.length === T.project.scenes.length, '自动保存场景数一致');
assert(saved.version===5&&!JSON.stringify(saved).includes('storyboardPlan')&&!JSON.stringify(saved).includes('templateDecision')&&
  !JSON.stringify(saved).includes('coverageShotIds')&&!JSON.stringify(saved).includes('mergeReasonCode'),
  '分镜规划应用后 autosave 仍是 project v5，且不持久化瞬时 StoryboardPlan 字段');
assert(saved.scenes.some(s => s.script), '自动保存含剧本字段');
assert(saved.scenes.some(s=>s.templateId==='performance')&&saved.scenes.some(s=>s.templateId==='establishing'),
  '新建模板场景和剧本分镜的 templateId 均进入自动保存');
assert(saved.scenes.some(s => (s.actors || []).some(a => a.pose === 'sit')), '自动保存含姿态字段');
assert(saved.scenes.some(s => (s.actors || []).some(a => a.kind === 'wall')), '自动保存含墙体');
const savedRoute = saved.scenes.flatMap(s => s.actors || []).find(a => a.label === '路径测试');
assert(savedRoute && savedRoute.pathMode === 'line' && savedRoute.height === 2, '自动保存含调度线型与对象高度');
assert(saved.settings && saved.settings.collision === true, '自动保存含碰撞开关');
const savedGroundIndex=saved.scenes.findIndex(s=>s.ground?.style==='color'&&s.ground.color==='#3a3e48');
assert(savedGroundIndex>=0,'自动保存包含画布浅灰快捷选项的场景级颜色');
saved.scenes[0].actors.push(
  {kind:'char',label:'ride-roundtrip-default',pos:[16,16],rotY:.37,scale:.85,pose:'ride',mount:'ride-roundtrip-horse',joints:{bodyY:-.92,hipLZ:-42,hipRZ:42,kneeL:70,kneeR:70},path:[]},
  {kind:'char',semanticType:'child',dimensions:{width:.8,height:3,depth:.55},label:'ride-roundtrip-custom',pos:[16,16],rotY:.37,scale:1.1,pose:'ride',mount:'ride-roundtrip-horse',joints:{bodyY:-.63,hipLX:-67,hipRX:-58,hipLZ:-37,hipRZ:39,kneeL:81,kneeR:76},path:[]},
  {kind:'char',label:'ride-roundtrip-car-rider',pos:[18,16],rotY:.2,pose:'ride',mount:'ride-roundtrip-car',joints:{bodyY:-.92,hipLZ:-42,hipRZ:42,kneeL:70,kneeR:70},path:[]},
  {kind:'char',label:'ride-roundtrip-prop-rider',pos:[20,16],rotY:.2,pose:'ride',mount:'ride-roundtrip-prop',joints:{bodyY:-.92,hipLZ:-42,hipRZ:42,kneeL:70,kneeR:70},path:[]},
  {kind:'horse',label:'ride-roundtrip-horse',pos:[16,16],rotY:.37,scale:1.25,path:[]},
  {kind:'car',label:'ride-roundtrip-car',pos:[18,16],rotY:.2,path:[]},
  {kind:'prop',label:'ride-roundtrip-prop',pos:[20,16],rotY:.2,path:[]}
);
let normalizedSaved=null;
try{normalizedSaved=T.normalizeProjectData(saved);}catch(error){console.error('  normalize saved fixture: '+error.message);}
assert(!!normalizedSaved,'完整 project v5 夹具通过统一归一化');
T.openProjectData(JSON.parse(JSON.stringify(saved)));
assert(T.project.scenes.length === saved.scenes.length, '项目文件载入往返成功');
const migratedRide=T.actors.find(a=>a.label==='ride-roundtrip-default'),customRide=T.actors.find(a=>a.label==='ride-roundtrip-custom');
const carRide=T.actors.find(a=>a.label==='ride-roundtrip-car-rider'),propRide=T.actors.find(a=>a.label==='ride-roundtrip-prop-rider');
assert(migratedRide?.joints.bodyY===-.82&&migratedRide.joints.hipLZ===-46&&migratedRide.joints.hipRZ===46&&migratedRide.joints.kneeL===72&&migratedRide.joints.kneeR===72,
  'project v5 即使骑手先于马保存，打开时仍只将白马历史默认骑姿迁移到贴鞍值');
assert(customRide?.joints.bodyY===-.63&&customRide.joints.hipLX===-67&&customRide.joints.hipRX===-58&&customRide.joints.hipLZ===-37&&customRide.joints.hipRZ===39&&customRide.joints.kneeL===81&&customRide.joints.kneeR===76&&
  customRide.semanticType==='child'&&customRide.dimensions.height===3,
  'project v5 打开时非默认用户关节与语义代理类型/尺寸原样保留');
assert([carRide,propRide].every(rider=>rider?.joints.bodyY===-.92&&rider.joints.hipLZ===-42&&rider.joints.hipRZ===42&&rider.joints.kneeL===70&&rider.joints.kneeR===70),
  'project v5 车载与普通物体挂载的历史默认姿态不执行白马迁移');
const customRideJoints=JSON.stringify(customRide.joints),rideRoundtripProject=JSON.parse(JSON.stringify(T.project));
rideRoundtripProject.scenes[0]=T.stageToData();
T.openProjectData(rideRoundtripProject);
const migratedRideAgain=T.actors.find(a=>a.label==='ride-roundtrip-default'),customRideAgain=T.actors.find(a=>a.label==='ride-roundtrip-custom');
const carRideAgain=T.actors.find(a=>a.label==='ride-roundtrip-car-rider'),propRideAgain=T.actors.find(a=>a.label==='ride-roundtrip-prop-rider');
assert(migratedRideAgain?.joints.bodyY===-.82&&migratedRideAgain.joints.hipLZ===-46&&migratedRideAgain.joints.hipRZ===46&&migratedRideAgain.joints.kneeL===72&&migratedRideAgain.joints.kneeR===72,
  '历史默认骑姿迁移保存重开后幂等，不发生二次漂移');
assert(JSON.stringify(customRideAgain?.joints)===customRideJoints,
  '非默认用户自定义骑姿保存重开后逐字段保持');
assert([carRideAgain,propRideAgain].every(rider=>rider?.joints.bodyY===-.92&&rider.joints.hipLZ===-42&&rider.joints.hipRZ===42&&rider.joints.kneeL===70&&rider.joints.kneeR===70),
  '车载与普通物体挂载保存重开后仍保持旧默认，不被白马迁移污染');
const restoredStoryboardScene=T.project.scenes.find(scene=>scene.script===manualRaw);
assert(restoredStoryboardScene&&restoredStoryboardScene.templateId==='establishing'&&restoredStoryboardScene.shots.length===plannedShotCount&&
  restoredStoryboardScene.shots.every(shot=>shot.dur>=1&&shot.dur<=15&&shot.fov>=10&&shot.fov<=110),
  'project v5 保存/打开往返保留原剧本、手动模板、动态镜头和合法数值');
const restoredRoute = T.actors.find(a => a.label === '路径测试');
assert(restoredRoute && restoredRoute.pathMode === 'line' && restoredRoute.elev === 2, '项目载入恢复调度线型与对象高度');
T.loadScene(savedGroundIndex);
assert(T.groundAppearance?.style==='color'&&T.groundAppearance.color==='#3a3e48'&&T.groundMaterial.color.getHex()===0x3a3e48&&el('groundQuickLight').getAttribute('aria-pressed')==='true',
  '项目文件载入恢复画布浅灰快捷选项及其选中态');
const legacyGroundProject=JSON.parse(JSON.stringify(saved));legacyGroundProject.scenes.forEach(scene=>{delete scene.ground;delete scene.templateId;});
T.openProjectData(legacyGroundProject);
assert(T.groundAppearance?.style==='checker'&&T.gridVisible&&el('groundQuickChecker').getAttribute('aria-pressed')==='true'&&T.project.scenes.every(scene=>!scene.templateId),
  '缺少地面和 templateId 字段的旧项目兼容载入并同步棋盘格选中态');
T.openProjectData({ app: '别的东西' });
assert(sandbox.__alerts.some(m => m.includes('不是有效')), '无效项目文件被拒绝');

/* ---- 视口交互(真实 raycast) ---- */
section('视口交互');
const gl = el('gl');
el('aspect').value='9:16';el('aspect').onchange({target:el('aspect')});flushTimeouts();T.initHistory();
const draftShot=T.curShot();delete draftShot.reframeByAspect;T.refreshReframeUI();
assert(!el('reframeEdit').hidden&&!el('reframeEditRight').hidden&&!el('monReframeBadge').hidden&&
  el('reframeEdit').getAttribute('aria-pressed')==='false'&&el('reframeEditRight').getAttribute('aria-pressed')==='false',
  '9:16 两个同命令入口与 monitor badge 可见，编辑默认关闭');
el('reframeEditRight').click();
frames(1);
assert(documentStub.activeElement===gl&&el('reframeEdit').getAttribute('aria-pressed')==='true'&&el('reframeEditRight').getAttribute('aria-pressed')==='true',
  '右侧入口聚焦主画布且 toolbar/right aria-pressed 同步');
const draftStart={stage:JSON.stringify(T.stageToData()),history:T.historyCommitSequence,undo:T.undoDepth,writes:sandbox.localStorage._writes};
gl.dispatch('pointerdown',{pointerId:901,button:0,clientX:400,clientY:300});
gl.dispatch('pointermove',{pointerId:901,buttons:1,clientX:480,clientY:340,movementX:80,movementY:40});
const draftValue=T.currentResolvedReframe();
assert(!draftShot.reframeByAspect&&JSON.stringify(T.stageToData())===draftStart.stage&&T.historyCommitSequence===draftStart.history&&
  T.undoDepth===draftStart.undo&&sandbox.localStorage._writes===draftStart.writes&&
  (Math.abs(draftValue.offsetX)>0||Math.abs(draftValue.offsetY)>0),
  'pointer move 只更新 transient draft，project/history/autosave 零写入');
gl.dispatch('pointerup',{pointerId:901});
assert(!!draftShot.reframeByAspect?.['9:16']&&T.historyCommitSequence===draftStart.history&&T.undoDepth===draftStart.undo,
  'pointerup 提交 canonical reframe，并仅排队 history/autosave');
flushTimeouts();
assert(T.historyCommitSequence===draftStart.history+1&&T.undoDepth===draftStart.undo+1&&sandbox.localStorage._writes===draftStart.writes+1,
  'pointer 手势最终只形成一次 history + autosave');

const enterCommitStart={history:T.historyCommitSequence,undo:T.undoDepth,writes:sandbox.localStorage._writes};
gl.dispatch('pointerdown',{pointerId:906,button:0,clientX:400,clientY:300});
gl.dispatch('pointermove',{pointerId:906,buttons:1,clientX:460,clientY:360,movementX:60,movementY:60});
const enterCommitEvent=fireDocument('keydown',{key:'Enter',code:'Enter',target:documentStub.body});
let postEnterPointerError=null;
try{
  gl.dispatch('pointermove',{pointerId:906,buttons:1,clientX:520,clientY:400,movementX:60,movementY:40});
  gl.dispatch('pointerup',{pointerId:906});
}catch(error){postEnterPointerError=error;}
flushTimeouts();
assert(enterCommitEvent.defaultPrevented&&postEnterPointerError===null&&
  T.historyCommitSequence===enterCommitStart.history+1&&T.undoDepth===enterCommitStart.undo+1&&
  sandbox.localStorage._writes===enterCommitStart.writes+1,
  `pointerdown→move→Enter→move→pointerup 安全结束，且仅一次 history + autosave (${postEnterPointerError?.message||'ok'})`);

const cancelPersisted=JSON.stringify(draftShot.reframeByAspect),cancelHistory=T.historyCommitSequence,cancelUndo=T.undoDepth,cancelWrites=sandbox.localStorage._writes;
gl.dispatch('pointerdown',{pointerId:902,button:0,clientX:400,clientY:300});
gl.dispatch('pointermove',{pointerId:902,buttons:1,clientX:520,clientY:260,movementX:120,movementY:-40});
const escapeReframe=fireDocument('keydown',{key:'Escape',code:'Escape',target:documentStub.body});
flushTimeouts();
assert(escapeReframe.defaultPrevented&&JSON.stringify(draftShot.reframeByAspect)===cancelPersisted&&T.historyCommitSequence===cancelHistory&&
  T.undoDepth===cancelUndo&&sandbox.localStorage._writes===cancelWrites,
  'Escape 取消 draft，project/history/autosave 零写入');

const inputGateHistory=T.historyCommitSequence,inputGateValue=JSON.stringify(T.currentResolvedReframe());
gl.dispatch('pointerdown',{pointerId:903,button:0,clientX:400,clientY:300,isComposing:true});
gl.dispatch('pointermove',{pointerId:903,buttons:1,clientX:600,clientY:500,isComposing:true});
assert(JSON.stringify(T.currentResolvedReframe())===inputGateValue&&T.historyCommitSequence===inputGateHistory,
  'IME composing gate 阻止重构图手势');
T.showCommandModal(el('keysDlg'));
const modalDragBefore=T.dragging,modalValueBefore=JSON.stringify(T.currentResolvedReframe());
gl.dispatch('pointerdown',{pointerId:904,button:0,clientX:400,clientY:300});
gl.dispatch('pointermove',{pointerId:904,buttons:1,clientX:600,clientY:500});
assert(T.dragging===modalDragBefore&&JSON.stringify(T.currentResolvedReframe())===modalValueBefore&&T.historyCommitSequence===inputGateHistory,
  'modal gate 同时阻止 reframe 与背后导演台交互');
el('keysDlg').close();
const captureGateTransaction=T.beginCaptureTransaction('reframe-gate',{manual:true}),captureGateBefore=JSON.stringify(T.currentResolvedReframe());
gl.dispatch('pointerdown',{pointerId:905,button:0,clientX:400,clientY:300});
gl.dispatch('pointermove',{pointerId:905,buttons:1,clientX:600,clientY:500});
assert(JSON.stringify(T.currentResolvedReframe())===captureGateBefore,
  `capture gate 阻止 reframe draft (${captureGateBefore} → ${JSON.stringify(T.currentResolvedReframe())})`);
assert(T.historyCommitSequence===inputGateHistory,
  `capture gate 阻止 history 提交 (${inputGateHistory} → ${T.historyCommitSequence})`);
T.releaseCaptureTransaction(captureGateTransaction);

const wheelHistory=T.historyCommitSequence,wheelWrites=sandbox.localStorage._writes,wheelZoom=T.currentResolvedReframe().zoom;
gl.dispatch('wheel',{deltaY:-120});
assert(T.currentResolvedReframe().zoom>wheelZoom&&T.historyCommitSequence===wheelHistory,
  'wheel 先更新 draft，不立即写 history');
flushTimeouts();
assert(T.historyCommitSequence===wheelHistory+1&&sandbox.localStorage._writes===wheelWrites+1,
  '单次 wheel gesture debounce 为一次 history + autosave');
const plusHistory=T.historyCommitSequence,plusZoom=T.currentResolvedReframe().zoom;
el('reframeZoomIn').click();
assert(T.currentResolvedReframe().zoom>plusZoom&&T.historyCommitSequence===plusHistory,
  '＋ 缩放更新 canonical 值并排队 history');
flushTimeouts();
assert(T.historyCommitSequence===plusHistory+1,'＋ 缩放最终提交一次 history');
const resetHistory=T.historyCommitSequence;el('reframeReset').click();
assert(!draftShot.reframeByAspect&&T.historyCommitSequence===resetHistory&&JSON.stringify(T.currentResolvedReframe())===JSON.stringify(T.REFRAME_IDENTITY),
  'reset 删除 sparse canonical 字段并排队 history');
flushTimeouts();
assert(T.historyCommitSequence===resetHistory+1,'reset 最终提交一次 history');

if(T.shots.length>1){
  const switchHistory=T.historyCommitSequence,switchWrites=sandbox.localStorage._writes;
  gl.dispatch('pointerdown',{pointerId:906,button:0,clientX:400,clientY:300});
  gl.dispatch('pointermove',{pointerId:906,buttons:1,clientX:500,clientY:350});
  T.setShot(1,true);T.setShot(0,true);flushTimeouts();
  assert(!draftShot.reframeByAspect&&T.historyCommitSequence===switchHistory&&sandbox.localStorage._writes===switchWrites,
    '切镜清 draft，零 project/history/autosave 写入');
}
el('reframeEdit').click();el('aspect').value='16:9';el('aspect').onchange({target:el('aspect')});flushTimeouts();T.initHistory();
assert(el('reframeEdit').hidden&&el('reframeEditRight').hidden&&el('monReframeBadge').hidden,'离开 9:16 后隐藏两处重构图入口与 badge');
const escapeViewportSelection=T.actors.find(actor=>actor.kind!=='board');T.select(escapeViewportSelection);
T.showCommandModal(el('keysDlg'));
const viewportDialogEscape=pressNativeDialogEscape([el('keysDlg')]);
assert(viewportDialogEscape.keydown.propagationStopped&&!viewportDialogEscape.keydown.defaultPrevented&&
  !el('keysDlg').open&&T.selected===escapeViewportSelection,
  '普通弹窗物理 Escape 保留原生关闭并隔离背后视口选择');
const navCam0=T.viewCam.position.clone(),navPivot=new sandbox.THREE.Vector3(5,0,-3);
T.setOrbitPivotKeepView(navPivot);
assert(T.viewCam.position.distanceTo(navCam0)<1e-5&&T.orbit.target.distanceTo(navPivot)<1e-6,
  '更换环绕轴心时保持导演台相机原位，画面不会瞬间跳动');
const navActors0=T.actors.map(a=>a.obj.position.clone()),navUndo0=T.undoDepth;
gl.dispatch('pointerdown',{pointerId:301,button:0,clientX:40,clientY:560,shiftKey:false});
assert(T.dragging&&T.dragging.viewOrbit,'左键按下场景空白处进入围绕点击点旋转状态');
const activeCanvasDrag=T.dragging;
gl.dispatch('pointerup',{pointerId:302});
assert(T.dragging===activeCanvasDrag,'第二指针松开不会提前提交或清理画布拖动');
const navTheta0=T.orbit.theta,navPhi0=T.orbit.phi,navTarget0=T.orbit.target.clone();
gl.dispatch('pointermove',{pointerId:301,buttons:1,clientX:80,clientY:590,movementX:40,movementY:30,shiftKey:false});
assert(Math.abs(T.orbit.theta-navTheta0)>.1&&Math.abs(T.orbit.phi-navPhi0)>.1&&T.orbit.target.distanceTo(navTarget0)<1e-6,
  '左拖横向改变环绕角、纵向改变俯仰角，轴心保持不动');
gl.dispatch('pointerup',{pointerId:301});
const panTheta0=T.orbit.theta,panPhi0=T.orbit.phi,panTarget0=T.orbit.target.clone();
gl.dispatch('pointerdown',{button:2,clientX:40,clientY:560,preventDefault:noop});
assert(T.dragging&&T.dragging.viewPan,'右键按下空白处进入平移场景状态');
gl.dispatch('pointermove',{buttons:2,clientX:90,clientY:580,movementX:50,movementY:20});
assert(T.orbit.target.distanceTo(panTarget0)>.1&&Math.abs(T.orbit.theta-panTheta0)<1e-9&&Math.abs(T.orbit.phi-panPhi0)<1e-9,
  '右拖只平移观察目标，不改变环绕和俯仰角');
gl.dispatch('pointerup',{});
assert(T.actors.every((a,i)=>a.obj.position.distanceTo(navActors0[i])<1e-9)&&T.undoDepth===navUndo0,
  '导演台旋转/平移不改对象坐标，也不写入撤销历史');
assert(html.includes('左拖空白：绕点击点环绕/俯仰')&&html.includes('右拖空白：平移场景'),'视口底部提示已更新为新导航方式');
gl.dispatch('pointerdown', { button: 0, clientX: 400, clientY: 300, shiftKey: false });
gl.dispatch('pointermove', { buttons: 1, clientX: 410, clientY: 305, movementX: 10, movementY: 5, shiftKey: false });
gl.dispatch('pointerup', {});
gl.dispatch('wheel', { deltaY: 120 });
frames(5);
assert(true, '视口 pointer/wheel 事件无异常');
(winListeners['keydown'] || []).forEach(f => {
  f({ key: 'ArrowRight', code: '', target: { tagName: 'BODY' }, preventDefault: noop });
  f({ code: 'Space', key: ' ', target: { tagName: 'BODY' }, preventDefault: noop });
});
frames(5);
assert(true, '快捷键派发无异常');

/* ---- 场景背景: 720°全景 + 场景图板 ---- */
section('场景背景: 全景天空球 + 场景图板');
const ownedRoot=new sandbox.THREE.Group();
const sharedGeometry=new sandbox.THREE.BoxGeometry(1,1,1),shaderGeometry=new sandbox.THREE.PlaneGeometry(1,1);
const ownedMap=new sandbox.THREE.CanvasTexture(makeEl('canvas')),ownedNormalMap=new sandbox.THREE.Texture(),ownedSpriteMap=new sandbox.THREE.CanvasTexture(makeEl('canvas'));
const ownedUniformMap=new sandbox.THREE.Texture(),sharedMap=T.markSharedThreeTexture(new sandbox.THREE.Texture());
const ownedMaterial=new sandbox.THREE.MeshStandardMaterial({map:ownedMap,normalMap:ownedNormalMap});
const sharedTextureMaterial=new sandbox.THREE.MeshBasicMaterial({map:sharedMap});
const spriteMaterial=new sandbox.THREE.SpriteMaterial({map:ownedSpriteMap});
const shaderMaterial=new sandbox.THREE.ShaderMaterial({uniforms:{ownedMap:{value:ownedUniformMap}}});
const ownedSprite=new sandbox.THREE.Sprite(spriteMaterial),spritePeer=new sandbox.THREE.Sprite();let spriteGeometryDisposals=0;
ownedSprite.geometry.addEventListener('dispose',()=>spriteGeometryDisposals++);
ownedRoot.add(new sandbox.THREE.Mesh(sharedGeometry,[ownedMaterial,sharedTextureMaterial]),new sandbox.THREE.Mesh(sharedGeometry,ownedMaterial),
  ownedSprite,new sandbox.THREE.Mesh(shaderGeometry,shaderMaterial));
const disposeEvents={geometry:0,shaderGeometry:0,material:0,sharedTextureMaterial:0,spriteMaterial:0,shaderMaterial:0,map:0,normalMap:0,spriteMap:0,uniformMap:0,sharedMap:0};
[
  ['geometry',sharedGeometry],['shaderGeometry',shaderGeometry],['material',ownedMaterial],['sharedTextureMaterial',sharedTextureMaterial],
  ['spriteMaterial',spriteMaterial],['shaderMaterial',shaderMaterial],['map',ownedMap],['normalMap',ownedNormalMap],['spriteMap',ownedSpriteMap],
  ['uniformMap',ownedUniformMap],['sharedMap',sharedMap],
].forEach(([key,resource])=>resource.addEventListener('dispose',()=>disposeEvents[key]++));
const firstOwnedDispose=T.disposeOwnedObject3D(ownedRoot),secondOwnedDispose=T.disposeOwnedObject3D(ownedRoot);
assert(JSON.stringify(firstOwnedDispose)===JSON.stringify({geometries:2,materials:4,textures:4})&&
  JSON.stringify(secondOwnedDispose)===JSON.stringify({geometries:0,materials:0,textures:0}),
  '所有权释放去重 geometry/材质数组/贴图字段/Shader uniform/Sprite CanvasTexture，重入不双重 dispose');
assert(Object.entries(disposeEvents).every(([key,count])=>count===(key==='sharedMap'?0:1))&&T.isSharedThreeTexture(sharedMap),
  '独占资源均且仅 dispose 一次，显式共享贴图不被误释放：'+JSON.stringify(disposeEvents));
assert(ownedSprite.geometry===spritePeer.geometry&&spriteGeometryDisposals===0,
  'Three r128 引擎内共享 Sprite geometry 不进入场景独占释放，SpriteMaterial/CanvasTexture 仍由场景回收');
assert(/function clearStage\s*\(\)\s*\{[\s\S]*?disposeOwnedObject3D\(a\.obj\)/.test(stageRuntimeSrc)&&
  /(?:function rebuildViz\s*\(\)|const viewportRebuildViz\s*=\s*\(\)\s*=>)\s*\{\s*disposeOwnedObject3D\(vizGroup\);\s*vizGroup\.clear\(\)/.test(viewportModuleSrc)&&
  /function buildSky\s*\(\)\s*\{[\s\S]*?if\(sky\)\{ scene\.remove\(sky\); disposeOwnedObject3D\(sky\); sky=null; \}/.test(stageEnvironmentSrc),
  'stage actor、路径/viz 与 sky 重建都通过同一可重入所有权边界释放');
const aid = T.addAsset('data:image/jpeg;base64,AAAA', 2048, 1024);
T.curScene().bg = { asset: aid, yaw: 90, radius: 100, y: 1 };
T.buildSky();
assert(T.sky && T.hasBg(), '天空球已构建');
const firstSkyGeometry=T.sky.geometry,firstSkyMaterial=T.sky.material,sharedPanoramaTexture=T.assetTex[aid];
let firstSkyGeometryDisposed=0,firstSkyMaterialDisposed=0,sharedPanoramaDisposed=0;
firstSkyGeometry.addEventListener('dispose',()=>firstSkyGeometryDisposed++);firstSkyMaterial.addEventListener('dispose',()=>firstSkyMaterialDisposed++);
sharedPanoramaTexture.addEventListener('dispose',()=>sharedPanoramaDisposed++);
assert(Math.abs(T.sky.rotation.y - Math.PI / 2) < .01, '全景旋转 90° 生效');
assert(T.sky.userData.radius === 100, '环境远近(半径)生效');
assert(Math.abs(T.sky.position.y - 1) < .01, '球心=拍摄高度');
/* 地面投影: 下半球展平到 y=0(局部坐标 -camH) */
assert(T.sky.userData.gp === true, '地面投影默认开启');
const posA = T.sky.geometry.attributes.position;
let discN = 0, maxDiscR = 0;
for (let i = 0; i < posA.count; i++) {
  const y = posA.getY(i);
  if (Math.abs(y + 1.02) < .01) {   // 投影盘顶点: 局部 y = -(camH+0.02) = -1.02
    discN++;
    maxDiscR = Math.max(maxDiscR, Math.hypot(posA.getX(i), posA.getZ(i)));
  }
}
assert(discN > 50, '照片地面投影盘存在 (顶点数=' + discN + ')');
assert(maxDiscR <= 12.5, '投影盘范围 ≤ 拍摄高度×12 (实际=' + maxDiscR.toFixed(1) + 'm), 远景带留在球面防拉丝');
T.curScene().bg.gp = false; T.buildSky();
assert(firstSkyGeometryDisposed===1&&firstSkyMaterialDisposed===1&&sharedPanoramaDisposed===0&&T.assetTex[aid]===sharedPanoramaTexture,
  '重建天空球释放独占 geometry/material，但复用 assetTex 共享全景贴图');
assert(T.sky.userData.gp === false, '地面投影可关闭');
const posB = T.sky.geometry.attributes.position;
let minY2 = 1e9; for (let i = 0; i < posB.count; i++) minY2 = Math.min(minY2, posB.getY(i));
assert(minY2 < -95, '关闭投影时为完整球面 (最低点=' + minY2.toFixed(0) + ')');
T.curScene().bg.gp = true; T.buildSky();
T.setExportLook(true);
assert(T.groundIsShadow && !T.gridVisible, '导出态: 地面只留影子 + 网格隐藏');
T.setExportLook(false);
assert(!T.groundIsShadow && T.gridVisible, '编辑态: 恢复棋盘地面 + 网格');
const groundUiIds=['groundStyle','groundColor','groundFile','loadGroundImage','groundStyleStatus'];
assert(groundUiIds.every(id=>htmlIds.has(id)),'场景背景栏包含地面样式、颜色和本地纹理控件');
const groundQuickIds=['groundQuickChecker','groundQuickLight','groundQuickDark'];
const viewportStart=html.indexOf('<div id="viewport">'),timelineStart=html.indexOf('<div id="timeline">',viewportStart);
const viewportMarkup=html.slice(viewportStart,timelineStart);
const groundQuickCss=(html.match(/#groundQuickPicker\{([^}]*)\}/)||[,''])[1];
assert(viewportMarkup.includes('id="groundQuickPicker"')&&groundQuickIds.every(id=>htmlIds.has(id)),
  '画布右上角包含棋盘格、浅灰和深灰三个快捷选项');
assert(/position:absolute/.test(groundQuickCss)&&/\btop:/.test(groundQuickCss)&&/\bright:/.test(groundQuickCss),
  '画布颜色快捷选项固定在视口右上角');
assert(groundQuickIds.every(id=>/data-i18n-title="[^"]+"/.test(htmlElementMeta.get(id)?.attrs||'')&&/data-i18n-aria-label="[^"]+"/.test(htmlElementMeta.get(id)?.attrs||'')),
  '画布颜色快捷选项全部使用 language key 提供提示和可访问名称');
assert(T.groundCheckerColors?.light==='#3a3e48'&&T.groundCheckerColors?.dark==='#292c34',
  '快捷纯色与棋盘纹理共用当前两种实际灰色');
assert(el('groundQuickChecker').classList.contains('on')&&el('groundQuickChecker').getAttribute('aria-pressed')==='true',
  '棋盘格场景在画布快捷选择中显示明确选中态');
el('groundQuickLight').click();
assert(T.groundAppearance?.style==='color'&&T.groundAppearance.color===T.groundCheckerColors.light&&T.groundMaterial.color.getHex()===0x3a3e48&&!T.gridVisible,
  '浅灰快捷选项使用棋盘浅灰并隐藏棋盘辅助元素');
assert(el('groundStyle').value==='color'&&el('groundColor').value==='#3a3e48'&&el('groundStyleStatus').textContent===sandbox.PreVisionI18n.t('ground.lightGray')&&
  el('groundQuickLight').getAttribute('aria-pressed')==='true'&&el('groundQuickChecker').getAttribute('aria-pressed')==='false',
  '浅灰快捷选择同步右栏颜色、状态文案和互斥选中态');
el('groundQuickDark').click();
assert(T.groundAppearance?.style==='color'&&T.groundAppearance.color===T.groundCheckerColors.dark&&T.groundMaterial.color.getHex()===0x292c34&&!T.gridVisible,
  '深灰快捷选项使用棋盘深灰并隐藏棋盘辅助元素');
assert(el('groundQuickDark').getAttribute('aria-pressed')==='true'&&el('groundQuickLight').getAttribute('aria-pressed')==='false',
  '深灰快捷选择同步互斥选中态');
el('groundQuickChecker').click();
assert(T.groundAppearance?.style==='checker'&&T.groundMaterial.map===T.groundTexture&&T.gridVisible&&el('groundQuickChecker').getAttribute('aria-pressed')==='true',
  '棋盘格快捷选项恢复棋盘纹理、辅助元素和选中态');
assert(typeof T.cleanGroundAppearance==='function'&&typeof T.applyGroundAppearance==='function'&&typeof T.currentGroundAppearance==='function',
  '地面外观具备归一化、应用和当前场景访问边界');
if(typeof T.cleanGroundAppearance==='function'&&typeof T.applyGroundAppearance==='function'){
  assert(T.cleanGroundAppearance(null).style==='checker'&&T.cleanGroundAppearance({style:'broken'}).style==='checker',
    '旧项目缺失地面字段或样式损坏时安全回退棋盘格');
  T.curScene().ground={style:'white'};T.applyGroundAppearance();
  assert(T.groundMaterial.color.getHex()===0xffffff&&!T.gridVisible,'纯白地面使用纯色材质并隐藏棋盘网格');
  T.curScene().ground={style:'black'};T.applyGroundAppearance();
  assert(T.groundMaterial.color.getHex()===0x000000&&!T.gridVisible&&T.sceneBackground.getHex()===0x0a0a0a,
    '纯黑地面生效且周围导演区继续保持黑色背景');
  T.curScene().ground={style:'color',color:'#315a7d'};T.applyGroundAppearance();
  assert(T.groundMaterial.color.getHex()===0x315a7d&&!T.gridVisible,'自定义颜色地面按场景设置生效');
  const groundAid=T.addAsset('data:image/jpeg;base64,GROUND',1024,1024);
  T.curScene().ground={style:'image',asset:groundAid};T.applyGroundAppearance();
  assert(!!T.groundMaterial.map&&!T.gridVisible,'自定义图片地面使用独立纹理并隐藏网格');
  const groundData=T.stageToData();
  assert(groundData.ground?.style==='image'&&groundData.ground.asset===groundAid,'自定义地面图片引用写入场景项目数据');
  T.gcAssets();
  assert(!!T.project.assets[groundAid],'资产清理保留仍被地面引用的图片');
  T.openProjectData(JSON.parse(JSON.stringify(T.project)));
  assert(T.groundAppearance?.style==='image'&&T.groundAppearance.asset===groundAid&&!!T.groundMaterial.map,
    '项目保存数据重新载入后恢复自定义图片地面');
  T.setExportLook(true);
  assert(T.groundIsShadow&&!T.gridVisible,'全景导出态仍优先使用只接收阴影的地面材质');
  T.setExportLook(false);
  assert(!T.groundIsShadow&&!T.gridVisible,'退出导出态恢复自定义图片地面而非棋盘网格');
  T.curScene().ground={style:'checker'};T.applyGroundAppearance();
  assert(T.groundMaterial.map===T.groundTexture&&T.gridVisible,'切回棋盘格恢复原有纹理与空间参照网格');
}
assert(T.genPrompt().includes('真实背景'), '提示词声明场景以参考视频画面为准');
/* 场景图板 */
T.buildActor({ kind: 'board', label: '板1', asset: aid, pos: [1.5, 1], rotY: 0, path: [] });
const board = T.actors.find(a => a.kind === 'board');
assert(board && board.obj.userData.boardH > 0, '图板对象已构建 (高=' + board.obj.userData.boardH + 'm)');
assert(!T.genPrompt().includes('【环境:板'), '图板不进提示词环境行(由场景句统一声明)');
const sdB = T.stageToData();
assert(sdB.actors.find(a => a.kind === 'board').asset === aid, '图板资产引用进序列化');
assert(sdB.bg && sdB.bg.asset === aid, '场景背景进序列化');
/* 自动保存包含资产 */
el('panoYaw').oninput({ target: { value: '45' } });
flushTimeouts();
const savedBg = JSON.parse(sandbox.localStorage._d['previz_autosave_v3']);
assert(savedBg.assets && savedBg.assets[aid], '自动保存包含图片资产');
assert(savedBg.scenes.some(s => s.bg && s.bg.asset === aid), '自动保存包含背景配置');
/* 配额降级 */
const origSet = sandbox.localStorage.setItem.bind(sandbox.localStorage);
let quotaThrew = false;
sandbox.localStorage.setItem = function (k, v) { if (!quotaThrew) { quotaThrew = true; throw new Error('QuotaExceeded'); } return origSet(k, v); };
el('panoYaw').oninput({ target: { value: '50' } });
flushTimeouts();
assert(el('saveState').textContent.includes('容量'), '配额超限降级保存并提示: ' + el('saveState').textContent);
sandbox.localStorage.setItem = origSet;
/* 移除背景 */
el('clearPano').click();
assert(!T.hasBg() && !T.sky, '移除全景后天空球销毁');
T.setExportLook(true);
assert(!T.groundIsShadow, '无背景时导出保留棋盘地面(运动视差参照)');
T.setExportLook(false);

const makeAssetOwnerProject=(name,prefix,{firstUsesShared=true}={})=>{
  const data=T.newProject(),sharedId=`${prefix}-shared`,orphanId=`${prefix}-orphan`;
  data.name=name;data.assets={
    [sharedId]:{d:'data:image/jpeg;base64,SHARED',w:2048,h:1024},
    [orphanId]:{d:'data:image/jpeg;base64,ORPHAN',w:512,h:512},
  };
  const addSharedReferences=(sceneData,suffix)=>{
    sceneData.bg={asset:sharedId,yaw:0,radius:60,y:1.6,gp:true};
    sceneData.actors.push({kind:'board',label:`${prefix}-board-${suffix}`,asset:sharedId,pos:[0,0],rotY:0,path:[]});
  };
  const first=JSON.parse(JSON.stringify(data.scenes[0])),second=JSON.parse(JSON.stringify(data.scenes[0]));
  first.name=`${name} scene 1`;second.name=`${name} scene 2`;
  if(firstUsesShared)addSharedReferences(first,'one');addSharedReferences(second,'two');
  data.scenes=[first,second];return {data,sharedId,orphanId};
};
const assetOwnerA=makeAssetOwnerProject('asset-owner-A','owner-a');
assert(T.openProjectData(assetOwnerA.data)===true&&T.project.name==='asset-owner-A','项目资产 owner A 成功提交');
const assetCacheA=T.assetTex,assetTextureA=assetCacheA[assetOwnerA.sharedId];let assetTextureADisposals=0;
assetTextureA.addEventListener('dispose',()=>assetTextureADisposals++);
const assetALabels=T.project.scenes.map(sceneData=>sceneData.actors.map(actor=>actor.label));
for(let sceneIndex=0;sceneIndex<T.project.scenes.length;sceneIndex++){
  T.loadScene(sceneIndex);
  const boardActor=T.actors.find(actor=>actor.kind==='board'),boardMesh=boardActor?.obj.children.find(child=>child.isMesh);
  assert(T.curScene().name===`asset-owner-A scene ${sceneIndex+1}`&&JSON.stringify(T.actors.map(actor=>actor.label))===JSON.stringify(assetALabels[sceneIndex])&&
    T.assetTex[assetOwnerA.sharedId]===assetTextureA&&T.sky?.material?.map===assetTextureA&&boardMesh?.material?.map===assetTextureA&&assetTextureADisposals===0,
    `同项目场景 ${sceneIndex+1} 保持身份、标签和共享全景/图板贴图，不提前释放 assetTex`);
}
const assetOwnerB=makeAssetOwnerProject('asset-owner-B','owner-b',{firstUsesShared:false});
assert(T.openProjectData(assetOwnerB.data)===true&&assetTextureADisposals===1&&Object.keys(assetCacheA).length===0,
  '成功打开 A→B 仅在新项目提交后释放并清空旧项目 assetTex cache');
T.loadScene(1);
const assetCacheB=T.assetTex,assetTextureB=assetCacheB[assetOwnerB.sharedId];let assetTextureBDisposals=0;
assetTextureB.addEventListener('dispose',()=>assetTextureBDisposals++);
const disposalContinuationCache=Object.create(null),throwingAssetTexture=T.markSharedThreeTexture(new sandbox.THREE.Texture()),followingAssetTexture=T.markSharedThreeTexture(new sandbox.THREE.Texture());
disposalContinuationCache.first=throwingAssetTexture;disposalContinuationCache.second=followingAssetTexture;
let throwingAssetDisposeAttempts=0,followingAssetDisposals=0;const disposalErrors=[];
throwingAssetTexture.dispose=()=>{throwingAssetDisposeAttempts++;throw new Error('Synthetic texture disposal failure');};
followingAssetTexture.addEventListener('dispose',()=>followingAssetDisposals++);
const originalConsoleError=sandbox.console.error;sandbox.console.error=(...args)=>disposalErrors.push(args);
let continuedAssetDisposals;
try{continuedAssetDisposals=T.disposeAssetTextureCache(disposalContinuationCache);}finally{sandbox.console.error=originalConsoleError;}
assert(continuedAssetDisposals===1&&throwingAssetDisposeAttempts===1&&followingAssetDisposals===1&&disposalErrors.length===1&&Object.keys(disposalContinuationCache).length===0,
  '单个 assetTex dispose 抛错时继续释放后续 cache 项并删除全部 owner 引用');
const failedOwner=makeAssetOwnerProject('asset-owner-failed','owner-failed');
const originalTextureDispose=sandbox.THREE.Texture.prototype.dispose,failedAssetTextureDisposals=[];
sandbox.THREE.Texture.prototype.dispose=function(){if(this.image instanceof sandbox.Image)failedAssetTextureDisposals.push(this);return originalTextureDispose.call(this);};
sandbox.__throwImageLoad=1;
let failedOwnerResult;
try{failedOwnerResult=T.openProjectData(failedOwner.data);}finally{sandbox.THREE.Texture.prototype.dispose=originalTextureDispose;}
const restoredBoard=T.actors.find(actor=>actor.kind==='board'),restoredBoardMesh=restoredBoard?.obj.children.find(child=>child.isMesh);
assert(failedOwnerResult===false&&T.project.name==='asset-owner-B'&&T.sceneIdx===1&&T.assetTex===assetCacheB&&T.assetTex[assetOwnerB.sharedId]===assetTextureB&&
  assetTextureBDisposals===0&&failedAssetTextureDisposals.length===1&&failedAssetTextureDisposals[0]!==assetTextureB&&
  T.sky?.material?.map===assetTextureB&&restoredBoardMesh?.material?.map===assetTextureB,
  '失败打开 B→候选项目会 dispose 候选 cache 并原子回滚 B，共享全景/图板仍可见');
const orphanTexture=T.assetTexture(assetOwnerB.orphanId);let orphanTextureDisposals=0;
orphanTexture.addEventListener('dispose',()=>orphanTextureDisposals++);
T.loadScene(0);T.gcAssets();T.gcAssets();
assert(orphanTextureDisposals===1&&!T.project.assets[assetOwnerB.orphanId]&&!T.assetTex[assetOwnerB.orphanId]&&
  !!T.project.assets[assetOwnerB.sharedId]&&T.assetTex[assetOwnerB.sharedId]===assetTextureB&&assetTextureBDisposals===0,
  'orphan GC 同步释放/删除孤儿 cache，其他场景仍引用的共享 assetTex 保持存活且重复 GC 不双重处置');
T.loadScene(1);
const sharedBoardAfterGc=T.actors.find(actor=>actor.kind==='board'),sharedBoardMeshAfterGc=sharedBoardAfterGc?.obj.children.find(child=>child.isMesh);
assert(T.assetTex[assetOwnerB.sharedId]===assetTextureB&&T.sky?.material?.map===assetTextureB&&sharedBoardMeshAfterGc?.material?.map===assetTextureB,
  '仅由其他场景持有的共享资产经 GC 与场景切换后仍恢复全景/图板材质');
const selectedAssetBoard=T.actors.find(actor=>actor.kind==='board');T.select(selectedAssetBoard);T.setShot(1,true);T.setTime(.75);T.markDirty();
const failedNewBefore={projectName:T.project.name,sceneIdx:T.sceneIdx,shotIdx:T.shotIdx,time:T.time,selectedLabel:T.selected?.label,
  undoDepth:T.undoDepth,historyCurrent:T.historyCurrent,historyPending:T.historyPending,historyTimer:T.historyTimer,dirtyTimer:T.dirtyTimer,
  autosave:sandbox.localStorage._d.previz_autosave_v3,writes:sandbox.localStorage._writes};
let rejectedNewCache,rejectedNewTexture,rejectedNewTextureDisposals=0;
const alertsBeforeFailedNew=sandbox.__alerts.length;
const failedNewResult=T.activateNewProject((sceneIndex,skipSync)=>{
  T.loadScene(sceneIndex,skipSync);
  const rejectedId=T.addAsset('data:image/jpeg;base64,REJECTED-NEW',256,128);
  rejectedNewCache=T.assetTex;rejectedNewTexture=T.assetTexture(rejectedId);rejectedNewTexture.addEventListener('dispose',()=>rejectedNewTextureDisposals++);
  throw new Error('Synthetic new-project scene activation failure');
});
assert(failedNewResult===false&&T.project.name===failedNewBefore.projectName&&T.sceneIdx===failedNewBefore.sceneIdx&&T.shotIdx===failedNewBefore.shotIdx&&
  T.time===failedNewBefore.time&&T.selected?.label===failedNewBefore.selectedLabel&&T.undoDepth===failedNewBefore.undoDepth&&
  T.historyCurrent===failedNewBefore.historyCurrent&&T.historyPending===failedNewBefore.historyPending&&T.historyTimer===failedNewBefore.historyTimer&&
  T.dirtyTimer===failedNewBefore.dirtyTimer&&sandbox.localStorage._d.previz_autosave_v3===failedNewBefore.autosave&&sandbox.localStorage._writes===failedNewBefore.writes&&
  T.assetTex===assetCacheB&&T.assetTex[assetOwnerB.sharedId]===assetTextureB&&assetTextureBDisposals===0&&rejectedNewTextureDisposals===1&&
  rejectedNewTexture!==assetTextureB&&Object.keys(rejectedNewCache).length===0&&sandbox.__alerts.length===alertsBeforeFailedNew+1,
  'New Project 的 loadScene 注入失败会恢复 project/scene/selection/history/pending autosave/旧 assetTex owner，并释放候选 owner');
flushTimeouts();
const autosaveAfterFailedNew=JSON.parse(sandbox.localStorage._d.previz_autosave_v3);
assert(autosaveAfterFailedNew.name===failedNewBefore.projectName&&autosaveAfterFailedNew.scenes.length===2&&assetTextureBDisposals===0,
  '失败前已排队的 autosave 最终只写入恢复后的旧项目，旧共享贴图仍存活');
el('btnNew').click();el('confirmOk').click();
assert(assetTextureBDisposals===1&&T.assetTex!==assetCacheB&&Object.keys(T.assetTex).length===0,
  '新建项目成功激活后结束旧项目 assetTex owner，最后一个共享贴图精确释放一次');
assert(T.openProjectData(JSON.parse(JSON.stringify(resumeProject)))===true,'项目 asset owner 回归后恢复后续测试工作区');
flushTimeouts();

/* ---- UI v3: B 电影控制台 + C 导演专注 + 四主题 ---- */
section('UI v3: 主题、面板状态、专注模式与菜单');
assert(
  /#centerCol\{[^}]*container-type:inline-size/.test(html)
    && /@container \(max-width:760px\)\{[\s\S]*?#toolbar\{gap:3px;padding-inline:6px\}[\s\S]*?#toolbar button,#toolbar select\{padding-inline:6px\}[\s\S]*?#toolbar label\.chk\{gap:3px;padding-inline:6px\}/.test(html),
  '画布工具栏按中心容器实际宽度紧凑布局，不依赖隐藏横向滚动'
);
assert(
  /@container \(max-width:650px\)\{[\s\S]*?#toolbar\{scrollbar-width:thin\}[\s\S]*?#toolbar::\-webkit-scrollbar\{display:block;height:4px\}/.test(html),
  '非支持的更窄中心区会明确显示横向滚动条作为降级提示'
);
assert(
  /#toolbar\{height:39px;/.test(html)
    && /button,select\{[^}]*padding:5px 10px[^}]*font-size:11\.5px/.test(html)
    && /label\.chk\{[^}]*padding:3px 10px[^}]*font-size:11\.5px/.test(html)
    && /#toolbar label\.chk\{min-height:27px\}/.test(html),
  '工具栏保持 39px 单行、至少 11px 功能文字和至少 26px 点击高度'
);
for (const key of ['viewSelector','viewStage','viewTop','viewHorizontal','move','rotate','followCamera','fitAll','fitAllTitle','shortcuts','dispatchPath','cameraPath','labels']) {
  assert(html.includes(`toolbar.${key}`), `工具栏可见文案使用 language key: toolbar.${key}`);
}
for(const key of ['edit','editTitle','controls','zoomOut','zoomIn','reset','badge','status']){
  assert(html.includes(`reframe.${key}`)||localeZhSrc.includes(`'reframe.${key}'`),`竖屏重构图文案使用 language key: reframe.${key}`);
}
const uiStyle = (html.match(/<style>([\s\S]*?)<\/style>/) || [,''])[1];
const uiRequiredIds = [
  'appWorkspace', 'modeRail', 'sceneRail', 'right', 'rightRail', 'rightContent', 'rightToggle', 'rightRailExpand',
  'railBack', 'railTitle', 'scenelist', 'addshot',
  'directorFocus', 'themeTrigger', 'themeMenu', 'themeGraphite', 'themeMist', 'themeTwilight', 'themeAmber', 'timelineMode'
];
assert(uiRequiredIds.every(id => htmlIds.has(id)), '电影控制台、左栏钻取、专注模式、主题与双态栏位 DOM 完整');
assert(['modeCamera','modeActors','modePath','modeLighting','rightPin'].every(id=>!htmlIds.has(id)),
  '左模式轨移除四个重复属性入口，覆盖抽屉中的二次固定按钮也已移除');
const instantTooltipIds=['modeScenes','modeTimeline','modeFocus','rightRailCamera','rightRailActors','rightRailPath','rightRailLighting','rightRailExpand'];
assert(instantTooltipIds.every(id=>{
  const attrs=htmlElementMeta.get(id)?.attrs||'';
  return /\bdata-i18n-tooltip="[^"]+"/.test(attrs)&&!(/(?:^|\s)title="/.test(attrs));
})&&instantTooltipIds.every(id=>el(id).dataset.tooltip&&el(id).getAttribute('aria-label'))&&uiStyle.includes('content:attr(data-tooltip)'),
  '左右模式轨通过 language key 生成悬停/聚焦即时提示，不再等待浏览器原生 title');
assert(/id="appWorkspace"[^>]*data-timeline="full"/.test(html)&&typeof T.initialTimelineState==='function'&&
  T.initialTimelineState(null,null)==='full'&&T.initialTimelineState('filmstrip',null)==='hidden'&&T.initialTimelineState(null,'0')==='hidden',
  '新用户默认完整时间轴，历史镜头条与旧收起偏好迁移为隐藏');
assert(
  ['mist', 'twilight', 'amber'].every(theme => uiStyle.includes(`html[data-theme="${theme}"]`)) &&
  ['themeGraphite', 'themeMist', 'themeTwilight', 'themeAmber'].every(id => htmlIds.has(id)),
  '石墨、雾白、暮光、琥珀四套主题共用语义令牌与入口'
);
assert(
  uiStyle.includes('#appWorkspace.director-focus') &&
  uiStyle.includes('#appWorkspace[data-timeline="hidden"]') &&
  !uiStyle.includes('#appWorkspace[data-timeline="filmstrip"]'),
  '导演专注模式与时间轴完整/隐藏双态样式存在，镜头条态已退役'
);
assert(!/<use\b[^>]*href=["']https?:/i.test(html), '统一图标全部来自本地内联 SVG sprite');
const iconOnlyButtons = [...html.matchAll(/<button\b([^>]*\bclass="[^"]*\bicon-only\b[^"]*"[^>]*)>/g)];
assert(iconOnlyButtons.length >= 8, '电影控制台高频入口使用统一纯图标按钮');
assert(iconOnlyButtons.every(match => /(?:^|\s)(?:aria-label|title|data-i18n-aria-label|data-i18n-title)="[^"]+"/.test(match[1])),
  '所有纯图标按钮均有可访问名称');
const projectNameAttrs=htmlElementMeta.get('projname')?.attrs||'';
assert(/data-i18n-aria-label="project\.nameAria"/.test(projectNameAttrs)&&!/data-i18n-value=/.test(projectNameAttrs),
  '项目名称只本地化无障碍标签，不会在语言应用时覆盖用户项目名');
const brandSubtitleRule=(uiStyle.match(/\.brand-copy small\{([^}]*)\}/)||[,''])[1];
assert(/font:8\.5px\/1\s+var\(--mono\)/.test(brandSubtitleRule)&&/transform:translateY\(2px\)/.test(brandSubtitleRule),
  '品牌副标题适当放大并独立下移，视觉底边对齐 25px 应用图标');

const workspace = el('appWorkspace');
assert(documentStub.documentElement.dataset.theme === 'amber', '刷新后恢复胶片琥珀主题偏好');
assert(
  workspace.dataset.left === 'rail' && workspace.dataset.right === 'rail' && workspace.dataset.timeline === 'full',
  '刷新后恢复左栏轨道、右栏轨道和完整时间轴偏好'
);

const uiApi = {
  setUITheme: T.setUITheme,
  setLeftPanelState: T.setLeftPanelState,
  setRightPanelState: T.setRightPanelState,
  setTimelineState: T.setTimelineState,
  setDirectorFocus: T.setDirectorFocus,
  closeUIMenus: T.closeUIMenus,
};
for (const [name, fn] of Object.entries(uiApi)) assert(typeof fn === 'function', `UI v3 API ${name} 已定义`);
const uiApiReady = Object.values(uiApi).every(fn => typeof fn === 'function');

if (T.playing) el('playBtn').click();
frames(1);
flushTimeouts();
const uiProjectBefore = JSON.stringify(T.project);
const uiStageBefore = JSON.stringify(T.stageToData());
const uiUndoBefore = T.undoDepth;
const uiAutosaveBefore = sandbox.localStorage._d.previz_autosave_v3;
const uiWrites = [];
const uiOriginalSetItem = sandbox.localStorage.setItem;
sandbox.localStorage.setItem = function (key, value) {
  uiWrites.push(key);
  return uiOriginalSetItem.call(this, key, value);
};

if (uiApiReady) {
  try {
    for (const theme of ['graphite', 'mist', 'twilight', 'amber']) {
      T.setUITheme(theme);
      assert(documentStub.documentElement.dataset.theme === theme && sandbox.localStorage._d.previz_ui_theme === theme,
        `主题 ${theme} 生效并持久化`);
    }
    T.setUITheme('__invalid__');
    assert(documentStub.documentElement.dataset.theme === 'graphite' && sandbox.localStorage._d.previz_ui_theme === 'graphite',
      '损坏主题值安全回退石墨主题');
    T.setUITheme('graphite');
    el('themeMist').click();
    assert(documentStub.documentElement.dataset.theme === 'mist', '主题菜单项可切换雾白日间主题');

    T.setLeftPanelState('rail');
    assert(workspace.dataset.left === 'rail' && sandbox.localStorage._d.previz_railc === '1', '左栏进入模式轨并持久化');
    T.setLeftPanelState('expanded');
    assert(workspace.dataset.left === 'expanded' && sandbox.localStorage._d.previz_railc === '0', '左栏恢复展开并持久化');

    T.setRightPanelState('rail');
    assert(workspace.dataset.right === 'rail' && sandbox.localStorage._d.previz_rightc === '1', '右栏进入模式轨并持久化');
    T.setRightPanelState('expanded');
    assert(workspace.dataset.right === 'expanded' && sandbox.localStorage._d.previz_rightc === '0', '右栏固定展开并持久化');
    el('rightToggle').click();
    assert(workspace.dataset.right === 'rail', '右栏收起按钮进入属性轨');
    el('rightRailExpand').click();
    assert(workspace.dataset.right === 'expanded', '属性轨展开入口直接进入参与布局的固定右栏');
    assert(typeof T.openInspector==='function'&&String(T.openInspector).includes("setRightPanelState('expanded')"),
      '普通模式点击右栏内容入口直接固定展开，不再先覆盖时间轴');
    T.setRightPanelState('rail');
    el('rightRailCamera').click();
    assert(workspace.dataset.right==='expanded'&&!el('right').classList.contains('peek')&&sandbox.localStorage._d.previz_rightc==='0'&&el('modeScenes').classList.contains('on'),
      '普通模式点击属性入口直接固定展开且不清除左侧场景高亮');
    T.setRightPanelState('rail');T.setDirectorFocus(true);
    const focusRightPreference=sandbox.localStorage._d.previz_rightc;
    el('rightRailActors').click();
    assert(workspace.dataset.right==='rail'&&el('right').classList.contains('peek')&&sandbox.localStorage._d.previz_rightc===focusRightPreference&&el('modeFocus').classList.contains('on'),
      '导演专注中属性入口仅临时显示抽屉，不污染基础右栏偏好与专注高亮');
    fireDocument('pointerdown',{target:makeEl('div')});
    assert(!el('right').classList.contains('peek')&&workspace.dataset.right==='rail','点击专注态临时抽屉外部后恢复原右栏状态');
    T.setDirectorFocus(false);T.setRightPanelState('expanded');

    for (const state of ['full', 'hidden']) {
      T.setTimelineState(state);
      assert(workspace.dataset.timeline === state && sandbox.localStorage._d.previz_timeline_state === state,
        `时间轴 ${state} 状态生效并持久化`);
      assert(el('modeTimeline').dataset.tooltip===({
        full:sandbox.PreVisionI18n.t('timeline.currentFull'),
        hidden:sandbox.PreVisionI18n.t('timeline.currentCompact')
      }[state]),`时间轴 ${state} 即时提示随当前状态更新`);
    }
    T.setTimelineState('hidden');
    el('timelineMode').click();
    assert(workspace.dataset.timeline === 'full', '时间轴模式按钮可从隐藏切到完整轨道');
    el('timelineMode').click();
    assert(workspace.dataset.timeline === 'hidden', '时间轴模式按钮可从完整轨道切回隐藏，不再进入镜头条');

    T.setLeftPanelState('rail');
    T.setRightPanelState('expanded');
    T.setTimelineState('full');
    const beforeFocus = {
      left: workspace.dataset.left, right: workspace.dataset.right, timeline: workspace.dataset.timeline,
      rail: sandbox.localStorage._d.previz_railc, rightc: sandbox.localStorage._d.previz_rightc,
      timelinePref: sandbox.localStorage._d.previz_timeline_state,
    };
    T.setDirectorFocus(true);
    assert(workspace.classList.contains('director-focus'), '导演专注模式进入');
    assert(
      workspace.dataset.left === beforeFocus.left && workspace.dataset.right === beforeFocus.right &&
      workspace.dataset.timeline === beforeFocus.timeline && sandbox.localStorage._d.previz_railc === beforeFocus.rail &&
      sandbox.localStorage._d.previz_rightc === beforeFocus.rightc && sandbox.localStorage._d.previz_timeline_state === beforeFocus.timelinePref,
      '专注模式不覆盖进入前栏位状态与持久偏好'
    );
    T.setDirectorFocus(false);
    assert(!workspace.classList.contains('director-focus') && workspace.dataset.left === beforeFocus.left &&
      workspace.dataset.right === beforeFocus.right && workspace.dataset.timeline === beforeFocus.timeline,
      '退出专注模式恢复进入前布局');
    el('directorFocus').click();
    assert(workspace.classList.contains('director-focus'), '顶栏专注按钮可进入专注模式');
    el('directorFocus').click();
    assert(!workspace.classList.contains('director-focus'), '顶栏专注按钮可退出专注模式');

    const inspectorScroll=el('rightScroll'),inspectorRight=el('right'),inspectorTarget=inspectorSections[3],inspectorSummary=makeEl('summary');
    const inspectorOriginal={
      targetQuery:inspectorTarget.querySelector,scrollRect:inspectorScroll.getBoundingClientRect,scrollTo:inspectorScroll.scrollTo,
      scrollTop:inspectorScroll.scrollTop,scrollHeight:inspectorScroll.scrollHeight,clientHeight:inspectorScroll.clientHeight,
      rightRect:inspectorRight.getBoundingClientRect,rightAnimations:inspectorRight.getAnimations
    };
    let inspectorWidth=240,inspectorCorrections=0;
    inspectorTarget.querySelector=selector=>selector==='summary'?inspectorSummary:inspectorOriginal.targetQuery.call(inspectorTarget,selector);
    inspectorScroll.scrollHeight=1200;inspectorScroll.clientHeight=100;inspectorScroll.scrollTop=0;
    inspectorScroll.getBoundingClientRect=()=>({left:0,top:0,right:inspectorWidth,bottom:100,width:inspectorWidth,height:100});
    inspectorRight.getBoundingClientRect=()=>({left:0,top:0,right:inspectorWidth,bottom:600,width:inspectorWidth,height:600});
    inspectorRight.getAnimations=()=>[];
    inspectorSummary.getBoundingClientRect=()=>({left:0,top:180-inspectorScroll.scrollTop,right:inspectorWidth,bottom:200-inspectorScroll.scrollTop,width:inspectorWidth,height:20});
    inspectorScroll.scrollTo=({top})=>{inspectorCorrections++;inspectorScroll.scrollTop=top;};
    assert(typeof T.inspectorScrollIsSettled==='function', '检查栏滚动暴露与产品相同的 settled 完成条件');
    T.setRightPanelState('rail',false);T.openInspector(3,'rightRailLighting');frames(2);
    assert(inspectorCorrections===0, '检查栏在最终几何稳定前不提前补滚');
    inspectorWidth=320;frames(3);
    assert(inspectorCorrections===1&&inspectorScroll.scrollTop===100&&T.inspectorScrollIsSettled(),
      '检查栏在 rail 宽度与 scrollport 几何稳定后只做一次目标补滚并报告 settled');
    ['wheel','touchstart','pointerdown','keydown'].forEach((eventType,index)=>{
      const initialScrollTop=31+index*19;
      inspectorCorrections=0;inspectorScroll.scrollTop=initialScrollTop;T.setRightPanelState('rail',false);T.openInspector(3,'rightRailLighting');frames(1);
      inspectorScroll.dispatch(eventType);frames(5);
      assert(inspectorCorrections===0&&inspectorScroll.scrollTop===initialScrollTop,
        `检查栏等待期间的 ${eventType} 保留用户滚动所有权并取消自动补滚`);
    });
    inspectorCorrections=0;inspectorScroll.scrollTop=0;T.setRightPanelState('rail',false);T.openInspector(0,'rightRailCamera');T.openInspector(3,'rightRailLighting');frames(3);
    assert(inspectorCorrections===1&&inspectorScroll.scrollTop===100,
      '检查栏连续快速入口只保留最后一次意图');
    inspectorTarget.querySelector=inspectorOriginal.targetQuery;inspectorScroll.getBoundingClientRect=inspectorOriginal.scrollRect;inspectorScroll.scrollTo=inspectorOriginal.scrollTo;
    inspectorScroll.scrollTop=inspectorOriginal.scrollTop;inspectorScroll.scrollHeight=inspectorOriginal.scrollHeight;inspectorScroll.clientHeight=inspectorOriginal.clientHeight;
    inspectorRight.getBoundingClientRect=inspectorOriginal.rightRect;inspectorRight.getAnimations=inspectorOriginal.rightAnimations;

    const viewport = el('viewport'), pipHolder = el('pip');
    const oldViewportSize = [viewport.clientWidth, viewport.clientHeight], oldPipWidth = pipHolder.clientWidth;
    viewport.clientWidth = 913; viewport.clientHeight = 509; pipHolder.clientWidth = 333;
    const resizeCountBefore = T.renderer.setSizeCalls;
    T.setDirectorFocus(true);
    frames(1);
    assert(T.renderer.setSizeCalls > resizeCountBefore, '专注切换主动触发主视口重算');
    triggerResizeObservers();
    frames(1);
    assert(T.renderer.lastSize?.[0] === 913 && T.renderer.lastSize?.[1] === 509 && Math.abs(T.viewCam.aspect - 913 / 509) < 1e-9,
      '主 renderer 与 viewCam 使用视口真实尺寸');
    const [aspectWidth, aspectHeight] = String(el('aspect').value || '16:9').split(':').map(Number);
    assert(Math.abs(T.shotCam.aspect - aspectWidth / aspectHeight) < 1e-9 && T.pipRenderer.lastSize?.[0] === 333 &&
      T.pipRenderer.lastSize?.[1] === Math.round(333 * aspectHeight / aspectWidth),
      '监视器 renderer 保持项目画幅，不受栏位状态污染');
    T.setDirectorFocus(false);
    viewport.clientWidth = oldViewportSize[0]; viewport.clientHeight = oldViewportSize[1]; pipHolder.clientWidth = oldPipWidth;

    T.setUITheme('graphite');
    T.setLeftPanelState('expanded');
    T.setRightPanelState('expanded');
    T.setTimelineState('hidden');
    frames(1);
  } catch (error) {
    assert(false, 'UI v3 状态机运行崩溃: ' + error.stack);
  }
} else {
  assert(false, '四主题运行时切换未执行：UI v3 API 不完整');
  assert(false, '左右栏与时间轴状态机未执行：UI v3 API 不完整');
  assert(false, '导演专注恢复未执行：UI v3 API 不完整');
  assert(false, 'renderer 尺寸联动未执行：UI v3 API 不完整');
}

T.closeTopCaptureMenus();
const dialogActor=T.actors.find(actor=>actor.kind!=='board');T.select(dialogActor);
const dialogProjectBefore=JSON.stringify(T.project),dialogStageBefore=JSON.stringify(T.stageToData());
const dialogUndoBefore=T.undoDepth,dialogAutosaveBefore=sandbox.localStorage._d.previz_autosave_v3;
const dialogWritesBefore=sandbox.localStorage._writes,dialogInspectorBefore=el('rightScroll').innerHTML;
for(const dialog of [el('keysDlg'),el('tplDlg')]){
  T.showCommandModal(dialog);
  const result=pressNativeDialogEscape([dialog]);
  assert(result.keydown.propagationStopped&&!result.keydown.defaultPrevented&&result.cancel&&!result.cancel.defaultPrevented&&
    !dialog.open&&T.selected===dialogActor,
    `${dialog.id} 的物理 Escape 只走原生 cancel/default action，不清除背后选择`);
}
el('btnNew').click();
const confirmEscape=pressNativeDialogEscape([el('confirmDlg')]);
assert(confirmEscape.keydown.propagationStopped&&!confirmEscape.keydown.defaultPrevented&&!el('confirmDlg').open&&
  JSON.stringify(T.project)===dialogProjectBefore,
  '确认弹窗物理 Escape 原生关闭且不执行确认回调');
T.showCommandModal(el('keysDlg'));T.showCommandModal(el('tplDlg'));
const layeredFirstEscape=pressNativeDialogEscape([el('keysDlg'),el('tplDlg')]);
const layeredAfterFirst={keys:el('keysDlg').open,template:el('tplDlg').open};
const layeredSecondEscape=pressNativeDialogEscape([el('keysDlg'),el('tplDlg')]);
assert(layeredFirstEscape.topmost===el('tplDlg')&&!layeredAfterFirst.template&&layeredAfterFirst.keys&&
  layeredSecondEscape.topmost===el('keysDlg')&&!el('keysDlg').open&&T.selected===dialogActor,
  '两层 modal 每次物理 Escape 仅关闭 topmost，背后选择始终保留');
T.showCommandModal(el('storyDlg'));T.setStoryboardDialogFullscreen(true);
const storyFullscreenEscape=pressNativeDialogEscape([el('storyDlg')]);
const storyOpenAfterFirst=el('storyDlg').open,storyFullscreenAfterFirst=T.storyboardDialogFullscreen;
const storyCloseEscape=pressNativeDialogEscape([el('storyDlg')]);
assert(storyFullscreenEscape.keydown.propagationStopped&&!storyFullscreenEscape.keydown.defaultPrevented&&
  storyFullscreenEscape.cancel.defaultPrevented&&storyOpenAfterFirst&&!storyFullscreenAfterFirst&&
  storyCloseEscape.keydown.propagationStopped&&!storyCloseEscape.keydown.defaultPrevented&&!storyCloseEscape.cancel.defaultPrevented&&
  !el('storyDlg').open&&T.selected===dialogActor,
  '分镜全屏物理 Escape 第一次还原、第二次原生关闭，并保留背后选择');
assert(JSON.stringify(T.project)===dialogProjectBefore&&JSON.stringify(T.stageToData())===dialogStageBefore&&
  T.undoDepth===dialogUndoBefore&&sandbox.localStorage._d.previz_autosave_v3===dialogAutosaveBefore&&
  sandbox.localStorage._writes===dialogWritesBefore&&el('rightScroll').innerHTML===dialogInspectorBefore,
  '弹窗 Escape 链对 project/stage/history/autosave/inspector 零副作用');
el('themeMenu').classList.remove('open');
el('themeTrigger').click();
assert(el('themeMenu').classList.contains('open') && !el('topSnapMenu').classList.contains('open') && !el('topRecordMenu').classList.contains('open'),
  '主题菜单打开时关闭其他同级菜单');
assert(el('themeTrigger').getAttribute('aria-expanded') === 'true', '主题菜单打开状态同步 aria-expanded');
el('topSnap').click();
assert(el('topSnapMenu').classList.contains('open') && !el('themeMenu').classList.contains('open') && !el('topRecordMenu').classList.contains('open'),
  '截图菜单与主题、录屏菜单互斥');

el('themeMenu').classList.add('open');
fireWindow('keydown', { key: 'Escape', code: 'Escape', target: documentStub.body });
assert(!el('themeMenu').classList.contains('open'), 'Escape 关闭当前菜单');
el('themeMenu').classList.add('open');
fireDocument('pointerdown', { target: makeEl('div') });
assert(!el('themeMenu').classList.contains('open'), '点击菜单外部关闭当前菜单');
el('themeMenu').classList.add('open'); el('topSnapMenu').classList.add('open'); el('topRecordMenu').classList.add('open');
if (T.closeUIMenus) T.closeUIMenus();
assert([el('themeMenu'), el('topSnapMenu'), el('topRecordMenu')].every(menu => !menu.classList.contains('open')),
  '菜单总关闭函数关闭全部菜单');

flushTimeouts();
assert(JSON.stringify(T.project) === uiProjectBefore, '主题、栏位、专注和菜单操作不改变项目根数据');
assert(JSON.stringify(T.stageToData()) === uiStageBefore, 'UI 操作不改变摄影机、时间轴、对象路径和场景数据');
assert(T.undoDepth === uiUndoBefore, 'UI 操作不写入项目撤销栈');
assert(sandbox.localStorage._d.previz_autosave_v3 === uiAutosaveBefore && !uiWrites.includes('previz_autosave_v3'),
  'UI 操作不触发项目自动保存');
const allowedUiKeys = new Set(['previz_ui_theme', 'previz_railc', 'previz_rightc', 'previz_timeline_state', 'previz_motion_open']);
assert(uiWrites.every(key => allowedUiKeys.has(key)), 'UI 状态只写独立本机偏好键: ' + [...new Set(uiWrites)].join(', '));
sandbox.localStorage.setItem = uiOriginalSetItem;

/* ---- 项目/场景/镜头钻取与底栏去重 ---- */
section('项目→场景→镜头层级与底栏去重');
const sceneRailStart = html.indexOf('<div id="sceneRail">');
const centerColStart = html.indexOf('<div id="centerCol">', sceneRailStart);
const sceneRailMarkup = html.slice(sceneRailStart, centerColStart);
assert(sceneRailStart >= 0 && centerColStart > sceneRailStart && sceneRailMarkup.includes('id="railBack"') &&
  sceneRailMarkup.includes('id="railTitle"') && sceneRailMarkup.includes('id="scenelist"'),
  '左栏具有返回、层级标题与场景/镜头列表容器');
assert(sceneRailMarkup.includes('id="addshot"') && sceneRailMarkup.indexOf('id="addshot"') < sceneRailMarkup.indexOf('id="scenelist"'),
  '新建镜头入口迁入左栏操作区');
assert(!htmlIds.has('tltrack') && !htmlIds.has('shotlist') && !htmlIds.has('playhead'),
  '底栏镜头条、重复镜头列表与其播放头已从 DOM 移除');
assert(!/canvas\.thumb\b/.test(html) && !/querySelectorAll\(['"]#shotlist canvas\.thumb/.test(appSrc) &&
  /querySelectorAll\(['"]#scenelist canvas\.shot-thumb/.test(appSrc),
  '缩略图渲染目标从底栏迁移到左栏镜头卡');
assert(!uiStyle.includes('#appWorkspace.director-focus #tltrack'),
  '导演专注模式不会重新显示已删除的底栏镜头条');
assert(T.initialTimelineState('filmstrip', null) === 'hidden' && T.initialTimelineState(null, '0') === 'hidden' &&
  T.setTimelineState('filmstrip', false) === 'hidden' && workspace.dataset.timeline === 'hidden',
  '旧 filmstrip 和 legacy=0 偏好一律迁移到 hidden，运行时不再产生第三态');

let hierarchySceneCards = dynamicByClass(el('scenelist'), 'scene-card');
assert(hierarchySceneCards.length === T.project.scenes.length,
  '项目层场景卡数与项目 scenes 数一致');
if (hierarchySceneCards.length) {
  const currentSceneCard = hierarchySceneCards[T.sceneIdx] || hierarchySceneCards[0];
  currentSceneCard.click();
  let hierarchyShotCards = dynamicByClass(el('scenelist'), 'shot-card');
  assert(hierarchyShotCards.length === T.shots.length,
    '点击场景后钻取到该场景的完整镜头列表');
  assert(hierarchyShotCards.every(card => dynamicContainsClass(card, 'shot-thumb')),
    '左栏镜头卡保留镜头缩略图作为唯一镜头浏览入口');
  if (hierarchyShotCards.length) {
    const targetShotIndex = hierarchyShotCards.length > 1 && T.shotIdx === 0 ? 1 : 0;
    const stableNavigationData = () => {
      const data = T.stageToData();
      return JSON.stringify({
        projectScenes: T.project.scenes,
        shots: data.shots,
        actorPaths: data.actors.map(actor => ({
          label: actor.label, path: actor.path, pathTimes: actor.pathTimes, pathEase: actor.pathEase,
          timeLink: actor.timeLink, timeLinkShot: actor.timeLinkShot, timeOffset: actor.timeOffset,
        })),
      });
    };
    const navigationDataBefore = stableNavigationData();
    hierarchyShotCards[targetShotIndex].click();
    hierarchyShotCards = dynamicByClass(el('scenelist'), 'shot-card');
    const selectedShotCards = hierarchyShotCards.filter(card => dynamicHasClass(card, 'sel'));
    assert(T.shotIdx === targetShotIndex && T.time === 0 && !T.playing,
      '点击左栏镜头同步当前镜头、归零时间并停止播放');
    assert(selectedShotCards.length === 1 && selectedShotCards[0] === hierarchyShotCards[targetShotIndex],
      '镜头层唯一高亮当前镜头');
    assert(el('monTitle').textContent.startsWith(`S${T.sceneIdx + 1} · C${targetShotIndex + 1}`),
      '左栏选镜后右侧监视器同步场景/镜头编号');
    assert(stableNavigationData() === navigationDataBefore,
      '切换镜头不改写镜头参数、机位数组、对象路径/时间/缓动或项目场景结构');
  } else {
    assert(false, '当前场景应至少显示一张左栏镜头卡');
  }
  el('railBack').click();
  hierarchySceneCards = dynamicByClass(el('scenelist'), 'scene-card');
  assert(hierarchySceneCards.length === T.project.scenes.length && dynamicByClass(el('scenelist'), 'shot-card').length === 0,
    '镜头层返回后恢复项目下场景列表，不混排两级卡片');
} else {
  assert(false, '左栏项目层应渲染 .scene-card');
}
T.setDirectorFocus(true);
assert(!htmlIds.has('tltrack') && !htmlIds.has('shotlist'),
  '进入导演专注后仍不存在底栏镜头预览');
T.setDirectorFocus(false);

/* ---- UI v2: 时间线/监视器/自绘确认/场景栏折叠 ---- */
section('UI v2: 时间线 + 监视器 + 确认框 + 场景栏');
const dialogCss = (html.match(/dialog\{([^}]*)\}/) || [,''])[1];
assert(dialogCss.includes('position:fixed') && dialogCss.includes('inset:0') && dialogCss.includes('margin:auto'),
  '模态确认框使用 fixed + inset:0 + margin:auto 屏幕居中');
const storyDialogCss=(html.match(/#storyDlg\{([^}]*)\}/)||[,''])[1];
const storyBodyCss=(html.match(/\.story-dialog-body\{([^}]*)\}/)||[,''])[1];
const storyFixedCss=(html.match(/\.story-dialog-head,\.story-dialog-foot\{([^}]*)\}/)||[,''])[1];
const storyPreviewCss=(html.match(/\.story-preview\{([^}]*)\}/)||[,''])[1];
const storyPlanScrollCss=(html.match(/\.story-plan-scroll\{([^}]*)\}/)||[,''])[1];
const storyResizeCss=(html.match(/\.story-resize-corner\{([^}]*)\}/)||[,''])[1];
const storyTextCss=(html.match(/#storyText\{([^}]*)\}/)||[,''])[1];
const storyMarkup=html.slice(html.indexOf('<dialog id="storyDlg"'),html.indexOf('<dialog id="confirmDlg"'));
const rightReframeCss=(html.match(/#reframeEditRight\{([^}]*)\}/)||[,''])[1];
const rightReframeLabelCss=(html.match(/#reframeEditRight span\{([^}]*)\}/)||[,''])[1];
assert(/id="rightTop"[\s\S]*id="monitor"[\s\S]*id="reframeEditRight" hidden aria-pressed="false"[\s\S]*id="playShot"/.test(html)&&
  rightReframeCss.includes('width:100%')&&rightReframeCss.includes('max-width:100%')&&rightReframeCss.includes('min-width:0')&&rightReframeCss.includes('overflow:hidden')&&
  rightReframeLabelCss.includes('min-width:0')&&rightReframeLabelCss.includes('overflow:hidden')&&rightReframeLabelCss.includes('text-overflow:ellipsis'),
  '右侧 9:16 入口固定在 monitor 与播放控制之间，宽度受右栏约束且标签不会造成横向溢出');
assert(storyDialogCss.includes('width:960px')&&storyDialogCss.includes('height:760px')&&storyDialogCss.includes('inset:auto')&&storyDialogCss.includes('overflow:hidden')&&
  storyBodyCss.includes('display:flex')&&storyBodyCss.includes('min-height:0')&&storyBodyCss.includes('overflow:hidden')&&
  storyFixedCss.includes('flex:0 0 auto')&&storyPreviewCss.includes('min-height:0')&&storyPreviewCss.includes('overflow:hidden')&&
  storyPlanScrollCss.includes('flex:1 1 120px')&&storyPlanScrollCss.includes('overflow:auto'),
  '规划器使用弹性布局：标题/底栏固定，角色区固定，节拍与镜头独立占用剩余高度滚动');
assert(storyMarkup.indexOf('class="story-preview-pinned"')<storyMarkup.indexOf('id="storyRoleList"')&&
  storyMarkup.indexOf('id="storyRoleList"')<storyMarkup.indexOf('id="storyPlanScroll"')&&
  storyMarkup.indexOf('id="storyPlanScroll"')<storyMarkup.indexOf('id="storyBeatList"')&&
  storyMarkup.indexOf('id="storyBeatList"')<storyMarkup.indexOf('id="storyShotList"')&&
  storyMarkup.indexOf('class="story-dialog-foot"')<storyMarkup.indexOf('id="storyResizeNW"'),
  '角色映射位于独立滚动区外，节拍/镜头位于滚动区内，底部动作不会随长列表滚走');
assert(storyResizeCss.includes('width:24px')&&storyResizeCss.includes('height:24px')&&storyResizeCss.includes('touch-action:none')&&
  storyTextCss.includes('resize:none')&&storyTextCss.includes('overflow:auto')&&
  html.includes('[data-corner="nw"]{left:0;top:0;cursor:nwse-resize}')&&html.includes('[data-corner="ne"]{right:0;top:0;cursor:nesw-resize}')&&
  html.includes('[data-corner="sw"]{left:0;bottom:0;cursor:nesw-resize}')&&html.includes('[data-corner="se"]{right:0;bottom:0;cursor:nwse-resize}')&&
  html.includes('.story-window-button:focus-visible,.story-resize-corner:focus-visible{outline:2px solid var(--focus)')&&
  ['NW','NE','SW','SE'].every(corner=>new RegExp(`<button[^>]+id="storyResize${corner}"[^>]+data-i18n-aria-label="storyboard\\.window\\.resize${corner}"`).test(storyMarkup)),
  '四角命中区至少 24×24，对角光标、焦点环和双语 aria 完整；仅剧本输入禁用原生缩放');
assert(['storyboard.window.fullscreen','storyboard.window.restore','storyboard.window.resizeNW','storyboard.window.resizeNE','storyboard.window.resizeSW','storyboard.window.resizeSE','storyboard.window.planScroll'].every(key=>
  sandbox.PreVisionI18n.t(key,{},'zh-CN')!==key&&sandbox.PreVisionI18n.t(key,{},'en-US')!==key)&&
  /id="storyFullscreen"[^>]+data-i18n-title="storyboard\.window\.fullscreen"[^>]+data-i18n-aria-label="storyboard\.window\.fullscreen"/.test(storyMarkup),
  '应用内全屏/还原、缩放和列表滚动的可见文案、tooltip 与 aria 均由中英文 language key 提供');
assert(!!el('motionPanel') && !!el('motionRows') && !!el('motionPlayhead'),
  '底栏只保留多轨调度时间轴与其播放头');
assert(el('monTitle').textContent.startsWith('S'), '监视器标题含场景/镜头号: ' + el('monTitle').textContent);
assert(el('monLens').textContent.includes('mm'), '监视器焦段读数: ' + el('monLens').textContent);
/* 自绘确认: 删除镜头需二次确认 */
const nShots = T.shots.length;
el('delShot').click();
assert(T.shots.length === nShots, '点删除后未立即删除(等待确认)');
assert(el('confirmMsg').textContent.includes('删除镜头'), '确认框文案正确');
el('confirmOk').click();
assert(T.shots.length === nShots - 1, '确认后镜头删除');
el('confirmCancel').click();   // 空回调安全
el('addshot').click();         // 补回
/* 场景栏折叠 */
el('railToggle').click();
assert(el('sceneRail').classList.contains('collapsed') && el('appWorkspace').dataset.left === 'rail', '场景栏折叠为模式轨生效');
assert(sandbox.localStorage._d['previz_railc'] === '1', '折叠状态持久化');
el('modeScenes').click();
assert(!el('sceneRail').classList.contains('collapsed') && el('appWorkspace').dataset.left === 'expanded', '从常驻模式轨恢复场景栏展开');

/* ---- 右栏拖拽调宽 ---- */
section('右栏宽度拖拽');
assert(el('dragbar').getAttribute('role')==='separator'&&el('dragbar').getAttribute('aria-orientation')==='vertical'&&el('dragbar').getAttribute('tabindex')==='0'&&
  uiStyle.includes('#dragbar::before')&&uiStyle.includes('#dragbar::after'),
  '右栏分隔条提供可聚焦的双三角连续拖拽提示');
const keyboardRightWidth=parseInt(el('right').style.width)||336;
const dragbarArrowLeft=makeEvent({key:'ArrowLeft'});el('dragbar').dispatch('keydown',dragbarArrowLeft);
assert(parseInt(el('right').style.width)===keyboardRightWidth+16&&el('dragbar').getAttribute('aria-valuenow')===String(keyboardRightWidth+16),
  '键盘左箭头可连续增宽右栏并同步 separator 数值');
assert(dragbarArrowLeft.propagationStopped,'分隔条方向键不冒泡触发全局上一镜/下一镜快捷键');
el('dragbar').dispatch('keydown',{key:'ArrowRight'});
assert(parseInt(el('right').style.width)===keyboardRightWidth,'键盘右箭头可将右栏宽度调回');
el('dragbar').dispatch('pointerdown', { pointerId: 1, clientX: 1364 });
assert(el('right').classList.contains('resizing'),'指针拖动期间关闭右栏宽度过渡以保持无级跟手');
(winListeners['pointermove'] || []).forEach(f => f({ clientX: 1250 }));
assert(el('right').style.width === '350px', '拖拽后右栏宽度=350px, 实际 ' + el('right').style.width);
(winListeners['pointermove'] || []).forEach(f => f({ clientX: 100 }));
assert(el('right').style.width === '800px', '宽度上限为应用宽度一半 800px, 实际 ' + el('right').style.width);
sandbox.innerWidth=1200;
(winListeners['resize'] || []).forEach(f => f({}));
assert(el('right').style.width === '600px', '窗口缩小时右栏重新钳制为半屏 600px, 实际 ' + el('right').style.width);
sandbox.innerWidth=1600;
(winListeners['pointermove'] || []).forEach(f => f({ clientX: 1550 }));
assert(el('right').style.width === '280px', '宽度下限钳制 280px, 实际 ' + el('right').style.width);
(winListeners['pointerup'] || []).forEach(f => f({}));
assert(sandbox.localStorage._d['previz_rightw'] === '280', '宽度持久化到 localStorage');
assert(!el('right').classList.contains('resizing'),'右栏拖动结束后恢复普通状态过渡');
(winListeners['pointermove'] || []).forEach(f => f({ clientX: 1250 }));
assert(el('right').style.width === '280px', '松手后拖拽停止');

/* ---- modal 是唯一命令所有者，背后工作区不得接收快捷键 ---- */
section('模态命令所有权与背后快捷键隔离');
const commandDialogs=[el('keysDlg'),el('tplDlg'),el('storyDlg'),el('confirmDlg')];
commandDialogs.forEach(dialog=>{dialog.hidden=false;if(dialog.open)dialog.close();});
T.setStoryboardDialogFullscreen(false);T.closeUIMenus();T.setDirectorFocus(false);T.setRightPanelState('expanded',false);flushTimeouts();
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),
  '无 dialog 时工作区是唯一全局命令所有者');
el('keysDlg').showModal();
assert(T.currentModalCommandOwner()===el('keysDlg'),'直接 showModal 的原生 top-layer dialog 取得命令所有权');
el('tplDlg').showModal();
assert(T.currentModalCommandOwner()===el('tplDlg')&&T.currentCommandOwner()===el('tplDlg'),
  '嵌套直接 showModal 按实际打开顺序只把最上层模板窗口认作命令所有者');
el('tplDlg').close();
assert(T.currentModalCommandOwner()===el('keysDlg'),'顶层动态关闭后所有权即时回落到下一层 dialog');
el('tplDlg').showModal();
assert(T.currentModalCommandOwner()===el('tplDlg'),'关闭后重新 showModal 会按本次 top-layer 顺序重新取得所有权');
el('tplDlg').close();el('keysDlg').close();
el('keysDlg').show();
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),
  '非模态 dialog.show() 不夺走工作区命令');
el('keysDlg').close();el('keysDlg').open=true;
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),
  '静态 dialog[open] 不被误判为原生 top-layer modal');
el('keysDlg').open=false;
const commandStyleBefore=sandbox.getComputedStyle;
sandbox.getComputedStyle=node=>({display:node?.style?.display||'',visibility:node?.style?.visibility||''});
const nativeHiddenHost=makeEl('div');nativeHiddenHost.style.display='none';documentBody.appendChild(nativeHiddenHost);nativeHiddenHost.appendChild(el('keysDlg'));
T.showCommandModal(el('keysDlg'));
assert(T.currentModalCommandOwner()===el('keysDlg'),'原生 :modal/top-layer 不被原 DOM 祖先 display:none 误伤');
el('keysDlg').close();nativeHiddenHost.remove();el('keysDlg').parentElement=null;
const ariaHost=makeEl('div'),ariaPeerHost=makeEl('div'),ariaModal=el('statusBar'),ariaPeer=el('saveState');
documentBody.appendChild(ariaHost);documentBody.appendChild(ariaPeerHost);ariaHost.appendChild(ariaModal);ariaPeerHost.appendChild(ariaPeer);
for(const aria of [ariaModal,ariaPeer]){aria.setAttribute('role','dialog');aria.setAttribute('aria-modal','true');}
ariaModal.focus();assert(T.currentModalCommandOwner()===ariaModal&&T.currentCommandOwner()===ariaModal,
  '可见 aria-modal 自定义 dialog 可成为命令所有者');
ariaPeer.focus();assert(T.currentModalCommandOwner()===ariaPeer,'后聚焦的第二个 aria-modal 成为顶层命令所有者');
ariaPeerHost.style.display='none';
assert(T.currentModalCommandOwner()===ariaModal,'aria-modal 的 display:none 祖先使当前 owner 释放并回落到下一层');
ariaPeerHost.style.display='';ariaPeer.focus();
assert(T.currentModalCommandOwner()===ariaPeer,'display 祖先恢复后按新的实时序号重新成为 owner');
ariaPeerHost.setAttribute('aria-hidden','true');
assert(T.currentModalCommandOwner()===ariaModal,'aria-hidden 祖先同样释放 aria-modal owner');
ariaPeerHost.removeAttribute('aria-hidden');ariaPeer.focus();
assert(T.currentModalCommandOwner()===ariaPeer,'aria-hidden 祖先恢复后重新聚焦可按正确序号取得 owner');
ariaHost.setAttribute('aria-hidden','true');ariaPeerHost.setAttribute('aria-hidden','true');
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),
  '全部 aria-modal 被祖先隐藏后立即释放命令所有权且不保留陈旧序号');
for(const aria of [ariaModal,ariaPeer]){aria.removeAttribute('aria-modal');aria.removeAttribute('role');aria.parentElement=null;}
ariaHost.remove();ariaPeerHost.remove();sandbox.getComputedStyle=commandStyleBefore;documentStub.body.focus();
T.showCommandModal(el('keysDlg'));el('keysDlg').open=false;el('keysDlg')._modal=false;
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),
  'dialog 异常失去 open 状态后不留下永久命令锁');
T.showCommandModal(el('keysDlg'));fireWindow('pageshow',{persisted:true});
assert(T.currentModalCommandOwner()===el('keysDlg'),'BFCache pageshow 恢复后仍从当前可见 DOM 实时得到 modal 所有者');
el('keysDlg').hidden=true;
assert(T.currentModalCommandOwner()===null&&T.currentCommandOwner()===el('appWorkspace'),'open 但不可见的 dialog 不占用命令所有权');
el('keysDlg').hidden=false;assert(T.currentModalCommandOwner()===el('keysDlg'),'dialog 恢复可见后无需重建锁即可重新取得所有权');
el('keysDlg').close();

const shortcutButtonIds=['playBtn','prevShot','nextShot','modeMove','modeRot','camDrive','fitAll','delActor'];
const shortcutOriginalClicks=new Map(),shortcutClickCounts=Object.fromEntries(shortcutButtonIds.map(id=>[id,0]));
shortcutButtonIds.forEach(id=>{
  const button=el(id),original=button.click;shortcutOriginalClicks.set(id,original);
  button.click=function(...args){shortcutClickCounts[id]++;return original.apply(this,args);};
});
if(T.playing)shortcutOriginalClicks.get('playBtn').call(el('playBtn'));
const commandActor=T.actors.find(actor=>actor.kind!=='board');T.select(commandActor);T.setTime(Math.min(.37,T.curShot().dur));flushTimeouts();
const modalStateBefore={
  project:JSON.stringify(T.project),stage:JSON.stringify(T.stageToData()),selected:T.selected,undo:T.undoDepth,
  autosave:sandbox.localStorage._d.previz_autosave_v3,writes:sandbox.localStorage._writes,time:T.time,playing:T.playing,shotIdx:T.shotIdx,
  viewCam:T.viewCam.position.toArray(),camDrive:T.camDriveMode,directorFocus:el('appWorkspace').classList.contains('director-focus')
};
T.showCommandModal(el('keysDlg'));
let menuLikeCommandCalls=0;
let desktopOpenCalls=0,desktopSaveCalls=0;
const desktopRendererCallbacks={};
T.bindDesktopProjectCommands({
  onMenuOpenProject(callback){desktopRendererCallbacks.open=callback;},
  onMenuSaveProject(callback){desktopRendererCallbacks.save=callback;},
},{open:()=>{desktopOpenCalls++;},save:()=>{desktopSaveCalls++;}});
assert(T.runWorkspaceCommand(()=>{menuLikeCommandCalls++;})===false&&menuLikeCommandCalls===0,
  'Electron 菜单复用的 workspace command 门禁在 modal 期间拒绝 open/save 类回调');
desktopRendererCallbacks.open();desktopRendererCallbacks.save();
assert(desktopOpenCalls===0&&desktopSaveCalls===0,
  'renderer 实际注册的 Electron open/save 回调在 modal 期间均不调用项目命令');
const blockedShortcutSpecs=[
  ['Space',{code:'Space',key:' '}],['Delete',{code:'Delete',key:'Delete'}],['Backspace',{code:'Backspace',key:'Backspace'}],
  ['G',{code:'KeyG',key:'g'}],['R',{code:'KeyR',key:'r'}],['C',{code:'KeyC',key:'c'}],['F',{code:'KeyF',key:'f'}],['K',{code:'KeyK',key:'k'}],
  ['ArrowLeft',{code:'ArrowLeft',key:'ArrowLeft'}],['ArrowRight',{code:'ArrowRight',key:'ArrowRight'}],
  ['ArrowUp',{code:'ArrowUp',key:'ArrowUp'}],['ArrowDown',{code:'ArrowDown',key:'ArrowDown'}],
  ['Cmd+S',{metaKey:true,key:'s'}],['Ctrl+S',{ctrlKey:true,key:'S'}],['Cmd+O',{metaKey:true,key:'o'}],['Ctrl+O',{ctrlKey:true,key:'O'}],
  ['Cmd+Shift+S',{metaKey:true,shiftKey:true,key:'s'}],['Ctrl+Shift+S',{ctrlKey:true,shiftKey:true,key:'S'}],
  ['Cmd+Shift+O',{metaKey:true,shiftKey:true,key:'o'}],['Ctrl+Shift+O',{ctrlKey:true,shiftKey:true,key:'O'}],
  ['Cmd+Z',{metaKey:true,key:'z'}],['Ctrl+Z',{ctrlKey:true,key:'Z'}],['Cmd+Shift+Z',{metaKey:true,shiftKey:true,key:'z'}],
  ['Ctrl+Y',{ctrlKey:true,key:'y'}],['Shift+Z',{shiftKey:true,key:'z'}],['Cmd+Shift+F',{metaKey:true,shiftKey:true,key:'f'}],
  ['Cmd+C',{metaKey:true,key:'c'}],['Cmd+V',{metaKey:true,key:'v'}]
];
const blockedShortcutEvents=blockedShortcutSpecs.map(([label,spec])=>[label,fireWindow('keydown',Object.assign({target:documentStub.body,repeat:false},spec))]);
assert(blockedShortcutEvents.filter(([label])=>['Cmd+S','Ctrl+S','Cmd+O','Ctrl+O'].includes(label)).every(([,event])=>event.defaultPrevented),
  'modal 内 Cmd/Ctrl+S/O 同时阻止项目命令与浏览器原生文件对话框');
assert(blockedShortcutEvents.filter(([label])=>label.includes('Shift+')&&/[SO]$/.test(label)).every(([,event])=>!event.defaultPrevented)&&
  !T.isProjectFileAccelerator({metaKey:true,shiftKey:true,key:'s'})&&!T.isProjectFileAccelerator({ctrlKey:true,shiftKey:true,key:'o'}),
  'Cmd/Ctrl+Shift+S/O 不会被精确项目 open/save gate 冒充');
assert(shortcutButtonIds.every(id=>shortcutClickCounts[id]===0),
  'modal 内 Space/Delete/Backspace/G/R/C/F/K/方向键均未点击任何背后工作区命令入口');
assert(JSON.stringify(T.project)===modalStateBefore.project&&JSON.stringify(T.stageToData())===modalStateBefore.stage&&
  T.selected===modalStateBefore.selected&&T.undoDepth===modalStateBefore.undo&&
  sandbox.localStorage._d.previz_autosave_v3===modalStateBefore.autosave&&sandbox.localStorage._writes===modalStateBefore.writes&&
  T.time===modalStateBefore.time&&T.playing===modalStateBefore.playing&&T.shotIdx===modalStateBefore.shotIdx&&
  JSON.stringify(T.viewCam.position.toArray())===JSON.stringify(modalStateBefore.viewCam)&&T.camDriveMode===modalStateBefore.camDrive&&
  el('appWorkspace').classList.contains('director-focus')===modalStateBefore.directorFocus,
  'modal 快捷键矩阵对 project/selection/history/autosave/time/playing/镜头/导演视角零副作用');

const localControlEvents=[
  fireWindow('keydown',{code:'Space',key:' ',target:el('storyGen')}),
  fireWindow('keydown',{code:'Space',key:' ',target:el('storyTemplate')}),
  fireWindow('keydown',{code:'Enter',key:'Enter',target:el('storyGen')}),
  fireWindow('keydown',{code:'Tab',key:'Tab',target:el('storyText')}),
  fireWindow('keydown',{code:'Tab',key:'Tab',shiftKey:true,target:el('storyText')}),
  fireWindow('keydown',{code:'Delete',key:'Delete',target:el('storyText')}),
  fireWindow('keydown',{metaKey:true,key:'z',target:el('storyText')}),
  fireWindow('keydown',{ctrlKey:true,key:'Z',target:el('storyText')}),
  fireWindow('keydown',{metaKey:true,shiftKey:true,key:'z',target:el('storyText')}),
  fireWindow('keydown',{ctrlKey:true,key:'y',target:el('storyText')})
];
const localWheel=el('storyPlanScroll').dispatch('wheel',makeEvent({deltaY:120}));
assert(localControlEvents.every(event=>!event.defaultPrevented)&&!localWheel.defaultPrevented,
  '全局监听不拦截 modal 本地控件事件；浏览器原生激活、焦点、编辑撤销与滚动另由真实 Chromium DOM probe 验证');
const alreadyPrevented=makeEvent({defaultPrevented:true,code:'Space',key:' ',target:documentStub.body});fireWindow('keydown',alreadyPrevented);
const composingCommand=fireWindow('keydown',{isComposing:true,metaKey:true,key:'s',target:documentStub.body});
const ime229Command=fireWindow('keydown',{keyCode:229,code:'Delete',key:'Delete',target:documentStub.body});
assert(alreadyPrevented.defaultPrevented&&!composingCommand.defaultPrevented&&!ime229Command.defaultPrevented&&shortcutButtonIds.every(id=>shortcutClickCounts[id]===0),
  '`defaultPrevented`、composing 与 IME keyCode=229 优先返回，不重复执行或改写命令');
el('keysDlg').close();

const modifiedShortcutSpecs=[
  {code:'Space',key:' ',shiftKey:true},{code:'KeyG',key:'g',metaKey:true},{code:'KeyR',key:'r',ctrlKey:true},
  {code:'KeyC',key:'c',altKey:true},{code:'KeyF',key:'f',shiftKey:true},{code:'KeyK',key:'k',shiftKey:true},
  {code:'ArrowLeft',key:'ArrowLeft',metaKey:true},{code:'ArrowRight',key:'ArrowRight',shiftKey:true}
];
const clicksBeforeModified=JSON.stringify(shortcutClickCounts);
const modifiedShortcutEvents=modifiedShortcutSpecs.map(spec=>fireWindow('keydown',Object.assign({target:documentStub.body},spec)));
assert(modifiedShortcutEvents.every(event=>!event.defaultPrevented)&&JSON.stringify(shortcutClickCounts)===clicksBeforeModified&&
  modifiedShortcutSpecs.every(spec=>!T.isBareWorkspaceShortcut(spec)),
  '带 Cmd/Ctrl/Alt/Shift 的 Space、G/R/C/F/K 和方向键不会误当成裸工作区快捷键');
const preHandledClicks=JSON.stringify(shortcutClickCounts);
const preHandledSpace=makeEvent({defaultPrevented:true,code:'Space',key:' ',target:documentStub.body});fireWindow('keydown',preHandledSpace);
const composingSpace=fireWindow('keydown',{isComposing:true,code:'Space',key:' ',target:documentStub.body});
assert(JSON.stringify(shortcutClickCounts)===preHandledClicks&&preHandledSpace.defaultPrevented&&!composingSpace.defaultPrevented,
  '无 modal 时已处理事件与输入法组合事件同样不触发工作区命令');

assert(T.runWorkspaceCommand(()=>++menuLikeCommandCalls)===1&&menuLikeCommandCalls===1,
  'modal 关闭后 Electron 菜单复用门禁立即恢复工作区命令');
desktopRendererCallbacks.open();desktopRendererCallbacks.save();
assert(desktopOpenCalls===1&&desktopSaveCalls===1,
  'modal 关闭后 renderer 的 Electron open/save 回调立即恢复调用项目命令');
const noModalCounts={...shortcutClickCounts};
const noModalSpaceStart=fireWindow('keydown',{code:'Space',key:' ',target:documentStub.body,repeat:false});
const noModalSpaceStop=fireWindow('keydown',{code:'Space',key:' ',target:documentStub.body,repeat:false});
['ArrowRight','ArrowLeft'].forEach(key=>fireWindow('keydown',{code:key,key,target:documentStub.body}));
['g','r','c','f'].forEach(key=>fireWindow('keydown',{code:'Key'+key.toUpperCase(),key,target:documentStub.body}));
T.select(commandActor);flushTimeouts();
assert(T.currentCameraPositionCommandIndices().length===0,'无 modal 的 Delete oracle 明确建立无摄影机 Position 选择状态');
const noModalDeleteBefore={
  project:JSON.stringify(T.project),stage:JSON.stringify(T.stageToData()),actors:T.actors.slice(),selected:T.selected,
  undo:T.undoDepth,history:T.historyCurrent,historySequence:T.historyCommitSequence,pending:T.historyPending,
  dirty:T.dirtyTimer,autosave:sandbox.localStorage._d.previz_autosave_v3,writes:sandbox.localStorage._writes,
  motionStatus:el('motionStatus').textContent,saveState:el('saveState').textContent
};
el('motionStatus').textContent='delete-route-sentinel';
const noModalDelete=fireWindow('keydown',{code:'Delete',key:'Delete',target:documentStub.body});
const noModalDeleteFeedback=sandbox.PreVisionI18n.t('timeline.delete.invalidSelection');
assert(noModalSpaceStart.defaultPrevented&&noModalSpaceStop.defaultPrevented&&shortcutClickCounts.playBtn===noModalCounts.playBtn+2&&
  shortcutClickCounts.nextShot===noModalCounts.nextShot+1&&shortcutClickCounts.prevShot===noModalCounts.prevShot+1&&
  shortcutClickCounts.modeMove===noModalCounts.modeMove+1&&shortcutClickCounts.modeRot===noModalCounts.modeRot+1&&
  shortcutClickCounts.camDrive===noModalCounts.camDrive+1&&shortcutClickCounts.fitAll===noModalCounts.fitAll+1&&
  shortcutClickCounts.delActor===noModalCounts.delActor&&noModalDelete.defaultPrevented&&el('motionStatus').textContent===noModalDeleteFeedback&&
  JSON.stringify(T.project)===noModalDeleteBefore.project&&JSON.stringify(T.stageToData())===noModalDeleteBefore.stage&&
  T.actors.length===noModalDeleteBefore.actors.length&&T.actors.every((actor,index)=>actor===noModalDeleteBefore.actors[index])&&
  T.selected===noModalDeleteBefore.selected&&T.undoDepth===noModalDeleteBefore.undo&&T.historyCurrent===noModalDeleteBefore.history&&
  T.historyCommitSequence===noModalDeleteBefore.historySequence&&T.historyPending===noModalDeleteBefore.pending&&
  T.dirtyTimer===noModalDeleteBefore.dirty&&sandbox.localStorage._d.previz_autosave_v3===noModalDeleteBefore.autosave&&
  sandbox.localStorage._writes===noModalDeleteBefore.writes,
  '无 modal 时 Space、方向键、G/R/C/F 恢复；Delete 由统一路由消费且不 fallback 删除演员或写项目/history/autosave');
el('motionStatus').textContent=noModalDeleteBefore.motionStatus;el('saveState').textContent=noModalDeleteBefore.saveState;
if(el('confirmDlg').open)el('confirmCancel').click();
const savedModified=T.project.modified;T.project.modified='command-save-sentinel';
const noModalSave=fireWindow('keydown',{metaKey:true,key:'s',target:documentStub.body});
assert(noModalSave.defaultPrevented&&T.project.modified!=='command-save-sentinel','无 modal 时 Cmd+S 仍调用既有项目保存语义');
T.project.modified=savedModified;
T.closeUIMenus();T.setDirectorFocus(false);T.setRightPanelState('expanded',false);T.select(commandActor);
const noModalEscape=fireWindow('keydown',{code:'Escape',key:'Escape',target:documentStub.body});
assert(!noModalEscape.defaultPrevented&&T.selected===null,'无 dialog 时 Escape 保留既有清除画布选择语义');
shortcutButtonIds.forEach(id=>{el(id).click=shortcutOriginalClicks.get(id);});

/* ---- 全按键扫描(最后跑, 会改动状态) ---- */
section('全按键扫描');
if (T.setDirectorFocus) T.setDirectorFocus(false);
for (const [id, el] of Object.entries(elements)) {
  if (typeof el.onclick === 'function') {
    try { el.click(); frames(2); } catch (e) { assert(false, `按键 ${id} 点击崩溃: ${e.message}`); }
  }
  if (typeof el.oninput === 'function') {
    try { el.oninput({ target: el }); } catch (e) { assert(false, `控件 ${id} oninput 崩溃: ${e.message}`); }
  }
  if (typeof el.onchange === 'function' && id !== 'fileOpen') {
    try { el.onchange({ target: { value: el.value || '16:9' } }); } catch (e) { assert(false, `控件 ${id} onchange 崩溃: ${e.message}`); }
  }
}
/* 模板对话框里的动态按钮 */
el('addScene').click();
const tplBtn = el('tplBtns').children[0];
if (tplBtn) { tplBtn.click(); assert(T.curScene().name.includes('场景'), '模板新建场景成功'); }
frames(20);
flushTimeouts();
frames(5);
assert(true, '全按键扫描后渲染循环仍存活');

/* ---- id 引用校验 ---- */
const allowedDynamic = new Set(['errbar']);
const badIds = [...missingIds].filter(id => !allowedDynamic.has(id));
assert(badIds.length === 0, 'JS 引用了 HTML 中不存在的 id: ' + badIds.join(', '));

finish(requestedModule ? `模块 ${requestedModule} 结果` : '结果');

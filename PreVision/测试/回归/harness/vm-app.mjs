/*
 * 预见 PreVision 回归测试 · 最小 VM 启动器
 * 来源: 从 测试/冒烟测试.mjs 抽取的 DOM/WebGL/localStorage stub 与
 *       "提取 2 个 <script> 块 → vm 运行 → boot" 逻辑(允许与冒烟测试少量重复,
 *       重构期间不动冒烟测试本体 —— 见 回归测试清单.md §0)。
 * 用法: const app = bootApp({ autosaveRaw, storage, ... });
 *       app.T.<应用顶层函数>(...) 直接驱动真实应用。
 * 确定性: Date 冻结为 FROZEN_ISO、Math.random 固定种子 —— golden 录制与回放共用同一套环境。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(dir, '..', '..', '..');
export const html = fs.readFileSync(path.join(root, '预见PreVision.html'), 'utf8');
const localeZhSrc = fs.readFileSync(path.join(root, 'i18n', 'locales', 'zh-CN.js'), 'utf8');
const localeEnSrc = fs.readFileSync(path.join(root, 'i18n', 'locales', 'en-US.js'), 'utf8');
const i18nRuntimeSrc = fs.readFileSync(path.join(root, 'i18n', 'runtime.js'), 'utf8');

/* ---- 提取 script 块(与冒烟测试同一契约: 恰好 2 个无属性块) ---- */
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length !== 2) throw new Error(`HTML 应含 2 个 <script> 块, 实际 ${blocks.length}`);
export const [threeSrc, appSrc] = blocks;

const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const htmlElementMetaSource = new Map();
for (const match of html.matchAll(/<([a-z][\w:-]*)\b([^>]*\bid="([^"]+)"[^>]*)>/gi)) {
  if (!htmlElementMetaSource.has(match[3])) htmlElementMetaSource.set(match[3], { tag: match[1], attrs: match[2] });
}

export const FROZEN_ISO = '2026-01-01T00:00:00.000Z';
const FROZEN_MS = Date.parse(FROZEN_ISO);
export const AUTOSAVE_KEY = 'previz_autosave_v3';

/* 冻结 Date: new Date() / Date.now() 恒等于 FROZEN_ISO, 带参构造保持原语义 */
class FrozenDate extends Date {
  constructor(...args) { args.length ? super(...args) : super(FROZEN_MS); }
  static now() { return FROZEN_MS; }
}

/* 应用层测试钩子(仅回归测试所需的最小面) */
const hook = `;globalThis.__T={
  get project(){return project},get actors(){return actors},get shots(){return shots},
	  get sceneIdx(){return sceneIdx},get shotIdx(){return shotIdx},
	  get time(){return time},get playing(){return playing},setTime(v){time=v},
	  get startupState(){return startupState},get dirtyTimer(){return dirtyTimer},
	  AUTOSAVE_KEY,PROJECT_VERSION,
	  curScene,curShot,loadScene,setShot,stageToData,sceneJSON,syncScene,gcAssets,
	  normalizeProjectData,isRestorableProject,readStartupProject,startupStatusKey,activateStartupProject,
	  newProject,makeFirstRunWelcomeProject,openProjectData,saveProjectFile,markDirty,
	  flushPendingAutosave:typeof flushPendingAutosave==='function'?flushPendingAutosave:null,
	  genPrompt,updateActors,updateShotCam,ensureCamKeys,makeZip,hasBg,
	  captureAutomaticCaptureState,prepareAutomaticCapture,beginCaptureTransaction,ownsCaptureTransaction,
	  finalizeCaptureTransaction,stopActiveCapture,recordBlob,exportCurrentShotVideo,
	  captureAutomaticExportTarget,prepareAutomaticCaptureTextures,bindAutomaticCaptureTarget,activateAutomaticCaptureShot,
	  renderSeedanceWhiteModelFrame,setSeedanceProgress,updateSeedanceProfileUI,exportSeedanceWhiteModelPackage,
	  planSeedanceWhiteModelPackage,seedanceTimestampScript,buildSeedanceManifest,verifySeedanceZipManifest,
	  get captureTransaction(){return captureTransaction},
	  get captureState(){return {recording,recTrack,recTick,recStep,recStop,playAllMode}},
	  get recCanvas(){return recCanvas},get recRenderer(){return recRenderer},get workspaceCanvas(){return workspaceCanvas},
	  get scene(){return scene},get renderer(){return renderer},get shotCam(){return shotCam},get sky(){return sky},get ground(){return ground},
	  get historySnapshot(){return {current:historyCurrent,pending:historyPending,undo:undoStack.slice(),sequence:historyCommitSequence,lifecycle:historyLifecycleSequence}},
	  forceCaptureNavigation(si,ci){sceneIdx=si;shotIdx=ci},
	};`;

/**
 * 启动一个全新的应用 VM 实例。
 * @param {object} options
 * @param {string|null} [options.autosaveRaw]   预置 localStorage 的 previz_autosave_v3 原始串(缺省=不存在, 走 firstRun)
 * @param {object}  [options.storageSeed]       预置到 localStorage 的其他键值(默认与冒烟测试同款 UI 键)
 * @param {object}  [options.storage]           整体替换 localStorage stub(优先级最高)
 * @param {boolean} [options.autosaveGetThrows] getItem(previz_autosave_v3) 抛错(模拟 storage 不可用)
 */
export function bootApp(options = {}) {
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
    if (selector.startsWith('#')) return node.id === selector.slice(1);
    if (selector.startsWith('.')) return node.classList?.contains(selector.slice(1));
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
      appendChild(c) { c.parentElement = this; this.children.push(c); return c; },
      remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; },
      close() {
        this.open = false; this._modal = false;
        if (documentStub.activeElement === this || this.contains(documentStub.activeElement)) documentStub.activeElement = documentStub.body;
        this.dispatch('close', makeEvent());
      },
      showModal() { this.open = true; this._modal = true; documentStub.activeElement = this; },
      show() { this.open = true; this._modal = false; documentStub.activeElement = this; },
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
      querySelector(selector) { return queryElements(selector)[0] || makeEl('div'); },
      querySelectorAll(selector) { return queryElements(selector); },
      getBoundingClientRect() { return { left: 0, top: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight }; },
      getContext() { return make2d(); },
      toDataURL() { return 'data:image/png;base64,AAAA'; },
      captureStream() {
        const track = { stopped: false, requestFrame: noop, stop() { this.stopped = true; } };
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
      set(v) { this._html = String(v); this.children = []; },
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
    for (const [id, meta] of htmlElementMetaSource) {
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
      const meta = htmlElementMetaSource.get(id);
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

  /* ---- localStorage stub(记录全部写入, 供"boot 不回写 autosave"断言) ---- */
  const defaultStorage = {
    _d: {}, _writes: 0, _setLog: [],
    getItem(k) {
      if (options.autosaveGetThrows && k === AUTOSAVE_KEY) throw new Error('Synthetic storage unavailable');
      return k in this._d ? this._d[k] : null;
    },
    setItem(k, v) { this._writes++; this._setLog.push([k, String(v)]); this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
  };
  Object.assign(defaultStorage._d, options.storageSeed !== undefined ? options.storageSeed : {
    previz_ui_theme: 'amber',
    previz_railc: '1',
    previz_rightc: '1',
    previz_timeline_state: 'full',
  });
  if (typeof options.autosaveRaw === 'string') defaultStorage._d[AUTOSAVE_KEY] = options.autosaveRaw;
  const storage = options.storage || defaultStorage;

  const sandbox = {
    console, document: documentStub,
    Math: testMath,
    Date: FrozenDate,
    __alerts: [],
    alert(m) { sandbox.__alerts.push(String(m)); },
    confirm: () => true, prompt: () => null,
    localStorage: storage,
    navigator: {},
    performance: { now: () => nowMs },
    requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
    setTimeout(fn, ms) { const item = { id: ++timeoutId, fn, ms, canceled: false }; timeouts.push(item); return item.id; },
    clearTimeout(id) { const item = timeouts.find(candidate => candidate.id === id); if (item) item.canceled = true; },
    setInterval(fn, ms) { const id = ++intervalId; intervals.set(id, { fn, ms }); return id; },
    clearInterval(id) { intervals.delete(id); },
    devicePixelRatio: 1,
    innerWidth: 1600, innerHeight: 900,
    __objectUrls: [],
    URL: { createObjectURL: blob => { sandbox.__objectUrls.push(blob);return `blob:fake-${sandbox.__objectUrls.length}`; }, revokeObjectURL: noop },
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
      set src(v) { this._s = v; this.width = 64; this.height = 32; this.complete = true; if (this.onload) this.onload(); }
      get src() { return this._s; }
    },
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(localeZhSrc, sandbox, { filename: 'i18n/locales/zh-CN.js' });
  vm.runInContext(localeEnSrc, sandbox, { filename: 'i18n/locales/en-US.js' });
  vm.runInContext(i18nRuntimeSrc, sandbox, { filename: 'i18n/runtime.js' });

  vm.runInContext(threeSrc, sandbox, { filename: 'three.min.js' });
  if (!sandbox.THREE?.Vector3) throw new Error('THREE 未定义或缺 Vector3');
  sandbox.THREE.WebGLRenderer = class {
    constructor() { this.shadowMap = {}; this.domElement = makeEl('canvas'); this.autoClear = true;this.viewport={x:0,y:0,z:300,w:300};this.scissor={x:0,y:0,z:300,w:300};this.scissorTest=false; }
    setSize() {}
    setPixelRatio() {}
    getViewport(target){return target.copy(this.viewport);}
    getScissor(target){return target.copy(this.scissor);}
    getScissorTest(){return this.scissorTest;}
    setViewport(x,y,width,height){this.viewport={x,y,z:width,w:height};}
    setScissor(x,y,width,height){this.scissor={x,y,z:width,w:height};}
    setScissorTest(value){this.scissorTest=!!value;}
    clear() {}
    render() {}
    clearDepth() {}
    dispose() {}
  };

  vm.runInContext(appSrc + hook, sandbox, { filename: 'app.js' });

  function frames(n, dt = 50) {
    for (let i = 0; i < n; i++) {
      nowMs += dt;
      const callbacks = rafQueue;
      rafQueue = [];
      callbacks.forEach(callback => callback(nowMs));
    }
  }
  function flushTimeouts() { while (timeouts.length) { const item = timeouts.shift(); if (!item.canceled) item.fn(); } }
  function tickIntervals(count = 1, dt = 100) {
    for (let step = 0; step < count; step++) {
      nowMs += dt;
      for (const item of Array.from(intervals.values())) item.fn();
    }
  }

  return {
    sandbox,
    T: sandbox.__T,
    el: id => documentStub.getElementById(id),
    storage,
    frames,
    flushTimeouts,
    tickIntervals,
    fireWindow,
    fireDocument,
  };
}

/* 便捷: 捕获 saveProjectFile 序列化输出(桥接 stub, 不落盘) */
export async function captureSave(T) {
  const calls = [];
  const ok = await T.saveProjectFile({ bridge: { saveProject: async (name, contents) => { calls.push({ name, contents }); return { canceled: false, path: '/qa/' + name }; } } });
  if (!ok || calls.length !== 1) throw new Error(`saveProjectFile 捕获失败: ok=${ok} calls=${calls.length}`);
  return calls[0];
}

/*
 * core/store.js — application store + PlaybackClock (subsystem D core globals, refactor P3)
 * + RefreshHub (UI refresh dispatch, refactor P4, ADR-0010).
 * Root of the dependency graph: every module may import this one; it imports no business
 * module. Owns the eight core globals (project/sceneIdx/shotIdx/actors/shots/selected/
 * time/playing) that previously lived as top-level `let` bindings in src/app.js, plus the
 * accessors curScene/curShot/sceneDur/shotStart and the `$` DOM shorthand (bodies moved
 * verbatim, ADR-0009).
 *
 * PlaybackClock (split plan §2.1): time/playing are backed by `clock` — five verbs
 * (seek/play/pause/tick + reads) plus lease(), the only sanctioned borrow-return shape,
 * and the withFrozen() sugar. The 11+12 legacy writers migrate to the verb API stage by
 * stage; until then the globalThis shim below keeps every bare `time`/`playing` (and other
 * core-global) read/write working unchanged.
 *
 * Transitional globalThis shim (removed in P9): accessor properties for the eight globals
 * are installed on globalThis at module top level. This MUST happen here, not in the build
 * bridge — the bridge's Object.assign can only create data properties, and the shim must
 * exist before the src/app.js remnant executes. The bridge block precedes the remnant
 * inside the same script, so module top-level side effects satisfy both constraints.
 * The former top-level `let` declarations were deleted from app.js (a script-level lexical
 * binding would shadow a globalThis accessor); removal list in ADR-0009.
 */

export const clock = {
  _t: 0, _playing: false,
  get time() { return this._t; },
  get playing() { return this._playing; },
  seek(t) { this._t = t; },                    /* scrub / shot jumps */
  play() { this._playing = true; },
  pause() { this._playing = false; },
  tick(dt) { if (this._playing) this._t += dt; },   /* only the rAF loop may call this */
  lease() {                                     /* the only sanctioned borrow-return shape */
    const snap = { t: this._t, playing: this._playing };
    let done = false;
    return { restore: () => { if (done) return; done = true;
      this._t = snap.t; this._playing = snap.playing; } };
  },
  withFrozen(t, fn) {                           /* sugar for sampleShotState-like scenes */
    const l = this.lease(); this._playing = false; this._t = t;
    try { return fn(); } finally { l.restore(); }
  },
};

/* Core store state — moved from src/app.js top-level `let` declarations, initializers
 * intact (time/playing initial values live in clock._t/clock._playing above). */
let project=null, sceneIdx=0, shotIdx=0;
let actors=[];   // runtime stage objects {obj,label,kind,pathPts:[V3]}
let shots=[];    // runtime shots {name,desc,dur,lock,fov,camPts:[V3]}
let selected=null;

/* Transitional globalThis shim: bare setters, no side effects — semantics identical to
 * the former script-level bindings (split plan §2.1). configurable so P9 can remove it. */
const defineGlobal = (name, get, set) =>
  Object.defineProperty(globalThis, name, { get, set, configurable: true });
defineGlobal('time',     () => clock._t,       v => { clock._t = v; });
defineGlobal('playing',  () => clock._playing, v => { clock._playing = v; });
defineGlobal('project',  () => project,        v => { project = v; });
defineGlobal('sceneIdx', () => sceneIdx,       v => { sceneIdx = v; });
defineGlobal('shotIdx',  () => shotIdx,        v => { shotIdx = v; });
defineGlobal('actors',   () => actors,         v => { actors = v; });
defineGlobal('shots',    () => shots,          v => { shots = v; });
defineGlobal('selected', () => selected,       v => { selected = v; });

/*
 * RefreshHub (split plan §2.3, refactor P4, ADR-0010): mark-dirty + ordered-flush
 * dispatch for the 22 UI refresh functions. Not a reactive framework — no subscriptions,
 * no diffing; handlers still declare what to refresh. The hub only owns the flush ORDER
 * (one canonical sequence instead of per-handler ad-hoc ordering) and dedupes repeats
 * within one flush. Refresh functions register once at app init (transitional home:
 * src/app.js; each registration moves out with its owning UI module in P5–P9), take no
 * arguments, and must not call refresh.invalidate themselves — their internal
 * cross-calls stay direct calls.
 *
 * Recorded deviation from the plan sketch (ADR-0010): invalidate() flushes
 * synchronously instead of coalescing via queueMicrotask — the smoke suite invokes
 * handlers and asserts DOM state synchronously, so deferred flushing is left to a later
 * stage. all() keeps the old syncAll() synchronous semantics either way.
 */
const REFRESH_TOPICS = [ /* fixed flush order: data lists -> panels -> viz -> prompt -> transport */
  'sceneRail','objList','shotPanel','camPt','aim','lock','transform','semantic',
  'actorPath','timing','joint','mount','sun','ground','bg','motionTimeline',
  'viz','prompt','scrub','playBtn','monitor','thumbs'
];
const refreshRegistry = new Map();   /* topic -> refresh fn, registered once at app init */
const refreshDirty = new Set();
const assertRefreshTopics = topics => topics.forEach(t => {
  /* Unknown topics would otherwise be silently dropped by the ordered flush — fail fast. */
  if (!REFRESH_TOPICS.includes(t)) throw new Error('RefreshHub: unknown topic "' + t + '"');
});
export const refresh = {
  register(topic, fn) { assertRefreshTopics([topic]); refreshRegistry.set(topic, fn); },
  invalidate(...topics) {
    assertRefreshTopics(topics);
    topics.forEach(t => refreshDirty.add(t));
    this.flush();
  },
  flush() { for (const t of REFRESH_TOPICS) if (refreshDirty.delete(t)) refreshRegistry.get(t)?.(); },
  all() { this.invalidate(...REFRESH_TOPICS); },   /* = old syncAll, synchronous */
};

function curScene(){ return project.scenes[sceneIdx]; }
function curShot(){ return shots[shotIdx]; }
function sceneDur(){ return shots.reduce((s,x)=>s+x.dur,0); }
function shotStart(i){ return shots.slice(0,i).reduce((s,x)=>s+x.dur,0); }
const $=id=>document.getElementById(id);

export { curScene, curShot, sceneDur, shotStart, $ };

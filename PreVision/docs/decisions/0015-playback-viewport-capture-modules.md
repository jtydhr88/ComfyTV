# ADR-0015: Playback, Viewport, and Capture Modules

- Status: Accepted
- Date: 2026-07-19
- Scope: refactor P8, behavior-preserving module extraction

## Context

PreVision is still delivered as a rebuilt single HTML file, but P0-P7b moved core, project, stage, environment, storyboard, and prompt ownership into source modules. P8 removes the next high-risk ownership clusters from `src/app.js` while preserving the bridge runtime, capture transaction semantics, and existing binary/project/prompt golden contracts.

The ordered implementation was K playback, then I/L viewport, then R/T capture. The order matters because capture depends on playback and viewport behavior at call time, while playback must not import capture.

## Decision

`src/playback/engine.js` owns playback loop and dual-viewport rendering:

- `updateShotCam`, `updateActors`, `resize`, `renderDirectorViewport`, `loop`, point preview clear/preview helpers.
- Live mutable state such as `pipRenderer`, `aspectW/aspectH`, camera drive mode, preview state, and render layout cache remains live through accessor shims.
- The loop uses existing clock verbs (`tick`, `seek`, `pause`) and keeps deterministic 30 Hz capture driving outside rAF.
- Shell resize (`RIGHTW_KEY`, `initRightResize`) remains in `src/app.js` for P9.

`src/viewport/interact.js` owns viewport fit/focus, camera visualization, picking, highlighting, camera-route dragging, selection, drag mode, ray/mouse/ground plane, and the canvas pointer bindings:

- Canvas handlers are real named functions: `onCanvasPointerDown`, `onCanvasPointerMove`, `onCanvasPointerUp`.
- `refresh.register('viz', rebuildViz)` moved with the viewport owner.
- Inspector refresh UI remains in `src/app.js`.

`src/export/capture.js` owns screenshots, workspace recording, deterministic capture transaction, MediaRecorder recording, single-shot and scene export, top record handling, Seedance packaging, `REC_FPS`, `dataURLtoU8`, and `makeZip`.

- Capture has no static imports. Browser-only collaborators are resolved at call time through the existing bridge, so Node can direct-import `{ makeZip }`.
- Seedance top-level binding is contained in `initSeedancePack()`, called by `initCaptureBindings()`.
- `dl`/persistence remains in `src/app.js`; `setExportLook` remains in `src/stage/environment.js`.
- Capture global function shims use explicit string names, not `fn.name`, because esbuild may rename functions when owner names overlap with app-level bridge names.

## Dependency Direction

- `playback/engine.js` must not import `export/capture.js`.
- `export/capture.js` must not import playback, viewport, prompt, stage, or DOM-dependent modules.
- Stage and core modules continue to use call-time bridge access where already required; P8 does not create a true import back from stage/core into capture.

## Function Census

P8 intentionally adds real named functions for new owner modules and the three canvas pointer handlers. Census growth is allowed only for ADR-0015 owner/init/helper names that are actual runtime functions. Existing baseline functions must remain present; hiding functions in comments or strings is not an acceptable substitute.

## Validation

- `npm run build` twice must be byte-stable.
- `C5_seedance_package.mjs` validates the real five-file Seedance package order, UTF-8 flag, store method, CRC32, nonempty entries, ASCII package name, and frozen prompt/JSON target.
- `C6_makezip_bytes.mjs` imports `makeZip` directly from `src/export/capture.js` and compares byte-for-byte with the existing binary golden.
- `P8_module_boundaries.mjs` guards capture direct-import safety, RefreshHub count 22 with unique viewport-owned `viz`, dependency direction, no new bare `time/playing` writes, named canvas handlers, key exports, and leave-behind lists.
- Existing smoke/module/full tests continue to cover playback, viewport, capture transaction, MediaRecorder, workspace capture, Seedance, and export failure recovery behavior.

## Consequences

The bridge remains transitional: modules still expose selected live state to `globalThis` until later owner cleanups. This keeps blast radius controlled and avoids changing product behavior while reducing `src/app.js` ownership pressure.

Node direct-import safety for capture constrains future changes: top-level capture code must stay free of eager `document`, `THREE`, renderer, or `MediaRecorder` side effects.

## Rollback

Rollback is the linear revert of the P8 commits plus regenerated `预见PreVision.html`. Re-run C1/C2/C3/C5/C6/P8, module tests for playback/viewport/capture, `test:app`, `test:i18n`, `test:foundation`, impact/full tests, and census after rollback.

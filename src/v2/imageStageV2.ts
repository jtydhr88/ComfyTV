
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { getActivePinia } from 'pinia'
import { createApp, effectScope, watch, type EffectScope } from 'vue'

import MainPromptInput from '@/components/stages/MainPromptInput.vue'
import { useStageNode } from '@/composables/stages/useStageNode'
import { i18n, t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import { V2_SHELLS } from '@/v2/registry'
import FooterSelectsV2 from '@/v2/FooterSelectsV2.vue'
import MediaCornerV2 from '@/v2/MediaCornerV2.vue'
import RefChipsV2 from '@/v2/RefChipsV2.vue'
import ServerSelectV2 from '@/v2/ServerSelectV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const REF_RE = /^(images\.image|texts\.text|videos\.video)\d+$/

const v2_CSS = `
@property --v2-p { syntax: '<number>'; initial-value: 0; inherits: false; }
@property --v2-a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

.lg-node[data-v2-shell].outline-node-stroke-executing,
.lg-node[data-v2-shell].te-man-concurrent-running-outline { outline: none !important; }

.lg-node[data-v2-shell] .lg-node-header { display: none; }
.lg-node[data-v2-shell] .lg-node-content { display: none; }
.lg-node[data-v2-shell] .mt-auto { display: none; }
.lg-node[data-v2-shell] { filter: none; }
.lg-node[data-v2-shell] [data-testid="node-state-outline-overlay"] { display: none; }
body[data-v2-toolbar] [data-testid="selection-toolbox"] { display: none; }
.lg-node[data-v2-shell] [data-testid="node-inner-wrapper"] {
  background: transparent;
  border-radius: 0;
  box-shadow: none;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] {
  padding: 0;
  gap: 0;
  background: transparent;
}

.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  pointer-events: none;
  z-index: 30;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div {
  position: absolute;
  top: var(--v2-socket-y, 150px);
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  pointer-events: auto;
  min-width: 22px;
  min-height: 22px;
  padding: 2px;
  border-radius: 999px;
  background: #1e1e21;
  border: 1.5px solid #7a7a82;
  box-shadow: 0 2px 8px rgba(0,0,0,.55);
  opacity: 0;
  transition: opacity .15s ease;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div > .lg-slot {
  grid-area: 1 / 1;
}
.lg-node[data-v2-shell]:hover [data-testid^="node-body-"] > div:first-child > div,
.lg-node[data-v2-shell][data-v2-selected] [data-testid^="node-body-"] > div:first-child > div {
  opacity: 1;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div:not(.ml-auto) { left: -11px; }
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto { right: -11px; left: auto; }
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div::after {
  content: '+';
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font: 400 15px/1 system-ui, sans-serif;
  color: #c9c9cf;
  pointer-events: none;
}
.lg-node[data-v2-shell] .lg-slot--input,
.lg-node[data-v2-shell] .lg-slot--output {
  height: 6px;
  padding: 0;
  margin: 0;
  opacity: 0;
  transition: height .12s ease;
}
.lg-node[data-v2-shell] .lg-slot span { display: none; }
.lg-node[data-v2-shell] .lg-slot [class*="translate-x"] { transform: none; }

.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  padding: 6px 6px;
  border-radius: 12px;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open > .lg-slot {
  grid-area: auto;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open::after {
  content: '';
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open .lg-slot--output {
  height: 16px;
  opacity: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 5px;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open .lg-slot--output span {
  display: inline-block;
  font: 500 10px/1 system-ui, sans-serif;
  color: #c9c9cf;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  white-space: nowrap;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div.ml-auto.v2-open [data-slot-key] {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  flex: none;
}
.lg-node[data-v2-shell] div.ml-auto.v2-open [data-slot-key$="-out-0"] { background: #60A5FA; box-shadow: 0 0 0 2px rgba(96,165,250,.35); }
.lg-node[data-v2-shell] div.ml-auto.v2-open [data-slot-key$="-out-1"] { background: #4ADE80; box-shadow: 0 0 0 2px rgba(74,222,128,.35); }

.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div:not(.ml-auto).v2-open {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 6px 3px;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div:not(.ml-auto).v2-open > .lg-slot {
  grid-area: auto;
}
.lg-node[data-v2-shell] [data-testid^="node-body-"] > div:first-child > div:not(.ml-auto).v2-open .lg-slot--input {
  height: 12px;
  opacity: 1;
}

.lg-node[data-v2-shell] [data-testid="node-widgets"] {
  display: flex;
  flex-direction: column;
  padding: 0;
  flex: 1;
  min-height: 0;
}
.lg-node[data-v2-shell] .lg-node-widget { display: flex; padding: 0; }
.lg-node[data-v2-shell] .lg-node-widget:has(.v2-card) { flex: 1; min-height: 0; }
.lg-node[data-v2-shell] .lg-node-widget > div:first-child { display: none; }
.lg-node[data-v2-shell] .lg-node-widget > *:last-child { flex: 1; min-width: 0; }
.lg-node[data-v2-shell] .lg-node-widget:not(:has(.v2-card)) { display: none; }

.v2-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  min-height: 0;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.v2-ring {
  position: absolute;
  inset: -6px;
  border-radius: 20px;
  padding: 3px;
  pointer-events: none;
  z-index: 60;
  opacity: 0;
  transition: opacity .3s ease, --v2-p .4s ease;
  background: conic-gradient(from 0turn,
    #60A5FA 0turn,
    #A78BFA calc(var(--v2-p) * .55turn),
    #F472B6 calc(var(--v2-p) * 1turn),
    transparent calc(var(--v2-p) * 1turn + .002turn));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
  filter: drop-shadow(0 0 7px rgba(167,139,250,.55));
}
.v2-ring[data-on="1"] { opacity: 1; }
.v2-ring[data-indeterminate="1"] {
  background: conic-gradient(from var(--v2-a),
    transparent 0turn, #60A5FA .07turn, #A78BFA .14turn, transparent .22turn);
  animation: v2ringsweep 1.2s linear infinite;
}
@keyframes v2ringsweep { to { --v2-a: 360deg; } }
.v2-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font: 500 12px/1 system-ui, sans-serif;
  color: #9a9aa2;
  user-select: none;
}
.v2-label svg { width: 13px; height: 13px; opacity: .8; }
.v2-handle {
  height: 26px;
  flex: none;
  width: 100%;
  padding: 0 6px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: grab;
  box-sizing: border-box;
}
.v2-handle:hover { background: rgba(255,255,255,.06); }
.v2-handle:active { cursor: grabbing; }
.v2-handle .v2-grip { width: 12px; height: 12px; opacity: .55; flex: none; }
.v2-handle span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.v2-handle span[contenteditable] {
  outline: 1px solid rgba(167,139,250,.6);
  border-radius: 4px;
  padding: 1px 5px;
  cursor: text;
  color: #ececf1;
  min-width: 60px;
}

.v2-toolbar {
  position: absolute;
  top: -50px;
  left: 50%;
  transform: translateX(-50%);
  display: none;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.06);
  box-shadow: 0 10px 30px rgba(0,0,0,.5);
  white-space: nowrap;
  z-index: 40;
}
.lg-node[data-v2-shell][data-v2-selected] .v2-toolbar { display: flex; }
.v2-toolbar__btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border-radius: 9px;
  color: #d9d9de;
  font: 500 12px/1 system-ui, sans-serif;
  cursor: pointer;
  user-select: none;
}
.v2-toolbar__btn:hover { background: rgba(255,255,255,.08); }
.v2-toolbar__btn svg { width: 14px; height: 14px; opacity: .9; }
.v2-toolbar__sep {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: rgba(255,255,255,.12);
  flex: none;
}
.v2-toolbar__btn--icononly { padding: 6px 7px; }
.v2-toolbar__btn--icononly svg { width: 15px; height: 15px; }

.v2-preview {
  position: relative;
  flex: 1 1 auto;
  min-height: 170px;
  border-radius: 12px;
  overflow: visible;
  cursor: grab;
}
.v2-preview::before,
.v2-preview::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  background: #2a2a2f;
  border: 1px solid rgba(255,255,255,.07);
  z-index: -1;
}
.v2-preview::before { transform: translate(7px, 4px) rotate(1.6deg); opacity: .8; }
.v2-preview::after  { transform: translate(13px, 9px) rotate(3deg); opacity: .45; }
.v2-preview__media {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-preview__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: none;
}
.v2-preview__img[data-live="1"] { display: block; }
.v2-preview__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #6b6b74;
  font: 500 12px/1.5 system-ui, sans-serif;
}
.v2-preview__hint svg { width: 26px; height: 26px; opacity: .55; }
.v2-preview__img[data-live="1"] ~ .v2-preview__hint { display: none; }
.v2-preview__busy {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(16,16,20,.45);
  backdrop-filter: blur(2px);
  border-radius: 12px;
}
.v2-preview__busy[data-show="1"] { display: flex; }
.v2-preview__busytext {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: #e2e2e8;
  font: 600 13px/1 system-ui, sans-serif;
  text-shadow: 0 1px 4px rgba(0,0,0,.6);
}
.v2-preview__busytext small {
  color: #a9a9b2;
  font: 500 10px/1.3 system-ui, sans-serif;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v2-preview__spinner {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 3px solid rgba(255,255,255,.25);
  border-top-color: #fff;
  animation: v2spin .8s linear infinite;
}
@keyframes v2spin { to { transform: rotate(360deg); } }
.v2-chip {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 2;
  display: none;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(20,20,24,.72);
  backdrop-filter: blur(4px);
  color: #e6e6ea;
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-chip[data-show="1"] { display: flex; }
.v2-chip[data-multi="1"] { cursor: pointer; }
.v2-chip[data-multi="1"]:hover { background: rgba(35,35,42,.9); }

.v2-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 2;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 999px;
  background: rgba(20,20,24,.66);
  backdrop-filter: blur(4px);
  color: #ececf1;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity .15s ease;
}
.v2-nav svg { width: 13px; height: 13px; }
.v2-nav--prev { left: 8px; }
.v2-nav--next { right: 8px; }
.v2-preview[data-multi="1"] .v2-nav { display: flex; }
.v2-preview[data-multi="1"]:hover .v2-nav { opacity: 1; }
@media (hover: none) {
  .v2-preview[data-multi="1"] .v2-nav { opacity: 1; }
}
.v2-nav:hover { background: rgba(20,20,24,.9); }

.v2-corner-host {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
  opacity: 0;
  transition: opacity .15s ease;
  pointer-events: none;
}
.v2-preview:hover .v2-corner-host { opacity: 1; pointer-events: auto; }
@media (hover: none) {
  .v2-corner-host { opacity: 1; pointer-events: auto; }
}

.v2-strip {
  position: absolute;
  top: 34px;
  right: 8px;
  z-index: 5;
  display: none;
  gap: 6px;
  padding: 8px;
  border-radius: 12px;
  background: rgba(24,24,30,.92);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 10px 28px rgba(0,0,0,.5);
  max-width: 262px;
  flex-wrap: wrap;
}
.v2-strip[data-open="1"] { display: flex; }
.v2-strip__cell {
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 9px;
  overflow: hidden;
  cursor: pointer;
  background: #2a2a2f;
}
.v2-strip__cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.v2-strip__cell[data-current="1"] { border-color: #60A5FA; }
.v2-strip__cell:hover { border-color: rgba(255,255,255,.4); }
.v2-strip__cell[data-current="1"]:hover { border-color: #60A5FA; }

.v2-panel {
  flex: none;
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: #232327;
  border: 1px solid rgba(255,255,255,.05);
  box-shadow: 0 8px 24px rgba(0,0,0,.4);
}
.v2-panel__chips { display: flex; gap: 8px; }
.v2-panel__chipbtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 10px 5px;
  border-radius: 10px;
  background: #2c2c31;
  border: 1px solid rgba(255,255,255,.05);
  color: #b9b9c0;
  font: 500 10px/1 system-ui, sans-serif;
  cursor: pointer;
}
.v2-panel__chipbtn svg { width: 15px; height: 15px; }
.v2-panel__prompt {
  width: 100%;
  min-height: 54px;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  color: #ececf1;
  font: 400 13px/1.6 system-ui, sans-serif;
  caret-color: #fff;
}
.v2-panel__prompt::placeholder { color: #5d5d66; }
.v2-panel__prompthost { margin: 0 -6px; }
.v2-panel__selects { flex: 1; min-width: 0; display: flex; }
.v2-panel__prompthost .comfytv-prompt-editor { min-height: 54px; font-size: 13px; }
.v2-panel__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #b9b9c0;
  font: 500 12px/1 system-ui, sans-serif;
}
.v2-select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  outline: none;
  background: transparent;
  color: #b9b9c0;
  font: 500 12px/1 system-ui, sans-serif;
  cursor: pointer;
  max-width: 118px;
  text-overflow: ellipsis;
  padding-right: 12px;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23808088' stroke-width='1.4'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0 center;
  background-size: 8px;
}
.v2-select option { background: #232327; color: #ececf1; }
.v2-panel__opt {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.v2-panel__opt svg { width: 14px; height: 14px; opacity: .85; flex: none; }
.v2-panel__spacer { flex: 1; }
.v2-panel__server { flex: none; display: flex; min-width: 0; max-width: 160px; }
.v2-panel__count { color: #8f8f98; font-size: 11px; white-space: nowrap; }
.v2-run {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  background: #f4f4f6;
  color: #111;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: transform .12s ease, background .12s ease;
}
.v2-run:hover { background: #fff; transform: scale(1.06); }
.v2-run:active { transform: scale(.95); }
.v2-run svg { width: 15px; height: 15px; }
.v2-run__up, .v2-run__stop {
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-run .v2-run__stop { display: none; }
.v2-run[data-busy="1"] { background: #ef4444; color: #fff; }
.v2-run[data-busy="1"]:hover { background: #f87171; }
.v2-run[data-busy="1"] .v2-run__up { display: none; }
.v2-run[data-busy="1"] .v2-run__stop { display: flex; }
`

const I = (d: string, sw = 1.7) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}">${d}</svg>`
const ICON_IMAGE = I(`<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5.2-5.2 3.4 3.4 3.2-3.2L21 18"/>`, 1.8)
const ICON_HD = I(`<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M7 9v6M7 12h3.4M10.4 9v6M14 9v6h1.8a3 3 0 000-6z"/>`)
const ICON_EXPAND = I(`<path d="M9 4H5.5A1.5 1.5 0 004 5.5V9M15 4h3.5A1.5 1.5 0 0120 5.5V9M9 20H5.5A1.5 1.5 0 014 18.5V15M15 20h3.5a1.5 1.5 0 001.5-1.5V15"/><rect x="9" y="9" width="6" height="6" rx="1"/>`)
const ICON_ANGLES = I(`<path d="M12 3a9 9 0 109 9"/><path d="M21 3l-4.5.5L21 8z" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3.4"/>`)
const ICON_LIGHT = I(`<path d="M12 2.5v3M4.9 4.9l2.1 2.1M2.5 12h3M19.1 4.9L17 7M21.5 12h-3"/><path d="M8.5 18a4.8 4.8 0 117 0v1.6a1 1 0 01-1 1h-5a1 1 0 01-1-1z"/>`)
const ICON_REDRAW = I(`<path d="M4 20h4.5L20 8.5a2.1 2.1 0 00-3-3L5.5 17z"/><path d="M13.5 6.5l3 3"/>`)
const ICON_ERASE = I(`<path d="M7.5 20l-4-4a1.5 1.5 0 010-2.1l8.6-8.6a1.5 1.5 0 012.1 0l5.3 5.3a1.5 1.5 0 010 2.1L12.4 20z"/><path d="M7.5 20H20M6.2 10.6l7.2 7.2"/>`)
const ICON_CUTOUT = I(`<circle cx="6.5" cy="6.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/><path d="M8.6 8.3L20 19M8.6 15.7L20 5M13.3 12.1l2.2 2"/>`)
const ICON_GRID = I(`<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>`)
const ICON_PANORAMA = I(`<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a13.5 13.5 0 000 18M12 3a13.5 13.5 0 010 18"/>`)
const ICON_CROP = I(`<path d="M6 2.5V16a2 2 0 002 2h13.5M2.5 6H16a2 2 0 012 2v13.5"/>`)
const ICON_DOWNLOAD = I(`<path d="M12 3.5V15M7 10.5l5 5 5-5M4 19.5h16"/>`)
export const ICON_STOP = `<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>`
export const RUN_BUTTON_HTML = `<span class="v2-run__up">${I(`<path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/>`, 2.4)}</span><span class="v2-run__stop">${ICON_STOP}</span>`

let cssInstalled = false
export function installV2ShellCss() {
  installCss()
}

export const ICON_GRIP = `<svg class="v2-grip" viewBox="0 0 24 24" fill="currentColor"><circle cx="8" cy="5" r="1.7"/><circle cx="16" cy="5" r="1.7"/><circle cx="8" cy="12" r="1.7"/><circle cx="16" cy="12" r="1.7"/><circle cx="8" cy="19" r="1.7"/><circle cx="16" cy="19" r="1.7"/></svg>`

export function createNodeScope(node: ComfyNode): EffectScope {
  const scope = effectScope(true)
  const anyNode = node as any
  const prev = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    scope.stop()
    prev?.apply(this, args)
  }
  return scope
}

const nudgeScope = effectScope(true)
let nudgeFlip = false
let nudgeRoot: HTMLElement | null = null
const nudgeTimer = nudgeScope.run(() => useTimeoutFn(() => {
  const root = nudgeRoot
  nudgeRoot = null
  const id = root?.getAttribute('data-node-id')
  if (id == null) return
  const graph: any = (app as any).graph
  const n = graph?.getNodeById?.(id) ?? graph?.getNodeById?.(Number(id))
  if (!n?.setSize) return
  nudgeFlip = !nudgeFlip
  n.setSize([n.size[0], n.size[1] + (nudgeFlip ? 0.01 : -0.01)])
}, 60, { immediate: false }))!
function nudgeSlotAnchors(root: HTMLElement) {
  nudgeRoot = root
  nudgeTimer.start()
}

export function bindClusterHoverIntent(root: HTMLElement, scope: EffectScope) {
  const clusters = root.querySelectorAll<HTMLElement>(
    '[data-testid^="node-body-"] > div:first-child > div',
  )
  for (const c of clusters) {
    if (c.dataset.v2Hover) continue
    c.dataset.v2Hover = '1'
    const leave = scope.run(() => useTimeoutFn(() => {
      c.classList.remove('v2-open')
      nudgeSlotAnchors(root)
    }, 220, { immediate: false }))
    if (!leave) continue
    c.addEventListener('pointerenter', () => {
      leave.stop()
      if (!c.classList.contains('v2-open')) {
        c.classList.add('v2-open')
        nudgeSlotAnchors(root)
      }
    })
    c.addEventListener('pointerleave', () => {
      leave.stop()
      leave.start()
    })
  }
}

export function bindShellChrome(node: ComfyNode, opts: {
  scope: EffectScope
  card: HTMLElement
  socketAnchor: HTMLElement
  socketY?: 'center' | { frac: number; cap: number }
}) {
  const anyNode = node as any
  const { scope, card, socketAnchor } = opts
  const socketY = opts.socketY ?? 'center'

  const titleEl = card.querySelector<HTMLElement>('.v2-handle span')
  const typeLabel = titleEl?.textContent ?? ''
  const defaultTitle = String((node.constructor as any)?.title ?? '')
  const customTitle = () => {
    const raw = String(anyNode.title ?? '').trim()
    return raw && raw !== defaultTitle ? raw : ''
  }
  const syncTitle = () => {
    if (!titleEl || titleEl.isContentEditable) return
    const want = customTitle() || typeLabel
    if (titleEl.textContent !== want) titleEl.textContent = want
  }
  if (titleEl) {
    titleEl.title = t('v2.renameHint')
    titleEl.addEventListener('pointerdown', (e) => {
      if (titleEl.isContentEditable) e.stopPropagation()
    })
    titleEl.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      titleEl.contentEditable = 'plaintext-only'
      titleEl.textContent = customTitle()
      titleEl.focus()
      const range = document.createRange()
      range.selectNodeContents(titleEl)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    const commit = (cancel: boolean) => {
      if (!titleEl.isContentEditable) return
      const text = (titleEl.textContent ?? '').trim()
      titleEl.contentEditable = 'false'
      if (!cancel) anyNode.title = text || defaultTitle
      syncTitle()
    }
    titleEl.addEventListener('keydown', (e) => {
      if (!titleEl.isContentEditable) return
      e.stopPropagation()
      if (e.key === 'Enter') { e.preventDefault(); commit(false) }
      else if (e.key === 'Escape') { e.preventDefault(); commit(true) }
    })
    titleEl.addEventListener('blur', () => commit(false))
    syncTitle()
  }

  const syncSelected = () => {
    const root = card.closest('[data-node-id]') as HTMLElement | null
    if (!root) return
    root.toggleAttribute('data-v2-selected', !!anyNode.selected)
    queueMicrotask(() => {
      document.body.toggleAttribute(
        'data-v2-toolbar',
        !!document.querySelector('.lg-node[data-v2-selected]'),
      )
    })
  }
  const prevSel = anyNode.onSelected
  anyNode.onSelected = function (...args: unknown[]) {
    prevSel?.apply(this, args)
    syncSelected()
  }
  const prevDesel = anyNode.onDeselected
  anyNode.onDeselected = function (...args: unknown[]) {
    prevDesel?.apply(this, args)
    syncSelected()
  }

  scope.run(() => {
    useIntervalFn(() => {
      if (!card.isConnected) return
      const root = card.closest('[data-node-id]') as HTMLElement | null
      if (!root) return
      if (!root.hasAttribute('data-v2-shell')) root.setAttribute('data-v2-shell', '')
      syncSelected()
      syncTitle()
      bindClusterHoverIntent(root, scope)
      const rootBox = root.getBoundingClientRect()
      const box = socketAnchor.getBoundingClientRect()
      if (rootBox.height > 0 && box.height > 0) {
        const scale = rootBox.height / (root.offsetHeight || rootBox.height)
        const mid = socketY === 'center'
          ? box.height / 2
          : Math.min(box.height * socketY.frac, socketY.cap)
        const y = (box.top + mid - rootBox.top) / (scale || 1)
        root.style.setProperty('--v2-socket-y', `${Math.round(y)}px`)
      }
    }, 500)
  })
}

export function bindNodeDrag(node: ComfyNode, surface: HTMLElement) {
  let drag: { x: number; y: number; moved: boolean } | null = null
  surface.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    try {
      surface.setPointerCapture(e.pointerId)
    } catch { }
    drag = { x: e.clientX, y: e.clientY, moved: false }
  })
  surface.addEventListener('pointermove', (e) => {
    if (!drag || !(e.buttons & 1)) return
    e.stopPropagation()
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    if (!drag.moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return
    drag.moved = true
    drag.x = e.clientX
    drag.y = e.clientY
    const scale = (app as any).canvas?.ds?.scale || 1
    node.pos = [node.pos[0] + dx / scale, node.pos[1] + dy / scale]
    ;(app as any).graph?.setDirtyCanvas(true, true)
  })
  const endDrag = (e: PointerEvent) => {
    if (!drag) return
    e.stopPropagation()
    try {
      if (surface.hasPointerCapture(e.pointerId)) surface.releasePointerCapture(e.pointerId)
    } catch { }
    const wasClick = !drag.moved
    drag = null
    if (wasClick) (app as any).canvas?.selectNode(node)
  }
  surface.addEventListener('pointerup', endDrag)
  surface.addEventListener('pointercancel', endDrag)
}
function installCss() {
  if (cssInstalled) return
  cssInstalled = true
  const style = document.createElement('style')
  style.textContent = v2_CSS
  document.head.appendChild(style)
}

export function bindProgressRing(
  card: HTMLElement,
  state: { running?: boolean; progress?: { value: number; max: number; text?: string } | null },
) {
  const ring = document.createElement('div')
  ring.className = 'v2-ring'
  card.appendChild(ring)
  watch(
    () => [state.running, state.progress?.value, state.progress?.max] as const,
    ([running, v, m]) => {
      const value = Number(v) || 0
      const max = Number(m) || 0
      const p = running && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
      ring.style.setProperty('--v2-p', p.toFixed(4))
      ring.dataset.on = running ? '1' : ''
      ring.dataset.indeterminate = running && p <= 0 ? '1' : ''
    },
    { immediate: true },
  )
  return ring
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

function buildToolbar(dispatch: (actionId: string) => void) {
  const bar = el('div', 'v2-toolbar')
  const items: Array<[string, string, string] | null> = [
    [ICON_HD, t('v2.toolbar.hd'), 'edit:hd'],
    [ICON_EXPAND, t('v2.toolbar.expand'), 'edit:outpaint'],
    [ICON_ANGLES, t('v2.toolbar.angles'), 'multiangle'],
    [ICON_LIGHT, t('v2.toolbar.relight'), 'relight'],
    [ICON_REDRAW, t('v2.toolbar.redraw'), 'edit:inpaint'],
    [ICON_ERASE, t('v2.toolbar.erase'), 'edit:erase'],
    [ICON_CUTOUT, t('v2.toolbar.cutout'), 'edit:cutout'],
    null,
    [ICON_GRID, '', 'edit:grid'],
    [ICON_PANORAMA, '', 'panorama'],
    [ICON_CROP, '', 'edit:crop'],
    [ICON_DOWNLOAD, '', 'download'],
  ]
  const titleKeyOf: Record<string, string> = {
    'edit:grid': 'v2.toolbar.grid',
    'panorama': 'v2.toolbar.panorama',
    'edit:crop': 'v2.toolbar.crop',
    'download': 'v2.toolbar.download',
  }
  for (const item of items) {
    if (!item) {
      bar.appendChild(el('div', 'v2-toolbar__sep'))
      continue
    }
    const [icon, text, actionId] = item
    const btn = el('div', text ? 'v2-toolbar__btn' : 'v2-toolbar__btn v2-toolbar__btn--icononly',
      text ? `${icon}<span>${text}</span>` : icon)
    if (!text && titleKeyOf[actionId]) btn.title = t(titleKeyOf[actionId])
    btn.addEventListener('pointerdown', (e) => e.stopPropagation())
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      dispatch(actionId)
    })
    bar.appendChild(btn)
  }
  return bar
}

function refCount(node: ComfyNode): number {
  return (node.inputs ?? []).filter(
    (i: any) => typeof i?.name === 'string' && REF_RE.test(i.name) && i.link != null,
  ).length
}

function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
  installCss()
  const anyNode = node as any

  const card = el('div', 'v2-card')
  card.appendChild(buildToolbar((actionId) => {
    if (actionId === 'download') {
      const url = batchList[pickedIdx - 1]?.url
      if (!url) return
      const a = document.createElement('a')
      a.href = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      a.download = url.split('filename=')[1]?.split('&')[0] || 'image.png'
      a.click()
      return
    }
    onAction(actionId)
  }))
  const handle = el('div', 'v2-label v2-handle', `${ICON_GRIP}${ICON_IMAGE}<span>${t('v2.imageStageTitle')}</span>`)
  card.appendChild(handle)
  bindNodeDrag(node, handle)

  const preview = el('div', 'v2-preview')
  const media = el('div', 'v2-preview__media')
  const img = el('img', 'v2-preview__img') as HTMLImageElement
  const hint = el('div', 'v2-preview__hint', `${ICON_IMAGE}<span>${t('v2.stageHint')}</span>`)
  media.append(img, hint)
  const busy = el('div', 'v2-preview__busy',
    `<div class="v2-preview__spinner"></div><div class="v2-preview__busytext"><span></span><small></small></div>`)
  const chip = el('div', 'v2-chip', `<span>↗</span><span class="v2-chip__n"></span>`)
  const navPrev = el('button', 'v2-nav v2-nav--prev',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M15 5l-7 7 7 7"/></svg>`) as HTMLButtonElement
  const navNext = el('button', 'v2-nav v2-nav--next',
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 5l7 7-7 7"/></svg>`) as HTMLButtonElement
  const strip = el('div', 'v2-strip')
  const cornerAnchor = el('div', 'v2-corner-host')
  preview.append(media, busy, chip, navPrev, navNext, strip, cornerAnchor)

  const panel = el('div', 'v2-panel')
  const refsAnchor = el('div', 'v2-panel__refs')
  const promptAnchor = el('div', 'v2-panel__prompthost')
  const footer = el('div', 'v2-panel__footer')
  const selectsAnchor = el('div', 'v2-panel__selects')
  const serverAnchor = el('div', 'v2-panel__server')
  const count = el('div', 'v2-panel__count', t('v2.refsCount', { n: 0 }))
  const run = el('button', 'v2-run', RUN_BUTTON_HTML) as HTMLButtonElement
  footer.append(selectsAnchor, serverAnchor, count, run)
  panel.append(refsAnchor, promptAnchor, footer)
  card.append(preview, panel)

  const stageApi = useStageNode(node as any, kind, variant)
  const { state: stageState, onRunRequest, onCancelRequest, onAction } = stageApi
  const scope = createNodeScope(node)

  const pinia = getActivePinia()
  let mountedApps: Array<ReturnType<typeof createApp>> = []
  const mountApps = () => {
    for (const a of mountedApps) a.unmount()
    mountedApps = []
    const specs: Array<[unknown, Record<string, unknown>, HTMLElement]> = [
      [RefChipsV2, { getNode: () => node }, refsAnchor],
      [MainPromptInput, { node }, promptAnchor],
      [FooterSelectsV2, { getNode: () => node }, selectsAnchor],
      [ServerSelectV2, { getNode: () => node, state: stageState }, serverAnchor],
      [MediaCornerV2, { state: stageState, source: 'batch', onAction }, cornerAnchor],
    ]
    for (const [comp, props, anchor] of specs) {
      const a = createApp(comp as any, props)
      if (pinia) a.use(pinia)
      a.use(i18n)
      a.mount(anchor)
      mountedApps.push(a)
    }
  }
  mountApps()

  const prevConfigure = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConfigure?.apply(this, args)
    queueMicrotask(mountApps)
  }

  node.addDOMWidget('v2_shell', 'v2', card, {
    getMinHeight: () => 470,
    hideOnZoom: false,
    serialize: false,
  })

  const [w0, h0] = node.size
  node.setSize([Math.max(w0, 340), Math.max(h0, 500)])

  const LGGlobal = (window as any).LiteGraph
  const isValid = (a: unknown, b: unknown) => !!LGGlobal?.isValidConnection?.(a, b)
  const prevCanConnectTo = anyNode.canConnectTo
  anyNode.canConnectTo = function (target: any, toSlot: any, fromSlot: any) {
    if (prevCanConnectTo?.call(this, target, toSlot, fromSlot)) return true
    if (!target || this.id === target.id) return false
    return (this.outputs ?? []).some((o: any) => isValid(o.type, toSlot?.type))
  }
  const prevConnectSlots = anyNode.connectSlots
  anyNode.connectSlots = function (fromSlot: any, targetNode: any, input: any, afterReroute: any) {
    let slot = fromSlot
    if (input && !isValid(fromSlot?.type, input.type)) {
      const alt = (this.outputs ?? []).find((o: any) => isValid(o.type, input.type))
      if (alt) slot = alt
    }
    return prevConnectSlots.call(this, slot, targetNode, input, afterReroute)
  }

  const refreshCount = () => {
    count.textContent = t('v2.refsCount', { n: refCount(node) })
  }
  refreshCount()

  const prevConn = anyNode.onConnectionsChange
  anyNode.onConnectionsChange = function (...args: unknown[]) {
    prevConn?.apply(this, args)
    refreshCount()
  }

  let batchList: Array<{ index: string; url: string }> = []
  let pickedIdx = 1

  const renderStrip = () => {
    strip.replaceChildren()
    for (let i = 0; i < batchList.length; i++) {
      const cell = el('button', 'v2-strip__cell') as HTMLButtonElement
      if (i + 1 === pickedIdx) cell.dataset.current = '1'
      const im = document.createElement('img')
      im.src = (app as any).api.apiURL(batchList[i].url.replace(/^\/api/, ''))
      im.loading = 'lazy'
      cell.appendChild(im)
      cell.addEventListener('pointerdown', (e) => e.stopPropagation())
      cell.addEventListener('click', (e) => {
        e.stopPropagation()
        applyPick(i + 1)
        strip.dataset.open = ''
      })
      strip.appendChild(cell)
    }
  }

  const refreshBatchUi = () => {
    const n = batchList.length
    const label = chip.querySelector('.v2-chip__n')
    if (label) {
      label.textContent = n > 1
        ? t('v2.batchPos', { i: pickedIdx, n })
        : t('v2.batchCount', { n: Math.max(n, 1) })
    }
    chip.dataset.multi = n > 1 ? '1' : ''
    preview.dataset.multi = n > 1 ? '1' : ''
    renderStrip()
  }

  const applyPick = (idx: number) => {
    if (batchList.length === 0) return
    onAction('pick-item', { index: Math.min(Math.max(idx, 1), batchList.length) })
  }

  const projectBatch = () => {
    const raw = String(stageState.output ?? '')
    let batch: any = null
    try {
      batch = JSON.parse(raw)
    } catch { }
    const images: any[] = Array.isArray(batch?.images) ? batch.images : []
    batchList = images
      .map((im) => ({ index: String(im?.index ?? ''), url: String(im?.image_url ?? '') }))
      .filter((c) => c.url)
    if (batchList.length === 0 && raw && !raw.trim().startsWith('{')) {
      batchList = [{ index: '1', url: raw }]
    }
    const sIdx = Number(stageState.pickedIndex)
    pickedIdx = Math.min(
      Math.max(Number.isFinite(sIdx) && sIdx >= 1 ? sIdx : 1, 1),
      Math.max(batchList.length, 1),
    )
    const url = batchList[pickedIdx - 1]?.url
    if (url) {
      img.src = (app as any).api.apiURL(url.replace(/^\/api/, ''))
      img.dataset.live = '1'
      chip.dataset.show = '1'
    } else {
      img.dataset.live = ''
      img.removeAttribute('src')
      chip.dataset.show = ''
    }
    refreshBatchUi()
  }
  const busyPct = busy.querySelector('.v2-preview__busytext span') as HTMLElement
  const busyLabel = busy.querySelector('.v2-preview__busytext small') as HTMLElement
  scope.run(() => {
    watch(() => [stageState.output, stageState.pickedIndex], projectBatch, { immediate: true })
    bindProgressRing(card, stageState)
    watch(
      () => [stageState.running, stageState.progress?.value, stageState.progress?.max, stageState.progress?.text] as const,
      ([running, v, m, text]) => {
        run.dataset.busy = running ? '1' : ''
        busy.dataset.show = running ? '1' : ''
        const max = Number(m) || 0
        const p = running && max > 0 ? Math.min(1, Math.max(0, (Number(v) || 0) / max)) : 0
        busyPct.textContent = p > 0 ? `${Math.round(p * 100)}%` : ''
        busyLabel.textContent = running && text ? String(text) : ''
      },
      { immediate: true },
    )
  })

  navPrev.addEventListener('pointerdown', (e) => e.stopPropagation())
  navNext.addEventListener('pointerdown', (e) => e.stopPropagation())
  navPrev.addEventListener('click', (e) => {
    e.stopPropagation()
    applyPick(pickedIdx <= 1 ? batchList.length : pickedIdx - 1)
  })
  navNext.addEventListener('click', (e) => {
    e.stopPropagation()
    applyPick(pickedIdx >= batchList.length ? 1 : pickedIdx + 1)
  })
  chip.addEventListener('pointerdown', (e) => e.stopPropagation())
  chip.addEventListener('click', (e) => {
    if (batchList.length < 2) return
    e.stopPropagation()
    strip.dataset.open = strip.dataset.open === '1' ? '' : '1'
  })

  run.addEventListener('pointerdown', (e) => e.stopPropagation())
  run.addEventListener('click', (ev) => {
    ev.stopPropagation()
    if (stageState.running) void onCancelRequest()
    else void onRunRequest()
  })

  bindNodeDrag(node, preview)

  bindShellChrome(node, { scope, card, socketAnchor: preview })

  const prevRemoved = anyNode.onRemoved
  anyNode.onRemoved = function (...args: unknown[]) {
    document.body.removeAttribute('data-v2-toolbar')
    for (const a of mountedApps) a.unmount()
    mountedApps = []
    prevRemoved?.apply(this, args)
  }

  return stageApi
}

V2_SHELLS['ComfyTV.ImageStage'] = attach

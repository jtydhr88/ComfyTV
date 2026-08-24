import { V2_CSS_PANELS } from '@/v2/shellCssPanels'

const V2_CSS_CHROME = `
.lg-node[data-v2-shell],
.v2-lact__backdrop {
  --v2-slab-bg: #232327;
  --v2-slab-border: rgba(255,255,255,.05);
  --v2-slab-shadow: 0 3px 10px rgba(0,0,0,.38);
  --v2-media-bg: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
  --v2-media-border: rgba(255,255,255,.07);
  --v2-checker: #1d1d22 repeating-conic-gradient(#25252b 0% 25%, #1d1d22 0% 50%);
  --v2-text-strong: #ececf1;
  --v2-text-mid: #b9b9c0;
  --v2-text-muted: #8f8f98;
  --v2-text-faint: #6b6b74;
  --v2-chip-bg: rgba(255,255,255,.05);
  --v2-chip-border: rgba(255,255,255,.09);
  --v2-hover-bg: rgba(255,255,255,.08);
  --v2-card-bg: #1e1e23;
  --v2-card-border: rgba(255,255,255,.06);
  --v2-socket-bg: #1e1e21;
  --v2-socket-border: #7a7a82;
  --v2-accent: #A78BFA;
  --v2-accent-soft: rgba(167,139,250,.16);
  --v2-accent-border: rgba(167,139,250,.55);
  --v2-accent-text: #cdbdfc;
  --v2-run-bg: #ececf1;
  --v2-run-fg: #17171b;
  --v2-run-hover: #ffffff;
  --v2-scrollbar: rgba(255,255,255,.18);
}
html:not(.dark-theme) .lg-node[data-v2-shell],
html:not(.dark-theme) .v2-lact__backdrop {
  --v2-slab-bg: #ffffff;
  --v2-slab-border: rgba(0,0,0,.08);
  --v2-slab-shadow: 0 3px 10px rgba(0,0,0,.10);
  --v2-media-bg: linear-gradient(160deg, #ececef 0%, #e2e2e6 100%);
  --v2-media-border: rgba(0,0,0,.09);
  --v2-checker: #eeeef1 repeating-conic-gradient(#e3e3e8 0% 25%, #eeeef1 0% 50%);
  --v2-text-strong: #202024;
  --v2-text-mid: #3c3c42;
  --v2-text-muted: #6b6b74;
  --v2-text-faint: #9a9aa2;
  --v2-chip-bg: rgba(0,0,0,.04);
  --v2-chip-border: rgba(0,0,0,.10);
  --v2-hover-bg: rgba(0,0,0,.06);
  --v2-card-bg: #f7f7f9;
  --v2-card-border: rgba(0,0,0,.08);
  --v2-socket-bg: #ffffff;
  --v2-socket-border: #9a9aa2;
  --v2-accent: #7C5CE6;
  --v2-accent-soft: rgba(124,92,230,.14);
  --v2-accent-border: rgba(124,92,230,.55);
  --v2-accent-text: #5b3fc4;
  --v2-run-bg: #ffffff;
  --v2-run-fg: #202024;
  --v2-run-hover: #f2f2f5;
  --v2-run-border: rgba(0,0,0,.14);
  --v2-scrollbar: rgba(0,0,0,.25);
}

@property --v2-p { syntax: '<number>'; initial-value: 0; inherits: false; }
@property --v2-a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

.lg-node[data-v2-shell].outline-node-stroke-executing,
.lg-node[data-v2-shell].te-man-concurrent-running-outline { outline: none !important; }

.lg-node[data-v2-shell] {
  --primary-background: rgba(167, 139, 250, 0.8);
  --primary-background-hover: rgba(167, 139, 250, 0.95);
  --accent-background: #A78BFA;
  --secondary-background-selected: rgba(167, 139, 250, 0.22);
  --interface-menu-component-surface-selected: rgba(167, 139, 250, 0.18);
  accent-color: var(--v2-accent);
}
.lg-node[data-v2-shell] .ctv\\:text-success-background { color: #a78bfa; }
html:not(.dark-theme) .lg-node[data-v2-shell] {
  --primary-background: rgba(124, 92, 230, 0.8);
  --primary-background-hover: rgba(124, 92, 230, 0.95);
  --accent-background: #7C5CE6;
  --secondary-background-selected: rgba(124, 92, 230, 0.22);
  --interface-menu-component-surface-selected: rgba(124, 92, 230, 0.18);
}
html:not(.dark-theme) .lg-node[data-v2-shell] .ctv\\:text-success-background { color: #7c5ce6; }
.lg-node[data-v2-shell] .lg-node-header { display: none; }
.lg-node[data-v2-shell] .lg-node-content { display: none; }
.lg-node[data-v2-shell] .mt-auto { display: none; }
.lg-node[data-v2-shell] > .isolate { display: none; }
.lg-node[data-v2-shell] { filter: none; }
.lg-node[data-v2-shell] [data-testid="node-state-outline-overlay"] { display: none; }
.lg-node[data-v2-shell] [data-testid^="node-body-"] > img { display: none; }
.lg-node[data-v2-shell] .h-2.bg-primary-500 { display: none; }
.lg-node[data-v2-shell] [class~="ctv:bg-black"]:has([class~="ctv:text-white/50"]) {
  background: var(--v2-media-bg);
}
.lg-node[data-v2-shell] [class~="ctv:bg-black"] [class~="ctv:text-white/50"] {
  color: var(--v2-text-faint);
}
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
  background: var(--v2-socket-bg);
  border: 1.5px solid var(--v2-socket-border);
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
  color: var(--v2-text-mid);
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
  color: var(--v2-text-mid);
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--v2-hover-bg);
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
  filter: drop-shadow(0 0 7px color-mix(in srgb, var(--v2-accent) 55%, transparent));
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
  color: var(--v2-text-muted);
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
.v2-handle:hover { background: var(--v2-hover-bg); }
.v2-handle:active { cursor: grabbing; }
.v2-handle .v2-grip { width: 12px; height: 12px; opacity: .55; flex: none; }
.v2-handle span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.v2-handle span[contenteditable] {
  outline: 1px solid var(--v2-accent-border);
  border-radius: 4px;
  padding: 1px 5px;
  cursor: text;
  color: var(--v2-text-strong);
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
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  box-shadow: var(--v2-slab-shadow);
  white-space: nowrap;
  z-index: 40;
}
.lg-node[data-v2-shell][data-v2-selected] .v2-toolbar { display: flex; }
.v2-toolbar:empty { display: none !important; }
.v2-toolbar__btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: none;
  border-radius: 9px;
  background: transparent;
  appearance: none;
  color: var(--v2-text-mid);
  font: 500 12px/1 system-ui, sans-serif;
  cursor: pointer;
  user-select: none;
}
.v2-toolbar__btn:hover { background: var(--v2-hover-bg); }
.v2-toolbar__btn svg { width: 14px; height: 14px; opacity: .9; }
.v2-toolbar__sep {
  width: 1px;
  height: 18px;
  margin: 0 5px;
  background: var(--v2-chip-border);
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
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-media-border);
  z-index: -1;
}
.v2-preview::before { transform: translate(7px, 4px) rotate(1.6deg); opacity: .8; }
.v2-preview::after  { transform: translate(13px, 9px) rotate(3deg); opacity: .45; }
.v2-preview--single::before,
.v2-preview--single::after { display: none; }
.v2-checker {
  background: var(--v2-checker);
  background-size: 18px 18px;
}
.v2-preview__media {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-checker);
  background-size: 18px 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-preview__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: none;
}
.v2-preview__img[data-live="1"] { display: block; }
.v2-preview__hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--v2-text-faint);
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
`

let cssInstalled = false
export function installV2ShellCss() {
  if (cssInstalled) return
  cssInstalled = true
  const style = document.createElement('style')
  style.textContent = V2_CSS_CHROME + V2_CSS_PANELS
  document.head.appendChild(style)
}

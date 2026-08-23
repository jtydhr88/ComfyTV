export const V2_CSS_PANELS = `
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
  background: var(--v2-slab-bg);
  backdrop-filter: blur(6px);
  border: 1px solid var(--v2-chip-border);
  box-shadow: var(--v2-slab-shadow);
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
  background: var(--v2-chip-bg);
}
.v2-strip__x {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 15px;
  height: 15px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(12, 12, 16, 0.78);
  color: #e6e6ea;
  font: 500 10px/1 system-ui, sans-serif;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}
.v2-strip__cell:hover .v2-strip__x { display: flex; }
@media (hover: none) {
  .v2-strip__x { display: flex; }
}
.v2-strip__x:hover { background: rgba(239, 68, 68, 0.85); color: #fff; }
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
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  box-shadow: var(--v2-slab-shadow);
}
.v2-panel__chips { display: flex; gap: 8px; }
.v2-panel__chipbtn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 7px 10px 5px;
  border-radius: 10px;
  background: var(--v2-chip-bg);
  border: 1px solid var(--v2-chip-border);
  color: var(--v2-text-mid);
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
  color: var(--v2-text-strong);
  font: 400 13px/1.6 system-ui, sans-serif;
  caret-color: var(--v2-text-strong);
}
.v2-panel__prompt::placeholder { color: var(--v2-text-faint); }
.v2-panel__refs:empty,
.v2-panel__presets:empty,
.v2-panel__controls:empty,
.v2-panel__custom:empty,
.v2-panel__params:empty { display: none; }
.v2-panel__presets .ctv-preset-bar { gap: 6px; }
.v2-panel__prompthost { margin: 0 -6px; }
.v2-panel__prompthost .comfytv-prompt-editor {
  resize: vertical;
  overflow-y: auto;
  overscroll-behavior: contain;
  max-height: 520px;
  cursor: text;
  display: flex;
  flex-direction: column;
}
.v2-panel__prompthost .comfytv-prompt-editor > div {
  flex: 1 0 auto;
  outline: none;
}
.v2-panel__prompthost .comfytv-prompt-editor::-webkit-resizer {
  background:
    linear-gradient(135deg, transparent 0 50%, var(--v2-scrollbar) 50% 60%, transparent 60% 75%, var(--v2-scrollbar) 75% 85%, transparent 85%);
}
.v2-panel__selects { flex: 1; min-width: 0; display: flex; }
.v2-panel__prompthost .comfytv-prompt-editor { min-height: 54px; font-size: 13px; }
.v2-panel__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--v2-text-mid);
  font: 500 12px/1 system-ui, sans-serif;
}
.v2-select {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  outline: none;
  background: transparent;
  color: var(--v2-text-mid);
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
.v2-select option { background: var(--v2-slab-bg); color: var(--v2-text-strong); }
.v2-panel__opt {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.v2-panel__opt svg { width: 14px; height: 14px; opacity: .85; flex: none; }
.v2-panel__spacer { flex: 1; }
.v2-panel__server { flex: none; display: flex; min-width: 0; max-width: 160px; }
.v2-panel__count { color: var(--v2-text-muted); font-size: 11px; white-space: nowrap; }
.v2-run {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid var(--v2-run-border, transparent);
  background: var(--v2-run-bg);
  color: var(--v2-run-fg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex: none;
  transition: transform .12s ease, background .12s ease;
}
.v2-run:hover { background: var(--v2-run-hover); transform: scale(1.06); }
.v2-run:active { transform: scale(.95); }
.v2-run svg { width: 15px; height: 15px; }
.v2-run__up, .v2-run__stop {
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-refs-warns {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(245,158,11,.10);
  border: 1px solid rgba(245,158,11,.32);
  color: #fcd34d;
  font: 500 10.5px/1.45 system-ui, sans-serif;
}
.v2-refs-warns__row { display: flex; gap: 6px; word-break: break-word; }
.v2-refs-warns__row::before { content: '⚠'; flex: none; }
.v2-warn {
  display: none;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(245,158,11,.10);
  border: 1px solid rgba(245,158,11,.32);
  color: #fcd34d;
  font: 500 11px/1.45 system-ui, sans-serif;
  flex: none;
}
.v2-warn[data-show="1"] { display: flex; }
.v2-warn__row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  word-break: break-word;
}
.v2-warn__row::before { content: '⚠'; flex: none; }
.lg-node[data-v2-warn] [data-testid^="node-body-"] > div:first-child > div:not(.ml-auto) {
  border-color: #f59e0b;
  box-shadow: 0 2px 8px rgba(0,0,0,.55), 0 0 0 2px rgba(245,158,11,.25);
}
.v2-error {
  display: none;
  align-items: flex-start;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  background: rgba(239,68,68,.12);
  border: 1px solid rgba(239,68,68,.35);
  color: #fca5a5;
  font: 500 11px/1.45 system-ui, sans-serif;
  flex: none;
}
.v2-error[data-show="1"] { display: flex; }
.v2-error__msg {
  flex: 1;
  min-width: 0;
  max-height: 48px;
  overflow: hidden;
  word-break: break-word;
}
.v2-error__x {
  flex: none;
  border: none;
  background: transparent;
  color: #fca5a5;
  font: 600 13px/1 system-ui, sans-serif;
  cursor: pointer;
  padding: 0 2px;
}
.v2-error__x:hover { color: #fecaca; }
.v2-duration {
  display: none;
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 3;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(12, 12, 16, 0.65);
  color: #b9b9c0;
  font: 500 10px/1 system-ui, sans-serif;
  pointer-events: none;
}
.v2-duration[data-show="1"] { display: block; }
.v2-run .v2-run__stop { display: none; }
.v2-run[data-busy="1"] { background: #ef4444; color: #fff; }
.v2-run[data-busy="1"]:hover { background: #f87171; }
.v2-run[data-busy="1"] .v2-run__up { display: none; }
.v2-run[data-busy="1"] .v2-run__stop { display: flex; }
`

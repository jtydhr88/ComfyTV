(function() {
  "use strict";
  try {
    if (typeof document != "undefined") {
      var elementStyle = document.createElement("style");
      elementStyle.appendChild(document.createTextNode(`.ctv-asset-thumb[data-v-c3e215e1] {\r
  transition: transform 0.2s ease;
}
.ctv-asset-card:hover .ctv-asset-thumb[data-v-c3e215e1] {\r
  transform: scale(1.05);
}
.ctv-asset-actions[data-v-c3e215e1] {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;
}
.ctv-asset-card:hover .ctv-asset-actions[data-v-c3e215e1],\r
.ctv-asset-card:focus-within .ctv-asset-actions[data-v-c3e215e1] {\r
  opacity: 1;\r
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
.ctv-asset-actions[data-v-c3e215e1] {\r
    opacity: 1;\r
    pointer-events: auto;
}
.ctv-asset-card:hover .ctv-asset-thumb[data-v-c3e215e1] {\r
    transform: none;
}
}\r

.ctv-alpha-checker[data-v-e5ec41ef] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}\r

.ctv-asset-actions[data-v-075b6463] {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;
}
.ctv-asset-row:hover .ctv-asset-actions[data-v-075b6463],\r
.ctv-asset-row:focus-within .ctv-asset-actions[data-v-075b6463] {\r
  opacity: 1;\r
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
.ctv-asset-actions[data-v-075b6463] {\r
    opacity: 1;\r
    pointer-events: auto;
}
}\r

.comfytv-entries-scroll {\r
  scrollbar-width: thin;\r
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-entries-scroll::-webkit-scrollbar {\r
  width: 10px;
}
.comfytv-entries-scroll::-webkit-scrollbar-track {\r
  background: transparent;
}
.comfytv-entries-scroll::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.35);\r
  border-radius: 5px;\r
  border: 2px solid transparent;\r
  background-clip: content-box;
}
.comfytv-entries-scroll:hover::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.55);
}\r

.ctv-text-input,\r
.ctv-text-input input,\r
.ctv-text-input textarea {\r
  appearance: none;\r
  background: var(--secondary-background, rgba(255,255,255,0.04));\r
  border: none;\r
  border-radius: 8px;\r
  padding: 6px 12px;\r
  color: var(--base-foreground, #ddd);\r
  font-size: 12px;\r
  font-family: inherit;\r
  width: 100%;\r
  min-width: 0;\r
  outline: none;\r
  box-sizing: border-box;
}
.ctv-text-input::placeholder,\r
.ctv-text-input input::placeholder,\r
.ctv-text-input textarea::placeholder { color: var(--muted-foreground, #888);
}
.ctv-text-area { line-height: 1.4; resize: vertical; min-height: 48px; overflow: hidden;
}
.ctv-text-input:focus-visible,\r
.ctv-text-input input:focus-visible,\r
.ctv-text-input textarea:focus-visible {\r
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-text-input:disabled,\r
.ctv-text-input input:disabled,\r
.ctv-text-input textarea:disabled { opacity: 0.5; pointer-events: none;
}\r

.ctv-num-root {\r
  display: flex;\r
  align-items: center;\r
  width: 100%;\r
  min-width: 0;\r
  background: var(--secondary-background, rgba(255,255,255,0.04));\r
  border-radius: 8px;\r
  box-sizing: border-box;
}
.ctv-num-root .ctv-num-input,\r
.ctv-num-root input {\r
  appearance: none;\r
  background: transparent;\r
  border: none;\r
  border-radius: 8px;\r
  padding: 6px 12px;\r
  color: var(--base-foreground, #ddd);\r
  font-size: 12px;\r
  font-family: inherit;\r
  width: 100%;\r
  min-width: 0;\r
  flex: 1;\r
  outline: none;\r
  text-align: left;\r
  box-sizing: border-box;
}
.ctv-num-root input::placeholder { color: var(--muted-foreground, #888);
}
.ctv-num-root:focus-within {\r
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-num-root input:disabled { opacity: 0.5; pointer-events: none;
}
.ctv-num-btn {\r
  flex-shrink: 0;\r
  appearance: none;\r
  background: transparent;\r
  border: none;\r
  color: var(--muted-foreground, #888);\r
  font-size: 13px;\r
  line-height: 1;\r
  width: 22px;\r
  height: 100%;\r
  min-height: 28px;\r
  cursor: pointer;\r
  user-select: none;\r
  display: inline-flex;\r
  align-items: center;\r
  justify-content: center;
}
.ctv-num-btn:hover { color: var(--base-foreground, #ddd);
}
.ctv-num-btn[data-disabled] { opacity: 0.4; pointer-events: none;
}\r

.ctv-toggle {\r
  display: inline-flex;\r
  align-items: center;\r
  flex-shrink: 0;\r
  width: 32px;\r
  height: 18px;\r
  padding: 2px;\r
  border: none;\r
  border-radius: 9999px;\r
  background: var(--secondary-background, rgba(255,255,255,0.12));\r
  cursor: pointer;\r
  transition: background 0.15s ease;
}
.ctv-toggle[data-state='checked'] {\r
  background: var(--primary-background, rgba(78,168,255,0.6));
}
.ctv-toggle:disabled,\r
.ctv-toggle[data-disabled] {\r
  opacity: 0.5;\r
  cursor: not-allowed;\r
  pointer-events: none;
}
.ctv-toggle:focus-visible {\r
  outline: none;\r
  box-shadow: 0 0 0 1px var(--border-default, rgba(255,255,255,0.25));
}
.ctv-toggle-thumb {\r
  display: block;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 9999px;\r
  background: #fff;\r
  transition: transform 0.15s ease;\r
  transform: translateX(0);\r
  will-change: transform;\r
  pointer-events: none;
}
.ctv-toggle[data-state='checked'] .ctv-toggle-thumb {\r
  transform: translateX(14px);
}\r

.comfytv-asset-scroll {\r
  scrollbar-width: thin;\r
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-asset-scroll::-webkit-scrollbar {\r
  width: 10px;
}
.comfytv-asset-scroll::-webkit-scrollbar-track {\r
  background: transparent;
}
.comfytv-asset-scroll::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.35);\r
  border-radius: 5px;\r
  border: 2px solid transparent;\r
  background-clip: content-box;
}
.comfytv-asset-scroll:hover::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.55);
}\r

.ctv-bot-md[data-v-123ad41e] p {\r
  margin: 0 0 0.5em;
}
.ctv-bot-md[data-v-123ad41e] p:last-child {\r
  margin-bottom: 0;
}
.ctv-bot-md[data-v-123ad41e] pre {\r
  overflow-x: auto;\r
  border-radius: 6px;\r
  padding: 6px 8px;\r
  background: color-mix(in srgb, currentColor 8%, transparent);
}
.ctv-bot-md[data-v-123ad41e] code {\r
  font-size: 11px;
}
.ctv-bot-md[data-v-123ad41e] ul,\r
.ctv-bot-md[data-v-123ad41e] ol {\r
  margin: 0 0 0.5em;\r
  padding-left: 1.2em;
}\r

@media (hover: hover) {
.ctv-bot-send[data-v-4e47f799]:hover:not(:disabled) {\r
    filter: brightness(1.15);
}
.ctv-bot-attach[data-v-4e47f799]:hover:not(:disabled) {\r
    background: color-mix(in srgb, currentColor 12%, transparent);
}
.ctv-bot-chip-x[data-v-4e47f799]:hover {\r
    filter: brightness(1.4);
}
}
.ctv-bot-attach[data-v-4e47f799] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 26px;\r
  height: 26px;\r
  border: none;\r
  border-radius: 6px;\r
  background: transparent;\r
  color: var(--p-text-muted-color, #9ca3af);\r
  cursor: pointer;
}
.ctv-bot-attach[data-v-4e47f799]:disabled {\r
  opacity: 0.4;\r
  cursor: default;
}
.ctv-bot-attach-active[data-v-4e47f799] {\r
  background: color-mix(in srgb, currentColor 14%, transparent);\r
  color: var(--input-text, #e0e0e0);
}
.ctv-bot-chip-x[data-v-4e47f799] {\r
  position: absolute;\r
  top: -5px;\r
  right: -5px;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 16px;\r
  height: 16px;\r
  border: none;\r
  border-radius: 999px;\r
  background: color-mix(in srgb, black 55%, transparent);\r
  color: white;\r
  cursor: pointer;
}\r

.ctv-bot-iconbtn[data-v-70d69227] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 24px;\r
  height: 24px;\r
  border: none;\r
  border-radius: 6px;\r
  background: transparent;\r
  color: var(--p-text-muted-color, #9ca3af);\r
  cursor: pointer;
}
.ctv-bot-row-actions[data-v-70d69227] {\r
  opacity: 0;
}
@media (hover: hover) {
.ctv-bot-iconbtn[data-v-70d69227]:hover {\r
    background: color-mix(in srgb, currentColor 12%, transparent);
}
.ctv-bot-row[data-v-70d69227]:hover {\r
    background: color-mix(in srgb, currentColor 4%, transparent);
}
.ctv-bot-row:hover .ctv-bot-row-actions[data-v-70d69227] {\r
    opacity: 1;
}
}
@media (hover: none) {
.ctv-bot-row-actions[data-v-70d69227] {\r
    opacity: 1;
}
}\r

.ctv-sidebar-tabbar[data-v-f9b20b21] {\r
  scrollbar-width: none;
}
.ctv-sidebar-tabbar[data-v-f9b20b21]::-webkit-scrollbar {\r
  display: none;
}\r

.imgref-remove[data-v-7b9304d6] {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;
}
.imgref-tile:hover .imgref-remove[data-v-7b9304d6],\r
.imgref-tile:focus-within .imgref-remove[data-v-7b9304d6] {\r
  opacity: 1;\r
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
.imgref-remove[data-v-7b9304d6] {\r
    opacity: 1;\r
    pointer-events: auto;
}
}\r
.tippy-box[data-animation=fade][data-state=hidden]{opacity:0}[data-tippy-root]{max-width:calc(100vw - 10px)}.tippy-box{position:relative;background-color:#333;color:#fff;border-radius:4px;font-size:14px;line-height:1.4;white-space:normal;outline:0;transition-property:transform,visibility,opacity}.tippy-box[data-placement^=top]>.tippy-arrow{bottom:0}.tippy-box[data-placement^=top]>.tippy-arrow:before{bottom:-7px;left:0;border-width:8px 8px 0;border-top-color:initial;transform-origin:center top}.tippy-box[data-placement^=bottom]>.tippy-arrow{top:0}.tippy-box[data-placement^=bottom]>.tippy-arrow:before{top:-7px;left:0;border-width:0 8px 8px;border-bottom-color:initial;transform-origin:center bottom}.tippy-box[data-placement^=left]>.tippy-arrow{right:0}.tippy-box[data-placement^=left]>.tippy-arrow:before{border-width:8px 0 8px 8px;border-left-color:initial;right:-7px;transform-origin:center left}.tippy-box[data-placement^=right]>.tippy-arrow{left:0}.tippy-box[data-placement^=right]>.tippy-arrow:before{left:-7px;border-width:8px 8px 8px 0;border-right-color:initial;transform-origin:center right}.tippy-box[data-inertia][data-state=visible]{transition-timing-function:cubic-bezier(.54,1.5,.38,1.11)}.tippy-arrow{width:16px;height:16px;color:#333}.tippy-arrow:before{content:"";position:absolute;border-color:transparent;border-style:solid}.tippy-content{position:relative;padding:5px 9px;z-index:1}
.comfytv-prompt-prosemirror {\r
  scrollbar-width: thin;\r
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar {\r
  width: 10px;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-track {\r
  background: transparent;
}
.comfytv-prompt-prosemirror::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.35);\r
  border-radius: 5px;\r
  border: 2px solid transparent;\r
  background-clip: content-box;
}
.comfytv-prompt-prosemirror:hover::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.55);
}
.tippy-box[data-theme~='comfytv-transparent'] {\r
  background: transparent;\r
  box-shadow: none;
}
.tippy-box[data-theme~='comfytv-transparent'] > .tippy-content { padding: 0;
}
.tippy-box[data-theme~='comfytv-tooltip'] {\r
  background: var(--interface-menu-surface, #1a1a1a);\r
  border: 1px solid var(--border-default, #3a3a3a);\r
  color: var(--base-foreground, #e0e0e0);\r
  font-size: 11px;\r
  line-height: 1.45;\r
  border-radius: 4px;\r
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}
.tippy-box[data-theme~='comfytv-tooltip'] > .tippy-content {\r
  padding: 6px 8px;\r
  white-space: pre-wrap;\r
  word-break: break-word;
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='top']    > .tippy-arrow::before { border-top-color: var(--border-default, #3a3a3a);
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='bottom'] > .tippy-arrow::before { border-bottom-color: var(--border-default, #3a3a3a);
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='left']   > .tippy-arrow::before { border-left-color: var(--border-default, #3a3a3a);
}
.tippy-box[data-theme~='comfytv-tooltip'][data-placement^='right']  > .tippy-arrow::before { border-right-color: var(--border-default, #3a3a3a);
}\r

.comfytv-prompt-editor[data-v-6e95b715] p { margin: 0;
}
.comfytv-prompt-editor[data-v-6e95b715] p.is-editor-empty:first-child::before {\r
  content: attr(data-placeholder);\r
  color: var(--muted-foreground, #888);\r
  opacity: 0.65;\r
  float: left;\r
  height: 0;\r
  pointer-events: none;
}\r

.ctv-slider-row {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  width: 100%;\r
  min-width: 0;
}
.ctv-slider-root {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  flex: 1;\r
  min-width: 0;\r
  height: 18px;\r
  user-select: none;\r
  touch-action: none;
}
.ctv-slider-track {\r
  position: relative;\r
  flex: 1;\r
  height: 4px;\r
  border-radius: 9999px;\r
  background: var(--secondary-background, rgba(255, 255, 255, 0.12));
}
.ctv-slider-range {\r
  position: absolute;\r
  height: 100%;\r
  border-radius: 9999px;\r
  background: var(--primary-background, #4a8cff);
}
.ctv-slider-thumb {\r
  display: block;\r
  width: 12px;\r
  height: 12px;\r
  border-radius: 9999px;\r
  background: var(--base-foreground, #eee);\r
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);\r
  cursor: grab;
}
.ctv-slider-thumb:active { cursor: grabbing;
}
.ctv-slider-thumb[data-disabled] { opacity: 0.5; pointer-events: none;
}
.ctv-slider-value {\r
  flex-shrink: 0;\r
  min-width: 32px;\r
  text-align: right;\r
  font-size: 11px;\r
  font-variant-numeric: tabular-nums;\r
  color: var(--base-foreground, #ddd);
}\r

.ctv-checker[data-v-e113744e] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}
.vp-text-scroll[data-v-e113744e] {\r
  scrollbar-width: thin;\r
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}
.vp-text-scroll[data-v-e113744e]::-webkit-scrollbar {\r
  width: 10px;
}
.vp-text-scroll[data-v-e113744e]::-webkit-scrollbar-track {\r
  background: transparent;
}
.vp-text-scroll[data-v-e113744e]::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.35);\r
  border-radius: 5px;\r
  border: 2px solid transparent;\r
  background-clip: content-box;
}
.vp-text-scroll[data-v-e113744e]:hover::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.55);
}
.ctv-batch-grid[data-v-e113744e] {\r
  display: grid;\r
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));\r
  gap: 4px;\r
  padding-top: 14px;\r
  max-height: 320px;\r
  overflow: auto;
}
.vp-img-actions[data-v-e113744e] {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;
}
.vp-img-host:hover .vp-img-actions[data-v-e113744e],\r
.vp-img-host:focus-within .vp-img-actions[data-v-e113744e] {\r
  opacity: 1;\r
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
.vp-img-actions[data-v-e113744e] {\r
    opacity: 1;\r
    pointer-events: auto;
}
}\r

.ctv-input-tile:hover .ctv-tile-disconnect[data-v-28e64cba] { display: inline-flex;
}
.ctv-picker-input.ctv-src-upstream         .ctv-src-tag[data-v-28e64cba] { background: color-mix(in srgb, var(--primary-background) 22%, transparent); color: var(--primary-background);
}
.ctv-picker-input.ctv-src-upstream-pending .ctv-src-tag[data-v-28e64cba] { background: color-mix(in srgb, var(--warning-background) 18%, transparent); color: var(--warning-background);
}\r

.ctv-camera-dropdown option[data-v-d255fcd1] {\r
  background: var(--interface-menu-surface, #1a1a2e);\r
  color: var(--base-foreground, #e0e0e0);
}\r

.ctv-crop-select[data-v-e2e320f0] button {\r
  height: 24px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 6px;\r
  border-width: 1px;
}
.ctv-bound-input[data-v-e2e320f0] { -moz-appearance: textfield;
}
.ctv-bound-input[data-v-e2e320f0]::-webkit-inner-spin-button,\r
.ctv-bound-input[data-v-e2e320f0]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-trim-input[data-v-8b561988] { -moz-appearance: textfield;
}
.ctv-trim-input[data-v-8b561988]::-webkit-inner-spin-button,\r
.ctv-trim-input[data-v-8b561988]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-crop-select[data-v-d4d4649d] option {\r
  background: var(--interface-menu-surface, #1a1a1f);\r
  color: var(--base-foreground, #ddd);
}
.ctv-bound-input[data-v-d4d4649d] { -moz-appearance: textfield;
}
.ctv-bound-input[data-v-d4d4649d]::-webkit-inner-spin-button,\r
.ctv-bound-input[data-v-d4d4649d]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-alpha-checker[data-v-9db5d5da] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}\r

.ctv-num-input[data-v-977e0d99] { -moz-appearance: textfield;
}
.ctv-num-input[data-v-977e0d99]::-webkit-inner-spin-button,\r
.ctv-num-input[data-v-977e0d99]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-num-input[data-v-493777f3] { -moz-appearance: textfield;
}
.ctv-num-input[data-v-493777f3]::-webkit-inner-spin-button,\r
.ctv-num-input[data-v-493777f3]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-num-input[data-v-3c3bfe35] { -moz-appearance: textfield;
}
.ctv-num-input[data-v-3c3bfe35]::-webkit-inner-spin-button,\r
.ctv-num-input[data-v-3c3bfe35]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-num-input[data-v-c49f9da7] { -moz-appearance: textfield;
}
.ctv-num-input[data-v-c49f9da7]::-webkit-inner-spin-button,\r
.ctv-num-input[data-v-c49f9da7]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-gradient-row[data-v-e17187da] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  width: 100%;\r
  min-width: 0;
}
.ctv-gradient-root[data-v-e17187da] {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  flex: 1;\r
  min-width: 0;\r
  height: 18px;\r
  user-select: none;\r
  touch-action: none;
}
.ctv-gradient-track[data-v-e17187da] {\r
  position: relative;\r
  flex: 1;\r
  height: 10px;\r
  border-radius: 9999px;\r
  cursor: pointer;
}
.ctv-gradient-thumb[data-v-e17187da] {\r
  display: block;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 9999px;\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\r
  outline: 1px solid rgba(0, 0, 0, 0.35);\r
  cursor: grab;
}
.ctv-gradient-thumb[data-v-e17187da]:active {\r
  cursor: grabbing;
}
.ctv-gradient-thumb[data-disabled][data-v-e17187da] {\r
  opacity: 0.5;\r
  pointer-events: none;
}
.ctv-gradient-value[data-v-e17187da] {\r
  flex-shrink: 0;\r
  min-width: 32px;\r
  text-align: right;\r
  font-size: 11px;\r
  font-variant-numeric: tabular-nums;\r
  color: var(--base-foreground, #ddd);
}\r

.ctv-curve-editor[data-v-412edb45] {\r
  aspect-ratio: 1 / 1;\r
  width: 100%;\r
  border-radius: 5px;\r
  background: var(--secondary-background, rgba(255, 255, 255, 0.06));\r
  color: var(--base-foreground, #fff);\r
  cursor: crosshair;\r
  touch-action: none;
}
.ctv-curve-disabled[data-v-412edb45] {\r
  cursor: default;
}
.ctv-curve-point[data-v-412edb45] {\r
  cursor: grab;
}
.ctv-curve-point[data-v-412edb45]:active {\r
  cursor: grabbing;
}\r

.ctv-pano-select-wrap[data-v-0db49e33] {\r
  position: relative;\r
  display: inline-flex;\r
  align-items: center;
}
.ctv-pano-caret[data-v-0db49e33] {\r
  position: absolute;\r
  right: 6px;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  font-size: 8px;\r
  color: var(--muted-foreground, rgb(255 255 255 / 0.5));\r
  pointer-events: none;
}
.ctv-pano-select[data-v-0db49e33] {\r
  appearance: none;\r
  background-color: var(--secondary-background, rgb(255 255 255 / 0.04));\r
  color: var(--base-foreground, rgb(255 255 255 / 0.9));\r
  border: 1px solid var(--border-subtle, rgb(255 255 255 / 0.15));\r
  border-radius: 4px;\r
  padding: 3px 18px 3px 6px;\r
  font-size: 11px;\r
  font-family: ui-monospace, SFMono-Regular, monospace;\r
  cursor: pointer;\r
  outline: none;\r
  min-width: 70px;
}
.ctv-pano-select[data-v-0db49e33]:hover { border-color: var(--border-default, rgb(255 255 255 / 0.3));
}
.ctv-pano-select[data-v-0db49e33]:focus { border-color: var(--primary-background, rgb(78 168 255 / 0.6));
}
.ctv-pano-select option[data-v-0db49e33] { background: var(--interface-menu-surface, #1a1a2e); color: var(--base-foreground, #e0e0e0);
}\r

.ctv-pano-select-wrap[data-v-1c06d1c2] {\r
  position: relative;\r
  display: inline-flex;\r
  align-items: center;
}
.ctv-pano-caret[data-v-1c06d1c2] {\r
  position: absolute;\r
  right: 6px;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  font-size: 8px;\r
  color: var(--muted-foreground, rgb(255 255 255 / 0.5));\r
  pointer-events: none;
}
.ctv-pano-select[data-v-1c06d1c2] {\r
  appearance: none;\r
  background-color: var(--secondary-background, rgb(255 255 255 / 0.04));\r
  color: var(--base-foreground, rgb(255 255 255 / 0.9));\r
  border: 1px solid var(--border-subtle, rgb(255 255 255 / 0.15));\r
  border-radius: 4px;\r
  padding: 3px 18px 3px 6px;\r
  font-size: 11px;\r
  font-family: ui-monospace, SFMono-Regular, monospace;\r
  cursor: pointer;\r
  outline: none;\r
  min-width: 70px;
}
.ctv-pano-select[data-v-1c06d1c2]:hover { border-color: var(--border-default, rgb(255 255 255 / 0.3));
}
.ctv-pano-select[data-v-1c06d1c2]:focus { border-color: var(--primary-background, rgb(78 168 255 / 0.6));
}
.ctv-pano-select option[data-v-1c06d1c2] { background: var(--interface-menu-surface, #1a1a2e); color: var(--base-foreground, #e0e0e0);
}\r

.ctv-al-fill[data-v-6c78f9ec] .vp-img-host {\r
  flex: 1 1 0%;\r
  min-height: 0;
}
.ctv-al-fill[data-v-6c78f9ec] .vp-img-host > video {\r
  height: 100%;\r
  max-height: none;\r
  object-fit: contain;
}\r

.comfytv-prompt-editor[data-v-8bd0fa01] p { margin: 0;
}
.comfytv-prompt-editor[data-v-8bd0fa01] p.is-editor-empty:first-child::before {\r
  content: attr(data-placeholder);\r
  color: var(--muted-foreground, #888);\r
  opacity: 0.65;\r
  float: left;\r
  height: 0;\r
  pointer-events: none;
}\r

.icon-btn[data-v-b9a39d0e] {\r
  background: transparent;\r
  border: 0;\r
  cursor: pointer;\r
  color: var(--muted-foreground, #999);\r
  padding: 2px 4px;\r
  border-radius: 4px;\r
  font-size: 12px;
}
.icon-btn[data-v-b9a39d0e]:hover,\r
.icon-btn[data-v-b9a39d0e]:focus-visible {\r
  color: var(--base-foreground, #eee);\r
  background: rgba(255, 255, 255, 0.08);
}
.icon-btn[data-v-b9a39d0e]:disabled {\r
  opacity: 0.4;\r
  cursor: default;\r
  pointer-events: none;
}
.chip-x[data-v-b9a39d0e] {\r
  background: transparent;\r
  border: 0;\r
  cursor: pointer;\r
  color: inherit;\r
  padding: 0 1px;
}
.clip-resize[data-v-b9a39d0e]:hover {\r
  background: rgba(255, 255, 255, 0.3);
}
.imgref-remove[data-v-b9a39d0e] {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;
}
.imgref-tile:hover .imgref-remove[data-v-b9a39d0e],\r
.imgref-tile:focus-within .imgref-remove[data-v-b9a39d0e] {\r
  opacity: 1;\r
  pointer-events: auto;
}
@media (hover: none), (pointer: coarse) {
.imgref-remove[data-v-b9a39d0e] {\r
    opacity: 1;\r
    pointer-events: auto;
}
}
.add-clip[data-v-b9a39d0e]:hover {\r
  color: var(--base-foreground, #eee);\r
  border-color: var(--primary-background, #4a9);
}
.playhead-cap[data-v-b9a39d0e] {\r
  position: absolute;\r
  top: 0;\r
  left: -4px;\r
  width: 0;\r
  height: 0;\r
  border-left: 4px solid transparent;\r
  border-right: 4px solid transparent;\r
  border-top: 6px solid var(--primary-background, #4a9);
}\r

.ctv-pad-area[data-v-05778c35] {\r
  background-image:\r
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%),\r
    linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.04) 75%);\r
  background-size: 12px 12px;\r
  background-position: 0 0, 6px 6px;\r
  border: 1px dashed color-mix(in srgb, var(--primary-background, #4ea8ff) 45%, transparent);
}
.ctv-outpaint-handle[data-v-05778c35]::before {\r
  content: '';\r
  position: absolute;\r
  background: color-mix(in srgb, var(--primary-background, #4ea8ff) 65%, transparent);\r
  border-radius: 2px;
}
.ctv-handle-left[data-v-05778c35]::before,  .ctv-handle-right[data-v-05778c35]::before  { width: 3px; height: 100%;
}
.ctv-handle-top[data-v-05778c35]::before,   .ctv-handle-bottom[data-v-05778c35]::before { height: 3px; width: 100%;
}
.ctv-outpaint-handle[data-v-05778c35]:hover::before { background: var(--primary-background, #4ea8ff);
}\r

.ctv-timeline-host .scroll-container::-webkit-scrollbar {\r
  height: 12px;\r
  width: 12px;
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-track {\r
  background: rgba(0, 0, 0, 0.25);
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-thumb {\r
  background: rgba(255, 255, 255, 0.25);\r
  border: 3px solid transparent;\r
  border-radius: 999px;\r
  background-clip: padding-box;
}
.ctv-timeline-host .scroll-container::-webkit-scrollbar-thumb:hover {\r
  background: rgba(255, 255, 255, 0.4);\r
  background-clip: padding-box;
}
.ctv-timeline-host .scroll-container {\r
  scrollbar-width: auto;\r
  scrollbar-color: rgba(255, 255, 255, 0.3) rgba(0, 0, 0, 0.25);
}\r

.ctv-fx-num[data-v-153356aa] { -moz-appearance: textfield;
}
.ctv-fx-num[data-v-153356aa]::-webkit-inner-spin-button,\r
.ctv-fx-num[data-v-153356aa]::-webkit-outer-spin-button { -webkit-appearance: none;
}
.ctv-fx-gradwrap[data-v-153356aa] {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  min-width: 0;
}
.ctv-fx-gradbar[data-v-153356aa] {\r
  position: absolute;\r
  left: 0;\r
  right: 0;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  height: 8px;\r
  border-radius: 9999px;\r
  pointer-events: none;
}
.ctv-fx-range--grad[data-v-153356aa] {\r
  position: relative;\r
  width: 100%;\r
  height: 16px;\r
  margin: 0;\r
  background: transparent;\r
  -webkit-appearance: none;\r
  appearance: none;
}
.ctv-fx-range--grad[data-v-153356aa]::-webkit-slider-runnable-track {\r
  height: 8px;\r
  background: transparent;
}
.ctv-fx-range--grad[data-v-153356aa]::-webkit-slider-thumb {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 9999px;\r
  background: var(--thumb-color, #fff);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\r
  outline: 1px solid rgba(0, 0, 0, 0.35);\r
  margin-top: -3px;\r
  cursor: grab;
}
.ctv-fx-range--grad[data-v-153356aa]::-moz-range-track {\r
  height: 8px;\r
  background: transparent;
}
.ctv-fx-range--grad[data-v-153356aa]::-moz-range-thumb {\r
  width: 14px;\r
  height: 14px;\r
  border: none;\r
  border-radius: 9999px;\r
  background: var(--thumb-color, #fff);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\r
  cursor: grab;
}
.ctv-fx-range--grad[data-v-153356aa]:active::-webkit-slider-thumb { cursor: grabbing;
}\r

.ctv-fx-num[data-v-a7c2c51e] { -moz-appearance: textfield;
}
.ctv-fx-num[data-v-a7c2c51e]::-webkit-inner-spin-button,\r
.ctv-fx-num[data-v-a7c2c51e]::-webkit-outer-spin-button { -webkit-appearance: none;
}
.ctv-fx-gradwrap[data-v-a7c2c51e] {\r
  position: relative;\r
  display: flex;\r
  align-items: center;\r
  min-width: 0;
}
.ctv-fx-gradbar[data-v-a7c2c51e] {\r
  position: absolute;\r
  left: 0;\r
  right: 0;\r
  top: 50%;\r
  transform: translateY(-50%);\r
  height: 8px;\r
  border-radius: 9999px;\r
  pointer-events: none;
}
.ctv-fx-range--grad[data-v-a7c2c51e] {\r
  position: relative;\r
  width: 100%;\r
  height: 16px;\r
  margin: 0;\r
  background: transparent;\r
  -webkit-appearance: none;\r
  appearance: none;
}
.ctv-fx-range--grad[data-v-a7c2c51e]::-webkit-slider-runnable-track {\r
  height: 8px;\r
  background: transparent;
}
.ctv-fx-range--grad[data-v-a7c2c51e]::-webkit-slider-thumb {\r
  -webkit-appearance: none;\r
  appearance: none;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 9999px;\r
  background: var(--thumb-color, #fff);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\r
  outline: 1px solid rgba(0, 0, 0, 0.35);\r
  margin-top: -3px;\r
  cursor: grab;
}
.ctv-fx-range--grad[data-v-a7c2c51e]::-moz-range-track {\r
  height: 8px;\r
  background: transparent;
}
.ctv-fx-range--grad[data-v-a7c2c51e]::-moz-range-thumb {\r
  width: 14px;\r
  height: 14px;\r
  border: none;\r
  border-radius: 9999px;\r
  background: var(--thumb-color, #fff);\r
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\r
  cursor: grab;
}
.ctv-fx-range--grad[data-v-a7c2c51e]:active::-webkit-slider-thumb { cursor: grabbing;
}\r

.clip-preview-bar[data-v-e8886d24] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  min-width: 0;
}
.clip-preview-btn[data-v-e8886d24] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 5px 10px;\r
  height: 26px;\r
  border: 1px solid rgba(255, 255, 255, 0.08);\r
  border-radius: 9px;\r
  background: rgba(255, 255, 255, 0.04);\r
  color: #d9d9de;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  cursor: pointer;\r
  appearance: none;\r
  user-select: none;\r
  flex: none;
}
.clip-preview-btn[data-v-e8886d24]:hover:not(:disabled) {\r
  border-color: rgba(167, 139, 250, 0.55);\r
  background: rgba(167, 139, 250, 0.12);
}
.clip-preview-btn[data-v-e8886d24]:disabled {\r
  opacity: 0.4;\r
  cursor: default;
}
.clip-preview-btn svg[data-v-e8886d24] {\r
  width: 13px;\r
  height: 13px;\r
  opacity: 0.9;
}
.clip-preview-spin[data-v-e8886d24] {\r
  width: 12px;\r
  height: 12px;\r
  border-radius: 50%;\r
  border: 2px solid rgba(167, 139, 250, 0.25);\r
  border-top-color: #a78bfa;\r
  animation: clip-preview-rot-e8886d24 0.7s linear infinite;\r
  flex: none;
}
@keyframes clip-preview-rot-e8886d24 {
to {\r
    transform: rotate(360deg);
}
}
.clip-preview-note[data-v-e8886d24] {\r
  font-size: 10px;\r
  color: #8b8b93;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}
.clip-preview-note.is-error[data-v-e8886d24] {\r
  color: var(--destructive-background, #ef4444);
}
.clip-preview-note.is-stale[data-v-e8886d24] {\r
  color: var(--warning-background, #f59e0b);
}
.clip-preview-player[data-v-e8886d24] {\r
  height: 160px;\r
  display: flex;\r
  flex-direction: column;\r
  margin-top: 8px;
}\r

.ctv-checker[data-v-bf86999a] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}\r

.ctv-trim-input[data-v-bc7dca3d] { -moz-appearance: textfield;
}
.ctv-trim-input[data-v-bc7dca3d]::-webkit-inner-spin-button,\r
.ctv-trim-input[data-v-bc7dca3d]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-seq-btn[data-v-2c7b8d2d] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 16px;\r
  height: 12px;\r
  border-radius: 3px;\r
  cursor: pointer;\r
  border: 1px solid var(--ctv-border-subtle, rgb(255 255 255 / 0.15));\r
  background: transparent;\r
  color: inherit;
}
.ctv-seq-btn[data-v-2c7b8d2d]:disabled {\r
  opacity: 0.3;\r
  cursor: default;
}
.ctv-seq-num[data-v-2c7b8d2d] {\r
  width: 3.25rem;\r
  padding: 2px 4px;\r
  text-align: right;\r
  font-size: 11px;\r
  font-family: monospace;\r
  border-radius: 4px;\r
  background: var(--p-secondary-background, rgb(0 0 0 / 0.4));\r
  border: 1px solid var(--ctv-border-subtle, rgb(255 255 255 / 0.15));\r
  color: inherit;\r
  -moz-appearance: textfield;
}
.ctv-seq-num[data-v-2c7b8d2d]::-webkit-inner-spin-button,\r
.ctv-seq-num[data-v-2c7b8d2d]::-webkit-outer-spin-button {\r
  -webkit-appearance: none;
}\r

.ctv-checker[data-v-ada0536a] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}\r

.ctv-checker[data-v-24f370b9] {\r
  background-image:\r
    linear-gradient(45deg, #333 25%, transparent 25%, transparent 75%, #333 75%),\r
    linear-gradient(45deg, #333 25%, #222 25%, #222 75%, #333 75%);\r
  background-size: 16px 16px;\r
  background-position: 0 0, 8px 8px;
}\r
/*! tailwindcss v4.3.2 | MIT License | https://tailwindcss.com */
@layer properties {
  @supports (((-webkit-hyphens: none)) and (not (margin-trim: inline))) or ((-moz-orient: inline) and (not (color: rgb(from red r g b)))) {
    *, :before, :after, ::backdrop {
      --tw-translate-x: 0;
      --tw-translate-y: 0;
      --tw-translate-z: 0;
      --tw-border-style: solid;
      --tw-gradient-position: initial;
      --tw-gradient-from: #0000;
      --tw-gradient-via: #0000;
      --tw-gradient-to: #0000;
      --tw-gradient-stops: initial;
      --tw-gradient-via-stops: initial;
      --tw-gradient-from-position: 0%;
      --tw-gradient-via-position: 50%;
      --tw-gradient-to-position: 100%;
      --tw-leading: initial;
      --tw-font-weight: initial;
      --tw-tracking: initial;
      --tw-ordinal: initial;
      --tw-slashed-zero: initial;
      --tw-numeric-figure: initial;
      --tw-numeric-spacing: initial;
      --tw-numeric-fraction: initial;
      --tw-shadow: 0 0 #0000;
      --tw-shadow-color: initial;
      --tw-shadow-alpha: 100%;
      --tw-inset-shadow: 0 0 #0000;
      --tw-inset-shadow-color: initial;
      --tw-inset-shadow-alpha: 100%;
      --tw-ring-color: initial;
      --tw-ring-shadow: 0 0 #0000;
      --tw-inset-ring-color: initial;
      --tw-inset-ring-shadow: 0 0 #0000;
      --tw-ring-inset: initial;
      --tw-ring-offset-width: 0px;
      --tw-ring-offset-color: #fff;
      --tw-ring-offset-shadow: 0 0 #0000;
      --tw-outline-style: solid;
      --tw-backdrop-blur: initial;
      --tw-backdrop-brightness: initial;
      --tw-backdrop-contrast: initial;
      --tw-backdrop-grayscale: initial;
      --tw-backdrop-hue-rotate: initial;
      --tw-backdrop-invert: initial;
      --tw-backdrop-opacity: initial;
      --tw-backdrop-saturate: initial;
      --tw-backdrop-sepia: initial;
      --tw-duration: initial;
      --tw-ease: initial;
      --tw-blur: initial;
      --tw-brightness: initial;
      --tw-contrast: initial;
      --tw-grayscale: initial;
      --tw-hue-rotate: initial;
      --tw-invert: initial;
      --tw-opacity: initial;
      --tw-saturate: initial;
      --tw-sepia: initial;
      --tw-drop-shadow: initial;
      --tw-drop-shadow-color: initial;
      --tw-drop-shadow-alpha: 100%;
      --tw-drop-shadow-size: initial;
      --tw-scale-x: 1;
      --tw-scale-y: 1;
      --tw-scale-z: 1;
    }
  }
}

@layer theme {
  :root, :host {
    --ctv-font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New",
    monospace;
    --ctv-color-red-300: oklch(80.8% .114 19.571);
    --ctv-color-red-400: oklch(70.4% .191 22.216);
    --ctv-color-amber-400: oklch(82.8% .189 84.429);
    --ctv-color-emerald-400: oklch(76.5% .177 163.223);
    --ctv-color-emerald-500: oklch(69.6% .17 162.48);
    --ctv-color-gray-600: oklch(44.6% .03 256.802);
    --ctv-color-neutral-400: oklch(70.8% 0 0);
    --ctv-color-black: #000;
    --ctv-color-white: #fff;
    --ctv-spacing: .25rem;
    --ctv-container-md: 28rem;
    --ctv-text-xs: .75rem;
    --ctv-text-xs--line-height: calc(1 / .75);
    --ctv-text-sm: .875rem;
    --ctv-text-sm--line-height: calc(1.25 / .875);
    --ctv-text-lg: 1.125rem;
    --ctv-text-lg--line-height: calc(1.75 / 1.125);
    --ctv-text-2xl: 1.5rem;
    --ctv-text-2xl--line-height: calc(2 / 1.5);
    --ctv-font-weight-medium: 500;
    --ctv-font-weight-semibold: 600;
    --ctv-font-weight-bold: 700;
    --ctv-tracking-normal: 0em;
    --ctv-tracking-wide: .025em;
    --ctv-tracking-wider: .05em;
    --ctv-leading-tight: 1.25;
    --ctv-leading-snug: 1.375;
    --ctv-leading-relaxed: 1.625;
    --ctv-radius-xs: .125rem;
    --ctv-radius-sm: .25rem;
    --ctv-radius-md: .375rem;
    --ctv-radius-lg: .5rem;
    --ctv-radius-xl: .75rem;
    --ctv-ease-in: cubic-bezier(.4, 0, 1, 1);
    --ctv-ease-out: cubic-bezier(0, 0, .2, 1);
    --ctv-ease-in-out: cubic-bezier(.4, 0, .2, 1);
    --ctv-animate-spin: spin 1s linear infinite;
    --ctv-animate-pulse: pulse 2s cubic-bezier(.4, 0, .6, 1) infinite;
    --ctv-blur-sm: 8px;
    --ctv-aspect-video: 16 / 9;
    --ctv-default-transition-duration: .15s;
    --ctv-default-transition-timing-function: cubic-bezier(.4, 0, .2, 1);
    --ctv-text-2xs: .625rem;
    --ctv-text-2xs--line-height: calc(1 / .625);
    --ctv-text-3xs: .5625rem;
    --ctv-text-3xs--line-height: calc(1 / .5625);
  }
}

@layer utilities {
  .ctv\\:pointer-events-none {
    pointer-events: none;
  }

  .ctv\\:invisible {
    visibility: hidden;
  }

  .ctv\\:absolute {
    position: absolute;
  }

  .ctv\\:absolute\\! {
    position: absolute !important;
  }

  .ctv\\:fixed {
    position: fixed;
  }

  .ctv\\:relative {
    position: relative;
  }

  .ctv\\:sticky {
    position: sticky;
  }

  .ctv\\:inset-0 {
    inset: 0;
  }

  .ctv\\:inset-1 {
    inset: var(--ctv-spacing);
  }

  .ctv\\:inset-x-0 {
    inset-inline: 0;
  }

  .ctv\\:inset-y-0 {
    inset-block: 0;
  }

  .ctv\\:-top-1 {
    top: calc(var(--ctv-spacing) * -1);
  }

  .ctv\\:-top-2 {
    top: calc(var(--ctv-spacing) * -2);
  }

  .ctv\\:top-0 {
    top: 0;
  }

  .ctv\\:top-0\\.5 {
    top: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:top-1 {
    top: var(--ctv-spacing);
  }

  .ctv\\:top-1\\.5 {
    top: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:top-1\\/2 {
    top: 50%;
  }

  .ctv\\:top-2 {
    top: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:top-4 {
    top: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:top-\\[3px\\] {
    top: 3px;
  }

  .ctv\\:top-full {
    top: 100%;
  }

  .ctv\\:right-0 {
    right: 0;
  }

  .ctv\\:right-0\\.5 {
    right: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:right-1 {
    right: var(--ctv-spacing);
  }

  .ctv\\:right-1\\.5 {
    right: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:right-2 {
    right: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:right-4 {
    right: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:right-\\[3px\\] {
    right: 3px;
  }

  .ctv\\:right-\\[14px\\] {
    right: 14px;
  }

  .ctv\\:bottom-0 {
    bottom: 0;
  }

  .ctv\\:bottom-0\\.5 {
    bottom: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:bottom-1 {
    bottom: var(--ctv-spacing);
  }

  .ctv\\:bottom-1\\.5 {
    bottom: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:bottom-2 {
    bottom: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:bottom-4 {
    bottom: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:bottom-7 {
    bottom: calc(var(--ctv-spacing) * 7);
  }

  .ctv\\:bottom-8 {
    bottom: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:bottom-px {
    bottom: 1px;
  }

  .ctv\\:left-0 {
    left: 0;
  }

  .ctv\\:left-0\\.5 {
    left: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:left-1 {
    left: var(--ctv-spacing);
  }

  .ctv\\:left-1\\.5 {
    left: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:left-1\\/2 {
    left: 50%;
  }

  .ctv\\:left-2 {
    left: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:left-4 {
    left: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:z-1 {
    z-index: 1;
  }

  .ctv\\:z-10 {
    z-index: 10;
  }

  .ctv\\:z-20 {
    z-index: 20;
  }

  .ctv\\:z-30 {
    z-index: 30;
  }

  .ctv\\:z-50 {
    z-index: 50;
  }

  .ctv\\:z-3000 {
    z-index: 3000;
  }

  .ctv\\:z-\\[1\\] {
    z-index: 1;
  }

  .ctv\\:z-\\[2\\] {
    z-index: 2;
  }

  .ctv\\:z-\\[3\\] {
    z-index: 3;
  }

  .ctv\\:z-\\[5\\] {
    z-index: 5;
  }

  .ctv\\:z-\\[6\\] {
    z-index: 6;
  }

  .ctv\\:z-\\[7\\] {
    z-index: 7;
  }

  .ctv\\:z-\\[1400\\] {
    z-index: 1400;
  }

  .ctv\\:z-\\[9999\\] {
    z-index: 9999;
  }

  .ctv\\:z-\\[10000\\] {
    z-index: 10000;
  }

  .ctv\\:m-0 {
    margin: 0;
  }

  .ctv\\:m-0\\.5 {
    margin: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:m-1 {
    margin: var(--ctv-spacing);
  }

  .ctv\\:-mx-1 {
    margin-inline: calc(var(--ctv-spacing) * -1);
  }

  .ctv\\:-mx-2\\.5 {
    margin-inline: calc(var(--ctv-spacing) * -2.5);
  }

  .ctv\\:mx-0\\.5 {
    margin-inline: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:mx-1 {
    margin-inline: var(--ctv-spacing);
  }

  .ctv\\:mx-1\\.5 {
    margin-inline: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:mx-2 {
    margin-inline: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:mx-2\\.5 {
    margin-inline: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:mx-auto {
    margin-inline: auto;
  }

  .ctv\\:mx-px {
    margin-inline: 1px;
  }

  .ctv\\:my-0\\.5 {
    margin-block: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:my-1 {
    margin-block: var(--ctv-spacing);
  }

  .ctv\\:my-1\\.5 {
    margin-block: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:my-auto {
    margin-block: auto;
  }

  .ctv\\:-mt-2 {
    margin-top: calc(var(--ctv-spacing) * -2);
  }

  .ctv\\:mt-0\\.5 {
    margin-top: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:mt-1 {
    margin-top: var(--ctv-spacing);
  }

  .ctv\\:mt-1\\.5 {
    margin-top: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:mt-2 {
    margin-top: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:mt-3\\.5 {
    margin-top: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:mt-4 {
    margin-top: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:mt-auto {
    margin-top: auto;
  }

  .ctv\\:mr-0\\.5 {
    margin-right: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:mr-1 {
    margin-right: var(--ctv-spacing);
  }

  .ctv\\:mr-1\\.5 {
    margin-right: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:mb-0 {
    margin-bottom: 0;
  }

  .ctv\\:mb-0\\.5 {
    margin-bottom: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:mb-1\\.5 {
    margin-bottom: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:mb-2 {
    margin-bottom: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:mb-2\\.5 {
    margin-bottom: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:mb-\\[3px\\] {
    margin-bottom: 3px;
  }

  .ctv\\:-ml-2 {
    margin-left: calc(var(--ctv-spacing) * -2);
  }

  .ctv\\:-ml-\\[5px\\] {
    margin-left: -5px;
  }

  .ctv\\:-ml-px {
    margin-left: -1px;
  }

  .ctv\\:ml-0\\.5 {
    margin-left: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:ml-1 {
    margin-left: var(--ctv-spacing);
  }

  .ctv\\:ml-1\\.5 {
    margin-left: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:ml-auto {
    margin-left: auto;
  }

  .ctv\\:box-border {
    box-sizing: border-box;
  }

  .ctv\\:box-content {
    box-sizing: content-box;
  }

  .ctv\\:line-clamp-2 {
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    display: -webkit-box;
    overflow: hidden;
  }

  .ctv\\:\\[display\\:-webkit-box\\] {
    display: -webkit-box;
  }

  .ctv\\:block {
    display: block;
  }

  .ctv\\:flex {
    display: flex;
  }

  .ctv\\:grid {
    display: grid;
  }

  .ctv\\:hidden {
    display: none;
  }

  .ctv\\:inline {
    display: inline;
  }

  .ctv\\:inline-block {
    display: inline-block;
  }

  .ctv\\:inline-flex {
    display: inline-flex;
  }

  .ctv\\:aspect-square {
    aspect-ratio: 1;
  }

  .ctv\\:aspect-video {
    aspect-ratio: var(--ctv-aspect-video);
  }

  .ctv\\:size-1\\.5 {
    width: calc(var(--ctv-spacing) * 1.5);
    height: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:size-2 {
    width: calc(var(--ctv-spacing) * 2);
    height: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:size-2\\.5 {
    width: calc(var(--ctv-spacing) * 2.5);
    height: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:size-3 {
    width: calc(var(--ctv-spacing) * 3);
    height: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:size-3\\.5 {
    width: calc(var(--ctv-spacing) * 3.5);
    height: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:size-4 {
    width: calc(var(--ctv-spacing) * 4);
    height: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:size-4\\.5 {
    width: calc(var(--ctv-spacing) * 4.5);
    height: calc(var(--ctv-spacing) * 4.5);
  }

  .ctv\\:size-5 {
    width: calc(var(--ctv-spacing) * 5);
    height: calc(var(--ctv-spacing) * 5);
  }

  .ctv\\:size-6 {
    width: calc(var(--ctv-spacing) * 6);
    height: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:size-7 {
    width: calc(var(--ctv-spacing) * 7);
    height: calc(var(--ctv-spacing) * 7);
  }

  .ctv\\:size-8 {
    width: calc(var(--ctv-spacing) * 8);
    height: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:size-9 {
    width: calc(var(--ctv-spacing) * 9);
    height: calc(var(--ctv-spacing) * 9);
  }

  .ctv\\:size-10 {
    width: calc(var(--ctv-spacing) * 10);
    height: calc(var(--ctv-spacing) * 10);
  }

  .ctv\\:size-12 {
    width: calc(var(--ctv-spacing) * 12);
    height: calc(var(--ctv-spacing) * 12);
  }

  .ctv\\:size-16 {
    width: calc(var(--ctv-spacing) * 16);
    height: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:size-\\[22px\\] {
    width: 22px;
    height: 22px;
  }

  .ctv\\:size-full {
    width: 100%;
    height: 100%;
  }

  .ctv\\:h-1\\.5 {
    height: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:h-2 {
    height: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:h-2\\.5 {
    height: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:h-3 {
    height: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:h-3\\.5 {
    height: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:h-4 {
    height: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:h-5 {
    height: calc(var(--ctv-spacing) * 5);
  }

  .ctv\\:h-6 {
    height: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:h-7 {
    height: calc(var(--ctv-spacing) * 7);
  }

  .ctv\\:h-8 {
    height: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:h-9 {
    height: calc(var(--ctv-spacing) * 9);
  }

  .ctv\\:h-10 {
    height: calc(var(--ctv-spacing) * 10);
  }

  .ctv\\:h-11 {
    height: calc(var(--ctv-spacing) * 11);
  }

  .ctv\\:h-12 {
    height: calc(var(--ctv-spacing) * 12);
  }

  .ctv\\:h-14 {
    height: calc(var(--ctv-spacing) * 14);
  }

  .ctv\\:h-16 {
    height: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:h-18 {
    height: calc(var(--ctv-spacing) * 18);
  }

  .ctv\\:h-20 {
    height: calc(var(--ctv-spacing) * 20);
  }

  .ctv\\:h-24 {
    height: calc(var(--ctv-spacing) * 24);
  }

  .ctv\\:h-28 {
    height: calc(var(--ctv-spacing) * 28);
  }

  .ctv\\:h-40 {
    height: calc(var(--ctv-spacing) * 40);
  }

  .ctv\\:h-48 {
    height: calc(var(--ctv-spacing) * 48);
  }

  .ctv\\:h-52 {
    height: calc(var(--ctv-spacing) * 52);
  }

  .ctv\\:h-56 {
    height: calc(var(--ctv-spacing) * 56);
  }

  .ctv\\:h-80 {
    height: calc(var(--ctv-spacing) * 80);
  }

  .ctv\\:h-\\[13px\\] {
    height: 13px;
  }

  .ctv\\:h-\\[18px\\] {
    height: 18px;
  }

  .ctv\\:h-\\[72px\\] {
    height: 72px;
  }

  .ctv\\:h-\\[76px\\] {
    height: 76px;
  }

  .ctv\\:h-\\[224px\\] {
    height: 224px;
  }

  .ctv\\:h-\\[300px\\] {
    height: 300px;
  }

  .ctv\\:h-\\[calc\\(100\\%-190px\\)\\] {
    height: calc(100% - 190px);
  }

  .ctv\\:h-\\[calc\\(100\\%-320px\\)\\] {
    height: calc(100% - 320px);
  }

  .ctv\\:h-\\[calc\\(100\\%-340px\\)\\] {
    height: calc(100% - 340px);
  }

  .ctv\\:h-\\[calc\\(100\\%-360px\\)\\] {
    height: calc(100% - 360px);
  }

  .ctv\\:h-auto\\! {
    height: auto !important;
  }

  .ctv\\:h-full {
    height: 100%;
  }

  .ctv\\:h-px {
    height: 1px;
  }

  .ctv\\:max-h-16 {
    max-height: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:max-h-20 {
    max-height: calc(var(--ctv-spacing) * 20);
  }

  .ctv\\:max-h-24 {
    max-height: calc(var(--ctv-spacing) * 24);
  }

  .ctv\\:max-h-32 {
    max-height: calc(var(--ctv-spacing) * 32);
  }

  .ctv\\:max-h-40 {
    max-height: calc(var(--ctv-spacing) * 40);
  }

  .ctv\\:max-h-44 {
    max-height: calc(var(--ctv-spacing) * 44);
  }

  .ctv\\:max-h-48 {
    max-height: calc(var(--ctv-spacing) * 48);
  }

  .ctv\\:max-h-52 {
    max-height: calc(var(--ctv-spacing) * 52);
  }

  .ctv\\:max-h-56 {
    max-height: calc(var(--ctv-spacing) * 56);
  }

  .ctv\\:max-h-60 {
    max-height: calc(var(--ctv-spacing) * 60);
  }

  .ctv\\:max-h-64 {
    max-height: calc(var(--ctv-spacing) * 64);
  }

  .ctv\\:max-h-80 {
    max-height: calc(var(--ctv-spacing) * 80);
  }

  .ctv\\:max-h-\\[46vh\\] {
    max-height: 46vh;
  }

  .ctv\\:max-h-\\[60vh\\] {
    max-height: 60vh;
  }

  .ctv\\:max-h-\\[360px\\] {
    max-height: 360px;
  }

  .ctv\\:max-h-\\[calc\\(100vh-48px\\)\\] {
    max-height: calc(100vh - 48px);
  }

  .ctv\\:max-h-full {
    max-height: 100%;
  }

  .ctv\\:min-h-0 {
    min-height: 0;
  }

  .ctv\\:min-h-10 {
    min-height: calc(var(--ctv-spacing) * 10);
  }

  .ctv\\:min-h-11 {
    min-height: calc(var(--ctv-spacing) * 11);
  }

  .ctv\\:min-h-12 {
    min-height: calc(var(--ctv-spacing) * 12);
  }

  .ctv\\:min-h-14 {
    min-height: calc(var(--ctv-spacing) * 14);
  }

  .ctv\\:min-h-16 {
    min-height: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:min-h-20 {
    min-height: calc(var(--ctv-spacing) * 20);
  }

  .ctv\\:min-h-40 {
    min-height: calc(var(--ctv-spacing) * 40);
  }

  .ctv\\:min-h-48 {
    min-height: calc(var(--ctv-spacing) * 48);
  }

  .ctv\\:min-h-\\[22px\\] {
    min-height: 22px;
  }

  .ctv\\:min-h-\\[24px\\] {
    min-height: 24px;
  }

  .ctv\\:min-h-\\[96px\\] {
    min-height: 96px;
  }

  .ctv\\:min-h-\\[116px\\] {
    min-height: 116px;
  }

  .ctv\\:min-h-\\[140px\\] {
    min-height: 140px;
  }

  .ctv\\:min-h-\\[160px\\] {
    min-height: 160px;
  }

  .ctv\\:min-h-\\[180px\\] {
    min-height: 180px;
  }

  .ctv\\:min-h-\\[200px\\] {
    min-height: 200px;
  }

  .ctv\\:min-h-\\[220px\\] {
    min-height: 220px;
  }

  .ctv\\:min-h-\\[240px\\] {
    min-height: 240px;
  }

  .ctv\\:min-h-\\[260px\\] {
    min-height: 260px;
  }

  .ctv\\:min-h-\\[280px\\] {
    min-height: 280px;
  }

  .ctv\\:min-h-\\[300px\\] {
    min-height: 300px;
  }

  .ctv\\:min-h-\\[320px\\] {
    min-height: 320px;
  }

  .ctv\\:min-h-\\[340px\\] {
    min-height: 340px;
  }

  .ctv\\:min-h-\\[350px\\] {
    min-height: 350px;
  }

  .ctv\\:w-0\\.5 {
    width: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:w-1\\.5 {
    width: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:w-2 {
    width: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:w-2\\.5 {
    width: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:w-3 {
    width: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:w-3\\.5 {
    width: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:w-4 {
    width: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:w-5 {
    width: calc(var(--ctv-spacing) * 5);
  }

  .ctv\\:w-7 {
    width: calc(var(--ctv-spacing) * 7);
  }

  .ctv\\:w-8 {
    width: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:w-9 {
    width: calc(var(--ctv-spacing) * 9);
  }

  .ctv\\:w-10 {
    width: calc(var(--ctv-spacing) * 10);
  }

  .ctv\\:w-11 {
    width: calc(var(--ctv-spacing) * 11);
  }

  .ctv\\:w-11\\! {
    width: calc(var(--ctv-spacing) * 11) !important;
  }

  .ctv\\:w-12 {
    width: calc(var(--ctv-spacing) * 12);
  }

  .ctv\\:w-14 {
    width: calc(var(--ctv-spacing) * 14);
  }

  .ctv\\:w-16 {
    width: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:w-20 {
    width: calc(var(--ctv-spacing) * 20);
  }

  .ctv\\:w-24 {
    width: calc(var(--ctv-spacing) * 24);
  }

  .ctv\\:w-28 {
    width: calc(var(--ctv-spacing) * 28);
  }

  .ctv\\:w-32 {
    width: calc(var(--ctv-spacing) * 32);
  }

  .ctv\\:w-32\\! {
    width: calc(var(--ctv-spacing) * 32) !important;
  }

  .ctv\\:w-36 {
    width: calc(var(--ctv-spacing) * 36);
  }

  .ctv\\:w-40 {
    width: calc(var(--ctv-spacing) * 40);
  }

  .ctv\\:w-44 {
    width: calc(var(--ctv-spacing) * 44);
  }

  .ctv\\:w-48 {
    width: calc(var(--ctv-spacing) * 48);
  }

  .ctv\\:w-56 {
    width: calc(var(--ctv-spacing) * 56);
  }

  .ctv\\:w-60 {
    width: calc(var(--ctv-spacing) * 60);
  }

  .ctv\\:w-64 {
    width: calc(var(--ctv-spacing) * 64);
  }

  .ctv\\:w-\\[38px\\] {
    width: 38px;
  }

  .ctv\\:w-\\[76px\\] {
    width: 76px;
  }

  .ctv\\:w-\\[380px\\] {
    width: 380px;
  }

  .ctv\\:w-auto {
    width: auto;
  }

  .ctv\\:w-full {
    width: 100%;
  }

  .ctv\\:w-px {
    width: 1px;
  }

  .ctv\\:max-w-16 {
    max-width: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:max-w-24 {
    max-width: calc(var(--ctv-spacing) * 24);
  }

  .ctv\\:max-w-36 {
    max-width: calc(var(--ctv-spacing) * 36);
  }

  .ctv\\:max-w-40 {
    max-width: calc(var(--ctv-spacing) * 40);
  }

  .ctv\\:max-w-44 {
    max-width: calc(var(--ctv-spacing) * 44);
  }

  .ctv\\:max-w-\\[55\\%\\] {
    max-width: 55%;
  }

  .ctv\\:max-w-\\[60vw\\] {
    max-width: 60vw;
  }

  .ctv\\:max-w-\\[70vw\\] {
    max-width: 70vw;
  }

  .ctv\\:max-w-\\[85\\%\\] {
    max-width: 85%;
  }

  .ctv\\:max-w-\\[90px\\] {
    max-width: 90px;
  }

  .ctv\\:max-w-\\[92vw\\] {
    max-width: 92vw;
  }

  .ctv\\:max-w-\\[360px\\] {
    max-width: 360px;
  }

  .ctv\\:max-w-full {
    max-width: 100%;
  }

  .ctv\\:max-w-md {
    max-width: var(--ctv-container-md);
  }

  .ctv\\:min-w-0 {
    min-width: 0;
  }

  .ctv\\:min-w-2 {
    min-width: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:min-w-6 {
    min-width: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:min-w-8 {
    min-width: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:min-w-9 {
    min-width: calc(var(--ctv-spacing) * 9);
  }

  .ctv\\:min-w-12 {
    min-width: calc(var(--ctv-spacing) * 12);
  }

  .ctv\\:min-w-14 {
    min-width: calc(var(--ctv-spacing) * 14);
  }

  .ctv\\:min-w-16 {
    min-width: calc(var(--ctv-spacing) * 16);
  }

  .ctv\\:min-w-28 {
    min-width: calc(var(--ctv-spacing) * 28);
  }

  .ctv\\:min-w-32 {
    min-width: calc(var(--ctv-spacing) * 32);
  }

  .ctv\\:min-w-36 {
    min-width: calc(var(--ctv-spacing) * 36);
  }

  .ctv\\:min-w-48 {
    min-width: calc(var(--ctv-spacing) * 48);
  }

  .ctv\\:min-w-64 {
    min-width: calc(var(--ctv-spacing) * 64);
  }

  .ctv\\:min-w-\\[44px\\] {
    min-width: 44px;
  }

  .ctv\\:min-w-\\[60px\\] {
    min-width: 60px;
  }

  .ctv\\:min-w-\\[var\\(--reka-combobox-trigger-width\\)\\] {
    min-width: var(--reka-combobox-trigger-width);
  }

  .ctv\\:min-w-full {
    min-width: 100%;
  }

  .ctv\\:flex-1 {
    flex: 1;
  }

  .ctv\\:flex-\\[2\\] {
    flex: 2;
  }

  .ctv\\:flex-auto {
    flex: auto;
  }

  .ctv\\:flex-none {
    flex: none;
  }

  .ctv\\:shrink-0 {
    flex-shrink: 0;
  }

  .ctv\\:grow {
    flex-grow: 1;
  }

  .ctv\\:grow-0 {
    flex-grow: 0;
  }

  .ctv\\:-translate-x-1\\/2 {
    --tw-translate-x: calc(calc(1 / 2 * 100%) * -1);
    translate: var(--tw-translate-x) var(--tw-translate-y);
  }

  .ctv\\:-translate-y-1\\/2 {
    --tw-translate-y: calc(calc(1 / 2 * 100%) * -1);
    translate: var(--tw-translate-x) var(--tw-translate-y);
  }

  .ctv\\:rotate-2 {
    rotate: 2deg;
  }

  .ctv\\:rotate-45 {
    rotate: 45deg;
  }

  .ctv\\:rotate-90 {
    rotate: 90deg;
  }

  .ctv\\:animate-pulse {
    animation: var(--ctv-animate-pulse);
  }

  .ctv\\:animate-spin {
    animation: var(--ctv-animate-spin);
  }

  .ctv\\:cursor-\\[inherit\\] {
    cursor: inherit;
  }

  .ctv\\:cursor-col-resize {
    cursor: col-resize;
  }

  .ctv\\:cursor-copy {
    cursor: copy;
  }

  .ctv\\:cursor-crosshair {
    cursor: crosshair;
  }

  .ctv\\:cursor-default {
    cursor: default;
  }

  .ctv\\:cursor-ew-resize {
    cursor: ew-resize;
  }

  .ctv\\:cursor-grab {
    cursor: grab;
  }

  .ctv\\:cursor-grabbing {
    cursor: grabbing;
  }

  .ctv\\:cursor-move {
    cursor: move;
  }

  .ctv\\:cursor-none {
    cursor: none;
  }

  .ctv\\:cursor-not-allowed {
    cursor: not-allowed;
  }

  .ctv\\:cursor-ns-resize {
    cursor: ns-resize;
  }

  .ctv\\:cursor-pointer {
    cursor: pointer;
  }

  .ctv\\:cursor-text {
    cursor: text;
  }

  .ctv\\:cursor-zoom-out {
    cursor: zoom-out;
  }

  .ctv\\:touch-manipulation {
    touch-action: manipulation;
  }

  .ctv\\:touch-none {
    touch-action: none;
  }

  .ctv\\:resize-none {
    resize: none;
  }

  .ctv\\:resize-y {
    resize: vertical;
  }

  .ctv\\:list-none {
    list-style-type: none;
  }

  .ctv\\:appearance-none {
    appearance: none;
  }

  .ctv\\:grid-cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ctv\\:grid-cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ctv\\:grid-cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .ctv\\:grid-cols-\\[18px_minmax\\(0\\,1fr\\)\\] {
    grid-template-columns: 18px minmax(0, 1fr);
  }

  .ctv\\:grid-cols-\\[42px_1fr\\] {
    grid-template-columns: 42px 1fr;
  }

  .ctv\\:grid-cols-\\[60px_1fr\\] {
    grid-template-columns: 60px 1fr;
  }

  .ctv\\:grid-cols-\\[64px_1fr\\] {
    grid-template-columns: 64px 1fr;
  }

  .ctv\\:grid-cols-\\[64px_1fr_48px\\] {
    grid-template-columns: 64px 1fr 48px;
  }

  .ctv\\:grid-cols-\\[80px_1fr_36px\\] {
    grid-template-columns: 80px 1fr 36px;
  }

  .ctv\\:grid-cols-\\[88px_1fr\\] {
    grid-template-columns: 88px 1fr;
  }

  .ctv\\:grid-cols-\\[max-content_1fr\\] {
    grid-template-columns: max-content 1fr;
  }

  .ctv\\:grid-cols-\\[repeat\\(auto-fill\\,minmax\\(64px\\,1fr\\)\\)\\] {
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  }

  .ctv\\:grid-cols-\\[repeat\\(auto-fill\\,minmax\\(80px\\,1fr\\)\\)\\] {
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  }

  .ctv\\:grid-cols-\\[repeat\\(auto-fill\\,minmax\\(110px\\,1fr\\)\\)\\] {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  }

  .ctv\\:grid-cols-\\[repeat\\(auto-fill\\,minmax\\(min\\(160px\\,42vw\\)\\,1fr\\)\\)\\] {
    grid-template-columns: repeat(auto-fill, minmax(min(160px, 42vw), 1fr));
  }

  .ctv\\:grid-rows-\\[18px_minmax\\(0\\,1fr\\)\\] {
    grid-template-rows: 18px minmax(0, 1fr);
  }

  .ctv\\:flex-col {
    flex-direction: column;
  }

  .ctv\\:flex-row {
    flex-direction: row;
  }

  .ctv\\:flex-wrap {
    flex-wrap: wrap;
  }

  .ctv\\:items-baseline {
    align-items: baseline;
  }

  .ctv\\:items-center {
    align-items: center;
  }

  .ctv\\:items-end {
    align-items: flex-end;
  }

  .ctv\\:items-start {
    align-items: flex-start;
  }

  .ctv\\:items-stretch {
    align-items: stretch;
  }

  .ctv\\:justify-around {
    justify-content: space-around;
  }

  .ctv\\:justify-between {
    justify-content: space-between;
  }

  .ctv\\:justify-center {
    justify-content: center;
  }

  .ctv\\:justify-end {
    justify-content: flex-end;
  }

  .ctv\\:justify-evenly {
    justify-content: space-evenly;
  }

  .ctv\\:gap-0 {
    gap: 0;
  }

  .ctv\\:gap-0\\.5 {
    gap: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:gap-1 {
    gap: var(--ctv-spacing);
  }

  .ctv\\:gap-1\\.5 {
    gap: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:gap-2 {
    gap: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:gap-2\\.5 {
    gap: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:gap-3 {
    gap: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:gap-\\[3px\\] {
    gap: 3px;
  }

  .ctv\\:gap-px {
    gap: 1px;
  }

  .ctv\\:gap-x-2\\.5 {
    column-gap: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:gap-x-3 {
    column-gap: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:gap-y-1\\.5 {
    row-gap: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:gap-y-\\[3px\\] {
    row-gap: 3px;
  }

  .ctv\\:self-center {
    align-self: center;
  }

  .ctv\\:self-end {
    align-self: flex-end;
  }

  .ctv\\:self-start {
    align-self: flex-start;
  }

  .ctv\\:self-stretch {
    align-self: stretch;
  }

  .ctv\\:truncate {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .ctv\\:overflow-auto {
    overflow: auto;
  }

  .ctv\\:overflow-hidden {
    overflow: hidden;
  }

  .ctv\\:overflow-x-auto {
    overflow-x: auto;
  }

  .ctv\\:overflow-y-auto {
    overflow-y: auto;
  }

  .ctv\\:overflow-y-hidden {
    overflow-y: hidden;
  }

  .ctv\\:overflow-y-scroll {
    overflow-y: scroll;
  }

  .ctv\\:rounded {
    border-radius: .25rem;
  }

  .ctv\\:rounded-full {
    border-radius: 3.40282e38px;
  }

  .ctv\\:rounded-lg {
    border-radius: var(--ctv-radius-lg);
  }

  .ctv\\:rounded-md {
    border-radius: var(--ctv-radius-md);
  }

  .ctv\\:rounded-none {
    border-radius: 0;
  }

  .ctv\\:rounded-sm {
    border-radius: var(--ctv-radius-sm);
  }

  .ctv\\:rounded-xl {
    border-radius: var(--ctv-radius-xl);
  }

  .ctv\\:rounded-xs {
    border-radius: var(--ctv-radius-xs);
  }

  .ctv\\:rounded-t-xs {
    border-top-left-radius: var(--ctv-radius-xs);
    border-top-right-radius: var(--ctv-radius-xs);
  }

  .ctv\\:rounded-l-sm {
    border-top-left-radius: var(--ctv-radius-sm);
    border-bottom-left-radius: var(--ctv-radius-sm);
  }

  .ctv\\:rounded-r-sm {
    border-top-right-radius: var(--ctv-radius-sm);
    border-bottom-right-radius: var(--ctv-radius-sm);
  }

  .ctv\\:rounded-br-sm {
    border-bottom-right-radius: var(--ctv-radius-sm);
  }

  .ctv\\:border {
    border-style: var(--tw-border-style);
    border-width: 1px;
  }

  .ctv\\:border-0 {
    border-style: var(--tw-border-style);
    border-width: 0;
  }

  .ctv\\:border-2 {
    border-style: var(--tw-border-style);
    border-width: 2px;
  }

  .ctv\\:border-\\[2\\.5px\\] {
    border-style: var(--tw-border-style);
    border-width: 2.5px;
  }

  .ctv\\:border-x {
    border-inline-style: var(--tw-border-style);
    border-inline-width: 1px;
  }

  .ctv\\:border-y {
    border-block-style: var(--tw-border-style);
    border-block-width: 1px;
  }

  .ctv\\:border-y-2 {
    border-block-style: var(--tw-border-style);
    border-block-width: 2px;
  }

  .ctv\\:border-t {
    border-top-style: var(--tw-border-style);
    border-top-width: 1px;
  }

  .ctv\\:border-r {
    border-right-style: var(--tw-border-style);
    border-right-width: 1px;
  }

  .ctv\\:border-b {
    border-bottom-style: var(--tw-border-style);
    border-bottom-width: 1px;
  }

  .ctv\\:border-l {
    border-left-style: var(--tw-border-style);
    border-left-width: 1px;
  }

  .ctv\\:border-l-2 {
    border-left-style: var(--tw-border-style);
    border-left-width: 2px;
  }

  .ctv\\:border-dashed {
    --tw-border-style: dashed;
    border-style: dashed;
  }

  .ctv\\:border-none {
    --tw-border-style: none;
    border-style: none;
  }

  .ctv\\:border-solid {
    --tw-border-style: solid;
    border-style: solid;
  }

  .ctv\\:border-\\[\\#1c1c1c\\] {
    border-color: #1c1c1c;
  }

  .ctv\\:border-\\[\\#3d3d3d\\] {
    border-color: #3d3d3d;
  }

  .ctv\\:border-\\[\\#22c55e\\] {
    border-color: #22c55e;
  }

  .ctv\\:border-\\[\\#1473e6\\] {
    border-color: #1473e6;
  }

  .ctv\\:border-\\[\\#161616\\] {
    border-color: #161616;
  }

  .ctv\\:border-\\[\\#E93D82\\] {
    border-color: #e93d82;
  }

  .ctv\\:border-\\[\\#dc2626\\] {
    border-color: #dc2626;
  }

  .ctv\\:border-\\[rgb\\(200_130_255\\/0\\.4\\)\\] {
    border-color: #c882ff66;
  }

  .ctv\\:border-\\[rgb\\(233_61_130\\/0\\.3\\)\\] {
    border-color: #e93d824d;
  }

  .ctv\\:border-\\[rgb\\(233_61_130\\/0\\.4\\)\\] {
    border-color: #e93d8266;
  }

  .ctv\\:border-\\[rgb\\(233_61_130\\/0\\.5\\)\\] {
    border-color: #e93d8280;
  }

  .ctv\\:border-black\\/40 {
    border-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-black\\/40 {
      border-color: color-mix(in oklab, var(--ctv-color-black) 40%, transparent);
    }
  }

  .ctv\\:border-black\\/60 {
    border-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-black\\/60 {
      border-color: color-mix(in oklab, var(--ctv-color-black) 60%, transparent);
    }
  }

  .ctv\\:border-black\\/70 {
    border-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-black\\/70 {
      border-color: color-mix(in oklab, var(--ctv-color-black) 70%, transparent);
    }
  }

  .ctv\\:border-border-default {
    border-color: var(--border-default, #ffffff26);
  }

  .ctv\\:border-border-subtle {
    border-color: var(--border-subtle, #ffffff14);
  }

  .ctv\\:border-destructive-background, .ctv\\:border-destructive-background\\/30 {
    border-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-destructive-background\\/30 {
      border-color: color-mix(in oklab, var(--destructive-background, #c0392b) 30%, transparent);
    }
  }

  .ctv\\:border-destructive-background\\/40 {
    border-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-destructive-background\\/40 {
      border-color: color-mix(in oklab, var(--destructive-background, #c0392b) 40%, transparent);
    }
  }

  .ctv\\:border-destructive-background\\/50 {
    border-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-destructive-background\\/50 {
      border-color: color-mix(in oklab, var(--destructive-background, #c0392b) 50%, transparent);
    }
  }

  .ctv\\:border-destructive-background\\/55 {
    border-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-destructive-background\\/55 {
      border-color: color-mix(in oklab, var(--destructive-background, #c0392b) 55%, transparent);
    }
  }

  .ctv\\:border-interface-menu-stroke {
    border-color: var(--interface-menu-stroke, #ffffff1a);
  }

  .ctv\\:border-node-component-border {
    border-color: var(--node-component-border, #fff3);
  }

  .ctv\\:border-primary-background, .ctv\\:border-primary-background\\/25 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/25 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 25%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/30 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/30 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 30%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/40 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/40 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 40%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/45 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/45 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 45%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/50 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/50 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 50%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/60 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/60 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 60%, transparent);
    }
  }

  .ctv\\:border-primary-background\\/70 {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-primary-background\\/70 {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 70%, transparent);
    }
  }

  .ctv\\:border-red-400\\/90 {
    border-color: var(--ctv-color-red-400);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-red-400\\/90 {
      border-color: color-mix(in oklab, var(--ctv-color-red-400) 90%, transparent);
    }
  }

  .ctv\\:border-success-background\\/30 {
    border-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-success-background\\/30 {
      border-color: color-mix(in oklab, var(--success-background, #2e9e4f) 30%, transparent);
    }
  }

  .ctv\\:border-success-background\\/50 {
    border-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-success-background\\/50 {
      border-color: color-mix(in oklab, var(--success-background, #2e9e4f) 50%, transparent);
    }
  }

  .ctv\\:border-transparent {
    border-color: #0000;
  }

  .ctv\\:border-warning-background, .ctv\\:border-warning-background\\/25 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/25 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 25%, transparent);
    }
  }

  .ctv\\:border-warning-background\\/40 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/40 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 40%, transparent);
    }
  }

  .ctv\\:border-warning-background\\/50 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/50 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 50%, transparent);
    }
  }

  .ctv\\:border-warning-background\\/55 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/55 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 55%, transparent);
    }
  }

  .ctv\\:border-warning-background\\/60 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/60 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 60%, transparent);
    }
  }

  .ctv\\:border-warning-background\\/70 {
    border-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-warning-background\\/70 {
      border-color: color-mix(in oklab, var(--warning-background, #d39e00) 70%, transparent);
    }
  }

  .ctv\\:border-white, .ctv\\:border-white\\/5 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/5 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 5%, transparent);
    }
  }

  .ctv\\:border-white\\/10 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/10 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 10%, transparent);
    }
  }

  .ctv\\:border-white\\/15 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/15 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 15%, transparent);
    }
  }

  .ctv\\:border-white\\/20 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/20 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 20%, transparent);
    }
  }

  .ctv\\:border-white\\/25 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/25 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 25%, transparent);
    }
  }

  .ctv\\:border-white\\/30 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/30 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 30%, transparent);
    }
  }

  .ctv\\:border-white\\/80 {
    border-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-white\\/80 {
      border-color: color-mix(in oklab, var(--ctv-color-white) 80%, transparent);
    }
  }

  .ctv\\:border-b-transparent {
    border-bottom-color: #0000;
  }

  .ctv\\:border-b-warning-background\\/15 {
    border-bottom-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:border-b-warning-background\\/15 {
      border-bottom-color: color-mix(in oklab, var(--warning-background, #d39e00) 15%, transparent);
    }
  }

  .ctv\\:bg-\\[\\#1a1a1a\\] {
    background-color: #1a1a1a;
  }

  .ctv\\:bg-\\[\\#1e1e1e\\] {
    background-color: #1e1e1e;
  }

  .ctv\\:bg-\\[\\#2b2b2b\\] {
    background-color: #2b2b2b;
  }

  .ctv\\:bg-\\[\\#2f2f2f\\] {
    background-color: #2f2f2f;
  }

  .ctv\\:bg-\\[\\#3a3a3a\\] {
    background-color: #3a3a3a;
  }

  .ctv\\:bg-\\[\\#4a4a4a\\] {
    background-color: #4a4a4a;
  }

  .ctv\\:bg-\\[\\#1473e6\\]\\/25 {
    background-color: oklab(57.1321% -.0430447 -.18805 / .25);
  }

  .ctv\\:bg-\\[\\#39455a\\] {
    background-color: #39455a;
  }

  .ctv\\:bg-\\[\\#44546a\\] {
    background-color: #44546a;
  }

  .ctv\\:bg-\\[\\#141414\\] {
    background-color: #141414;
  }

  .ctv\\:bg-\\[\\#161616\\] {
    background-color: #161616;
  }

  .ctv\\:bg-\\[\\#202020\\] {
    background-color: #202020;
  }

  .ctv\\:bg-\\[\\#262626\\] {
    background-color: #262626;
  }

  .ctv\\:bg-\\[\\#333333\\] {
    background-color: #333;
  }

  .ctv\\:bg-\\[rgb\\(78_168_255\\/0\\.25\\)\\] {
    background-color: #4ea8ff40;
  }

  .ctv\\:bg-\\[rgb\\(100_220_200\\/0\\.25\\)\\] {
    background-color: #64dcc840;
  }

  .ctv\\:bg-\\[rgb\\(120_140_255\\/0\\.18\\)\\] {
    background-color: #788cff2e;
  }

  .ctv\\:bg-\\[rgb\\(120_140_255\\/0\\.25\\)\\] {
    background-color: #788cff40;
  }

  .ctv\\:bg-\\[rgb\\(120_200_120\\/0\\.25\\)\\] {
    background-color: #78c87840;
  }

  .ctv\\:bg-\\[rgb\\(200_130_255\\/0\\.25\\)\\] {
    background-color: #c882ff40;
  }

  .ctv\\:bg-\\[rgb\\(210_180_100\\/0\\.25\\)\\] {
    background-color: #d2b46440;
  }

  .ctv\\:bg-\\[rgb\\(233_61_130\\/0\\.2\\)\\] {
    background-color: #e93d8233;
  }

  .ctv\\:bg-\\[rgb\\(233_61_130\\/0\\.25\\)\\] {
    background-color: #e93d8240;
  }

  .ctv\\:bg-\\[rgb\\(255_100_100\\/0\\.22\\)\\] {
    background-color: #ff646438;
  }

  .ctv\\:bg-\\[rgb\\(255_140_200\\/0\\.25\\)\\] {
    background-color: #ff8cc840;
  }

  .ctv\\:bg-\\[rgb\\(255_140_200\\/0\\.85\\)\\] {
    background-color: #ff8cc8d9;
  }

  .ctv\\:bg-\\[rgb\\(255_171_64\\/0\\.18\\)\\] {
    background-color: #ffab402e;
  }

  .ctv\\:bg-\\[rgb\\(255_171_64\\/0\\.25\\)\\] {
    background-color: #ffab4040;
  }

  .ctv\\:bg-amber-400, .ctv\\:bg-amber-400\\/10 {
    background-color: var(--ctv-color-amber-400);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-amber-400\\/10 {
      background-color: color-mix(in oklab, var(--ctv-color-amber-400) 10%, transparent);
    }
  }

  .ctv\\:bg-base-background, .ctv\\:bg-base-background\\/40 {
    background-color: var(--base-background, #1e1e1e);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-base-background\\/40 {
      background-color: color-mix(in oklab, var(--base-background, #1e1e1e) 40%, transparent);
    }
  }

  .ctv\\:bg-base-background\\/95 {
    background-color: var(--base-background, #1e1e1e);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-base-background\\/95 {
      background-color: color-mix(in oklab, var(--base-background, #1e1e1e) 95%, transparent);
    }
  }

  .ctv\\:bg-base-foreground\\/5 {
    background-color: var(--base-foreground, #e0e0e0);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-base-foreground\\/5 {
      background-color: color-mix(in oklab, var(--base-foreground, #e0e0e0) 5%, transparent);
    }
  }

  .ctv\\:bg-base-foreground\\/10 {
    background-color: var(--base-foreground, #e0e0e0);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-base-foreground\\/10 {
      background-color: color-mix(in oklab, var(--base-foreground, #e0e0e0) 10%, transparent);
    }
  }

  .ctv\\:bg-base-foreground\\/\\[0\\.03\\] {
    background-color: var(--base-foreground, #e0e0e0);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-base-foreground\\/\\[0\\.03\\] {
      background-color: color-mix(in oklab, var(--base-foreground, #e0e0e0) 3%, transparent);
    }
  }

  .ctv\\:bg-black, .ctv\\:bg-black\\/20 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/20 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 20%, transparent);
    }
  }

  .ctv\\:bg-black\\/30 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/30 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 30%, transparent);
    }
  }

  .ctv\\:bg-black\\/40 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/40 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 40%, transparent);
    }
  }

  .ctv\\:bg-black\\/50 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/50 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 50%, transparent);
    }
  }

  .ctv\\:bg-black\\/55 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/55 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 55%, transparent);
    }
  }

  .ctv\\:bg-black\\/60 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/60 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 60%, transparent);
    }
  }

  .ctv\\:bg-black\\/65 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/65 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 65%, transparent);
    }
  }

  .ctv\\:bg-black\\/70 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/70 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 70%, transparent);
    }
  }

  .ctv\\:bg-black\\/80 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/80 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 80%, transparent);
    }
  }

  .ctv\\:bg-black\\/90 {
    background-color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-black\\/90 {
      background-color: color-mix(in oklab, var(--ctv-color-black) 90%, transparent);
    }
  }

  .ctv\\:bg-border-subtle {
    background-color: var(--border-subtle, #ffffff14);
  }

  .ctv\\:bg-destructive-background, .ctv\\:bg-destructive-background\\/10 {
    background-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-destructive-background\\/10 {
      background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 10%, transparent);
    }
  }

  .ctv\\:bg-destructive-background\\/15 {
    background-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-destructive-background\\/15 {
      background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 15%, transparent);
    }
  }

  .ctv\\:bg-destructive-background\\/20 {
    background-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-destructive-background\\/20 {
      background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 20%, transparent);
    }
  }

  .ctv\\:bg-destructive-background\\/30 {
    background-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-destructive-background\\/30 {
      background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 30%, transparent);
    }
  }

  .ctv\\:bg-destructive-background\\/70 {
    background-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-destructive-background\\/70 {
      background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 70%, transparent);
    }
  }

  .ctv\\:bg-emerald-400 {
    background-color: var(--ctv-color-emerald-400);
  }

  .ctv\\:bg-emerald-500\\/10 {
    background-color: var(--ctv-color-emerald-500);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-emerald-500\\/10 {
      background-color: color-mix(in oklab, var(--ctv-color-emerald-500) 10%, transparent);
    }
  }

  .ctv\\:bg-interface-menu-component-surface-hovered {
    background-color: var(--interface-menu-component-surface-hovered, #ffffff14);
  }

  .ctv\\:bg-interface-menu-component-surface-selected {
    background-color: var(--interface-menu-component-surface-selected, #4ea8ff2e);
  }

  .ctv\\:bg-interface-menu-stroke {
    background-color: var(--interface-menu-stroke, #ffffff1a);
  }

  .ctv\\:bg-interface-menu-surface, .ctv\\:bg-interface-menu-surface\\/85 {
    background-color: var(--interface-menu-surface, #232323);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-interface-menu-surface\\/85 {
      background-color: color-mix(in oklab, var(--interface-menu-surface, #232323) 85%, transparent);
    }
  }

  .ctv\\:bg-interface-panel-surface {
    background-color: var(--interface-panel-surface, #1e1e1e);
  }

  .ctv\\:bg-muted-foreground, .ctv\\:bg-muted-foreground\\/40 {
    background-color: var(--muted-foreground, #888);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-muted-foreground\\/40 {
      background-color: color-mix(in oklab, var(--muted-foreground, #888) 40%, transparent);
    }
  }

  .ctv\\:bg-primary-background, .ctv\\:bg-primary-background\\/5 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/5 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 5%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/10 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/10 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 10%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/15 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/15 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 15%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/20 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/20 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 20%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/25 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/25 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 25%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/30 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/30 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 30%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/70 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/70 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 70%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/85 {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/85 {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 85%, transparent);
    }
  }

  .ctv\\:bg-primary-background\\/\\[0\\.06\\] {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-primary-background\\/\\[0\\.06\\] {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 6%, transparent);
    }
  }

  .ctv\\:bg-red-400\\/10 {
    background-color: var(--ctv-color-red-400);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-red-400\\/10 {
      background-color: color-mix(in oklab, var(--ctv-color-red-400) 10%, transparent);
    }
  }

  .ctv\\:bg-secondary-background {
    background-color: var(--secondary-background, #ffffff0f);
  }

  .ctv\\:bg-secondary-background-hover {
    background-color: var(--secondary-background-hover, #ffffff1a);
  }

  .ctv\\:bg-secondary-background-selected {
    background-color: var(--secondary-background-selected, #4ea8ff33);
  }

  .ctv\\:bg-secondary-background\\/40 {
    background-color: var(--secondary-background, #ffffff0f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-secondary-background\\/40 {
      background-color: color-mix(in oklab, var(--secondary-background, #ffffff0f) 40%, transparent);
    }
  }

  .ctv\\:bg-secondary-background\\/80 {
    background-color: var(--secondary-background, #ffffff0f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-secondary-background\\/80 {
      background-color: color-mix(in oklab, var(--secondary-background, #ffffff0f) 80%, transparent);
    }
  }

  .ctv\\:bg-success-background, .ctv\\:bg-success-background\\/5 {
    background-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-success-background\\/5 {
      background-color: color-mix(in oklab, var(--success-background, #2e9e4f) 5%, transparent);
    }
  }

  .ctv\\:bg-success-background\\/10 {
    background-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-success-background\\/10 {
      background-color: color-mix(in oklab, var(--success-background, #2e9e4f) 10%, transparent);
    }
  }

  .ctv\\:bg-success-background\\/15 {
    background-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-success-background\\/15 {
      background-color: color-mix(in oklab, var(--success-background, #2e9e4f) 15%, transparent);
    }
  }

  .ctv\\:bg-success-background\\/20 {
    background-color: var(--success-background, #2e9e4f);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-success-background\\/20 {
      background-color: color-mix(in oklab, var(--success-background, #2e9e4f) 20%, transparent);
    }
  }

  .ctv\\:bg-transparent {
    background-color: #0000;
  }

  .ctv\\:bg-warning-background, .ctv\\:bg-warning-background\\/5 {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/5 {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 5%, transparent);
    }
  }

  .ctv\\:bg-warning-background\\/10 {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/10 {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 10%, transparent);
    }
  }

  .ctv\\:bg-warning-background\\/15 {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/15 {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 15%, transparent);
    }
  }

  .ctv\\:bg-warning-background\\/30 {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/30 {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 30%, transparent);
    }
  }

  .ctv\\:bg-warning-background\\/80 {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/80 {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 80%, transparent);
    }
  }

  .ctv\\:bg-warning-background\\/\\[0\\.03\\] {
    background-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-warning-background\\/\\[0\\.03\\] {
      background-color: color-mix(in oklab, var(--warning-background, #d39e00) 3%, transparent);
    }
  }

  .ctv\\:bg-white, .ctv\\:bg-white\\/5 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/5 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 5%, transparent);
    }
  }

  .ctv\\:bg-white\\/10 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/10 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 10%, transparent);
    }
  }

  .ctv\\:bg-white\\/15 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/15 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 15%, transparent);
    }
  }

  .ctv\\:bg-white\\/20 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/20 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 20%, transparent);
    }
  }

  .ctv\\:bg-white\\/30 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/30 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 30%, transparent);
    }
  }

  .ctv\\:bg-white\\/70 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/70 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 70%, transparent);
    }
  }

  .ctv\\:bg-white\\/80 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/80 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 80%, transparent);
    }
  }

  .ctv\\:bg-white\\/85 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/85 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 85%, transparent);
    }
  }

  .ctv\\:bg-white\\/90 {
    background-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:bg-white\\/90 {
      background-color: color-mix(in oklab, var(--ctv-color-white) 90%, transparent);
    }
  }

  .ctv\\:bg-linear-to-b {
    --tw-gradient-position: to bottom;
  }

  @supports (background-image: linear-gradient(in lab, red, red)) {
    .ctv\\:bg-linear-to-b {
      --tw-gradient-position: to bottom in oklab;
    }
  }

  .ctv\\:bg-linear-to-b {
    background-image: linear-gradient(var(--tw-gradient-stops));
  }

  .ctv\\:bg-linear-to-r {
    --tw-gradient-position: to right;
  }

  @supports (background-image: linear-gradient(in lab, red, red)) {
    .ctv\\:bg-linear-to-r {
      --tw-gradient-position: to right in oklab;
    }
  }

  .ctv\\:bg-linear-to-r {
    background-image: linear-gradient(var(--tw-gradient-stops));
  }

  .ctv\\:from-primary-background\\/85 {
    --tw-gradient-from: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:from-primary-background\\/85 {
      --tw-gradient-from: color-mix(in oklab, var(--primary-background, #4ea8ff99) 85%, transparent);
    }
  }

  .ctv\\:from-primary-background\\/85 {
    --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
  }

  .ctv\\:from-transparent {
    --tw-gradient-from: transparent;
    --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
  }

  .ctv\\:to-black\\/75 {
    --tw-gradient-to: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:to-black\\/75 {
      --tw-gradient-to: color-mix(in oklab, var(--ctv-color-black) 75%, transparent);
    }
  }

  .ctv\\:to-black\\/75 {
    --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
  }

  .ctv\\:to-primary-background-hover\\/85 {
    --tw-gradient-to: var(--primary-background-hover, #4ea8ffbf);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:to-primary-background-hover\\/85 {
      --tw-gradient-to: color-mix(in oklab, var(--primary-background-hover, #4ea8ffbf) 85%, transparent);
    }
  }

  .ctv\\:to-primary-background-hover\\/85 {
    --tw-gradient-stops: var(--tw-gradient-via-stops, var(--tw-gradient-position), var(--tw-gradient-from) var(--tw-gradient-from-position), var(--tw-gradient-to) var(--tw-gradient-to-position));
  }

  .ctv\\:object-contain {
    object-fit: contain;
  }

  .ctv\\:object-cover {
    object-fit: cover;
  }

  .ctv\\:p-0 {
    padding: 0;
  }

  .ctv\\:p-0\\.5 {
    padding: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:p-1 {
    padding: var(--ctv-spacing);
  }

  .ctv\\:p-1\\.5 {
    padding: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:p-2 {
    padding: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:p-2\\.5 {
    padding: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:p-3 {
    padding: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:p-3\\.5 {
    padding: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:p-4 {
    padding: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:p-6 {
    padding: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:p-px {
    padding: 1px;
  }

  .ctv\\:px-0 {
    padding-inline: 0;
  }

  .ctv\\:px-0\\.5 {
    padding-inline: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:px-1 {
    padding-inline: var(--ctv-spacing);
  }

  .ctv\\:px-1\\.5 {
    padding-inline: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:px-2 {
    padding-inline: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:px-2\\.5 {
    padding-inline: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:px-3 {
    padding-inline: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:px-3\\.5 {
    padding-inline: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:px-4 {
    padding-inline: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:px-6 {
    padding-inline: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:px-\\[3px\\] {
    padding-inline: 3px;
  }

  .ctv\\:px-\\[5px\\] {
    padding-inline: 5px;
  }

  .ctv\\:py-0 {
    padding-block: 0;
  }

  .ctv\\:py-0\\.5 {
    padding-block: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:py-1 {
    padding-block: var(--ctv-spacing);
  }

  .ctv\\:py-1\\.5 {
    padding-block: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:py-2 {
    padding-block: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:py-2\\.5 {
    padding-block: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:py-3 {
    padding-block: calc(var(--ctv-spacing) * 3);
  }

  .ctv\\:py-4 {
    padding-block: calc(var(--ctv-spacing) * 4);
  }

  .ctv\\:py-5 {
    padding-block: calc(var(--ctv-spacing) * 5);
  }

  .ctv\\:py-6 {
    padding-block: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:py-8 {
    padding-block: calc(var(--ctv-spacing) * 8);
  }

  .ctv\\:py-\\[3px\\] {
    padding-block: 3px;
  }

  .ctv\\:py-\\[5px\\] {
    padding-block: 5px;
  }

  .ctv\\:py-px {
    padding-block: 1px;
  }

  .ctv\\:pt-0\\.5 {
    padding-top: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:pt-1 {
    padding-top: var(--ctv-spacing);
  }

  .ctv\\:pt-1\\.5 {
    padding-top: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:pt-2 {
    padding-top: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:pt-2\\.5 {
    padding-top: calc(var(--ctv-spacing) * 2.5);
  }

  .ctv\\:pt-3\\.5 {
    padding-top: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:pr-0\\.5 {
    padding-right: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:pr-1 {
    padding-right: var(--ctv-spacing);
  }

  .ctv\\:pr-1\\.5 {
    padding-right: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:pr-2 {
    padding-right: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:pb-0\\.5 {
    padding-bottom: calc(var(--ctv-spacing) * .5);
  }

  .ctv\\:pb-1 {
    padding-bottom: var(--ctv-spacing);
  }

  .ctv\\:pb-2 {
    padding-bottom: calc(var(--ctv-spacing) * 2);
  }

  .ctv\\:pb-3\\.5 {
    padding-bottom: calc(var(--ctv-spacing) * 3.5);
  }

  .ctv\\:pb-6 {
    padding-bottom: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:pl-1\\.5 {
    padding-left: calc(var(--ctv-spacing) * 1.5);
  }

  .ctv\\:pl-6 {
    padding-left: calc(var(--ctv-spacing) * 6);
  }

  .ctv\\:pl-7 {
    padding-left: calc(var(--ctv-spacing) * 7);
  }

  .ctv\\:text-center {
    text-align: center;
  }

  .ctv\\:text-left {
    text-align: left;
  }

  .ctv\\:text-right {
    text-align: right;
  }

  .ctv\\:align-\\[-2px\\] {
    vertical-align: -2px;
  }

  .ctv\\:align-middle {
    vertical-align: middle;
  }

  .ctv\\:\\[font-family\\:inherit\\] {
    font-family: inherit;
  }

  .ctv\\:font-mono {
    font-family: var(--ctv-font-mono);
  }

  .ctv\\:text-2xl {
    font-size: var(--ctv-text-2xl);
    line-height: var(--tw-leading, var(--ctv-text-2xl--line-height));
  }

  .ctv\\:text-2xs {
    font-size: var(--ctv-text-2xs);
    line-height: var(--tw-leading, var(--ctv-text-2xs--line-height));
  }

  .ctv\\:text-3xs {
    font-size: var(--ctv-text-3xs);
    line-height: var(--tw-leading, var(--ctv-text-3xs--line-height));
  }

  .ctv\\:text-lg {
    font-size: var(--ctv-text-lg);
    line-height: var(--tw-leading, var(--ctv-text-lg--line-height));
  }

  .ctv\\:text-sm {
    font-size: var(--ctv-text-sm);
    line-height: var(--tw-leading, var(--ctv-text-sm--line-height));
  }

  .ctv\\:text-xs {
    font-size: var(--ctv-text-xs);
    line-height: var(--tw-leading, var(--ctv-text-xs--line-height));
  }

  .ctv\\:text-\\[8px\\] {
    font-size: 8px;
  }

  .ctv\\:text-\\[9px\\] {
    font-size: 9px;
  }

  .ctv\\:text-\\[10px\\] {
    font-size: 10px;
  }

  .ctv\\:text-\\[11px\\] {
    font-size: 11px;
  }

  .ctv\\:text-\\[13px\\] {
    font-size: 13px;
  }

  .ctv\\:text-\\[22px\\] {
    font-size: 22px;
  }

  .ctv\\:text-\\[24px\\] {
    font-size: 24px;
  }

  .ctv\\:text-\\[28px\\] {
    font-size: 28px;
  }

  .ctv\\:text-\\[32px\\] {
    font-size: 32px;
  }

  .ctv\\:leading-\\[1\\.3\\] {
    --tw-leading: 1.3;
    line-height: 1.3;
  }

  .ctv\\:leading-none {
    --tw-leading: 1;
    line-height: 1;
  }

  .ctv\\:leading-relaxed {
    --tw-leading: var(--ctv-leading-relaxed);
    line-height: var(--ctv-leading-relaxed);
  }

  .ctv\\:leading-snug {
    --tw-leading: var(--ctv-leading-snug);
    line-height: var(--ctv-leading-snug);
  }

  .ctv\\:leading-tight {
    --tw-leading: var(--ctv-leading-tight);
    line-height: var(--ctv-leading-tight);
  }

  .ctv\\:font-bold {
    --tw-font-weight: var(--ctv-font-weight-bold);
    font-weight: var(--ctv-font-weight-bold);
  }

  .ctv\\:font-medium {
    --tw-font-weight: var(--ctv-font-weight-medium);
    font-weight: var(--ctv-font-weight-medium);
  }

  .ctv\\:font-semibold {
    --tw-font-weight: var(--ctv-font-weight-semibold);
    font-weight: var(--ctv-font-weight-semibold);
  }

  .ctv\\:tracking-normal {
    --tw-tracking: var(--ctv-tracking-normal);
    letter-spacing: var(--ctv-tracking-normal);
  }

  .ctv\\:tracking-wide {
    --tw-tracking: var(--ctv-tracking-wide);
    letter-spacing: var(--ctv-tracking-wide);
  }

  .ctv\\:tracking-wider {
    --tw-tracking: var(--ctv-tracking-wider);
    letter-spacing: var(--ctv-tracking-wider);
  }

  .ctv\\:break-words {
    overflow-wrap: break-word;
  }

  .ctv\\:break-all {
    word-break: break-all;
  }

  .ctv\\:text-ellipsis {
    text-overflow: ellipsis;
  }

  .ctv\\:whitespace-normal {
    white-space: normal;
  }

  .ctv\\:whitespace-nowrap {
    white-space: nowrap;
  }

  .ctv\\:whitespace-pre-line {
    white-space: pre-line;
  }

  .ctv\\:whitespace-pre-wrap {
    white-space: pre-wrap;
  }

  .ctv\\:text-\\[\\#00FFD0\\] {
    color: #00ffd0;
  }

  .ctv\\:text-\\[\\#7a7a7a\\] {
    color: #7a7a7a;
  }

  .ctv\\:text-\\[\\#9b9b9b\\] {
    color: #9b9b9b;
  }

  .ctv\\:text-\\[\\#9b9b9b\\]\\/60 {
    color: oklab(68.9488% -2.98023e-8 5.96046e-8 / .6);
  }

  .ctv\\:text-\\[\\#9b9b9b\\]\\/70 {
    color: oklab(68.9488% -2.98023e-8 5.96046e-8 / .7);
  }

  .ctv\\:text-\\[\\#9dd0ff\\] {
    color: #9dd0ff;
  }

  .ctv\\:text-\\[\\#1473e6\\] {
    color: #1473e6;
  }

  .ctv\\:text-\\[\\#E93D82\\] {
    color: #e93d82;
  }

  .ctv\\:text-\\[\\#FFB800\\] {
    color: #ffb800;
  }

  .ctv\\:text-\\[\\#a5f0e0\\] {
    color: #a5f0e0;
  }

  .ctv\\:text-\\[\\#b5e3a5\\] {
    color: #b5e3a5;
  }

  .ctv\\:text-\\[\\#b8c4ff\\] {
    color: #b8c4ff;
  }

  .ctv\\:text-\\[\\#d6d6d6\\] {
    color: #d6d6d6;
  }

  .ctv\\:text-\\[\\#d8b0ff\\] {
    color: #d8b0ff;
  }

  .ctv\\:text-\\[\\#e8e8e8\\] {
    color: #e8e8e8;
  }

  .ctv\\:text-\\[\\#ecd9a0\\] {
    color: #ecd9a0;
  }

  .ctv\\:text-\\[\\#f0f0f0\\] {
    color: #f0f0f0;
  }

  .ctv\\:text-\\[\\#ffb0b0\\] {
    color: #ffb0b0;
  }

  .ctv\\:text-\\[\\#ffb0d8\\] {
    color: #ffb0d8;
  }

  .ctv\\:text-\\[\\#ffd089\\] {
    color: #ffd089;
  }

  .ctv\\:text-amber-400 {
    color: var(--ctv-color-amber-400);
  }

  .ctv\\:text-base-foreground, .ctv\\:text-base-foreground\\/80 {
    color: var(--base-foreground, #e0e0e0);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-base-foreground\\/80 {
      color: color-mix(in oklab, var(--base-foreground, #e0e0e0) 80%, transparent);
    }
  }

  .ctv\\:text-black, .ctv\\:text-black\\/80 {
    color: var(--ctv-color-black);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-black\\/80 {
      color: color-mix(in oklab, var(--ctv-color-black) 80%, transparent);
    }
  }

  .ctv\\:text-destructive-background {
    color: var(--destructive-background, #c0392b);
  }

  .ctv\\:text-emerald-400 {
    color: var(--ctv-color-emerald-400);
  }

  .ctv\\:text-gray-600 {
    color: var(--ctv-color-gray-600);
  }

  .ctv\\:text-inherit {
    color: inherit;
  }

  .ctv\\:text-muted-foreground, .ctv\\:text-muted-foreground\\/60 {
    color: var(--muted-foreground, #888);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-muted-foreground\\/60 {
      color: color-mix(in oklab, var(--muted-foreground, #888) 60%, transparent);
    }
  }

  .ctv\\:text-muted-foreground\\/70 {
    color: var(--muted-foreground, #888);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-muted-foreground\\/70 {
      color: color-mix(in oklab, var(--muted-foreground, #888) 70%, transparent);
    }
  }

  .ctv\\:text-muted-foreground\\/80 {
    color: var(--muted-foreground, #888);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-muted-foreground\\/80 {
      color: color-mix(in oklab, var(--muted-foreground, #888) 80%, transparent);
    }
  }

  .ctv\\:text-neutral-400 {
    color: var(--ctv-color-neutral-400);
  }

  .ctv\\:text-primary-background {
    color: var(--primary-background, #4ea8ff99);
  }

  .ctv\\:text-red-300 {
    color: var(--ctv-color-red-300);
  }

  .ctv\\:text-red-400 {
    color: var(--ctv-color-red-400);
  }

  .ctv\\:text-secondary-foreground {
    color: var(--secondary-foreground, var(--base-foreground, #e0e0e0));
  }

  .ctv\\:text-success-background {
    color: var(--success-background, #2e9e4f);
  }

  .ctv\\:text-warning-background, .ctv\\:text-warning-background\\/70 {
    color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-warning-background\\/70 {
      color: color-mix(in oklab, var(--warning-background, #d39e00) 70%, transparent);
    }
  }

  .ctv\\:text-warning-background\\/75 {
    color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-warning-background\\/75 {
      color: color-mix(in oklab, var(--warning-background, #d39e00) 75%, transparent);
    }
  }

  .ctv\\:text-white, .ctv\\:text-white\\/30 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/30 {
      color: color-mix(in oklab, var(--ctv-color-white) 30%, transparent);
    }
  }

  .ctv\\:text-white\\/35 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/35 {
      color: color-mix(in oklab, var(--ctv-color-white) 35%, transparent);
    }
  }

  .ctv\\:text-white\\/40 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/40 {
      color: color-mix(in oklab, var(--ctv-color-white) 40%, transparent);
    }
  }

  .ctv\\:text-white\\/50 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/50 {
      color: color-mix(in oklab, var(--ctv-color-white) 50%, transparent);
    }
  }

  .ctv\\:text-white\\/60 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/60 {
      color: color-mix(in oklab, var(--ctv-color-white) 60%, transparent);
    }
  }

  .ctv\\:text-white\\/70 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/70 {
      color: color-mix(in oklab, var(--ctv-color-white) 70%, transparent);
    }
  }

  .ctv\\:text-white\\/80 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/80 {
      color: color-mix(in oklab, var(--ctv-color-white) 80%, transparent);
    }
  }

  .ctv\\:text-white\\/85 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/85 {
      color: color-mix(in oklab, var(--ctv-color-white) 85%, transparent);
    }
  }

  .ctv\\:text-white\\/90 {
    color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:text-white\\/90 {
      color: color-mix(in oklab, var(--ctv-color-white) 90%, transparent);
    }
  }

  .ctv\\:normal-case {
    text-transform: none;
  }

  .ctv\\:uppercase {
    text-transform: uppercase;
  }

  .ctv\\:italic {
    font-style: italic;
  }

  .ctv\\:tabular-nums {
    --tw-numeric-spacing: tabular-nums;
    font-variant-numeric: var(--tw-ordinal, ) var(--tw-slashed-zero, ) var(--tw-numeric-figure, ) var(--tw-numeric-spacing, ) var(--tw-numeric-fraction, );
  }

  .ctv\\:line-through {
    text-decoration-line: line-through;
  }

  .ctv\\:underline {
    text-decoration-line: underline;
  }

  .ctv\\:accent-\\[\\#1473e6\\] {
    accent-color: #1473e6;
  }

  .ctv\\:accent-\\[var\\(--ctv-primary-background\\,\\#4ea8ff\\)\\] {
    accent-color: var(--ctv-primary-background, #4ea8ff);
  }

  .ctv\\:accent-\\[var\\(--primary-background\\)\\] {
    accent-color: var(--primary-background);
  }

  .ctv\\:accent-primary-background {
    accent-color: var(--primary-background, #4ea8ff99);
  }

  .ctv\\:opacity-0 {
    opacity: 0;
  }

  .ctv\\:opacity-20 {
    opacity: .2;
  }

  .ctv\\:opacity-30 {
    opacity: .3;
  }

  .ctv\\:opacity-40 {
    opacity: .4;
  }

  .ctv\\:opacity-50 {
    opacity: .5;
  }

  .ctv\\:opacity-55 {
    opacity: .55;
  }

  .ctv\\:opacity-60 {
    opacity: .6;
  }

  .ctv\\:opacity-70 {
    opacity: .7;
  }

  .ctv\\:opacity-75 {
    opacity: .75;
  }

  .ctv\\:opacity-80 {
    opacity: .8;
  }

  .ctv\\:opacity-100 {
    opacity: 1;
  }

  .ctv\\:mix-blend-multiply {
    mix-blend-mode: multiply;
  }

  .ctv\\:shadow {
    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_0_1px_rgb\\(255_255_255\\/0\\.8\\)\\] {
    --tw-shadow: 0 0 0 1px var(--tw-shadow-color, #fffc);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_0_1px_var\\(--primary-background\\)\\] {
    --tw-shadow: 0 0 0 1px var(--tw-shadow-color, var(--primary-background));
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_0_9999px_rgb\\(0_0_0\\/0\\.5\\)\\] {
    --tw-shadow: 0 0 0 9999px var(--tw-shadow-color, #00000080);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_2px_rgb\\(0_0_0\\/0\\.7\\)\\] {
    --tw-shadow: 0 0 2px var(--tw-shadow-color, #000000b3);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_3px_rgb\\(255_255_255\\/0\\.8\\)\\] {
    --tw-shadow: 0 0 3px var(--tw-shadow-color, #fffc);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_4px_rgb\\(0_0_0\\/0\\.6\\)\\] {
    --tw-shadow: 0 0 4px var(--tw-shadow-color, #0009);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_0_8px_var\\(--primary-background\\)\\] {
    --tw-shadow: 0 0 8px var(--tw-shadow-color, var(--primary-background));
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_1px_3px_rgb\\(0_0_0\\/0\\.5\\)\\] {
    --tw-shadow: 0 1px 3px var(--tw-shadow-color, #00000080);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_1px_4px_rgb\\(0_0_0\\/0\\.5\\)\\] {
    --tw-shadow: 0 1px 4px var(--tw-shadow-color, #00000080);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_8px_24px_rgb\\(0_0_0\\/0\\.6\\)\\] {
    --tw-shadow: 0 8px 24px var(--tw-shadow-color, #0009);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_8px_40px_rgb\\(0_0_0\\/0\\.6\\)\\] {
    --tw-shadow: 0 8px 40px var(--tw-shadow-color, #0009);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[0_16px_48px_rgb\\(0_0_0\\/0\\.5\\)\\] {
    --tw-shadow: 0 16px 48px var(--tw-shadow-color, #00000080);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[inset_0_-2px_0_0_\\#1473e6\\] {
    --tw-shadow: inset 0 -2px 0 0 var(--tw-shadow-color, #1473e6);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[inset_0_0_0_1px_\\#0d0d0d\\] {
    --tw-shadow: inset 0 0 0 1px var(--tw-shadow-color, #0d0d0d);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-\\[inset_0_2px_0_0_\\#1473e6\\] {
    --tw-shadow: inset 0 2px 0 0 var(--tw-shadow-color, #1473e6);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-lg {
    --tw-shadow: 0 10px 15px -3px var(--tw-shadow-color, #0000001a), 0 4px 6px -4px var(--tw-shadow-color, #0000001a);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-md {
    --tw-shadow: 0 4px 6px -1px var(--tw-shadow-color, #0000001a), 0 2px 4px -2px var(--tw-shadow-color, #0000001a);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:shadow-sm {
    --tw-shadow: 0 1px 3px 0 var(--tw-shadow-color, #0000001a), 0 1px 2px -1px var(--tw-shadow-color, #0000001a);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:ring-1 {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:ring-2 {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:ring-\\[5px\\] {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(5px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:ring-node-component-border {
    --tw-ring-color: var(--node-component-border, #fff3);
  }

  .ctv\\:ring-primary-background, .ctv\\:ring-primary-background\\/50 {
    --tw-ring-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:ring-primary-background\\/50 {
      --tw-ring-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 50%, transparent);
    }
  }

  .ctv\\:ring-warning-background {
    --tw-ring-color: var(--warning-background, #d39e00);
  }

  .ctv\\:outline, .ctv\\:outline-1 {
    outline-style: var(--tw-outline-style);
    outline-width: 1px;
  }

  .ctv\\:outline-2 {
    outline-style: var(--tw-outline-style);
    outline-width: 2px;
  }

  .ctv\\:-outline-offset-1 {
    outline-offset: calc(1px * -1);
  }

  .ctv\\:-outline-offset-2 {
    outline-offset: calc(2px * -1);
  }

  .ctv\\:outline-destructive-background\\/55 {
    outline-color: var(--destructive-background, #c0392b);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:outline-destructive-background\\/55 {
      outline-color: color-mix(in oklab, var(--destructive-background, #c0392b) 55%, transparent);
    }
  }

  .ctv\\:outline-primary-background\\/70 {
    outline-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:outline-primary-background\\/70 {
      outline-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 70%, transparent);
    }
  }

  .ctv\\:outline-success-background {
    outline-color: var(--success-background, #2e9e4f);
  }

  .ctv\\:outline-warning-background\\/50 {
    outline-color: var(--warning-background, #d39e00);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:outline-warning-background\\/50 {
      outline-color: color-mix(in oklab, var(--warning-background, #d39e00) 50%, transparent);
    }
  }

  .ctv\\:outline-white\\/70 {
    outline-color: var(--ctv-color-white);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:outline-white\\/70 {
      outline-color: color-mix(in oklab, var(--ctv-color-white) 70%, transparent);
    }
  }

  .ctv\\:backdrop-blur {
    --tw-backdrop-blur: blur(8px);
    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
  }

  .ctv\\:backdrop-blur-\\[2px\\] {
    --tw-backdrop-blur: blur(2px);
    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
  }

  .ctv\\:backdrop-blur-sm {
    --tw-backdrop-blur: blur(var(--ctv-blur-sm));
    -webkit-backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
    backdrop-filter: var(--tw-backdrop-blur, ) var(--tw-backdrop-brightness, ) var(--tw-backdrop-contrast, ) var(--tw-backdrop-grayscale, ) var(--tw-backdrop-hue-rotate, ) var(--tw-backdrop-invert, ) var(--tw-backdrop-opacity, ) var(--tw-backdrop-saturate, ) var(--tw-backdrop-sepia, );
  }

  .ctv\\:transition-\\[width\\] {
    transition-property: width;
    transition-timing-function: var(--tw-ease, var(--ctv-default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--ctv-default-transition-duration));
  }

  .ctv\\:transition-all {
    transition-property: all;
    transition-timing-function: var(--tw-ease, var(--ctv-default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--ctv-default-transition-duration));
  }

  .ctv\\:transition-colors {
    transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to;
    transition-timing-function: var(--tw-ease, var(--ctv-default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--ctv-default-transition-duration));
  }

  .ctv\\:transition-opacity {
    transition-property: opacity;
    transition-timing-function: var(--tw-ease, var(--ctv-default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--ctv-default-transition-duration));
  }

  .ctv\\:transition-transform {
    transition-property: transform, translate, scale, rotate;
    transition-timing-function: var(--tw-ease, var(--ctv-default-transition-timing-function));
    transition-duration: var(--tw-duration, var(--ctv-default-transition-duration));
  }

  .ctv\\:duration-150 {
    --tw-duration: .15s;
    transition-duration: .15s;
  }

  .ctv\\:duration-200 {
    --tw-duration: .2s;
    transition-duration: .2s;
  }

  .ctv\\:ease-in {
    --tw-ease: var(--ctv-ease-in);
    transition-timing-function: var(--ctv-ease-in);
  }

  .ctv\\:ease-in-out {
    --tw-ease: var(--ctv-ease-in-out);
    transition-timing-function: var(--ctv-ease-in-out);
  }

  .ctv\\:ease-out {
    --tw-ease: var(--ctv-ease-out);
    transition-timing-function: var(--ctv-ease-out);
  }

  .ctv\\:will-change-transform {
    will-change: transform;
  }

  .ctv\\:outline-none {
    --tw-outline-style: none;
    outline-style: none;
  }

  .ctv\\:select-none {
    -webkit-user-select: none;
    user-select: none;
  }

  .ctv\\:select-text {
    -webkit-user-select: text;
    user-select: text;
  }

  .ctv\\:\\[-webkit-box-orient\\:vertical\\] {
    -webkit-box-orient: vertical;
  }

  .ctv\\:\\[-webkit-line-clamp\\:5\\] {
    -webkit-line-clamp: 5;
  }

  .ctv\\:ring-inset {
    --tw-ring-inset: inset;
  }

  @media (hover: hover) {
    .ctv\\:group-hover\\:opacity-100:is(:where(.ctv\\:group):hover *) {
      opacity: 1;
    }
  }

  .ctv\\:placeholder\\:text-muted-foreground::placeholder {
    color: var(--muted-foreground, #888);
  }

  @media (hover: hover) {
    .ctv\\:hover\\:border-\\[\\#E93D82\\]:hover {
      border-color: #e93d82;
    }

    .ctv\\:hover\\:border-border-default:hover {
      border-color: var(--border-default, #ffffff26);
    }

    .ctv\\:hover\\:border-border-subtle:hover {
      border-color: var(--border-subtle, #ffffff14);
    }

    .ctv\\:hover\\:border-destructive-background:hover {
      border-color: var(--destructive-background, #c0392b);
    }

    .ctv\\:hover\\:border-primary-background:hover, .ctv\\:hover\\:border-primary-background\\/50:hover {
      border-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:border-primary-background\\/50:hover {
        border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 50%, transparent);
      }
    }

    .ctv\\:hover\\:border-primary-background\\/60:hover {
      border-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:border-primary-background\\/60:hover {
        border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 60%, transparent);
      }
    }

    .ctv\\:hover\\:border-white\\/40:hover {
      border-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:border-white\\/40:hover {
        border-color: color-mix(in oklab, var(--ctv-color-white) 40%, transparent);
      }
    }

    .ctv\\:hover\\:border-white\\/55:hover {
      border-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:border-white\\/55:hover {
        border-color: color-mix(in oklab, var(--ctv-color-white) 55%, transparent);
      }
    }

    .ctv\\:hover\\:bg-\\[\\#3a3a3a\\]:hover {
      background-color: #3a3a3a;
    }

    .ctv\\:hover\\:bg-\\[\\#4a4a4a\\]:hover {
      background-color: #4a4a4a;
    }

    .ctv\\:hover\\:bg-\\[\\#333333\\]:hover {
      background-color: #333;
    }

    .ctv\\:hover\\:bg-\\[rgb\\(233_61_130\\/0\\.2\\)\\]:hover {
      background-color: #e93d8233;
    }

    .ctv\\:hover\\:bg-base-foreground\\/5:hover {
      background-color: var(--base-foreground, #e0e0e0);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-base-foreground\\/5:hover {
        background-color: color-mix(in oklab, var(--base-foreground, #e0e0e0) 5%, transparent);
      }
    }

    .ctv\\:hover\\:bg-black\\/75:hover {
      background-color: var(--ctv-color-black);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-black\\/75:hover {
        background-color: color-mix(in oklab, var(--ctv-color-black) 75%, transparent);
      }
    }

    .ctv\\:hover\\:bg-black\\/80:hover {
      background-color: var(--ctv-color-black);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-black\\/80:hover {
        background-color: color-mix(in oklab, var(--ctv-color-black) 80%, transparent);
      }
    }

    .ctv\\:hover\\:bg-black\\/85:hover {
      background-color: var(--ctv-color-black);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-black\\/85:hover {
        background-color: color-mix(in oklab, var(--ctv-color-black) 85%, transparent);
      }
    }

    .ctv\\:hover\\:bg-black\\/90:hover {
      background-color: var(--ctv-color-black);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-black\\/90:hover {
        background-color: color-mix(in oklab, var(--ctv-color-black) 90%, transparent);
      }
    }

    .ctv\\:hover\\:bg-destructive-background:hover {
      background-color: var(--destructive-background, #c0392b);
    }

    .ctv\\:hover\\:bg-destructive-background-hover:hover {
      background-color: var(--destructive-background-hover, #d44637);
    }

    .ctv\\:hover\\:bg-destructive-background\\/10:hover {
      background-color: var(--destructive-background, #c0392b);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-destructive-background\\/10:hover {
        background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 10%, transparent);
      }
    }

    .ctv\\:hover\\:bg-destructive-background\\/30:hover {
      background-color: var(--destructive-background, #c0392b);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-destructive-background\\/30:hover {
        background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 30%, transparent);
      }
    }

    .ctv\\:hover\\:bg-destructive-background\\/80:hover {
      background-color: var(--destructive-background, #c0392b);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-destructive-background\\/80:hover {
        background-color: color-mix(in oklab, var(--destructive-background, #c0392b) 80%, transparent);
      }
    }

    .ctv\\:hover\\:bg-interface-menu-component-surface-hovered:hover {
      background-color: var(--interface-menu-component-surface-hovered, #ffffff14);
    }

    .ctv\\:hover\\:bg-primary-background-hover:hover {
      background-color: var(--primary-background-hover, #4ea8ffbf);
    }

    .ctv\\:hover\\:bg-primary-background\\/15:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/15:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 15%, transparent);
      }
    }

    .ctv\\:hover\\:bg-primary-background\\/20:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/20:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 20%, transparent);
      }
    }

    .ctv\\:hover\\:bg-primary-background\\/25:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/25:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 25%, transparent);
      }
    }

    .ctv\\:hover\\:bg-primary-background\\/40:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/40:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 40%, transparent);
      }
    }

    .ctv\\:hover\\:bg-primary-background\\/70:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/70:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 70%, transparent);
      }
    }

    .ctv\\:hover\\:bg-primary-background\\/90:hover {
      background-color: var(--primary-background, #4ea8ff99);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-primary-background\\/90:hover {
        background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 90%, transparent);
      }
    }

    .ctv\\:hover\\:bg-secondary-background:hover {
      background-color: var(--secondary-background, #ffffff0f);
    }

    .ctv\\:hover\\:bg-secondary-background-hover:hover, .ctv\\:hover\\:bg-secondary-background-hover\\/60:hover {
      background-color: var(--secondary-background-hover, #ffffff1a);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-secondary-background-hover\\/60:hover {
        background-color: color-mix(in oklab, var(--secondary-background-hover, #ffffff1a) 60%, transparent);
      }
    }

    .ctv\\:hover\\:bg-warning-background\\/10:hover {
      background-color: var(--warning-background, #d39e00);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-warning-background\\/10:hover {
        background-color: color-mix(in oklab, var(--warning-background, #d39e00) 10%, transparent);
      }
    }

    .ctv\\:hover\\:bg-warning-background\\/25:hover {
      background-color: var(--warning-background, #d39e00);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-warning-background\\/25:hover {
        background-color: color-mix(in oklab, var(--warning-background, #d39e00) 25%, transparent);
      }
    }

    .ctv\\:hover\\:bg-white:hover, .ctv\\:hover\\:bg-white\\/10:hover {
      background-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-white\\/10:hover {
        background-color: color-mix(in oklab, var(--ctv-color-white) 10%, transparent);
      }
    }

    .ctv\\:hover\\:bg-white\\/30:hover {
      background-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-white\\/30:hover {
        background-color: color-mix(in oklab, var(--ctv-color-white) 30%, transparent);
      }
    }

    .ctv\\:hover\\:bg-white\\/90:hover {
      background-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:hover\\:bg-white\\/90:hover {
        background-color: color-mix(in oklab, var(--ctv-color-white) 90%, transparent);
      }
    }

    .ctv\\:hover\\:text-\\[\\#d6d6d6\\]:hover {
      color: #d6d6d6;
    }

    .ctv\\:hover\\:text-base-foreground:hover {
      color: var(--base-foreground, #e0e0e0);
    }

    .ctv\\:hover\\:text-destructive-background:hover {
      color: var(--destructive-background, #c0392b);
    }

    .ctv\\:hover\\:text-primary-background:hover {
      color: var(--primary-background, #4ea8ff99);
    }

    .ctv\\:hover\\:text-warning-background:hover {
      color: var(--warning-background, #d39e00);
    }

    .ctv\\:hover\\:text-white:hover {
      color: var(--ctv-color-white);
    }

    .ctv\\:hover\\:opacity-90:hover {
      opacity: .9;
    }

    .ctv\\:hover\\:opacity-100:hover {
      opacity: 1;
    }

    .ctv\\:hover\\:brightness-110:hover {
      --tw-brightness: brightness(110%);
      filter: var(--tw-blur, ) var(--tw-brightness, ) var(--tw-contrast, ) var(--tw-grayscale, ) var(--tw-hue-rotate, ) var(--tw-invert, ) var(--tw-saturate, ) var(--tw-sepia, ) var(--tw-drop-shadow, );
    }
  }

  .ctv\\:focus\\:border-\\[\\#00FFD0\\]:focus {
    border-color: #00ffd0;
  }

  .ctv\\:focus\\:border-\\[\\#E93D82\\]:focus {
    border-color: #e93d82;
  }

  .ctv\\:focus\\:border-\\[\\#FFB800\\]:focus {
    border-color: #ffb800;
  }

  .ctv\\:focus\\:border-border-default:focus {
    border-color: var(--border-default, #ffffff26);
  }

  .ctv\\:focus\\:border-node-component-border:focus {
    border-color: var(--node-component-border, #fff3);
  }

  .ctv\\:focus\\:border-primary-background:focus, .ctv\\:focus\\:border-primary-background\\/50:focus {
    border-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:focus\\:border-primary-background\\/50:focus {
      border-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 50%, transparent);
    }
  }

  .ctv\\:focus\\:bg-primary-background\\/10:focus {
    background-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:focus\\:bg-primary-background\\/10:focus {
      background-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 10%, transparent);
    }
  }

  .ctv\\:focus\\:bg-secondary-background-hover:focus {
    background-color: var(--secondary-background-hover, #ffffff1a);
  }

  .ctv\\:focus\\:outline:focus, .ctv\\:focus\\:outline-1:focus {
    outline-style: var(--tw-outline-style);
    outline-width: 1px;
  }

  .ctv\\:focus\\:outline-primary-background\\/50:focus {
    outline-color: var(--primary-background, #4ea8ff99);
  }

  @supports (color: color-mix(in lab, red, red)) {
    .ctv\\:focus\\:outline-primary-background\\/50:focus {
      outline-color: color-mix(in oklab, var(--primary-background, #4ea8ff99) 50%, transparent);
    }
  }

  .ctv\\:focus\\:outline-none:focus {
    --tw-outline-style: none;
    outline-style: none;
  }

  .ctv\\:focus-visible\\:ring-1:focus-visible {
    --tw-ring-shadow: var(--tw-ring-inset, ) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-color, currentcolor);
    box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
  }

  .ctv\\:focus-visible\\:ring-border-default:focus-visible {
    --tw-ring-color: var(--border-default, #ffffff26);
  }

  .ctv\\:focus-visible\\:outline-none:focus-visible {
    --tw-outline-style: none;
    outline-style: none;
  }

  .ctv\\:active\\:scale-95:active {
    --tw-scale-x: 95%;
    --tw-scale-y: 95%;
    --tw-scale-z: 95%;
    scale: var(--tw-scale-x) var(--tw-scale-y);
  }

  @media (hover: hover) {
    .ctv\\:hover\\:enabled\\:bg-secondary-background-hover:hover:enabled {
      background-color: var(--secondary-background-hover, #ffffff1a);
    }
  }

  .ctv\\:disabled\\:pointer-events-none:disabled {
    pointer-events: none;
  }

  .ctv\\:disabled\\:cursor-default:disabled {
    cursor: default;
  }

  .ctv\\:disabled\\:cursor-not-allowed:disabled {
    cursor: not-allowed;
  }

  .ctv\\:disabled\\:opacity-30:disabled {
    opacity: .3;
  }

  .ctv\\:disabled\\:opacity-40:disabled {
    opacity: .4;
  }

  .ctv\\:disabled\\:opacity-50:disabled {
    opacity: .5;
  }

  .ctv\\:disabled\\:opacity-60:disabled {
    opacity: .6;
  }

  @media (hover: hover) {
    .ctv\\:disabled\\:hover\\:border-white\\/30:disabled:hover {
      border-color: var(--ctv-color-white);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:disabled\\:hover\\:border-white\\/30:disabled:hover {
        border-color: color-mix(in oklab, var(--ctv-color-white) 30%, transparent);
      }
    }

    .ctv\\:disabled\\:hover\\:bg-black\\/55:disabled:hover {
      background-color: var(--ctv-color-black);
    }

    @supports (color: color-mix(in lab, red, red)) {
      .ctv\\:disabled\\:hover\\:bg-black\\/55:disabled:hover {
        background-color: color-mix(in oklab, var(--ctv-color-black) 55%, transparent);
      }
    }

    .ctv\\:disabled\\:hover\\:bg-secondary-background:disabled:hover {
      background-color: var(--secondary-background, #ffffff0f);
    }

    .ctv\\:disabled\\:hover\\:bg-transparent:disabled:hover {
      background-color: #0000;
    }

    .ctv\\:disabled\\:hover\\:text-muted-foreground:disabled:hover {
      color: var(--muted-foreground, #888);
    }
  }

  .ctv\\:data-\\[highlighted\\]\\:bg-secondary-background-hover[data-highlighted] {
    background-color: var(--secondary-background-hover, #ffffff1a);
  }

  .ctv\\:data-\\[state\\=checked\\]\\:bg-secondary-background-selected[data-state="checked"] {
    background-color: var(--secondary-background-selected, #4ea8ff33);
  }

  @media (hover: hover) {
    .ctv\\:data-\\[state\\=checked\\]\\:hover\\:bg-secondary-background-selected[data-state="checked"]:hover {
      background-color: var(--secondary-background-selected, #4ea8ff33);
    }
  }

  .ctv\\:data-\\[state\\=open\\]\\:border-node-component-border[data-state="open"] {
    border-color: var(--node-component-border, #fff3);
  }

  .ctv\\:\\[\\&_\\+_\\&\\]\\:border-t + .ctv\\:\\[\\&_\\+_\\&\\]\\:border-t {
    border-top-style: var(--tw-border-style);
    border-top-width: 1px;
  }

  .ctv\\:\\[\\&_\\+_\\&\\]\\:border-solid + .ctv\\:\\[\\&_\\+_\\&\\]\\:border-solid {
    --tw-border-style: solid;
    border-style: solid;
  }

  .ctv\\:\\[\\&_\\+_\\&\\]\\:border-border-subtle + .ctv\\:\\[\\&_\\+_\\&\\]\\:border-border-subtle {
    border-color: var(--border-subtle, #ffffff14);
  }

  .ctv\\:\\[\\&_\\+_\\&\\]\\:pt-1\\.5 + .ctv\\:\\[\\&_\\+_\\&\\]\\:pt-1\\.5 {
    padding-top: calc(var(--ctv-spacing) * 1.5);
  }
}

@property --tw-translate-x {
  syntax: "*";
  inherits: false;
  initial-value: 0;
}

@property --tw-translate-y {
  syntax: "*";
  inherits: false;
  initial-value: 0;
}

@property --tw-translate-z {
  syntax: "*";
  inherits: false;
  initial-value: 0;
}

@property --tw-border-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}

@property --tw-gradient-position {
  syntax: "*";
  inherits: false
}

@property --tw-gradient-from {
  syntax: "<color>";
  inherits: false;
  initial-value: #0000;
}

@property --tw-gradient-via {
  syntax: "<color>";
  inherits: false;
  initial-value: #0000;
}

@property --tw-gradient-to {
  syntax: "<color>";
  inherits: false;
  initial-value: #0000;
}

@property --tw-gradient-stops {
  syntax: "*";
  inherits: false
}

@property --tw-gradient-via-stops {
  syntax: "*";
  inherits: false
}

@property --tw-gradient-from-position {
  syntax: "<length-percentage>";
  inherits: false;
  initial-value: 0%;
}

@property --tw-gradient-via-position {
  syntax: "<length-percentage>";
  inherits: false;
  initial-value: 50%;
}

@property --tw-gradient-to-position {
  syntax: "<length-percentage>";
  inherits: false;
  initial-value: 100%;
}

@property --tw-leading {
  syntax: "*";
  inherits: false
}

@property --tw-font-weight {
  syntax: "*";
  inherits: false
}

@property --tw-tracking {
  syntax: "*";
  inherits: false
}

@property --tw-ordinal {
  syntax: "*";
  inherits: false
}

@property --tw-slashed-zero {
  syntax: "*";
  inherits: false
}

@property --tw-numeric-figure {
  syntax: "*";
  inherits: false
}

@property --tw-numeric-spacing {
  syntax: "*";
  inherits: false
}

@property --tw-numeric-fraction {
  syntax: "*";
  inherits: false
}

@property --tw-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}

@property --tw-shadow-color {
  syntax: "*";
  inherits: false
}

@property --tw-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}

@property --tw-inset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}

@property --tw-inset-shadow-color {
  syntax: "*";
  inherits: false
}

@property --tw-inset-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}

@property --tw-ring-color {
  syntax: "*";
  inherits: false
}

@property --tw-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}

@property --tw-inset-ring-color {
  syntax: "*";
  inherits: false
}

@property --tw-inset-ring-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}

@property --tw-ring-inset {
  syntax: "*";
  inherits: false
}

@property --tw-ring-offset-width {
  syntax: "<length>";
  inherits: false;
  initial-value: 0;
}

@property --tw-ring-offset-color {
  syntax: "*";
  inherits: false;
  initial-value: #fff;
}

@property --tw-ring-offset-shadow {
  syntax: "*";
  inherits: false;
  initial-value: 0 0 #0000;
}

@property --tw-outline-style {
  syntax: "*";
  inherits: false;
  initial-value: solid;
}

@property --tw-backdrop-blur {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-brightness {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-contrast {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-grayscale {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-hue-rotate {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-invert {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-opacity {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-saturate {
  syntax: "*";
  inherits: false
}

@property --tw-backdrop-sepia {
  syntax: "*";
  inherits: false
}

@property --tw-duration {
  syntax: "*";
  inherits: false
}

@property --tw-ease {
  syntax: "*";
  inherits: false
}

@property --tw-blur {
  syntax: "*";
  inherits: false
}

@property --tw-brightness {
  syntax: "*";
  inherits: false
}

@property --tw-contrast {
  syntax: "*";
  inherits: false
}

@property --tw-grayscale {
  syntax: "*";
  inherits: false
}

@property --tw-hue-rotate {
  syntax: "*";
  inherits: false
}

@property --tw-invert {
  syntax: "*";
  inherits: false
}

@property --tw-opacity {
  syntax: "*";
  inherits: false
}

@property --tw-saturate {
  syntax: "*";
  inherits: false
}

@property --tw-sepia {
  syntax: "*";
  inherits: false
}

@property --tw-drop-shadow {
  syntax: "*";
  inherits: false
}

@property --tw-drop-shadow-color {
  syntax: "*";
  inherits: false
}

@property --tw-drop-shadow-alpha {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 100%;
}

@property --tw-drop-shadow-size {
  syntax: "*";
  inherits: false
}

@property --tw-scale-x {
  syntax: "*";
  inherits: false;
  initial-value: 1;
}

@property --tw-scale-y {
  syntax: "*";
  inherits: false;
  initial-value: 1;
}

@property --tw-scale-z {
  syntax: "*";
  inherits: false;
  initial-value: 1;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  50% {
    opacity: .5;
  }
}
.comfytv-root, .comfytv-dialog {\r
  --p-primary-color: #4ea8ff;\r
  --p-primary-contrast-color: #fff;\r
  --p-primary-hover-color: #66b6ff;\r
  --p-primary-active-color: #3a96ee;\r
\r
  --p-surface-0:  #1e1e1e;\r
  --p-surface-50: #232323;\r
  --p-surface-100: #2a2a2a;\r
  --p-surface-200: #333;\r
  --p-surface-300: #3d3d3d;\r
  --p-surface-400: #555;\r
  --p-surface-500: #777;\r
  --p-surface-600: #999;\r
  --p-surface-700: #bbb;\r
  --p-surface-800: #ddd;\r
  --p-surface-900: #eee;\r
  --p-surface-950: #f6f6f6;\r
\r
  --p-content-background: var(--p-surface-0);\r
  --p-content-hover-background: var(--p-surface-100);\r
  --p-content-border-color: var(--p-surface-300);\r
  --p-content-border-radius: 4px;\r
\r
  --p-text-color: var(--p-surface-800);\r
  --p-text-muted-color: var(--p-surface-600);\r
\r
  --p-mask-background: rgba(0, 0, 0, 0.55);\r
\r
  --p-focus-ring-width: 1px;\r
  --p-focus-ring-style: solid;\r
  --p-focus-ring-color: var(--p-primary-color);\r
  --p-focus-ring-offset: 1px;\r
}\r
\r
.comfytv-root {\r
  font-size: 12px;\r
  color: var(--p-text-color);\r
}\r
\r
.comfytv-root .p-datatable {\r
  font-size: 12px;\r
  display: flex;\r
  flex-direction: column;\r
  height: 100%;\r
  min-height: 0;\r
  width: 100%;\r
}\r
.comfytv-root .p-datatable-table-container,\r
.comfytv-root .p-datatable-wrapper {\r
  flex: 1;\r
  min-height: 0;\r
  overflow: auto;\r
}\r
.comfytv-root .p-datatable-table {\r
  border-collapse: separate;\r
  border-spacing: 0;\r
  table-layout: auto;\r
}\r
.comfytv-root .p-datatable-thead > tr > th {\r
  background: var(--p-surface-100);\r
  color: var(--p-text-color);\r
  border-bottom: 1px solid var(--p-content-border-color);\r
  padding: 6px 8px;\r
  font-weight: 600;\r
  text-align: left;\r
}\r
.comfytv-root .p-datatable-tbody > tr > td {\r
  padding: 6px 8px;\r
  border-bottom: 1px solid var(--p-content-border-color);\r
  vertical-align: top;\r
}\r
.comfytv-root .p-datatable-tbody > tr.p-row-odd {\r
  background: var(--p-surface-50);\r
}\r
.comfytv-root .p-datatable-tbody > tr:hover {\r
  background: var(--p-content-hover-background);\r
}\r
.comfytv-root .p-datatable-frozen-column {\r
  position: sticky;\r
  left: 0;\r
  z-index: 1;\r
  background: inherit;\r
}\r
\r
/* Select (dropdown) */\r
.comfytv-root .p-select {\r
  display: inline-flex;\r
  align-items: center;\r
  background: var(--p-surface-100);\r
  border: 1px solid var(--p-content-border-color);\r
  border-radius: 3px;\r
  min-height: 22px;\r
  cursor: pointer;\r
  position: relative;\r
}\r
.comfytv-root .p-select:hover {\r
  border-color: var(--p-surface-500);\r
}\r
.comfytv-root .p-select-focus {\r
  border-color: var(--p-primary-color);\r
}\r
.comfytv-root .p-select-label {\r
  padding: 2px 8px;\r
  font-size: 11px;\r
  color: var(--p-text-color);\r
  flex: 1;\r
  user-select: none;\r
}\r
.comfytv-root .p-select-dropdown {\r
  padding: 0 6px;\r
  color: var(--p-text-muted-color);\r
}\r
\r
/* SelectButton (toggle group) */\r
.comfytv-root .p-selectbutton {\r
  display: inline-flex;\r
  border: 1px solid var(--p-content-border-color);\r
  border-radius: 3px;\r
  overflow: hidden;\r
}\r
.comfytv-root .p-togglebutton {\r
  background: var(--p-surface-100);\r
  color: var(--p-text-muted-color);\r
  border: none;\r
  padding: 2px 10px;\r
  font-size: 11px;\r
  cursor: pointer;\r
}\r
.comfytv-root .p-togglebutton:hover {\r
  background: var(--p-surface-200);\r
  color: var(--p-text-color);\r
}\r
.comfytv-root .p-togglebutton-checked {\r
  background: var(--p-primary-color);\r
  color: var(--p-primary-contrast-color);\r
}\r
\r
.comfytv-root .p-inputtext,\r
.comfytv-root .cell-input,\r
.comfytv-root .cell-textarea {\r
  background: var(--p-surface-100);\r
  border: 1px solid var(--p-primary-color);\r
  color: var(--p-text-color);\r
  font: inherit;\r
  padding: 4px 6px;\r
  border-radius: 3px;\r
  width: 100%;\r
  box-sizing: border-box;\r
  outline: none;\r
}\r
.comfytv-root .cell-textarea {\r
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\r
  font-size: 11px;\r
  line-height: 1.4;\r
  resize: vertical;\r
  min-height: 32px;\r
}\r
.comfytv-root .cell-select { width: 100%; }\r
\r
.comfytv-root .p-datatable-tbody > tr > td.p-editable-column { cursor: text; }\r
.comfytv-root .p-datatable-tbody > tr > td.p-cell-editing {\r
  padding: 2px !important;\r
  background: rgba(78, 168, 255, 0.08);\r
}\r
\r
.comfytv-dialog.p-dialog {\r
  background: var(--p-surface-0);\r
  border: 1px solid var(--p-content-border-color);\r
  border-radius: 8px;\r
  color: var(--p-text-color);\r
  box-shadow: 0 24px 48px rgba(0,0,0,0.6);\r
}\r
.comfytv-dialog .p-dialog-header {\r
  padding: 12px 16px;\r
  border-bottom: 1px solid var(--p-content-border-color);\r
  background: var(--p-surface-50);\r
  border-radius: 8px 8px 0 0;\r
  font-weight: 600;\r
  display: flex;\r
  justify-content: space-between;\r
  align-items: center;\r
}\r
.comfytv-dialog .p-dialog-title {\r
  font-size: 14px;\r
}\r
.comfytv-dialog .p-dialog-content {\r
  padding: 16px;\r
  background: var(--p-surface-0);\r
  overflow: auto;\r
}\r
.comfytv-dialog .p-dialog-close-button {\r
  background: transparent;\r
  border: none;\r
  color: var(--p-text-muted-color);\r
  cursor: pointer;\r
  font-size: 18px;\r
  padding: 2px 6px;\r
}\r
.comfytv-dialog .p-dialog-close-button:hover {\r
  color: var(--p-text-color);\r
}\r
\r
body > .p-blockui-mask.p-blockui-mask-document:empty,\r
body > .p-overlay-mask.p-blockui-mask-document.p-overlay-mask-leave:empty {\r
  display: none !important;\r
  pointer-events: none !important;\r
}\r
\r
/* Hover-revealed overlay actions. Tailwind gates hover:/group-hover: behind\r
   @media (hover: hover), which is false on touch-primary devices (incl. many\r
   Windows touchscreen laptops) — so essential controls must not rely on it. */\r
.ctv-hover-reveal {\r
  opacity: 0;\r
  pointer-events: none;\r
  transition: opacity 0.15s ease;\r
}\r
.ctv-hover-host:hover .ctv-hover-reveal,\r
.ctv-hover-host:focus-within .ctv-hover-reveal {\r
  opacity: 1;\r
  pointer-events: auto;\r
}\r
@media (hover: none), (pointer: coarse) {\r
  .ctv-hover-reveal {\r
    opacity: 1;\r
    pointer-events: auto;\r
  }\r
}\r
\r
.ctv-scroll-thin {\r
  scrollbar-width: thin;\r
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;\r
}\r
.ctv-scroll-thin::-webkit-scrollbar {\r
  width: 10px;\r
}\r
.ctv-scroll-thin::-webkit-scrollbar-track {\r
  background: transparent;\r
}\r
.ctv-scroll-thin::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.35);\r
  border-radius: 5px;\r
  border: 2px solid transparent;\r
  background-clip: content-box;\r
}\r
.ctv-scroll-thin:hover::-webkit-scrollbar-thumb {\r
  background-color: rgba(255, 255, 255, 0.55);\r
}\r

.v2-cparams[data-v-4e76e858] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;
}
.v2-cparams__head[data-v-4e76e858] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;
}
.v2-cparams__title[data-v-4e76e858] {\r
  color: #8f8f98;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  text-transform: uppercase;\r
  letter-spacing: 0.04em;
}
.v2-cparams__addwrap[data-v-4e76e858] {\r
  position: relative;\r
  margin-left: auto;
}
.v2-cparams__add[data-v-4e76e858] {\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  border-radius: 8px;\r
  height: 22px;\r
  padding: 0 8px;\r
  background: transparent;\r
  color: #b9b9c0;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.v2-cparams__add[data-v-4e76e858]:hover { background: rgba(255, 255, 255, 0.06); color: #ececf1;
}
.v2-cparams__add[data-v-4e76e858]:disabled { opacity: 0.4; pointer-events: none;
}
.v2-cparams__menu[data-v-4e76e858] {\r
  position: absolute;\r
  right: 0;\r
  top: calc(100% + 4px);\r
  z-index: 30;\r
  width: 190px;\r
  max-height: 220px;\r
  overflow-y: auto;\r
  padding: 4px;\r
  border-radius: 10px;\r
  background: #232327;\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
}
.v2-cparams__menuitem[data-v-4e76e858] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  width: 100%;\r
  padding: 5px 7px;\r
  border: none;\r
  border-radius: 6px;\r
  background: transparent;\r
  color: #ececf1;\r
  font: 500 11px/1.2 system-ui, sans-serif;\r
  cursor: pointer;\r
  text-align: left;
}
.v2-cparams__menuitem[data-v-4e76e858]:hover { background: rgba(255, 255, 255, 0.07);
}
.v2-cparams__menulabel[data-v-4e76e858] {\r
  flex: 1;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}
.v2-cparams__menutype[data-v-4e76e858] {\r
  color: #6b6b74;\r
  font-size: 9px;
}
.v2-cparams__row[data-v-4e76e858] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;
}
.v2-cparams__label[data-v-4e76e858] {\r
  flex: none;\r
  width: 88px;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
  color: #8f8f98;\r
  font: 500 11px/1.2 system-ui, sans-serif;
}
.v2-cparams__control[data-v-4e76e858] { flex: 1; min-width: 0;
}
.v2-cparams__control[data-v-4e76e858] button {\r
  height: 26px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 8px;\r
  border-width: 1px;\r
  background: transparent;\r
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-cparams__control[data-v-4e76e858] button:hover { background: rgba(255, 255, 255, 0.06);
}
.v2-cparams__remove[data-v-4e76e858] {\r
  flex: none;\r
  width: 20px;\r
  height: 20px;\r
  padding: 0;\r
  border: none;\r
  border-radius: 999px;\r
  background: transparent;\r
  color: #f87171;\r
  font: 500 13px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.v2-cparams__remove[data-v-4e76e858]:hover { background: rgba(248, 113, 113, 0.12);
}\r

.v2-fsel[data-v-1fa36a56] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  flex: 1;\r
  min-width: 0;\r
  flex-wrap: wrap;
}
.v2-fsel__item[data-v-1fa36a56] { flex: none; min-width: 0;
}
.v2-fsel__item--grow[data-v-1fa36a56] { flex: 1 1 auto; min-width: 0; max-width: 150px;
}
.v2-fsel[data-v-1fa36a56] button {\r
  height: 26px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 8px;\r
  border-width: 1px;\r
  background: transparent;\r
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-fsel[data-v-1fa36a56] button:hover {\r
  background: rgba(255, 255, 255, 0.06);
}
.v2-fsel__num[data-v-1fa36a56] {\r
  flex: none;\r
  width: 52px;\r
  height: 26px;\r
  padding: 0 6px;\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #ececf1;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  outline: none;
}
.v2-fsel__num[data-v-1fa36a56]:focus { border-color: rgba(167, 139, 250, 0.6);
}
.v2-fsel__link[data-v-1fa36a56] {\r
  flex: none;\r
  width: 26px;\r
  height: 26px;\r
  padding: 0;\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #b9b9c0;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;
}
.v2-fsel__link[data-v-1fa36a56]:hover {\r
  background: rgba(255, 255, 255, 0.06);\r
  color: #ececf1;
}
.v2-fsel__link svg[data-v-1fa36a56] { width: 13px; height: 13px;
}\r

.v2-corner[data-v-5433148a] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 5px;
}
.v2-corner__btn[data-v-5433148a] {\r
  width: 26px;\r
  height: 26px;\r
  border: none;\r
  border-radius: 999px;\r
  background: rgba(20, 20, 24, 0.66);\r
  backdrop-filter: blur(4px);\r
  color: #ececf1;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;
}
.v2-corner__btn svg[data-v-5433148a] { width: 13px; height: 13px;
}
.v2-corner__btn[data-v-5433148a]:hover { background: rgba(20, 20, 24, 0.9);
}
.v2-corner__btn--saved[data-v-5433148a] { color: #a78bfa;
}
.v2-corner__btn[data-done='1'][data-v-5433148a] {\r
  background: #a78bfa;\r
  color: #17171b;
}\r

.v2-params[data-v-f6cae5eb] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;
}
.v2-params__toggle[data-v-f6cae5eb] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  align-self: flex-start;\r
  border: none;\r
  padding: 4px 8px;\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #8f8f98;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.v2-params__toggle[data-v-f6cae5eb]:hover { background: rgba(255, 255, 255, 0.06); color: #b9b9c0;
}
.v2-params__toggle svg[data-v-f6cae5eb] { width: 11px; height: 11px; transition: transform 0.15s ease;
}
.v2-params__count[data-v-f6cae5eb] {\r
  padding: 1px 6px;\r
  border-radius: 999px;\r
  background: rgba(255, 255, 255, 0.08);\r
  font-size: 10px;
}
.v2-params__grid[data-v-f6cae5eb] {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 6px 10px;
}
.v2-params__row[data-v-f6cae5eb] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 3px;\r
  min-width: 0;
}
.v2-params__row[data-wide='1'][data-v-f6cae5eb] { grid-column: 1 / -1;
}
.v2-params__label[data-v-f6cae5eb] {\r
  color: #6b6b74;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  text-transform: uppercase;\r
  letter-spacing: 0.04em;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}
.v2-params__input[data-v-f6cae5eb] {\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #ececf1;\r
  font: 500 11px/1.4 system-ui, sans-serif;\r
  padding: 5px 8px;\r
  outline: none;\r
  min-width: 0;
}
.v2-params__input[data-v-f6cae5eb]:focus { border-color: rgba(167, 139, 250, 0.6);
}
.v2-params__textarea[data-v-f6cae5eb] { resize: vertical; min-height: 40px;
}
.v2-params__select[data-v-f6cae5eb] button {\r
  height: 26px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 8px;\r
  border-width: 1px;\r
  background: transparent;\r
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-params__bool[data-v-f6cae5eb] {\r
  width: 34px;\r
  height: 20px;\r
  border: none;\r
  border-radius: 999px;\r
  background: rgba(255, 255, 255, 0.12);\r
  cursor: pointer;\r
  position: relative;\r
  transition: background 0.15s ease;
}
.v2-params__bool span[data-v-f6cae5eb] {\r
  position: absolute;\r
  top: 3px;\r
  left: 3px;\r
  width: 14px;\r
  height: 14px;\r
  border-radius: 999px;\r
  background: #b9b9c0;\r
  transition: transform 0.15s ease, background 0.15s ease;
}
.v2-params__bool[data-on='1'][data-v-f6cae5eb] { background: rgba(167, 139, 250, 0.55);
}
.v2-params__bool[data-on='1'] span[data-v-f6cae5eb] { transform: translateX(14px); background: #fff;
}\r

.v2-refs[data-v-86fc93ac] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  flex-wrap: wrap;
}
.v2-refchip[data-v-86fc93ac] {\r
  position: relative;\r
  width: 34px;\r
  height: 34px;\r
  border-radius: 9px;\r
  overflow: hidden;\r
  background: #2c2c31;\r
  border: 1px solid rgba(255, 255, 255, 0.08);\r
  flex: none;
}
.v2-refchip__img[data-v-86fc93ac] {\r
  display: block;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;
}
.v2-refchip__dot[data-v-86fc93ac] {\r
  position: absolute;\r
  left: 3px;\r
  bottom: 3px;\r
  width: 7px;\r
  height: 7px;\r
  border-radius: 999px;\r
  box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55);
}
.v2-refchip__x[data-v-86fc93ac] {\r
  position: absolute;\r
  top: 1px;\r
  right: 1px;\r
  width: 14px;\r
  height: 14px;\r
  padding: 0;\r
  border: none;\r
  border-radius: 999px;\r
  background: rgba(12, 12, 16, 0.78);\r
  color: #e6e6ea;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  cursor: pointer;\r
  display: none;\r
  align-items: center;\r
  justify-content: center;
}
.v2-refchip:hover .v2-refchip__x[data-v-86fc93ac] { display: flex;
}
@media (hover: none) {
.v2-refchip__x[data-v-86fc93ac] { display: flex;
}
}
.v2-refchip--more[data-v-86fc93ac] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  color: #b9b9c0;\r
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-refchip--add[data-v-86fc93ac] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  color: #b9b9c0;\r
  font: 400 16px/1 system-ui, sans-serif;\r
  cursor: pointer;\r
  background: transparent;\r
  border: 1px dashed rgba(255, 255, 255, 0.22);
}
.v2-refchip--add[data-v-86fc93ac]:hover {\r
  border-color: rgba(255, 255, 255, 0.45);\r
  color: #ececf1;
}\r

.v2-srv[data-v-9cd7b876] {\r
  display: flex;\r
  align-items: center;\r
  gap: 5px;\r
  min-width: 0;\r
  color: #8f8f98;
}
.v2-srv > svg[data-v-9cd7b876] {\r
  width: 14px;\r
  height: 14px;\r
  flex: none;\r
  opacity: 0.85;
}
.v2-srv__select[data-v-9cd7b876] {\r
  min-width: 0;\r
  max-width: 140px;
}
.v2-srv[data-v-9cd7b876] button {\r
  height: 26px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 8px;\r
  border-width: 1px;\r
  background: transparent;\r
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-srv[data-v-9cd7b876] button:hover {\r
  background: rgba(255, 255, 255, 0.06);
}\r

.v2-mp[data-v-1c7bae86] {\r
  position: absolute;\r
  inset: 0;\r
  border-radius: 12px;\r
  overflow: hidden;\r
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);\r
  border: 1px solid rgba(255, 255, 255, 0.07);\r
  box-sizing: border-box;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;
}
.v2-mp__img[data-v-1c7bae86] {\r
  position: absolute;\r
  inset: 0;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;
}
.v2-mp__video[data-v-1c7bae86],\r
.v2-mp[data-v-1c7bae86] video {\r
  width: 100%;\r
  height: 100%;\r
  object-fit: contain;\r
  background: #000;
}
.v2-mp__audiowrap[data-v-1c7bae86] {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 14px;\r
  width: 100%;\r
  padding: 0 16px;\r
  box-sizing: border-box;
}
.v2-mp__audioicon[data-v-1c7bae86] {\r
  width: 40px;\r
  height: 40px;\r
  color: #8f8f98;
}
.v2-mp__audio[data-v-1c7bae86] {\r
  width: 100%;\r
  max-width: 340px;\r
  height: 34px;
}
.v2-mp__model[data-v-1c7bae86] {\r
  position: absolute;\r
  inset: 0;\r
  display: flex;\r
  flex-direction: column;\r
  color: #6b6b74;\r
  cursor: grab;
}
.v2-mp__model[data-v-1c7bae86]:active { cursor: grabbing;
}
.v2-mp__model[data-v-1c7bae86] > * {\r
  flex: 1;\r
  min-height: 0;\r
  width: 100%;
}
.v2-mp__text[data-v-1c7bae86] {\r
  position: absolute;\r
  inset: 0;\r
  padding: 12px 14px;\r
  overflow-y: auto;\r
  color: #d9d9de;\r
  font: 400 12px/1.7 system-ui, sans-serif;\r
  white-space: pre-wrap;\r
  word-break: break-word;\r
  text-align: left;\r
  cursor: text;\r
  user-select: text;
}
.v2-mp__hint[data-v-1c7bae86] {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  gap: 8px;\r
  color: #6b6b74;\r
  font: 500 12px/1.5 system-ui, sans-serif;
}
.v2-mp__hint svg[data-v-1c7bae86] { width: 26px; height: 26px; opacity: 0.55;
}
.v2-mp__count[data-v-1c7bae86] {\r
  position: absolute;\r
  right: 8px;\r
  top: 8px;\r
  padding: 3px 8px;\r
  border-radius: 999px;\r
  background: rgba(23, 23, 27, 0.75);\r
  color: #cdbdfc;\r
  font: 600 10px/1 system-ui, sans-serif;
}\r

.v2-crop[data-v-d5cf906d] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;\r
  flex: 1;\r
  min-height: 0;
}
.v2-crop__canvas[data-v-d5cf906d] {\r
  position: relative;\r
  flex: 1;\r
  min-height: 0;\r
  border-radius: 12px;\r
  overflow: hidden;\r
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);\r
  display: flex;\r
  flex-direction: column;
}
.v2-crop__empty[data-v-d5cf906d] {\r
  position: absolute;\r
  inset: 0;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  color: #6b6b74;\r
  font: 500 12px/1.5 system-ui, sans-serif;\r
  pointer-events: none;
}
.v2-crop__status[data-v-d5cf906d] {\r
  flex: none;\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 9px 14px;\r
  border-radius: 14px;\r
  background: #232327;\r
  border: 1px solid rgba(255, 255, 255, 0.05);\r
  font: 500 11px/1 system-ui, sans-serif;\r
  color: #8f8f98;
}
.v2-crop__dims[data-v-d5cf906d] { color: #b9b9c0; font-variant-numeric: tabular-nums;
}
.v2-crop__spacer[data-v-d5cf906d] { flex: 1;
}
.v2-crop__busy[data-v-d5cf906d],\r
.v2-crop__ok[data-v-d5cf906d] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  color: #9a9aa2;
}
.v2-crop__busy[data-v-d5cf906d]::before,\r
.v2-crop__ok[data-v-d5cf906d]::before {\r
  content: '';\r
  width: 6px;\r
  height: 6px;\r
  border-radius: 999px;\r
  background: #a78bfa;\r
  box-shadow: 0 0 6px rgba(167, 139, 250, 0.7);
}
.v2-crop__busy[data-v-d5cf906d]::before { animation: v2croppulse-d5cf906d 0.9s ease-in-out infinite;
}
@keyframes v2croppulse-d5cf906d {
50% { opacity: 0.35;
}
}\r

.v2-cmp__fill[data-v-285630a8] {\r
  position: absolute;\r
  inset: 0;
}\r

.v2-grade__effectrow[data-v-2968aa77],\r
.v2-grade__paramrow[data-v-2968aa77] {\r
  grid-template-columns: 88px 1fr;
}
.v2-grade__reset[data-v-2968aa77] {\r
  flex: none;\r
  color: #8f8f98;
}
.v2-grade__error[data-v-2968aa77] {\r
  color: var(--destructive-background, #ef4444);\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}\r

.v2-grid__overlay[data-v-11d37ac8] {\r
  position: absolute;\r
  inset: 0;\r
  pointer-events: none;
}
.v2-grid__band[data-v-11d37ac8] {\r
  position: absolute;\r
  background: rgba(167, 139, 250, 0.75);\r
  box-shadow: 0 0 3px rgba(0, 0, 0, 0.7);
}\r

.v2-fx-embed[data-v-b4d1bc12] {\r
  display: flex;\r
  flex-direction: column;\r
  flex: 1;\r
  min-height: 0;
}
.v2-fx-embed[data-v-b4d1bc12] >  * {\r
  flex: 1;\r
  min-height: 0;
}
.v2-fx-embed[data-v-b4d1bc12] > div > :last-child {\r
  display: none;
}\r

.fxc[data-v-1b839639] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 10px;\r
  flex: 1;\r
  min-height: 0;
}
.fxc__stage[data-v-1b839639] {\r
  position: relative;\r
  flex: 1;\r
  min-height: 180px;\r
  border-radius: 12px;\r
  overflow: hidden;\r
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);\r
  border: 1px solid rgba(255, 255, 255, 0.07);
}
.fxc__live[data-v-1b839639],\r
.fxc__outwrap[data-v-1b839639] {\r
  position: absolute;\r
  inset: 0;\r
  display: flex;\r
  flex-direction: column;
}
.fxc__live[data-v-1b839639] video,\r
.fxc__outwrap[data-v-1b839639] video {\r
  width: 100%;\r
  height: 100%;\r
  object-fit: contain;\r
  background: #000;
}
.fxc__canvas[data-v-1b839639] {\r
  position: absolute;\r
  inset: 0;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: contain;\r
  pointer-events: none;
}
.fxc__out[data-v-1b839639] { width: 100%; height: 100%;
}
.fxc__hint[data-v-1b839639] {\r
  position: absolute;\r
  inset: 0;\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  justify-content: center;\r
  gap: 8px;\r
  color: #6b6b74;\r
  font: 500 12px/1.5 system-ui, sans-serif;\r
  pointer-events: none;
}
.fxc__hint svg[data-v-1b839639] { width: 26px; height: 26px; opacity: 0.55;
}
.fxc__mode[data-v-1b839639] {\r
  position: absolute;\r
  top: 8px;\r
  right: 8px;\r
  z-index: 3;\r
  display: flex;\r
  padding: 2px;\r
  border-radius: 999px;\r
  background: rgba(20, 20, 24, 0.72);\r
  backdrop-filter: blur(4px);
}
.fxc__mode button[data-v-1b839639] {\r
  border: none;\r
  padding: 4px 10px;\r
  border-radius: 999px;\r
  background: transparent;\r
  color: #9a9aa2;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.fxc__mode button[data-on='1'][data-v-1b839639] {\r
  background: rgba(255, 255, 255, 0.14);\r
  color: #ececf1;
}
.fxc__corner[data-v-1b839639] {\r
  position: absolute;\r
  top: 8px;\r
  left: 8px;\r
  z-index: 3;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 5px;\r
  opacity: 0;\r
  transition: opacity 0.15s ease;
}
.fxc__stage:hover .fxc__corner[data-v-1b839639] { opacity: 1;
}
@media (hover: none) {
.fxc__corner[data-v-1b839639] { opacity: 1;
}
}
.fxc__corner button[data-v-1b839639] {\r
  width: 26px;\r
  height: 26px;\r
  border: none;\r
  border-radius: 999px;\r
  background: rgba(20, 20, 24, 0.66);\r
  backdrop-filter: blur(4px);\r
  color: #ececf1;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;
}
.fxc__corner button[data-v-1b839639]:hover { background: rgba(20, 20, 24, 0.9);
}
.fxc__corner button svg[data-v-1b839639] { width: 13px; height: 13px;
}
.fxc__corner button[data-done='1'][data-v-1b839639] {\r
  background: #a78bfa;\r
  color: #17171b;
}
.fxc__chain[data-v-1b839639] {\r
  flex: none;\r
  display: flex;\r
  flex-wrap: wrap;\r
  gap: 6px;
}
.fxc__chip[data-v-1b839639] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 5px 10px 5px 6px;\r
  border-radius: 999px;\r
  background: #2c2c31;\r
  border: 1px solid rgba(255, 255, 255, 0.05);\r
  font: 500 11px/1 system-ui, sans-serif;\r
  color: #d9d9de;\r
  max-width: 170px;
}
.fxc__ord[data-v-1b839639] {\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  width: 16px;\r
  height: 16px;\r
  border-radius: 999px;\r
  background: rgba(167, 139, 250, 0.18);\r
  color: #a78bfa;\r
  font: 600 10px/1 system-ui, sans-serif;\r
  flex: none;
}
.fxc__name[data-v-1b839639] {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
  min-width: 0;
}
.fxc__nodot[data-v-1b839639] {\r
  width: 5px;\r
  height: 5px;\r
  border-radius: 999px;\r
  background: #6b6b74;\r
  flex: none;
}
.fxc__chip[data-nopreview='1'][data-v-1b839639] { color: #8f8f98;
}
.fxc__empty[data-v-1b839639] {\r
  flex: 1;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  padding: 14px;\r
  border-radius: 12px;\r
  border: 1px dashed rgba(255, 255, 255, 0.12);\r
  color: #6b6b74;\r
  font: 500 11px/1.5 system-ui, sans-serif;\r
  text-align: center;
}
.fxc__panel[data-v-1b839639] {\r
  flex: none;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 10px;\r
  margin-top: 4px;\r
  padding: 12px 14px;\r
  border-radius: 16px;\r
  background: #232327;\r
  border: 1px solid rgba(255, 255, 255, 0.05);\r
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
.fxc__footer[data-v-1b839639] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  color: #b9b9c0;\r
  font: 500 12px/1 system-ui, sans-serif;
}
.fxc__flabel[data-v-1b839639] { flex: none;
}
.fxc__fspacer[data-v-1b839639] { flex: 1;
}
.fxc__delivery[data-v-1b839639] {\r
  flex: none;\r
  display: flex;\r
  flex-direction: column;\r
  gap: 8px;
}
.fxc__dtoggle[data-v-1b839639] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  align-self: flex-start;\r
  border: none;\r
  padding: 4px 8px;\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #8f8f98;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.fxc__dtoggle[data-v-1b839639]:hover { background: rgba(255, 255, 255, 0.06); color: #b9b9c0;
}
.fxc__dtoggle svg[data-v-1b839639] { width: 11px; height: 11px; transition: transform 0.15s ease;
}
.fxc__dsummary[data-v-1b839639] {\r
  padding: 1px 8px;\r
  border-radius: 999px;\r
  background: rgba(255, 255, 255, 0.08);\r
  font-size: 10px;\r
  color: #b9b9c0;
}
.fxc__drows[data-v-1b839639] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 6px;\r
  padding: 4px 0 0;
}
.fxc__drow[data-v-1b839639] {\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;
}
.fxc__dlabel[data-v-1b839639] {\r
  flex: none;\r
  width: 62px;\r
  color: #6b6b74;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  text-transform: uppercase;\r
  letter-spacing: 0.04em;
}
.fxc__drow[data-v-1b839639] button {\r
  font-size: 10px;\r
  border-radius: 999px;
}\r

.v2-al[data-v-fe19c849] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 10px;\r
  flex: 1;\r
  min-height: 0;\r
  border-radius: 12px;
}
.v2-al--drag[data-v-fe19c849] {\r
  outline: 2px dashed rgba(167, 139, 250, 0.75);\r
  outline-offset: -2px;
}
.v2-al__preview[data-v-fe19c849] {\r
  position: relative;\r
  flex: 1;\r
  min-height: 170px;\r
  border-radius: 12px;\r
  overflow: hidden;\r
  display: flex;\r
  align-items: center;\r
  justify-content: center;\r
  cursor: pointer;
}
.v2-al__img[data-v-fe19c849] {\r
  position: absolute;\r
  inset: 0;\r
  width: 100%;\r
  height: 100%;\r
  object-fit: cover;
}
.v2-al__hint[data-v-fe19c849] {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  gap: 8px;\r
  color: #6b6b74;\r
  font: 500 12px/1.5 system-ui, sans-serif;
}
.v2-al__hint svg[data-v-fe19c849] { width: 26px; height: 26px; opacity: 0.55;
}
.v2-al__footer[data-v-fe19c849] {\r
  flex: none;\r
  display: flex;\r
  align-items: center;\r
  gap: 8px;\r
  padding: 9px 14px;\r
  border-radius: 14px;\r
  background: #232327;\r
  border: 1px solid rgba(255, 255, 255, 0.05);\r
  color: #8f8f98;\r
  font: 500 11px/1 system-ui, sans-serif;
}
.v2-al__name[data-v-fe19c849] {\r
  color: #b9b9c0;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;\r
  min-width: 0;
}
.v2-al__name--missing[data-v-fe19c849] { color: #f87171;
}
.v2-al__spacer[data-v-fe19c849] { flex: 1;
}
.v2-al__btn[data-v-fe19c849] {\r
  flex: none;\r
  display: flex;\r
  align-items: center;\r
  gap: 4px;\r
  border: none;\r
  padding: 5px 10px;\r
  border-radius: 8px;\r
  background: rgba(255, 255, 255, 0.06);\r
  color: #b9b9c0;\r
  font: 500 11px/1 system-ui, sans-serif;\r
  cursor: pointer;
}
.v2-al__btn[data-v-fe19c849]:hover { background: rgba(255, 255, 255, 0.12); color: #ececf1;
}
.v2-al__btn svg[data-v-fe19c849] { width: 12px; height: 12px;
}
.v2-al__file[data-v-fe19c849] { display: none;
}\r

.v2-lact__icon[data-v-9bc6ad8d] {\r
  font-size: 12px;\r
  width: 14px;\r
  display: inline-flex;\r
  justify-content: center;
}
.v2-lact__chev[data-v-9bc6ad8d] { font-size: 9px; opacity: 0.7;
}
.v2-lact__backdrop[data-v-9bc6ad8d] {\r
  position: fixed;\r
  inset: 0;\r
  z-index: 9999;
}
.v2-lact__menu[data-v-9bc6ad8d] {\r
  position: absolute;\r
  width: 420px;\r
  max-height: 300px;\r
  overflow-y: auto;\r
  overscroll-behavior: contain;\r
  display: grid;\r
  grid-template-columns: repeat(3, 1fr);\r
  gap: 2px;\r
  padding: 6px;\r
  border-radius: 12px;\r
  background: #232327;\r
  border: 1px solid rgba(255, 255, 255, 0.08);\r
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
}
.v2-lact__item[data-v-9bc6ad8d] {\r
  display: flex;\r
  align-items: center;\r
  gap: 6px;\r
  padding: 6px 8px;\r
  border: none;\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #d9d9de;\r
  font: 500 11px/1.2 system-ui, sans-serif;\r
  cursor: pointer;\r
  text-align: left;\r
  min-width: 0;
}
.v2-lact__item span[data-v-9bc6ad8d] {\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}
.v2-lact__item[data-v-9bc6ad8d]:hover { background: rgba(255, 255, 255, 0.08);
}\r

.v2-ctl[data-v-748ce58f] {\r
  display: grid;\r
  grid-template-columns: 1fr 1fr;\r
  gap: 8px 12px;
}
.v2-ctl__row[data-v-748ce58f] {\r
  display: flex;\r
  flex-direction: column;\r
  gap: 4px;\r
  min-width: 0;
}
.v2-ctl__row[data-wide='1'][data-v-748ce58f] { grid-column: 1 / -1;
}
.v2-ctl__label[data-v-748ce58f] {\r
  color: #8f8f98;\r
  font: 500 10px/1 system-ui, sans-serif;\r
  text-transform: uppercase;\r
  letter-spacing: 0.04em;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  white-space: nowrap;
}
.v2-ctl[data-v-748ce58f] button {\r
  height: 26px;\r
  padding: 0 8px;\r
  font-size: 11px;\r
  border-radius: 8px;\r
  border-width: 1px;\r
  background: transparent;\r
  border-color: rgba(255, 255, 255, 0.1);
}
.v2-ctl[data-v-748ce58f] button:hover { background: rgba(255, 255, 255, 0.06);
}
.v2-ctl[data-v-748ce58f] textarea,\r
.v2-ctl[data-v-748ce58f] input[type='text'] {\r
  border: 1px solid rgba(255, 255, 255, 0.1);\r
  border-radius: 8px;\r
  background: transparent;\r
  color: #ececf1;\r
  font: 500 11px/1.5 system-ui, sans-serif;
}`));
      document.head.appendChild(elementStyle);
    }
  } catch (e) {
    console.error("vite-plugin-css-injected-by-js", e);
  }
})();
import "./assets/main-4tD0EhM8.mjs";
//# sourceMappingURL=main.js.map

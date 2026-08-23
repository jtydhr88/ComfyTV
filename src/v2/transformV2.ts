import type { Component } from 'vue'

import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { bindNodeDrag } from '@/v2/nodeDrag'
import { bindShellChrome } from '@/v2/shellChrome'
import { bindProgressRing, createNodeScope, ensureMinSize, ICON_GRIP } from '@/v2/shellCommon'
import { installV2ShellCss } from '@/v2/shellCss'
import { createIslandGroup } from '@/v2/islands'
import { V2_SHELLS } from '@/v2/registry'
import CompareEditorV2 from '@/v2/CompareEditorV2.vue'
import GradeEditorV2 from '@/v2/GradeEditorV2.vue'
import GridSplitEditorV2 from '@/v2/GridSplitEditorV2.vue'
import MirrorEditorV2 from '@/v2/MirrorEditorV2.vue'
import RotateEditorV2 from '@/v2/RotateEditorV2.vue'
import type { StageKind, StageVariant } from '@/stores/stageStore'

const ED_CSS = `
.v2-ed-card {
  padding: 0 6px 6px !important;
  cursor: grab;
  border-radius: 14px;
}
.v2-ed-card:active { cursor: grabbing; }
.v2-ed-host { cursor: default; }
.v2-ed {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.v2-ed__canvas {
  position: relative;
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  overflow: hidden;
  background: var(--v2-checker);
  background-size: 18px 18px;
  display: flex;
  flex-direction: column;
}
.v2-ed__fit {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.v2-ed__fit img,
.v2-ed__fit canvas {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  pointer-events: none;
}
.v2-ed__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--v2-text-faint);
  font: 500 12px/1.5 system-ui, sans-serif;
  pointer-events: none;
  text-align: center;
  padding: 0 20px;
}
.v2-ed__panel {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  min-width: 0;
}
.v2-ed__row {
  display: grid;
  grid-template-columns: 70px 1fr 46px;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.v2-ed__row > * { min-width: 0; }
.v2-ed__label {
  font: 600 10px/1 system-ui, sans-serif;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--v2-text-muted);
}
.v2-ed__value {
  font: 500 11px/1 ui-monospace, monospace;
  color: var(--v2-text-mid);
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.v2-ed__range {
  width: 100%;
  accent-color: var(--v2-accent);
}
.v2-ed__num {
  width: 100%;
  padding: 2px 4px;
  font: 500 11px/1 ui-monospace, monospace;
  color: var(--v2-text-mid);
  text-align: right;
  font-variant-numeric: tabular-nums;
  background: transparent;
  border: 1px solid var(--v2-chip-border);
  border-radius: 6px;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
  box-sizing: border-box;
}
.v2-ed__num::-webkit-inner-spin-button,
.v2-ed__num::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.v2-ed__num:focus { border-color: var(--v2-accent-border); }
.v2-ed__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}
.v2-ed__chip {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 8px;
  border-radius: 9px;
  border: 1px solid var(--v2-chip-border);
  background: var(--v2-chip-bg);
  color: var(--v2-text-mid);
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
  appearance: none;
  user-select: none;
  white-space: nowrap;
}
.v2-ed__chip:hover { border-color: var(--v2-accent-border); }
.v2-ed__chip[data-on="1"] {
  background: var(--v2-accent-soft);
  border-color: var(--v2-accent-border);
  color: var(--v2-accent-text);
}
.v2-ed__chip svg { width: 14px; height: 14px; }
.v2-ed__step {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 9px;
  border: 1px solid var(--v2-chip-border);
  background: var(--v2-chip-bg);
}
.v2-ed__stepbtn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: var(--v2-chip-bg);
  color: var(--v2-text-mid);
  font: 500 13px/1 system-ui, sans-serif;
  cursor: pointer;
  appearance: none;
}
.v2-ed__stepbtn:hover { background: var(--v2-accent-soft); color: var(--v2-accent-text); }
.v2-ed__stepval {
  margin-left: auto;
  min-width: 24px;
  text-align: center;
  font: 500 11px/1 ui-monospace, monospace;
  color: var(--v2-text-mid);
}
.v2-ed__status {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 14px;
  background: var(--v2-slab-bg);
  border: 1px solid var(--v2-slab-border);
  font: 500 11px/1 system-ui, sans-serif;
  color: var(--v2-text-muted);
}
.v2-ed__dims { color: var(--v2-text-mid); font-variant-numeric: tabular-nums; }
.v2-ed__spacer { flex: 1; }
.v2-ed__busy,
.v2-ed__ok {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--v2-text-muted);
}
.v2-ed__busy::before,
.v2-ed__ok::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--v2-accent);
  box-shadow: 0 0 6px color-mix(in srgb, var(--v2-accent) 70%, transparent);
}
.v2-ed__busy::before { animation: v2edpulse 0.9s ease-in-out infinite; }
@keyframes v2edpulse {
  50% { opacity: 0.35; }
}
`

const ICON_ROTATE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 12a8.5 8.5 0 11-2.6-6.1"/><path d="M18.5 2.5v3.6H15"/><rect x="8.5" y="8.5" width="7" height="7" rx="1.5"/></svg>`
const ICON_MIRROR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18" stroke-dasharray="2.4 2.4"/><path d="M8.5 7.5L4 12l4.5 4.5zM15.5 7.5L20 12l-4.5 4.5z"/></svg>`
const ICON_GRADE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="10" r="5.5"/><circle cx="15" cy="14" r="5.5"/><path d="M12.2 6.2a5.5 5.5 0 012.6 3.4M11.8 17.8a5.5 5.5 0 01-2.6-3.4" opacity=".5"/></svg>`
const ICON_COMPARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3.5v17"/><path d="M6.5 12h3M14.5 12h3M8 10l1.5 2L8 14M16 10l-1.5 2 1.5 2"/></svg>`
const ICON_GRIDSPLIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M12 3.5v17M3.5 12h17"/></svg>`

let extraCssInstalled = false
function installCss() {
  installV2ShellCss()
  if (extraCssInstalled) return
  extraCssInstalled = true
  const style = document.createElement('style')
  style.textContent = ED_CSS
  document.head.appendChild(style)
}

function el(tag: string, cls: string, html?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

interface EditorShellConfig {
  component: Component
  titleKey: string
  icon: string
  minW?: number
  minH?: number
}

function makeEditorShell(config: EditorShellConfig) {
  return function attach(node: ComfyNode, kind: StageKind, variant: StageVariant) {
    installCss()
    const anyNode = node as any

    const card = el('div', 'v2-card v2-ed-card')
    const label = el('div', 'v2-label v2-handle', `${ICON_GRIP}${config.icon}<span>${t(config.titleKey)}</span>`)
    const editorAnchor = el('div', 'v2-ed-host')
    editorAnchor.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;'
    card.append(label, editorAnchor)

    node.addDOMWidget('v2_shell', 'v2', card, {
      getMinHeight: () => 300,
      hideOnZoom: false,
      serialize: false,
    })

    ensureMinSize(node, config.minW ?? 320, config.minH ?? 360)

    const stageApi = useStageNode(node as any, kind, variant)
    const { state: stageState } = stageApi
    const scope = createNodeScope(node)
    scope.run(() => bindProgressRing(card, stageState))

    const islands = createIslandGroup()
    const mountApps = () => {
      islands.unmountAll()
      islands.mount(editorAnchor, config.component, { node, state: stageState })
    }
    mountApps()

    const prevConfigure = anyNode.onConfigure
    anyNode.onConfigure = function (...args: unknown[]) {
      prevConfigure?.apply(this, args)
      queueMicrotask(mountApps)
    }

    bindNodeDrag(node, card)

    bindShellChrome(node, { scope, card, socketAnchor: editorAnchor, state: stageState })

    const prevRemoved = anyNode.onRemoved
    anyNode.onRemoved = function (...args: unknown[]) {
      islands.unmountAll()
      prevRemoved?.apply(this, args)
    }

    return stageApi
  }
}

V2_SHELLS['ComfyTV.RotateStage'] = makeEditorShell({
  component: RotateEditorV2, titleKey: 'v2.ed.rotate', icon: ICON_ROTATE,
})
V2_SHELLS['ComfyTV.MirrorStage'] = makeEditorShell({
  component: MirrorEditorV2, titleKey: 'v2.ed.mirror', icon: ICON_MIRROR,
})
V2_SHELLS['ComfyTV.ColorGradeStage'] = makeEditorShell({
  component: GradeEditorV2, titleKey: 'v2.ed.grade', icon: ICON_GRADE, minH: 560,
})
V2_SHELLS['ComfyTV.CompareStage'] = makeEditorShell({
  component: CompareEditorV2, titleKey: 'v2.ed.compare', icon: ICON_COMPARE,
})
V2_SHELLS['ComfyTV.GridSplitStage'] = makeEditorShell({
  component: GridSplitEditorV2, titleKey: 'v2.ed.gridSplit', icon: ICON_GRIDSPLIT, minH: 460,
})

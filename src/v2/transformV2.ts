import type { Component } from 'vue'

import { useStageNode } from '@/composables/stages/useStageNode'
import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { bindNodeDrag, bindProgressRing, bindShellChrome, createNodeScope, ensureMinSize, ICON_GRIP, installV2ShellCss } from '@/v2/imageStageV2'
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
  background: linear-gradient(160deg, #23232a 0%, #1a1a20 100%);
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
  color: #6b6b74;
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
  background: #232327;
  border: 1px solid rgba(255, 255, 255, 0.05);
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
  color: #8f8f98;
}
.v2-ed__value {
  font: 500 11px/1 ui-monospace, monospace;
  color: #d9d9de;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.v2-ed__range {
  width: 100%;
  accent-color: #a78bfa;
}
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
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: #d9d9de;
  font: 500 11px/1 system-ui, sans-serif;
  cursor: pointer;
  appearance: none;
  user-select: none;
  white-space: nowrap;
}
.v2-ed__chip:hover { border-color: rgba(167, 139, 250, 0.45); }
.v2-ed__chip[data-on="1"] {
  background: rgba(167, 139, 250, 0.16);
  border-color: rgba(167, 139, 250, 0.6);
  color: #cdbdfc;
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
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
}
.v2-ed__stepbtn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: #d9d9de;
  font: 500 13px/1 system-ui, sans-serif;
  cursor: pointer;
  appearance: none;
}
.v2-ed__stepbtn:hover { background: rgba(167, 139, 250, 0.2); color: #cdbdfc; }
.v2-ed__stepval {
  margin-left: auto;
  min-width: 24px;
  text-align: center;
  font: 500 11px/1 ui-monospace, monospace;
  color: #d9d9de;
}
.v2-ed__status {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: 14px;
  background: #232327;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font: 500 11px/1 system-ui, sans-serif;
  color: #8f8f98;
}
.v2-ed__dims { color: #b9b9c0; font-variant-numeric: tabular-nums; }
.v2-ed__spacer { flex: 1; }
.v2-ed__busy,
.v2-ed__ok {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #9a9aa2;
}
.v2-ed__busy::before,
.v2-ed__ok::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #a78bfa;
  box-shadow: 0 0 6px rgba(167, 139, 250, 0.7);
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

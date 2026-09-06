import { effectScope, watch } from 'vue'

import { t } from '@/i18n'

const ID = 'comfytv-app-mode-hint'

function hasStages(graph: any): boolean {
  return (graph?._nodes ?? []).some((n: any) =>
    String(n?.comfyClass ?? n?.type ?? '').startsWith('ComfyTV.'))
}

function isAppMode(mode: unknown): boolean {
  return mode === 'app' || mode === 'builder:arrange'
}

export function renderAppModeHint(app: any, show: boolean): HTMLElement | null {
  const existing = document.getElementById(ID)
  if (!show) {
    existing?.remove()
    return null
  }
  if (existing) return existing
  const el = document.createElement('div')
  el.id = ID
  el.setAttribute('role', 'status')
  Object.assign(el.style, {
    position: 'fixed', left: '50%', top: '72px', transform: 'translateX(-50%)',
    zIndex: '1200', display: 'flex', gap: '12px', alignItems: 'center',
    padding: '10px 14px', borderRadius: '10px', fontSize: '13px',
    background: 'var(--comfy-menu-bg, #2b2b2b)', color: 'var(--fg-color, #ddd)',
    border: '1px solid var(--border-color, #555)', boxShadow: '0 4px 16px rgba(0,0,0,.35)',
  } as Partial<CSSStyleDeclaration>)
  const text = document.createElement('span')
  text.textContent = t('appMode.hint')
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = t('appMode.back')
  Object.assign(btn.style, {
    cursor: 'pointer', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-color, #555)',
    background: 'var(--comfy-input-bg, #1e1e1e)', color: 'inherit', font: 'inherit',
  } as Partial<CSSStyleDeclaration>)
  btn.addEventListener('click', () => {
    const wf = app?.extensionManager?.workflow?.activeWorkflow
    if (wf) wf.activeMode = 'graph'
  })
  el.append(text, btn)
  document.body.appendChild(el)
  return el
}

export function installAppModeHint(app: any): () => void {
  const store = app?.extensionManager?.workflow
  const check = () => {
    const mode = store?.activeWorkflow?.activeMode ?? 'graph'
    renderAppModeHint(app, isAppMode(mode) && hasStages(app?.graph))
  }
  let stop: () => void
  if (typeof store?.$subscribe === 'function') {
    check()
    stop = store.$subscribe(() => check(), { detached: true })
  } else {
    const scope = effectScope(true)
    scope.run(() => { watch(() => store?.activeWorkflow?.activeMode ?? 'graph', check, { immediate: true }) })
    stop = () => scope.stop()
  }
  return () => {
    stop()
    renderAppModeHint(app, false)
  }
}

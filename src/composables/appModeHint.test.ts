import { nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/i18n', () => ({ t: (k: string) => k }))

import { installAppModeHint, renderAppModeHint } from './appModeHint'

function makeApp(mode: string, stages = true) {
  return {
    extensionManager: { workflow: reactive({ activeWorkflow: { activeMode: mode } }) },
    graph: { _nodes: stages ? [{ comfyClass: 'ComfyTV.ImageStage' }] : [{ comfyClass: 'KSampler' }] },
  }
}

afterEach(() => { document.getElementById('comfytv-app-mode-hint')?.remove() })

describe('app mode hint', () => {
  it('shows only in app mode when ComfyTV stages exist, and hides again', async () => {
    const app = makeApp('graph')
    const stop = installAppModeHint(app)
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
    app.extensionManager.workflow.activeWorkflow.activeMode = 'app'
    await nextTick()
    const el = document.getElementById('comfytv-app-mode-hint')!
    expect(el.textContent).toContain('appMode.hint')
    app.extensionManager.workflow.activeWorkflow.activeMode = 'graph'
    await nextTick()
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
    stop()
  })

  it('uses the host store subscription when the store offers one', () => {
    let cb: (() => void) | null = null
    const unsub = vi.fn()
    const store: any = { activeWorkflow: { activeMode: 'graph' }, $subscribe: vi.fn((fn: () => void) => { cb = fn; return unsub }) }
    const app = { extensionManager: { workflow: store }, graph: { _nodes: [{ comfyClass: 'ComfyTV.ImageStage' }] } }
    const stop = installAppModeHint(app)
    expect(store.$subscribe).toHaveBeenCalledTimes(1)
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
    store.activeWorkflow.activeMode = 'app'
    cb!()
    expect(document.getElementById('comfytv-app-mode-hint')).not.toBeNull()
    stop()
    expect(unsub).toHaveBeenCalled()
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
  })

  it('stays quiet for graphs without stages and the back button leaves app mode', async () => {
    const plain = makeApp('app', false)
    const stop = installAppModeHint(plain)
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
    stop()
    const app = makeApp('app')
    renderAppModeHint(app, true)
    document.querySelector<HTMLButtonElement>('#comfytv-app-mode-hint button')!.click()
    expect(app.extensionManager.workflow.activeWorkflow.activeMode).toBe('graph')
    renderAppModeHint(app, false)
    expect(document.getElementById('comfytv-app-mode-hint')).toBeNull()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

const combo = vi.hoisted(() => ({
  addOptionEverywhere: vi.fn(),
  removeOptionEverywhere: vi.fn(),
  setDefaultOptionInDefs: vi.fn(),
}))
const validator = vi.hoisted(() => ({ invalidateWorkflowInfo: vi.fn() }))
vi.mock('@/composables/stages/workflowCombo', () => combo)
vi.mock('@/composables/stages/useWorkflowValidator', () => validator)

import { applyWorkflowEvent, installWorkflowRegistrySync } from './workflowRegistrySync'

function makeApp() {
  return {
    refreshComboInNodes: vi.fn(async () => {}),
    graph: { setDirtyCanvas: vi.fn() },
    api: { addEventListener: vi.fn() },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('applyWorkflowEvent', () => {
  it('adds imported and rescanned workflows to every combo', () => {
    const app = makeApp()
    expect(applyWorkflowEvent(app, { event: 'import', kind: 'image', label: 'New WF' })).toBe(true)
    expect(combo.addOptionEverywhere).toHaveBeenCalledWith('image', 'New WF')
    applyWorkflowEvent(app, { event: 'rescan', added: [{ kind: 'video', label: 'A' }, { kind: 'text', label: 'B' }] })
    expect(combo.addOptionEverywhere).toHaveBeenCalledWith('video', 'A')
    expect(combo.addOptionEverywhere).toHaveBeenCalledWith('text', 'B')
    expect(app.refreshComboInNodes).toHaveBeenCalledTimes(2)
    expect(validator.invalidateWorkflowInfo).toHaveBeenCalled()
  })

  it('hides, unhides, unlinks and re-defaults', () => {
    const app = makeApp()
    applyWorkflowEvent(app, { event: 'hidden', kind: 'image', label: 'X', hidden: true })
    expect(combo.removeOptionEverywhere).toHaveBeenCalledWith('image', 'X', false)
    applyWorkflowEvent(app, { event: 'hidden', kind: 'image', label: 'X', hidden: false })
    expect(combo.addOptionEverywhere).toHaveBeenCalledWith('image', 'X')
    applyWorkflowEvent(app, { event: 'unlink', kind: 'image', label: 'X' })
    expect(combo.removeOptionEverywhere).toHaveBeenCalledWith('image', 'X')
    applyWorkflowEvent(app, { event: 'default', kind: 'image', label: 'X', default: true })
    expect(combo.setDefaultOptionInDefs).toHaveBeenCalledWith('image', 'X')
    applyWorkflowEvent(app, { event: 'default', kind: 'image', label: 'X', default: false })
    expect(combo.setDefaultOptionInDefs).toHaveBeenCalledWith('image', null)
  })

  it('ignores malformed or unknown events', () => {
    const app = makeApp()
    expect(applyWorkflowEvent(app, { event: 'import', kind: 'image' })).toBe(false)
    expect(applyWorkflowEvent(app, { event: 'bogus' })).toBe(false)
    expect(app.refreshComboInNodes).not.toHaveBeenCalled()
  })

  it('installs a single websocket listener', () => {
    const app = makeApp()
    expect(installWorkflowRegistrySync(app)).toBe(true)
    expect(installWorkflowRegistrySync(app)).toBe(false)
    expect(app.api.addEventListener).toHaveBeenCalledWith('comfytv-workflows', expect.any(Function))
    const handler = app.api.addEventListener.mock.calls[0][1]
    handler({ detail: { event: 'import', kind: 'audio', label: 'Song' } })
    expect(combo.addOptionEverywhere).toHaveBeenCalledWith('audio', 'Song')
  })
})

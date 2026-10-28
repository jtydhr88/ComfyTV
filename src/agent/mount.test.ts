import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

const panel = vi.hoisted(() => ({
  enabled: true,
  isVisible: true,
  $subscribe: vi.fn(),
}))

vi.mock('./native/stores/agent/agentPanelStore', () => ({
  useAgentPanelStore: () => panel,
}))
vi.mock('./shell/AgentDock.vue', () => ({
  default: { render: () => 'Bot panel' },
}))
vi.mock('./shell/AgentEntryButton.vue', () => ({
  default: { render: () => 'Bot button' },
}))
vi.mock('@/composables/ghostPlacementInert', () => ({
  guardGhostPlacement: () => () => {},
}))
vi.mock('@/lib/comfyApp', () => ({ app: { api: { addEventListener: vi.fn() } } }))
vi.mock('@/i18n', () => ({ i18n: { install() {} } }))

import { installAgentPanel, setAgentPanelEnabled } from './mount'

afterEach(() => {
  setAgentPanelEnabled(false)
  document.body.replaceChildren()
})

describe('agent panel mounting', () => {
  it.each([
    ['explicit row direction', 'flex flex-row min-h-0 flex-1'],
    ['implicit row direction', 'pointer-events-none flex min-h-0 flex-1'],
  ])('opens in the canvas overlay with %s', (_name, rowClass) => {
    document.body.innerHTML = `
      <div class="absolute z-999"><div class="flex flex-1"></div></div>
      <div id="graph-canvas-container">
        <div class="absolute z-999 flex flex-col">
          <div data-testid="integrated-tab-bar-actions"></div>
          <div class="${rowClass}" data-testid="canvas-overlay-row"></div>
        </div>
      </div>
    `
    panel.enabled = true
    installAgentPanel(createPinia())

    const row = document.querySelector('[data-testid="canvas-overlay-row"]')!
    expect(row.querySelector('#comfytv-agent-dock')?.textContent).toBe('Bot panel')
    expect(document.querySelector('#comfytv-agent-entry')?.textContent).toBe('Bot button')
  })
})

import type { Pinia } from 'pinia'
import { createApp } from 'vue'
import type { App } from 'vue'

import { guardGhostPlacement } from '@/composables/ghostPlacementInert'
import { i18n } from '@/i18n'
import { app } from '@/lib/comfyApp'

import { useAgentPanelStore } from './native/stores/agent/agentPanelStore'
import AgentDock from './shell/AgentDock.vue'
import AgentEntryButton from './shell/AgentEntryButton.vue'

const EVENT_TYPES = [
  'agent_thinking',
  'agent_tool_call',
  'agent_message_delta',
  'agent_message_done',
  'agent_active_tab',
  'agent_ask',
  'agent_ask_resolved',
]

const DOCK_ID = 'comfytv-agent-dock'
const ENTRY_ID = 'comfytv-agent-entry'
const MAX_FRAMES = 600

interface Mounted {
  host: HTMLElement
  app: App
  unguard: () => void
}

let pinia: Pinia | null = null
let dock: Mounted | null = null
let entry: Mounted | null = null
let dockRetry = 0
let entryRetry = 0

function store() {
  return pinia ? useAgentPanelStore(pinia) : null
}

function tooltipDirective() {
  const apply = (el: HTMLElement, binding: { value: unknown }) => {
    const v = binding.value as { value?: string } | string | undefined
    const text = typeof v === 'string' ? v : v?.value
    if (text) el.setAttribute('title', text)
    else el.removeAttribute('title')
  }
  return { mounted: apply, updated: apply }
}

function mountInto(host: HTMLElement, component: typeof AgentDock): Mounted {
  const vueApp = createApp(component)
  if (pinia) vueApp.use(pinia)
  vueApp.use(i18n)
  vueApp.directive('tooltip', tooltipDirective())
  vueApp.mount(host)
  return { host, app: vueApp, unguard: guardGhostPlacement(app, host) }
}

function unmount(mounted: Mounted | null): null {
  if (mounted) {
    mounted.unguard()
    mounted.app.unmount()
    mounted.host.remove()
  }
  return null
}

function overlayRoot(): HTMLElement | null {
  return document.querySelector('#graph-canvas-container > div.absolute.z-999 > div.flex-1')
}

function actionsBar(): HTMLElement | null {
  return document.querySelector('[data-testid="integrated-tab-bar-actions"]')
}

let dockPending = false
let entryPending = false

function mountDock(): void {
  const root = overlayRoot()
  if (!root) {
    if (dockRetry++ < MAX_FRAMES) requestAnimationFrame(mountDock)
    else dockPending = false
    return
  }
  dockPending = false
  document.getElementById(DOCK_ID)?.remove()
  const host = document.createElement('div')
  host.id = DOCK_ID
  host.className = 'ctv:contents'
  root.append(host)
  dock = mountInto(host, AgentDock)
}

function mountEntry(): void {
  const bar = actionsBar()
  if (!bar) {
    if (entryRetry++ < MAX_FRAMES) requestAnimationFrame(mountEntry)
    else entryPending = false
    return
  }
  entryPending = false
  document.getElementById(ENTRY_ID)?.remove()
  const host = document.createElement('div')
  host.id = ENTRY_ID
  host.className = 'ctv:contents'
  bar.prepend(host)
  entry = mountInto(host, AgentEntryButton)
}

function sync(): void {
  const s = store()
  if (!s) return
  if (s.enabled && !entryPending && !(entry && entry.host.isConnected)) {
    entry = unmount(entry)
    entryPending = true
    entryRetry = 0
    mountEntry()
  }
  if (!s.enabled) entry = unmount(entry)
  if (s.isVisible && !dockPending && !(dock && dock.host.isConnected)) {
    dock = unmount(dock)
    dockPending = true
    dockRetry = 0
    mountDock()
  }
}

export function installAgentPanel(activePinia: Pinia): void {
  pinia = activePinia
  const api = (app as any).api
  for (const type of EVENT_TYPES) api?.addEventListener?.(`comfytv_${type}`, () => {})
  store()?.$subscribe(() => sync())
  sync()
}

export function setAgentPanelEnabled(next: boolean): void {
  const s = store()
  if (!s) return
  s.enabled = next
  if (!next) dock = unmount(dock)
  sync()
}

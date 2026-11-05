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

interface Mounted {
  host: HTMLElement
  app: App
  unguard: () => void
}

let pinia: Pinia | null = null
let dock: Mounted | null = null
let entry: Mounted | null = null
let observer: MutationObserver | null = null

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

function createHost(id: string): HTMLElement {
  document.getElementById(id)?.remove()
  const host = document.createElement('div')
  host.id = id
  host.className = 'ctv:contents'
  return host
}

function mountDock(): void {
  const root = overlayRoot()
  if (!root) return
  unmount(dock)
  const host = createHost(DOCK_ID)
  root.append(host)
  dock = mountInto(host, AgentDock)
}

function mountEntry(): void {
  const bar = actionsBar()
  if (!bar) return
  unmount(entry)
  const host = createHost(ENTRY_ID)
  bar.prepend(host)
  entry = mountInto(host, AgentEntryButton)
}

function sync(): void {
  const s = store()
  if (!s) return
  if (!s.enabled) entry = unmount(entry)
  else if (!entry?.host.isConnected) mountEntry()
  if (s.isVisible && !dock?.host.isConnected) mountDock()
  if (s.enabled || s.isVisible) {
    if (!observer) {
      observer = new MutationObserver(sync)
      observer.observe(document.body, { childList: true, subtree: true })
    }
  } else {
    observer?.disconnect()
    observer = null
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

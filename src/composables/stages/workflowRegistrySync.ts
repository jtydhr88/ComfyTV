import {
  addOptionEverywhere,
  removeOptionEverywhere,
  setDefaultOptionInDefs,
} from '@/composables/stages/workflowCombo'
import { invalidateWorkflowInfo } from '@/composables/stages/useWorkflowValidator'

export function applyWorkflowEvent(app: any, detail: any): boolean {
  const event = String(detail?.event ?? '')
  const kind = String(detail?.kind ?? '')
  const label = String(detail?.label ?? '')
  invalidateWorkflowInfo()
  switch (event) {
    case 'import':
      if (!kind || !label) return false
      addOptionEverywhere(kind, label)
      break
    case 'rescan':
      for (const a of Array.isArray(detail?.added) ? detail.added : []) {
        if (a?.kind && a?.label) addOptionEverywhere(String(a.kind), String(a.label))
      }
      break
    case 'hidden':
      if (!kind || !label) return false
      if (detail?.hidden) removeOptionEverywhere(kind, label, false)
      else addOptionEverywhere(kind, label)
      break
    case 'unlink':
      if (!kind || !label) return false
      removeOptionEverywhere(kind, label)
      break
    case 'default':
      if (!kind) return false
      setDefaultOptionInDefs(kind, detail?.default && label ? label : null)
      break
    default:
      return false
  }
  void app?.refreshComboInNodes?.()
  app?.graph?.setDirtyCanvas?.(true, true)
  return true
}

export function installWorkflowRegistrySync(app: any): boolean {
  if (!app || app.__comfytvWorkflowSyncInstalled) return false
  const api = app.api
  if (!api?.addEventListener) return false
  app.__comfytvWorkflowSyncInstalled = true
  api.addEventListener('comfytv-workflows', (event: any) => {
    applyWorkflowEvent(app, event?.detail ?? event)
  })
  return true
}

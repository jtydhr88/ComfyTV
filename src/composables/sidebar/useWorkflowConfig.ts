import { ref } from 'vue'

import { invalidateWorkflowInfo } from '@/composables/stages/useWorkflowValidator'
import { prepareWorkflow } from '@/composables/stages/useWorkflowPrep'
import { app } from '@/lib/comfyApp'
import { useSelectionStore } from '@/stores/selectionStore'
import {
  downloadBlob,
  extractFilenameFromContentDisposition,
} from '@/utils/download'

import type { ConfigPayload } from './workflowConfigCatalog'

async function fetchJson(path: string, init?: RequestInit) {
  const resp = await (app as any).api.fetchApi(path, init)
  if (resp.status >= 400) {
    let detail = `${resp.status} ${resp.statusText}`
    try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
    throw new Error(detail)
  }
  return resp.json()
}

export function useWorkflowConfig(t: (key: string, args?: Record<string, unknown>) => string) {
  const selection = useSelectionStore()

  const config    = ref<ConfigPayload | null>(null)
  const loadError = ref<string | null>(null)

  const exportBusy  = ref(false)
  const exportError = ref<string | null>(null)

  const resetBusy  = ref(false)
  const resetError = ref<string | null>(null)

  async function loadConfig(kind: string, label: string) {
    loadError.value = null
    config.value = null
    try {
      try { await prepareWorkflow(kind, label) } catch {}
      config.value = await fetchJson(
        `/comfytv/workflows/config?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`
      )
    } catch (e: any) {
      loadError.value = String(e?.message || e || 'load failed')
    }
  }

  async function onExportPreset() {
    const sel = selection.selected
    if (!sel || !config.value) return
    exportError.value = null
    exportBusy.value = true
    try {
      const resp = await (app as any).api.fetchApi(
        `/comfytv/workflows/preset?kind=${encodeURIComponent(sel.workflowKind)}` +
        `&label=${encodeURIComponent(sel.workflowLabel)}`,
      )
      if (resp.status >= 400) {
        let detail = `${resp.status} ${resp.statusText}`
        try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
        throw new Error(detail)
      }
      const filename = extractFilenameFromContentDisposition(
        resp.headers.get('Content-Disposition'),
      ) ?? 'preset.json'
      downloadBlob(filename, await resp.blob())
    } catch (e: any) {
      const detail = String(e?.message || e || 'export failed')
      exportError.value = t('configSidebar.exportPresetFailed', { detail })
    } finally {
      exportBusy.value = false
    }
  }

  async function onResetToPreset() {
    if (!config.value) return
    if (!window.confirm(t('configSidebar.resetToPresetConfirm'))) return
    resetBusy.value = true
    resetError.value = null
    try {
      const resp = await (app as any).api.fetchApi(
        `/comfytv/workflows/${config.value.id}/reset_to_preset`,
        { method: 'POST' },
      )
      if (resp.status >= 400) {
        let detail = `${resp.status} ${resp.statusText}`
        try { const j = await resp.json(); if (j?.error) detail += ` — ${j.error}` } catch {}
        throw new Error(detail)
      }
      const sel = selection.selected
      if (sel?.workflowKind && sel?.workflowLabel) {
        await loadConfig(sel.workflowKind, sel.workflowLabel)
      }
      invalidateWorkflowInfo()
    } catch (e: any) {
      const detail = String(e?.message || e || 'reset failed')
      resetError.value = t('configSidebar.resetToPresetFailed', { detail })
    } finally {
      resetBusy.value = false
    }
  }

  function notifyValidatorOfBindingChange() {
    invalidateWorkflowInfo()
    selection.bumpBindings()
  }

  async function postBinding(payload: Record<string, unknown>) {
    if (!config.value) return
    try {
      await fetchJson('/comfytv/workflows/config/binding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: config.value.id, ...payload }),
      })
      notifyValidatorOfBindingChange()
    } catch (e: any) {
      loadError.value = `save failed: ${e?.message || e}`
    }
  }

  async function deleteBinding(node_id: string, widget_name: string) {
    if (!config.value) return
    try {
      await fetchJson('/comfytv/workflows/config/binding', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: config.value.id,
          node_id, input_name: widget_name,
        }),
      })
      notifyValidatorOfBindingChange()
    } catch (e: any) {
      loadError.value = `delete failed: ${e?.message || e}`
    }
  }

  return {
    config,
    loadError,
    exportBusy, exportError,
    resetBusy,  resetError,
    loadConfig,
    onExportPreset,
    onResetToPreset,
    postBinding,
    deleteBinding,
  }
}

import { ref } from 'vue'

import { apiFetch, apiSend, OkSchema, WorkflowConfigSchema } from '@/api'
import { invalidateWorkflowInfo } from '@/composables/stages/useWorkflowValidator'
import { prepareWorkflow } from '@/composables/stages/useWorkflowPrep'
import { app } from '@/lib/comfyApp'
import { useSelectionStore } from '@/stores/selectionStore'
import {
  downloadBlob,
  extractFilenameFromContentDisposition,
} from '@/utils/download'

import type { ConfigPayload } from './workflowConfigCatalog'

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
      config.value = await apiFetch(
        `/comfytv/workflows/config?kind=${encodeURIComponent(kind)}&label=${encodeURIComponent(label)}`,
        WorkflowConfigSchema,
      ) as ConfigPayload
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
      await apiSend(
        `/comfytv/workflows/${config.value.id}/reset_to_preset`,
        'POST',
        OkSchema,
      )
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
      await apiSend('/comfytv/workflows/config/binding', 'POST', OkSchema, {
        workflow_id: config.value.id, ...payload,
      })
      notifyValidatorOfBindingChange()
    } catch (e: any) {
      loadError.value = `save failed: ${e?.message || e}`
    }
  }

  async function deleteBinding(node_id: string, widget_name: string) {
    if (!config.value) return
    try {
      await apiSend('/comfytv/workflows/config/binding', 'DELETE', OkSchema, {
        workflow_id: config.value.id,
        node_id, input_name: widget_name,
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

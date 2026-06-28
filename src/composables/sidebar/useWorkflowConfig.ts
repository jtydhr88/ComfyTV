import { ref } from 'vue'

import { apiFetch, apiSend, OkSchema, uploadApiSidecar, WorkflowConfigSchema } from '@/api'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
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

  const uploadApiBusy  = ref(false)
  const uploadApiError = ref<string | null>(null)

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
    const ok = await askConfirm({
      title: t('configSidebar.resetToPreset'),
      message: t('configSidebar.resetToPresetConfirm'),
      danger: true,
    })
    if (!ok) return
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

  function onUploadApiSidecar() {
    const sel = selection.selected
    if (!sel?.workflowKind || !sel?.workflowLabel) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return
      uploadApiError.value = null
      uploadApiBusy.value = true
      try {
        const text = await file.text()
        try { JSON.parse(text) } catch { throw new Error(t('configSidebar.uploadApiNotJson')) }
        const res = await uploadApiSidecar(sel.workflowKind, sel.workflowLabel, text)
        await loadConfig(sel.workflowKind, sel.workflowLabel)
        invalidateWorkflowInfo()
        ;(app as any)?.extensionManager?.toast?.add?.({
          severity: 'success',
          summary: t('configSidebar.uploadApiOk', { n: res.node_count }),
          life: 4000,
        })
      } catch (e: any) {
        uploadApiError.value = t('configSidebar.uploadApiFailed', {
          detail: String(e?.message || e || 'upload failed'),
        })
      } finally {
        uploadApiBusy.value = false
      }
    }
    document.body.appendChild(input)
    input.click()
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
    uploadApiBusy, uploadApiError,
    loadConfig,
    onExportPreset,
    onResetToPreset,
    onUploadApiSidecar,
    postBinding,
    deleteBinding,
  }
}

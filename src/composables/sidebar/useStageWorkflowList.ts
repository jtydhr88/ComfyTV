import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { importWorkflow, listWorkflowOverview, rescanWorkflows } from '@/api'
import type { WorkflowOverview } from '@/api'
import { addOptionEverywhere } from '@/composables/stages/workflowCombo'
import { app } from '@/lib/comfyApp'
import { WORKFLOW_API_GENERATED } from '@/utils/workflowEvents'
import type { WorkflowApiGeneratedDetail } from '@/utils/workflowEvents'

export function workflowFileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

export function useStageWorkflowList(
  kind: Ref<string>,
  isActive: () => boolean | undefined,
  onKinds: (kinds: string[]) => void,
) {
  const { t } = useI18n()

  const rows = ref<WorkflowOverview[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const importBusy = ref(false)
  const rescanBusy = ref(false)
  const recentAdded = ref<Set<string>>(new Set())

  async function reload() {
    loading.value = true
    loadError.value = ''
    try {
      const res = await listWorkflowOverview(kind.value)
      rows.value = res.workflows
      recentAdded.value = new Set(
        res.recent_added.filter(r => r.kind === kind.value).map(r => r.label),
      )
      onKinds(res.kinds)
    } catch (e: any) {
      loadError.value = String(e?.message || e)
    } finally {
      loading.value = false
    }
  }

  async function onRescan() {
    rescanBusy.value = true
    try {
      const res = await rescanWorkflows()
      for (const a of res.added) addOptionEverywhere(a.kind, a.label)
      void (app as any)?.refreshComboInNodes?.()
      if (res.added.length) {
        const names = res.added.slice(0, 5).map(a => `${a.kind}/${a.label}`).join(', ')
        const more = res.added.length > 5 ? ` +${res.added.length - 5}` : ''
        toast('success',
          t('stageManager.rescanFound', { n: res.added.length }),
          names + more)
      } else {
        toast('info', t('stageManager.rescanNone'), t('stageManager.rescanNoneDetail'))
      }
      await reload()
    } catch (e: any) {
      toast('error', t('stageManager.rescanFailed'), String(e?.message || e))
    } finally {
      rescanBusy.value = false
    }
  }

  async function importFile(file: File) {
    importBusy.value = true
    try {
      const text = await file.text()
      try { JSON.parse(text) } catch {
        toast('warn', t('workflow.importFailed'), t('workflow.notJson'))
        return
      }
      const res = await importWorkflow(kind.value, file.name, text)
      addOptionEverywhere(kind.value, res.label)
      toast('success', t('workflow.imported', { label: res.label }))
      await reload()
    } catch (e: any) {
      toast('error', t('workflow.importFailed'), String(e?.message || e))
    } finally {
      importBusy.value = false
    }
  }

  function onImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.style.display = 'none'
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) return
      await importFile(file)
    }
    document.body.appendChild(input)
    input.click()
  }

  function onApiGenerated(e: Event) {
    const d = (e as CustomEvent<WorkflowApiGeneratedDetail>).detail
    if (!d || d.kind !== kind.value) return
    const row = rows.value.find(r => r.label === d.label)
    if (row) row.has_api = true
  }

  onMounted(() => window.addEventListener(WORKFLOW_API_GENERATED, onApiGenerated))
  onBeforeUnmount(() => window.removeEventListener(WORKFLOW_API_GENERATED, onApiGenerated))

  watch(kind, () => { void reload() }, { immediate: true })
  watch(isActive, (a, prev) => { if (a && !prev) void reload() })

  return {
    rows,
    loading,
    loadError,
    importBusy,
    rescanBusy,
    recentAdded,
    reload,
    onRescan,
    onImport,
    importFile,
  }
}

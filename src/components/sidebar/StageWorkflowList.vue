<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5">
      <span class="ctv:text-3xs ctv:font-mono ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-base-foreground/5 ctv:text-muted-foreground">
        {{ rows.length }}
      </span>
      <span class="ctv:flex-1"></span>
      <button :class="iconBtn" :title="$t('stageManager.refresh')" :disabled="loading" @click="reload">
        <i :class="['pi pi-refresh', loading ? 'pi-spin' : '']" />
      </button>
      <button :class="importBtn" :title="$t('stageManager.rescanTooltip')" :disabled="rescanBusy" @click="onRescan">
        <i :class="['pi pi-sync', rescanBusy ? 'pi-spin' : '']" /> {{ $t('stageManager.rescan') }}
      </button>
      <button :class="importBtn" :disabled="importBusy" @click="onImport">
        <i class="pi pi-upload" /> {{ $t('stageManager.import') }}
      </button>
    </div>

    <div v-if="loadError"
         class="ctv:py-1.5 ctv:px-2 ctv:text-xs ctv:rounded
                ctv:bg-destructive-background/15 ctv:border ctv:border-destructive-background/50 ctv:text-destructive-background">
      {{ loadError }}
    </div>

    <div v-else-if="!loading && rows.length === 0"
         class="ctv:py-3 ctv:text-center ctv:italic ctv:text-muted-foreground/60">
      {{ $t('stageManager.emptyWorkflows') }}
    </div>

    <div
      v-for="w in rows"
      :key="w.id"
      class="ctv:flex ctv:flex-col ctv:gap-0.5 ctv:py-1.5 ctv:px-2 ctv:rounded ctv:border ctv:border-border-subtle"
    >
      <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:flex-wrap">
        <span class="ctv:font-semibold ctv:truncate">{{ w.label }}</span>
        <span v-if="recentAdded.has(w.label)"
              :class="[badge, 'ctv:bg-success-background/15 ctv:text-success-background']"
              :title="$t('stageManager.badge.newHint')">
          {{ $t('stageManager.badge.new') }}
        </span>
        <span v-if="w.builtin"
              :class="[badge, 'ctv:bg-base-foreground/10 ctv:text-muted-foreground']"
              :title="$t('stageManager.badge.builtinHint')">
          {{ $t('stageManager.badge.builtin') }}
        </span>
        <span v-if="w.link_type === LINK_TYPE_NATIVE"
              :class="[badge, 'ctv:bg-primary-background/10 ctv:text-primary-foreground']"
              :title="$t('stageManager.badge.linkedHint')">
          <i class="pi pi-link ctv:text-3xs" /> {{ $t('stageManager.badge.linked') }}
        </span>
        <span v-if="!w.file_exists"
              :class="[badge, 'ctv:bg-destructive-background/15 ctv:text-destructive-background']"
              :title="w.file_path">
          <i class="pi pi-exclamation-triangle ctv:text-3xs" /> {{ $t('stageManager.badge.fileMissing') }}
        </span>
        <span v-else-if="w.gui_valid === false"
              :class="[badge, 'ctv:bg-warning-background/15 ctv:text-warning-background']"
              :title="$t('stageManager.badge.notGuiHint')">
          <i class="pi pi-exclamation-triangle ctv:text-3xs" /> {{ $t('stageManager.badge.notGui') }}
        </span>
        <span v-if="w.file_exists && w.gui_valid !== false && !w.has_api"
              :class="[badge, 'ctv:bg-base-foreground/5 ctv:text-muted-foreground']"
              :title="$t('stageManager.badge.noApiHint')">
          {{ $t('stageManager.badge.noApi') }}
        </span>
      </div>
      <div class="ctv:text-3xs ctv:font-mono ctv:text-muted-foreground ctv:truncate" :title="w.file_path">
        {{ fileName(w.file_path) }}
      </div>
      <div v-if="w.description" class="ctv:text-3xs ctv:text-muted-foreground/80 ctv:truncate" :title="w.description">
        {{ w.description }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { importWorkflow, listWorkflowOverview, rescanWorkflows, LINK_TYPE_NATIVE } from '@/api'
import type { WorkflowOverview } from '@/api'
import { addOptionEverywhere } from '@/composables/stages/workflowCombo'
import { app } from '@/lib/comfyApp'
import { WORKFLOW_API_GENERATED } from '@/utils/workflowEvents'
import type { WorkflowApiGeneratedDetail } from '@/utils/workflowEvents'

const props = defineProps<{ kind: string; active?: boolean }>()
const emit = defineEmits<{ (e: 'kinds', kinds: string[]): void }>()

const { t } = useI18n()

const rows = ref<WorkflowOverview[]>([])
const loading = ref(false)
const loadError = ref('')
const importBusy = ref(false)
const rescanBusy = ref(false)
const recentAdded = ref<Set<string>>(new Set())

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await listWorkflowOverview(props.kind)
    rows.value = res.workflows
    recentAdded.value = new Set(
      res.recent_added.filter(r => r.kind === props.kind).map(r => r.label),
    )
    emit('kinds', res.kinds)
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

function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.style.display = 'none'
  input.onchange = async () => {
    const file = input.files?.[0]
    input.remove()
    if (!file) return
    importBusy.value = true
    try {
      const text = await file.text()
      try { JSON.parse(text) } catch {
        toast('warn', t('workflow.importFailed'), t('workflow.notJson'))
        return
      }
      const res = await importWorkflow(props.kind, file.name, text)
      addOptionEverywhere(props.kind, res.label)
      toast('success', t('workflow.imported', { label: res.label }))
      await reload()
    } catch (e: any) {
      toast('error', t('workflow.importFailed'), String(e?.message || e))
    } finally {
      importBusy.value = false
    }
  }
  document.body.appendChild(input)
  input.click()
}

function onApiGenerated(e: Event) {
  const d = (e as CustomEvent<WorkflowApiGeneratedDetail>).detail
  if (!d || d.kind !== props.kind) return
  const row = rows.value.find(r => r.label === d.label)
  if (row) row.has_api = true
}

onMounted(() => window.addEventListener(WORKFLOW_API_GENERATED, onApiGenerated))
onBeforeUnmount(() => window.removeEventListener(WORKFLOW_API_GENERATED, onApiGenerated))

watch(() => props.kind, () => { void reload() }, { immediate: true })
watch(() => props.active, (a, prev) => { if (a && !prev) void reload() })

defineExpose({ reload })

const badge = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:py-px ctv:px-1.5 ctv:rounded ctv:text-3xs ctv:whitespace-nowrap'
const iconBtn = 'ctv:shrink-0 ctv:flex ctv:items-center ctv:justify-center ctv:size-6 ctv:rounded-sm ctv:cursor-pointer ctv:text-xs'
  + ' ctv:border-none ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
const importBtn = 'ctv:inline-flex ctv:items-center ctv:gap-1 ctv:h-6 ctv:px-2 ctv:rounded-sm ctv:text-xs ctv:font-medium ctv:cursor-pointer'
  + ' ctv:border-none ctv:text-secondary-foreground ctv:bg-secondary-background ctv:hover:bg-secondary-background-hover'
  + ' ctv:disabled:pointer-events-none ctv:disabled:opacity-50'
</script>

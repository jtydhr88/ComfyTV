<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-3 ctv:min-h-[320px]">
    <p class="ctv:m-0 ctv:text-xs ctv:leading-relaxed ctv:text-muted-foreground">
      {{ $t('workflowLink.intro') }}
    </p>

    <input
      v-model="filter"
      type="text"
      :placeholder="$t('workflowLink.searchPlaceholder')"
      class="ctv:h-8 ctv:px-2.5 ctv:rounded-sm ctv:text-xs
             ctv:bg-secondary-background ctv:text-base-foreground
             ctv:border ctv:border-border-default ctv:focus-visible:outline-none"
    >

    <div class="ctv:flex-1 ctv:min-h-0 ctv:max-h-[46vh] ctv:overflow-y-auto ctv:-mx-1 ctv:px-1">
      <p v-if="loading" class="ctv:text-xs ctv:text-muted-foreground ctv:py-6 ctv:text-center">
        {{ $t('workflowLink.loading') }}
      </p>
      <p v-else-if="error" class="ctv:text-xs ctv:text-destructive-foreground ctv:py-6 ctv:text-center">
        {{ error }}
      </p>
      <p v-else-if="!filtered.length" class="ctv:text-xs ctv:text-muted-foreground ctv:py-6 ctv:text-center">
        {{ $t('workflowLink.empty') }}
      </p>

      <ul v-else class="ctv:list-none ctv:m-0 ctv:p-0 ctv:flex ctv:flex-col ctv:gap-1">
        <li
          v-for="wf in filtered"
          :key="wf.path"
          class="ctv:flex ctv:items-center ctv:gap-2 ctv:py-1.5 ctv:px-2 ctv:rounded-sm
                 ctv:bg-secondary-background/40 ctv:hover:bg-secondary-background"
        >
          <div class="ctv:flex-1 ctv:min-w-0">
            <div class="ctv:text-xs ctv:text-base-foreground ctv:truncate">{{ wf.name }}</div>
            <div class="ctv:text-[10px] ctv:text-muted-foreground ctv:truncate">{{ wf.path }}</div>
          </div>
          <template v-if="wf.is_linked">
            <span class="ctv:text-[10px] ctv:px-1.5 ctv:py-0.5 ctv:rounded ctv:bg-primary-background/20 ctv:text-primary-foreground">
              {{ $t('workflowLink.linkedBadge') }}
            </span>
            <button
              type="button"
              :class="btnGhost"
              :disabled="busyPath === wf.path"
              @click="onUnlink(wf)"
            >
              {{ busyPath === wf.path ? $t('workflowLink.unlinking') : $t('workflowLink.unlink') }}
            </button>
          </template>
          <button
            v-else
            type="button"
            :class="btnPrimary"
            :disabled="busyPath === wf.path"
            @click="onLink(wf)"
          >
            {{ busyPath === wf.path ? $t('workflowLink.linking') : $t('workflowLink.link') }}
          </button>
        </li>
      </ul>
    </div>

    <div class="ctv:flex ctv:justify-end ctv:gap-2 ctv:border-t ctv:border-border-subtle ctv:pt-2.5">
      <button type="button" :class="btnGhost" @click="onClose">
        {{ $t('dialog.close') }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { linkWorkflow, listNativeWorkflows, unlinkWorkflow } from '@/api'
import type { NativeWorkflow } from '@/api'
import { removeOptionEverywhere } from '@/composables/stages/workflowCombo'
import { app } from '@/lib/comfyApp'
import { i18n } from '@/i18n'

const props = defineProps<{
  kind: string
  onLinked: (result: { label: string }) => void
  onClose: () => void
}>()

const t = i18n.global.t
const items = ref<NativeWorkflow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const filter = ref('')
const busyPath = ref<string | null>(null)

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return items.value
  return items.value.filter(
    (w) => w.name.toLowerCase().includes(q) || w.path.toLowerCase().includes(q),
  )
})

function toast(severity: string, summary: string, detail = '') {
  ;(app as any)?.extensionManager?.toast?.add?.({ severity, summary, detail, life: 5000 })
}

async function load() {
  loading.value = true
  error.value = null
  try {
    items.value = await listNativeWorkflows(props.kind)
  } catch (e: any) {
    error.value = t('workflowLink.loadFailed', { detail: String(e?.message || e) })
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function onLink(wf: NativeWorkflow) {
  if (busyPath.value) return
  busyPath.value = wf.path
  try {
    const res = await linkWorkflow(props.kind, wf.path)
    toast('success', t('workflowLink.linkedToast', { label: res.label }))
    props.onLinked({ label: res.label })
    const it = items.value.find((x) => x.path === wf.path)
    if (it) { it.is_linked = true; it.linked_id = res.id }
  } catch (e: any) {
    toast('error', t('workflowLink.linkFailed'), String(e?.message || e))
  } finally {
    busyPath.value = null
  }
}

async function onUnlink(wf: NativeWorkflow) {
  if (busyPath.value || wf.linked_id == null) return
  busyPath.value = wf.path
  try {
    const res = await unlinkWorkflow(wf.linked_id)
    if (res.label) removeOptionEverywhere(props.kind, res.label)
    toast('success', t('workflowLink.unlinkedToast', { label: res.label ?? wf.name }))
    const it = items.value.find((x) => x.path === wf.path)
    if (it) { it.is_linked = false; it.linked_id = null }
  } catch (e: any) {
    toast('error', t('workflowLink.unlinkFailed'), String(e?.message || e))
  } finally {
    busyPath.value = null
  }
}

const btnGhost = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ' +
  'ctv:bg-secondary-background ctv:text-muted-foreground ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
const btnPrimary = 'ctv:appearance-none ctv:border-none ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:focus-visible:outline-none ctv:h-7 ctv:px-3 ctv:rounded-sm ctv:text-xs ctv:font-medium ' +
  'ctv:bg-primary-background ctv:text-primary-foreground ctv:hover:opacity-90 ' +
  'ctv:disabled:opacity-50 ctv:disabled:cursor-not-allowed'
</script>

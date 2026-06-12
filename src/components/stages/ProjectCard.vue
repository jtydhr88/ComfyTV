<template>
  <div class="flex flex-col gap-1.5 py-1.5 px-2 size-full box-border text-xs text-base-foreground">
    <div class="flex items-center gap-1.5 pb-1 font-semibold text-[11px] uppercase tracking-wide
                text-muted-foreground border-b border-border-default">
      <span class="text-sm">📁</span>
      <span>{{ $t('project.label') }}</span>
    </div>

    <div class="flex items-center gap-1">
      <select
        class="flex-auto py-1 px-1.5 text-xs rounded-sm bg-secondary-background
               text-base-foreground border border-border-default"
        :value="store.currentProjectId"
        @change="onSelectChange"
      >
        <option
          v-for="p in store.projects"
          :key="p.id"
          :value="p.id"
        >
          {{ p.name }}{{ p.id === 'default' ? '  ' + $t('project.shared_suffix') : '' }}
        </option>
        <option v-if="!store.projects.length" value="default">Default {{ $t('project.shared_suffix') }}</option>
      </select>
      <button
        :class="iconBtn()"
        type="button"
        :title="$t('project.refresh')"
        @click="onRefresh"
      >↻</button>
      <button
        :class="iconBtn('primary')"
        type="button"
        :title="$t('project.create')"
        @click="onCreate"
      >+</button>
    </div>

    <div class="flex items-center justify-between text-2xs text-muted-foreground/60">
      <span class="font-mono break-all">{{ $t('project.id_prefix') }} {{ store.currentProjectId }}</span>
      <button
        v-if="store.currentProjectId !== 'default'"
        :class="iconBtn('danger')"
        type="button"
        :title="$t('project.delete')"
        @click="onDelete"
      >🗑</button>
    </div>

    <div v-if="status" class="text-2xs italic text-muted-foreground">{{ status }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/projectStore'

const store = useProjectStore()
const status = ref('')
const { t } = useI18n()

onMounted(async () => {
  if (!store.loaded) {
    try {
      await store.refresh()
    } catch (e) {
      console.warn('[ComfyTV/ProjectCard] initial refresh failed', e)
      status.value = t('project.status.load_failed')
    }
  }
})

async function onRefresh() {
  status.value = t('project.status.refreshing')
  try {
    await store.refresh()
    status.value = ''
  } catch (e) {
    status.value = t('project.status.refresh_failed')
  }
}

async function onCreate() {
  const name = window.prompt(
    t('project.create_prompt'),
    t('project.create_default', { n: Math.floor(Date.now() / 1000) }),
  )
  if (!name) return
  try {
    await store.createProject(name)
    status.value = ''
  } catch (e) {
    status.value = t('project.status.create_failed')
  }
}

async function onDelete() {
  const pid = store.currentProjectId
  if (pid === 'default') return
  if (!window.confirm(t('project.delete_confirm'))) return
  try {
    await store.remove(pid)
    status.value = t('project.status.deleted')
  } catch (e) {
    status.value = t('project.status.delete_failed')
  }
}

function onSelectChange(e: Event) {
  const newId = (e.target as HTMLSelectElement).value
  store.setCurrent(newId)
}

const ICON_BTN_BASE = 'inline-flex items-center justify-center size-6 p-0 rounded-sm cursor-pointer text-[13px]'
const ICON_BTN_VARIANTS = {
  default: 'bg-secondary-background text-base-foreground border border-border-default hover:bg-secondary-background-hover',
  primary: 'bg-secondary-background text-primary-background border border-primary-background/60 hover:bg-primary-background/20',
  danger:  'bg-secondary-background text-destructive-background border border-destructive-background/50 hover:bg-destructive-background/30 hover:text-base-foreground',
} as const
function iconBtn(variant: keyof typeof ICON_BTN_VARIANTS = 'default') {
  return `${ICON_BTN_BASE} ${ICON_BTN_VARIANTS[variant]}`
}
</script>

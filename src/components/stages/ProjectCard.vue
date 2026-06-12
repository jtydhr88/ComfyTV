<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:py-1.5 ctv:px-2 ctv:size-full ctv:box-border ctv:text-xs ctv:text-base-foreground">
    <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:pb-1 ctv:font-semibold ctv:text-[11px] ctv:uppercase ctv:tracking-wide
                ctv:text-muted-foreground ctv:border-b ctv:border-border-default">
      <span class="ctv:text-sm">📁</span>
      <span>{{ $t('project.label') }}</span>
    </div>

    <div class="ctv:flex ctv:items-center ctv:gap-1">
      <select
        class="ctv:flex-auto ctv:py-1 ctv:px-1.5 ctv:text-xs ctv:rounded-sm ctv:bg-secondary-background
               ctv:text-base-foreground ctv:border ctv:border-border-default"
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

    <div class="ctv:flex ctv:items-center ctv:justify-between ctv:text-2xs ctv:text-muted-foreground/60">
      <span class="ctv:font-mono ctv:break-all">{{ $t('project.id_prefix') }} {{ store.currentProjectId }}</span>
      <button
        v-if="store.currentProjectId !== 'default'"
        :class="iconBtn('danger')"
        type="button"
        :title="$t('project.delete')"
        @click="onDelete"
      >🗑</button>
    </div>

    <div v-if="status" class="ctv:text-2xs ctv:italic ctv:text-muted-foreground">{{ status }}</div>
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

const ICON_BTN_BASE = 'ctv:inline-flex ctv:items-center ctv:justify-center ctv:size-6 ctv:p-0 ctv:rounded-sm ctv:cursor-pointer ctv:text-[13px]'
const ICON_BTN_VARIANTS = {
  default: 'ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-default ctv:hover:bg-secondary-background-hover',
  primary: 'ctv:bg-secondary-background ctv:text-primary-background ctv:border ctv:border-primary-background/60 ctv:hover:bg-primary-background/20',
  danger:  'ctv:bg-secondary-background ctv:text-destructive-background ctv:border ctv:border-destructive-background/50 ctv:hover:bg-destructive-background/30 ctv:hover:text-base-foreground',
} as const
function iconBtn(variant: keyof typeof ICON_BTN_VARIANTS = 'default') {
  return `${ICON_BTN_BASE} ${ICON_BTN_VARIANTS[variant]}`
}
</script>

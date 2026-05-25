<template>
  <div class="project-card">
    <div class="header">
      <span class="header-icon">📁</span>
      <span class="header-label">{{ $t('project.label') }}</span>
    </div>

    <div class="picker-row">
      <select
        class="project-select"
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
        class="icon-btn"
        type="button"
        :title="$t('project.refresh')"
        @click="onRefresh"
      >↻</button>
      <button
        class="icon-btn primary"
        type="button"
        :title="$t('project.create')"
        @click="onCreate"
      >+</button>
    </div>

    <div class="meta-row">
      <span class="meta-id">{{ $t('project.id_prefix') }} {{ store.currentProjectId }}</span>
      <button
        v-if="store.currentProjectId !== 'default'"
        class="icon-btn danger"
        type="button"
        :title="$t('project.delete')"
        @click="onDelete"
      >🗑</button>
    </div>

    <div v-if="status" class="status">{{ status }}</div>
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
</script>

<style scoped>
.project-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--input-text, #ddd);
  height: 100%;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #444);
}
.header-icon { font-size: 14px; }

.picker-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.project-select {
  flex: 1 1 auto;
  padding: 4px 6px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.3);
  color: var(--input-text, #ddd);
  border: 1px solid var(--border-color, #555);
  border-radius: 3px;
}

.icon-btn {
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-color, #555);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.8);
  border-radius: 3px;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
.icon-btn.primary {
  border-color: rgba(78, 168, 255, 0.6);
  color: #9dd0ff;
}
.icon-btn.primary:hover {
  background: rgba(78, 168, 255, 0.22);
}
.icon-btn.danger {
  border-color: rgba(220, 50, 50, 0.5);
  color: #ff9a9a;
}
.icon-btn.danger:hover {
  background: rgba(220, 50, 50, 0.3);
  color: #fff;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.45);
}
.meta-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.status {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.55);
  font-style: italic;
}
</style>

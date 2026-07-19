<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-base-foreground">
    <div
      ref="tabBar"
      role="tablist"
      class="ctv-sidebar-tabbar ctv:flex ctv:shrink-0 ctv:gap-1 ctv:p-1.5 ctv:border-b ctv:border-border-subtle ctv:bg-interface-panel-surface ctv:overflow-x-auto"
      @wheel="onTabWheel"
    >
      <button
        v-for="tab in TABS"
        :key="tab.id"
        role="tab"
        :aria-selected="activeTab === tab.id"
        :class="tabClass(activeTab === tab.id)"
        @click="activeTab = tab.id"
      >
        {{ $t(tab.labelKey) }}
      </button>
    </div>

    <div v-show="activeTab === 'workflow'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <WorkflowConfigSidebar />
    </div>
    <div v-show="activeTab === 'assets'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <AssetsPanel :active="activeTab === 'assets'" />
    </div>
    <div v-show="activeTab === 'entries'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <EntriesPanel :active="activeTab === 'entries'" />
    </div>
    <div v-show="activeTab === 'params'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <StageParamsPanel :active="activeTab === 'params'" />
    </div>
    <div v-show="activeTab === 'presets'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <PresetsPanel :active="activeTab === 'presets'" />
    </div>
    <div v-show="activeTab === 'resources'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <ResourcesPanel :active="activeTab === 'resources'" />
    </div>
    <div v-show="activeTab === 'servers'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <ServersPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useStorage } from '@vueuse/core'

import AssetsPanel from '@/components/sidebar/AssetsPanel.vue'
import EntriesPanel from '@/components/sidebar/EntriesPanel.vue'
import PresetsPanel from '@/components/sidebar/PresetsPanel.vue'
import ResourcesPanel from '@/components/sidebar/ResourcesPanel.vue'
import ServersPanel from '@/components/sidebar/ServersPanel.vue'
import WorkflowConfigSidebar from '@/components/sidebar/WorkflowConfigSidebar.vue'
import StageParamsPanel from '@/components/sidebar/StageParamsPanel.vue'

type SidebarTab = 'workflow' | 'assets' | 'entries' | 'params' | 'presets' | 'resources' | 'servers'

const TABS: Array<{ id: SidebarTab; labelKey: string }> = [
  { id: 'workflow',  labelKey: 'sidebar.tab.workflow' },
  { id: 'assets',    labelKey: 'sidebar.tab.assets' },
  { id: 'entries',   labelKey: 'sidebar.tab.entries' },
  { id: 'params',    labelKey: 'sidebar.tab.params' },
  { id: 'presets',   labelKey: 'sidebar.tab.presets' },
  { id: 'resources', labelKey: 'sidebar.tab.resources' },
  { id: 'servers',   labelKey: 'sidebar.tab.servers' },
]

const activeTab = useStorage<SidebarTab>('comfytv:sidebar:active-tab', 'workflow')

const tabBar = ref<HTMLElement | null>(null)

function onTabWheel(event: WheelEvent) {
  const el = tabBar.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  event.preventDefault()
  el.scrollLeft += event.deltaX || event.deltaY
}

onMounted(() => {
  tabBar.value
    ?.querySelector('[aria-selected="true"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function tabClass(active: boolean) {
  return [
    'ctv:flex ctv:shrink-0 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:whitespace-nowrap ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border-none ctv:px-2.5 ctv:py-1.5 ctv:text-xs ctv:transition-all ctv:duration-200',
    'ctv:focus-visible:outline-none',
    active
      ? 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:font-semibold'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover',
  ].join(' ')
}
</script>

<style scoped>
.ctv-sidebar-tabbar {
  scrollbar-width: none;
}
.ctv-sidebar-tabbar::-webkit-scrollbar {
  display: none;
}
</style>

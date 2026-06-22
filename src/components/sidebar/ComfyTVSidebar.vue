<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full ctv:overflow-hidden ctv:text-base-foreground">
    <div
      role="tablist"
      class="ctv:flex ctv:shrink-0 ctv:gap-1 ctv:p-1.5 ctv:border-b ctv:border-border-subtle ctv:bg-interface-panel-surface"
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
    <div v-show="activeTab === 'params'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <StageParamsPanel :active="activeTab === 'params'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStorage } from '@vueuse/core'

import AssetsPanel from '@/components/sidebar/AssetsPanel.vue'
import WorkflowConfigSidebar from '@/components/sidebar/WorkflowConfigSidebar.vue'
import StageParamsPanel from '@/components/sidebar/StageParamsPanel.vue'

type SidebarTab = 'workflow' | 'assets' | 'params'

const TABS: Array<{ id: SidebarTab; labelKey: string }> = [
  { id: 'workflow', labelKey: 'sidebar.tab.workflow' },
  { id: 'assets',   labelKey: 'sidebar.tab.assets' },
  { id: 'params',   labelKey: 'sidebar.tab.params' },
]

const activeTab = useStorage<SidebarTab>('comfytv:sidebar:active-tab', 'workflow')

function tabClass(active: boolean) {
  return [
    'ctv:flex ctv:shrink-0 ctv:items-center ctv:justify-center ctv:cursor-pointer ctv:[font-family:inherit]',
    'ctv:rounded-lg ctv:border-none ctv:px-2.5 ctv:py-1.5 ctv:text-xs ctv:transition-all ctv:duration-200',
    'ctv:focus-visible:outline-none',
    active
      ? 'ctv:bg-interface-menu-component-surface-hovered ctv:text-base-foreground ctv:font-semibold'
      : 'ctv:bg-transparent ctv:text-muted-foreground ctv:hover:bg-secondary-background-hover',
  ].join(' ')
}
</script>

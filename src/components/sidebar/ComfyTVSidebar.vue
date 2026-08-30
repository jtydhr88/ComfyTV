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
        :aria-label="$t(tab.labelKey)"
        :title="compact ? $t(tab.labelKey) : undefined"
        :class="tabClass(activeTab === tab.id)"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" v-if="compact" class="ctv:size-4" />
        <template v-else>{{ $t(tab.labelKey) }}</template>
      </button>
    </div>

    <div v-show="activeTab === 'workflow'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <WorkflowConfigSidebar />
    </div>
    <div v-show="activeTab === 'assets'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <AssetsPanel :active="activeTab === 'assets'" />
    </div>
    <div v-show="activeTab === 'eagle'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <EaglePanel :active="activeTab === 'eagle'" />
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
    <div v-show="activeTab === 'collab'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <CollabPanel />
    </div>
    <div v-show="activeTab === 'settings'" class="ctv:flex ctv:flex-col ctv:flex-1 ctv:min-h-0 ctv:overflow-hidden">
      <SettingsPanel :active="activeTab === 'settings'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, type Component } from 'vue'
import { useResizeObserver, useStorage } from '@vueuse/core'

import { usePresenceStore } from '@/collab/presenceStore'

import IconBird from '~icons/lucide/bird'
import IconImages from '~icons/lucide/images'
import IconPackage from '~icons/lucide/package'
import IconServer from '~icons/lucide/server'
import IconSettings from '~icons/lucide/settings'
import IconSlidersHorizontal from '~icons/lucide/sliders-horizontal'
import IconUsers from '~icons/lucide/users'
import IconStar from '~icons/lucide/star'
import IconStickyNote from '~icons/lucide/sticky-note'
import IconWorkflow from '~icons/lucide/workflow'

import AssetsPanel from '@/components/sidebar/AssetsPanel.vue'
import CollabPanel from '@/components/sidebar/CollabPanel.vue'
import EaglePanel from '@/components/sidebar/EaglePanel.vue'
import EntriesPanel from '@/components/sidebar/EntriesPanel.vue'
import PresetsPanel from '@/components/sidebar/PresetsPanel.vue'
import ResourcesPanel from '@/components/sidebar/ResourcesPanel.vue'
import ServersPanel from '@/components/sidebar/ServersPanel.vue'
import SettingsPanel from '@/components/sidebar/SettingsPanel.vue'
import WorkflowConfigSidebar from '@/components/sidebar/WorkflowConfigSidebar.vue'
import StageParamsPanel from '@/components/sidebar/StageParamsPanel.vue'

type SidebarTab = 'workflow' | 'assets' | 'eagle' | 'entries' | 'params' | 'presets' | 'resources' | 'servers' | 'collab' | 'settings'

const ALL_TABS: Array<{ id: SidebarTab; labelKey: string; icon: Component }> = [
  { id: 'workflow',  labelKey: 'sidebar.tab.workflow',  icon: IconWorkflow },
  { id: 'assets',    labelKey: 'sidebar.tab.assets',    icon: IconImages },
  { id: 'eagle',     labelKey: 'sidebar.tab.eagle',     icon: IconBird },
  { id: 'entries',   labelKey: 'sidebar.tab.entries',   icon: IconStickyNote },
  { id: 'params',    labelKey: 'sidebar.tab.params',    icon: IconSlidersHorizontal },
  { id: 'presets',   labelKey: 'sidebar.tab.presets',   icon: IconStar },
  { id: 'resources', labelKey: 'sidebar.tab.resources', icon: IconPackage },
  { id: 'servers',   labelKey: 'sidebar.tab.servers',   icon: IconServer },
  { id: 'collab',    labelKey: 'sidebar.tab.collab',    icon: IconUsers },
  { id: 'settings',  labelKey: 'sidebar.tab.settings',  icon: IconSettings },
]

const presence = usePresenceStore()
const TABS = computed(() =>
  ALL_TABS.filter((t) => t.id !== 'collab' || presence.featureEnabled))

const activeTab = useStorage<SidebarTab>('comfytv:sidebar:active-tab', 'workflow')

const tabBar = ref<HTMLElement | null>(null)
const compact = ref(false)
let labelWidthNeeded = 0

function measureCompact() {
  const el = tabBar.value
  if (!el) return
  if (!compact.value) {
    if (el.scrollWidth > el.clientWidth) {
      labelWidthNeeded = el.scrollWidth
      compact.value = true
    }
  } else if (el.clientWidth >= labelWidthNeeded + 8) {
    compact.value = false
    void nextTick(measureCompact)
  }
}

useResizeObserver(tabBar, measureCompact)

function onTabWheel(event: WheelEvent) {
  const el = tabBar.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  event.preventDefault()
  el.scrollLeft += event.deltaX || event.deltaY
}

onMounted(() => {
  measureCompact()
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

<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-3 ctv:p-3 ctv:overflow-y-auto ctv:text-xs">
    <div v-if="!store.connected" class="ctv:opacity-60">
      {{ $t('collab.offline') }}
    </div>

    <template v-else>
      <div class="ctv:flex ctv:items-center ctv:gap-1.5">
        <span class="ctv:size-2.5 ctv:rounded-full ctv:shrink-0" :style="{ background: store.selfColor }" />
        <template v-if="editingName">
          <input
            ref="nameInput"
            v-model="nameDraft"
            class="ctv:flex-1 ctv:min-w-0 ctv:bg-transparent ctv:border-b ctv:border-border-subtle ctv:outline-none ctv:text-xs"
            maxlength="40"
            @keydown.enter="commitName"
            @keydown.escape="editingName = false"
            @blur="commitName"
          >
        </template>
        <button
          v-else
          class="ctv:inline-flex ctv:items-center ctv:gap-1 ctv:cursor-pointer ctv:bg-transparent ctv:border-0 ctv:p-0 ctv:text-inherit"
          :title="$t('collab.editName')"
          @click="startEditName"
        >
          <span class="ctv:font-medium">{{ store.selfName }}</span>
          <span class="ctv:opacity-60">({{ $t('collab.you') }})</span>
        </button>
        <span
          v-if="store.coEditing"
          class="ctv:ml-auto ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-success-background/25 ctv:text-2xs ctv:font-semibold"
        >{{ $t('collab.coEditing') }}</span>
      </div>

      <div v-if="store.peerList.length" class="ctv:flex ctv:flex-col ctv:gap-1.5">
        <div
          v-for="p in store.peerList"
          :key="p.connId"
          class="ctv:flex ctv:items-center ctv:gap-1.5"
          :class="{ 'ctv:opacity-50': p.idle !== 'active' }"
        >
          <span class="ctv:size-2.5 ctv:rounded-full ctv:shrink-0" :style="{ background: p.color }" />
          <span class="ctv:truncate">{{ p.name }}</span>
          <span v-if="p.idle !== 'active'" class="ctv:ml-auto ctv:opacity-50 ctv:text-2xs">{{ p.idle }}</span>
        </div>
      </div>
      <div v-else class="ctv:opacity-60">{{ $t('collab.alone') }}</div>

      <button
        v-if="!store.coEditing && (docAvailable || store.peerList.length)"
        class="ctv:inline-flex ctv:items-center ctv:justify-center ctv:gap-1.5 ctv:cursor-pointer ctv:py-1.5 ctv:px-3
               ctv:rounded-sm ctv:border-0 ctv:bg-primary-background ctv:text-primary-foreground ctv:text-xs
               ctv:font-medium ctv:[font-family:inherit] ctv:hover:opacity-90"
        @click="onMainButton"
      >
        {{ docAvailable ? $t('collab.joinEdit') : $t('collab.start') }}
      </button>

      <div v-if="!store.coEditing && canvas" class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:min-h-0">
        <div class="ctv:flex ctv:items-center ctv:gap-1.5 ctv:mt-1">
          <span class="ctv:font-semibold" :style="{ color: sourceColor }">{{ $t('collab.liveSession') }}</span>
          <span
            v-if="isStale"
            class="ctv:py-px ctv:px-1.5 ctv:rounded-lg ctv:bg-warning-background/30 ctv:text-2xs"
          >{{ $t('collab.stale') }}</span>
        </div>
        <div
          v-for="stage in canvas.stages"
          :key="stage.uid || stage.graph_node_id"
          class="ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:py-1 ctv:px-2"
        >
          <div class="ctv:flex ctv:items-center ctv:gap-1.5">
            <span class="ctv:size-2 ctv:rounded-full ctv:shrink-0" :class="statusClass(stage)" />
            <span class="ctv:font-medium ctv:truncate">{{ stage.title || shortClass(stage) }}</span>
            <span v-if="stage.workflow" class="ctv:opacity-60 ctv:truncate ctv:ml-auto">{{ stage.workflow }}</span>
          </div>
          <div v-if="stage.prompt" class="ctv:mt-0.5 ctv:opacity-70 ctv:truncate">{{ stage.prompt }}</div>
        </div>
        <div v-if="!canvas.stages.length" class="ctv:opacity-60">{{ $t('collab.emptyCanvas') }}</div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useTimestamp } from '@vueuse/core'
import { computed, nextTick, ref } from 'vue'

import { usePresenceStore } from '@/collab/presenceStore'
import { joinCoEdit, startCoEdit, updateCollabName } from '@/collab/useCollabPresence'
import { useProjectStore } from '@/stores/projectStore'

const STALE_AFTER_MS = 10_000

const store = usePresenceStore()
const projectStore = useProjectStore()
const now = useTimestamp({ interval: 5000 })

const editingName = ref(false)
const nameDraft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

const docAvailable = computed(() => store.docs[projectStore.currentProjectId] != null)

const canvas = computed(() => {
  const dc = store.driverCanvas
  if (!dc || dc.projectId !== projectStore.currentProjectId) return null
  return dc
})

const sourceColor = computed(() =>
  (canvas.value && store.peers[canvas.value.fromConn]?.color) || undefined)

const isStale = computed(() =>
  !!canvas.value && now.value - canvas.value.receivedAt > STALE_AFTER_MS)

function onMainButton() {
  if (docAvailable.value) joinCoEdit()
  else startCoEdit()
}

function startEditName() {
  nameDraft.value = store.selfName
  editingName.value = true
  void nextTick(() => nameInput.value?.focus())
}

function commitName() {
  if (!editingName.value) return
  editingName.value = false
  if (nameDraft.value.trim() && nameDraft.value.trim() !== store.selfName) {
    updateCollabName(nameDraft.value)
  }
}

function shortClass(stage: any): string {
  return String(stage.stage_class ?? stage.node_id ?? '').replace(/^ComfyTV\./, '')
}

function statusClass(stage: any): string {
  switch (stage.last_run?.status) {
    case 'running': return 'ctv:bg-primary-background ctv:animate-pulse'
    case 'error': return 'ctv:bg-destructive-background'
    case 'ok': return 'ctv:bg-success-background'
    default: return 'ctv:bg-base-foreground/30'
  }
}
</script>

<template>
  <div
    class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:size-full ctv:text-xs ctv:text-base-foreground"
    @pointerdown.stop
    @mousedown.stop
    @contextmenu.stop.prevent
  >
    <div class="ctv:relative ctv:w-full ctv:h-[calc(100%-360px)] ctv:min-h-[280px] ctv:shrink-0 ctv:rounded-lg ctv:overflow-hidden ctv:bg-black">
      <SceneCanvas :init-scene="initScene" />
    </div>

    <div class="ctv:flex ctv:flex-wrap ctv:items-center ctv:gap-1">
      <span class="ctv:text-3xs ctv:uppercase ctv:tracking-wide ctv:text-muted-foreground">
        {{ $t('relight.presets') }}
      </span>
      <button
        v-for="p in LIGHT_PRESETS"
        :key="p.key"
        type="button"
        :class="presetChipClass"
        @click="applyPreset(p.lights)"
      >{{ $t(`relight.preset.${p.key}`) }}</button>
    </div>

    <LightControlPanel
      :lights="lights"
      :selected-index="selectedIndex"
      :gizmos-on="gizmosOn"
      :transform-mode="transformMode"
      :camera-locked="cameraLocked"
      @select="selectLight"
      @add="addLight"
      @remove="removeSelectedLight"
      @update="updateSelectedLight"
      @set-type="setSelectedLightType"
      @toggle-gizmos="setGizmosVisible(!gizmosOn)"
      @set-transform-mode="setTransformGizmoMode"
      @reset-view="resetViewToOutput"
      @toggle-lock="setCameraLocked(!cameraLocked)"
    />

    <StageCard
      class="ctv:h-auto! ctv:grow-0 ctv:shrink-0"
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
      hide-context
      hide-output
      hide-actions
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'

import type { LGraphNode } from '@/lib/comfyApp'
import StageCard from '@/components/stages/StageCard.vue'
import SceneCanvas from '@/components/widgets/SceneCanvas.vue'
import LightControlPanel from '@/components/widgets/LightControlPanel.vue'
import { useLightBall } from '@/composables/widgets/useLightBall'
import { LIGHT_PRESETS } from '@/widgets/three/light/lightPresets'
import { useStageStore, type StageState } from '@/stores/stageStore'
import { onNodeConfigure, readWidgetStr } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const stageStore = useStageStore()

const {
  lights,
  selectedIndex,
  gizmosOn,
  transformMode,
  cameraLocked,
  initScene,
  cleanup,
  selectLight,
  addLight,
  removeSelectedLight,
  updateSelectedLight,
  setSelectedLightType,
  applyPreset,
  setGizmosVisible,
  setTransformGizmoMode,
  resetViewToOutput,
  setCameraLocked
} = useLightBall(props.node, {
  onRenderUploaded: (url) => stageStore.setOutputSlot(props.state, 0, url)
})

function syncOutputSlots() {
  stageStore.setOutputSlot(
    props.state,
    0,
    readWidgetStr(props.node, 'light_render_url', '') || null
  )
  stageStore.setOutputSlot(props.state, 1, props.state.mainPrompt ?? '')
}

watch(
  () => props.state.mainPrompt,
  (t) => stageStore.setOutputSlot(props.state, 1, t ?? '')
)

onNodeConfigure(props.node, () => syncOutputSlots())

onMounted(() => {
  syncOutputSlots()
})

onBeforeUnmount(() => {
  cleanup()
})

const presetChipClass =
  'ctv:inline-flex ctv:items-center ctv:cursor-pointer ctv:[font-family:inherit] ' +
  'ctv:rounded-lg ctv:border ctv:border-border-subtle ctv:bg-secondary-background ctv:px-2 ctv:py-0.5 ' +
  'ctv:text-2xs ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'
</script>

<template>
  <div class="flex flex-col size-full">
    <div class="relative w-full h-[350px] shrink-0 rounded-lg overflow-hidden bg-black mb-1.5">
      <SceneCanvas :init-scene="initScene" />
      <div
        class="absolute top-2 left-2 right-2 z-10 pointer-events-none
               bg-black/90 border border-[rgb(233_61_130/0.3)] rounded-md
               py-1.5 px-2.5 text-xs text-[#E93D82] font-mono leading-snug break-all
               backdrop-blur-sm"
      >{{ prompt }}</div>
      <CameraControlPanel
        :azimuth="azimuth"
        :elevation="elevation"
        :distance="distance"
        @update:azimuth="azimuth = $event"
        @update:elevation="elevation = $event"
        @update:distance="distance = $event"
        @reset="reset"
      />
    </div>

    <StageCard
      :state="state"
      :node="node"
      :on-run-request="onRunRequest"
      :on-cancel-request="onCancelRequest"
      :on-disconnect="onDisconnect"
      :on-action="onAction"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import SceneCanvas from '@/components/widgets/SceneCanvas.vue'
import CameraControlPanel from '@/components/widgets/CameraControlPanel.vue'
import { useCameraWidget } from '@/composables/widgets/useCameraWidget'
import type { CameraState } from '@/widgets/three/types'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: any
}>()

const PROP_KEY = 'comfytv_multiangle_camera'

function getWidgetValue(name: string, fallback: number): number {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  return w ? Number(w.value) : fallback
}

function readInitial(): Partial<CameraState> {
  const stored = props.node?.properties?.[PROP_KEY]
  if (stored && typeof stored === 'object') {
    return {
      azimuth:   stored.azimuth   ?? getWidgetValue('horizontal_angle', 0),
      elevation: stored.elevation ?? getWidgetValue('vertical_angle', 0),
      distance:  stored.distance  ?? getWidgetValue('zoom', 5),
    }
  }
  return {
    azimuth:   getWidgetValue('horizontal_angle', 0),
    elevation: getWidgetValue('vertical_angle', 0),
    distance:  getWidgetValue('zoom', 5),
  }
}

function writeWidget(name: string, value: number) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (w) w.value = value
}

function writeProperties(state: Partial<CameraState>) {
  if (!props.node) return
  if (!props.node.properties) props.node.properties = {}
  const existing = props.node.properties[PROP_KEY] ?? {}
  props.node.properties[PROP_KEY] = { ...existing, ...state }
}

const {
  azimuth, elevation, distance, prompt,
  initScene, setState, reset, cleanup,
} = useCameraWidget(readInitial(), (s: CameraState) => {
  writeWidget('horizontal_angle', Math.round(s.azimuth))
  writeWidget('vertical_angle',   Math.round(s.elevation))
  writeWidget('zoom',             Number(s.distance.toFixed(2)))
  writeProperties({
    azimuth: s.azimuth,
    elevation: s.elevation,
    distance: s.distance,
  })
})

function wireWidgetCallback(name: string, apply: (v: number) => void) {
  const w = props.node?.widgets?.find((x: any) => x.name === name)
  if (!w) return
  const orig = w.callback
  w.callback = (value: unknown) => {
    orig?.call(w, value)
    apply(Number(value))
  }
}

wireWidgetCallback('horizontal_angle', v => setState({ azimuth: v }))
wireWidgetCallback('vertical_angle',   v => setState({ elevation: v }))
wireWidgetCallback('zoom',             v => setState({ distance: v }))

watch(() => props.state.output, (newUrl) => {
  void newUrl
})

onBeforeUnmount(() => {
  cleanup()
})
</script>

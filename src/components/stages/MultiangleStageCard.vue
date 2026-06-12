<template>
  <div class="ctv:flex ctv:flex-col ctv:size-full">
    <div class="ctv:relative ctv:w-full ctv:h-[350px] ctv:shrink-0 ctv:rounded-lg ctv:overflow-hidden ctv:bg-black ctv:mb-1.5">
      <SceneCanvas :init-scene="initScene" />
      <div
        class="ctv:absolute ctv:top-2 ctv:left-2 ctv:right-2 ctv:z-10 ctv:pointer-events-none
               ctv:bg-black/90 ctv:border ctv:border-[rgb(233_61_130/0.3)] ctv:rounded-md
               ctv:py-1.5 ctv:px-2.5 ctv:text-xs ctv:text-[#E93D82] ctv:font-mono ctv:leading-snug ctv:break-all
               ctv:backdrop-blur-sm"
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
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import SceneCanvas from '@/components/widgets/SceneCanvas.vue'
import CameraControlPanel from '@/components/widgets/CameraControlPanel.vue'
import { useCameraWidget } from '@/composables/widgets/useCameraWidget'
import { getWidget, readWidgetNum, writeWidget } from '@/utils/widget'
import type { CameraState } from '@/widgets/three/types'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const PROP_KEY = 'comfytv_multiangle_camera'

function readInitial(): Partial<CameraState> {
  const stored = props.node?.properties?.[PROP_KEY] as Partial<CameraState> | undefined
  if (stored && typeof stored === 'object') {
    return {
      azimuth:   stored.azimuth   ?? readWidgetNum(props.node, 'horizontal_angle', 0),
      elevation: stored.elevation ?? readWidgetNum(props.node, 'vertical_angle', 0),
      distance:  stored.distance  ?? readWidgetNum(props.node, 'zoom', 5),
    }
  }
  return {
    azimuth:   readWidgetNum(props.node, 'horizontal_angle', 0),
    elevation: readWidgetNum(props.node, 'vertical_angle', 0),
    distance:  readWidgetNum(props.node, 'zoom', 5),
  }
}

function writeProperties(state: Partial<CameraState>) {
  if (!props.node) return
  if (!props.node.properties) props.node.properties = {}
  const existing = (props.node.properties[PROP_KEY] ?? {}) as Partial<CameraState>
  props.node.properties[PROP_KEY] = { ...existing, ...state }
}

const {
  azimuth, elevation, distance, prompt,
  initScene, setState, reset, cleanup,
} = useCameraWidget(readInitial(), (s: CameraState) => {
  writeWidget(props.node, 'horizontal_angle', Math.round(s.azimuth), { fireCallback: false })
  writeWidget(props.node, 'vertical_angle',   Math.round(s.elevation), { fireCallback: false })
  writeWidget(props.node, 'zoom',             Number(s.distance.toFixed(2)), { fireCallback: false })
  writeProperties({
    azimuth: s.azimuth,
    elevation: s.elevation,
    distance: s.distance,
  })
})

function wireWidgetCallback(name: string, apply: (v: number) => void) {
  const w = getWidget(props.node, name)
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

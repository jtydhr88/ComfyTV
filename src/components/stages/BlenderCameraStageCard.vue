<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full ctv:grow">
    <div class="ctv-mt ctv-mt-status ctv:flex ctv:items-center ctv:gap-1.5">
      <span
        class="ctv:inline-block ctv:w-2 ctv:h-2 ctv:rounded-full"
        :class="online ? 'ctv:bg-green-500' : 'ctv:bg-red-500'"
      />
      <select
        class="ctv:grow ctv:bg-node-background ctv:rounded ctv:px-1.5 ctv:py-0.5 ctv:text-xs"
        :disabled="!online"
        :value="camera"
        @pointerdown.stop
        @change="onPickCamera"
      >
        <option value="">(scene's active camera)</option>
        <option v-for="cam in cameras" :key="cam.name" :value="cam.name">
          {{ cam.name }}{{ cam.active ? ' ●' : '' }} · {{ Math.round(cam.lens) }}mm
        </option>
      </select>
      <select
        class="ctv:bg-node-background ctv:rounded ctv:px-1.5 ctv:py-0.5 ctv:text-xs"
        :value="shading"
        title="clay: Workbench driving render for AI stages · full: the scene's own engine (F12)"
        @pointerdown.stop
        @change="onPickShading"
      >
        <option value="clay">clay</option>
        <option value="full">full</option>
      </select>
    </div>

    <div v-if="scene" class="ctv-mt ctv-mt-status ctv:opacity-70">
      {{ scene.resolution_x }}×{{ scene.resolution_y }}
      · {{ scene.samples ?? '?' }} samples
      <template v-if="isAnimation">
        · frames {{ scene.frame_start }}–{{ scene.frame_end }} @ {{ scene.fps }}fps
      </template>
      · set in Blender
    </div>
    <div v-else-if="!online" class="ctv-mt ctv-mt-status">
      Blender offline — launch blender-for-comfytv.bat
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import StageCard from '@/components/stages/StageCard.vue'
import { fetchBlenderCameras } from '@/api/blender'
import type { BlenderCameras } from '@/api/schemas/blender'
import { readWidgetStr, writeWidget } from '@/utils/widget'

const props = defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const online = ref(false)
const cameras = ref<BlenderCameras['cameras']>([])
const scene = ref<BlenderCameras['scene'] | null>(null)
const camera = ref(readWidgetStr(props.node, 'camera', ''))
const shading = ref(readWidgetStr(props.node, 'shading', 'clay'))
let timer: ReturnType<typeof setInterval> | null = null

const isAnimation = computed(
  () => props.node.comfyClass === 'ComfyTV.BlenderAnimationStage')

function onPickCamera(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  camera.value = value
  writeWidget(props.node, 'camera', value)
}

function onPickShading(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  shading.value = value
  writeWidget(props.node, 'shading', value)
}

async function poll() {
  try {
    const data = await fetchBlenderCameras()
    cameras.value = data.cameras
    scene.value = data.scene
    online.value = true
  } catch {
    online.value = false
    scene.value = null
  }
}

onMounted(() => {
  void poll()
  timer = setInterval(poll, 5000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

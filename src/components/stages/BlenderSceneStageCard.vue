<template>
  <Teleport to="body" :disabled="!fullscreen">
    <div
      class="ctv:flex ctv:flex-col ctv:gap-1"
      :class="fullscreen
        ? 'ctv:fixed ctv:inset-0 ctv:z-[1400] ctv:bg-base-background ctv:p-2'
        : 'ctv:size-full'"
    >
      <div class="ctv:flex ctv:flex-row ctv:h-6 ctv:shrink-0 ctv:items-center ctv:gap-1.5 ctv:min-w-0 ctv:text-xs">
        <span
          class="ctv:inline-block ctv:w-2 ctv:h-2 ctv:shrink-0 ctv:rounded-full"
          :class="status?.online ? 'ctv:bg-green-500' : 'ctv:bg-red-500'"
        />
        <span
          v-if="status?.online"
          class="ctv:grow ctv:min-w-0 ctv:truncate ctv:text-left ctv:text-muted-foreground"
        >
          Blender {{ status.blender_version }} · {{ streamNote }} · live scene
        </span>
        <span v-else class="ctv:grow ctv:min-w-0 ctv:truncate ctv:text-left ctv:text-muted-foreground">
          waiting for the Blender bridge
        </span>
        <select
          v-if="status?.online && modelAssets.length > 0"
          value=""
          :class="addSelectClass"
          aria-label="Add model from assets"
          title="Add a model from the asset library to the scene"
          @pointerdown.stop
          @change="onAddAssetModel"
        >
          <option value="" disabled>+ model</option>
          <option v-for="asset in modelAssets" :key="asset.id" :value="String(asset.id)">
            {{ asset.name || `#${asset.id}` }}
          </option>
        </select>
        <button
          type="button"
          :class="iconToolBtnClass"
          :title="fullscreen ? 'Exit full size (Esc)' : 'View in full size'"
          @pointerdown.stop
          @click.stop="toggleFullscreen"
        >
          <IconMinimize v-if="fullscreen" class="ctv:size-4" />
          <IconMaximize v-else class="ctv:size-4" />
        </button>
      </div>

      <div
        class="ctv:relative ctv:w-full ctv:grow ctv:min-h-0 ctv:rounded-lg ctv:overflow-hidden ctv:bg-black"
        @pointerdown.stop
        @wheel.stop
      >
        <BlenderViewport
          v-if="status?.online"
          :ws-url="viewportWsUrl"
          @status="streamNote = $event"
        />
        <div
          v-else
          class="ctv:absolute ctv:inset-0 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-2 ctv:text-sm ctv:opacity-70"
        >
          <span class="ctv:inline-block ctv:w-2.5 ctv:h-2.5 ctv:rounded-full ctv:bg-red-500" />
          <span>Blender offline — launch blender-for-comfytv.bat</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import IconMaximize from '~icons/lucide/maximize-2'
import IconMinimize from '~icons/lucide/minimize-2'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import BlenderViewport from '@/components/widgets/BlenderViewport.vue'
import { useScene3dFullscreen } from '@/composables/widgets/useScene3dPanels'
import { useAssetStore } from '@/stores/assetStore'
import { addModelToScene, fetchBlenderStatus } from '@/api/blender'
import type { BlenderStatus } from '@/api/schemas/blender'

defineProps<{
  state: StageState
  onRunRequest: () => void
  onCancelRequest: () => void
  onDisconnect: (slot: string) => void
  onAction: (id: string) => void
  node: LGraphNode
}>()

const status = ref<BlenderStatus | null>(null)
const streamNote = ref('connecting')
let timer: ReturnType<typeof setInterval> | null = null

const { fullscreen, toggleFullscreen, onFullscreenKeydown } = useScene3dFullscreen()

const viewportWsUrl = computed(() => {
  const port = status.value?.web_port ?? 7681
  return `ws://127.0.0.1:${port}/ws`
})

const iconToolBtnClass =
  'ctv:inline-flex ctv:size-7 ctv:shrink-0 ctv:cursor-pointer ctv:items-center ctv:justify-center ' +
  'ctv:rounded-lg ctv:border-0 ctv:bg-secondary-background ctv:text-muted-foreground ctv:transition-colors ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'

const addSelectClass =
  'ctv:h-5 ctv:max-w-20 ctv:shrink-0 ctv:cursor-pointer ctv:rounded-md ctv:border-0 ctv:bg-secondary-background ' +
  'ctv:px-1 ctv:text-2xs ctv:text-muted-foreground ctv:outline-none ctv:[font-family:inherit] ' +
  'ctv:hover:bg-secondary-background-hover ctv:hover:text-base-foreground'

const BLENDER_MODEL_EXT = /\.(glb|gltf|obj|fbx|usd|usdc|usdz)($|\?|&)/i

const assetStore = useAssetStore()
const modelAssets = computed(() =>
  assetStore.assets.filter(
    (asset) =>
      asset.media_type === 'model' &&
      BLENDER_MODEL_EXT.test(String(asset.payload_url ?? '')),
  ),
)

async function onAddAssetModel(event: Event) {
  const select = event.target as HTMLSelectElement
  const assetId = Number(select.value)
  select.value = ''
  const asset = modelAssets.value.find((entry) => entry.id === assetId)
  if (!asset?.payload_url) return
  streamNote.value = `importing ${asset.name || 'model'}…`
  try {
    await addModelToScene(asset.payload_url)
    streamNote.value = `${asset.name || 'model'} added to the ComfyTV collection`
  } catch {
    streamNote.value = 'import failed — is Blender still running?'
  }
}

async function poll() {
  try {
    const next = await fetchBlenderStatus()
    if (next.online !== status.value?.online) {
      status.value = next
    }
  } catch {
    if (status.value?.online !== false) status.value = { online: false }
  }
}

onMounted(() => {
  void poll()
  assetStore.ensureHydrated()
  timer = setInterval(poll, 5000)
  window.addEventListener('keydown', onFullscreenKeydown, true)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('keydown', onFullscreenKeydown, true)
})
</script>

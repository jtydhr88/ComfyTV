<template>
  <div class="flex flex-col gap-1.5 w-full">
    <div ref="containerEl"
         class="relative w-full h-80 rounded-md overflow-hidden bg-black border border-border-subtle">
      <div v-if="!panoramaUrl"
           class="absolute inset-0 flex flex-col items-center justify-center gap-1.5
                  text-white/50 pointer-events-none">
        <div class="text-[32px] opacity-60">🌐</div>
        <div class="text-xs">{{ $t('panorama.empty') }}</div>
      </div>
      <div v-if="loadError"
           class="absolute inset-0 flex items-center justify-center text-[11px]
                  bg-destructive-background/30 text-destructive-background pointer-events-none">
        {{ $t('panorama.loadError') }}
      </div>
    </div>

    <div class="flex flex-wrap gap-1.5 items-center">
      <input
        ref="fileInputEl"
        type="file"
        accept=".hdr,.exr,.jpg,.jpeg,.png,.webp"
        class="hidden"
        @change="onFilePicked"
      />
      <button
        type="button"
        class="py-1 px-2.5 text-[11px] rounded cursor-pointer
               bg-secondary-background text-base-foreground border border-border-subtle
               hover:enabled:bg-secondary-background-hover disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="uploading"
        @click="fileInputEl?.click()"
      >
        <span v-if="uploading">{{ $t('panorama.uploading') }}</span>
        <span v-else>📤 {{ $t('panorama.upload') }}</span>
      </button>
      <button
        v-if="manualSource"
        type="button"
        class="py-1 px-2.5 text-[11px] rounded cursor-pointer
               bg-secondary-background text-destructive-background
               border border-destructive-background/30 hover:bg-destructive-background/10"
        :title="$t('panorama.clearUploadTooltip')"
        @click="onClearManual"
      >✕ {{ $t('panorama.clearUpload') }}</button>
      <span v-if="manualSource"
            class="text-2xs py-0.5 px-1.5 rounded-lg tracking-wide
                   bg-primary-background/20 text-primary-background">
        {{ $t('panorama.manualSourceBadge') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PanoramaViewer } from '@/widgets/three/PanoramaViewer'
import { uploadBlob } from '@/utils/uploadCanvas'

const props = defineProps<{
  panoramaUrl: string | null
  manualSource: string
}>()

const emit = defineEmits<{
  'manual-source-changed': [viewUrl: string]
  'manual-source-cleared': []
}>()

const containerEl = ref<HTMLDivElement | null>(null)
const fileInputEl = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const loadError = ref(false)

let viewer: PanoramaViewer | null = null

onMounted(() => {
  if (!containerEl.value) return
  viewer = new PanoramaViewer({ container: containerEl.value })
  if (props.panoramaUrl) void loadUrl(props.panoramaUrl)
})

onBeforeUnmount(() => {
  viewer?.dispose()
  viewer = null
})

watch(() => props.panoramaUrl, (url) => {
  void loadUrl(url)
})

async function loadUrl(url: string | null) {
  if (!viewer) return
  loadError.value = false
  try {
    await viewer.setPanoramaUrl(url)
  } catch {
    loadError.value = true
  }
}

async function onFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploading.value = true
  loadError.value = false
  try {
    const viewUrl = await uploadBlob(file, { subfolder: 'panorama', filename: file.name })
    emit('manual-source-changed', viewUrl)
  } catch (e) {
    console.error('[ComfyTV/panorama] upload failed', e)
    loadError.value = true
  } finally {
    uploading.value = false
  }
}

function onClearManual() {
  emit('manual-source-cleared')
}
</script>

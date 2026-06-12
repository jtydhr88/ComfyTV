<template>
  <div class="ctv:flex ctv:flex-col ctv:gap-1.5 ctv:w-full">
    <div ref="containerEl"
         class="ctv:relative ctv:w-full ctv:h-80 ctv:rounded-md ctv:overflow-hidden ctv:bg-black ctv:border ctv:border-border-subtle">
      <div v-if="!panoramaUrl"
           class="ctv:absolute ctv:inset-0 ctv:flex ctv:flex-col ctv:items-center ctv:justify-center ctv:gap-1.5
                  ctv:text-white/50 ctv:pointer-events-none">
        <div class="ctv:text-[32px] ctv:opacity-60">🌐</div>
        <div class="ctv:text-xs">{{ $t('panorama.empty') }}</div>
      </div>
      <div v-if="loadError"
           class="ctv:absolute ctv:inset-0 ctv:flex ctv:items-center ctv:justify-center ctv:text-[11px]
                  ctv:bg-destructive-background/30 ctv:text-destructive-background ctv:pointer-events-none">
        {{ $t('panorama.loadError') }}
      </div>
    </div>

    <div class="ctv:flex ctv:flex-wrap ctv:gap-1.5 ctv:items-center">
      <input
        ref="fileInputEl"
        type="file"
        accept=".hdr,.exr,.jpg,.jpeg,.png,.webp"
        class="ctv:hidden"
        @change="onFilePicked"
      />
      <button
        type="button"
        class="ctv:py-1 ctv:px-2.5 ctv:text-[11px] ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:text-base-foreground ctv:border ctv:border-border-subtle
               ctv:hover:enabled:bg-secondary-background-hover ctv:disabled:opacity-60 ctv:disabled:cursor-not-allowed"
        :disabled="uploading"
        @click="fileInputEl?.click()"
      >
        <span v-if="uploading">{{ $t('panorama.uploading') }}</span>
        <span v-else>📤 {{ $t('panorama.upload') }}</span>
      </button>
      <button
        v-if="manualSource"
        type="button"
        class="ctv:py-1 ctv:px-2.5 ctv:text-[11px] ctv:rounded ctv:cursor-pointer
               ctv:bg-secondary-background ctv:text-destructive-background
               ctv:border ctv:border-destructive-background/30 ctv:hover:bg-destructive-background/10"
        :title="$t('panorama.clearUploadTooltip')"
        @click="onClearManual"
      >✕ {{ $t('panorama.clearUpload') }}</button>
      <span v-if="manualSource"
            class="ctv:text-2xs ctv:py-0.5 ctv:px-1.5 ctv:rounded-lg ctv:tracking-wide
                   ctv:bg-primary-background/20 ctv:text-primary-background">
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

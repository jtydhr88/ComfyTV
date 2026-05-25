<template>
  <div class="panorama-widget">
    <div ref="containerEl" class="viewer-shell">
      <div v-if="!panoramaUrl" class="empty-state">
        <div class="empty-icon">🌐</div>
        <div class="empty-text">{{ $t('panorama.empty') }}</div>
      </div>
      <div v-if="loadError" class="error-overlay">{{ $t('panorama.loadError') }}</div>
    </div>

    <div class="controls">
      <input
        ref="fileInputEl"
        type="file"
        accept=".hdr,.exr,.jpg,.jpeg,.png,.webp"
        class="file-input"
        @change="onFilePicked"
      />
      <button
        type="button"
        class="upload-btn"
        :disabled="uploading"
        @click="fileInputEl?.click()"
      >
        <span v-if="uploading">{{ $t('panorama.uploading') }}</span>
        <span v-else>📤 {{ $t('panorama.upload') }}</span>
      </button>
      <button
        v-if="manualSource"
        type="button"
        class="clear-btn"
        :title="$t('panorama.clearUploadTooltip')"
        @click="onClearManual"
      >
        ✕ {{ $t('panorama.clearUpload') }}
      </button>
      <span v-if="manualSource" class="badge">{{ $t('panorama.manualSourceBadge') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PanoramaViewer } from '@/widgets/three/PanoramaViewer'
import { app } from '@/lib/comfyApp'

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
    const body = new FormData()
    body.append('image', file, file.name)
    body.append('subfolder', 'panorama')
    body.append('type', 'input')
    const resp = await (app as any).api.fetchApi('/upload/image', { method: 'POST', body })
    if (resp.status !== 200) throw new Error(`upload ${resp.status} ${resp.statusText}`)
    const data = await resp.json() as { name?: string }
    if (!data?.name) throw new Error('upload returned no name')

    const viewUrl = `/view?filename=${encodeURIComponent(data.name)}`
                  + `&subfolder=panorama&type=input`
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

<style scoped>
.panorama-widget {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.viewer-shell {
  position: relative;
  width: 100%;
  height: 320px;
  background: #0a0a0f;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  gap: 6px;
  pointer-events: none;
}
.empty-icon { font-size: 32px; opacity: 0.6; }
.empty-text { font-size: 12px; }

.error-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 20, 20, 0.4);
  color: #ffb0b0;
  font-size: 11px;
  pointer-events: none;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.file-input {
  display: none;
}
.upload-btn,
.clear-btn {
  padding: 5px 10px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}
.upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.upload-btn:hover:not(:disabled),
.clear-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.clear-btn {
  color: rgba(255, 180, 180, 0.85);
  border-color: rgba(255, 100, 100, 0.25);
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(78, 168, 255, 0.2);
  color: #9dd0ff;
  letter-spacing: 0.3px;
}
</style>

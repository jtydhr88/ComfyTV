import { computed, onBeforeUnmount, ref } from 'vue'

import { useAssetStore } from '@/stores/assetStore'
import { downloadBlob } from '@/utils/download'
import { uploadBlobNamed } from '@/utils/uploadCanvas'

export const TEXT_COPIED_RESET_MS = 1500

export function useTextOutputActions(getText: () => string) {
  const textCopied = ref(false)
  const savedText = ref<string | null>(null)
  const textSaved = computed(() => savedText.value !== null && savedText.value === getText())
  const textSaving = ref(false)
  let timer: number | null = null

  async function copyText(): Promise<void> {
    const text = getText()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    textCopied.value = true
    if (timer != null) window.clearTimeout(timer)
    timer = window.setTimeout(() => { textCopied.value = false }, TEXT_COPIED_RESET_MS)
  }

  function downloadText(): void {
    const text = getText()
    if (!text) return
    downloadBlob(
      `comfytv-text-${Date.now()}.txt`,
      new Blob([text], { type: 'text/plain;charset=utf-8' }),
    )
  }

  async function saveTextAsset(): Promise<void> {
    const text = getText()
    if (!text || textSaving.value || textSaved.value) return

    textSaving.value = true
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const filename = `comfytv-text-${Date.now()}.txt`
      const uploaded = await uploadBlobNamed(blob, {
        subfolder: 'comfytv/assets',
        type: 'input',
        filename,
      })
      const asset = await useAssetStore().create({
        name: uploaded.name.replace(/\.[^.]+$/, ''),
        payload_url: uploaded.url,
        media_type: 'text',
        category_ids: [],
        mime_type: 'text/plain',
        size_bytes: blob.size,
        source: 'output',
      })
      if (asset) savedText.value = text
    } catch (e) {
      console.error('[ComfyTV/text-output] save to library failed', e)
    } finally {
      textSaving.value = false
    }
  }

  onBeforeUnmount(() => {
    if (timer != null) window.clearTimeout(timer)
  })

  return { textCopied, textSaved, textSaving, copyText, downloadText, saveTextAsset }
}

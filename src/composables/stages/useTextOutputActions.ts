import { onBeforeUnmount, ref } from 'vue'

import { downloadBlob } from '@/utils/download'

export const TEXT_COPIED_RESET_MS = 1500

export function useTextOutputActions(getText: () => string) {
  const textCopied = ref(false)
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

  onBeforeUnmount(() => {
    if (timer != null) window.clearTimeout(timer)
  })

  return { textCopied, copyText, downloadText }
}

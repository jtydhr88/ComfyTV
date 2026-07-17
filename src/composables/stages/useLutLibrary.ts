import { onMounted, ref, type Ref } from 'vue'

export function useLutLibrary(lutFile: Ref<string>) {
  const luts = ref<string[]>([])

  async function refreshLuts(): Promise<void> {
    try {
      const res = await fetch('/comfytv/luts')
      if (!res.ok) return
      const data = await res.json() as { luts: string[] }
      luts.value = data.luts ?? []
      if (!lutFile.value && luts.value.length) lutFile.value = luts.value[0]
    } catch {
    }
  }

  async function onFilePicked(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/comfytv/luts', { method: 'POST', body: fd })
      if (!res.ok) return
      const data = await res.json() as { name: string }
      await refreshLuts()
      if (data.name) lutFile.value = data.name
    } finally {
      input.value = ''
    }
  }

  onMounted(refreshLuts)

  return { luts, refreshLuts, onFilePicked }
}

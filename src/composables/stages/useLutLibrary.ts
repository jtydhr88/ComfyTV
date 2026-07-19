import { onMounted, ref, type Ref } from 'vue'

import { listResources, uploadResource } from '@/api'

export function useLutLibrary(lutFile: Ref<string>) {
  const luts = ref<string[]>([])
  const lutUrls = ref<Record<string, string>>({})

  async function refreshLuts(): Promise<void> {
    try {
      const rows = (await listResources('lut')).resources
      const present = rows.filter((r) => !r.missing)
      luts.value = present.map((r) => r.filename).sort()
      lutUrls.value = Object.fromEntries(present.map((r) => [r.filename, r.url]))
      if (!lutFile.value && luts.value.length) lutFile.value = luts.value[0]
    } catch {
    }
  }

  async function onFilePicked(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return
    try {
      const { resource } = await uploadResource('lut', file)
      await refreshLuts()
      if (resource.filename) lutFile.value = resource.filename
    } catch {
    } finally {
      input.value = ''
    }
  }

  onMounted(refreshLuts)

  return { luts, lutUrls, refreshLuts, onFilePicked }
}

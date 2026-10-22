import { computed, onMounted, ref, watch } from 'vue'

import { listResources } from '@/api'

const BUILTIN_FONTS = [
  { value: 'Inter-Regular', label: 'Inter' },
  { value: 'NotoSansSC-Regular', label: 'Noto SC' },
  { value: 'msyh', label: '雅黑' },
  { value: 'arial', label: 'Arial' },
]

const RENDERABLE = /\.(ttf|otf|ttc)$/i

const fontsRevision = ref(0)

export function notifyFontsChanged(): void {
  fontsRevision.value++
}

export function useFontLibrary() {
  const uploaded = ref<string[]>([])

  async function refreshFonts(): Promise<void> {
    try {
      const rows = (await listResources('font')).resources
      uploaded.value = [...new Set(rows
        .filter((r) => !r.missing && RENDERABLE.test(r.filename))
        .map((r) => r.name))].sort()
    } catch {
    }
  }

  const fontOptions = computed(() => [
    ...uploaded.value.map((name) => ({ value: name, label: name })),
    ...BUILTIN_FONTS.filter((f) => !uploaded.value.includes(f.value)),
  ])

  onMounted(refreshFonts)
  watch(fontsRevision, refreshFonts)

  return { fontOptions, refreshFonts }
}

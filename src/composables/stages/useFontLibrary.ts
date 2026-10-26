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

function thumb(name: string, text: string, v = ''): string {
  return `/comfytv/text_font_thumb?${new URLSearchParams({ name, text, v })}`
}

export function useFontLibrary() {
  const uploaded = ref<Record<string, string>>({})

  async function refreshFonts(): Promise<void> {
    try {
      const rows = (await listResources('font')).resources
      uploaded.value = Object.fromEntries(rows
        .filter((r) => !r.missing && RENDERABLE.test(r.filename))
        .map((r) => [r.name, r.sha256 ?? r.created_at ?? '']))
    } catch {
    }
  }

  const fontOptions = computed(() => {
    const names = Object.keys(uploaded.value).sort()
    return [
      ...names.map((name) => ({ value: name, label: name })),
      ...BUILTIN_FONTS.filter((f) => !names.includes(f.value)),
    ].map((f) => ({ ...f, image: thumb(f.value, f.label, uploaded.value[f.value]) }))
  })

  onMounted(refreshFonts)
  watch(fontsRevision, refreshFonts)

  return { fontOptions, refreshFonts }
}

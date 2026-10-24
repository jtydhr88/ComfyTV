import { computed, onMounted, ref, watch } from 'vue'

import { listResources } from '@/api'
import { cmapCoverage, opszDefault } from '@/composables/stages/textOverlayLayout'

const BUILTIN_FONTS = [
  { value: 'Inter-Regular', label: 'Inter' },
  { value: 'NotoSansSC-Regular', label: 'Noto SC' },
  { value: 'msyh', label: '雅黑' },
  { value: 'arial', label: 'Arial' },
]

const RENDERABLE = /\.(ttf|otf|ttc)$/i

const fontsRevision = ref(0)

export interface LoadedFont {
  family: string
  opsz: number | null
  covers: Set<number>
}

const loadedFonts = new Map<string, Promise<LoadedFont>>()

export function loadFont(name: string): Promise<LoadedFont> {
  let font = loadedFonts.get(name)
  if (!font) {
    const family = `ctv-text-${loadedFonts.size}`
    font = fetch(`/comfytv/text_font?name=${encodeURIComponent(name)}`)
      .then((r) => r.arrayBuffer())
      .then(async (buf) => {
        document.fonts.add(await new FontFace(family, buf).load())
        return { family, opsz: opszDefault(buf), covers: cmapCoverage(buf) }
      })
      .catch(() => ({ family: 'sans-serif', opsz: null, covers: new Set<number>() }))
    loadedFonts.set(name, font)
  }
  return font
}

const families = ref<Record<string, string>>({})

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

  const choices = computed(() => [
    ...uploaded.value.map((name) => ({ value: name, label: name })),
    ...BUILTIN_FONTS.filter((f) => !uploaded.value.includes(f.value)),
  ])

  // Show each chip label in its own font once the font file has loaded
  const fontOptions = computed(() => choices.value.map((opt) => ({
    ...opt, font: families.value[opt.value],
  })))

  onMounted(refreshFonts)
  watch(fontsRevision, refreshFonts)
  watch(choices, (opts) => {
    for (const { value } of opts) {
      void loadFont(value).then((f) => { families.value[value] = f.family })
    }
  }, { immediate: true })

  return { fontOptions, refreshFonts }
}

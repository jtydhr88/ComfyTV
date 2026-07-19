import { computed, ref, watch } from 'vue'

import {
  deleteStagePreset, fetchStageDefaults, listStagePresets, saveStagePreset,
} from '@/api'
import type { StagePreset } from '@/api'
import type { LGraphNode } from '@/lib/comfyApp'
import { bindWidgetCallback, getWidget, writeWidget } from '@/utils/widget'

const _defaultsCache = new Map<string, Promise<Record<string, unknown>>>()

const stagePresetsRevision = ref(0)

export function bumpStagePresetsRevision(): void {
  stagePresetsRevision.value += 1
}

export function useStagePresetsRevision(onExternalChange: () => void): { bump: () => void } {
  let own = -1
  watch(stagePresetsRevision, (rev) => {
    if (rev !== own) onExternalChange()
  })
  return {
    bump: () => {
      own = stagePresetsRevision.value + 1
      stagePresetsRevision.value = own
    },
  }
}

export function fetchStageDefaultsCached(kind: string): Promise<Record<string, unknown>> {
  let hit = _defaultsCache.get(kind)
  if (!hit) {
    hit = fetchStageDefaults(kind)
      .then((res) => res.defaults)
      .catch((e) => {
        _defaultsCache.delete(kind)
        throw e
      })
    _defaultsCache.set(kind, hit)
  }
  return hit
}

export function clearStageDefaultsCache(): void {
  _defaultsCache.clear()
}

export function useStagePresets(getNode: () => LGraphNode | undefined) {
  const defaults = ref<Record<string, unknown>>({})
  const presets = ref<StagePreset[]>([])
  const selectedId = ref<number | string | null>(null)

  let suppressDirty = false
  const dirtyBound = new WeakSet<LGraphNode>()

  function onManualWidgetChange(): void {
    if (!suppressDirty) selectedId.value = null
  }

  function bindDirtyTracking(): void {
    const node = getNode()
    if (!node || dirtyBound.has(node)) return
    dirtyBound.add(node)
    for (const key of Object.keys(defaults.value)) {
      bindWidgetCallback(node, key, onManualWidgetChange)
    }
  }

  const kind = computed(() => {
    const n = getNode() as { comfyClass?: unknown; type?: unknown } | undefined
    return String(n?.comfyClass ?? n?.type ?? '')
  })

  const hasConfig = computed(() => Object.keys(defaults.value).length > 0)

  const selectedPreset = computed(() =>
    presets.value.find((p) => p.id === selectedId.value) ?? null)

  async function loadPresets(): Promise<void> {
    const k = kind.value
    if (!k) return
    try {
      presets.value = (await listStagePresets(k)).presets
    } catch {
      presets.value = []
    }
    if (selectedId.value != null && !presets.value.some((p) => p.id === selectedId.value)) {
      selectedId.value = null
    }
  }

  watch(kind, async (k) => {
    defaults.value = {}
    presets.value = []
    selectedId.value = null
    if (!k) return
    try {
      defaults.value = await fetchStageDefaultsCached(k)
    } catch {
      return
    }
    if (!Object.keys(defaults.value).length) return
    bindDirtyTracking()
    await loadPresets()
  }, { immediate: true })

  const { bump } = useStagePresetsRevision(() => {
    if (Object.keys(defaults.value).length) void loadPresets()
  })

  function captureConfig(): Record<string, unknown> {
    const node = getNode()
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(defaults.value)) {
      const w = getWidget(node, key)
      if (w) out[key] = w.value
    }
    return out
  }

  function applyConfig(config: Record<string, unknown>): void {
    const node = getNode()
    suppressDirty = true
    try {
      for (const [key, value] of Object.entries(config)) {
        if (!(key in defaults.value)) continue
        if (!getWidget(node, key)) continue
        writeWidget(node, key, value)
      }
    } finally {
      suppressDirty = false
    }
  }

  function resetToDefaults(): void {
    applyConfig(defaults.value)
    selectedId.value = null
  }

  function markCustom(): void {
    selectedId.value = null
  }

  function applyPresetById(id: number | string): void {
    const preset = presets.value.find((p) => p.id === id)
    if (!preset) return
    applyConfig(preset.config)
    selectedId.value = id
  }

  async function savePresetAs(name: string): Promise<void> {
    const k = kind.value
    if (!k || !name) return
    const res = await saveStagePreset({ kind: k, name, config: captureConfig() })
    await loadPresets()
    selectedId.value = res.preset.id
    bump()
  }

  async function deletePresetById(id: number): Promise<void> {
    try {
      await deleteStagePreset(id)
    } catch {
      return
    }
    if (selectedId.value === id) selectedId.value = null
    await loadPresets()
    bump()
  }

  return {
    kind,
    defaults,
    hasConfig,
    presets,
    selectedId,
    selectedPreset,
    loadPresets,
    captureConfig,
    applyConfig,
    resetToDefaults,
    markCustom,
    applyPresetById,
    savePresetAs,
    deletePresetById,
  }
}

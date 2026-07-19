import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { deleteStagePreset, listStagePresets, updateStagePreset } from '@/api'
import type { StagePreset } from '@/api'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { useStagePresetsRevision } from '@/composables/stages/useStagePresets'
import { i18n } from '@/i18n'

import enNodeDefs from '../../../locales/en/nodeDefs.json'
import zhNodeDefs from '../../../locales/zh/nodeDefs.json'

type NodeDefMap = Record<string, unknown>
type NodeDefEntry = { display_name?: unknown }

const NODE_DEFS: Record<string, NodeDefMap> = {
  en: enNodeDefs as NodeDefMap,
  zh: zhNodeDefs as NodeDefMap,
}

function displayNameFrom(defs: NodeDefMap | undefined, kind: string): string | null {
  if (!defs) return null
  const dot = kind.indexOf('.')
  if (dot > 0) {
    const ns = defs[kind.slice(0, dot)] as Record<string, NodeDefEntry> | undefined
    const nested = ns?.[kind.slice(dot + 1)]
    if (typeof nested?.display_name === 'string') return nested.display_name
  }
  const flat = defs[kind.replace(/\./g, '_')] as NodeDefEntry | undefined
  return typeof flat?.display_name === 'string' ? flat.display_name : null
}

export function stageDisplayName(kind: string): string {
  const locale = String(i18n.global.locale.value)
  return displayNameFrom(NODE_DEFS[locale], kind)
    ?? displayNameFrom(NODE_DEFS.en, kind)
    ?? (kind.split('.').pop() || kind)
}

export interface PresetGroup {
  kind: string
  label: string
  presets: StagePreset[]
}

export function usePresetsPanel(isActive: () => boolean | undefined) {
  const { t } = useI18n()

  const presets = ref<StagePreset[]>([])
  const loading = ref(false)
  const collapsed = ref<Set<string>>(new Set())

  const groups = computed<PresetGroup[]>(() => {
    const byKind = new Map<string, StagePreset[]>()
    for (const p of presets.value) {
      const rows = byKind.get(p.kind)
      if (rows) rows.push(p)
      else byKind.set(p.kind, [p])
    }
    return Array.from(byKind.entries())
      .map(([kind, rows]) => ({ kind, label: stageDisplayName(kind), presets: rows }))
      .sort((a, b) => a.label.localeCompare(b.label))
  })

  async function load(): Promise<void> {
    loading.value = true
    try {
      presets.value = (await listStagePresets()).presets
    } catch {
      presets.value = []
    } finally {
      loading.value = false
    }
  }

  const { bump } = useStagePresetsRevision(() => {
    if (isActive()) void load()
  })

  function isCollapsed(kind: string): boolean {
    return collapsed.value.has(kind)
  }

  function toggleGroup(kind: string): void {
    const next = new Set(collapsed.value)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    collapsed.value = next
  }

  async function onRename(preset: StagePreset): Promise<void> {
    if (preset.builtin || typeof preset.id !== 'number') return
    const name = (await askText({
      title: t('stagePresets.renameTitle'),
      label: t('stagePresets.nameLabel'),
      initialValue: preset.name,
    }))?.trim()
    if (!name || name === preset.name) return
    try {
      await updateStagePreset(preset.id, { name })
    } catch {
      return
    }
    await load()
    bump()
  }

  async function onDelete(preset: StagePreset): Promise<void> {
    if (preset.builtin || typeof preset.id !== 'number') return
    const ok = await askConfirm({
      title: t('stagePresets.deleteTitle'),
      message: t('stagePresets.deleteConfirm', { name: preset.name }),
      danger: true,
    })
    if (!ok) return
    try {
      await deleteStagePreset(preset.id)
    } catch {
      return
    }
    await load()
    bump()
  }

  watch(isActive, (active) => {
    if (active) void load()
  }, { immediate: true })

  return {
    presets,
    loading,
    groups,
    load,
    isCollapsed,
    toggleGroup,
    onRename,
    onDelete,
  }
}

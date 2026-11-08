import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { StageGroup } from '@/api'
import { deleteStageGroup, listStageGroups, renameStageGroup, saveStageGroup } from '@/api/stageGroups'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { askText } from '@/composables/dialog/useTextInputDialog'
import { insertStageGroup, serializeSelectedStages, STAGE_GROUP_DRAG_MIME } from '@/composables/sidebar/stageGroupCanvas'
import { renderStageGroupThumbnail } from '@/composables/sidebar/stageGroupThumbnail'
import { stageDisplayName } from '@/composables/sidebar/usePresetsPanel'
import { useSelectionStore } from '@/stores/selectionStore'

export function nodeCountOf(group: StageGroup): number {
  const nodes = group.data.nodes
  return Array.isArray(nodes) ? nodes.length : 0
}

export function useStageGroups(isActive: () => boolean | undefined) {
  const { t } = useI18n()
  const selection = useSelectionStore()

  const groups = ref<StageGroup[]>([])
  const canSave = computed(() => selection.nodeCount > 0)

  async function load(): Promise<void> {
    try {
      groups.value = await listStageGroups()
    } catch {
      groups.value = []
    }
  }

  async function onSave(): Promise<void> {
    const data = serializeSelectedStages()
    if (!data) return
    const name = (await askText({
      title: t('stageGroups.saveTitle'),
      label: t('stageGroups.nameLabel'),
    }))?.trim()
    if (!name) return
    if (groups.value.some((g) => g.name === name)) {
      const ok = await askConfirm({
        title: t('stageGroups.overwriteTitle'),
        message: t('stageGroups.overwriteConfirm', { name }),
      })
      if (!ok) return
    }
    await saveStageGroup(name, data, renderStageGroupThumbnail(data, stageDisplayName))
    await load()
  }

  async function onRename(group: StageGroup): Promise<void> {
    const name = (await askText({
      title: t('stageGroups.renameTitle'),
      label: t('stageGroups.nameLabel'),
      initialValue: group.name,
    }))?.trim()
    if (!name || name === group.name) return
    try {
      await renameStageGroup(group.id, name)
    } catch {
      return
    }
    await load()
  }

  async function onDelete(group: StageGroup): Promise<void> {
    const ok = await askConfirm({
      title: t('stageGroups.deleteTitle'),
      message: t('stageGroups.deleteConfirm', { name: group.name }),
      danger: true,
    })
    if (!ok) return
    await deleteStageGroup(group.id)
    await load()
  }

  function onInsert(group: StageGroup): void {
    insertStageGroup(group.data)
  }

  function onDragStart(group: StageGroup, e: DragEvent): void {
    if (!e.dataTransfer) return
    e.dataTransfer.setData(STAGE_GROUP_DRAG_MIME, JSON.stringify(group.data))
    e.dataTransfer.effectAllowed = 'copy'
  }

  watch(isActive, (active) => {
    if (active) void load()
  }, { immediate: true })

  return { groups, canSave, onSave, onRename, onDelete, onInsert, onDragStart }
}

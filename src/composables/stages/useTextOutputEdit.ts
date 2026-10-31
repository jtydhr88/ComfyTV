import { useI18n } from 'vue-i18n'

import { postEditText, postRestoreText } from '@/composables/stages/stageApi'
import { app } from '@/lib/comfyApp'
import { useStageStore, type StageState } from '@/stores/stageStore'

export function useTextOutputEdit(state: StageState) {
  const { t } = useI18n()
  const store = useStageStore()

  function toastFailed(e: any) {
    ;(app as any)?.extensionManager?.toast?.add?.({
      severity: 'error',
      summary: t('stage.action.editTextFailed'),
      detail: String(e?.message || e),
      life: 5000,
    })
  }

  async function saveText(text: string): Promise<void> {
    const sourceId = state.outputId
    const previous = state.output
    const previousEdited = state.textEdited
    if (!sourceId || !text.trim() || text === previous) return
    store.setOutputSlot(state, 0, text)
    state.textEdited = true
    try {
      const row = await postEditText(sourceId, text)
      if (row && state.outputId === sourceId) state.outputId = row.id
    } catch (e) {
      if (state.output === text) {
        store.setOutputSlot(state, 0, previous)
        state.textEdited = previousEdited
      }
      toastFailed(e)
    }
  }

  async function restoreText(): Promise<void> {
    const sourceId = state.outputId
    if (!sourceId) return
    try {
      const row = await postRestoreText(sourceId)
      if (!row || state.outputId !== sourceId) return
      state.outputId = row.id
      state.textEdited = false
      store.setOutputSlot(state, 0, row.payload_url)
    } catch (e) {
      toastFailed(e)
    }
  }

  return { saveText, restoreText }
}

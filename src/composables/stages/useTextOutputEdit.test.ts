import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const postEditText = vi.fn()
const postRestoreText = vi.fn()
vi.mock('@/composables/stages/stageApi', () => ({
  postEditText: (...a: unknown[]) => postEditText(...a),
  postRestoreText: (...a: unknown[]) => postRestoreText(...a),
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

import type { StageState } from '@/stores/stageStore'

import { useTextOutputEdit } from './useTextOutputEdit'

function textState(over: Partial<StageState> = {}): StageState {
  return {
    kind: 'text', variant: 'generator', outputType: 'text' as any,
    output: 'generated', outputs: ['generated'], running: false,
    inputs: [], mainPrompt: '', outputId: 7, ...over,
  } as StageState
}

describe('useTextOutputEdit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    postEditText.mockReset()
    postRestoreText.mockReset()
  })

  it('updates the output before the request so a downstream run reads the edit', async () => {
    let finish: (row: unknown) => void = () => {}
    postEditText.mockReturnValue(new Promise(r => { finish = r }))
    const state = textState()
    const pending = useTextOutputEdit(state).saveText('changed')
    expect(state.outputs[0]).toBe('changed')
    expect(state.output).toBe('changed')
    expect(state.textEdited).toBe(true)
    expect(postEditText).toHaveBeenCalledWith(7, 'changed')
    finish({ id: 8 })
    await pending
    expect(state.outputId).toBe(8)
  })

  it('skips unchanged and blank text', async () => {
    const state = textState()
    const { saveText } = useTextOutputEdit(state)
    await saveText('generated')
    await saveText('   ')
    expect(postEditText).not.toHaveBeenCalled()
    expect(state.output).toBe('generated')
    expect(state.textEdited).toBeUndefined()
  })

  it('rolls back when saving fails', async () => {
    postEditText.mockRejectedValue(new Error('nope'))
    const state = textState()
    await useTextOutputEdit(state).saveText('changed')
    expect(state.output).toBe('generated')
    expect(state.textEdited).toBeUndefined()
    expect(state.outputId).toBe(7)
  })

  it('keeps a newer run when the save response arrives late', async () => {
    let finish: (row: unknown) => void = () => {}
    postEditText.mockReturnValue(new Promise(r => { finish = r }))
    const state = textState()
    const pending = useTextOutputEdit(state).saveText('changed')
    state.outputId = 20
    finish({ id: 8 })
    await pending
    expect(state.outputId).toBe(20)
  })

  it('restores the original text', async () => {
    postRestoreText.mockResolvedValue({ id: 9, payload_url: 'generated' })
    const state = textState({ output: 'changed', outputs: ['changed'], textEdited: true })
    await useTextOutputEdit(state).restoreText()
    expect(postRestoreText).toHaveBeenCalledWith(7)
    expect(state.output).toBe('generated')
    expect(state.textEdited).toBe(false)
    expect(state.outputId).toBe(9)
  })
})

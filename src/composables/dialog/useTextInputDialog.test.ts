import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { askText } from './useTextInputDialog'

describe('askText', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opens the dialog and resolves with the entered value, then closes', async () => {
    const dialog = useDialogStore()
    const closeSpy = vi.spyOn(dialog, 'close')
    const p = askText({ title: 'New category', label: 'Name' })
    expect(dialog.open).toBe(true)
    expect(dialog.title).toBe('New category')

    const onResolve = (dialog.props as any).onResolve as (v: string | null) => void
    onResolve('characters')
    await expect(p).resolves.toBe('characters')
    expect(closeSpy).toHaveBeenCalled()
  })

  it('resolves null on cancel and ignores a second resolution', async () => {
    const dialog = useDialogStore()
    const p = askText({ title: 'T' })
    const onResolve = (dialog.props as any).onResolve as (v: string | null) => void
    onResolve(null)
    onResolve('too late')
    await expect(p).resolves.toBe(null)
  })
})

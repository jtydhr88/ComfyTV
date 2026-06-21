import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useDialogStore } from '@/stores/dialogStore'

import { askConfirm } from './useConfirmDialog'

describe('askConfirm', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opens the dialog and resolves true on confirm, then closes', async () => {
    const dialog = useDialogStore()
    const closeSpy = vi.spyOn(dialog, 'close')
    const p = askConfirm({ title: 'Delete category', message: 'Are you sure?' })
    expect(dialog.open).toBe(true)

    const onResolve = (dialog.props as any).onResolve as (v: boolean) => void
    onResolve(true)
    await expect(p).resolves.toBe(true)
    expect(closeSpy).toHaveBeenCalled()
  })

  it('resolves false on cancel and ignores a second resolution', async () => {
    const dialog = useDialogStore()
    const p = askConfirm({ title: 'T', message: 'm' })
    const onResolve = (dialog.props as any).onResolve as (v: boolean) => void
    onResolve(false)
    onResolve(true)
    await expect(p).resolves.toBe(false)
  })
})

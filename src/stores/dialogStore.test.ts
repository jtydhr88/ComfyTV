import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { useDialogStore } from './dialogStore'

const Cmp = defineComponent({ name: 'Stub', render: () => null })

describe('dialogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  it('starts closed with empty defaults', () => {
    const s = useDialogStore()
    expect(s.open).toBe(false)
    expect(s.title).toBe('')
    expect(s.component).toBeNull()
    expect(s.props).toEqual({})
    expect(s.width).toBe('720px')
  })

  it('show() populates fields and opens the dialog', () => {
    const s = useDialogStore()
    s.show({ title: 'Hi', component: Cmp, props: { msg: 'x' }, width: '420px' })
    expect(s.open).toBe(true)
    expect(s.title).toBe('Hi')
    expect(s.component).toBe(Cmp)
    expect(s.props).toEqual({ msg: 'x' })
    expect(s.width).toBe('420px')
  })

  it('show() without props or width falls back to defaults', () => {
    const s = useDialogStore()
    s.show({ title: 'A', component: Cmp })
    expect(s.props).toEqual({})
    expect(s.width).toBe('720px')
  })

  it('close() flips open immediately and clears component/props/title after the animation', () => {
    const s = useDialogStore()
    s.show({ title: 'A', component: Cmp, props: { v: 1 } })
    s.close()
    expect(s.open).toBe(false)
    expect(s.component).toBe(Cmp)
    expect(s.title).toBe('A')

    vi.advanceTimersByTime(180)
    expect(s.component).toBeNull()
    expect(s.title).toBe('')
    expect(s.props).toEqual({})
  })
})

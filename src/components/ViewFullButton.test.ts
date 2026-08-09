import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'

import { makeI18n } from '@/__tests__/renderHelpers'
import { useLightbox } from '@/composables/useLightbox'

import ViewFullButton from './ViewFullButton.vue'

function mountBtn(props: Record<string, unknown>) {
  return mount(ViewFullButton, {
    props,
    global: { plugins: [makeI18n()] },
  })
}

describe('ViewFullButton', () => {
  beforeEach(() => {
    useLightbox().close()
  })

  it('opens a single-item lightbox from url', async () => {
    const w = mountBtn({ url: 'http://x/img.png', label: 'img' })
    await w.trigger('click')
    const lb = useLightbox()
    expect(lb.isOpen.value).toBe(true)
    expect(lb.current.value).toEqual({ url: 'http://x/img.png', label: 'img' })
  })

  it('opens a gallery at the given index when items are provided', async () => {
    const items = [{ url: 'a' }, { url: 'b' }, { url: 'c' }]
    const w = mountBtn({ items, index: 2 })
    await w.trigger('click')
    const lb = useLightbox()
    expect(lb.count.value).toBe(3)
    expect(lb.index.value).toBe(2)
  })

  it('does nothing without url or items', async () => {
    const w = mountBtn({})
    await w.trigger('click')
    expect(useLightbox().isOpen.value).toBe(false)
  })
})

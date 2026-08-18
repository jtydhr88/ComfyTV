import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import ThumbImg from './ThumbImg.vue'

const SRC = '/view?filename=a.png&type=output'
const THUMB = `/comfytv/thumb?url=${encodeURIComponent(SRC)}&max=512`

describe('ThumbImg', () => {
  it('renders the thumb url for local image views', () => {
    const w = mount(ThumbImg, { props: { src: SRC } })
    expect(w.get('img').attributes('src')).toBe(THUMB)
  })

  it('respects thumbMax', () => {
    const w = mount(ThumbImg, { props: { src: SRC, thumbMax: 256 } })
    expect(w.get('img').attributes('src')).toContain('max=256')
  })

  it('falls back to the original src on error', async () => {
    const w = mount(ThumbImg, { props: { src: SRC } })
    await w.get('img').trigger('error')
    expect(w.get('img').attributes('src')).toBe(SRC)
  })

  it('does not loop when the original also errors', async () => {
    const w = mount(ThumbImg, { props: { src: SRC } })
    await w.get('img').trigger('error')
    await w.get('img').trigger('error')
    expect(w.get('img').attributes('src')).toBe(SRC)
  })

  it('resets the fallback when src changes', async () => {
    const w = mount(ThumbImg, { props: { src: SRC } })
    await w.get('img').trigger('error')
    const next = '/view?filename=b.png&type=output'
    await w.setProps({ src: next })
    await nextTick()
    expect(w.get('img').attributes('src'))
      .toBe(`/comfytv/thumb?url=${encodeURIComponent(next)}&max=512`)
  })

  it('passes non-view sources straight through', () => {
    const w = mount(ThumbImg, { props: { src: 'blob:http://x/1' } })
    expect(w.get('img').attributes('src')).toBe('blob:http://x/1')
  })

  it('inherits class and attrs onto the img element', () => {
    const w = mount(ThumbImg, {
      props: { src: SRC },
      attrs: { class: 'foo', draggable: 'false', alt: 'x' },
    })
    const img = w.get('img')
    expect(img.classes()).toContain('foo')
    expect(img.attributes('draggable')).toBe('false')
    expect(img.attributes('alt')).toBe('x')
  })
})

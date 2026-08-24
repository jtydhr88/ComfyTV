import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, ref } from 'vue'

const width = ref(0)
const height = ref(0)
const scrollY = ref(0)

vi.mock('@vueuse/core', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@vueuse/core')>()
  return {
    ...orig,
    useElementSize: () => ({ width, height }),
    useScroll: () => ({ y: scrollY }),
  }
})

import VirtualGrid from './VirtualGrid.vue'

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({ key: i, label: `item-${i}` }))
}

function mountGrid(count: number) {
  return mount(VirtualGrid as any, {
    props: {
      items: items(count),
      gridStyle: { display: 'grid', gap: '4px' },
    },
    slots: {
      item: ({ item }: any) => h('span', { class: 'cell' }, item.label),
    },
  })
}

describe('VirtualGrid', () => {
  beforeEach(() => {
    width.value = 0
    height.value = 0
    scrollY.value = 0
  })

  it('renders nothing before the container has a measured size', () => {
    const w = mountGrid(100)
    expect(w.findAll('.cell')).toHaveLength(0)
  })

  it('renders only the visible window plus buffer rows', async () => {
    const w = mountGrid(100)
    width.value = 320 // 2 cols at default item width 160
    height.value = 480 // 2 view rows at default item height 240
    await w.vm.$nextTick()
    // rows 0..(0 + 2 view + 2 buffer) → 8 cells
    const cells = w.findAll('.cell')
    expect(cells).toHaveLength(8)
    expect(cells[0].text()).toBe('item-0')
    expect(cells.at(-1)!.text()).toBe('item-7')
  })

  it('slides the window with scroll and keeps spacer heights consistent', async () => {
    const w = mountGrid(100)
    width.value = 320
    height.value = 480
    scrollY.value = 2400 // offsetRows = 10
    await w.vm.$nextTick()
    const cells = w.findAll('.cell')
    // rows 8..14 → items 16..27
    expect(cells[0].text()).toBe('item-16')
    expect(cells.at(-1)!.text()).toBe('item-27')
    const spacers = w.findAll('div > div')
    const top = (w.element.children[0] as HTMLElement).style.height
    const bottom = (w.element.children[2] as HTMLElement).style.height
    expect(top).toBe(`${(16 / 2) * 240}px`)
    expect(bottom).toBe(`${Math.ceil((100 - 28) / 2) * 240}px`)
    expect(spacers.length).toBeGreaterThan(0)
  })

  it('clamps the window at the end of the list', async () => {
    const w = mountGrid(10)
    width.value = 320
    height.value = 480
    // 10 items / 2 cols = 5 rows → content 1200px, container 480px → max scroll 720
    scrollY.value = 720
    await w.vm.$nextTick()
    const cells = w.findAll('.cell')
    expect(cells.at(-1)!.text()).toBe('item-9')
    const bottom = (w.element.children[2] as HTMLElement).style.height
    expect(bottom).toBe('0px')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const { fakeParamStore, getStageMeta } = vi.hoisted(() => {
  const fakeParamStore = {
    ensureHydrated: vi.fn(),
    installWebSocketSync: vi.fn(),
    hydrate: vi.fn(async () => {}),
    forKind: vi.fn((_kind: string): any[] => []),
  }
  return { fakeParamStore, getStageMeta: vi.fn((_cls: string): any => undefined) }
})
vi.mock('@/stores/stageParamStore', () => ({
  useStageParamStore: () => fakeParamStore,
}))
vi.mock('@/composables/stages/stageMeta', () => ({ getStageMeta }))

import {
  comboOptionsOf,
  defaultParamValue,
  parseParamItems,
  serializeParamItems,
  useCustomParams,
} from './useCustomParams'

const DEFS = [
  { key: 'steps', label: 'Steps', type: 'int', config: { min: 1, max: 50, step: 2 }, origin: 1 },
  { key: 'note', label: 'Note', type: 'string', config: { multiline: true, placeholder: 'hi' }, origin: 1 },
  { key: 'mode', label: 'Mode', type: 'combo', config: { options: ['a', 'b'] }, origin: 1 },
  { key: 'sys', label: 'Sys', type: 'string', config: {}, origin: 0 },
] as any[]

function makeNode(rawItems?: unknown[]) {
  return {
    comfyClass: 'ComfyTV.ImageStage',
    widgets: [{
      name: 'custom_params',
      value: rawItems ? JSON.stringify({ items: rawItems }) : '',
      callback: undefined as any,
    }],
  } as any
}

let wrappers: VueWrapper[] = []

async function setup(node: any, kind = 'image') {
  let api!: ReturnType<typeof useCustomParams>
  const wrapper = mount(defineComponent({
    setup() {
      api = useCustomParams(node, () => ({ kind } as any))
      return () => null
    },
  }))
  wrappers.push(wrapper)
  await vi.waitFor(() => expect(fakeParamStore.hydrate).toHaveBeenCalled())
  await nextTick()
  return api
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeParamStore.forKind.mockReturnValue(DEFS)
  getStageMeta.mockReturnValue(undefined)
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

describe('parseParamItems / serializeParamItems', () => {
  it('round-trips items and filters malformed rows', () => {
    const raw = serializeParamItems([{ key: 'a', value: 1 }])
    expect(parseParamItems(raw)).toEqual([{ key: 'a', value: 1 }])
    expect(parseParamItems(JSON.stringify({ items: [{ key: 'a' }, { value: 2 }, null, 'x'] })))
      .toEqual([{ key: 'a', value: undefined }])
  })

  it('tolerates bad JSON and missing items', () => {
    expect(parseParamItems('{bad')).toEqual([])
    expect(parseParamItems('{}')).toEqual([])
    expect(parseParamItems('{"items":7}')).toEqual([])
  })
})

describe('defaultParamValue / comboOptionsOf', () => {
  it('uses the declared default when present', () => {
    expect(defaultParamValue({ type: 'int', default: 7 } as any)).toBe(7)
  })

  it('falls back per type', () => {
    expect(defaultParamValue({ type: 'boolean' } as any)).toBe(false)
    expect(defaultParamValue({ type: 'int' } as any)).toBe(0)
    expect(defaultParamValue({ type: 'float' } as any)).toBe(0)
    expect(defaultParamValue({ type: 'combo', config: { options: ['x', 'y'] } } as any)).toBe('x')
    expect(defaultParamValue({ type: 'combo', config: {} } as any)).toBe('')
    expect(defaultParamValue({ type: 'string' } as any)).toBe('')
  })

  it('comboOptionsOf stringifies options and handles absence', () => {
    expect(comboOptionsOf({ config: { options: [1, 'b'] } } as any)).toEqual(['1', 'b'])
    expect(comboOptionsOf({ config: {} } as any)).toEqual([])
    expect(comboOptionsOf(undefined)).toEqual([])
  })
})

describe('useCustomParams — hydration + defs', () => {
  it('hydrates the store and reads persisted items on mount', async () => {
    const node = makeNode([{ key: 'steps', value: 20 }, { key: 'ghost', value: 1 }])
    const api = await setup(node)
    expect(fakeParamStore.ensureHydrated).toHaveBeenCalled()
    expect(fakeParamStore.installWebSocketSync).toHaveBeenCalled()
    expect(api.items.value).toEqual([{ key: 'steps', value: 20 }, { key: 'ghost', value: 1 }])
    expect(api.attached.value).toEqual([{ key: 'steps', value: 20 }])
    expect(api.available.value.map((d: any) => d.key)).toEqual(['note', 'mode'])
  })

  it('prefers the stage-meta workflow kind over the state kind', async () => {
    getStageMeta.mockReturnValue({ workflow_kind: 'special' })
    const api = await setup(makeNode(), 'image')
    void api.available.value
    expect(fakeParamStore.forKind).toHaveBeenCalledWith('special')
  })

  it('hasWidget reflects the presence of the custom_params widget', async () => {
    expect((await setup(makeNode())).hasWidget.value).toBe(true)
    expect((await setup({ comfyClass: '', widgets: [] })).hasWidget.value).toBe(false)
  })

  it('re-reads items when the widget callback fires', async () => {
    const node = makeNode([])
    const api = await setup(node)
    node.widgets[0].value = JSON.stringify({ items: [{ key: 'note', value: 'x' }] })
    node.widgets[0].callback('external')
    expect(api.items.value).toEqual([{ key: 'note', value: 'x' }])
  })
})

describe('useCustomParams — def helpers', () => {
  it('resolves label/type/config lookups with fallbacks', async () => {
    const api = await setup(makeNode())
    expect(api.defLabel('steps')).toBe('Steps')
    expect(api.defLabel('nope')).toBe('nope')
    expect(api.defType('mode')).toBe('combo')
    expect(api.defType('nope')).toBe('string')
    expect(api.cfgNum('steps', 'min')).toBe(1)
    expect(api.cfgNum('steps', 'nope')).toBeUndefined()
    expect(api.cfgStr('note', 'placeholder')).toBe('hi')
    expect(api.cfgStr('note', 'min')).toBeUndefined()
    expect(api.comboOptions('mode')).toEqual(['a', 'b'])
    expect(api.numVal('3.5')).toBe(3.5)
    expect(api.numVal('abc')).toBeNull()
  })

  it('useSlider needs an int type with min and max', async () => {
    const api = await setup(makeNode())
    expect(api.useSlider('steps')).toBe(true)
    expect(api.useSlider('note')).toBe(false)
  })
})

describe('useCustomParams — attach / detach / setVal', () => {
  it('attach adds the default value once and persists', async () => {
    const node = makeNode([])
    const api = await setup(node)
    api.menuOpen.value = true
    api.attach(DEFS[2])
    expect(api.menuOpen.value).toBe(false)
    expect(api.items.value).toEqual([{ key: 'mode', value: 'a' }])
    expect(node.widgets[0].value).toBe(JSON.stringify({ items: [{ key: 'mode', value: 'a' }] }))
    api.attach(DEFS[2])
    expect(api.items.value).toHaveLength(1)
  })

  it('setVal updates only the targeted key, detach removes it', async () => {
    const node = makeNode([{ key: 'steps', value: 20 }, { key: 'note', value: 'n' }])
    const api = await setup(node)
    api.setVal('steps', 33)
    expect(api.items.value).toEqual([{ key: 'steps', value: 33 }, { key: 'note', value: 'n' }])
    api.detach('note')
    expect(api.items.value).toEqual([{ key: 'steps', value: 33 }])
    expect(node.widgets[0].value).toBe(JSON.stringify({ items: [{ key: 'steps', value: 33 }] }))
  })
})

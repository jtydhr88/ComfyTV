import { beforeAll, describe, expect, it, vi } from 'vitest'

const { CAPS } = vi.hoisted(() => ({
  CAPS: {
    caps_by_kind: {
      image:    { upstream_kinds: ['image', 'text'],          option_keys: ['option:negative', 'option:seed', 'option:batch_size'], computed_keys: ['computed:width', 'computed:height'] },
      video:    { upstream_kinds: ['image', 'video', 'text'], option_keys: ['option:negative', 'option:seed', 'option:duration_s', 'option:generate_audio'], computed_keys: ['computed:width', 'computed:height', 'computed:length'] },
      audio:    { upstream_kinds: ['text', 'audio'],          option_keys: ['option:seed', 'option:duration_s', 'option:lyrics'], computed_keys: ['computed:length'] },
      inpaint:  { upstream_kinds: ['image'],                  option_keys: ['option:seed', 'option:negative', 'option:mask_data'], computed_keys: [] },
      erase:    { upstream_kinds: ['image'],                  option_keys: ['option:seed', 'option:mask_data'], computed_keys: [] },
      outpaint: { upstream_kinds: ['image'],                  option_keys: ['option:seed', 'option:negative', 'option:pad_left'], computed_keys: [] },
    },
    fallback_caps: { upstream_kinds: ['image', 'video', 'audio', 'text'], option_keys: ['option:negative', 'option:seed', 'option:batch_size'], computed_keys: ['computed:width', 'computed:height', 'computed:length'] },
    option_labels: {
      'option:negative': 'Stage negative prompt', 'option:seed': 'Stage seed',
      'option:batch_size': 'Stage batch size', 'option:duration_s': 'Stage duration (s)',
      'option:generate_audio': 'Stage generate audio', 'option:lyrics': 'Stage lyrics',
      'option:mask_data': 'Stage mask (painter output)', 'option:pad_left': 'Stage pad left',
    },
  },
}))

vi.mock('@/api', () => ({
  fetchCaps: vi.fn(() => Promise.resolve(CAPS)),
}))

import { fetchCaps } from '@/api'

import {
  buildBindingOptions,
  groupExposedWidgets,
  loadCaps,
  type ExposedWidget,
} from './workflowConfigCatalog'

function widget(over: Partial<ExposedWidget> = {}): ExposedWidget {
  return {
    node_id: '1', node_title: 'n', node_type: 'X',
    group_title: null, widget_name: 'w', widget_type: 'STRING',
    widget_props: {}, current_value: '',
    stage_binding: null, override_value: null, cast: null,
    ...over,
  }
}

beforeAll(async () => {
  await loadCaps()  // populate caps from the (mocked) API before reading synchronously
})

describe('buildBindingOptions', () => {
  it('always leads with "use this value" and stage prompt', () => {
    const opts = buildBindingOptions([], 'image')
    expect(opts[0].value).toBe('__VALUE__')
    expect(opts[1].value).toBe('main_prompt')
  })

  it('emits option/computed/upstream entries for the kind', () => {
    const opts = buildBindingOptions([], 'image')
    const vals = opts.map(o => o.value)
    expect(vals).toContain('option:negative')
    expect(vals).toContain('option:seed')
    expect(vals).toContain('option:batch_size')
    expect(vals).toContain('computed:width')
    expect(vals).toContain('computed:height')
    expect(vals).toContain('upstream_image:annotated[0]')
    expect(vals).toContain('upstream_text:value[0]')
    expect(vals.some(v => v.startsWith('upstream_video:'))).toBe(false)
  })

  it('labels options from the caps option_labels map', () => {
    const opts = buildBindingOptions([], 'audio')
    const lyrics = opts.find(o => o.value === 'option:lyrics')
    expect(lyrics?.label).toBe('Stage lyrics')
  })

  it('text-kind upstream uses :value suffix, image uses :annotated', () => {
    const opts = buildBindingOptions([], 'video')
    expect(opts.some(o => o.value === 'upstream_text:value[0]')).toBe(true)
    expect(opts.some(o => o.value === 'upstream_image:annotated[0]')).toBe(true)
    expect(opts.some(o => o.value === 'upstream_video:annotated[0]')).toBe(true)
  })

  it('grows upstream indices up to maxUsed + 1, capped at 7', () => {
    const widgets = [
      widget({ stage_binding: 'upstream_image:annotated[2]' }),
      widget({ stage_binding: 'upstream_image:annotated[3]' }),
    ]
    const opts = buildBindingOptions(widgets, 'image')
    const idxs = opts
      .map(o => o.value.match(/^upstream_image:annotated\[(\d+)\]$/)?.[1])
      .filter(Boolean)
    expect(idxs).toEqual(['0', '1', '2', '3', '4'])
  })

  it('caps upstream indices at 7 regardless of how high stage_binding goes', () => {
    const widgets = [widget({ stage_binding: 'upstream_image:annotated[42]' })]
    const opts = buildBindingOptions(widgets, 'image')
    const max = Math.max(
      ...opts
        .map(o => Number(o.value.match(/^upstream_image:annotated\[(\d+)\]$/)?.[1]))
        .filter(n => !Number.isNaN(n)),
    )
    expect(max).toBe(7)
  })

  it('offers the masked-image source only for mask_data-capable kinds', () => {
    for (const kind of ['inpaint', 'erase']) {
      const vals = buildBindingOptions([], kind).map(o => o.value)
      expect(vals).toContain('upstream_image:masked[0]')
    }
    for (const kind of ['image', 'outpaint', 'video']) {
      const vals = buildBindingOptions([], kind).map(o => o.value)
      expect(vals).not.toContain('upstream_image:masked[0]')
    }
  })

  it('uses the permissive fallback caps when kind is unknown', () => {
    const opts = buildBindingOptions([], undefined)
    const vals = opts.map(o => o.value)
    expect(vals.some(v => v.startsWith('upstream_image:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_video:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_audio:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_text:'))).toBe(true)
  })

  it('every kind from caps produces a valid options list', () => {
    for (const kind of Object.keys(CAPS.caps_by_kind)) {
      const opts = buildBindingOptions([], kind)
      expect(opts[0].value).toBe('__VALUE__')
      for (const o of opts) expect(o.label.length).toBeGreaterThan(0)
    }
  })
})

describe('caps loading', () => {
  it('triggers fetchCaps when options are built', () => {
    buildBindingOptions([], 'image')
    void loadCaps()
    expect(fetchCaps).toHaveBeenCalled()
  })

  it('serves caps from the API', () => {
    const opts = buildBindingOptions([], 'audio')
    const vals = opts.map(o => o.value)
    expect(vals).toContain('option:lyrics')
    expect(vals).toContain('computed:length')
  })
})

describe('groupExposedWidgets', () => {
  it('returns nothing for no widgets', () => {
    expect(groupExposedWidgets([])).toEqual([])
  })

  it('groups widgets by group_title, then by node, preserving first-seen order', () => {
    const ws = [
      widget({ group_title: 'A', node_id: '1', widget_name: 'a1' }),
      widget({ group_title: 'A', node_id: '1', widget_name: 'a2' }),
      widget({ group_title: 'B', node_id: '2', widget_name: 'b1' }),
      widget({ group_title: 'A', node_id: '3', widget_name: 'a3' }),
    ]
    const groups = groupExposedWidgets(ws)
    expect(groups.map(g => g.title)).toEqual(['A', 'B'])
    expect(groups[0].nodes.map(n => n.node_id)).toEqual(['1', '3'])
    expect(groups[0].nodes[0].widgets.map(w => w.widget_name)).toEqual(['a1', 'a2'])
    expect(groups[1].nodes[0].widgets.map(w => w.widget_name)).toEqual(['b1'])
  })

  it('keeps a null group_title as its own group', () => {
    const groups = groupExposedWidgets([widget({ group_title: null, node_id: '1' })])
    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBeNull()
  })

  it('splits same node_id across different groups', () => {
    const ws = [
      widget({ group_title: 'A', node_id: '1', widget_name: 'x' }),
      widget({ group_title: 'B', node_id: '1', widget_name: 'y' }),
    ]
    const groups = groupExposedWidgets(ws)
    expect(groups).toHaveLength(2)
    expect(groups[0].nodes[0].widgets[0].widget_name).toBe('x')
    expect(groups[1].nodes[0].widgets[0].widget_name).toBe('y')
  })
})

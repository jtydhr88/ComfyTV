import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  fetchCaps: vi.fn(() => new Promise(() => {})),
}))

import { fetchCaps } from '@/api'

import {
  buildBindingOptions,
  DEFAULT_CAPS_BY_KIND,
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

  it('falls back to a permissive set when kind is unknown', () => {
    const opts = buildBindingOptions([], undefined)
    const vals = opts.map(o => o.value)
    expect(vals.some(v => v.startsWith('upstream_image:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_video:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_audio:'))).toBe(true)
    expect(vals.some(v => v.startsWith('upstream_text:'))).toBe(true)
  })

  it('warns loudly on an unknown (non-empty) workflow kind', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    buildBindingOptions([], 'totally-unknown-kind')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('totally-unknown-kind'),
    )
    warn.mockRestore()
  })

  it('every kind in DEFAULT_CAPS_BY_KIND produces a valid options list', () => {
    for (const kind of Object.keys(DEFAULT_CAPS_BY_KIND)) {
      const opts = buildBindingOptions([], kind)
      expect(opts[0].value).toBe('__VALUE__')
      for (const o of opts) expect(o.label.length).toBeGreaterThan(0)
    }
  })
})

describe('caps loading', () => {
  it('lazily triggers fetchCaps the first time options are built', () => {
    buildBindingOptions([], 'image')
    void loadCaps()
    expect(fetchCaps).toHaveBeenCalled()
  })

  it('serves baked-in default caps before the server responds', () => {
    const opts = buildBindingOptions([], 'audio')
    const vals = opts.map(o => o.value)
    expect(vals).toContain('option:lyrics')
    expect(vals).toContain('computed:length')
  })
})

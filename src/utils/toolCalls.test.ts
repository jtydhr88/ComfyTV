import { describe, expect, it } from 'vitest'

import type { BotBlock } from '@/stores/botStore'
import {
  formatDuration,
  pairToolCalls,
  toolGlyph,
  toolLabel,
} from './toolCalls'

function use(name: string, id?: string): BotBlock {
  return { type: 'tool_use', name, input: {}, ...(id ? { id } : {}) }
}

function result(name: string, extra: Partial<BotBlock> = {}): BotBlock {
  return { type: 'tool_result', name, text: 'ok', ...extra }
}

describe('pairToolCalls', () => {
  it('pairs by id and applies status and duration', () => {
    const calls = pairToolCalls([
      use('mcp__comfytv__get_canvas', 'a'),
      use('mcp__comfytv__run_stage', 'b'),
      result('mcp__comfytv__run_stage',
             { id: 'b', status: 'error', duration_ms: 300 }),
      result('mcp__comfytv__get_canvas',
             { id: 'a', status: 'success', duration_ms: 120 }),
    ], false)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      label: 'get_canvas', status: 'success', durationMs: 120,
    })
    expect(calls[1]).toMatchObject({
      label: 'run_stage', status: 'error', durationMs: 300,
      resultText: 'ok',
    })
  })

  it('falls back to name pairing for legacy blocks without ids', () => {
    const calls = pairToolCalls([
      use('mcp__comfytv__assets'),
      result('mcp__comfytv__assets'),
    ], false)
    expect(calls[0].resultText).toBe('ok')
    expect(calls[0].status).toBe('success')
  })

  it('marks unresolved calls running while streaming', () => {
    const streaming = pairToolCalls([use('mcp__comfytv__wait_stage', 'w')], true)
    expect(streaming[0].status).toBe('running')
    const done = pairToolCalls([use('mcp__comfytv__wait_stage', 'w')], false)
    expect(done[0].status).toBe('success')
  })

  it('ignores stray results and non-tool blocks', () => {
    const calls = pairToolCalls([
      { type: 'text', text: 'hi' },
      result('mcp__comfytv__ghost', { id: 'nope' }),
    ], false)
    expect(calls).toEqual([])
  })
})

describe('toolLabel / toolGlyph / formatDuration', () => {
  it('strips server prefixes', () => {
    expect(toolLabel('mcp__comfytv__run_stage')).toBe('run_stage')
    expect(toolLabel('mcp__comfy__nodes')).toBe('comfy:nodes')
  })

  it('picks glyphs by status then name', () => {
    const base = {
      key: 'k', name: '', input: {}, resultText: null, durationMs: null,
    }
    expect(toolGlyph({ ...base, label: 'run_stage', status: 'running' }))
      .toBe('pi-spin pi-spinner')
    expect(toolGlyph({ ...base, label: 'run_stage', status: 'error' }))
      .toBe('pi-times-circle')
    expect(toolGlyph({ ...base, label: 'run_stage', status: 'success' }))
      .toBe('pi-play')
    expect(toolGlyph({ ...base, label: 'mystery', status: 'success' }))
      .toBe('pi-wrench')
  })

  it('formats durations across scales', () => {
    expect(formatDuration(80)).toBe('80ms')
    expect(formatDuration(1500)).toBe('1.5s')
    expect(formatDuration(65_000)).toBe('1m 5s')
  })
})

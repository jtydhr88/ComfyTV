import { describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type { StageState } from '@/stores/stageStore'

const downloadFile = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}))
vi.mock('@/utils/download', () => ({
  downloadFile: (...a: unknown[]) => downloadFile(...(a as [string]))
}))

import { LINE_ART_CONTROLS, useLineArt } from './useLineArt'

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: Array<{ name: string; value: unknown }> = []) {
  return {
    id: 1,
    type: 'ComfyTV.LineArtStage',
    widgets: widgets.map((w) => makeWidget(w.name, w.value)),
    onConfigure: null as unknown
  } as any
}

function makeState() {
  return reactive({
    inputs: [] as Array<{ slot: string; source: string; content: string | null }>,
    output: null as string | null,
    outputs: [null] as (string | null)[]
  }) as unknown as StageState
}

function widget(node: any, name: string) {
  return node.widgets.find((w: any) => w.name === name)
}

function setup(widgets: Array<{ name: string; value: unknown }> = []) {
  const node = makeNode(widgets)
  const state = makeState()
  return { node, state, api: useLineArt(node, state) }
}

describe('useLineArt: values', () => {
  it('seeds from widgets and falls back to defaults', () => {
    const { api } = setup([
      { name: 'width', value: 512 },
      { name: 'invert', value: true }
    ])
    expect(api.values.width).toBe(512)
    expect(api.values.invert).toBe(true)
    expect(api.values.height).toBe(1024)
    expect(api.values.crease).toBe(true)
    expect(api.values.crease_angle).toBe(60)
  })

  it('setValue clamps, rounds ints and writes the widget', () => {
    const { api, node } = setup([{ name: 'width', value: 1024 }])
    const width = LINE_ART_CONTROLS.find((c) => c.widget === 'width')!
    api.setValue(width, 99999)
    expect(api.values.width).toBe(4096)
    expect(widget(node, 'width').value).toBe(4096)
    api.setValue(width, '300.7')
    expect(api.values.width).toBe(301)
  })

  it('bool controls toggle', () => {
    const { api, node } = setup([{ name: 'occlusion', value: true }])
    const occ = LINE_ART_CONTROLS.find((c) => c.widget === 'occlusion')!
    api.setValue(occ, false)
    expect(api.values.occlusion).toBe(false)
    expect(widget(node, 'occlusion').value).toBe(false)
  })

  it('crease_angle hides when crease is off', () => {
    const { api } = setup([{ name: 'crease', value: true }])
    expect(api.visibleControls.value.map((c) => c.widget)).toContain('crease_angle')
    const crease = LINE_ART_CONTROLS.find((c) => c.widget === 'crease')!
    api.setValue(crease, false)
    expect(api.visibleControls.value.map((c) => c.widget)).not.toContain('crease_angle')
  })
})

describe('useLineArt: camera + result', () => {
  it('writeCamera serializes to the camera widget', () => {
    const { api, node } = setup([{ name: 'camera', value: '' }])
    api.writeCamera({ position: [1, 2, 3], target: [0, 0, 0], fov: 45 })
    expect(JSON.parse(widget(node, 'camera').value)).toEqual({
      position: [1, 2, 3], target: [0, 0, 0], fov: 45
    })
  })

  it('writeCamera ignores null', () => {
    const { api, node } = setup([{ name: 'camera', value: 'keep' }])
    api.writeCamera(null)
    expect(widget(node, 'camera').value).toBe('keep')
  })

  it('switches to the result view when an output arrives', async () => {
    const { api, state } = setup()
    expect(api.showResult.value).toBe(false)
    ;(state as any).output = '/view?filename=lineart.png'
    await nextTick()
    expect(api.resultUrl.value).toBe('/view?filename=lineart.png')
    expect(api.showResult.value).toBe(true)
  })

  it('onDownloadResult only fires with a result', async () => {
    const { api, state } = setup()
    await api.onDownloadResult()
    expect(downloadFile).not.toHaveBeenCalled()
    ;(state as any).output = '/view?filename=lineart.png'
    await api.onDownloadResult()
    expect(downloadFile).toHaveBeenCalledWith('/view?filename=lineart.png')
  })
})

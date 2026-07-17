import { describe, it, expect, vi } from 'vitest'
import { useVideoResize } from './useVideoResize'

function makeWidget(name: string, value: unknown) {
  return { name, value, callback: vi.fn() }
}

function makeNode(width = 1280, height = 720) {
  return {
    id: 1,
    widgets: [makeWidget('width', width), makeWidget('height', height)],
    onConfigure: null as any,
  } as any
}

function setup(width = 1280, height = 720) {
  const node = makeNode(width, height)
  const api = useVideoResize(node)
  return { node, api }
}

describe('useVideoResize', () => {
  it('seeds width/height from the widgets', () => {
    const { api } = setup(640, 360)
    expect(api.width.value).toBe(640)
    expect(api.height.value).toBe(360)
    expect(api.lockRatio.value).toBe(true)
  })

  it('onMeta records the source dimensions', () => {
    const { api } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    expect(api.srcW.value).toBe(1920)
    expect(api.srcH.value).toBe(1080)
  })

  it('setDim width with ratio lock derives an even height', () => {
    const { api, node } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    api.setDim('width', '1000')
    expect(api.width.value).toBe(1000)
    expect(api.height.value).toBe(562)
    expect(node.widgets[0].value).toBe(1000)
    expect(node.widgets[1].value).toBe(562)
  })

  it('setDim height with ratio lock derives an even width', () => {
    const { api } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    api.setDim('height', '540')
    expect(api.height.value).toBe(540)
    expect(api.width.value).toBe(960)
  })

  it('setDim without lock leaves the other axis alone', () => {
    const { api } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    api.lockRatio.value = false
    api.setDim('width', '1000')
    expect(api.width.value).toBe(1000)
    expect(api.height.value).toBe(720)
  })

  it('setDim maps <=0 to -1 (auto) and skips ratio math', () => {
    const { api } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    api.setDim('width', '0')
    expect(api.width.value).toBe(-1)
    expect(api.height.value).toBe(720)
  })

  it('setDim ignores non-numeric input', () => {
    const { api } = setup()
    api.setDim('width', 'abc')
    expect(api.width.value).toBe(1280)
  })

  it('setDim without source meta writes only the edited axis', () => {
    const { api } = setup()
    api.setDim('width', '800')
    expect(api.width.value).toBe(800)
    expect(api.height.value).toBe(720)
  })

  it('applyPreset keeps the aspect for landscape and portrait sources', () => {
    const { api } = setup()
    api.onMeta({ width: 1920, height: 1080 })
    api.applyPreset(720)
    expect(api.width.value).toBe(1280)
    expect(api.height.value).toBe(720)

    api.onMeta({ width: 1080, height: 1920 })
    api.applyPreset(480)
    expect(api.width.value).toBe(480)
    expect(api.height.value).toBe(854)
  })

  it('applyPreset is a no-op without source meta', () => {
    const { api } = setup()
    api.applyPreset(720)
    expect(api.width.value).toBe(1280)
    expect(api.height.value).toBe(720)
  })

  it('applySource copies even source dimensions', () => {
    const { api } = setup()
    api.onMeta({ width: 1919, height: 1080 })
    api.applySource()
    expect(api.width.value).toBe(1920)
    expect(api.height.value).toBe(1080)
  })

  it('applySource is a no-op without source meta', () => {
    const { api } = setup()
    api.applySource()
    expect(api.width.value).toBe(1280)
  })

  it('targetLabel resolves auto axes from the source aspect', () => {
    const { api } = setup()
    expect(api.targetLabel.value).toBe('1280×720')
    api.onMeta({ width: 1920, height: 1080 })
    api.setDim('width', '0')
    expect(api.targetLabel.value).toBe('1280×720')
  })

  it('targetLabel is a dash when nothing resolves', () => {
    const { api } = setup(-1, -1)
    expect(api.targetLabel.value).toBe('—')
  })
})

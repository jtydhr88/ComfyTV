import { beforeEach, describe, expect, it, vi } from 'vitest'

const uploadBlobNamed = vi.hoisted(() => vi.fn(async (f: File, ..._a: unknown[]) => ({ name: f.name })))
vi.mock('@/utils/uploadCanvas', () => ({ uploadBlobNamed }))

import {
  PLAIN_LOADER_WIDGET,
  loaderDropConfigOf,
  uploadLoaderFiles,
  useStageLoaderDrop,
} from './useStageLoaderDrop'

function makeLoaderNode(comfyClass = 'ComfyTV.ImageLoaderStage', values: string[] = []) {
  return {
    comfyClass,
    widgets: [{ name: 'image', value: '', options: { values }, callback: undefined as any }],
  } as any
}

function fileDragEvent(files: File[] = [], type = 'image/png') {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: {
      types: ['Files'],
      items: files.length ? files.map(() => ({ kind: 'file', type })) : [{ kind: 'file', type }],
      files,
      dropEffect: '',
      getData: () => '',
    },
  } as unknown as DragEvent
}

beforeEach(() => {
  uploadBlobNamed.mockClear()
})

describe('loaderDropConfigOf', () => {
  it('maps the three plain loader classes', () => {
    expect(loaderDropConfigOf(makeLoaderNode('ComfyTV.ImageLoaderStage')))
      .toEqual({ kind: 'image', widget: 'image' })
    expect(loaderDropConfigOf(makeLoaderNode('ComfyTV.VideoLoaderStage')))
      .toEqual({ kind: 'video', widget: 'video' })
    expect(loaderDropConfigOf(makeLoaderNode('ComfyTV.AudioLoaderStage')))
      .toEqual({ kind: 'audio', widget: 'audio' })
    expect(Object.keys(PLAIN_LOADER_WIDGET)).toHaveLength(3)
  })

  it('returns null for other nodes or no node', () => {
    expect(loaderDropConfigOf(makeLoaderNode('ComfyTV.ImageStage'))).toBeNull()
    expect(loaderDropConfigOf(undefined)).toBeNull()
  })
})

describe('uploadLoaderFiles', () => {
  it('uploads every file, appends unique combo values, selects the last', async () => {
    const node = makeLoaderNode('ComfyTV.ImageLoaderStage', ['existing.png'])
    const files = [
      new File([''], 'a.png', { type: 'image/png' }),
      new File([''], 'existing.png', { type: 'image/png' }),
    ]
    await uploadLoaderFiles(node, 'image', files)
    expect(uploadBlobNamed).toHaveBeenCalledTimes(2)
    expect(uploadBlobNamed.mock.calls[0][1]).toEqual({ subfolder: '', filename: 'a.png' })
    expect(node.widgets[0].options.values).toEqual(['existing.png', 'a.png'])
    expect(node.widgets[0].value).toBe('existing.png')
  })

  it('writes nothing when no files were uploaded', async () => {
    const node = makeLoaderNode()
    await uploadLoaderFiles(node, 'image', [])
    expect(node.widgets[0].value).toBe('')
  })
})

describe('useStageLoaderDrop', () => {
  it('ignores drag events on non-loader nodes', () => {
    const drop = useStageLoaderDrop(() => makeLoaderNode('ComfyTV.ImageStage'))
    const e = fileDragEvent()
    drop.onCardDragEnter(e)
    drop.onCardDragOver(e)
    expect(drop.dragActive.value).toBe(false)
    expect(e.preventDefault).not.toHaveBeenCalled()
  })

  it('activates the drop highlight for matching drags on loader nodes', () => {
    const drop = useStageLoaderDrop(() => makeLoaderNode())
    const e = fileDragEvent()
    drop.onCardDragEnter(e)
    expect(drop.dragActive.value).toBe(true)
    drop.onCardDragLeave(e)
    expect(drop.dragActive.value).toBe(false)
  })

  it('dropping matching files uploads them into the loader widget', async () => {
    const node = makeLoaderNode()
    const drop = useStageLoaderDrop(() => node)
    const file = new File([''], 'dropped.png', { type: 'image/png' })
    drop.onCardDrop(fileDragEvent([file]))
    await vi.waitFor(() => expect(uploadBlobNamed).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(node.widgets[0].value).toBe('dropped.png'))
  })

  it('drops on non-loader nodes never reach the uploader', () => {
    const drop = useStageLoaderDrop(() => makeLoaderNode('ComfyTV.ImageStage'))
    drop.onCardDrop(fileDragEvent([new File([''], 'x.png', { type: 'image/png' })]))
    expect(uploadBlobNamed).not.toHaveBeenCalled()
  })
})

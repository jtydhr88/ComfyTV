import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

const getStageMeta = vi.fn()
vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (...a: any[]) => getStageMeta(...a),
}))

import { addOptionEverywhere, removeOptionEverywhere } from './workflowCombo'

function stage(kind: string, value: string, values: string[], cb = vi.fn()) {
  return {
    comfyClass: `ComfyTV.${kind}Stage`,
    _kind: kind,
    widgets: [{ name: 'workflow', value, options: { values: [...values] }, callback: cb }],
  }
}

describe('workflowCombo', () => {
  beforeEach(() => {
    getStageMeta.mockReset()
    getStageMeta.mockImplementation((cls: string) => ({
      workflow_kind: cls?.includes('image') ? 'image' : 'video',
    }))
    ;(app as any).graph._nodes = []
  })

  describe('addOptionEverywhere', () => {
    it('adds the label only to matching-kind combos, without dupes', () => {
      const img = stage('image', 'A', ['A'])
      const vid = stage('video', 'X', ['X'])
      ;(app as any).graph._nodes = [img, vid]

      addOptionEverywhere('image', 'B')
      addOptionEverywhere('image', 'B')

      expect(img.widgets[0].options.values).toEqual(['A', 'B'])
      expect(vid.widgets[0].options.values).toEqual(['X'])
    })
  })

  describe('removeOptionEverywhere', () => {
    it('removes the label from matching combos', () => {
      const img = stage('image', 'A', ['A', 'B'])
      ;(app as any).graph._nodes = [img]

      removeOptionEverywhere('image', 'B')
      expect(img.widgets[0].options.values).toEqual(['A'])
    })

    it('resets a stage currently set to the removed label and fires callback', () => {
      const cb = vi.fn()
      const img = stage('image', 'B', ['A', 'B'], cb)
      ;(app as any).graph._nodes = [img]

      removeOptionEverywhere('image', 'B')
      expect(img.widgets[0].options.values).toEqual(['A'])
      expect(img.widgets[0].value).toBe('A')
      expect(cb).toHaveBeenCalledWith('A')
    })

    it('falls back to empty when no options remain', () => {
      const cb = vi.fn()
      const img = stage('image', 'B', ['B'], cb)
      ;(app as any).graph._nodes = [img]

      removeOptionEverywhere('image', 'B')
      expect(img.widgets[0].value).toBe('')
      expect(cb).toHaveBeenCalledWith('')
    })

    it('leaves other kinds untouched', () => {
      const vid = stage('video', 'B', ['A', 'B'])
      ;(app as any).graph._nodes = [vid]

      removeOptionEverywhere('image', 'B')
      expect(vid.widgets[0].options.values).toEqual(['A', 'B'])
      expect(vid.widgets[0].value).toBe('B')
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

const getStageMeta = vi.fn()
vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (...a: any[]) => getStageMeta(...a),
}))

const listFavoriteWorkflows = vi.fn()
vi.mock('@/api', () => ({
  listFavoriteWorkflows: (...a: any[]) => listFavoriteWorkflows(...a),
}))

import { addOptionEverywhere, comboOptionsVersion, lastFavoriteOption, loadFavoriteWorkflows, removeOptionEverywhere, setDefaultOptionInDefs } from './workflowCombo'

function stage(kind: string, value: string, values: string[], cb = vi.fn()) {
  return {
    comfyClass: `ComfyTV.${kind}Stage`,
    _kind: kind,
    widgets: [{ name: 'workflow', value, options: { values: [...values] }, callback: cb }],
  }
}

function registerDef(kind: string, options: string[], def = options[0] ?? '') {
  const spec = { options: [...options], default: def }
  ;(window as any).LiteGraph.registered_node_types[`ComfyTV.${kind}Stage`] = {
    nodeData: { inputs: { workflow: spec } },
  }
  return spec
}

describe('workflowCombo', () => {
  beforeEach(() => {
    getStageMeta.mockReset()
    getStageMeta.mockImplementation((cls: string) => ({
      workflow_kind: cls?.includes('image') ? 'image' : 'video',
    }))
    ;(app as any).graph._nodes = []
    ;(window as any).LiteGraph = { registered_node_types: {} }
  })

  describe('lastFavoriteOption', () => {
    it('returns the end of the leading favorites for that kind only', async () => {
      listFavoriteWorkflows.mockResolvedValue({ favorites: { image: ['S', 'F'] } })
      await loadFavoriteWorkflows()
      expect(lastFavoriteOption('image', ['S', 'F', 'A'])).toBe('F')
      expect(lastFavoriteOption('image', ['A', 'S'])).toBeUndefined()
      expect(lastFavoriteOption('video', ['S', 'F'])).toBeUndefined()
    })
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

    it('keeps the current value when reassignValue is false', () => {
      const cb = vi.fn()
      const img = stage('image', 'B', ['A', 'B'], cb)
      ;(app as any).graph._nodes = [img]

      removeOptionEverywhere('image', 'B', false)
      expect(img.widgets[0].options.values).toEqual(['A'])
      expect(img.widgets[0].value).toBe('B')
      expect(cb).not.toHaveBeenCalled()
    })

    it('leaves other kinds untouched', () => {
      const vid = stage('video', 'B', ['A', 'B'])
      ;(app as any).graph._nodes = [vid]

      removeOptionEverywhere('image', 'B')
      expect(vid.widgets[0].options.values).toEqual(['A', 'B'])
      expect(vid.widgets[0].value).toBe('B')
    })
  })

  describe('registered node def patching', () => {
    it('add pushes into the def options without dupes', () => {
      const spec = registerDef('image', ['A'])
      addOptionEverywhere('image', 'B')
      addOptionEverywhere('image', 'B')
      expect(spec.options).toEqual(['A', 'B'])
    })

    it('remove splices the def options and reassigns a removed default', () => {
      const spec = registerDef('image', ['A', 'B'], 'B')
      removeOptionEverywhere('image', 'B', false)
      expect(spec.options).toEqual(['A'])
      expect(spec.default).toBe('A')
    })

    it('setDefaultOptionInDefs sets and clears back to the first option', () => {
      const spec = registerDef('image', ['A', 'B'], 'A')
      setDefaultOptionInDefs('image', 'B')
      expect(spec.default).toBe('B')
      setDefaultOptionInDefs('image', null)
      expect(spec.default).toBe('A')
    })

    it('ignores defs of other kinds', () => {
      const spec = registerDef('video', ['X'])
      addOptionEverywhere('image', 'B')
      expect(spec.options).toEqual(['X'])
    })

    it('bumps comboOptionsVersion so Vue consumers re-render', () => {
      const before = comboOptionsVersion.value
      addOptionEverywhere('image', 'B')
      expect(comboOptionsVersion.value).toBe(before + 1)
      removeOptionEverywhere('image', 'B', false)
      expect(comboOptionsVersion.value).toBe(before + 2)
    })
  })
})

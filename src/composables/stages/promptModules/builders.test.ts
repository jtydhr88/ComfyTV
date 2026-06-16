import { describe, expect, it } from 'vitest'

import { buildCameraSuffix } from '../cameraControlCatalog'
import { applyModule } from './applyModule'
import { BUILDER_COMPOSERS, CAMERA_BUILDER } from './builders'

describe('CAMERA_BUILDER', () => {
  it('is an edit-time, append builder on the builder surface', () => {
    expect(CAMERA_BUILDER.kind).toBe('builder')
    expect(CAMERA_BUILDER.apply).toBe('append')
    expect(CAMERA_BUILDER.resolveAt).toBe('edit')
    expect(CAMERA_BUILDER.surfaces).toEqual(['builder'])
  })

  it('exposes camera/lens/focal/aperture params, each with a none option', () => {
    expect(CAMERA_BUILDER.params?.map(p => p.id)).toEqual(['camera', 'lens', 'focal', 'aperture'])
    for (const p of CAMERA_BUILDER.params ?? []) {
      expect(p.options[0].value).toBe('')
      expect(p.options.length).toBeGreaterThan(1)
    }
  })

  it('registers a composer keyed by its id', () => {
    expect(typeof BUILDER_COMPOSERS[CAMERA_BUILDER.id]).toBe('function')
  })
})

describe('applyModule via the camera builder', () => {
  it('composes the selection grammar and appends it to the prompt', () => {
    const out = applyModule(CAMERA_BUILDER, {
      currentPrompt: 'a lone figure',
      params: { camera: 'Classic 16mm Film', focal: '85', aperture: 'f/1.4' },
    })
    const suffix = buildCameraSuffix({
      camera: 'classic 16mm film camera',
      focalMm: 85,
      perspective: 'classic portrait perspective',
      aperture: 'f/1.4',
      depth: 'shallow depth of field, creamy bokeh',
    })
    expect(out).toBe(`a lone figure, ${suffix}`)
  })

  it('is a no-op when nothing is selected (empty suffix dropped)', () => {
    expect(applyModule(CAMERA_BUILDER, { currentPrompt: 'a cat', params: {} })).toBe('a cat')
  })

  it('uses only the suffix when the prompt is empty', () => {
    const out = applyModule(CAMERA_BUILDER, { currentPrompt: '', params: { aperture: 'f/4' } })
    expect(out).toBe('aperture f/4, balanced depth of field, cinematic lighting, natural color science, high dynamic range')
  })
})

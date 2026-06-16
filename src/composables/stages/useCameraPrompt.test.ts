import { describe, expect, it } from 'vitest'

import { buildCameraSuffix } from './cameraControlCatalog'
import { useCameraPrompt } from './useCameraPrompt'

describe('buildCameraSuffix', () => {
  it('returns empty when nothing is selected', () => {
    expect(buildCameraSuffix({})).toBe('')
  })

  it('camera only', () => {
    expect(buildCameraSuffix({ camera: 'full-frame digital cinema camera' }))
      .toBe('shot on a full-frame digital cinema camera, cinematic lighting, natural color science, high dynamic range')
  })

  it('lens + focal + perspective', () => {
    expect(buildCameraSuffix({ lens: 'vintage prime lens', focalMm: 85, perspective: 'classic portrait perspective' }))
      .toBe('using a vintage prime lens at 85mm (classic portrait perspective), cinematic lighting, natural color science, high dynamic range')
  })

  it('focal without lens still produces a shot at Nmm', () => {
    expect(buildCameraSuffix({ focalMm: 35, perspective: 'natural cinematic perspective' }))
      .toBe('shot at 35mm (natural cinematic perspective), cinematic lighting, natural color science, high dynamic range')
  })

  it('aperture adds the depth effect', () => {
    expect(buildCameraSuffix({ aperture: 'f/1.4', depth: 'shallow depth of field, creamy bokeh' }))
      .toBe('aperture f/1.4, shallow depth of field, creamy bokeh, cinematic lighting, natural color science, high dynamic range')
  })

  it('all parts compose in camera/lens/aperture order', () => {
    const s = buildCameraSuffix({
      camera: 'modular 8K digital cinema camera',
      lens: 'compact anamorphic lens',
      focalMm: 50,
      perspective: 'standard portrait perspective',
      aperture: 'f/4',
      depth: 'balanced depth of field',
    })
    expect(s).toBe(
      'shot on a modular 8K digital cinema camera, ' +
      'using a compact anamorphic lens at 50mm (standard portrait perspective), ' +
      'aperture f/4, balanced depth of field, ' +
      'cinematic lighting, natural color science, high dynamic range',
    )
  })
})

describe('useCameraPrompt', () => {
  it('compiled reflects the selected labels (resolved to phrases) reactively', () => {
    const c = useCameraPrompt()
    expect(c.compiled.value).toBe('')

    c.camera.value = 'Classic 16mm Film'
    expect(c.compiled.value).toContain('shot on a classic 16mm film camera')

    c.focal.value = '85'
    expect(c.compiled.value).toContain('at 85mm (classic portrait perspective)')

    c.aperture.value = 'f/1.4'
    expect(c.compiled.value).toContain('aperture f/1.4, shallow depth of field, creamy bokeh')
  })

  it('reset clears all selections', () => {
    const c = useCameraPrompt()
    c.camera.value = 'Classic 16mm Film'
    c.aperture.value = 'f/11'
    c.reset()
    expect(c.compiled.value).toBe('')
  })

  it('exposes the catalog option lists', () => {
    const c = useCameraPrompt()
    expect(c.cameras.length).toBeGreaterThan(0)
    expect(c.apertures.length).toBe(3)
  })
})

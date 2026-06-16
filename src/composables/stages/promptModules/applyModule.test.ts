import { describe, expect, it } from 'vitest'

import { applyModule, composeBuilder, fillSubject, resolveBody, SUBJECT_PLACEHOLDER } from './applyModule'
import type { PromptModule } from './types'

function mod(partial: Partial<PromptModule> & Pick<PromptModule, 'kind' | 'apply'>): PromptModule {
  return {
    id: 't', source: 'builtin', body: '', resolveAt: 'edit', surfaces: ['panel'],
    ...partial,
  }
}

describe('fillSubject', () => {
  it('replaces every {subject} with the live prompt', () => {
    expect(fillSubject('a {subject} b {subject}', 'cat')).toBe('a cat b cat')
  })

  it('uses the placeholder hint when the subject is blank', () => {
    expect(fillSubject('x {subject} y', '   ')).toBe(`x ${SUBJECT_PLACEHOLDER} y`)
  })

  it('passes bodies without a slot through untouched', () => {
    expect(fillSubject('no slot here', 'cat')).toBe('no slot here')
  })

  it('trims the subject before substitution', () => {
    expect(fillSubject('{subject}', '  hero  ')).toBe('hero')
  })
})

describe('composeBuilder', () => {
  const camera = mod({
    kind: 'builder', apply: 'append',
    params: [
      { id: 'camera', options: [] },
      { id: 'lens', options: [] },
      { id: 'aperture', options: [] },
    ],
  })

  it('joins selected values in declared order, dropping empties', () => {
    expect(composeBuilder(camera, { camera: 'ARRI Alexa', lens: '', aperture: 'f/1.8' }))
      .toBe('ARRI Alexa, f/1.8')
  })

  it('returns empty when nothing is selected', () => {
    expect(composeBuilder(camera, {})).toBe('')
  })

  it('preserves param order regardless of object key order', () => {
    expect(composeBuilder(camera, { aperture: 'f/2', camera: 'RED', lens: '50mm' }))
      .toBe('RED, 50mm, f/2')
  })
})

describe('resolveBody', () => {
  it('fills {subject} for non-builder kinds', () => {
    const m = mod({ kind: 'template', apply: 'wrap', body: 'SCENE: {subject}.' })
    expect(resolveBody(m, { currentPrompt: 'a knight' })).toBe('SCENE: a knight.')
  })

  it('composes params for builder kinds, ignoring body', () => {
    const m = mod({ kind: 'builder', apply: 'append', body: 'IGNORED', params: [{ id: 'a', options: [] }] })
    expect(resolveBody(m, { currentPrompt: 'x', params: { a: '85mm' } })).toBe('85mm')
  })
})

describe('applyModule', () => {
  it('toggle adds a tag when absent and removes it when present', () => {
    const m = mod({ kind: 'tag', apply: 'toggle', body: '8K resolution' })
    expect(applyModule(m, { currentPrompt: 'a cat' })).toBe('a cat, 8K resolution')
    expect(applyModule(m, { currentPrompt: 'a cat, 8K resolution, blue' })).toBe('a cat, blue')
  })

  it('wrap returns the subject-folded body as the whole prompt', () => {
    const m = mod({ kind: 'template', apply: 'wrap', body: 'A: {subject}. B' })
    expect(applyModule(m, { currentPrompt: 'hero' })).toBe('A: hero. B')
  })

  it('append joins prompt and body with the default separator', () => {
    const m = mod({ kind: 'tag', apply: 'append', body: 'cinematic' })
    expect(applyModule(m, { currentPrompt: 'a cat' })).toBe('a cat, cinematic')
  })

  it('append honors a custom separator and drops an empty prompt', () => {
    const m = mod({ kind: 'template', apply: 'append', body: 'UPSCALE', separator: '\n\n' })
    expect(applyModule(m, { currentPrompt: 'a cat' })).toBe('a cat\n\nUPSCALE')
    expect(applyModule(m, { currentPrompt: '' })).toBe('UPSCALE')
  })

  it('prepend puts the body before the prompt', () => {
    const m = mod({ kind: 'tag', apply: 'prepend', body: 'masterpiece' })
    expect(applyModule(m, { currentPrompt: 'a cat' })).toBe('masterpiece, a cat')
  })

  it('replace swaps the whole prompt for the body', () => {
    const m = mod({ kind: 'template', apply: 'replace', body: 'brand new' })
    expect(applyModule(m, { currentPrompt: 'old text' })).toBe('brand new')
  })

  it('insert is a no-op in the pure engine (handled by the surface)', () => {
    const m = mod({ kind: 'snippet', apply: 'insert', resolveAt: 'run', body: '@hero' })
    expect(applyModule(m, { currentPrompt: 'a cat' })).toBe('a cat')
  })

  it('composes a builder suffix onto the prompt', () => {
    const m = mod({
      kind: 'builder', apply: 'append',
      params: [{ id: 'camera', options: [] }, { id: 'lens', options: [] }],
    })
    expect(applyModule(m, { currentPrompt: 'a street', params: { camera: 'RED', lens: '35mm' } }))
      .toBe('a street, RED, 35mm')
  })
})

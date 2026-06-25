import { describe, expect, it } from 'vitest'

import { ensureStageUid, getStageUid, stageClassName } from './stageIdentity'

describe('ensureStageUid', () => {
  it('returns empty string for a missing node', () => {
    expect(ensureStageUid(null)).toBe('')
    expect(ensureStageUid(undefined)).toBe('')
  })

  it('creates a uid and persists it on the node', () => {
    const node: any = {}
    const uid = ensureStageUid(node)
    expect(uid).toBeTruthy()
    expect(node.properties.comfytv_stage_uid).toBe(uid)
  })

  it('is idempotent — same uid on repeated calls', () => {
    const node: any = {}
    expect(ensureStageUid(node)).toBe(ensureStageUid(node))
  })

  it('initialises a non-object properties bag', () => {
    const node: any = { properties: 'bad' }
    const uid = ensureStageUid(node)
    expect(typeof node.properties).toBe('object')
    expect(node.properties.comfytv_stage_uid).toBe(uid)
  })

  it('replaces an empty/invalid existing uid', () => {
    const node: any = { properties: { comfytv_stage_uid: '' } }
    expect(ensureStageUid(node)).not.toBe('')
    const node2: any = { properties: { comfytv_stage_uid: 123 } }
    expect(typeof ensureStageUid(node2)).toBe('string')
  })
})

describe('getStageUid', () => {
  it('reads an existing uid or returns empty', () => {
    expect(getStageUid({ properties: { comfytv_stage_uid: 'abc' } })).toBe('abc')
    expect(getStageUid({})).toBe('')
    expect(getStageUid(null)).toBe('')
    expect(getStageUid({ properties: { comfytv_stage_uid: 7 } })).toBe('')
  })
})

describe('stageClassName', () => {
  it('strips the dotted namespace prefix', () => {
    expect(stageClassName({ comfyClass: 'ComfyTV.ImageStage' })).toBe('ImageStage')
  })

  it('falls back to type and handles no dot', () => {
    expect(stageClassName({ type: 'PlainType' })).toBe('PlainType')
    expect(stageClassName({})).toBe('')
    expect(stageClassName(null)).toBe('')
  })
})

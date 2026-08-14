import { describe, expect, it } from 'vitest'

import {
  describeShotPose,
  fovToFocalMm,
  movementPhrase,
  shotLevelLabel,
  shotSizeLabel,
  shotViewLabel
} from './filmVocab'

describe('shotSizeLabel', () => {
  it('walks the ladder from close-up to extreme wide', () => {
    expect(shotSizeLabel(1.2, 45, 1.7)).toBe('extreme close-up')
    expect(shotSizeLabel(3, 45, 1.7)).toBe('close-up')
    expect(shotSizeLabel(7, 45, 1.7)).toBe('medium shot')
    expect(shotSizeLabel(9, 45, 1.7)).toBe('medium wide shot')
    expect(shotSizeLabel(20, 45, 1.7)).toBe('wide shot')
    expect(shotSizeLabel(80, 45, 1.7)).toBe('extreme wide shot')
  })
})

describe('shotLevelLabel', () => {
  it('maps camera height deltas to angle labels', () => {
    expect(shotLevelLabel(0.2, 1.6)).toBe('ground level')
    expect(shotLevelLabel(1.0, 1.6)).toBe('low angle')
    expect(shotLevelLabel(1.6, 1.6)).toBe('eye level')
    expect(shotLevelLabel(3.0, 1.6)).toBe('high angle')
    expect(shotLevelLabel(6, 1.6)).toBe("bird's-eye view")
  })
})

describe('shotViewLabel', () => {
  it('classifies azimuth against the subject facing', () => {
    const subject = { x: 0, z: 0, facingYaw: 0 }
    expect(shotViewLabel({ x: 0, z: 5 }, subject)).toBe('front view')
    expect(shotViewLabel({ x: 5, z: 5 }, subject)).toBe('front three-quarter view')
    expect(shotViewLabel({ x: 5, z: 0 }, subject)).toBe('profile view')
    expect(shotViewLabel({ x: 5, z: -5 }, subject)).toBe('rear three-quarter view')
    expect(shotViewLabel({ x: 0, z: -5 }, subject)).toBe('view from behind')
    expect(shotViewLabel({ x: 0, z: 5 }, { x: 0, z: 0, facingYaw: null })).toBeNull()
  })
})

describe('fovToFocalMm', () => {
  it('snaps to the nearest standard focal length', () => {
    expect(fovToFocalMm(50)).toBe(24)
    expect(fovToFocalMm(27)).toBe(50)
    expect(fovToFocalMm(16)).toBe(85)
  })
})

describe('movementPhrase', () => {
  it('translates preset ids into phrases and appends tracking', () => {
    expect(movementPhrase('push_slow', false)).toBe('a push-in toward the subject')
    expect(movementPhrase('crane_sweep', true)).toBe(
      'a crane move, tracking the subject'
    )
    expect(movementPhrase(null, true)).toBe('the camera tracking the subject')
    expect(movementPhrase(null, false)).toBe('a locked-off camera')
  })
})

describe('describeShotPose', () => {
  it('composes a full camera-language sentence', () => {
    const description = describeShotPose(
      { x: 0, y: 1.6, z: 6, fovDeg: 40 },
      { x: 0, y: 0, z: 0, heightM: 1.7, facingYaw: 0 },
      'push_slow',
      true
    )
    expect(description.text).toBe(
      'medium shot, eye level, front view, 35mm lens, a push-in toward the subject, tracking the subject'
    )
  })
})

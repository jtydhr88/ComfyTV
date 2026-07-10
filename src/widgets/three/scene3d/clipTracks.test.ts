import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import { bindClipToRoot } from './clipTracks'

function makeRoot(): THREE.Object3D {
  const root = new THREE.Group()
  const bone = new THREE.Bone()
  bone.name = 'Hips'
  root.add(bone)
  return root
}

describe('bindClipToRoot', () => {
  it('returns the clip unchanged when every track resolves', () => {
    const clip = new THREE.AnimationClip('walk', 1, [
      new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 1, 0, 0])
    ])
    expect(bindClipToRoot(clip, makeRoot())).toBe(clip)
  })

  it('drops tracks whose target node is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const clip = new THREE.AnimationClip('walk', 1, [
      new THREE.VectorKeyframeTrack(
        'Hips.position',
        [0, 1],
        [0, 0, 0, 1, 0, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'MissingBone.position',
        [0, 1],
        [0, 0, 0, 1, 0, 0]
      )
    ])
    const bound = bindClipToRoot(clip, makeRoot())
    expect(bound).not.toBe(clip)
    expect(bound.tracks.map((track) => track.name)).toEqual(['Hips.position'])
    expect(bound.name).toBe('walk')
    expect(bound.duration).toBe(1)
    expect(clip.tracks).toHaveLength(2)
    warn.mockRestore()
  })
})

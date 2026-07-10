import * as THREE from 'three'

export function bindClipToRoot(
  clip: THREE.AnimationClip,
  root: THREE.Object3D
): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => {
    const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name)
    if (!nodeName) return false
    const found = THREE.PropertyBinding.findNode(root, nodeName)
    if (!found) {
      console.warn(
        `scene3d: dropping animation track '${track.name}' (no node '${nodeName}' on character)`
      )
    }
    return found !== null && found !== undefined
  })
  if (tracks.length === clip.tracks.length) return clip
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

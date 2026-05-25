import * as THREE from 'three'

let renderer: THREE.WebGLRenderer | null = null

export function getOffscreenRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
  }
  return renderer
}

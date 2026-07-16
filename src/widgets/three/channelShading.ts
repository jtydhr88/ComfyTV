import * as THREE from 'three'

export type ViewChannel = 'material' | 'clay' | 'normal' | 'wire' | 'uv'

const ORIG_KEY = '__ctvChannelOriginalMaterial'
export const OVERLAY_FLAG = '__ctvChannelOverlay'

let normalMat: THREE.MeshNormalMaterial | null = null
let clayMat: THREE.MeshStandardMaterial | null = null
let wireBaseMat: THREE.MeshStandardMaterial | null = null
let wireMat: THREE.MeshBasicMaterial | null = null
let uvMat: THREE.MeshBasicMaterial | null = null

function getNormalMat(): THREE.MeshNormalMaterial {
  return (normalMat ??= new THREE.MeshNormalMaterial())
}

function getClayMat(): THREE.MeshStandardMaterial {
  return (clayMat ??= new THREE.MeshStandardMaterial({
    color: 0xb5b5b5, roughness: 0.9, metalness: 0.0,
  }))
}

function getWireBaseMat(): THREE.MeshStandardMaterial {
  if (!wireBaseMat) {
    wireBaseMat = getClayMat().clone()
    wireBaseMat.polygonOffset = true
    wireBaseMat.polygonOffsetFactor = 1
    wireBaseMat.polygonOffsetUnits = 1
  }
  return wireBaseMat
}

function getWireMat(): THREE.MeshBasicMaterial {
  return (wireMat ??= new THREE.MeshBasicMaterial({ wireframe: true, color: 0x4ea8ff }))
}

function makeUvCheckerTexture(): THREE.Texture {
  const size = 512
  const cells = 8
  const cell = size / cells
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#9c9c9c' : '#5f5f5f'
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }
  }
  ctx.strokeStyle = 'rgba(78, 168, 255, 0.85)'
  ctx.lineWidth = 2
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(size, i * cell); ctx.stroke()
  }
  ctx.fillStyle = '#e05555'
  ctx.fillRect(0, 0, cell, cell / 4)
  ctx.fillStyle = '#55c060'
  ctx.fillRect(0, 0, cell / 4, cell)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function getUvMat(): THREE.MeshBasicMaterial {
  return (uvMat ??= new THREE.MeshBasicMaterial({ map: makeUvCheckerTexture() }))
}

export function applyViewChannel(root: THREE.Object3D, channel: ViewChannel): void {
  const overlays: THREE.Object3D[] = []
  root.traverse((child) => {
    if (child.userData?.[OVERLAY_FLAG]) overlays.push(child)
  })
  for (const o of overlays) o.parent?.remove(o)

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child.userData[OVERLAY_FLAG]) return
    if (channel === 'material') {
      if (ORIG_KEY in child.userData) {
        child.material = child.userData[ORIG_KEY]
        delete child.userData[ORIG_KEY]
      }
      return
    }
    if (!(ORIG_KEY in child.userData)) child.userData[ORIG_KEY] = child.material
    if (channel === 'normal') {
      child.material = getNormalMat()
    } else if (channel === 'clay') {
      child.material = getClayMat()
    } else if (channel === 'uv') {
      child.material = getUvMat()
    } else {
      child.material = getWireBaseMat()
      const overlay = new THREE.Mesh(child.geometry, getWireMat())
      overlay.userData[OVERLAY_FLAG] = true
      child.add(overlay)
    }
  })
}

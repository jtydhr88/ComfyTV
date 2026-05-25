import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { getOffscreenRenderer } from './sharedRenderer'


export interface PanoramaViewerOptions {
  container: HTMLElement
  onOrbitEnd?: () => void
}


export interface CameraOrientation {
  yaw: number
  pitch: number
  fov: number
}


function getExt(url: string): string {
  try {
    const u = new URL(url, window.location.origin)
    const fn = u.searchParams.get('filename')
    if (fn) {
      const dot = fn.lastIndexOf('.')
      if (dot >= 0) return fn.slice(dot + 1).toLowerCase()
    }
    const path = u.pathname.split('?')[0]
    const dot = path.lastIndexOf('.')
    if (dot >= 0) return path.slice(dot + 1).toLowerCase()
  } catch {
  }
  const cleaned = url.split('?')[0]
  const dot = cleaned.lastIndexOf('.')
  return dot >= 0 ? cleaned.slice(dot + 1).toLowerCase() : ''
}


export class PanoramaViewer {
  private container: HTMLElement
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private sphere: THREE.Mesh
  private material: THREE.MeshBasicMaterial
  private currentTexture: THREE.Texture | null = null
  private animationId: number | null = null
  private resizeObserver: ResizeObserver | null = null

  private onOrbitEnd: (() => void) | undefined

  constructor(options: PanoramaViewerOptions) {
    this.container = options.container
    this.onOrbitEnd = options.onOrbitEnd
    const w = this.container.clientWidth || 400
    const h = this.container.clientHeight || 300

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0a0a0f)

    this.camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 2000)
    this.camera.position.set(0, 0, 0.01)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(w, h, false)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.container.appendChild(this.renderer.domElement)

    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      (e) => {
        e.preventDefault()
        console.warn('[ComfyTV/PanoramaViewer] WebGL context lost — awaiting restore')
      },
      false,
    )
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      () => {
        console.warn('[ComfyTV/PanoramaViewer] WebGL context restored')
        if (this.currentTexture) {
          this.material.map = this.currentTexture
          this.material.needsUpdate = true
        }
      },
      false,
    )

    const geo = new THREE.SphereGeometry(500, 60, 40)
    geo.scale(-1, 1, 1)
    this.material = new THREE.MeshBasicMaterial({ side: THREE.FrontSide })
    this.sphere = new THREE.Mesh(geo, this.material)
    this.scene.add(this.sphere)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.rotateSpeed = -0.3
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    if (this.onOrbitEnd) {
      this.controls.addEventListener('end', this.onOrbitEnd)
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize())
      this.resizeObserver.observe(this.container)
    }

    this.animate()
  }

  async setPanoramaUrl(url: string | null): Promise<void> {
    if (!url) {
      this.clearTexture()
      return
    }
    const ext = getExt(url)
    let texture: THREE.Texture
    try {
      if (ext === 'hdr') {
        texture = await new Promise<THREE.Texture>((resolve, reject) => {
          new RGBELoader().load(url, resolve, undefined, reject)
        })
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.0
      } else if (ext === 'exr') {
        texture = await new Promise<THREE.Texture>((resolve, reject) => {
          new EXRLoader().load(url, resolve, undefined, reject)
        })
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping
        this.renderer.toneMappingExposure = 1.0
      } else {
        texture = await new Promise<THREE.Texture>((resolve, reject) => {
          new THREE.TextureLoader().load(url, resolve, undefined, reject)
        })
        texture.colorSpace = THREE.SRGBColorSpace
        this.renderer.toneMapping = THREE.NoToneMapping
      }
    } catch (e) {
      console.error('[ComfyTV/PanoramaViewer] texture load failed', url, e)
      throw e
    }
    texture.mapping = THREE.EquirectangularReflectionMapping

    const old = this.currentTexture
    this.currentTexture = texture
    this.material.map = texture
    this.material.needsUpdate = true
    old?.dispose()
  }

  getCameraOrientation(): CameraOrientation {
    const pos = this.camera.position
    const x = pos.x, y = pos.y, z = pos.z
    const r = Math.max(1e-6, Math.hypot(x, y, z))
    const pitchRad = Math.asin(y / r)
    const yawRad = Math.atan2(x, z)
    return {
      yaw:   -(yawRad * 180) / Math.PI,
      pitch: (pitchRad * 180) / Math.PI,
      fov:   this.camera.fov,
    }
  }

  setCameraOrientation(orient: Partial<CameraOrientation>): void {
    if (typeof orient.fov === 'number') {
      this.camera.fov = orient.fov
      this.camera.updateProjectionMatrix()
    }
    const cur = this.getCameraOrientation()
    const yaw   = typeof orient.yaw   === 'number' ? orient.yaw   : cur.yaw
    const pitch = typeof orient.pitch === 'number' ? orient.pitch : cur.pitch
    const yawRad = (-yaw * Math.PI) / 180
    const pitchRad = (pitch * Math.PI) / 180
    const r = 0.01
    const x = r * Math.cos(pitchRad) * Math.sin(yawRad)
    const y = r * Math.sin(pitchRad)
    const z = r * Math.cos(pitchRad) * Math.cos(yawRad)
    this.camera.position.set(x, y, z)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  captureCurrentView(width: number, height: number): HTMLCanvasElement {
    const prevSize = new THREE.Vector2()
    this.renderer.getSize(prevSize)
    const prevAspect = this.camera.aspect
    const prevPixelRatio = this.renderer.getPixelRatio()

    this.renderer.setPixelRatio(1)
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)

    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    ctx.drawImage(this.renderer.domElement, 0, 0)

    this.renderer.setPixelRatio(prevPixelRatio)
    this.renderer.setSize(prevSize.x, prevSize.y, false)
    this.camera.aspect = prevAspect
    this.camera.updateProjectionMatrix()
    return out
  }

  private clearTexture(): void {
    if (this.currentTexture) {
      this.material.map = null
      this.material.needsUpdate = true
      this.currentTexture.dispose()
      this.currentTexture = null
    }
  }

  private resize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private animate = () => {
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.animationId = requestAnimationFrame(this.animate)
  }

  dispose(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.onOrbitEnd) {
      this.controls.removeEventListener('end', this.onOrbitEnd)
    }
    this.controls.dispose()
    this.clearTexture()
    this.sphere.geometry.dispose()
    this.material.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement)
    }
  }
}

export async function capturePanoramaOffscreen(
  url: string,
  options: { yaw: number; pitch: number; fov: number; width: number; height: number },
): Promise<HTMLCanvasElement> {
  const { yaw, pitch, fov, width, height } = options
  const ext = getExt(url)

  let texture: THREE.Texture
  let isHDR = false
  if (ext === 'hdr') {
    texture = await new Promise<THREE.Texture>((resolve, reject) => {
      new RGBELoader().load(url, resolve, undefined, reject)
    })
    isHDR = true
  } else if (ext === 'exr') {
    texture = await new Promise<THREE.Texture>((resolve, reject) => {
      new EXRLoader().load(url, resolve, undefined, reject)
    })
    isHDR = true
  } else {
    texture = await new Promise<THREE.Texture>((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject)
    })
    texture.colorSpace = THREE.SRGBColorSpace
  }
  texture.mapping = THREE.EquirectangularReflectionMapping

  const scene = new THREE.Scene()
  const geo = new THREE.SphereGeometry(500, 60, 40)
  geo.scale(-1, 1, 1)
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.FrontSide })
  const sphere = new THREE.Mesh(geo, mat)
  scene.add(sphere)

  const cam = new THREE.PerspectiveCamera(fov, width / height, 0.1, 2000)
  cam.position.set(0, 0, 0)
  const yawRad = (-yaw * Math.PI) / 180
  const pitchRad = (pitch * Math.PI) / 180
  cam.lookAt(
    Math.sin(yawRad) * Math.cos(pitchRad),
    Math.sin(pitchRad),
    Math.cos(yawRad) * Math.cos(pitchRad),
  )

  const renderer = getOffscreenRenderer()
  renderer.setSize(width, height, false)
  renderer.toneMapping = isHDR ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping
  renderer.toneMappingExposure = 1.0
  renderer.render(scene, cam)

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  const ctx = out.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  ctx.drawImage(renderer.domElement, 0, 0)

  texture.dispose()
  mat.dispose()
  geo.dispose()

  return out
}

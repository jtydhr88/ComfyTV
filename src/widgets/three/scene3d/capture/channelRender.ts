import * as THREE from 'three'

import {
  applyRendererViewState,
  copyRendererRegion,
  ensureRendererSize
} from '@/widgets/three/sharedWebGLRenderer'

import type { Scene3dViewport } from '../Scene3dViewport'
import {
  drawPoseFrame,
  mapCharacterKeypoints,
  projectKeypoints
} from './openposeSkeleton'

export type SceneChannel = 'color' | 'depth' | 'normal' | 'openpose'

export const SCENE_CHANNELS: readonly SceneChannel[] = [
  'color',
  'depth',
  'normal',
  'openpose'
]

const DEPTH_SCALE = 1000

const DEPTH_VERTEX =  `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vViewPosition;
void main() {
  #include <skinbase_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vViewPosition = mvPosition.xyz;
}
`

const DEPTH_FRAGMENT =  `
#include <packing>
varying vec3 vViewPosition;
void main() {
  float distanceToCamera = length(vViewPosition) / ${DEPTH_SCALE.toFixed(1)};
  gl_FragColor = packDepthToRGBA(clamp(distanceToCamera, 0.0, 1.0));
}
`

function unpackRGBAToDepth(
  r: number,
  g: number,
  b: number,
  a: number
): number {
  const UnpackDownscale = 255 / 256
  return (
    (r / 255) * UnpackDownscale +
    (g / 255) * (UnpackDownscale / 256) +
    (b / 255) * (UnpackDownscale / 65536) +
    (a / 255) / 16777216
  )
}

export class ChannelRenderer {
  private depthTarget: THREE.WebGLRenderTarget | null = null
  private depthMaterial: THREE.ShaderMaterial | null = null
  private normalMaterial: THREE.MeshNormalMaterial | null = null
  private depthPixels: Uint8Array | null = null

  constructor(private readonly viewport: Scene3dViewport) {}

  render(channel: SceneChannel, target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    switch (channel) {
      case 'color':
        this.renderColor(target, ctx)
        break
      case 'normal':
        this.renderNormal(target, ctx)
        break
      case 'depth':
        this.renderDepth(target, ctx)
        break
      case 'openpose':
        this.renderOpenpose(target, ctx)
        break
    }
  }

  private get renderer(): THREE.WebGLRenderer {
    return this.viewport.renderer
  }

  private get scene(): THREE.Scene {
    return this.viewport.sceneManager.scene
  }

  private get camera(): THREE.Camera {
    return this.viewport.getCaptureCamera()
  }

  private prepareViewport(width: number, height: number): void {
    ensureRendererSize(this.renderer, width, height)
    applyRendererViewState(this.renderer, this.viewport.viewState)
    this.renderer.setViewport(0, 0, width, height)
    this.renderer.setScissor(0, 0, width, height)
    this.renderer.setScissorTest(true)
  }

  private renderColor(
    target: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): void {
    this.prepareViewport(target.width, target.height)
    this.renderer.clear()
    this.viewport.sceneManager.renderBackground()
    this.renderer.render(this.scene, this.camera)
    copyRendererRegion(this.renderer, ctx, target.width, target.height)
  }

  private renderNormal(
    target: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): void {
    this.normalMaterial ??= new THREE.MeshNormalMaterial({
      side: THREE.DoubleSide
    })
    const previousOverride = this.scene.overrideMaterial
    const previousClearColor = this.renderer.getClearColor(new THREE.Color())
    const previousClearAlpha = this.renderer.getClearAlpha()
    try {
      this.prepareViewport(target.width, target.height)
      this.scene.overrideMaterial = this.normalMaterial
      this.renderer.setClearColor(new THREE.Color(0.5, 0.5, 1.0), 1)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
      copyRendererRegion(this.renderer, ctx, target.width, target.height)
    } finally {
      this.scene.overrideMaterial = previousOverride
      this.renderer.setClearColor(previousClearColor, previousClearAlpha)
    }
  }

  private renderDepth(
    target: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): void {
    const width = target.width
    const height = target.height
    if (
      !this.depthTarget ||
      this.depthTarget.width !== width ||
      this.depthTarget.height !== height
    ) {
      this.depthTarget?.dispose()
      this.depthTarget = new THREE.WebGLRenderTarget(width, height, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: true
      })
      this.depthPixels = new Uint8Array(width * height * 4)
    }
    this.depthMaterial ??= new THREE.ShaderMaterial({
      vertexShader: DEPTH_VERTEX,
      fragmentShader: DEPTH_FRAGMENT,
      side: THREE.DoubleSide
    })

    const previousOverride = this.scene.overrideMaterial
    const previousTarget = this.renderer.getRenderTarget()
    const previousClearColor = this.renderer.getClearColor(new THREE.Color())
    const previousClearAlpha = this.renderer.getClearAlpha()
    try {
      this.scene.overrideMaterial = this.depthMaterial
      this.renderer.setRenderTarget(this.depthTarget)
      this.renderer.setViewport(0, 0, width, height)
      this.renderer.setScissorTest(false)
      this.renderer.setClearColor(0x000000, 0)
      this.renderer.clear()
      this.renderer.render(this.scene, this.camera)
      this.renderer.readRenderTargetPixels(
        this.depthTarget,
        0,
        0,
        width,
        height,
        this.depthPixels!
      )
    } finally {
      this.renderer.setRenderTarget(previousTarget)
      this.renderer.setClearColor(previousClearColor, previousClearAlpha)
      this.scene.overrideMaterial = previousOverride
    }

    const pixels = this.depthPixels!
    const count = width * height
    const distances = new Float32Array(count)
    let min = Infinity
    let max = -Infinity
    for (let i = 0; i < count; i++) {
      const o = i * 4
      const d = unpackRGBAToDepth(
        pixels[o],
        pixels[o + 1],
        pixels[o + 2],
        pixels[o + 3]
      )
      distances[i] = d
      if (d > 0) {
        if (d < min) min = d
        if (d > max) max = d
      }
    }

    const span = Math.max(max - min, 1e-6)
    const image = ctx.createImageData(width, height)
    const out = image.data
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width
      const dstRow = y * width
      for (let x = 0; x < width; x++) {
        const d = distances[srcRow + x]
        const value =
          d > 0 ? Math.round(((max - d) / span) * 255) : 0
        const o = (dstRow + x) * 4
        out[o] = value
        out[o + 1] = value
        out[o + 2] = value
        out[o + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  }

  private renderOpenpose(
    target: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ): void {
    const camera = this.camera
    const characters: Array<ReadonlyMap<number, readonly [number, number]>> =
      []
    for (const root of this.viewport.openposeRoots()) {
      const keypoints = mapCharacterKeypoints(root)
      if (!keypoints) continue
      root.updateMatrixWorld(true)
      characters.push(
        projectKeypoints(keypoints, camera, target.width, target.height)
      )
    }
    drawPoseFrame(ctx, target.width, target.height, characters)
  }

  dispose(): void {
    this.depthTarget?.dispose()
    this.depthTarget = null
    this.depthMaterial?.dispose()
    this.depthMaterial = null
    this.normalMaterial?.dispose()
    this.normalMaterial = null
    this.depthPixels = null
  }
}

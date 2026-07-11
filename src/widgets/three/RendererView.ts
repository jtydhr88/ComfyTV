import type * as THREE from 'three'

import type {
  RendererViewState,
  SharedRendererHandle
} from './sharedWebGLRenderer'
import {
  acquireSharedRenderer,
  applyRendererViewState,
  copyRendererRegion,
  createRendererViewState,
  ensureRendererSize
} from './sharedWebGLRenderer'

export class RendererView {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly state: RendererViewState = createRendererViewState()

  width = 1
  height = 1

  private readonly context: CanvasRenderingContext2D
  private readonly handle: SharedRendererHandle
  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.style.position = 'absolute'
    this.canvas.style.inset = '0'
    this.canvas.style.width = '100%'
    this.canvas.style.height = '100%'
    this.canvas.style.outline = 'none'
    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to create 2D context for 3D view')
    }
    this.context = context

    this.handle = acquireSharedRenderer()
    this.renderer = this.handle.renderer
    container.appendChild(this.canvas)
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width))
    this.height = Math.max(1, Math.round(height))
    if (this.canvas.width !== this.width) this.canvas.width = this.width
    if (this.canvas.height !== this.height) this.canvas.height = this.height
    ensureRendererSize(this.renderer, this.width, this.height)
  }

  beginRender(): void {
    ensureRendererSize(this.renderer, this.width, this.height)
    applyRendererViewState(this.renderer, this.state)
  }

  blit(): void {
    copyRendererRegion(this.renderer, this.context, this.width, this.height)
  }

  renderScene(scene: THREE.Scene, camera: THREE.Camera): void {
    this.beginRender()
    const renderer = this.renderer
    renderer.setViewport(0, 0, this.width, this.height)
    renderer.setScissor(0, 0, this.width, this.height)
    renderer.setScissorTest(true)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setScissorTest(false)
    this.blit()
  }

  renderToCanvas(
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number
  ): HTMLCanvasElement {
    const renderer = this.renderer
    ensureRendererSize(renderer, width, height)
    applyRendererViewState(renderer, this.state)
    renderer.setViewport(0, 0, width, height)
    renderer.setScissor(0, 0, width, height)
    renderer.setScissorTest(true)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setScissorTest(false)

    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    copyRendererRegion(renderer, ctx, width, height)
    return out
  }

  observeResize(target: Element, onResize: () => void): void {
    if (typeof ResizeObserver === 'undefined') return
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => onResize())
    this.resizeObserver.observe(target)
  }

  dispose(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.canvas.remove()
    this.handle.release()
  }
}

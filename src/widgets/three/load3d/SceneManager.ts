import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {
  type BackgroundRenderModeType,
  type EventManagerInterface,
  type SceneManagerInterface
} from './interfaces'

export class SceneManager implements SceneManagerInterface {
  scene!: THREE.Scene
  gridHelper: THREE.GridHelper

  backgroundScene!: THREE.Scene
  backgroundCamera: THREE.OrthographicCamera
  backgroundMesh: THREE.Mesh | null = null
  backgroundTexture: THREE.Texture | null = null

  backgroundRenderMode: 'tiled' | 'panorama' = 'tiled'

  backgroundColorMaterial: THREE.MeshBasicMaterial | null = null
  currentBackgroundType: 'color' | 'image' = 'color'
  currentBackgroundColor: string = '#282828'

  private eventManager: EventManagerInterface
  private renderer: THREE.WebGLRenderer

  private getActiveCamera: () => THREE.Camera

  constructor(
    renderer: THREE.WebGLRenderer,
    getActiveCamera: () => THREE.Camera,
    _getControls: () => OrbitControls,
    eventManager: EventManagerInterface
  ) {
    this.renderer = renderer
    this.eventManager = eventManager
    this.scene = new THREE.Scene()

    this.scene.name = 'MainScene'

    this.getActiveCamera = getActiveCamera

    this.gridHelper = new THREE.GridHelper(20, 20)
    this.gridHelper.position.set(0, 0, 0)
    this.scene.add(this.gridHelper)

    this.backgroundScene = new THREE.Scene()
    this.backgroundScene.name = 'BackgroundScene'
    this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)

    this.initBackgroundScene()
  }

  private initBackgroundScene(): void {
    const planeGeometry = new THREE.PlaneGeometry(2, 2)

    this.backgroundColorMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.currentBackgroundColor),
      transparent: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    this.backgroundMesh = new THREE.Mesh(
      planeGeometry,
      this.backgroundColorMaterial
    )
    this.backgroundMesh.position.set(0, 0, 0)
    this.backgroundScene.add(this.backgroundMesh)

    this.renderer.setClearColor(0x000000, 0)
  }

  init(): void {}

  dispose(): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
    }

    if (this.backgroundColorMaterial) {
      this.backgroundColorMaterial.dispose()
    }

    if (this.backgroundMesh) {
      this.backgroundMesh.geometry.dispose()
      if (this.backgroundMesh.material instanceof THREE.Material) {
        this.backgroundMesh.material.dispose()
      }
    }

    if (this.scene.background) {
      this.scene.background = null
    }

    this.backgroundScene.clear()

    this.scene.clear()
  }

  toggleGrid(showGrid: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = showGrid
    }

    this.eventManager.emitEvent('showGridChange', showGrid)
  }

  setBackgroundColor(color: string): void {
    this.currentBackgroundColor = color
    this.currentBackgroundType = 'color'

    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background = null
    }

    if (this.backgroundRenderMode === 'panorama') {
      this.backgroundRenderMode = 'tiled'
      this.eventManager.emitEvent('backgroundRenderModeChange', 'tiled')
    }

    if (!this.backgroundMesh || !this.backgroundColorMaterial) {
      this.initBackgroundScene()
    }

    this.backgroundColorMaterial!.color.set(color)
    this.backgroundColorMaterial!.map = null
    this.backgroundColorMaterial!.transparent = false
    this.backgroundColorMaterial!.needsUpdate = true

    if (this.backgroundMesh) {
      this.backgroundMesh.material = this.backgroundColorMaterial!
    }

    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
      this.backgroundTexture = null
    }

    this.eventManager.emitEvent('backgroundColorChange', color)
  }

  async setBackgroundImage(_uploadPath: string): Promise<void> {
    this.setBackgroundColor(this.currentBackgroundColor)
    this.eventManager.emitEvent('backgroundImageLoadingEnd', null)
  }

  removeBackgroundImage(): void {
    this.setBackgroundColor(this.currentBackgroundColor)
    this.eventManager.emitEvent('backgroundImageLoadingEnd', null)
  }

  setBackgroundRenderMode(mode: BackgroundRenderModeType): void {
    if (this.backgroundRenderMode === mode) return

    this.backgroundRenderMode = mode

    if (this.currentBackgroundType === 'image' && this.backgroundTexture) {
      try {
        if (mode === 'panorama') {
          this.backgroundTexture.mapping =
            THREE.EquirectangularReflectionMapping
          this.scene.background = this.backgroundTexture
        } else {
          this.scene.background = null
          if (
            this.backgroundMesh &&
            this.backgroundMesh.material instanceof THREE.MeshBasicMaterial
          ) {
            this.backgroundMesh.material.map = this.backgroundTexture
            this.backgroundMesh.material.needsUpdate = true
          }
        }
      } catch (error) {
        console.error('Error set background render mode:', error)
      }
    }

    this.eventManager.emitEvent('backgroundRenderModeChange', mode)
  }

  updateBackgroundSize(
    backgroundTexture: THREE.Texture | null,
    backgroundMesh: THREE.Mesh | null,
    targetWidth: number,
    targetHeight: number
  ): void {
    if (!backgroundTexture || !backgroundMesh) return

    const material = backgroundMesh.material as THREE.MeshBasicMaterial

    if (!material.map) return

    const image = backgroundTexture.image as { width: number; height: number }
    const imageAspect = image.width / image.height
    const targetAspect = targetWidth / targetHeight

    if (imageAspect > targetAspect) {
      backgroundMesh.scale.set(imageAspect / targetAspect, 1, 1)
    } else {
      backgroundMesh.scale.set(1, targetAspect / imageAspect, 1)
    }

    material.needsUpdate = true
  }

  handleResize(width: number, height: number): void {
    if (
      this.backgroundTexture &&
      this.backgroundMesh &&
      this.currentBackgroundType === 'image'
    ) {
      this.updateBackgroundSize(
        this.backgroundTexture,
        this.backgroundMesh,
        width,
        height
      )
    }
  }

  renderBackground(): void {
    if (
      (this.backgroundRenderMode === 'tiled' ||
        this.currentBackgroundType === 'color') &&
      this.backgroundMesh
    ) {
      const currentToneMapping = this.renderer.toneMapping
      const currentExposure = this.renderer.toneMappingExposure

      this.renderer.toneMapping = THREE.NoToneMapping
      this.renderer.render(this.backgroundScene, this.backgroundCamera)

      this.renderer.toneMapping = currentToneMapping
      this.renderer.toneMappingExposure = currentExposure
    }
  }

  getCurrentBackgroundInfo(): { type: 'color' | 'image'; value: string } {
    return {
      type: this.currentBackgroundType,
      value:
        this.currentBackgroundType === 'color'
          ? this.currentBackgroundColor
          : ''
    }
  }

  async captureScene(
    width: number,
    height: number
  ): Promise<{ scene: string; mask: string; normal: string }> {
    const originalSize = new THREE.Vector2()
    this.renderer.getSize(originalSize)
    const originalPixelRatio = this.renderer.getPixelRatio()
    const originalClearColor = this.renderer.getClearColor(new THREE.Color())
    const originalClearAlpha = this.renderer.getClearAlpha()
    const originalOutputColorSpace = this.renderer.outputColorSpace

    const activeCamera = this.getActiveCamera()
    const savedCameraParams =
      activeCamera instanceof THREE.PerspectiveCamera
        ? { type: 'perspective' as const, aspect: activeCamera.aspect }
        : {
            type: 'orthographic' as const,
            left: (activeCamera as THREE.OrthographicCamera).left,
            right: (activeCamera as THREE.OrthographicCamera).right,
            top: (activeCamera as THREE.OrthographicCamera).top,
            bottom: (activeCamera as THREE.OrthographicCamera).bottom
          }

    const originalMaterials = new Map<
      THREE.Mesh,
      THREE.Material | THREE.Material[]
    >()
    const tempMaterials: THREE.MeshNormalMaterial[] = []
    const gridVisible = this.gridHelper.visible

    try {
      this.renderer.setPixelRatio(1)
      this.renderer.setSize(width, height)

      if (activeCamera instanceof THREE.PerspectiveCamera) {
        activeCamera.aspect = width / height
        activeCamera.updateProjectionMatrix()
      } else {
        const orthographicCamera = activeCamera as THREE.OrthographicCamera

        const frustumSize = 10
        const aspect = width / height

        orthographicCamera.left = (-frustumSize * aspect) / 2
        orthographicCamera.right = (frustumSize * aspect) / 2
        orthographicCamera.top = frustumSize / 2
        orthographicCamera.bottom = -frustumSize / 2

        orthographicCamera.updateProjectionMatrix()
      }

      if (
        this.backgroundTexture &&
        this.backgroundMesh &&
        this.currentBackgroundType === 'image'
      ) {
        this.updateBackgroundSize(
          this.backgroundTexture,
          this.backgroundMesh,
          width,
          height
        )
      }

      this.renderer.clear()
      this.renderBackground()
      this.renderer.render(this.scene, activeCamera)
      const sceneData = this.renderer.domElement.toDataURL('image/png')

      this.renderer.setClearColor(0x000000, 0)
      this.renderer.clear()
      this.renderer.render(this.scene, activeCamera)
      const maskData = this.renderer.domElement.toDataURL('image/png')

      this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          originalMaterials.set(child, child.material)

          const tempMaterial = new THREE.MeshNormalMaterial({
            flatShading: false,
            side: THREE.DoubleSide,
            normalScale: new THREE.Vector2(1, 1)
          })
          tempMaterials.push(tempMaterial)
          child.material = tempMaterial
        }
      })

      this.gridHelper.visible = false

      this.renderer.setClearColor(0x000000, 1)
      this.renderer.clear()
      this.renderer.render(this.scene, activeCamera)
      const normalData = this.renderer.domElement.toDataURL('image/png')

      this.renderer.setClearColor(0xffffff, 1)
      this.renderer.clear()

      return { scene: sceneData, mask: maskData, normal: normalData }
    } finally {
      this.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const originalMaterial = originalMaterials.get(child)
          if (originalMaterial) {
            child.material = originalMaterial
          }
        }
      })
      for (const mat of tempMaterials) {
        mat.dispose()
      }
      this.gridHelper.visible = gridVisible
      if (savedCameraParams.type === 'perspective') {
        const persp = activeCamera as THREE.PerspectiveCamera
        persp.aspect = savedCameraParams.aspect
        persp.updateProjectionMatrix()
      } else {
        const ortho = activeCamera as THREE.OrthographicCamera
        ortho.left = savedCameraParams.left
        ortho.right = savedCameraParams.right
        ortho.top = savedCameraParams.top
        ortho.bottom = savedCameraParams.bottom
        ortho.updateProjectionMatrix()
      }
      this.renderer.setClearColor(originalClearColor, originalClearAlpha)
      this.renderer.setPixelRatio(originalPixelRatio)
      this.renderer.setSize(originalSize.x, originalSize.y)
      this.renderer.outputColorSpace = originalOutputColorSpace
      this.handleResize(originalSize.x, originalSize.y)
    }
  }

  reset(): void {}
}

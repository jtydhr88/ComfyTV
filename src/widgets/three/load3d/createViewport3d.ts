import * as THREE from 'three'

import { CameraManager } from './CameraManager'
import { ControlsManager } from './ControlsManager'
import { EventManager } from './EventManager'
import { LightingManager } from './LightingManager'
import { SceneManager } from './SceneManager'
import { ViewHelperManager } from './ViewHelperManager'
import type { Viewport3dDeps } from './Viewport3d'

function createRenderer(container: Element | HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setSize(300, 300)
  renderer.setClearColor(0x282828)
  renderer.autoClear = false
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderer.domElement
  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.outline = 'none'
  container.appendChild(canvas)
  return renderer
}

export function buildViewport3dDeps(
  container: Element | HTMLElement
): Viewport3dDeps {
  const renderer = createRenderer(container)
  const eventManager = new EventManager()

  let cameraManager: CameraManager
  let controlsManager: ControlsManager

  const getActiveCamera = (): THREE.Camera => cameraManager.activeCamera
  const getControls = () => controlsManager.controls

  const sceneManager = new SceneManager(
    renderer,
    getActiveCamera,
    getControls,
    eventManager
  )

  cameraManager = new CameraManager(renderer, eventManager)
  controlsManager = new ControlsManager(
    renderer,
    cameraManager.activeCamera,
    eventManager
  )
  cameraManager.setControls(controlsManager.controls)

  const lightingManager = new LightingManager(sceneManager.scene, eventManager)
  const viewHelperManager = new ViewHelperManager(
    renderer,
    getActiveCamera,
    getControls,
    eventManager
  )

  return {
    renderer,
    eventManager,
    sceneManager,
    cameraManager,
    controlsManager,
    lightingManager,
    viewHelperManager
  }
}

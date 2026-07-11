import * as THREE from 'three'

import type { Scene3dViewport } from '../Scene3dViewport'

export interface CaptureContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.Camera
}

export async function withCaptureEnvironment<T>(
  viewport: Scene3dViewport,
  width: number,
  height: number,
  fn: (ctx: CaptureContext) => Promise<T> | T
): Promise<T> {
  const renderer = viewport.renderer
  const sceneManager = viewport.sceneManager

  const previousCameraType = viewport.getCurrentCameraType()
  const previousControlsEnabled = viewport.controlsManager.controls.enabled

  let previousAspect: number | null = null
  let camera: THREE.Camera | null = null
  try {
    viewport.capturing = true
    if (previousCameraType !== 'perspective') {
      viewport.toggleCamera('perspective')
    }
    camera = viewport.getCaptureCamera()
    previousAspect =
      camera instanceof THREE.PerspectiveCamera ? camera.aspect : null

    viewport.setEditorHelpersVisible(false)
    viewport.gizmoManager.detach()
    viewport.controlsManager.controls.enabled = false

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    return await fn({ renderer, scene: sceneManager.scene, camera })
  } finally {
    viewport.controlsManager.controls.enabled = previousControlsEnabled
    viewport.setEditorHelpersVisible(true)
    viewport.refreshGizmo()
    if (
      camera instanceof THREE.PerspectiveCamera &&
      previousAspect !== null
    ) {
      camera.aspect = previousAspect
      camera.updateProjectionMatrix()
    }
    if (viewport.getCurrentCameraType() !== previousCameraType) {
      viewport.toggleCamera(previousCameraType)
    }
    viewport.capturing = false
    viewport.handleResize()
  }
}

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

  const restoreAspects: Array<{
    camera: THREE.PerspectiveCamera
    aspect: number
  }> = []
  const applyAspect = (target: THREE.Camera): void => {
    if (!(target instanceof THREE.PerspectiveCamera)) return
    if (restoreAspects.some((entry) => entry.camera === target)) return
    restoreAspects.push({ camera: target, aspect: target.aspect })
    target.aspect = width / height
    target.updateProjectionMatrix()
  }
  let camera: THREE.Camera | null = null
  try {
    viewport.capturing = true
    if (previousCameraType !== 'perspective') {
      viewport.toggleCamera('perspective')
    }
    camera = viewport.getCaptureCamera()

    viewport.setEditorHelpersVisible(false)
    viewport.suspendPathEditor()
    viewport.gizmoManager.detach()
    viewport.controlsManager.controls.enabled = false

    applyAspect(camera)
    if (viewport.hasShots()) {
      for (const shotCamera of viewport.sceneCameraManager.allCameras()) {
        applyAspect(shotCamera)
      }
    }
    return await fn({ renderer, scene: sceneManager.scene, camera })
  } finally {
    viewport.controlsManager.controls.enabled = previousControlsEnabled
    viewport.setEditorHelpersVisible(true)
    viewport.resumePathEditor()
    viewport.refreshGizmo()
    for (const entry of restoreAspects) {
      entry.camera.aspect = entry.aspect
      entry.camera.updateProjectionMatrix()
    }
    if (viewport.getCurrentCameraType() !== previousCameraType) {
      viewport.toggleCamera(previousCameraType)
    }
    viewport.capturing = false
    viewport.handleResize()
  }
}

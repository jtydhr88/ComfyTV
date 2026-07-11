import { GizmoManager } from '@/widgets/three/load3d/GizmoManager'
import { TimelineController } from '@/widgets/three/load3d/TimelineController'
import { fetchCameraPresetData } from '@/widgets/three/load3d/cameraPresetAssets'
import { buildViewport3dDeps } from '@/widgets/three/load3d/createViewport3d'
import type { Load3DOptions } from '@/widgets/three/load3d/interfaces'

import { Scene3dCharacterManager } from './CharacterManager'
import { Scene3dCustomModelManager } from './CustomModelManager'
import { Scene3dLightManager } from './LightManager'
import { Scene3dPrimitiveManager } from './PrimitiveManager'
import { SceneCameraManager } from './SceneCameraManager'
import { Scene3dViewport, type Scene3dViewportEvents } from './Scene3dViewport'

export function createScene3dViewport(
  container: HTMLElement,
  events: Scene3dViewportEvents,
  options?: Load3DOptions
): Scene3dViewport {
  const deps = buildViewport3dDeps(container)
  const timelineController = new TimelineController(deps.eventManager)
  const characterManager = new Scene3dCharacterManager(deps.sceneManager.scene)
  const primitiveManager = new Scene3dPrimitiveManager(deps.sceneManager.scene)
  const customModelManager = new Scene3dCustomModelManager(
    deps.sceneManager.scene
  )
  const lightManager = new Scene3dLightManager(deps.sceneManager.scene)

  let viewport: Scene3dViewport | null = null
  const sceneCameraManager = new SceneCameraManager(
    deps.sceneManager.scene,
    fetchCameraPresetData,
    () => viewport?.handleCameraPresetLoaded()
  )
  const gizmoManager = new GizmoManager(
    deps.sceneManager.scene,
    deps.view.canvas,
    deps.controlsManager.controls,
    () => deps.cameraManager.activeCamera,
    () => viewport?.commitGizmoTransform(),
    (clientX, clientY) => viewport?.clientPointToNdc(clientX, clientY) ?? null
  )

  viewport = new Scene3dViewport(
    container,
    {
      ...deps,
      timelineController,
      sceneCameraManager,
      characterManager,
      primitiveManager,
      customModelManager,
      lightManager,
      gizmoManager
    },
    events,
    options
  )
  return viewport
}

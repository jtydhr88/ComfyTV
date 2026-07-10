import * as THREE from 'three'

import type { Scene3dViewport } from '../Scene3dViewport'
import { ChannelRenderer, type SceneChannel } from './channelRender'
import { withCaptureEnvironment } from './captureEnvironment'

export interface CaptureImageOptions {
  width: number
  height: number
  channel: SceneChannel
}

export interface CameraShot {
  cameraId: string | null
  blob: Blob
}

export async function captureSceneImages(
  viewport: Scene3dViewport,
  opts: CaptureImageOptions,
  targets: ReadonlyArray<string | null>
): Promise<CameraShot[]> {
  return withCaptureEnvironment(viewport, opts.width, opts.height, async () => {
    const channelRenderer = new ChannelRenderer(viewport)
    const canvas = document.createElement('canvas')
    canvas.width = opts.width
    canvas.height = opts.height
    const shots: CameraShot[] = []
    try {
      viewport.applyCaptureTime(viewport.timelineController.getCurrentTime())
      for (const cameraId of targets.length > 0 ? targets : [null]) {
        viewport.setCaptureCameraOverride(cameraId)
        const camera = viewport.getCaptureCamera()
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = opts.width / opts.height
          camera.updateProjectionMatrix()
        }
        channelRenderer.render(opts.channel, canvas)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        )
        if (!blob) throw new Error('canvas.toBlob returned null')
        shots.push({ cameraId, blob })
      }
      return shots
    } finally {
      viewport.setCaptureCameraOverride(null)
      channelRenderer.dispose()
    }
  })
}

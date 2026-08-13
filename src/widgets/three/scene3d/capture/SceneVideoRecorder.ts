import type { Scene3dViewport } from '../Scene3dViewport'
import { ChannelRenderer, type SceneChannel } from './channelRender'
import { withCaptureEnvironment } from './captureEnvironment'
import {
  encodeWebmVideo,
  isWebmEncodingSupported,
  type WebmEncodeProgress
} from '../../webmEncoder'


export type RecordProgress = WebmEncodeProgress

export interface RecordOptions {
  width: number
  height: number
  channel: SceneChannel
  fps: number
  frameCount: number
  onProgress?: (progress: RecordProgress) => void
}

export function isVideoRecordingSupported(): boolean {
  return isWebmEncodingSupported()
}

export class SceneVideoRecorder {
  constructor(private readonly viewport: Scene3dViewport) {}

  async record(opts: RecordOptions): Promise<Blob> {
    const { width, height, channel, fps, frameCount, onProgress } = opts

    const timeline = this.viewport.timelineController
    const wasPlaying = timeline.isPlayingNow()
    const previousTime = timeline.getCurrentTime()
    if (wasPlaying) timeline.pause()

    return withCaptureEnvironment(this.viewport, width, height, async () => {
      const channelRenderer = new ChannelRenderer(this.viewport)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      try {
        return await encodeWebmVideo({
          width,
          height,
          fps,
          frameCount,
          renderFrame: (i) => {
            this.viewport.applyCaptureTime(i / fps)
            channelRenderer.render(channel, canvas)
            return canvas
          },
          onProgress
        })
      } finally {
        channelRenderer.dispose()
        timeline.seekToTime(previousTime)
        if (wasPlaying) timeline.play()
      }
    })
  }
}

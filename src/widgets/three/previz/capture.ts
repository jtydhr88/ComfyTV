import {
  encodeWebmVideo,
  isWebmEncodingSupported,
  type WebmEncodeProgress
} from '../webmEncoder'
import type { PrevizViewport } from './PrevizViewport'

export const PREVIZ_RECORD_FPS = 30

export function isPrevizRecordingSupported(): boolean {
  return isWebmEncodingSupported()
}

export type PrevizRecordProgress = WebmEncodeProgress

export interface PrevizRecordOptions {
  width: number
  height: number
  duration: number
  applyTime: (globalSeconds: number) => void
  onProgress?: (progress: PrevizRecordProgress) => void
}

export async function capturePrevizFrame(
  viewport: PrevizViewport,
  width: number,
  height: number
): Promise<Blob> {
  const canvas = viewport.renderShotFrame(width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas.toBlob returned null')
  return blob
}

export async function recordPrevizVideo(
  viewport: PrevizViewport,
  opts: PrevizRecordOptions
): Promise<Blob> {
  const { width, height, duration, applyTime, onProgress } = opts
  const fps = PREVIZ_RECORD_FPS
  return encodeWebmVideo({
    width,
    height,
    fps,
    frameCount: Math.max(1, Math.round(duration * fps)),
    renderFrame: (i) => {
      applyTime(i / fps)
      return viewport.renderShotFrame(width, height)
    },
    onProgress
  })
}

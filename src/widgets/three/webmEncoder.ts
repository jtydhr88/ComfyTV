import { ArrayBufferTarget, Muxer } from 'webm-muxer'

const DEFAULT_BITRATE = 4_000_000

export interface WebmEncodeProgress {
  status: 'started' | 'rendering' | 'finalizing'
  totalFrames: number
  fps: number
  frame?: number
}

export interface WebmEncodeOptions {
  width: number
  height: number
  fps: number
  frameCount: number
  bitrate?: number
  renderFrame: (frameIndex: number) => HTMLCanvasElement
  onProgress?: (progress: WebmEncodeProgress) => void
}

export function isWebmEncodingSupported(): boolean {
  return typeof VideoEncoder !== 'undefined'
}

export async function encodeWebmVideo(opts: WebmEncodeOptions): Promise<Blob> {
  if (!isWebmEncodingSupported()) {
    throw new Error('WebCodecs VideoEncoder not supported in this browser')
  }
  const { width, height, fps, frameCount, renderFrame, onProgress } = opts
  if (frameCount <= 0) throw new Error('No frames to record')
  const bitrate = opts.bitrate ?? DEFAULT_BITRATE

  const vp9Config: VideoEncoderConfig = {
    codec: 'vp09.00.10.08',
    width,
    height,
    bitrate,
    framerate: fps
  }
  let encoderCodec = vp9Config.codec
  let muxerCodec: 'V_VP9' | 'V_VP8' = 'V_VP9'
  const vp9 = await VideoEncoder.isConfigSupported(vp9Config)
  if (!vp9.supported) {
    const vp8 = await VideoEncoder.isConfigSupported({ ...vp9Config, codec: 'vp8' })
    if (!vp8.supported) {
      throw new Error('Neither VP9 nor VP8 supported by VideoEncoder')
    }
    encoderCodec = 'vp8'
    muxerCodec = 'V_VP8'
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: muxerCodec, width, height, frameRate: fps }
  })
  let encoderError: unknown = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e
    }
  })
  encoder.configure({ codec: encoderCodec, width, height, bitrate, framerate: fps })

  const keyframeInterval = Math.max(1, Math.round(fps))
  try {
    onProgress?.({ status: 'started', totalFrames: frameCount, fps })
    for (let i = 0; i < frameCount; i++) {
      if (encoderError) throw encoderError
      const canvas = renderFrame(i)
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round((i * 1_000_000) / fps)
      })
      encoder.encode(frame, { keyFrame: i % keyframeInterval === 0 })
      frame.close()
      if (encoder.encodeQueueSize > 8) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
      onProgress?.({ status: 'rendering', frame: i, totalFrames: frameCount, fps })
    }
    onProgress?.({ status: 'finalizing', totalFrames: frameCount, fps })
    await encoder.flush()
    if (encoderError) throw encoderError
    muxer.finalize()
    const buffer = (muxer.target as ArrayBufferTarget).buffer
    return new Blob([buffer], { type: 'video/webm' })
  } finally {
    try {
      if (encoder.state !== 'closed') encoder.close()
    } catch {
    }
  }
}

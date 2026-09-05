import type { MediaInfo } from '@/api/schemas'
import { formatBytes, formatClock } from '@/utils/mediaFormat'

type Tr = (key: string, args?: Record<string, unknown>) => string

function dims(info: MediaInfo): string | null {
  return info.width && info.height ? `${info.width}×${info.height}` : null
}

function fps(info: MediaInfo, t: Tr): string | null {
  if (!info.fps) return null
  const n = Math.round(info.fps * 100) / 100
  return t('v2.meta.fps', { n })
}

function clock(info: MediaInfo): string | null {
  return info.duration_s && info.duration_s > 0 ? formatClock(info.duration_s) : null
}

function channels(info: MediaInfo, t: Tr): string | null {
  if (!info.channels) return null
  if (info.channels === 1) return t('v2.meta.mono')
  if (info.channels === 2) return t('v2.meta.stereo')
  return t('v2.meta.channels', { n: info.channels })
}

function sampleRate(info: MediaInfo): string | null {
  if (!info.sample_rate) return null
  const khz = info.sample_rate / 1000
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`
}

export function metaTokens(info: MediaInfo | null, t: Tr): string[] {
  if (!info) return []
  const size = info.size_bytes > 0 ? formatBytes(info.size_bytes) : null
  let parts: Array<string | null>
  switch (info.kind) {
    case 'image':
      parts = [dims(info), info.frames && info.frames > 1 ? t('v2.meta.frames', { n: info.frames }) : null, size]
      break
    case 'video':
      parts = [dims(info), fps(info, t), clock(info), info.has_audio === false ? t('v2.meta.silent') : null, size]
      break
    case 'audio':
      parts = [sampleRate(info), channels(info, t), clock(info), size]
      break
    default:
      parts = [size]
  }
  return parts.filter((p): p is string => !!p)
}

export function fileNameFromUrl(url: string): string {
  const m = /[?&]filename=([^&#]+)/.exec(url)
  if (m) {
    try { return decodeURIComponent(m[1]) } catch { return m[1] }
  }
  return url.split('?')[0].split('/').pop() ?? ''
}

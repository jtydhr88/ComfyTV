import { describe, expect, it } from 'vitest'

import type { MediaInfo } from '@/api/schemas'
import { formatBytes, formatClock, formatDuration } from '@/utils/mediaFormat'

import { fileNameFromUrl, metaTokens } from './mediaMeta'

const t = (key: string, args?: Record<string, unknown>) =>
  `${key.split('.').pop()}${args?.n != null ? `:${args.n}` : ''}`

describe('mediaFormat', () => {
  it('formatBytes scales units', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(3.5 * 1024 ** 2)).toBe('3.5 MB')
  })

  it('formatClock uses seconds under a minute, mm:ss above', () => {
    expect(formatClock(5.04)).toBe('5.0 s')
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })

  it('formatDuration keeps the bot convention', () => {
    expect(formatDuration(80)).toBe('80ms')
    expect(formatDuration(65_000)).toBe('1m 5s')
  })
})

describe('metaTokens', () => {
  it('image: dimensions and size', () => {
    const info: MediaInfo = { kind: 'image', format: 'PNG', size_bytes: 2048, width: 1024, height: 1536 }
    expect(metaTokens(info, t)).toEqual(['1024×1536', '2.0 KB'])
  })

  it('animated image adds frame count', () => {
    const info: MediaInfo = { kind: 'image', format: 'GIF', size_bytes: 10, width: 8, height: 8, frames: 12 }
    expect(metaTokens(info, t)).toEqual(['8×8', 'frames:12', '10 B'])
  })

  it('video: dimensions, fps, clock, silent flag, size', () => {
    const info: MediaInfo = {
      kind: 'video', format: 'MP4', size_bytes: 1024 ** 2,
      width: 1920, height: 1080, fps: 23.976, duration_s: 5, has_audio: false,
    }
    expect(metaTokens(info, t)).toEqual(['1920×1080', 'fps:23.98', '5.0 s', 'silent', '1.0 MB'])
  })

  it('audio: sample rate, channels, clock, size', () => {
    const info: MediaInfo = { kind: 'audio', format: 'WAV', size_bytes: 1024, sample_rate: 44100, channels: 2, duration_s: 12 }
    expect(metaTokens(info, t)).toEqual(['44.1 kHz', 'stereo', '12.0 s', '1.0 KB'])
    expect(metaTokens({ ...info, sample_rate: 48000, channels: 6 }, t)[1]).toBe('channels:6')
  })

  it('model: size only; null: nothing', () => {
    expect(metaTokens({ kind: 'model', format: 'GLB', size_bytes: 4096 }, t)).toEqual(['4.0 KB'])
    expect(metaTokens(null, t)).toEqual([])
  })
})

describe('fileNameFromUrl', () => {
  it('reads the view filename param, falling back to the path tail', () => {
    expect(fileNameFromUrl('/view?filename=a%20b.png&type=output')).toBe('a b.png')
    expect(fileNameFromUrl('https://x/y/clip.mp4?x=1')).toBe('clip.mp4')
  })
})

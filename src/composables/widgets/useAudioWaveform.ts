import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { waveformPeaks } from '@/utils/audioViz'

export async function decodeSamples(url: string): Promise<Float32Array | null> {
  try {
    const buf = await (await fetch(url)).arrayBuffer()
    const ac = new AudioContext()
    try {
      const audio = await ac.decodeAudioData(buf)
      const channels = audio.numberOfChannels
      const first = audio.getChannelData(0)
      if (channels === 1) return first.slice()
      const mono = new Float32Array(first.length)
      for (let c = 0; c < channels; c++) {
        const data = audio.getChannelData(c)
        for (let i = 0; i < data.length; i++) mono[i] += data[i] / channels
      }
      return mono
    } finally {
      void ac.close()
    }
  } catch {
    return null
  }
}

export function drawWaveform(
  ctx: CanvasRenderingContext2D, peaks: Float32Array,
  width: number, height: number, color: string,
): void {
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = color
  const mid = height / 2
  const cols = peaks.length / 2
  for (let x = 0; x < cols; x++) {
    const mn = peaks[x * 2]
    const mx = peaks[x * 2 + 1]
    const top = mid - mx * mid
    ctx.fillRect(x, top, 1, Math.max(1, (mx - mn) * mid))
  }
}

export interface UseAudioWaveformOptions {
  url: Ref<string | null | undefined>
  enabled: Ref<boolean>
  canvas: Ref<HTMLCanvasElement | null>
}

export function useAudioWaveform(opts: UseAudioWaveformOptions) {
  const ready = ref(false)
  let samples: Float32Array | null = null
  let token = 0
  let observer: ResizeObserver | null = null

  function render(): void {
    const el = opts.canvas.value
    if (!el || !samples) return
    const box = el.parentElement
    const width = Math.max(1, Math.floor(box?.clientWidth ?? el.clientWidth))
    const height = Math.max(1, Math.floor(box?.clientHeight ?? el.clientHeight))
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    el.width = width * dpr
    el.height = height * dpr
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const color = getComputedStyle(el).color || '#7aa2ff'
    drawWaveform(ctx, waveformPeaks(samples, width), width, height, color)
  }

  async function reload(): Promise<void> {
    const my = ++token
    ready.value = false
    samples = null
    const url = opts.url.value
    if (!opts.enabled.value || !url) return
    const decoded = await decodeSamples(url)
    if (my !== token) return
    samples = decoded
    if (decoded) {
      ready.value = true
      render()
    }
  }

  function observe(el: HTMLCanvasElement | null): void {
    observer?.disconnect()
    observer = null
    const box = el?.parentElement
    if (!box || typeof ResizeObserver === 'undefined') return
    observer = new ResizeObserver(() => render())
    observer.observe(box)
  }

  watch([opts.url, opts.enabled], () => void reload())
  watch(opts.canvas, (el) => {
    observe(el)
    render()
  })

  onBeforeUnmount(() => {
    token++
    observer?.disconnect()
    observer = null
  })

  return { ready, reload, render }
}

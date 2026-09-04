export type PressureLevel = 0 | 1 | 2

export const IDLE_TRIM_MS = 30_000
export const IDLE_SLEEP_MS = 5 * 60_000

const SCALE: Record<PressureLevel, number> = { 0: 1, 1: 0.5, 2: 0.25 }
const DEFAULT_MODERATE = 1.5 * 1024 ** 3
const DEFAULT_CRITICAL = 2.5 * 1024 ** 3

let level: PressureLevel = 0
let lastActivity = now()
let stopSampler: (() => void) | null = null

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export function noteActivity(): void {
  lastActivity = now()
}

export function idleMs(): number {
  return now() - lastActivity
}

export function pressureLevel(): PressureLevel {
  return level
}

export function pressureScale(): number {
  return SCALE[level]
}

export function __setPressureForTests(next: PressureLevel, idle?: number): void {
  level = next
  if (idle != null) lastActivity = now() - idle
}

type MeasureFn = () => Promise<{ bytes: number }>

export async function sampleRendererBytes(): Promise<number | null> {
  const perf = globalThis.performance as { measureUserAgentSpecificMemory?: MeasureFn } | undefined
  if (!perf?.measureUserAgentSpecificMemory || !(globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated) return null
  try {
    return (await perf.measureUserAgentSpecificMemory()).bytes
  } catch {
    return null
  }
}

export interface PressureSamplerOptions {
  sample?: () => Promise<number | null>
  intervalMs?: number
  moderateBytes?: number
  criticalBytes?: number
  onChange?: (level: PressureLevel, bytes: number) => void
}

export function startPressureSampler(opts: PressureSamplerOptions = {}): () => void {
  if (stopSampler) return stopSampler
  const sample = opts.sample ?? sampleRendererBytes
  const moderate = opts.moderateBytes ?? DEFAULT_MODERATE
  const critical = opts.criticalBytes ?? DEFAULT_CRITICAL
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  const tick = async (): Promise<void> => {
    const bytes = await sample()
    if (stopped) return
    if (bytes != null) {
      const next: PressureLevel = bytes >= critical ? 2 : bytes >= moderate ? 1 : 0
      if (next !== level) {
        level = next
        opts.onChange?.(next, bytes)
      }
    }
    timer = setTimeout(() => void tick(), opts.intervalMs ?? 10_000)
  }
  timer = setTimeout(() => void tick(), 0)
  stopSampler = () => {
    stopped = true
    if (timer != null) clearTimeout(timer)
    stopSampler = null
    level = 0
  }
  return stopSampler
}

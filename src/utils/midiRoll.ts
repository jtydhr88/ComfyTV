import type { MidiNote } from '@/api/schemas'

export const PX_PER_SEC = 80
export const KEY_WIDTH = 56
export const PITCH_MIN = 21
export const PITCH_MAX = 108
export const DEFAULT_PITCH_TOP = 84
export const DEFAULT_PITCH_RANGE = DEFAULT_PITCH_TOP - PITCH_MIN + 1

const NOTE_GAP_PX = 1.5
const GOLDEN_ANGLE = 137.508

const colorIndex = new Map<string, number>()

export function rollColor(key: string): string {
  let idx = colorIndex.get(key)
  if (idx === undefined) {
    idx = colorIndex.size
    colorIndex.set(key, idx)
  }
  const hue = (idx * GOLDEN_ANGLE) % 360
  return `hsl(${hue}, 70%, 55%)`
}

export function isBlackKey(pitch: number): boolean {
  const n = ((pitch % 12) + 12) % 12
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10
}

export interface RollNote {
  start: number
  end: number
  pitch: number
  color: string
}

export function buildRollNotes(
  events: MidiNote[],
  programs: Record<string, number> = {},
): RollNote[] {
  return events.map((e) => ({
    start: e.t,
    end: e.t + e.dur,
    pitch: e.midi,
    color: rollColor(e.ch === 9 ? 'drums' : `p${programs[String(e.ch)] ?? 0}`),
  }))
}

export function maxEnd(notes: RollNote[]): number {
  let m = 0
  for (const n of notes) if (n.end > m) m = n.end
  return m
}

export function followOffset(
  lastOffset: number,
  playhead: number,
  contentEnd: number,
  viewSec: number,
): number {
  const maxT = Math.max(contentEnd, playhead + 1)
  let offsetSec = lastOffset
  if (playhead > offsetSec + viewSec * 0.66) {
    offsetSec = playhead - viewSec * 0.66
  } else if (playhead < offsetSec) {
    offsetSec = playhead
  }
  return Math.max(0, Math.min(offsetSec, Math.max(0, maxT - viewSec)))
}

const PALETTE = {
  stripe: 'rgba(255, 255, 255, 0.07)',
  grid: 'rgba(255, 255, 255, 0.09)',
  playhead: 'rgba(255, 255, 255, 0.85)',
  keyBlack: '#161616',
  keyWhite: '#d8d8d8',
}

export function drawRoll(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  notes: RollNote[],
  offsetSec: number,
  playhead: number,
  pxPerSec: number = PX_PER_SEC,
): void {
  ctx.clearRect(0, 0, W, H)
  const contentW = W - KEY_WIDTH
  const viewSec = contentW / pxPerSec
  const rowH = H / DEFAULT_PITCH_RANGE
  const pitchTop = DEFAULT_PITCH_TOP

  ctx.save()
  ctx.beginPath()
  ctx.rect(KEY_WIDTH, 0, contentW, H)
  ctx.clip()

  ctx.fillStyle = PALETTE.stripe
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    if (p % 12 === 0) {
      const y = (pitchTop - p) * rowH
      ctx.fillRect(KEY_WIDTH, y, contentW, rowH)
    }
  }

  ctx.strokeStyle = PALETTE.grid
  ctx.lineWidth = 1
  const startSec = Math.floor(offsetSec)
  const endSec = Math.ceil(offsetSec + viewSec)
  for (let s = startSec; s <= endSec; s++) {
    const x = KEY_WIDTH + (s - offsetSec) * pxPerSec
    ctx.beginPath()
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, H)
    ctx.stroke()
  }

  const rowGap = Math.max(0.5, Math.min(4, rowH * 0.1))
  for (const n of notes) {
    if (n.pitch < PITCH_MIN || n.pitch > PITCH_MAX) continue
    const x = KEY_WIDTH + (n.start - offsetSec) * pxPerSec
    const w = Math.max(2, (n.end - n.start) * pxPerSec - NOTE_GAP_PX)
    if (x + w < KEY_WIDTH || x > W) continue
    const y = (pitchTop - n.pitch) * rowH
    if (y + rowH < 0 || y > H) continue
    ctx.fillStyle = n.color
    ctx.fillRect(x, y, w, Math.max(2, rowH - rowGap))
  }

  const px = KEY_WIDTH + (playhead - offsetSec) * pxPerSec
  ctx.strokeStyle = PALETTE.playhead
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(px, 0)
  ctx.lineTo(px, H)
  ctx.stroke()

  ctx.restore()

  const showLabels = rowH >= 8
  if (showLabels) {
    ctx.font = '10px sans-serif'
    ctx.textBaseline = 'middle'
  }
  for (let p = PITCH_MIN; p <= PITCH_MAX; p++) {
    const y = (pitchTop - p) * rowH
    if (y + rowH < 0 || y > H) continue
    ctx.fillStyle = isBlackKey(p) ? PALETTE.keyBlack : PALETTE.keyWhite
    ctx.fillRect(0, y, KEY_WIDTH, rowH)
    ctx.strokeStyle = PALETTE.stripe
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(KEY_WIDTH, y + 0.5)
    ctx.stroke()
    if (showLabels && p % 12 === 0) {
      ctx.fillStyle = PALETTE.stripe
      ctx.fillText(`C${p / 12 - 1}`, 4, y + rowH / 2)
    }
  }
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(KEY_WIDTH + 0.5, 0)
  ctx.lineTo(KEY_WIDTH + 0.5, H)
  ctx.stroke()
}

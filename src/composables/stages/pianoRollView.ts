import { GM_DRUMS } from '@/constants/gmPrograms'

const BLACK = new Set([1, 3, 6, 8, 10])

export interface PianoKey {
  midi: number
  y: number
  black: boolean
  label: string
}

export function buildPianoKeys(noteHeight: number, perc: boolean): PianoKey[] {
  const out: PianoKey[] = []
  for (let midi = 127; midi >= 0; midi--) {
    const semi = midi % 12
    out.push({
      midi,
      y: (127 - midi) * noteHeight,
      black: perc ? !(midi in GM_DRUMS) : BLACK.has(semi),
      label: perc
        ? (GM_DRUMS[midi] ?? '')
        : (semi === 0 ? `C${Math.floor(midi / 12) - 1}` : ''),
    })
  }
  return out
}

export function blackRowsGradient(noteHeight: number): string {
  const dark = [1, 4, 6, 9, 11]
  const stops: string[] = []
  let pos = 0
  for (let r = 0; r < 12; r++) {
    const end = (r + 1) * noteHeight
    const color = dark.includes(r) ? 'rgba(0,0,0,0.28)' : 'transparent'
    stops.push(`${color} ${pos}px ${end}px`)
    pos = end
  }
  return `repeating-linear-gradient(to bottom, ${stops.join(', ')})`
}

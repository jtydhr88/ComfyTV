import { computed, type Ref } from 'vue'

export interface Cue {
  start: number
  end: number
  text: string
}

const TIME_RE = /(\d+):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[,.](\d{1,3})/

function srtTimeToSec(h: string, m: string, s: string, ms: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000
}

export function secToSrtTime(sec: number): string {
  const total = Math.max(0, Math.round(sec * 1000))
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(Math.floor(total / 3600000))}:${pad(Math.floor(total / 60000) % 60)}:${pad(Math.floor(total / 1000) % 60)},${pad(total % 1000, 3)}`
}

export function parseSrt(raw: string): Cue[] {
  const cues: Cue[] = []
  let current: Cue | null = null
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(TIME_RE)
    if (m) {
      current = {
        start: srtTimeToSec(m[1], m[2], m[3], m[4]),
        end: srtTimeToSec(m[5], m[6], m[7], m[8]),
        text: '',
      }
      cues.push(current)
    } else if (current) {
      const t = line.trim()
      if (!t) current = null
      else current.text = current.text ? `${current.text}\n${t}` : t
    }
  }
  return cues
}

export function serializeSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${secToSrtTime(c.start)} --> ${secToSrtTime(c.end)}\n${c.text}`)
    .join('\n\n')
}

export function useSubtitleCues(subs: Ref<string>) {
  const cues = computed(() => parseSrt(subs.value))

  function writeCues(next: Cue[]): void {
    subs.value = next.length ? serializeSrt(next) : ''
  }

  function updateCue(i: number, patch: Partial<Cue>): void {
    writeCues(cues.value.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  }

  function removeCue(i: number): void {
    const next = cues.value.slice()
    next.splice(i, 1)
    writeCues(next)
  }

  function addCue(): void {
    const last = cues.value[cues.value.length - 1]
    const start = last ? last.end : 0
    writeCues([...cues.value, { start, end: start + 2, text: '' }])
  }

  function onCueNum(i: number, key: 'start' | 'end', e: Event): void {
    const v = Number((e.target as HTMLInputElement).value)
    if (Number.isFinite(v)) updateCue(i, { [key]: Math.max(0, v) })
  }

  function onCueText(i: number, e: Event): void {
    updateCue(i, { text: (e.target as HTMLInputElement).value })
  }

  return { cues, addCue, removeCue, updateCue, onCueNum, onCueText }
}

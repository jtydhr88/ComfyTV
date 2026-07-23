export interface TempoMark {
  beat: number
  t: number
  bpm: number
}

export function beatAtTime(tempoMap: TempoMark[], t: number): number {
  if (!tempoMap.length) return t * 2
  let seg = tempoMap[0]
  for (const m of tempoMap) {
    if (m.t <= t + 1e-9) seg = m
    else break
  }
  return seg.beat + Math.max(0, t - seg.t) * seg.bpm / 60
}

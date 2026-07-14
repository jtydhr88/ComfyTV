export const MAX_MARKS = 48

export function normalizeMarks(list: number[]): number[] {
  const uniq = [...new Set(list
    .filter(n => Number.isFinite(n) && n >= 0)
    .map(n => Math.round(n * 100) / 100))]
  return uniq.sort((a, b) => a - b).slice(0, MAX_MARKS)
}

export function parseMarks(raw: string): number[] {
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return normalizeMarks(v.map(Number))
  } catch {
    return []
  }
}

export function uniformMarks(n: number, duration: number): number[] {
  if (duration <= 0 || n < 1) return []
  return normalizeMarks(
    Array.from({ length: n }, (_, i) => ((i + 0.5) / n) * duration))
}

export function parseOrder(raw: string, connectedCount: number): number[] {
  try {
    const v = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    const out: number[] = []
    for (const item of v) {
      const n = Number(item)
      if (!Number.isInteger(n) || n < 1 || n > connectedCount) continue
      if (!out.includes(n)) out.push(n)
    }
    return out
  } catch {
    return []
  }
}

export function normalizeOrder(order: number[], connectedCount: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const n of order) {
    if (!Number.isInteger(n) || n < 1 || n > connectedCount || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  for (let n = 1; n <= connectedCount; n++) {
    if (!seen.has(n)) out.push(n)
  }
  return out
}

export function isNaturalOrder(order: number[]): boolean {
  return order.every((n, i) => n === i + 1)
}

function swap(order: number[], a: number, b: number): number[] {
  if (a < 0 || b < 0 || a >= order.length || b >= order.length) return [...order]
  const next = [...order]
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

export function moveUp(order: number[], index: number): number[] {
  return swap(order, index, index - 1)
}

export function moveDown(order: number[], index: number): number[] {
  return swap(order, index, index + 1)
}

export function serializeOrder(order: number[]): string {
  return isNaturalOrder(order) ? '' : JSON.stringify(order)
}

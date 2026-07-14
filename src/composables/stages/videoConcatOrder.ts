export function parseOrder(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}

export function reconcileOrder(saved: string[], currentKeys: string[]): string[] {
  const kept = saved.filter(k => currentKeys.includes(k))
  return [...kept, ...currentKeys.filter(k => !kept.includes(k))]
}

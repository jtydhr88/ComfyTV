/** Copy JSON without stringify's silent NaN/null and undefined/toJSON coercions.
 * Graphs can be reactive proxies, so structuredClone is not sufficient here.
 * Optional request-envelope fields are handled separately by the REST serializer.
 */
export function copyWorkflowJson<T>(value: T): T {
  const ancestors = new Set<object>()
  function copy(value: unknown, depth: number): unknown {
    if (depth > 64) throw new Error('Mixed context JSON exceeds the depth limit.')
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value !== 'object' || value === null ||
      (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]') ||
      typeof (value as { toJSON?: unknown }).toJSON === 'function')
      throw new Error('Mixed context requires finite JSON values; no graph fields were dropped.')
    if (ancestors.has(value)) throw new Error('Mixed context JSON must not contain cycles.')
    ancestors.add(value)
    try {
      if (Array.isArray(value)) return Array.from(value, (item) => copy(item, depth + 1))
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copy(item, depth + 1)]))
    } finally {
      ancestors.delete(value)
    }
  }
  return copy(value, 0) as T
}

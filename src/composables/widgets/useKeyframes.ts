import { computed, ref, type Ref } from 'vue'

export interface TimedKey {
  t: number
}

export function roundTime(t: number): number {
  return Math.round(t * 100) / 100
}

export function parseKeys<K extends TimedKey>(raw: string): K[] {
  try {
    const p = JSON.parse(raw || '[]')
    return Array.isArray(p) ? p : []
  } catch {
    return []
  }
}

export function serializeKeys<K extends TimedKey>(keys: K[]): string {
  return keys.length
    ? JSON.stringify(keys.slice().sort((a, b) => a.t - b.t))
    : ''
}

export function useKeyframes<K extends TimedKey>(opts: {
  raw: Ref<string>
  snapshot: (t: number) => K
  apply?: (key: K) => void
  update?: (key: K) => K
  followMove?: boolean
}) {
  const { raw, snapshot, apply, update, followMove } = opts

  const keys = computed<K[]>({
    get: () => parseKeys<K>(raw.value),
    set: (v) => {
      raw.value = serializeKeys(v)
    },
  })

  const selected = ref(-1)

  function addAt(t: number): void {
    const k = snapshot(roundTime(t))
    const next = [...keys.value, k].sort((a, b) => a.t - b.t)
    keys.value = next
    selected.value = next.findIndex((x) => x.t === k.t)
  }

  function moveAt(i: number, t: number): void {
    const cur = keys.value
    if (!cur[i]) return
    const moved = { ...cur[i], t: roundTime(t) }
    if (followMove) {
      const next = [...cur.filter((_, idx) => idx !== i), moved].sort(
        (a, b) => a.t - b.t,
      )
      keys.value = next
      selected.value = next.indexOf(moved)
      return
    }
    const next = cur.slice()
    next[i] = moved
    keys.value = next
  }

  function removeAt(i: number): void {
    const next = keys.value.slice()
    if (i < 0 || i >= next.length) return
    next.splice(i, 1)
    keys.value = next
    selected.value = -1
  }

  function select(i: number): void {
    selected.value = i
    const k = keys.value[i]
    if (k && apply) apply(k)
  }

  function updateSelected(): void {
    const i = selected.value
    const cur = keys.value[i]
    if (!cur) return
    const next = keys.value.slice()
    next[i] = update ? update(cur) : { ...snapshot(cur.t) }
    keys.value = next
  }

  return { keys, selected, addAt, moveAt, removeAt, select, updateSelected }
}

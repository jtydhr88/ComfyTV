const REGISTRY = Symbol('v2PropObservers')

interface Entry {
  listeners: Set<() => void>
}

type Registry = Map<string, Entry>

function findDescriptor(obj: object, key: string): PropertyDescriptor | undefined {
  let cur: object | null = obj
  while (cur) {
    const d = Object.getOwnPropertyDescriptor(cur, key)
    if (d) return d
    cur = Object.getPrototypeOf(cur)
  }
  return undefined
}

export function observeProperty(obj: any, key: string, listener: () => void): () => void {
  const registry: Registry = (obj[REGISTRY] ??= new Map())
  let entry = registry.get(key)
  if (!entry) {
    const listeners = new Set<() => void>()
    const notify = () => { for (const fn of [...listeners]) fn() }
    const desc = findDescriptor(obj, key)
    if (desc && desc.configurable === false) {
      throw new Error(`observeProperty: '${key}' is non-configurable`)
    }
    if (desc && (desc.get || desc.set)) {
      Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: desc.enumerable ?? true,
        get: desc.get ? () => desc.get!.call(obj) : undefined,
        set: (v: unknown) => {
          desc.set?.call(obj, v)
          notify()
        },
      })
    } else {
      let backing = obj[key]
      Object.defineProperty(obj, key, {
        configurable: true,
        enumerable: desc?.enumerable ?? true,
        get: () => backing,
        set: (v: unknown) => {
          backing = v
          notify()
        },
      })
    }
    entry = { listeners }
    registry.set(key, entry)
  }
  entry.listeners.add(listener)
  return () => { entry!.listeners.delete(listener) }
}

export function observeWidgetValue(
  node: { widgets?: Array<{ name?: string }> } | undefined,
  name: string,
  listener: () => void,
): () => void {
  const w = node?.widgets?.find(x => x?.name === name)
  if (!w) return () => {}
  return observeProperty(w, 'value', listener)
}

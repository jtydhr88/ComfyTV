const MAX_CONCURRENT = 3

let active = 0
const queue: Array<() => void> = []

export function withHydrateGate<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = (): void => {
      active++
      fn().then(resolve, reject).finally(() => {
        active--
        queue.shift()?.()
      })
    }
    if (active < MAX_CONCURRENT) run()
    else queue.push(run)
  })
}

export function hydrateGateStats(): { active: number; queued: number } {
  return { active, queued: queue.length }
}

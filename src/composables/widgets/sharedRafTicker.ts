const subs = new Set<() => void>()
let rafId = 0

function loop(): void {
  for (const cb of [...subs]) {
    try {
      cb()
    } catch { }
  }
  rafId = subs.size ? requestAnimationFrame(loop) : 0
}

export function subscribeRafTick(cb: () => void): () => void {
  subs.add(cb)
  if (!rafId) rafId = requestAnimationFrame(loop)
  let done = false
  return () => {
    if (done) return
    done = true
    subs.delete(cb)
    if (!subs.size && rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }
}

export function rafTickerSubscriberCount(): number {
  return subs.size
}

import { ref } from 'vue'
import { z } from 'zod'
const zLease = z.strictObject({ schema_version: z.literal(1), channel_id: z.string().min(1).max(256), csrf_token: z.string().min(1).max(256), expires_at: z.iso.datetime({ offset: true }), can_respond: z.literal(true) })
export function createInteractionChannel(fetcher: (route: string, init: RequestInit) => Promise<Response>, origin: string) {
  let lease: z.infer<typeof zLease> | undefined
  let generation = 0
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const available = ref(false)
  const connected = ref(false)
  const now = ref(Date.now())
  let clock: ReturnType<typeof setInterval> | undefined
  const base = new URL(origin)
  const local = ['http:', 'https:'].includes(base.protocol) && (base.hostname === 'localhost' || base.hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(base.hostname))
  function valid() { return local && lease !== undefined && Date.parse(lease.expires_at) > Date.now() }
  function headers(route: string): Record<string,string> {
    const url = new URL(route, base)
    if (!valid() || url.origin !== base.origin || url.search || url.hash || url.username || url.password || !(/^\/comfytv\/agent\/(interactions\/channel\/renew|threads\/[^/]+\/(messages|interactions(?:\/[^/]+\/response)?))$/.test(url.pathname) || /^\/comfytv\/hermes\/connection(?:\/(pair|import|migrate|test|disconnect))?$/.test(url.pathname))) return {}
    return { 'X-ComfyTV-Interaction': '1', 'X-ComfyTV-Interaction-Channel': lease!.channel_id, 'X-ComfyTV-Interaction-CSRF': lease!.csrf_token }
  }
  async function exchange(route: string, body: unknown, renew = false) {
    const owned = generation
    try {
      const response = await fetcher(route, { method: 'POST', credentials: 'same-origin', redirect: 'error', headers: { 'Content-Type': 'application/json', 'X-ComfyTV-Interaction': '1', ...(renew ? headers(route) : {}) }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error('Channel unavailable')
      const parsed = zLease.parse(await response.json())
      if (owned !== generation) return
      if (renew && parsed.channel_id !== lease?.channel_id) throw new Error('Channel changed')
      lease = parsed
      available.value = valid()
    } catch { if (owned === generation) { lease = undefined; available.value = false } }
  }
  async function renew() {
    if (!valid()) { available.value = false; return }
    await exchange('/comfytv/agent/interactions/channel/renew', { channel_id: lease!.channel_id }, true)
  }
  async function open() {
    if (!local) return
    await exchange('/comfytv/agent/interactions/channel', { version: 1, kinds: ['hermes_approval','hermes_question'] })
    if (!clock) clock = setInterval(() => { now.value = Date.now(); available.value = valid() }, 1000)
    if (!heartbeat) heartbeat = setInterval(() => void renew(), 30000)
  }
  function close() {
    generation++
    clearInterval(heartbeat); clearInterval(clock)
    heartbeat = undefined; clock = undefined; lease = undefined
    available.value = false; connected.value = false
  }
  return { open, close, renew, headers, isAvailable: valid, available, connected, now }
}

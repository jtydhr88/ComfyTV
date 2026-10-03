import { ref, type InjectionKey, type Ref } from 'vue'
import { validInteractionDecision, zTVInteraction, type TVInteraction, type InteractionResponse } from '../../schemas/hermesInteractionSchema'
import type { AgentRestClient } from './agentRestClient'
export interface InteractionView {
  now: Ref<number>
  canRespond(interaction: TVInteraction): boolean
  protocolError?(interaction: TVInteraction): string | undefined
}
export const interactionViewKey: InjectionKey<InteractionView> = Symbol('native-interactions')
// Schema parse fixes field order; compare the exact public immutable projection,
// not generic response objects or the active thread at callback time.
function content(i: TVInteraction) {
 const { state: _state, can_respond: _can, ...immutable } = zTVInteraction.parse(i)
 return JSON.stringify(immutable)
}
const terminal = (i: TVInteraction) => !['pending','dispatching','delivery_unknown'].includes(i.state)
const key = (i: TVInteraction) => `${i.thread_id}\u0000${i.id}`
export function createAgentInteractions(rest: AgentRestClient, apply: (i: TVInteraction) => void) {
 const canonical = ref(new Map<string,TVInteraction>())
 const blocked = ref(new Set<string>())
 const protocolErrors = ref(new Map<string,string>())
 const protocolFailure = (k: string) => protocolErrors.value.set(k, 'Interaction protocol error: acknowledgement or snapshot mismatch. Canonical state retained; no retry.')
 const channel = rest.interactionChannel
 const view: InteractionView = {
  now: channel.now,
  protocolError: i => protocolErrors.value.get(key(i)),
  canRespond(i) {
   // Keep display timers reactive; click authority uses the actual clock below.
   void channel.now.value
   const c = canonical.value.get(key(i))
   return channel.available.value && channel.isAvailable() && channel.connected.value && !blocked.value.has(key(i)) && i.state === 'pending' && c?.state === 'pending' && c.can_respond && content(c) === content(i) && (c.expires_at === null || Date.parse(c.expires_at) > Date.now())
  }
 }
 function accept(i: TVInteraction) {
  const prior = canonical.value.get(key(i))
  // Once settled, retain the original tombstone across every stale or reordered read.
  if (prior && terminal(prior)) {
   if (content(prior) !== content(i) || (terminal(i) && prior.state !== i.state)) protocolFailure(key(i))
   const settled = { ...prior, can_respond: false }
   canonical.value.set(key(i), settled); apply(settled); return
  }
  if (prior && content(prior) !== content(i)) {
   const stale = { ...prior, state: 'stale' as const, can_respond: false }
   canonical.value.set(key(i), stale); blocked.value.add(key(i)); apply(stale); return
  }
  canonical.value.set(key(i), i)
  if (i.state === 'pending' && blocked.value.has(key(i)) && prior && ['dispatching','delivery_unknown'].includes(prior.state)) {
   canonical.value.set(key(i), { ...i, state: prior.state, can_respond: false })
   apply({ ...i, state: prior.state, can_respond: false }); return
  }
  if (i.state !== 'pending' && !['dispatching','delivery_unknown'].includes(i.state)) blocked.value.delete(key(i))
  apply(i)
 }
 function hint(i: TVInteraction) {
  const prior = canonical.value.get(key(i))
  if (prior && content(prior) !== content(i)) {
   accept({ ...prior, state: 'stale', can_respond: false }); blocked.value.add(key(i)); return
  }
  const display = { ...(prior ?? i), state: prior?.state ?? (i.state === 'pending' ? 'pending' : 'delivery_unknown'), can_respond: false } as TVInteraction
  canonical.value.set(key(i), display); apply(display)
 }
 async function refresh(threadId: string) {
  try {
   const snapshot = await rest.getInteractions(threadId)
   const present = new Set(snapshot.interactions.map(key))
   for (const [k, old] of canonical.value) if (old.thread_id === threadId && !present.has(k)) accept({ ...old, state: 'stale', can_respond: false })
   for (const interaction of snapshot.interactions) accept(interaction)
  } catch {
   for (const [k, i] of canonical.value) if (i.thread_id === threadId) { canonical.value.set(k, { ...i, can_respond: false }); apply({ ...i, can_respond: false }) }
  }
 }
 async function respond({ interaction, decision }: InteractionResponse) {
  if (!view.canRespond(interaction) || !validInteractionDecision(interaction, decision)) return
  const frozen = zTVInteraction.parse(interaction)
  const k = key(frozen)
  if (frozen.kind === 'hermes_approval' ? !('choice' in decision) || !['once','deny'].includes(decision.choice) || (decision.choice === 'once' && (!frozen.action.approvable || frozen.action.truncated)) : 'choice' in decision) return
  blocked.value.add(k)
  apply({ ...frozen, state: 'dispatching', can_respond: false })
  let result: TVInteraction | undefined
  try { result = zTVInteraction.parse((await rest.respondInteraction(frozen, decision)).interaction) }
  catch (error) {
   if (!(error instanceof TypeError) && !(typeof error === 'object' && error !== null && 'status' in error)) protocolFailure(k)
  }
  await refresh(frozen.thread_id)
  const readback = canonical.value.get(k)
  if (result && (content(result) !== content(frozen) || (readback && terminal(readback) && result.state !== readback.state))) protocolFailure(k)
  // Exact canonical GET is authority even when the acknowledgement is malformed,
  // mismatched or lost. Never replace confirmed truth with delivery uncertainty.
  if (readback && content(readback) === content(frozen) && terminal(readback)) return
  blocked.value.add(k)
  accept({ ...(readback && content(readback) === content(frozen) ? readback : frozen), state: 'delivery_unknown', can_respond: false })
 }
 return { view, refresh, respond, hint }
}

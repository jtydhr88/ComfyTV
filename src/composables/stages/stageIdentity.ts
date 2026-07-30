const PROP = 'comfytv_stage_uid'

function genUid(): string {
  const c: any = (globalThis as any).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return (
    'uid-' +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10)
  )
}

export function ensureStageUid(node: any): string {
  if (!node) return ''
  if (!node.properties || typeof node.properties !== 'object') node.properties = {}
  let uid = node.properties[PROP]
  if (typeof uid !== 'string' || uid.length === 0) {
    uid = genUid()
    node.properties[PROP] = uid
  }
  return uid
}

export function getStageUid(node: any): string {
  const uid = node?.properties?.[PROP]
  return typeof uid === 'string' ? uid : ''
}

const liveUids = new Map<string, any>()

export function claimStageUid(node: any): string {
  if (!node) return ''
  const prev = typeof node.__comfytvClaimedUid === 'string' ? node.__comfytvClaimedUid : ''
  let uid = ensureStageUid(node)
  if (prev && prev !== uid && liveUids.get(prev) === node) liveUids.delete(prev)
  const owner = liveUids.get(uid)
  if (owner && owner !== node) {
    uid = genUid()
    node.properties[PROP] = uid
    console.warn(
      `[ComfyTV/stage] node #${node.id}: stage uid already claimed by node #${owner.id} — regenerated`,
    )
  }
  liveUids.set(uid, node)
  node.__comfytvClaimedUid = uid
  return uid
}

export function releaseStageUid(node: any): void {
  if (!node) return
  const claimed = typeof node.__comfytvClaimedUid === 'string' ? node.__comfytvClaimedUid : ''
  const uid = claimed || getStageUid(node)
  if (uid && liveUids.get(uid) === node) liveUids.delete(uid)
  delete node.__comfytvClaimedUid
}

export function stageClassName(node: any): string {
  const cc = String(node?.comfyClass ?? node?.type ?? '')
  const dot = cc.lastIndexOf('.')
  return dot >= 0 ? cc.slice(dot + 1) : cc
}

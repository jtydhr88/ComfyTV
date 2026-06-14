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

export function stageClassName(node: any): string {
  const cc = String(node?.comfyClass ?? node?.type ?? '')
  const dot = cc.lastIndexOf('.')
  return dot >= 0 ? cc.slice(dot + 1) : cc
}

import { app, type LGraphNode } from '@/lib/comfyApp'

export const SCOPES_NODE_CLASS = 'ComfyTV.VideoScopesStage'

export function findDownstreamScopeNodes(node: LGraphNode): LGraphNode[] {
  const n = node as any
  const graph: any = n.graph ?? (app as any)?.graph
  if (!graph) return []
  const out: LGraphNode[] = []
  const seen = new Set<unknown>()
  for (const o of n.outputs ?? []) {
    for (const linkId of o?.links ?? []) {
      const linksMap: any = graph.links
      const link = (linksMap && typeof linksMap.get === 'function')
        ? linksMap.get(linkId)
        : (linksMap?.[linkId] ?? graph.getLink?.(linkId))
      if (!link) continue
      const target = graph.getNodeById?.(link.target_id)
      if (!target || seen.has(target.id)) continue
      const cls = (target as any).comfyClass ?? (target as any).type
      if (cls !== SCOPES_NODE_CLASS) continue
      seen.add(target.id)
      out.push(target)
    }
  }
  return out
}

export function scopeKindOf(scopeNode: LGraphNode): string {
  const w = ((scopeNode as any).widgets ?? [])
    .find((x: any) => x?.name === 'scope')
  const v = w?.value
  return typeof v === 'string' && v ? v : 'waveform'
}

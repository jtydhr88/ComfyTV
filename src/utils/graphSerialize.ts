const LG_MODE_NEVER = 2
const LG_MODE_BYPASS = 4

export function collectReachableNodeIds(app: any, target: any): Set<number> {
  const reachable = new Set<number>()
  reachable.add(target.id)

  const isBridgeIn = typeof target?.comfyClass === 'string'
                     && target.comfyClass.startsWith('ComfyTV.BridgeTo')
  if (!isBridgeIn) return reachable

  const linksMap: any = app?.graph?.links
  const getLink = (linkId: number) =>
    (linksMap && typeof linksMap.get === 'function')
      ? linksMap.get(linkId)
      : (linksMap?.[linkId] ?? app?.graph?.getLink?.(linkId))

  const queue: any[] = [target]
  while (queue.length) {
    const node = queue.shift()
    if (!node) continue
    for (const inp of node.inputs ?? []) {
      if (inp.link == null) continue
      const link = getLink(inp.link)
      const srcId = link?.origin_id
      if (srcId == null) continue
      const srcNode = app?.graph?.getNodeById?.(srcId)
      if (srcNode && !reachable.has(srcNode.id)) {
        reachable.add(srcNode.id)
        queue.push(srcNode)
      }
    }
  }
  return reachable
}

export async function serializeNodeEntry(node: any): Promise<{
  inputs: Record<string, unknown>
  class_type: string
  _meta: { title?: string }
}> {
  const inputs: Record<string, unknown> = {}

  if (node.widgets) {
    for (let i = 0; i < node.widgets.length; i++) {
      const w = node.widgets[i]
      if (!w?.name) continue
      if (w.options?.serialize === false) continue
      let value = typeof w.serializeValue === 'function'
        ? await w.serializeValue(node, i)
        : w.value
      const numericType = w.type === 'number' || w.type === 'INT' || w.type === 'FLOAT'
                       || w.type === 'int'   || w.type === 'float'
      if (numericType && (value === '' || value == null || Number.isNaN(Number(value)))) {
        const def = w.options?.default
        value = (def !== undefined && def !== '' && !Number.isNaN(Number(def)))
          ? Number(def)
          : 0
      }
      if (Array.isArray(value)) {
        inputs[w.name] = w.type === 'curve'
          ? { __type__: 'CURVE', __value__: value }
          : { __value__: value }
      } else {
        inputs[w.name] = value
      }
    }
  }

  const graph = node.graph
  const getLink = (id: number) =>
    (graph?.links && typeof graph.links.get === 'function')
      ? graph.links.get(id)
      : (graph?.links?.[id] ?? graph?.getLink?.(id))

  for (const slot of node.inputs ?? []) {
    if (slot.link == null) continue
    const link = getLink(slot.link)
    if (!link) continue
    inputs[slot.name] = [String(link.origin_id), Number(link.origin_slot)]
  }

  return {
    inputs,
    class_type: String(node.comfyClass ?? node.type ?? ''),
    _meta: { title: node.title },
  }
}

export async function buildScopedPrompt(
  app: any,
  reachable: Set<number>,
): Promise<{ output: Record<string, any>; workflow: any }> {
  const output: Record<string, any> = {}
  for (const n of app?.graph?._nodes ?? []) {
    if (!reachable.has(n.id)) continue
    if (n.mode === LG_MODE_NEVER || n.mode === LG_MODE_BYPASS) continue
    if (n.isVirtualNode) continue
    output[String(n.id)] = await serializeNodeEntry(n)
  }
  return { output, workflow: { nodes: [], links: [], version: 0.4 } }
}

type CommandResult = Record<string, unknown>

const TITLE = 30

export function arrangeGrid(graph: any, margin: number, columns?: number): number {
  const ordered: any[] = typeof graph?.computeExecutionOrder === 'function'
    ? graph.computeExecutionOrder(false, true)
    : []
  const nodes: any[] = ordered.length ? ordered : (graph?._nodes ?? [])
  if (!nodes.length) return 0
  const cols = Math.max(1, Math.min(12,
    Math.floor(columns || Math.ceil(Math.sqrt(nodes.length)))))
  const pitch = Math.max(...nodes.map(n => Number(n.size?.[0]) || 200)) + margin
  let y = margin + TITLE
  for (let i = 0; i < nodes.length; i += cols) {
    const row = nodes.slice(i, i + cols)
    row.forEach((n, j) => { n.pos = [margin + j * pitch, y] })
    y += Math.max(...row.map(n => Number(n.size?.[1]) || 100)) + margin + TITLE
  }
  graph.setDirtyCanvas?.(true, true)
  return nodes.length
}

export function handleArrangeCanvas(app: any, cmd: any): CommandResult {
  const graph = app?.graph
  if (!graph) throw new Error('no graph available in this tab')
  const margin = Math.max(20, Math.min(400, Number(cmd.margin) || 100))
  if (cmd.layout === 'grid') {
    const columns = Number(cmd.columns) || undefined
    const arranged = arrangeGrid(graph, margin, columns)
    return { arranged, margin, layout: 'grid' }
  }
  if (typeof graph.arrange !== 'function') {
    throw new Error('the graph does not support arrange')
  }
  const vertical = cmd.layout === 'vertical'
  const lg = (window as any).LiteGraph
  graph.arrange(margin, vertical ? lg?.VERTICAL_LAYOUT : undefined)
  const count = Array.isArray(graph._nodes) ? graph._nodes.length : 0
  return { arranged: count, margin, layout: vertical ? 'vertical' : 'horizontal' }
}

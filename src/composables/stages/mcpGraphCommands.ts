import { extractRunError } from '@/utils/runError'
import { getWidget, writeWidget } from '@/utils/widget'

type CommandResult = Record<string, unknown>

const WIDGET_VALUE_CAP = 2000
const NODE_ERRORS_CAP = 1500

function rootGraph(app: any): any {
  const graph = app?.graph
  if (!graph) throw new Error('no graph available in this tab')
  return graph
}

function requireNode(graph: any, ref: unknown): any {
  const id = String(ref ?? '')
  const node = graph?.getNodeById?.(Number(id)) ?? graph?.getNodeById?.(id)
  if (!node) throw new Error(`node ${id} not found on the canvas`)
  return node
}

function slotIndex(slots: any[], ref: unknown, side: string): number {
  if (ref == null) return -1
  const asNumber = Number(ref)
  if (Number.isInteger(asNumber) && String(ref).trim() !== '' && !Number.isNaN(asNumber)
      && String(asNumber) === String(ref).trim()) {
    if (asNumber < 0 || asNumber >= slots.length) {
      throw new Error(`${side} slot index ${asNumber} out of range (0..${slots.length - 1})`)
    }
    return asNumber
  }
  const name = String(ref)
  const idx = slots.findIndex((s: any) => String(s?.name ?? '') === name)
  if (idx < 0) {
    const names = slots.map((s: any) => String(s?.name ?? '')).join(', ') || '(none)'
    throw new Error(`no ${side} slot '${name}'; slots: ${names}`)
  }
  return idx
}

function widgetNames(node: any): string {
  return (node.widgets ?? [])
    .map((w: any) => String(w?.name ?? '')).filter(Boolean).join(', ') || '(none)'
}

function applyWidgets(node: any, widgets: unknown, updated: string[]): void {
  if (widgets == null) return
  if (typeof widgets !== 'object' || Array.isArray(widgets)) {
    throw new Error('widgets must be an object mapping widget name -> value')
  }
  for (const [name, value] of Object.entries(widgets as Record<string, unknown>)) {
    if (!getWidget(node, name)) {
      throw new Error(`no widget '${name}' on node ${node.id}; widgets: ${widgetNames(node)}`)
    }
    writeWidget(node, name, value)
    updated.push(`${node.id}.${name}`)
  }
}

function slimGraphNode(node: any, links: any): CommandResult {
  const widgets: Record<string, unknown> = {}
  for (const w of node.widgets ?? []) {
    const name = String(w?.name ?? '')
    if (!name) continue
    let v = (w as any).value
    if (typeof v === 'function' || v === undefined) continue
    if (typeof v === 'string' && v.length > WIDGET_VALUE_CAP) {
      v = v.slice(0, WIDGET_VALUE_CAP) + '…'
    }
    widgets[name] = v
  }
  const inputs = (node.inputs ?? []).map((inp: any) => {
    const link = inp?.link != null ? links[inp.link] : null
    return {
      name: String(inp?.name ?? ''),
      type: String(inp?.type ?? ''),
      ...(link?.origin_id != null
        ? { from_node: String(link.origin_id), from_slot: Number(link.origin_slot) || 0 }
        : {}),
    }
  })
  const outputs = (node.outputs ?? []).map((out: any) => ({
    name: String(out?.name ?? ''),
    type: String(out?.type ?? ''),
    to_nodes: (out?.links ?? [])
      .map((id: any) => links[id]?.target_id)
      .filter((t: any) => t != null)
      .map((t: any) => String(t)),
  }))
  const type = String(node.comfyClass ?? node.type ?? '')
  return {
    node_id: String(node.id),
    type,
    title: String(node.title ?? ''),
    ...(type.startsWith('ComfyTV.') ? { is_stage: true } : {}),
    ...(node.subgraph ? { is_subgraph: true } : {}),
    ...(node.mode ? { mode: Number(node.mode) } : {}),
    widgets,
    inputs,
    outputs,
  }
}

export function handleGraphGet(app: any): CommandResult {
  const graph = rootGraph(app)
  const links = graph.links ?? {}
  const nodes = (graph._nodes ?? []).map((n: any) => slimGraphNode(n, links))
  return { node_count: nodes.length, nodes }
}

function opAddNode(app: any, graph: any, op: any, updated: string[]): CommandResult {
  const type = String(op.type ?? '')
  if (!type) throw new Error('add_node needs a type (a node class name)')
  const lg = (window as any).LiteGraph
  if (!lg?.createNode) throw new Error('LiteGraph.createNode not available')
  const node = lg.createNode(type)
  if (!node) throw new Error(`unknown node type ${type}`)
  graph.add(node)
  if (Array.isArray(op.pos) && op.pos.length === 2) {
    node.pos = [Number(op.pos[0]), Number(op.pos[1])]
  }
  if (op.title != null) node.title = String(op.title)
  applyWidgets(node, op.widgets, updated)
  return { op: 'add_node', node_id: String(node.id), type }
}

function opConnect(graph: any, op: any): CommandResult {
  const src = requireNode(graph, op.from_node)
  const dst = requireNode(graph, op.to_node)
  const fromIdx = op.from_slot != null
    ? slotIndex(src.outputs ?? [], op.from_slot, 'output')
    : 0
  const out = src.outputs?.[fromIdx]
  if (!out) throw new Error(`node ${src.id} has no output slot ${fromIdx}`)
  let toIdx: number
  if (op.to_slot != null) {
    toIdx = slotIndex(dst.inputs ?? [], op.to_slot, 'input')
  } else {
    toIdx = (dst.inputs ?? []).findIndex((inp: any) =>
      inp?.link == null
      && (inp?.type === '*' || String(inp?.type ?? '').split(',').includes(String(out.type))))
    if (toIdx < 0) {
      throw new Error(
        `no free input on node ${dst.id} compatible with type ${String(out.type)}`)
    }
  }
  const link = src.connect(fromIdx, dst, toIdx)
  if (!link) throw new Error('the graph rejected the connection (type mismatch?)')
  return {
    op: 'connect',
    from: String(src.id),
    to: String(dst.id),
    input: String(dst.inputs?.[toIdx]?.name ?? toIdx),
  }
}

const NODE_MODES: Record<string, number> = { always: 0, mute: 2, bypass: 4 }

function opSetMode(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  const mode = String(op.mode ?? '')
  if (!(mode in NODE_MODES)) {
    throw new Error(`invalid mode '${mode}' — valid: always, mute, bypass`)
  }
  node.mode = NODE_MODES[mode]
  return { op: 'set_mode', node_id: String(node.id), mode }
}

function opClone(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  if (typeof node.clone !== 'function') {
    throw new Error(`node ${node.id} cannot be cloned`)
  }
  const copy = node.clone()
  if (!copy) throw new Error(`cloning node ${node.id} failed`)
  graph.add(copy)
  copy.pos = Array.isArray(op.pos) && op.pos.length === 2
    ? [Number(op.pos[0]), Number(op.pos[1])]
    : [(Number(node.pos?.[0]) || 0) + 40, (Number(node.pos?.[1]) || 0) + 40]
  return { op: 'clone', node_id: String(copy.id), cloned_from: String(node.id) }
}

function opSetColor(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  if (op.color !== undefined) node.color = op.color ? String(op.color) : undefined
  if (op.bgcolor !== undefined) node.bgcolor = op.bgcolor ? String(op.bgcolor) : undefined
  return { op: 'set_color', node_id: String(node.id) }
}

function opCreateGroup(graph: any, op: any): CommandResult {
  const ids = op.nodes
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('create_group needs nodes (a non-empty array of node ids)')
  }
  const lg = (window as any).LiteGraph
  if (!lg?.LGraphGroup) throw new Error('LGraphGroup not available')
  const members = ids.map((id: any) => requireNode(graph, id))
  const group = new lg.LGraphGroup()
  group.title = String(op.title ?? 'Group')
  if (op.color) group.color = String(op.color)
  const pad = 24
  const xs = members.map((n: any) => Number(n.pos?.[0]) || 0)
  const ys = members.map((n: any) => Number(n.pos?.[1]) || 0)
  const x2 = members.map((n: any) =>
    (Number(n.pos?.[0]) || 0) + (Number(n.size?.[0]) || 200))
  const y2 = members.map((n: any) =>
    (Number(n.pos?.[1]) || 0) + (Number(n.size?.[1]) || 100))
  if (typeof group.resizeTo === 'function') {
    group.resizeTo(members, pad)
  } else {
    group.pos = [Math.min(...xs) - pad, Math.min(...ys) - pad - 30]
    group.size = [
      Math.max(...x2) - Math.min(...xs) + pad * 2,
      Math.max(...y2) - Math.min(...ys) + pad * 2 + 30,
    ]
  }
  graph.add(group)
  group.recomputeInsideNodes?.()
  return { op: 'create_group', title: group.title, node_count: members.length }
}

function opCollapse(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  const want = op.collapsed !== false
  if (Boolean(node.flags?.collapsed) !== want) node.collapse?.()
  return {
    op: 'collapse',
    node_id: String(node.id),
    collapsed: Boolean(node.flags?.collapsed),
  }
}

function opPin(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  if (typeof node.pin !== 'function') {
    throw new Error(`node ${node.id} cannot be pinned`)
  }
  const want = op.pinned !== false
  node.pin(want)
  return { op: 'pin', node_id: String(node.id), pinned: want }
}

function opConvertToSubgraph(app: any, graph: any, op: any): CommandResult {
  const ids = op.nodes
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('convert_to_subgraph needs nodes (a non-empty array of node ids)')
  }
  if (typeof graph.convertToSubgraph !== 'function') {
    throw new Error('this graph does not support convertToSubgraph')
  }
  const members = ids.map((id: any) => requireNode(graph, id))
  const res = graph.convertToSubgraph(new Set(members))
  if (!res?.node) throw new Error('the graph refused to convert the selection')
  app?.canvas?.select?.(res.node)
  return {
    op: 'convert_to_subgraph',
    node_id: String(res.node.id),
    packed: members.length,
  }
}

function opUnpackSubgraph(graph: any, op: any): CommandResult {
  const node = requireNode(graph, op.node)
  if (!node.subgraph) {
    throw new Error(`node ${node.id} is not a subgraph node`)
  }
  if (typeof graph.unpackSubgraph !== 'function') {
    throw new Error('this graph does not support unpackSubgraph')
  }
  graph.unpackSubgraph(node, { skipMissingNodes: true })
  return { op: 'unpack_subgraph', node_id: String(node.id) }
}

export function handleGraphEdit(app: any, cmd: any): CommandResult {
  const graph = rootGraph(app)
  const ops = cmd?.ops
  if (!Array.isArray(ops) || ops.length === 0) {
    throw new Error('ops must be a non-empty array of {op, ...} objects')
  }
  const results: CommandResult[] = []
  const updated: string[] = []
  graph.beforeChange?.()
  try {
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]
      const name = String(op?.op ?? '')
      try {
        if (name === 'add_node') {
          results.push(opAddNode(app, graph, op, updated))
        } else if (name === 'remove_node') {
          const node = requireNode(graph, op.node)
          graph.remove(node)
          results.push({ op: name, node_id: String(node.id) })
        } else if (name === 'set_widget') {
          const node = requireNode(graph, op.node)
          applyWidgets(node, { [String(op.name)]: op.value }, updated)
          results.push({ op: name, node_id: String(node.id), name: String(op.name) })
        } else if (name === 'set_title') {
          const node = requireNode(graph, op.node)
          node.title = String(op.title ?? '')
          results.push({ op: name, node_id: String(node.id) })
        } else if (name === 'connect') {
          results.push(opConnect(graph, op))
        } else if (name === 'disconnect') {
          const node = requireNode(graph, op.node)
          const idx = slotIndex(node.inputs ?? [], op.input, 'input')
          node.disconnectInput?.(idx)
          results.push({ op: name, node_id: String(node.id), input: String(op.input) })
        } else if (name === 'set_mode') {
          results.push(opSetMode(graph, op))
        } else if (name === 'clone') {
          results.push(opClone(graph, op))
        } else if (name === 'set_color') {
          results.push(opSetColor(graph, op))
        } else if (name === 'create_group') {
          results.push(opCreateGroup(graph, op))
        } else if (name === 'collapse') {
          results.push(opCollapse(graph, op))
        } else if (name === 'pin') {
          results.push(opPin(graph, op))
        } else if (name === 'convert_to_subgraph') {
          results.push(opConvertToSubgraph(app, graph, op))
        } else if (name === 'unpack_subgraph') {
          results.push(opUnpackSubgraph(graph, op))
        } else {
          throw new Error(
            `unknown op '${name}' — valid: add_node, remove_node, set_widget, `
            + 'set_title, connect, disconnect, set_mode, clone, set_color, '
            + 'create_group, collapse, pin, convert_to_subgraph, '
            + 'unpack_subgraph')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(
          `ops[${i}] (${name || '?'}): ${msg}`
          + (results.length ? ` — ${results.length} earlier op(s) already applied` : ''))
      }
    }
  } finally {
    graph.afterChange?.()
  }
  graph.setDirtyCanvas?.(true, true)
  return { applied: results, updated_widgets: updated }
}

export const CANVAS_COMMANDS = [
  'Comfy.Undo',
  'Comfy.Redo',
  'Comfy.SaveWorkflow',
  'Comfy.Canvas.FitView',
  'Comfy.Canvas.ResetView',
  'Comfy.Interrupt',
  'Comfy.ClearPendingTasks',
  'Comfy.RefreshNodeDefinitions',
  'Comfy.Graph.GroupSelectedNodes',
] as const

function selectNodesOnCanvas(app: any, ids: unknown[]): void {
  const graph = rootGraph(app)
  const canvas = app?.canvas
  if (!canvas) throw new Error('no canvas available in this tab')
  const members = ids.map((id) => requireNode(graph, id))
  if (typeof canvas.deselectAll === 'function') canvas.deselectAll()
  else canvas.deselectAllNodes?.()
  for (const node of members) {
    if (typeof canvas.select === 'function') canvas.select(node)
    else canvas.selectNode?.(node, true)
  }
  canvas.setDirty?.(true, true)
}

export async function handleCanvasCommand(app: any, cmd: any): Promise<CommandResult> {
  const id = String(cmd?.command ?? '')
  if (!(CANVAS_COMMANDS as readonly string[]).includes(id)) {
    throw new Error(
      `command '${id}' is not allowed — allowed: ${CANVAS_COMMANDS.join(', ')}`)
  }
  if (Array.isArray(cmd?.nodes) && cmd.nodes.length) {
    selectNodesOnCanvas(app, cmd.nodes)
  }
  const commandApi = app?.extensionManager?.command
  if (typeof commandApi?.execute === 'function') {
    await commandApi.execute(id)
    return { executed: id }
  }
  if (id === 'Comfy.Interrupt' && typeof app?.api?.interrupt === 'function') {
    await app.api.interrupt()
    return { executed: id, via: 'api.interrupt' }
  }
  throw new Error(
    'the command system is not exposed in this frontend '
    + '(app.extensionManager.command.execute missing)')
}

export function handleCanvasFocus(app: any, cmd: any): CommandResult {
  const graph = rootGraph(app)
  const node = requireNode(graph, cmd?.node)
  const canvas = app?.canvas
  if (!canvas) throw new Error('no canvas available in this tab')
  canvas.deselectAllNodes?.()
  if (typeof canvas.selectNodes === 'function') canvas.selectNodes([node])
  else canvas.selectNode?.(node)
  if (typeof canvas.animateToBounds === 'function' && node.pos && node.size) {
    canvas.animateToBounds([
      Number(node.pos[0]) - 80,
      Number(node.pos[1]) - 80,
      (Number(node.size[0]) || 200) + 160,
      (Number(node.size[1]) || 100) + 160,
    ])
  } else if (typeof canvas.centerOnNode === 'function') {
    canvas.centerOnNode(node)
  } else {
    throw new Error('canvas navigation APIs unavailable in this frontend')
  }
  canvas.setDirty?.(true, true)
  return { focused: String(node.id), title: String(node.title ?? '') }
}

export async function handleGraphRun(app: any): Promise<CommandResult> {
  if (typeof app?.graphToPrompt !== 'function') {
    throw new Error('graphToPrompt unavailable in this tab')
  }
  if (typeof app?.api?.queuePrompt !== 'function') {
    throw new Error('queuePrompt unavailable in this tab')
  }
  const data = await app.graphToPrompt()
  let res: any
  try {
    res = await app.api.queuePrompt(0, data)
  } catch (e) {
    throw new Error(`queue rejected the graph: ${extractRunError(e, 0).message}`)
  }
  const promptId = String(res?.prompt_id ?? '')
  const nodeErrors = res?.node_errors ?? {}
  if (!promptId) {
    const detail = Object.keys(nodeErrors).length
      ? JSON.stringify(nodeErrors).slice(0, NODE_ERRORS_CAP)
      : 'no prompt was queued — an all-ComfyTV canvas runs per stage via run_stage'
    throw new Error(`queue did not accept the graph: ${detail}`)
  }
  return { queued: true, prompt_id: promptId }
}

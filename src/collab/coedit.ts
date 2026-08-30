import { useDebounceFn } from '@vueuse/core'

import { createUndoStack } from '@/collab/coeditUndo'
import { askConfirm } from '@/composables/dialog/useConfirmDialog'
import { i18n } from '@/i18n'

export interface NodeRec {
  type: string
  pos: [number, number]
  size: [number, number]
  title: string
  mode: number
  widgets: Record<string, unknown>
}

export interface LinkRec {
  origin: string
  oslot: number
  target: string
  tslot: number
}

export interface DocRecords {
  nodes: Record<string, NodeRec>
  links: Record<string, LinkRec>
}

export type EditOp =
  | { kind: 'node'; op: 'put'; id: string; data: NodeRec }
  | { kind: 'node'; op: 'patch'; id: string; fields: Partial<NodeRec> }
  | { kind: 'node'; op: 'remove'; id: string }
  | { kind: 'link'; op: 'put'; id: string; data: LinkRec }
  | { kind: 'link'; op: 'remove'; id: string }

const NODE_FIELDS: (keyof NodeRec)[] = ['pos', 'size', 'title', 'mode', 'widgets']
const BLOB_REFRESH_MS = 10_000
const EVENT_DIFF_DEBOUNCE_MS = 50

const round1 = (v: unknown) => Math.round((Number(v) || 0) * 10) / 10

function linkKey(l: LinkRec): string {
  return `${l.origin}:${l.oslot}>${l.target}:${l.tslot}`
}

function widgetMap(liveNode: any): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const widgets: any[] = liveNode?.widgets ?? []
  for (let i = 0; i < widgets.length; i++) {
    const w = widgets[i]
    const name = String(w?.name || `#${i}`)
    const v = w?.value
    if (typeof v === 'function' || v === undefined) continue
    try {
      out[name] = JSON.parse(JSON.stringify(v))
    } catch { /* non-serializable widget value */ }
  }
  return out
}

export function toRecords(ser: any, graph?: any): DocRecords {
  const nodes: Record<string, NodeRec> = {}
  for (const n of ser?.nodes ?? []) {
    if (n?.id == null) continue
    const live = graph?.getNodeById?.(n.id)
    nodes[String(n.id)] = {
      type: String(n.type ?? ''),
      pos: [round1(n.pos?.[0]), round1(n.pos?.[1])],
      size: [round1(n.size?.[0]), round1(n.size?.[1])],
      title: String(n.title ?? ''),
      mode: Number(n.mode) || 0,
      widgets: widgetMap(live),
    }
  }
  const links: Record<string, LinkRec> = {}
  for (const l of ser?.links ?? []) {
    const rec: LinkRec = Array.isArray(l)
      ? { origin: String(l[1]), oslot: Number(l[2]) || 0,
          target: String(l[3]), tslot: Number(l[4]) || 0 }
      : { origin: String(l?.origin_id), oslot: Number(l?.origin_slot) || 0,
          target: String(l?.target_id), tslot: Number(l?.target_slot) || 0 }
    if (rec.origin === 'undefined' || rec.target === 'undefined') continue
    links[linkKey(rec)] = rec
  }
  return { nodes, links }
}

export function diffRecords(prev: DocRecords, next: DocRecords): EditOp[] {
  const ops: EditOp[] = []
  for (const id of Object.keys(prev.nodes)) {
    if (!(id in next.nodes)) ops.push({ kind: 'node', op: 'remove', id })
  }
  for (const [id, rec] of Object.entries(next.nodes)) {
    const old = prev.nodes[id]
    if (!old || old.type !== rec.type) {
      ops.push({ kind: 'node', op: 'put', id, data: rec })
      continue
    }
    const fields: Partial<NodeRec> = {}
    for (const f of NODE_FIELDS) {
      if (JSON.stringify(old[f]) !== JSON.stringify(rec[f])) {
        ;(fields as any)[f] = rec[f]
      }
    }
    if (Object.keys(fields).length) {
      ops.push({ kind: 'node', op: 'patch', id, fields })
    }
  }
  for (const id of Object.keys(prev.links)) {
    if (!(id in next.links)) ops.push({ kind: 'link', op: 'remove', id })
  }
  for (const [id, rec] of Object.entries(next.links)) {
    if (!(id in prev.links)) ops.push({ kind: 'link', op: 'put', id, data: rec })
  }
  return ops
}

export function applyOpsToRecords(doc: DocRecords, ops: EditOp[]): void {
  for (const op of ops) {
    if (op.kind === 'node') {
      if (op.op === 'remove') delete doc.nodes[op.id]
      else if (op.op === 'put') doc.nodes[op.id] = JSON.parse(JSON.stringify(op.data))
      else if (doc.nodes[op.id]) {
        Object.assign(doc.nodes[op.id], JSON.parse(JSON.stringify(op.fields)))
      }
    } else {
      if (op.op === 'remove') delete doc.links[op.id]
      else if (op.op === 'put') doc.links[op.id] = { ...op.data }
    }
  }
}

function getNode(graph: any, id: string): any {
  return graph?.getNodeById?.(/^\d+$/.test(id) ? Number(id) : id) ?? null
}

function patchNodeFields(node: any, fields: Partial<NodeRec>): void {
  if (fields.pos) node.pos = [Number(fields.pos[0]), Number(fields.pos[1])]
  if (fields.size) {
    if (typeof node.setSize === 'function') node.setSize([Number(fields.size[0]), Number(fields.size[1])])
    else node.size = [Number(fields.size[0]), Number(fields.size[1])]
  }
  if (fields.title !== undefined) node.title = String(fields.title)
  if (fields.mode !== undefined) node.mode = Number(fields.mode) || 0
  if (fields.widgets !== undefined) {
    const widgets: any[] = node.widgets ?? []
    for (const [name, value] of Object.entries(fields.widgets)) {
      const idx = name.startsWith('#') ? Number(name.slice(1)) : -1
      const w = idx >= 0
        ? widgets[idx]
        : widgets.find((x: any) => String(x?.name ?? '') === name)
      if (!w) continue
      if (JSON.stringify(w.value) === JSON.stringify(value)) continue
      w.value = JSON.parse(JSON.stringify(value))
      try { w.callback?.(w.value) } catch { /* widget callback threw */ }
    }
  }
}

function currentLinkAt(graph: any, target: any, tslot: number): { origin: string; oslot: number } | null {
  const inp = target?.inputs?.[tslot]
  if (inp?.link == null) return null
  const links = graph?.links
  const link = typeof links?.get === 'function' ? links.get(inp.link) : links?.[inp.link]
  if (!link) return null
  return { origin: String(link.origin_id), oslot: Number(link.origin_slot) || 0 }
}

export function applyOpsToGraph(graph: any, ops: EditOp[]): void {
  if (!graph) return
  const lg = (window as any).LiteGraph
  graph.beforeChange?.()
  try {
    for (const op of ops) {
      try {
        if (op.kind === 'node') {
          if (op.op === 'remove') {
            const node = getNode(graph, op.id)
            if (node) graph.remove(node)
          } else if (op.op === 'put') {
            let node = getNode(graph, op.id)
            if (node && String(node.type) !== op.data.type) {
              graph.remove(node)
              node = null
            }
            if (!node) {
              node = lg?.createNode?.(op.data.type)
              if (!node) continue
              if (/^\d+$/.test(op.id)) node.id = Number(op.id)
              graph.add(node)
            }
            patchNodeFields(node, op.data)
          } else {
            const node = getNode(graph, op.id)
            if (node) patchNodeFields(node, op.fields)
          }
        } else if (op.op === 'put') {
          const origin = getNode(graph, op.data.origin)
          const target = getNode(graph, op.data.target)
          if (!origin || !target) continue
          const cur = currentLinkAt(graph, target, op.data.tslot)
          if (cur && cur.origin === op.data.origin && cur.oslot === op.data.oslot) continue
          origin.connect?.(op.data.oslot, target, op.data.tslot)
        } else {
          const rec = parseLinkKey(op.id)
          if (!rec) continue
          const target = getNode(graph, rec.target)
          if (!target) continue
          const cur = currentLinkAt(graph, target, rec.tslot)
          if (cur && cur.origin === rec.origin && cur.oslot === rec.oslot) {
            target.disconnectInput?.(rec.tslot)
          }
        }
      } catch (e) {
        console.warn('[ComfyTV/collab] remote op failed', op, e)
      }
    }
  } finally {
    graph.afterChange?.()
  }
  graph.setDirtyCanvas?.(true, true)
}

export function parseLinkKey(key: string): LinkRec | null {
  const m = /^(.+):(\d+)>(.+):(\d+)$/.exec(key)
  if (!m) return null
  return { origin: m[1], oslot: Number(m[2]), target: m[3], tslot: Number(m[4]) }
}

function opKey(op: EditOp): string {
  return `${op.kind}:${op.id}`
}

export interface CoEditEngine {
  onMessage(msg: Record<string, any>): boolean
  tick(projectId: string): void
  fastPos(): void
  startHosting(projectId: string): void
  requestJoin(projectId: string): Promise<void>
  rejoinIfRemembered(projectId: string): void
  undoLocal(): void
  redoLocal(): void
  reset(): void
  isEditing(): boolean
  isScribe(): boolean
}

function graphMatchesWorkflow(graph: any, wf: any): boolean {
  try {
    const cur = graph?.serialize?.()
    if (!cur) return false
    const key = (n: any) => `${n.id}:${n.type}:${JSON.stringify(n.widgets_values ?? [])}`
    const a = (cur.nodes ?? []).map(key).sort()
    const b = (wf.nodes ?? []).map(key).sort()
    if (a.length !== b.length) return false
    if (a.some((v: string, i: number) => v !== b[i])) return false
    return (cur.links ?? []).length === (wf.links ?? []).length
  } catch { return false }
}

const REJOIN_KEY = 'comfytv:coedit:'

export function createCoEditEngine(opts: {
  resolveApp: () => any
  send: (data: string) => boolean | void
  resolveSelfConnId: () => string
  resolveProjectId: () => string
  onEditingChange?: (editing: boolean) => void
}): CoEditEngine {
  let editing = false
  let joining = false
  let joinSentAt = 0
  let scribe = false
  let lastClock = 0
  let boundGraph: any = null
  let boundHash = ''
  let wasAway = false
  let shadow: DocRecords | null = null
  let lastBlob = ''
  let lastBlobAt = 0
  const pending = new Map<string, number>()
  const undoHistory = createUndoStack()

  function currentHash(): string {
    try { return location.hash } catch { return '' }
  }

  function bindGraph(graph: any) {
    boundGraph = graph
    boundHash = currentHash()
  }

  // ComfyUI reuses one LGraph across tabs (configure swaps content) — the
  // tab identity is the URL hash, not the graph reference
  function activeBoundGraph(): any | null {
    const graph = opts.resolveApp()?.graph
    if (!graph?.serialize) return null
    if (boundGraph && graph !== boundGraph) return null
    if (boundHash && currentHash() !== boundHash) return null
    return graph
  }

  const JOIN_STUCK_MS = 15_000

  function sendJoin(projectId: string) {
    joining = true
    joinSentAt = Date.now()
    opts.send(JSON.stringify({ type: 'join_edit', project_id: projectId }))
  }

  function setEditing(value: boolean) {
    editing = value
    opts.onEditingChange?.(value)
    if (value) {
      try { sessionStorage.setItem(REJOIN_KEY + opts.resolveProjectId(), '1') } catch { /* ignore */ }
    }
  }

  function reset() {
    setEditing(false)
    joining = false
    scribe = false
    lastClock = 0
    boundGraph = null
    boundHash = ''
    shadow = null
    lastBlob = ''
    lastBlobAt = 0
    pending.clear()
    undoHistory.clear()
  }

  function trackPending(ops: EditOp[], delta: number) {
    for (const op of ops) {
      const key = opKey(op)
      const n = (pending.get(key) ?? 0) + delta
      if (n > 0) pending.set(key, n)
      else pending.delete(key)
    }
  }

  function applyRemote(ops: EditOp[]) {
    const effective = ops.filter((op) => !pending.has(opKey(op)))
    if (!effective.length) return
    // while another tab is active, remote ops land in the shadow only
    const graph = activeBoundGraph()
    if (graph) applyOpsToGraph(graph, effective)
    else wasAway = true
    if (shadow) applyOpsToRecords(shadow, effective)
  }

  function sendOps(projectId: string, ops: EditOp[]) {
    trackPending(ops, 1)
    opts.send(JSON.stringify({ type: 'edit_ops', project_id: projectId, ops }))
  }

  function captureAndSend(projectId: string): any | null {
    const graph = activeBoundGraph()
    if (!graph || !editing || !shadow) return null
    const ser = graph.serialize()
    const records = toRecords(ser, graph)
    const ops = diffRecords(shadow, records)
    if (ops.length) {
      undoHistory.record(shadow, ops)
      shadow = records
      sendOps(projectId, ops)
    }
    return ser
  }

  const requestDiff = useDebounceFn(() => {
    if (!editing || joining) return
    captureAndSend(opts.resolveProjectId())
  }, EVENT_DIFF_DEBOUNCE_MS)

  function hookGraph(graph: any) {
    if (!graph || graph.__comfytvCoeditHooked) return
    graph.__comfytvCoeditHooked = true
    const chain = (name: string) => {
      const prev = graph[name]
      graph[name] = function (...args: any[]) {
        try { prev?.apply(this, args) } catch { /* prior hook threw */ }
        void requestDiff()
      }
    }
    chain('onNodeAdded')
    chain('onNodeRemoved')
    chain('onConnectionChange')
    chain('afterChange')
  }

  function fastPos() {
    if (!editing || joining || !shadow || !activeBoundGraph()) return
    const app = opts.resolveApp()
    const sel = app?.canvas?.selected_nodes
    if (!sel) return
    const nodes: any[] = typeof sel[Symbol.iterator] === 'function'
      ? Array.from(sel as Iterable<any>)
      : Object.values(sel)
    const ops: EditOp[] = []
    const applies: [NodeRec, Partial<NodeRec>][] = []
    for (const node of nodes) {
      if (!node) continue
      const rec = shadow.nodes[String(node.id)]
      if (!rec) continue
      const fields: Partial<NodeRec> = {}
      const pos: [number, number] = [round1(node.pos?.[0]), round1(node.pos?.[1])]
      const size: [number, number] = [round1(node.size?.[0]), round1(node.size?.[1])]
      if (pos[0] !== rec.pos[0] || pos[1] !== rec.pos[1]) fields.pos = pos
      if (size[0] !== rec.size[0] || size[1] !== rec.size[1]) fields.size = size
      if (Object.keys(fields).length) {
        applies.push([rec, fields])
        ops.push({ kind: 'node', op: 'patch', id: String(node.id), fields })
      }
    }
    if (!ops.length) return
    undoHistory.record(shadow, ops)  // before the shadow mutates
    for (const [rec, fields] of applies) Object.assign(rec, fields)
    sendOps(opts.resolveProjectId(), ops)
  }

  function applyLocal(ops: EditOp[]) {
    const graph = activeBoundGraph()
    if (!graph) return
    applyOpsToGraph(graph, ops)
    if (shadow) applyOpsToRecords(shadow, ops)
    sendOps(opts.resolveProjectId(), ops)
  }

  function undoLocal() {
    if (!editing || !activeBoundGraph()) return
    const entry = undoHistory.undo()
    if (entry) applyLocal(entry.inverse)
  }

  function redoLocal() {
    if (!editing || !activeBoundGraph()) return
    const entry = undoHistory.redo()
    if (entry) applyLocal(entry.forward)
  }

  function startHosting(projectId: string) {
    if (editing || joining || !projectId) return
    const graph = opts.resolveApp()?.graph
    if (!graph?.serialize) return
    const ser = graph.serialize()
    lastBlob = JSON.stringify(ser)
    lastBlobAt = Date.now()
    opts.send(JSON.stringify({ type: 'edit_put', project_id: projectId, workflow: ser }))
    bindGraph(graph)
    shadow = toRecords(ser, graph)
    setEditing(true)
    hookGraph(graph)
  }

  function tick(projectId: string) {
    // unwedge a join stalled in a hidden tab
    if (joining && Date.now() - joinSentAt > JOIN_STUCK_MS) joining = false
    if (!projectId || joining || !editing) return
    const graph = activeBoundGraph()
    if (!graph) {
      wasAway = true
      return
    }
    if (wasAway) {
      // catch the restored canvas up to the shadow; never diff stale state
      // out as local edits
      wasAway = false
      if (shadow) {
        const records = toRecords(graph.serialize(), graph)
        applyOpsToGraph(graph, diffRecords(records, shadow))
      }
      return
    }

    hookGraph(graph)
    const ser = captureAndSend(projectId)

    if (scribe && ser && Date.now() - lastBlobAt > BLOB_REFRESH_MS) {
      const blob = JSON.stringify(ser)
      lastBlobAt = Date.now()
      if (blob !== lastBlob) {
        lastBlob = blob
        opts.send(JSON.stringify({ type: 'edit_put', project_id: projectId,
          workflow: ser, base_clock: lastClock }))
      }
    }
  }

  function onMessage(msg: Record<string, any>): boolean {
    switch (msg.type) {
      case 'edit_scribe': {
        scribe = msg.you === true
        if (scribe) lastBlobAt = 0
        return true
      }
      case 'edit_doc': {
        joining = false
        if (!msg.workflow) {
          try { sessionStorage.removeItem(REJOIN_KEY + String(msg.project_id ?? '')) } catch { /* ignore */ }
          return true
        }
        void (async () => {
          const app = opts.resolveApp()
          try {
            if (!graphMatchesWorkflow(app?.graph, msg.workflow)) {
              await app.loadGraphData(msg.workflow)
            }
            for (const batch of msg.ops ?? []) {
              applyOpsToGraph(app.graph, batch as EditOp[])
            }
            bindGraph(app.graph)
            lastClock = Number(msg.clock) || 0
            shadow = toRecords(app.graph.serialize(), app.graph)
            setEditing(true)
            hookGraph(app.graph)
          } catch (e) {
            console.warn('[ComfyTV/collab] joining co-edit failed', e)
          }
        })()
        return true
      }
      case 'edit_ops': {
        if (!editing) return true
        lastClock = Number(msg.clock) || lastClock
        const ops = (msg.ops ?? []) as EditOp[]
        if (msg.conn_id && msg.conn_id === opts.resolveSelfConnId()) {
          trackPending(ops, -1)  // own echo = ack
        } else {
          applyRemote(ops)
        }
        return true
      }
      case 'edit_reset': {
        reset()
        return true
      }
    }
    return false
  }

  return {
    onMessage,
    tick,
    fastPos,
    startHosting,
    requestJoin: async (projectId: string) => {
      const nodeCount = opts.resolveApp()?.graph?._nodes?.length ?? 0
      if (nodeCount > 0) {
        const t = i18n.global.t
        const ok = await askConfirm({
          title: t('collab.joinEdit'),
          message: t('collab.joinEditConfirm'),
          danger: true,
        })
        if (!ok) return
      }
      sendJoin(projectId)
    },
    undoLocal,
    redoLocal,
    rejoinIfRemembered: (projectId: string) => {
      if (editing || joining) return
      // hidden tabs cannot run loadGraphData (rAF frozen)
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      let remembered = false
      try { remembered = sessionStorage.getItem(REJOIN_KEY + projectId) === '1' } catch { /* ignore */ }
      if (!remembered) return
      sendJoin(projectId)
    },
    reset,
    isEditing: () => editing,
    isScribe: () => scribe,
  }
}

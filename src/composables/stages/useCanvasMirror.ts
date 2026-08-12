import { z } from 'zod'

import { apiFetch, apiSend } from '@/api'
import { getStageUid, stageClassName } from '@/composables/stages/stageIdentity'

const OkSchema = z.object({ ok: z.boolean() })
const ActivitySchema = z.object({ active: z.boolean() })

const MCP_ACTIVITY_EVENT = 'comfytv-mcp-activity'

const TICK_MS = 5000
const HEARTBEAT_MS = 15000
const PROMPT_MAX_CHARS = 4000
const MENTION_PAT = /@([A-Za-z]+_\d+)/g

export interface CanvasMirrorDeps {
  resolveApp: () => any
  resolveProjectId: () => string
  resolveStageState: (node: any) => { output?: string | null; error?: { message: string } | null } | undefined
}

function widgetValue(node: any, name: string): string {
  const w = (node.widgets ?? []).find((w: any) => w?.name === name)
  return w?.value == null ? '' : String(w.value)
}

function resolveLink(graph: any, linkId: any): any {
  const links = graph?.links
  if (!links) return null
  if (typeof links.get === 'function') return links.get(linkId)
  return links[linkId] ?? graph?.getLink?.(linkId) ?? null
}

function stageInputs(graph: any, node: any): { slot: string; from_node: string; from_uid: string }[] {
  const out: { slot: string; from_node: string; from_uid: string }[] = []
  for (const inp of node.inputs ?? []) {
    if (inp?.link == null) continue
    const link = resolveLink(graph, inp.link)
    if (!link) continue
    const src = graph?.getNodeById?.(link.origin_id)
    out.push({
      slot: String(inp.name ?? ''),
      from_node: String(link.origin_id),
      from_uid: src ? getStageUid(src) : '',
    })
  }
  return out
}

function lastRun(state: { output?: string | null; error?: { message: string } | null } | undefined) {
  if (state?.error) return { status: 'error', error: state.error.message }
  if (state?.output) return { status: 'ok' }
  return { status: 'never' }
}

export function buildCanvasSnapshot(deps: CanvasMirrorDeps): { project_id: string; stages: any[] } | null {
  const app = deps.resolveApp()
  const projectId = deps.resolveProjectId()
  const graph = app?.graph
  if (!projectId || !graph) return null

  const stages: any[] = []
  for (const node of graph._nodes ?? []) {
    const cls = String(node?.comfyClass ?? node?.type ?? '')
    if (!cls.startsWith('ComfyTV.')) continue
    const prompt = widgetValue(node, 'main_prompt')
    stages.push({
      uid: getStageUid(node),
      graph_node_id: String(node.id),
      node_id: cls,
      stage_class: stageClassName(node),
      title: String(node.title ?? ''),
      workflow: widgetValue(node, 'workflow'),
      prompt: prompt.slice(0, PROMPT_MAX_CHARS),
      mentions: [...prompt.matchAll(MENTION_PAT)].map((m) => m[1]),
      inputs: stageInputs(graph, node),
      last_run: lastRun(deps.resolveStageState(node)),
    })
  }
  return { project_id: projectId, stages }
}

export function installCanvasMirror(app: any, deps: CanvasMirrorDeps): (() => void) | false {
  if (app.__comfytvCanvasMirrorInstalled) return false
  app.__comfytvCanvasMirrorInstalled = true

  let lastPosted = ''
  let lastPostedProject = ''
  let lastPostAt = 0
  let inFlight = false
  let timer: ReturnType<typeof setInterval> | null = null

  async function tick() {
    if (inFlight) return
    const snapshot = buildCanvasSnapshot(deps)
    if (!snapshot) return
    const serialized = JSON.stringify(snapshot)
    const now = Date.now()
    const changed = serialized !== lastPosted
    const heartbeatDue = now - lastPostAt >= HEARTBEAT_MS
    if (!changed && !heartbeatDue) return

    inFlight = true
    try {
      if (changed) {
        await apiSend('/comfytv/canvas_state', 'POST', OkSchema, snapshot)
        lastPosted = serialized
        lastPostedProject = snapshot.project_id
      } else {
        try {
          await apiSend('/comfytv/canvas_state', 'POST', OkSchema, {
            project_id: lastPostedProject || snapshot.project_id,
            heartbeat: true,
          })
        } catch (e) {
          lastPosted = ''
          throw e
        }
      }
      lastPostAt = now
    } catch {
    } finally {
      inFlight = false
    }
  }

  function start() {
    if (timer != null) return
    timer = setInterval(tick, TICK_MS)
    void tick()
  }

  const onActivity = () => start()
  app.api?.addEventListener?.(MCP_ACTIVITY_EVENT, onActivity)

  void (async () => {
    try {
      const status = await apiFetch('/comfytv/mcp_activity', ActivitySchema)
      if (status.active) start()
    } catch {
    }
  })()

  return () => {
    if (timer != null) clearInterval(timer)
    timer = null
    app.api?.removeEventListener?.(MCP_ACTIVITY_EVENT, onActivity)
    app.__comfytvCanvasMirrorInstalled = false
  }
}

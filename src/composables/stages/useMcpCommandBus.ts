import { z } from 'zod'

import { until } from '@vueuse/core'

import { apiSend } from '@/api'
import { handleArrangeCanvas } from '@/composables/stages/arrangeCanvas'
import {
  createNodeAt,
  findFirstAutogrowSlot,
  findNamedSlot,
} from '@/composables/stages/spawnFollowUp'
import { writeImageRefs, type ImageRef } from '@/composables/stages/imageRefs'
import {
  handleCanvasCommand,
  handleCanvasFocus,
  handleGraphEdit,
  handleGraphGet,
  handleGraphRun,
} from '@/composables/stages/mcpGraphCommands'
import { mentionSendOrders } from '@/composables/stages/imageSlotMentions'
import { isStageNode, findStageNode } from '@/composables/stages/mcpStageLookup'
import {
  handleDirectorEdit,
  handleDirectorGet,
  handleLayerCapture,
  handleLayerEdit,
  handleLayerGet,
  handleSceneCapture,
  handleSceneEdit,
  handleSceneGet,
  handleSceneRecord,
} from '@/composables/stages/mcpSubApiCommands'
import { claimStageUid, getStageUid } from '@/composables/stages/stageIdentity'
import { useAssetStore } from '@/stores/assetStore'
import { useStageStore } from '@/stores/stageStore'
import { getWidget, writeWidget } from '@/utils/widget'

const OkSchema = z.object({ ok: z.boolean() })

const COMMAND_EVENT = 'comfytv-mcp-command'
const RESULT_PATH = '/comfytv/mcp_command_result'

export { findStageNode } from '@/composables/stages/mcpStageLookup'

export interface McpCommandBusDeps {
  resolveApp: () => any
  resolveProjectId: () => string
}

function autoPos(graph: any): [number, number] {
  let anchor: any = null
  for (const node of graph?._nodes ?? []) {
    if (!isStageNode(node)) continue
    if (!anchor || (node.pos?.[0] ?? 0) > (anchor.pos?.[0] ?? 0)) anchor = node
  }
  if (!anchor) return [200, 200]
  return [
    (anchor.pos?.[0] ?? 0) + (anchor.size?.[0] ?? 280) + 80,
    anchor.pos?.[1] ?? 0,
  ]
}

function applyStageFields(node: any, cmd: any): string[] {
  const updated: string[] = []
  if (cmd.workflow != null) {
    if (!getWidget(node, 'workflow')) {
      throw new Error('this stage has no workflow selector')
    }
    writeWidget(node, 'workflow', String(cmd.workflow))
    updated.push('workflow')
  }
  if (cmd.prompt != null) {
    if (!getWidget(node, 'main_prompt')) {
      throw new Error('this stage has no prompt field')
    }
    writeWidget(node, 'main_prompt', String(cmd.prompt))
    const state = useStageStore().getStage(node)
    if (state) state.mainPrompt = String(cmd.prompt)
    updated.push('prompt')
  }
  if (cmd.title != null) {
    node.title = String(cmd.title)
    updated.push('title')
  }
  if (cmd.widgets != null) {
    if (typeof cmd.widgets !== 'object' || Array.isArray(cmd.widgets)) {
      throw new Error('widgets must be an object mapping widget name -> value')
    }
    for (const [name, value] of Object.entries(cmd.widgets)) {
      if (!getWidget(node, name)) {
        const names = (node.widgets ?? [])
          .map((w: any) => String(w?.name ?? '')).filter(Boolean).join(', ')
        throw new Error(`no widget '${name}' on this stage; widgets: ${names || '(none)'}`)
      }
      writeWidget(node, name, value)
      updated.push(`widgets.${name}`)
    }
  }
  if (cmd.server != null) {
    const raw = String(cmd.server).toLowerCase()
    node.properties = node.properties ?? {}
    node.properties.comfytv_server = raw === 'local' || raw === '' ? '' : String(cmd.server)
    updated.push('server')
  }
  if (cmd.asset_refs != null) {
    if (!Array.isArray(cmd.asset_refs)) {
      throw new Error('asset_refs must be an array of {asset_id, slot?, type?} objects')
    }
    const nextSlot = { image: 0, video: 0, audio: 0 }
    const refs: ImageRef[] = cmd.asset_refs.map((r: any, i: number) => {
      const id = Number(r?.asset_id)
      if (!Number.isInteger(id)) throw new Error(`asset_refs[${i}] needs a numeric asset_id`)
      const type = r?.type === 'video' || r?.type === 'audio' ? r.type : undefined
      const typeKey = (type ?? 'image') as 'image' | 'video' | 'audio'
      const slot = Number.isInteger(Number(r?.slot)) ? Number(r.slot) : nextSlot[typeKey]++
      return type ? { asset_id: id, slot, type } : { asset_id: id, slot }
    })
    writeImageRefs(node, refs)
    void useAssetStore().refresh()
    updated.push('asset_refs')
  }
  return updated
}

const MENTION_TOKEN_RE = /@(image|video|audio)_(\d+)(?![0-9a-zA-Z_-])/g

export function danglingMentionWarnings(node: any): string[] {
  const prompt = String(getWidget(node, 'main_prompt')?.value ?? '')
  if (!prompt.includes('@')) return []
  const orders = mentionSendOrders(node)
  const warnings: string[] = []
  const seen = new Set<string>()
  for (const m of prompt.matchAll(MENTION_TOKEN_RE)) {
    const type = m[1] as 'image' | 'video' | 'audio'
    const slot = Number(m[2])
    const key = `${type}_${slot}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!orders[type].includes(slot)) {
      warnings.push(
        `@${key} won't resolve and will expand to nothing — sendable ${type} `
        + `slots on this stage are [${orders[type].join(', ')}] (zero-based; `
        + 'wired inputs and asset_refs occupy slots in order)',
      )
    }
  }
  return warnings
}

function withMentionWarnings(node: any, result: CommandResult): CommandResult {
  const warnings = danglingMentionWarnings(node)
  return warnings.length ? { ...result, warnings } : result
}

function handleAddStage(app: any, cmd: any): CommandResult {
  const graph = app?.graph
  const pos: [number, number] =
    Array.isArray(cmd.pos) && cmd.pos.length === 2
      ? [Number(cmd.pos[0]), Number(cmd.pos[1])]
      : autoPos(graph)
  const node = createNodeAt(String(cmd.node_class), pos)
  if (!node) throw new Error(`could not create node ${cmd.node_class}`)
  claimStageUid(node)
  applyStageFields(node, cmd)
  graph?.setDirtyCanvas?.(true, true)
  return withMentionWarnings(node, {
    graph_node_id: String(node.id), uid: getStageUid(node),
  })
}

function handleSetStage(app: any, cmd: any): CommandResult {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const updated = applyStageFields(node, cmd)
  app?.graph?.setDirtyCanvas?.(true, true)
  return withMentionWarnings(node, {
    graph_node_id: String(node.id), uid: getStageUid(node), updated,
  })
}

function inputNames(node: any): string {
  return (node.inputs ?? []).map((i: any) => String(i?.name ?? '')).join(', ') || '(none)'
}

function handleConnectStages(app: any, cmd: any): CommandResult {
  const graph = app?.graph
  const src = findStageNode(graph, String(cmd.from_node))
  if (!src) throw new Error(`from_node ${cmd.from_node} not found on the canvas`)
  const dst = findStageNode(graph, String(cmd.to_node))
  if (!dst) throw new Error(`to_node ${cmd.to_node} not found on the canvas`)

  const fromSlot = Number(cmd.from_slot ?? 0)
  const out = src.outputs?.[fromSlot]
  if (!out) throw new Error(`from_node has no output slot ${fromSlot}`)

  let toSlot = -1
  if (cmd.to_slot != null) {
    const name = String(cmd.to_slot)
    toSlot = findNamedSlot(dst, name)
    if (toSlot < 0) toSlot = findFirstAutogrowSlot(dst, name)
    if (toSlot < 0) {
      throw new Error(`to_node has no input '${name}'; inputs: ${inputNames(dst)}`)
    }
  } else {
    const accepts = (inpType: unknown) =>
      inpType === '*'
      || String(inpType ?? '').split(',').includes(String(out.type))
    for (let i = 0; i < (dst.inputs?.length ?? 0); i++) {
      const inp = dst.inputs[i]
      if (inp?.link != null) continue
      if (accepts(inp?.type)) { toSlot = i; break }
    }
    if (toSlot < 0) {
      throw new Error(
        `no free input on to_node compatible with output type `
        + `${String(out.type)}; inputs: ${inputNames(dst)}`,
      )
    }
  }

  const link = src.connect(fromSlot, dst, toSlot)
  if (!link) throw new Error('the graph rejected the connection (type mismatch?)')
  graph?.setDirtyCanvas?.(true, true)
  return withMentionWarnings(dst, {
    from: String(src.id),
    to: String(dst.id),
    input: String(dst.inputs?.[toSlot]?.name ?? toSlot),
  })
}

const PREP_WAIT_MS = 15000

async function handleRunStage(app: any, cmd: any): Promise<CommandResult> {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const stageApi = (node as any).__comfytvStageApi
  if (!stageApi?.onRunRequest) {
    throw new Error('stage card is not mounted yet — cannot run')
  }
  if (stageApi.variant === 'loader') {
    throw new Error('loader stages have nothing to run — they only hold media')
  }
  if (stageApi.state?.running) throw new Error('stage is already running')
  await until(() => !!stageApi.state?.preparingWorkflow)
    .toBe(false, { timeout: PREP_WAIT_MS, throwOnTimeout: false })
  if (stageApi.state?.preparingWorkflow) {
    throw new Error(
      `workflow is still being prepared after ${PREP_WAIT_MS / 1000}s — retry run_stage shortly`)
  }
  await stageApi.onRunRequest()
  if (stageApi.state?.running) {
    return withMentionWarnings(node, {
      started: true, graph_node_id: String(node.id), uid: getStageUid(node),
    })
  }
  throw new Error(
    stageApi.state?.error?.message
    || 'the stage declined the run — usually a required upstream input has no output yet; check the card',
  )
}

type CommandResult = Record<string, unknown>

function handleRemoveStage(app: any, cmd: any): CommandResult {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const removed = { graph_node_id: String(node.id), uid: getStageUid(node) }
  app.graph.remove(node)
  app?.graph?.setDirtyCanvas?.(true, true)
  return { removed: true, ...removed }
}

async function handleCancelStage(app: any, cmd: any): Promise<CommandResult> {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const stageApi = (node as any).__comfytvStageApi
  if (!stageApi?.onCancelRequest) {
    throw new Error('stage card is not mounted yet — cannot cancel')
  }
  if (!stageApi.state?.running) throw new Error('stage is not running')
  await stageApi.onCancelRequest()
  return { cancelled: true, graph_node_id: String(node.id), uid: getStageUid(node) }
}

const _WIDGET_VALUE_CAP = 16000

function handleGetStage(app: any, cmd: any): CommandResult {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const links = app?.graph?.links ?? {}

  const widgets: Record<string, unknown> = {}
  for (const w of node.widgets ?? []) {
    const name = String(w?.name ?? '')
    if (!name) continue
    let v = (w as any).value
    if (typeof v === 'function' || v === undefined) continue
    if (typeof v === 'string' && v.length > _WIDGET_VALUE_CAP) {
      v = v.slice(0, _WIDGET_VALUE_CAP)
        + ` … [display truncated — full ${v.length}-char value is stored intact]`
    }
    widgets[name] = v
  }

  const inputs = (node.inputs ?? []).map((inp: any) => {
    const link = inp?.link != null ? links[inp.link] : null
    return {
      name: String(inp?.name ?? ''),
      type: String(inp?.type ?? ''),
      connected: inp?.link != null,
      ...(link?.origin_id != null ? { from_node: String(link.origin_id) } : {}),
    }
  })
  const outputs = (node.outputs ?? []).map((out: any) => {
    const targets = (out?.links ?? [])
      .map((id: any) => links[id]?.target_id)
      .filter((t: any) => t != null)
      .map((t: any) => String(t))
    return {
      name: String(out?.name ?? ''),
      type: String(out?.type ?? ''),
      to_nodes: targets,
    }
  })

  const stageApi = (node as any).__comfytvStageApi
  const result: CommandResult = {
    graph_node_id: String(node.id),
    uid: getStageUid(node),
    node_class: String(node.comfyClass ?? ''),
    title: String(node.title ?? ''),
    widgets,
    inputs,
    outputs,
    asset_refs: node.properties?.comfytv_image_refs ?? [],
    running: stageApi?.state?.running === true,
    pos: Array.isArray(node.pos) ? [Number(node.pos[0]), Number(node.pos[1])] : null,
  }
  return withMentionWarnings(node, result)
}

async function executeCommand(app: any, cmd: any): Promise<CommandResult> {
  switch (cmd.action) {
    case 'add_stage': return handleAddStage(app, cmd)
    case 'set_stage': return handleSetStage(app, cmd)
    case 'remove_stage': return handleRemoveStage(app, cmd)
    case 'scene_get': return handleSceneGet(app, cmd)
    case 'scene_edit': return handleSceneEdit(app, cmd)
    case 'scene_capture': return handleSceneCapture(app, cmd)
    case 'scene_record': return handleSceneRecord(app, cmd)
    case 'layer_get': return handleLayerGet(app, cmd)
    case 'layer_edit': return handleLayerEdit(app, cmd)
    case 'layer_capture': return handleLayerCapture(app, cmd)
    case 'director_get': return handleDirectorGet(app, cmd)
    case 'director_edit': return handleDirectorEdit(app, cmd)
    case 'connect_stages': return handleConnectStages(app, cmd)
    case 'run_stage': return handleRunStage(app, cmd)
    case 'cancel_stage': return handleCancelStage(app, cmd)
    case 'get_stage': return handleGetStage(app, cmd)
    case 'arrange_canvas': return handleArrangeCanvas(app, cmd)
    case 'graph_get': return handleGraphGet(app)
    case 'graph_edit': return handleGraphEdit(app, cmd)
    case 'graph_run': return handleGraphRun(app)
    case 'canvas_command': return handleCanvasCommand(app, cmd)
    case 'canvas_focus': return handleCanvasFocus(app, cmd)
    default: throw new Error(`unknown command action ${String(cmd.action)}`)
  }
}

export function installMcpCommandBus(app: any, deps: McpCommandBusDeps): (() => void) | false {
  if (app.__comfytvMcpCommandBusInstalled) return false
  app.__comfytvMcpCommandBusInstalled = true

  const onCommand = async (event: any) => {
    const cmd = event?.detail ?? event ?? {}
    if (!cmd.id || !cmd.action) return
    const a = deps.resolveApp()
    if (cmd.target_client_id && a?.api?.clientId
        && cmd.target_client_id !== a.api.clientId) return
    if (cmd.project_id && deps.resolveProjectId() !== cmd.project_id) return

    let body: CommandResult
    try {
      const result = await executeCommand(a, cmd)
      body = { command_id: cmd.id, ok: true, result }
    } catch (e) {
      body = {
        command_id: cmd.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
    try {
      await apiSend(RESULT_PATH, 'POST', OkSchema, body)
    } catch (e) {
      console.warn('[ComfyTV/mcp] failed to post command result', e)
    }
  }

  app.api?.addEventListener?.(COMMAND_EVENT, onCommand)

  return () => {
    app.api?.removeEventListener?.(COMMAND_EVENT, onCommand)
    app.__comfytvMcpCommandBusInstalled = false
  }
}

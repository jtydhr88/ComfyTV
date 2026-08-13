import { z } from 'zod'

import { apiSend } from '@/api'
import {
  createNodeAt,
  findFirstAutogrowSlot,
  findNamedSlot,
} from '@/composables/stages/spawnFollowUp'
import { writeImageRefs, type ImageRef } from '@/composables/stages/imageRefs'
import { claimStageUid, getStageUid } from '@/composables/stages/stageIdentity'
import { useStageStore } from '@/stores/stageStore'
import { getWidget, writeWidget } from '@/utils/widget'

const OkSchema = z.object({ ok: z.boolean() })

const COMMAND_EVENT = 'comfytv-mcp-command'
const RESULT_PATH = '/comfytv/mcp_command_result'

export interface McpCommandBusDeps {
  resolveApp: () => any
  resolveProjectId: () => string
}

function isStageNode(node: any): boolean {
  return String(node?.comfyClass ?? node?.type ?? '').startsWith('ComfyTV.')
}

export function findStageNode(graph: any, ref: string): any | null {
  for (const node of graph?._nodes ?? []) {
    if (isStageNode(node) && getStageUid(node) === ref) return node
  }
  const byId = graph?.getNodeById?.(Number(ref)) ?? graph?.getNodeById?.(ref)
  return byId && isStageNode(byId) ? byId : null
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
    const refs: ImageRef[] = cmd.asset_refs.map((r: any, i: number) => {
      const id = Number(r?.asset_id)
      if (!Number.isInteger(id)) throw new Error(`asset_refs[${i}] needs a numeric asset_id`)
      const slot = Number.isInteger(Number(r?.slot)) ? Number(r.slot) : i
      const type = r?.type === 'video' || r?.type === 'audio' ? r.type : undefined
      return type ? { asset_id: id, slot, type } : { asset_id: id, slot }
    })
    writeImageRefs(node, refs)
    updated.push('asset_refs')
  }
  return updated
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
  return { graph_node_id: String(node.id), uid: getStageUid(node) }
}

function handleSetStage(app: any, cmd: any): CommandResult {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const updated = applyStageFields(node, cmd)
  app?.graph?.setDirtyCanvas?.(true, true)
  return { graph_node_id: String(node.id), uid: getStageUid(node), updated }
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
  return {
    from: String(src.id),
    to: String(dst.id),
    input: String(dst.inputs?.[toSlot]?.name ?? toSlot),
  }
}

async function handleRunStage(app: any, cmd: any): Promise<CommandResult> {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const stageApi = (node as any).__comfytvStageApi
  if (!stageApi?.onRunRequest) {
    throw new Error('stage card is not mounted yet — cannot run')
  }
  if (stageApi.state?.running) throw new Error('stage is already running')
  await stageApi.onRunRequest()
  if (stageApi.state?.running) {
    return { started: true, graph_node_id: String(node.id), uid: getStageUid(node) }
  }
  throw new Error(
    stageApi.state?.error?.message
    || 'run did not start (loader stage, workflow still preparing, or upstream outputs missing)',
  )
}

type CommandResult = Record<string, unknown>

function sceneApi(app: any, cmd: any) {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const api = (node as any).__comfytvStageApi?.scene3d
  if (!api) {
    throw new Error(
      `stage ${cmd.node} is not a mounted Scene3D stage — scene tools need a `
      + 'ComfyTV.Scene3DStage whose card is open in the tab')
  }
  return api
}

async function handleSceneGet(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  const scene = api.getState()
  if (typeof api.clipNames === 'function') {
    const animated = [...(scene.characters ?? []), ...(scene.models ?? [])]
    for (const entry of animated) {
      try {
        entry.available_clips = await api.clipNames(entry.id)
      } catch {
        entry.available_clips = []
      }
    }
  }
  return {
    scene,
    resources: api.resources(),
    busy: api.isBusy(),
    has_recordable_duration: api.hasRecordableDuration(),
  }
}

async function handleSceneEdit(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  const results = await api.applyOps(cmd.ops)
  return { applied: results }
}

async function handleSceneCapture(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  api.configureOutput({
    channel: cmd.channel, width: cmd.width, height: cmd.height,
  })
  return await api.capture()
}

async function handleSceneRecord(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  api.configureOutput({
    channel: cmd.channel, width: cmd.width, height: cmd.height,
  })
  return await api.record()
}

function handleRemoveStage(app: any, cmd: any): CommandResult {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const removed = { graph_node_id: String(node.id), uid: getStageUid(node) }
  app.graph.remove(node)
  app?.graph?.setDirtyCanvas?.(true, true)
  return { removed: true, ...removed }
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
    case 'connect_stages': return handleConnectStages(app, cmd)
    case 'run_stage': return handleRunStage(app, cmd)
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

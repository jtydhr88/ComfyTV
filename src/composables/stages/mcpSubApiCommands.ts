import { findStageNode } from '@/composables/stages/mcpStageLookup'

type CommandResult = Record<string, unknown>

function stageSubApi(app: any, cmd: any, key: string, label: string) {
  const node = findStageNode(app?.graph, String(cmd.node))
  if (!node) throw new Error(`stage ${cmd.node} not found on the canvas`)
  const api = (node as any).__comfytvStageApi?.[key]
  if (!api) {
    throw new Error(
      `stage ${cmd.node} is not a mounted ${label} stage — these tools need `
      + `a ComfyTV.${label}Stage whose card is open in the tab`)
  }
  return api
}

function sceneApi(app: any, cmd: any) {
  return stageSubApi(app, cmd, 'scene3d', 'Scene3D')
}

function layerApi(app: any, cmd: any) {
  return stageSubApi(app, cmd, 'layerEditor', 'LayerEditor')
}

function directorApi(app: any, cmd: any) {
  return stageSubApi(app, cmd, 'director', 'Director')
}

export async function handleLayerGet(app: any, cmd: any): Promise<CommandResult> {
  const api = layerApi(app, cmd)
  const out: CommandResult = { document: api.getState(), busy: api.isBusy() }
  if (cmd.resources !== false) out.resources = api.resources()
  return out
}

export async function handleLayerEdit(app: any, cmd: any): Promise<CommandResult> {
  const api = layerApi(app, cmd)
  if (api.isBusy()) throw new Error('layer editor is busy capturing or importing/exporting — retry after it finishes')
  const applied = await api.applyOps(cmd.ops)
  return { applied, document: api.getState() }
}

export async function handleLayerCapture(app: any, cmd: any): Promise<CommandResult> {
  const api = layerApi(app, cmd)
  if (api.isBusy()) throw new Error('layer editor is busy capturing or importing/exporting — retry after it finishes')
  return cmd.mode === 'batch' ? await api.captureBatch() : await api.capture()
}

export async function handleDirectorGet(app: any, cmd: any): Promise<CommandResult> {
  return directorApi(app, cmd).getState()
}

export async function handleDirectorEdit(app: any, cmd: any): Promise<CommandResult> {
  const out = await directorApi(app, cmd).applyOps(cmd.ops)
  return { applied: out.results }
}

export async function handleSceneGet(app: any, cmd: any): Promise<CommandResult> {
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

export async function handleSceneEdit(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  const results = await api.applyOps(cmd.ops)
  return { applied: results }
}

export async function handleSceneCapture(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  api.configureOutput({
    channel: cmd.channel, width: cmd.width, height: cmd.height,
    layers: cmd.layers,
  })
  return await api.capture()
}

export async function handleSceneRecord(app: any, cmd: any): Promise<CommandResult> {
  const api = sceneApi(app, cmd)
  if (api.isBusy()) throw new Error('scene is busy capturing/recording — retry after it finishes')
  api.configureOutput({
    channel: cmd.channel, width: cmd.width, height: cmd.height,
    layers: cmd.layers,
  })
  return await api.record()
}

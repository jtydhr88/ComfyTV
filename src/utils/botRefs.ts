import { getStageUid, stageClassName } from '@/composables/stages/stageIdentity'
import { app } from '@/lib/comfyApp'

export interface BotRef {
  kind: 'stage' | 'asset'
  uid?: string
  graph_node_id?: string
  stage_class?: string
  title?: string
  asset_id?: number
  name?: string
  media_type?: string
}

function stageToRef(node: any): BotRef {
  return {
    kind: 'stage',
    uid: getStageUid(node),
    graph_node_id: String(node.id),
    stage_class: stageClassName(node),
    title: String(node.title ?? '') || stageClassName(node),
  }
}

function isStageNode(node: any): boolean {
  return String(node?.comfyClass ?? node?.type ?? '').startsWith('ComfyTV.')
}

export function listCanvasStages(): BotRef[] {
  const nodes = (app as any)?.graph?._nodes ?? []
  return nodes.filter(isStageNode).map(stageToRef)
}

export function selectedCanvasStages(): BotRef[] {
  const raw = (app as any)?.canvas?.selected_nodes
  if (!raw) return []
  const nodes: any[] = typeof raw[Symbol.iterator] === 'function'
    ? Array.from(raw as Iterable<any>)
    : Object.values(raw)
  return nodes.filter(isStageNode).map(stageToRef)
}

export function refKey(ref: BotRef): string {
  return ref.kind === 'stage'
    ? `stage:${ref.uid || ref.graph_node_id}`
    : `asset:${ref.asset_id}`
}

export function refLabel(ref: BotRef): string {
  if (ref.kind === 'stage') return ref.title || ref.stage_class || 'stage'
  return ref.name || `#${ref.asset_id}`
}

export function refIcon(ref: BotRef): string {
  if (ref.kind === 'stage') return 'pi-stop'
  if (ref.media_type === 'video') return 'pi-video'
  if (ref.media_type === 'audio') return 'pi-volume-up'
  return 'pi-image'
}

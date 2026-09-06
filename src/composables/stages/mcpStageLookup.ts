import { getStageUid } from '@/composables/stages/stageIdentity'

export function isStageNode(node: any): boolean {
  return String(node?.comfyClass ?? node?.type ?? '').startsWith('ComfyTV.')
}

export function findStageNode(graph: any, ref: string): any | null {
  for (const node of graph?._nodes ?? []) {
    if (isStageNode(node) && getStageUid(node) === ref) return node
  }
  const byId = graph?.getNodeById?.(Number(ref)) ?? graph?.getNodeById?.(ref)
  return byId && isStageNode(byId) ? byId : null
}

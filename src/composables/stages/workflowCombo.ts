import { ref } from 'vue'

import { listFavoriteWorkflows } from '@/api'
import { getStageMeta } from '@/composables/stages/stageMeta'
import { app } from '@/lib/comfyApp'

export const comboOptionsVersion = ref(0)

const favoriteWorkflows = ref<Record<string, string[]>>({})

export async function loadFavoriteWorkflows(): Promise<void> {
  favoriteWorkflows.value = (await listFavoriteWorkflows()).favorites
}

export function lastFavoriteOption(kind: string, options: string[]): string | undefined {
  const favorites = favoriteWorkflows.value[kind] ?? []
  let last: string | undefined
  for (const option of options) {
    if (!favorites.includes(option)) break
    last = option
  }
  return last
}

function workflowWidgetsForKind(kind: string): any[] {
  const out: any[] = []
  const nodes = (app as any)?.graph?._nodes ?? []
  for (const n of nodes) {
    if (getStageMeta(n?.comfyClass)?.workflow_kind !== kind) continue
    const w = n.widgets?.find((x: any) => x.name === 'workflow')
    if (w) out.push(w)
  }
  return out
}

function defWorkflowSpecsForKind(kind: string): any[] {
  const reg = (window as any).LiteGraph?.registered_node_types ?? {}
  const out: any[] = []
  for (const [name, cls] of Object.entries<any>(reg)) {
    if (getStageMeta(name)?.workflow_kind !== kind) continue
    const nd = (cls as any)?.nodeData
    for (const spec of [
      nd?.inputs?.workflow,
      nd?.input?.required?.workflow?.[1],
      nd?.input?.optional?.workflow?.[1],
    ]) {
      if (spec && Array.isArray(spec.options) && !out.includes(spec)) out.push(spec)
    }
  }
  return out
}

export function addOptionEverywhere(kind: string, label: string): void {
  for (const w of workflowWidgetsForKind(kind)) {
    const vals = w.options?.values
    if (Array.isArray(vals) && !vals.includes(label)) vals.push(label)
  }
  for (const spec of defWorkflowSpecsForKind(kind)) {
    if (!spec.options.includes(label)) spec.options.push(label)
  }
  comboOptionsVersion.value++
}

export function removeOptionEverywhere(kind: string, label: string, reassignValue = true): void {
  for (const w of workflowWidgetsForKind(kind)) {
    const vals = w.options?.values
    if (Array.isArray(vals)) {
      const idx = vals.indexOf(label)
      if (idx > -1) vals.splice(idx, 1)
      if (reassignValue && w.value === label) {
        const next = vals[0] ?? ''
        w.value = next
        w.callback?.(next)
      }
    }
  }
  for (const spec of defWorkflowSpecsForKind(kind)) {
    const idx = spec.options.indexOf(label)
    if (idx > -1) spec.options.splice(idx, 1)
    if (spec.default === label) spec.default = spec.options[0] ?? ''
  }
  comboOptionsVersion.value++
  ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
}

export function setDefaultOptionInDefs(kind: string, label: string | null): void {
  for (const spec of defWorkflowSpecsForKind(kind)) {
    spec.default = label ?? spec.options[0] ?? ''
  }
}

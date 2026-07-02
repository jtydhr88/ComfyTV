import { getStageMeta } from '@/composables/stages/stageMeta'
import { app } from '@/lib/comfyApp'

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

export function addOptionEverywhere(kind: string, label: string): void {
  for (const w of workflowWidgetsForKind(kind)) {
    const vals = w.options?.values
    if (Array.isArray(vals) && !vals.includes(label)) vals.push(label)
  }
}

export function removeOptionEverywhere(kind: string, label: string): void {
  for (const w of workflowWidgetsForKind(kind)) {
    const vals = w.options?.values
    if (Array.isArray(vals)) {
      const idx = vals.indexOf(label)
      if (idx > -1) vals.splice(idx, 1)
      if (w.value === label) {
        const next = vals[0] ?? ''
        w.value = next
        w.callback?.(next)
      }
    }
  }
  ;(app as any)?.graph?.setDirtyCanvas?.(true, true)
}

const COMFYTV_PREFIX = 'ComfyTV.'
const OUT_BRIDGE_PREFIX = 'ComfyTV.BridgeFrom'

export function isComfyTVClass(classType: string): boolean {
  return classType.startsWith(COMFYTV_PREFIX)
}

export function isOutBridgeClass(classType: string): boolean {
  return classType.startsWith(OUT_BRIDGE_PREFIX)
}

export interface GlobalRunRewriteDeps {
  getSnapshot: (originId: string, slot: number) => string | null | undefined
}

export interface GlobalRunRewriteResult {
  output: Record<string, any>
  missing: string[]
}

export function rewriteGlobalRunOutput(
  output: Record<string, any>,
  { getSnapshot }: GlobalRunRewriteDeps,
): GlobalRunRewriteResult {
  const missing: string[] = []
  const kept: Record<string, any> = {}

  for (const [id, node] of Object.entries(output)) {
    const ct = String(node?.class_type ?? '')
    if (isComfyTVClass(ct) && !isOutBridgeClass(ct)) continue
    kept[id] = node
  }

  for (const [id, node] of Object.entries(kept)) {
    if (!isOutBridgeClass(String(node?.class_type ?? ''))) continue
    const inputs = node?.inputs
    if (!inputs || typeof inputs !== 'object') continue

    let clonedInputs: Record<string, any> | null = null
    for (const key of Object.keys(inputs)) {
      const val = inputs[key]
      if (!Array.isArray(val) || val.length !== 2) continue
      const originId = String(val[0])
      const originSlot = Number(val[1]) || 0
      const snap = getSnapshot(originId, originSlot)
      if (snap != null && snap !== '') {
        const target = clonedInputs ?? (clonedInputs = { ...inputs })
        target[key] = snap
      } else {
        const label = String(node?._meta?.title || node?.class_type || `#${id}`)
        missing.push(`${label} (#${id})`)
      }
    }
    if (clonedInputs) kept[id] = { ...node, inputs: clonedInputs }
  }

  return { output: kept, missing }
}

interface StageSnapshotSource {
  getStage: (node: any) => { output: string | null; outputs: (string | null)[] } | undefined
}

export interface InstallGlobalRunBridgeDeps {
  resolveStore: () => StageSnapshotSource
  toast: (opts: { severity: string; summary: string; detail: string; life: number }) => void
  t: (key: string, params?: Record<string, unknown>) => string
}

export function installGlobalRunBridge(app: any, deps: InstallGlobalRunBridgeDeps): boolean {
  if (app.__comfytvQueuePatched || typeof app.api?.queuePrompt !== 'function') return false
  app.__comfytvQueuePatched = true

  const origQueue = app.api.queuePrompt.bind(app.api)
  app.api.queuePrompt = async (number: number, data: any, options: any = {}) => {
    if (data?.__comfytvOwnRun) {
      if (data && typeof data === 'object') delete data.__comfytvOwnRun
      return origQueue(number, data, options)
    }
    const isGlobalRun = !options?.partialExecutionTargets?.length
    if (isGlobalRun && data?.output) {
      const store = deps.resolveStore()
      const getSnapshot = (originId: string, slot: number) => {
        const gn = app.graph?.getNodeById?.(Number(originId))
                ?? app.graph?.getNodeById?.(String(originId))
        const st = gn ? store.getStage(gn) : undefined
        if (!st) return null
        const slotted = st.outputs?.[slot]
        if (slotted != null) return slotted
        if (slot === 0 && st.output) return st.output
        return null
      }

      const { output: rewritten, missing } = rewriteGlobalRunOutput(data.output, { getSnapshot })

      if (missing.length > 0) {
        deps.toast({
          severity: 'warn',
          summary: deps.t('error.upstreamNotReady'),
          detail: deps.t('error.upstreamNotReadyDetail', { list: [...new Set(missing)].join(', ') }),
          life: 6000,
        })
        return { prompt_id: '', number, node_errors: {} }
      }

      if (Object.keys(rewritten).length === 0) {
        deps.toast({
          severity: 'info',
          summary: 'ComfyTV',
          detail: deps.t('run.stagesRunPerNode'),
          life: 4000,
        })
        return { prompt_id: '', number, node_errors: {} }
      }

      data = { ...data, output: rewritten }
    }
    return origQueue(number, data, options)
  }
  return true
}

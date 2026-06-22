import { defineStore } from 'pinia'
import { ref } from 'vue'

import { apiFetch, apiSend } from '@/api'
import {
  type StageParam,
  ListStageParamsSchema,
  MutateStageParamSchema,
  OkSchema,
} from '@/api/schemas'
import { reloadCaps } from '@/composables/sidebar/workflowConfigCatalog'
import { app } from '@/lib/comfyApp'

export interface CreateStageParamOpts {
  kind: string
  label: string
  type: string
  default?: unknown
  config?: Record<string, unknown>
}

export interface UpdateStageParamOpts {
  label?: string
  type?: string
  default?: unknown
  config?: Record<string, unknown>
  order?: number
}

export const useStageParamStore = defineStore('stageParams', () => {
  const params = ref<StageParam[]>([])

  let hydrating: 'in-flight' | 'fetched' | null = null
  let hydratePromise: Promise<void> | null = null
  let wsInstalled = false

  function _hydrate(): Promise<void> {
    if (hydrating === 'fetched') return Promise.resolve()
    if (hydrating === 'in-flight' && hydratePromise) return hydratePromise
    hydrating = 'in-flight'
    hydratePromise = (async () => {
      try {
        const data = await apiFetch('/comfytv/stage_params', ListStageParamsSchema)
        params.value = data.params
        hydrating = 'fetched'
      } catch (e) {
        console.warn('[ComfyTV/stage-params] hydrate failed', e)
        hydrating = null
      } finally {
        hydratePromise = null
      }
    })()
    return hydratePromise
  }

  function ensureHydrated(): void {
    if (!hydrating) void _hydrate()
  }

  function hydrate(): Promise<void> {
    return _hydrate()
  }

  async function refresh(): Promise<void> {
    hydrating = null
    await _hydrate()
  }

  function forKind(kind: string): StageParam[] {
    return params.value
      .filter(p => p.kind === kind)
      .sort((a, b) => a.order - b.order || a.id - b.id)
  }

  function byKey(kind: string, key: string): StageParam | undefined {
    return params.value.find(p => p.kind === kind && p.key === key)
  }

  async function create(opts: CreateStageParamOpts): Promise<StageParam | null> {
    try {
      const data = await apiSend('/comfytv/stage_params', 'POST', MutateStageParamSchema, opts)
      params.value = [...params.value, data.param]
      return data.param
    } catch (e) {
      console.warn('[ComfyTV/stage-params] create failed', opts.label, e)
      return null
    }
  }

  async function update(id: number, patch: UpdateStageParamOpts): Promise<StageParam | null> {
    try {
      const data = await apiSend(`/comfytv/stage_params/${id}`, 'PATCH', MutateStageParamSchema, patch)
      params.value = params.value.map(p => (p.id === id ? data.param : p))
      return data.param
    } catch (e) {
      console.warn('[ComfyTV/stage-params] update failed', id, e)
      return null
    }
  }

  async function remove(id: number): Promise<void> {
    params.value = params.value.filter(p => p.id !== id)
    try {
      await apiSend(`/comfytv/stage_params/${id}`, 'DELETE', OkSchema)
    } catch (e) {
      console.warn('[ComfyTV/stage-params] delete failed', id, e)
    }
  }

  function installWebSocketSync(): void {
    if (wsInstalled) return
    const api = (app as any)?.api
    if (!api?.addEventListener) return
    wsInstalled = true
    api.addEventListener('comfytv-stage-params', () => {
      void refresh()
      void reloadCaps()
    })
  }

  return {
    params,
    ensureHydrated,
    hydrate,
    refresh,
    forKind,
    byKey,
    create,
    update,
    remove,
    installWebSocketSync,
  }
})

import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { duplicateWorkflow, fetchWorkflowConfig, saveCustomIo } from '@/api'
import type { ConfigPayload } from '@/composables/sidebar/workflowConfigCatalog'
import { prepareWorkflow } from '@/composables/stages/useWorkflowPrep'
import { invalidateWorkflowInfo } from '@/composables/stages/useWorkflowValidator'
import { useSelectionStore } from '@/stores/selectionStore'
import { type CustomIo, emptyCustomIo, parseCustomIo } from '@/v2/customIo'

export const CUSTOM_KIND = 'custom'

export interface CustomIoEntry {
  label: string
  config: ConfigPayload | null
  io: CustomIo
  loading: boolean
  error: string | null
  version: number
}

export const useCustomIoStore = defineStore('comfytv-custom-io', () => {
  const entries = reactive<Record<string, CustomIoEntry>>({})
  const inflight = new Map<string, Promise<CustomIoEntry>>()

  function entry(label: string): CustomIoEntry {
    return (entries[label] ??= {
      label, config: null, io: emptyCustomIo(), loading: false, error: null, version: 0,
    })
  }

  async function load(label: string, force = false): Promise<CustomIoEntry> {
    const e = entry(label)
    if (!label) return e
    if (!force && (e.config || inflight.has(label))) return inflight.get(label) ?? e
    e.loading = true
    e.error = null
    const p = (async () => {
      try {
        try { await prepareWorkflow(CUSTOM_KIND, label) } catch {}
        const cfg = await fetchWorkflowConfig(CUSTOM_KIND, label)
        e.config = cfg as ConfigPayload
        e.io = parseCustomIo(cfg.meta)
        e.version++
      } catch (err: any) {
        e.error = String(err?.message || err || 'load failed')
      } finally {
        e.loading = false
        inflight.delete(label)
      }
      return e
    })()
    inflight.set(label, p)
    return p
  }

  async function save(label: string, io: CustomIo): Promise<CustomIoEntry> {
    const e = entry(label)
    if (!e.config) throw new Error('workflow config not loaded')
    const res = await saveCustomIo(e.config.id, {
      inputs: io.inputs.map(it => ({
        node: it.node, input: it.input, kind: it.kind, label: it.label,
        required: it.required, ptype: it.ptype, props: it.props, default: it.default,
        prompt: it.prompt,
        random: it.random,
      })),
      outputs: io.outputs.map(o => ({ node: o.node, kind: o.kind, label: o.label })),
    })
    e.config = res.config as ConfigPayload
    e.io = parseCustomIo(res.config.meta)
    e.version++
    invalidateWorkflowInfo()
    useSelectionStore().bumpBindings()
    return e
  }

  async function saveAs(label: string, newLabel: string, io: CustomIo): Promise<CustomIoEntry> {
    const src = entry(label)
    if (!src.config) throw new Error('workflow config not loaded')
    const res = await duplicateWorkflow(src.config.id, newLabel)
    const e = entry(res.config.label)
    e.config = res.config as ConfigPayload
    e.io = parseCustomIo(res.config.meta)
    e.version++
    return save(e.label, io)
  }

  return { entries, entry, load, save, saveAs }
})

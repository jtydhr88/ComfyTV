import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { StageParam } from '@/api/schemas'
import { getStageMeta } from '@/composables/stages/stageMeta'
import type { LGraphNode } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'
import { useStageParamStore } from '@/stores/stageParamStore'
import { bindWidgetCallback, getWidget, readWidgetStr, writeWidget } from '@/utils/widget'

export interface ParamItem {
  key: string
  value: unknown
}

export function parseParamItems(raw: string): ParamItem[] {
  try {
    const data = JSON.parse(raw)
    const arr = data?.items
    return Array.isArray(arr)
      ? arr
        .filter((x: any) => x && typeof x.key === 'string')
        .map((x: any) => ({ key: x.key, value: x.value }))
      : []
  } catch {
    return []
  }
}

export function serializeParamItems(items: ParamItem[]): string {
  return JSON.stringify({ items })
}

export function comboOptionsOf(d: StageParam | undefined): string[] {
  const opts = d?.config?.options
  return Array.isArray(opts) ? opts.map(o => String(o)) : []
}

export function defaultParamValue(d: StageParam): unknown {
  if (d.default != null) return d.default
  switch (d.type) {
    case 'boolean': return false
    case 'int':
    case 'float':   return 0
    case 'combo':   return comboOptionsOf(d)[0] ?? ''
    default:        return ''
  }
}

export function useCustomParams(node: LGraphNode, getState: () => StageState) {
  const store = useStageParamStore()
  const menuOpen = ref(false)
  const items = ref<ParamItem[]>([])

  const paramKind = computed(() =>
    getStageMeta(node.comfyClass ?? '')?.workflow_kind || getState().kind)
  const hasWidget = computed(() => !!getWidget(node, 'custom_params'))
  const defs = computed(() => store.forKind(paramKind.value).filter(d => d.origin !== 0))

  const attached = computed(() =>
    items.value.filter(it => defs.value.some(d => d.key === it.key)))
  const available = computed(() =>
    defs.value.filter(d => !items.value.some(it => it.key === d.key)))

  function defByKey(key: string): StageParam | undefined {
    return defs.value.find(d => d.key === key)
  }
  function defLabel(key: string): string { return defByKey(key)?.label ?? key }
  function defType(key: string): string { return defByKey(key)?.type ?? 'string' }
  function cfg(key: string): Record<string, unknown> { return defByKey(key)?.config ?? {} }
  function cfgNum(key: string, k: string): number | undefined {
    const v = cfg(key)[k]
    return typeof v === 'number' ? v : undefined
  }
  function cfgStr(key: string, k: string): string | undefined {
    const v = cfg(key)[k]
    return typeof v === 'string' ? v : undefined
  }
  function numVal(v: unknown): number | null {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  function useSlider(key: string): boolean {
    return defType(key) === 'int'
      && cfgNum(key, 'min') !== undefined
      && cfgNum(key, 'max') !== undefined
  }
  function comboOptions(key: string): string[] {
    return comboOptionsOf(defByKey(key))
  }

  function readItems(): ParamItem[] {
    return parseParamItems(readWidgetStr(node, 'custom_params', '{}'))
  }

  function persist(): void {
    writeWidget(node, 'custom_params', serializeParamItems(items.value))
  }

  function attach(d: StageParam): void {
    menuOpen.value = false
    if (items.value.some(it => it.key === d.key)) return
    items.value = [...items.value, { key: d.key, value: defaultParamValue(d) }]
    persist()
  }

  function detach(key: string): void {
    items.value = items.value.filter(it => it.key !== key)
    persist()
  }

  function setVal(key: string, value: unknown): void {
    items.value = items.value.map(it => (it.key === key ? { ...it, value } : it))
    persist()
  }

  function closeMenu(): void { menuOpen.value = false }

  onMounted(async () => {
    store.ensureHydrated()
    store.installWebSocketSync()
    await store.hydrate()
    items.value = readItems()
    bindWidgetCallback(node, 'custom_params', () => { items.value = readItems() })
    window.addEventListener('click', closeMenu)
  })
  onBeforeUnmount(() => window.removeEventListener('click', closeMenu))

  return {
    menuOpen,
    items,
    hasWidget,
    defs,
    attached,
    available,
    defLabel,
    defType,
    cfg,
    cfgNum,
    cfgStr,
    numVal,
    useSlider,
    comboOptions,
    attach,
    detach,
    setVal,
  }
}

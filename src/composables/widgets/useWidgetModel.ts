import { computed, ref, type WritableComputedRef } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import {
  bindWidgetCallback, getWidget, onNodeConfigure,
  readWidgetNum, readWidgetStr, writeWidget,
} from '@/utils/widget'

export function useNumWidget(
  node: LGraphNode,
  name: string,
  fallback: number,
): WritableComputedRef<number> {
  const local = ref(readWidgetNum(node, name, fallback))
  bindWidgetCallback(node, name, (value) => {
    const v = Number(value)
    if (Number.isFinite(v) && v !== local.value) local.value = v
  })
  onNodeConfigure(node, () => {
    local.value = readWidgetNum(node, name, local.value)
  })
  return computed({
    get: () => local.value,
    set: (v: number) => {
      if (!Number.isFinite(v)) return
      local.value = v
      writeWidget(node, name, v)
    },
  })
}

export function useStrWidget(
  node: LGraphNode,
  name: string,
  fallback: string,
): WritableComputedRef<string> {
  const local = ref(readWidgetStr(node, name, fallback))
  bindWidgetCallback(node, name, (value) => {
    const v = String(value ?? '')
    if (v !== local.value) local.value = v
  })
  onNodeConfigure(node, () => {
    local.value = readWidgetStr(node, name, local.value)
  })
  return computed({
    get: () => local.value,
    set: (v: string) => {
      local.value = v
      writeWidget(node, name, v)
    },
  })
}

export function useBoolWidget(
  node: LGraphNode,
  name: string,
  fallback: boolean,
): WritableComputedRef<boolean> {
  const local = ref(Boolean(getWidget(node, name)?.value ?? fallback))
  bindWidgetCallback(node, name, (value) => {
    const v = Boolean(value)
    if (v !== local.value) local.value = v
  })
  onNodeConfigure(node, () => {
    local.value = Boolean(getWidget(node, name)?.value ?? local.value)
  })
  return computed({
    get: () => local.value,
    set: (v: boolean) => {
      local.value = v
      writeWidget(node, name, v)
    },
  })
}

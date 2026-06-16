import type { IBaseWidget, LGraphNode } from '@/lib/comfyApp'

type MaybeNode = LGraphNode | null | undefined

export function getWidget(node: MaybeNode, name: string): IBaseWidget | undefined {
  return node?.widgets?.find((w) => w.name === name)
}

export function applyHiddenWidgetFlags(node: MaybeNode): void {
  for (const w of node?.widgets ?? []) {
    if (w.options?.hidden) w.hidden = true
  }
}

export function readWidgetStr(node: MaybeNode, name: string, fallback: string): string {
  const w = getWidget(node, name)
  if (!w) return fallback
  const v = String(w.value ?? '')
  return v || fallback
}

export function readWidgetNum(node: MaybeNode, name: string, fallback: number): number {
  const w = getWidget(node, name)
  if (!w) return fallback
  const n = Number(w.value)
  return Number.isFinite(n) ? n : fallback
}

export function writeWidget(
  node: MaybeNode,
  name: string,
  value: unknown,
  opts?: { fireCallback?: boolean },
): void {
  const w = getWidget(node, name)
  if (!w) return
  if (w.value === value) return
  w.value = value as IBaseWidget['value']
  if (opts?.fireCallback === false) return
  w.callback?.(value)
}

export function bindWidgetCallback(
  node: MaybeNode,
  name: string,
  apply: (value: unknown) => void,
): void {
  const w = getWidget(node, name)
  if (!w) return
  const orig = w.callback
  w.callback = (value: unknown) => {
    orig?.call(w, value)
    apply(value)
  }
}

export function onNodeConfigure(node: MaybeNode, cb: () => void): void {
  if (!node) return
  const n = node as { onConfigure?: (info: unknown) => void }
  const orig = n.onConfigure
  n.onConfigure = function (this: unknown, info: unknown) {
    orig?.call(this, info)
    cb()
  }
}

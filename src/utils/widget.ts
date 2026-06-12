import type { IBaseWidget, LGraphNode } from '@/lib/comfyApp'

type MaybeNode = LGraphNode | null | undefined

export function getWidget(node: MaybeNode, name: string): IBaseWidget | undefined {
  return node?.widgets?.find((w) => w.name === name)
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

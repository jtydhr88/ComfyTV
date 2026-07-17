import { computed, ref, watch, type Ref } from 'vue'
import type { LGraphNode } from '@/lib/comfyApp'
import { parseOrder, reconcileOrder } from '@/composables/stages/videoConcatOrder'
import type { VideoClip } from '@/composables/stages/videoClipInputs'
import { bindWidgetCallback, onNodeConfigure, readWidgetStr, writeWidget } from '@/utils/widget'

export function useClipReorder(
  node: LGraphNode,
  opts: { clips: Ref<VideoClip[]>; stripEl: Ref<HTMLDivElement | null> },
) {
  const { clips, stripEl } = opts

  const order = ref<string[]>(parseOrder(readWidgetStr(node, 'clip_order', '')))

  function reconcile(saved: string[], current: VideoClip[]): string[] {
    return reconcileOrder(saved, current.map(c => c.key))
  }

  watch(clips, (v) => {
    const next = reconcile(order.value, v)
    if (next.join() !== order.value.join()) order.value = next
  }, { immediate: true })

  watch(order, (v) => {
    writeWidget(node, 'clip_order', JSON.stringify(v))
  })

  bindWidgetCallback(node, 'clip_order', (value) => {
    const parsed = reconcile(parseOrder(String(value ?? '')), clips.value)
    if (parsed.join() !== order.value.join()) order.value = parsed
  })

  onNodeConfigure(node, () => {
    const restored = reconcile(parseOrder(readWidgetStr(node, 'clip_order', '')), clips.value)
    if (restored.join() !== order.value.join()) order.value = restored
  })

  const orderedClips = computed<VideoClip[]>(() => {
    const byKey = new Map(clips.value.map(c => [c.key, c]))
    return order.value.map(k => byKey.get(k)).filter((c): c is VideoClip => !!c)
  })

  const dragKey = ref<string | null>(null)
  const dragClip = computed(() => orderedClips.value.find(c => c.key === dragKey.value) ?? null)
  const dragTargetIdx = computed(() => orderedClips.value.findIndex(c => c.key === dragKey.value))

  const cloneX = ref(0)
  const cloneY = ref(0)
  const cloneW = ref(128)
  const cloneH = ref(72)
  let grabDX = 0
  let grabDY = 0

  function tileTargetIndex(clientX: number): number {
    const strip = stripEl.value
    if (!strip) return 0
    const rect = strip.getBoundingClientRect()
    const tiles = orderedClips.value.length
    if (tiles === 0 || rect.width === 0) return 0
    const first = strip.firstElementChild as HTMLElement | null
    const scale = first && first.offsetWidth > 0
      ? first.getBoundingClientRect().width / first.offsetWidth
      : 1
    const tileW = (first ? first.offsetWidth + 6 : 134) * scale
    const x = clientX - rect.left + strip.scrollLeft * scale
    return Math.min(tiles - 1, Math.max(0, Math.floor(x / tileW)))
  }

  function onTileDown(e: PointerEvent, idx: number): void {
    const clip = orderedClips.value[idx]
    if (!clip) return
    const tile = e.currentTarget as HTMLElement
    const rect = tile.getBoundingClientRect()
    dragKey.value = clip.key
    cloneW.value = rect.width
    cloneH.value = rect.height
    grabDX = e.clientX - rect.left
    grabDY = e.clientY - rect.top
    cloneX.value = rect.left
    cloneY.value = rect.top
    tile.setPointerCapture?.(e.pointerId)
  }

  function onTileMove(e: PointerEvent): void {
    if (dragKey.value == null) return
    cloneX.value = e.clientX - grabDX
    cloneY.value = e.clientY - grabDY

    const from = dragTargetIdx.value
    const target = tileTargetIndex(e.clientX)
    if (from < 0 || target === from) return
    const next = [...order.value]
    const [moved] = next.splice(from, 1)
    next.splice(target, 0, moved)
    order.value = next
  }

  function onTileUp(): void {
    dragKey.value = null
  }

  return {
    order,
    orderedClips,
    dragKey,
    dragClip,
    dragTargetIdx,
    cloneX,
    cloneY,
    cloneW,
    cloneH,
    tileTargetIndex,
    onTileDown,
    onTileMove,
    onTileUp,
  }
}

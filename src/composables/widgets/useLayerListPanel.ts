import { computed, ref } from 'vue'

import type { Asset } from '@/api/schemas'
import type { LayerEditorController } from '@/composables/widgets/useLayerEditorStage'
import { computeFit } from '@/composables/widgets/useVideoViewport'
import { t } from '@/i18n'
import {
  ADJUST_PARAM_DEFS,
  LAYER_MODES,
  paintFillInto,
  type AdjustmentOp,
  type BlendFn,
  type FillData,
  type FillSpec,
  type GradientStop,
  type RasterData,
  type SceneNode,
  type VectorData,
} from '@/widgets/layerEditor/engine'
import type { LayerRow } from '@/widgets/layerEditor/types'

const ADJUST_OPS: AdjustmentOp[] = ['brightness-contrast', 'hue-saturation', 'invert']

export const ARTBOARD_MIN = 64
export const ARTBOARD_MAX = 4096

export const BLEND_KEYS: Record<string, string> = {
  normal: 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
  darken: 'darken', lighten: 'lighten', 'color-dodge': 'colorDodge', 'color-burn': 'colorBurn',
  'hard-light': 'hardLight', 'soft-light': 'softLight', difference: 'difference', exclusion: 'exclusion',
  'linear-dodge': 'linearDodge', 'linear-burn': 'linearBurn', 'vivid-light': 'vividLight',
  'pin-light': 'pinLight', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
}

export function clampArtboard(v: number): number | null {
  const rounded = Math.round(v)
  if (!Number.isFinite(rounded)) return null
  return Math.min(ARTBOARD_MAX, Math.max(ARTBOARD_MIN, rounded))
}

export type DropPos = 'above' | 'below' | 'into'

export function dropPositionFor(isGroup: boolean, ratio: number): DropPos {
  if (isGroup) {
    if (ratio < 0.25) return 'above'
    if (ratio > 0.75) return 'below'
    return 'into'
  }
  return ratio < 0.5 ? 'above' : 'below'
}

export function buildDisplayRows(rows: LayerRow[], collapsed: Set<string>): LayerRow[] {
  const byParent = new Map<string | undefined, LayerRow[]>()
  for (const row of rows) {
    const list = byParent.get(row.parentId)
    if (list) list.push(row)
    else byParent.set(row.parentId, [row])
  }
  const walk = (parentId: string | undefined): LayerRow[] => {
    const siblings = [...(byParent.get(parentId) ?? [])].reverse()
    return siblings.flatMap((row) =>
      row.node.kind === 'group' && !collapsed.has(row.node.id) ? [row, ...walk(row.node.id)] : [row]
    )
  }
  return walk(undefined)
}

export function useLayerListPanel(editor: LayerEditorController) {
  const pickerOpen = ref(false)
  const renamingId = ref<string | null>(null)
  const collapsedGroups = ref(new Set<string>())

  const active = computed(() => editor.activeNode.value)

  const displayRows = computed(() => buildDisplayRows(editor.layers.value, collapsedGroups.value))

  const blendOptions = computed(() =>
    (Object.keys(LAYER_MODES) as BlendFn[]).map((mode) => ({
      label: t(`layerEditor.blend.${BLEND_KEYS[mode] ?? mode}`),
      value: mode,
    })),
  )

  const adjustOptions = computed(() =>
    ADJUST_OPS.map((op) => ({ label: t(`layerEditor.adjOp.${op}`), value: op })),
  )

  const adjustParamDefs = computed(() => {
    const a = active.value
    if (!a || a.kind !== 'adjustment') return []
    return ADJUST_PARAM_DEFS[a.op as AdjustmentOp] ?? []
  })

  function toggleCollapsed(id: string): void {
    const next = new Set(collapsedGroups.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedGroups.value = next
  }

  const dragId = ref<string | null>(null)
  const dropHint = ref<{ id: string; pos: DropPos } | null>(null)
  let expandPending: { id: string; timer: ReturnType<typeof setTimeout> } | null = null

  function clearExpandTimer(): void {
    if (expandPending) {
      clearTimeout(expandPending.timer)
      expandPending = null
    }
  }

  function scheduleAutoExpand(id: string): void {
    if (expandPending?.id === id) return
    clearExpandTimer()
    expandPending = {
      id,
      timer: setTimeout(() => {
        expandPending = null
        if (dragId.value && collapsedGroups.value.has(id)) toggleCollapsed(id)
      }, 600),
    }
  }

  function endDrag(): void {
    dragId.value = null
    dropHint.value = null
    clearExpandTimer()
  }

  function onRowDragStart(row: LayerRow, e: DragEvent): void {
    dragId.value = row.node.id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', row.node.id)
    }
  }

  function onRowDragOver(row: LayerRow, e: DragEvent): void {
    if (!dragId.value || dragId.value === row.node.id) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const ratio = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5
    const pos = dropPositionFor(row.node.kind === 'group', ratio)
    if (dropHint.value?.id !== row.node.id || dropHint.value?.pos !== pos) {
      dropHint.value = { id: row.node.id, pos }
    }
    if (pos === 'into' && collapsedGroups.value.has(row.node.id)) scheduleAutoExpand(row.node.id)
    else clearExpandTimer()
  }

  function onRowDrop(row: LayerRow, e: DragEvent): void {
    e.preventDefault()
    const hint = dropHint.value
    if (dragId.value && hint && hint.id === row.node.id) {
      editor.moveLayerRelative(dragId.value, row.node.id, hint.pos)
    }
    endDrag()
  }

  function onListDragOver(e: DragEvent): void {
    if (!dragId.value || e.target !== e.currentTarget) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dropHint.value = null
  }

  function onListDrop(e: DragEvent): void {
    if (dragId.value && e.target === e.currentTarget) {
      e.preventDefault()
      editor.moveLayerRelative(dragId.value, null, 'below')
    }
    endDrag()
  }

  function rowDropClass(row: LayerRow): string {
    const h = dropHint.value
    if (!h || h.id !== row.node.id) return ''
    if (h.pos === 'above') return 'ctv:shadow-[inset_0_2px_0_0_#1473e6]'
    if (h.pos === 'below') return 'ctv:shadow-[inset_0_-2px_0_0_#1473e6]'
    return 'ctv:bg-[#1473e6]/25'
  }

  function onAssetPicked(asset: Asset): void {
    pickerOpen.value = false
    void editor.addImageFromUrl(asset.payload_url, asset.name)
  }

  function onFilesPicked(e: Event): void {
    const input = e.target as HTMLInputElement
    for (const file of Array.from(input.files ?? [])) editor.addImageFromFile(file)
    input.value = ''
  }

  function addText(): void {
    const size = editor.canvasSize.value
    const id = editor.addTextLayerAt({ x: size.width * 0.25, y: size.height * 0.4 })
    editor.editingTextId.value = id
  }

  function commitRename(id: string, e: Event): void {
    if (renamingId.value !== id) return
    renamingId.value = null
    editor.renameLayer(id, (e.target as HTMLInputElement).value)
  }

  const fillTypeOptions = computed(() => [
    { label: t('layerEditor.fillSolid'), value: 'solid' },
    { label: t('layerEditor.fillLinear'), value: 'linear' },
    { label: t('layerEditor.fillRadial'), value: 'radial' },
  ])

  function activeFill(): FillData | null {
    const a = active.value
    return a && a.kind === 'fill' ? (a as FillData) : null
  }

  function onFillType(type: 'solid' | 'linear' | 'radial'): void {
    const f = activeFill()
    if (!f || f.fill.type === type) return
    const cur = f.fill
    const stops: GradientStop[] =
      cur.type === 'solid'
        ? [{ offset: 0, color: cur.color }, { offset: 1, color: '#ffffff' }]
        : cur.stops.map((s) => ({ ...s }))
    let next: FillSpec
    if (type === 'solid') {
      next = { type: 'solid', color: cur.type === 'solid' ? cur.color : cur.stops[0].color }
    } else if (type === 'linear') {
      next = { type: 'linear', angle: 90, stops }
    } else {
      next = { type: 'radial', cx: 0.5, cy: 0.5, radius: 1, stops }
    }
    editor.updateFillLayer(f.id, next)
  }

  function onFillSolidColor(color: string): void {
    const f = activeFill()
    if (!f || f.fill.type !== 'solid') return
    editor.updateFillLayer(f.id, { type: 'solid', color })
  }

  function onFillStopColor(which: 0 | 1, color: string): void {
    const f = activeFill()
    if (!f || f.fill.type === 'solid') return
    const stops = f.fill.stops.map((s) => ({ ...s }))
    stops[which === 0 ? 0 : stops.length - 1].color = color
    editor.updateFillLayer(f.id, { ...f.fill, stops })
  }

  function onFillAngle(angle: number): void {
    const f = activeFill()
    if (!f || f.fill.type !== 'linear') return
    editor.updateFillLayer(f.id, { ...f.fill, angle })
  }

  function onFillRadius(radius: number): void {
    const f = activeFill()
    if (!f || f.fill.type !== 'radial') return
    editor.updateFillLayer(f.id, { ...f.fill, radius })
  }

  function activeVector(): VectorData | null {
    const a = active.value
    return a && a.kind === 'vector' ? (a as VectorData) : null
  }

  function onVectorFillToggle(): void {
    const v = activeVector()
    if (!v) return
    editor.updateVectorStyle(v.id, { fill: v.fill ? null : { color: '#3b82f6' } })
  }

  function onVectorFillColor(color: string): void {
    const v = activeVector()
    if (!v || !v.fill) return
    editor.updateVectorStyle(v.id, { fill: { ...v.fill, color } })
  }

  function onVectorStrokeToggle(): void {
    const v = activeVector()
    if (!v) return
    editor.updateVectorStyle(v.id, {
      stroke: v.stroke ? null : { color: '#ffffff', width: 4, cap: 'butt', join: 'miter' },
    })
  }

  function onVectorStrokeColor(color: string): void {
    const v = activeVector()
    if (!v || !v.stroke) return
    editor.updateVectorStyle(v.id, { stroke: { ...v.stroke, color } })
  }

  function onVectorStrokeWidth(width: number): void {
    const v = activeVector()
    if (!v || !v.stroke) return
    editor.updateVectorStyle(v.id, { stroke: { ...v.stroke, width: Math.max(1, width) } })
  }

  function onArtboardSize(e: Event, axis: 'w' | 'h'): void {
    const clamped = clampArtboard(Number((e.target as HTMLInputElement).value))
    if (clamped == null) return
    const size = editor.canvasSize.value
    editor.setArtboardSize(axis === 'w' ? clamped : size.width, axis === 'h' ? clamped : size.height)
  }

  function drawThumb(el: HTMLCanvasElement | null, node: SceneNode): void {
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, el.width, el.height)
    if (node.kind === 'text') {
      ctx.fillStyle = node.color
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('T', el.width / 2, el.height / 2 + 1)
      return
    }
    if (node.kind === 'adjustment') {
      ctx.fillStyle = '#facc15'
      ctx.font = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('◐', el.width / 2, el.height / 2 + 1)
      return
    }
    if (node.kind === 'fill') {
      paintFillInto(ctx, (node as FillData).fill, el.width, el.height)
      return
    }
    if (node.kind === 'vector') {
      const v = node as VectorData
      const color = v.fill?.color ?? v.stroke?.color ?? '#3b82f6'
      const pad = 4
      if (v.fill) {
        ctx.fillStyle = color
        ctx.fillRect(pad, pad, el.width - pad * 2, el.height - pad * 2)
      } else {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.strokeRect(pad, pad, el.width - pad * 2, el.height - pad * 2)
      }
      return
    }
    if (node.kind !== 'raster') return
    const entry = editor.content.get((node as RasterData).contentId)
    if (!entry) return
    const fit = computeFit(el.width, el.height, entry.width, entry.height)
    ctx.drawImage(
      entry.canvas,
      fit.offX,
      fit.offY,
      entry.width * fit.scale,
      entry.height * fit.scale,
    )
  }

  function drawMaskThumb(el: HTMLCanvasElement | null, node: SceneNode): void {
    if (!el || !node.mask) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, el.width, el.height)
    const entry = editor.content.get(node.mask.contentId)
    if (!entry) return
    const fit = computeFit(el.width, el.height, entry.width, entry.height)
    ctx.drawImage(
      entry.canvas,
      fit.offX,
      fit.offY,
      entry.width * fit.scale,
      entry.height * fit.scale,
    )
  }

  return {
    pickerOpen,
    renamingId,
    collapsedGroups,
    displayRows,
    active,
    blendOptions,
    adjustOptions,
    adjustParamDefs,
    toggleCollapsed,
    dragId,
    dropHint,
    onRowDragStart,
    onRowDragOver,
    onRowDrop,
    onListDragOver,
    onListDrop,
    endDrag,
    rowDropClass,
    onAssetPicked,
    onFilesPicked,
    addText,
    commitRename,
    onArtboardSize,
    fillTypeOptions,
    onFillType,
    onFillSolidColor,
    onFillStopColor,
    onFillAngle,
    onFillRadius,
    onVectorFillToggle,
    onVectorFillColor,
    onVectorStrokeToggle,
    onVectorStrokeColor,
    onVectorStrokeWidth,
    drawThumb,
    drawMaskThumb,
  }
}

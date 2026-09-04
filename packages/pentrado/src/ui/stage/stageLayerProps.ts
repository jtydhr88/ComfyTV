import { measureText, type TextStyle } from '../../textRender'
import {
  adjustmentKind,
  cloneFillSpec,
  defaultMode,
  defaultParams,
  deriveVectorTransform,
  Dirty,
  fillKind,
  findNode,
  LAYER_MODES,
  normalizeFillSpec,
  PropCommand,
  type AdjustmentData,
  type AdjustmentOp,
  type BlendFn,
  type FillData,
  type FillSpec,
  type FillStyle,
  type LayerFxData,
  type RasterData,
  type SceneNode,
  type StrokeStyle,
  type TextData,
  type Transform,
  type VectorData,
} from '../../engine'
import { clamp01, type StageCtx } from './stageContext'

export function createStageLayerProps(ctx: StageCtx) {
  const { editor, engineNode, fontStore } = ctx

  function editProp<T>(label: string, dirty: number, get: () => T, set: (v: T) => void, value: T, mergeKey?: string): void {
    const before = get()
    if (before === value) return
    set(value)
    editor.history.push(new PropCommand(label, dirty, get, set, before, value, mergeKey))
    editor.invalidate()
  }
  function setActiveLayer(id: string | null): void {
    editor.setActiveNode(id)
  }
  function setSelectedLayers(ids: string[]): void {
    editor.setSelectedNodes(ids)
  }
  function selectionTargets(id: string): string[] {
    const sel = editor.selectedNodeIds()
    return sel.length > 1 && sel.includes(id) ? sel : [id]
  }
  function batch(label: string, ids: string[], apply: (id: string) => void): void {
    if (ids.length > 1) editor.history.beginGroup(label)
    for (const tid of ids) apply(tid)
    if (ids.length > 1) editor.history.endGroup()
  }
  function setOpacity(id: string, v: number): void {
    batch('Opacity', selectionTargets(id), (tid) => {
      const n = engineNode(tid); if (!n) return
      editProp('Opacity', Dirty.META, () => n.opacity, (x) => (n.opacity = x), clamp01(v), `opacity:${tid}`)
    })
  }
  function setBlendMode(id: string, v: BlendFn): void {
    batch('Blend', selectionTargets(id), (tid) => {
      const n = engineNode(tid); if (!n) return
      editProp('Blend', Dirty.DRAWABLE, () => n.mode, (m) => (n.mode = m), defaultMode(v in LAYER_MODES ? v : 'normal'), `blend:${tid}`)
    })
  }
  function toggleVisible(id: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Visibility', Dirty.META, () => n.visible, (x) => (n.visible = x), !n.visible)
  }
  function siblingsOf(id: string): SceneNode[] {
    const d = editor.document()
    const loc = findNode(d.root, id)
    return ((loc?.parent as { children?: SceneNode[] })?.children ?? d.root.children)
  }
  function canClipMask(id: string): boolean {
    return siblingsOf(id).findIndex((n) => n.id === id) > 0
  }
  function toggleClipMask(id: string): void {
    if (!canClipMask(id)) return
    const n = engineNode(id); if (!n) return
    editProp('Clipping Mask', Dirty.DRAWABLE, () => n.clip === true, (v) => (n.clip = v ? true : undefined), !n.clip)
  }
  function toggleLock(id: string): void {
    const base = engineNode(id); if (!base) return
    const target = !base.locks.content
    batch('Lock', selectionTargets(id), (tid) => {
      const n = engineNode(tid); if (!n) return
      editProp('Lock', Dirty.META, () => n.locks.content, (x) => (n.locks.content = x), target)
    })
  }
  function toggleLockPosition(id: string): void {
    const base = engineNode(id); if (!base) return
    const target = !base.locks.position
    batch('Lock Position', selectionTargets(id), (tid) => {
      const n = engineNode(tid); if (!n) return
      editProp('Lock Position', Dirty.META, () => n.locks.position, (x) => (n.locks.position = x), target)
    })
  }
  function toggleLockAll(id: string): void {
    const base = engineNode(id); if (!base) return
    const target = !(base.locks.content && base.locks.position)
    batch('Lock All', selectionTargets(id), (tid) => {
      const n = engineNode(tid); if (!n) return
      if (n.locks.content === target && n.locks.position === target) return
      editProp(
        'Lock All', Dirty.META,
        () => ({ content: n.locks.content, position: n.locks.position }),
        (v) => { n.locks.content = v.content; n.locks.position = v.position },
        { content: target, position: target }
      )
    })
  }
  function renameLayer(id: string, name: string): void {
    const n = engineNode(id); if (!n) return
    editProp('Rename', Dirty.META, () => n.name, (x) => (n.name = x), name.trim() || 'Layer')
  }
  function cloneFx(fx: LayerFxData[] | undefined): LayerFxData[] | undefined {
    return fx?.map((f) => ({ ...f, params: { ...f.params } }))
  }
  function setLayerFx(id: string, next: LayerFxData[]): void {
    const n = engineNode(id); if (!n) return
    const get = (): LayerFxData[] | undefined => cloneFx(n.fx)
    const set = (v: LayerFxData[] | undefined): void => { n.fx = cloneFx(v) }
    const before = get()
    n.fx = next.length ? cloneFx(next) : undefined
    editor.history.push(new PropCommand('Layer Effects', Dirty.DRAWABLE, get, set, before, get(), `layerfx:${id}`))
    editor.invalidate()
  }
  function toggleLockAlpha(id: string): void {
    const base = engineNode(id)
    if (!base || base.kind !== 'raster') return
    const target = !((base as RasterData).lockAlpha === true)
    const targets = selectionTargets(id).filter((tid) => engineNode(tid)?.kind === 'raster')
    batch('Lock Alpha', targets, (tid) => {
      const r = engineNode(tid) as RasterData
      editProp('Lock Alpha', Dirty.META, () => r.lockAlpha === true, (v) => (r.lockAlpha = v), target)
    })
  }
  function addAdjustmentLayer(op: AdjustmentOp = 'brightness-contrast'): string {
    const node = adjustmentKind.create({ op, params: defaultParams(op) })
    editor.addNode(node)
    return node.id
  }
  function addFillLayer(spec?: FillSpec): void {
    editor.addNode(fillKind.create(spec ? { fill: spec } : {}), 0)
  }
  function updateFillLayer(id: string, spec: FillSpec): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'fill') return
    const f = n as FillData
    const snapshot = () => ({ fill: cloneFillSpec(f.fill) })
    const restore = (v: { fill: FillSpec }) => {
      f.fill = cloneFillSpec(v.fill)
    }
    const before = snapshot()
    f.fill = normalizeFillSpec(spec)
    editor.history.push(
      new PropCommand('Fill', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `fill:${id}`)
    )
    editor.invalidate()
  }
  function updateAdjustment(
    id: string,
    patch: { op?: string; params?: Record<string, number>; curves?: Record<string, string> }
  ): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'adjustment') return
    const adj = n as AdjustmentData
    const snapshot = () => ({
      op: adj.op,
      params: { ...adj.params },
      curves: adj.curves ? { ...adj.curves } : undefined,
    })
    const restore = (v: { op: string; params: Record<string, number>; curves?: AdjustmentData['curves'] }) => {
      adj.op = v.op
      adj.params = { ...v.params }
      adj.curves = v.curves ? { ...v.curves } : undefined
    }
    const before = snapshot()
    if (patch.op && patch.op !== adj.op) {
      adj.op = patch.op
      adj.params = defaultParams(patch.op as AdjustmentOp)
    }
    if (patch.params) adj.params = { ...adj.params, ...patch.params }
    if (patch.curves) adj.curves = { ...adj.curves, ...patch.curves }
    editor.history.push(
      new PropCommand('Adjustment', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `adjust:${id}`)
    )
    editor.invalidate()
  }
  function updateVectorStyle(id: string, patch: { fill?: FillStyle | null; stroke?: StrokeStyle | null }): void {
    const n = engineNode(id)
    if (!n || n.kind !== 'vector') return
    const v = n as VectorData
    const snapshot = () => ({
      fill: v.fill ? { ...v.fill } : undefined,
      stroke: v.stroke ? { ...v.stroke } : undefined,
      transform: { ...v.transform },
    })
    const restore = (s: { fill?: FillStyle; stroke?: StrokeStyle; transform: Transform }) => {
      v.fill = s.fill ? { ...s.fill } : undefined
      v.stroke = s.stroke ? { ...s.stroke } : undefined
      v.transform = { ...s.transform }
    }
    const before = snapshot()
    if (patch.fill !== undefined) v.fill = patch.fill ? { ...patch.fill } : undefined
    if (patch.stroke !== undefined) v.stroke = patch.stroke ? { ...patch.stroke } : undefined
    v.transform = deriveVectorTransform(v.path, v.stroke?.width ?? 0)
    editor.history.push(
      new PropCommand('Shape Style', Dirty.DRAWABLE, snapshot, restore, before, snapshot(), `vector:${id}`)
    )
    editor.invalidate()
  }
  function styleOf(n: TextData): TextStyle {
    return { id: n.id, text: n.text, fontRef: n.fontRef, fontSize: n.fontSize, color: n.color, letterSpacing: n.letterSpacing, lineHeight: n.lineHeight, align: n.align }
  }
  const TEXT_FIELDS = ['text', 'fontRef', 'fontSize', 'color', 'letterSpacing', 'lineHeight', 'align', 'transform'] as const
  function snapshotText(n: TextData): Record<string, unknown> {
    const s: Record<string, unknown> = {}
    for (const k of TEXT_FIELDS) s[k] = k === 'transform' ? { ...n.transform } : (n as any)[k]
    return s
  }
  function updateTextLayer(id: string, patch: Partial<TextData>): void {
    const n = engineNode(id) as TextData | null
    if (!n || n.kind !== 'text') return
    const before = snapshotText(n)
    Object.assign(n, patch)
    const font = fontStore.getFontSyncWithFallback(n.fontRef)
    if (font) {
      const m = measureText(styleOf(n), font)
      n.transform = { ...n.transform, w: m.w, h: m.h }
    }
    const after = snapshotText(n)
    editor.history.push(
      new PropCommand('Text', Dirty.DRAWABLE, () => snapshotText(n), (v) => Object.assign(n, v), before, after, `text:${id}`)
    )
    editor.invalidate()
  }
  return {
    editProp, setActiveLayer, setSelectedLayers, selectionTargets, batch,
    setOpacity, setBlendMode, toggleVisible, canClipMask, toggleClipMask,
    toggleLock, toggleLockPosition, toggleLockAll, renameLayer, setLayerFx, toggleLockAlpha,
    addAdjustmentLayer, addFillLayer, updateFillLayer, updateAdjustment, updateVectorStyle, updateTextLayer,
  }
}

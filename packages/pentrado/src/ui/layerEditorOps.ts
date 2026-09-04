import { ADJUST_PARAM_DEFS } from '../engine/adjust'
import type { GroupData, SceneNode } from '../engine/node'
import { LAYER_FX_DEFS } from '../engine/render/layerFx'
import { FILTER_PARAM_DEFS } from '../filters'
import { canvasOps } from './ops/opsCanvas'
import { createOps } from './ops/opsCreate'
import { maskFxOps } from './ops/opsMasksFx'
import { propOps } from './ops/opsProps'
import {
  ADJUSTMENT_OPS,
  ARRANGE_OPS,
  BLEND_MODES,
  FILTER_OPS,
  FX_OPS,
  MASK_INITS,
  oneOf,
  serializeLayer,
  str,
  walkIds,
  type OpCtx,
  type OpHandler,
} from './ops/opsShared'
import { structureOps } from './ops/opsStructure'
import type { LayerEditorController } from './useLayerEditorStage'
import { ARTBOARD_MAX, ARTBOARD_MIN } from './useLayerListPanel'

export const LAYER_OPS = [
  'add_image', 'add_asset', 'add_layer', 'add_text', 'add_adjustment', 'add_fill', 'import_psd',
  'remove', 'duplicate', 'move', 'move_to', 'group', 'ungroup', 'rename',
  'set_visible', 'set_opacity', 'set_blend', 'set_lock', 'set_clip', 'set_transform', 'place', 'nudge', 'arrange',
  'set_active', 'select',
  'add_mask', 'remove_mask', 'set_mask_enabled', 'invert_mask', 'apply_mask',
  'set_fx', 'set_adjustment', 'update_text', 'set_fill',
  'set_canvas_size', 'flip', 'crop_to_content', 'merge_down', 'flatten', 'layer_to_canvas', 'rasterize',
  'filter',
  'select_all', 'select_none', 'invert_selection', 'fill_selection', 'clear_selection',
  'undo', 'redo',
] as const
export type LayerOpName = (typeof LAYER_OPS)[number]

export interface LayerOp {
  op: LayerOpName
  [key: string]: unknown
}

export interface LayerOpResult {
  op: string
  id?: string
  [key: string]: unknown
}

const HANDLERS: Record<string, OpHandler> = {
  ...createOps,
  ...structureOps,
  ...propOps,
  ...maskFxOps,
  ...canvasOps,
}

export function createLayerEditorOps(ctrl: LayerEditorController) {
  const doc = () => ctrl.document()
  const allIds = (): Set<string> => {
    const out = new Set<string>()
    for (const ch of doc().root.children) walkIds(ch, out)
    return out
  }
  const find = (id: unknown): SceneNode => {
    const key = str(id, 'id')
    const stack: SceneNode[] = [...doc().root.children]
    while (stack.length) {
      const n = stack.pop()!
      if (n.id === key) return n
      if (n.kind === 'group') stack.push(...(n as GroupData).children)
    }
    throw new Error(`layer '${key}' not found — call layer_get for current ids`)
  }
  const newIdSince = (before: Set<string>): string | undefined => {
    for (const id of allIds()) if (!before.has(id)) return id
    return undefined
  }
  const settleFloating = (): void => {
    if (ctrl.floating.value) ctrl.anchorFloating('new')
  }
  const ctx: OpCtx = { ctrl, allIds, find, newIdSince, settleFloating }

  function getState(): Record<string, unknown> {
    const d = doc()
    return {
      canvas: { width: d.width, height: d.height },
      active_id: ctrl.activeId.value,
      selected_ids: [...ctrl.selectedIdList.value],
      layers_order: 'bottom_to_top',
      layers: d.root.children.map(serializeLayer),
      has_selection: ctrl.hasSelection(),
      floating: !!ctrl.floating.value,
      can_undo: ctrl.canUndo.value,
      can_redo: ctrl.canRedo.value,
      suspended: !!ctrl.suspended.value,
      memory: ctrl.content.stats?.() ?? null,
    }
  }

  function resources(): Record<string, unknown> {
    return {
      ops: [...LAYER_OPS],
      blend_modes: [...BLEND_MODES],
      adjustment_ops: Object.fromEntries(ADJUSTMENT_OPS.map((op) => [op, ADJUST_PARAM_DEFS[op].map((p) => ({ ...p }))])),
      fx_ops: Object.fromEntries(FX_OPS.map((op) => [op, LAYER_FX_DEFS[op].map((p) => ({ ...p }))])),
      filter_ops: Object.fromEntries(FILTER_OPS.map((op) => [op, FILTER_PARAM_DEFS[op].map((p) => ({ ...p }))])),
      mask_inits: [...MASK_INITS],
      arrange_ops: [...ARRANGE_OPS],
      canvas_limits: { min: ARTBOARD_MIN, max: ARTBOARD_MAX },
    }
  }

  async function applyOne(op: LayerOp): Promise<LayerOpResult> {
    const name = oneOf(op.op, LAYER_OPS, 'op')
    const res: LayerOpResult = { op: name }
    await HANDLERS[name](ctx, op, res)
    return res
  }

  async function applyOps(ops: unknown): Promise<LayerOpResult[]> {
    if (!Array.isArray(ops) || !ops.length) throw new Error('ops must be a non-empty array')
    const results: LayerOpResult[] = []
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i] as LayerOp
      if (!op || typeof op !== 'object' || typeof op.op !== 'string') throw new Error(`ops[${i}] must be an object with an 'op' field`)
      try {
        results.push(await applyOne(op))
      } catch (e) {
        throw new Error(`ops[${i}] ${op.op}: ${(e as Error).message}`)
      }
    }
    return results
  }

  return { getState, resources, applyOps }
}

export type LayerEditorOps = ReturnType<typeof createLayerEditorOps>

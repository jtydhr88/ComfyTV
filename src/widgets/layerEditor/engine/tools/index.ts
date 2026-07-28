import { registerBuiltinPaintCores } from '../paint/paintCore'
import { registerTool } from '../tool'
import { makeMarqueeToolDef } from './marqueeTool'
import { makePaintToolDef } from './paintTool'
import { makeSelectToolDef } from './selectTool'
import { makeShapeToolDef } from './shapeTool'
import { makeTransformToolDef } from './transformTool'
import { makeWarpToolDef } from './warpTool'

export { makeSelectToolDef, nodeBounds } from './selectTool'
export { makeTransformToolDef, isTransformTool, canTransformNode } from './transformTool'
export type { TransformToolApi } from './transformTool'
export { makeMarqueeToolDef } from './marqueeTool'
export { makePaintToolDef, DEFAULT_BRUSH } from './paintTool'
export { makeShapeToolDef, DEFAULT_SHAPE_OPTIONS, STROKE_ONLY_SHAPES, buildShapePath, resolveShapeStyles, appendShapeToVector } from './shapeTool'
export type { ShapeKind, ShapeToolOptions } from './shapeTool'
export {
  makeWarpToolDef, isWarpTool, DEFAULT_WARP_OPTIONS, WARP_SUBDIV,
  buildWarpGrid, sampleWarpSurface, sampleWarpMesh, warpMeshBounds, renderWarp,
} from './warpTool'
export type { WarpToolOptions, WarpToolApi } from './warpTool'
export * from './transformMath'
export { resolvePaintTarget, makeToLocal, rasterizeSelectionToLocal } from './paintTarget'

let registered = false

export function registerBuiltinTools(): void {
  if (registered) return
  registered = true
  registerBuiltinPaintCores()
  registerTool(makeSelectToolDef())
  registerTool(makeTransformToolDef())
  registerTool(makeMarqueeToolDef())
  registerTool(makeShapeToolDef())
  registerTool(makeWarpToolDef())
  registerTool(makePaintToolDef('brush', 'brush', 'content'))
  registerTool(makePaintToolDef('eraser', 'eraser', 'content'))
  registerTool(makePaintToolDef('pencil', 'pencil', 'content'))

  registerTool(makePaintToolDef('mask-brush', 'brush', 'mask'))
  registerTool(makePaintToolDef('mask-eraser', 'eraser', 'mask'))
}

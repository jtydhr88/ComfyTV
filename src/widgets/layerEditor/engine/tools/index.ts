import { registerBuiltinPaintCores } from '../paint/paintCore'
import { registerTool } from '../tool'
import { makePaintToolDef } from './paintTool'
import { makeSelectToolDef } from './selectTool'

export { makeSelectToolDef } from './selectTool'
export { makePaintToolDef, DEFAULT_BRUSH } from './paintTool'
export * from './transformMath'
export { resolvePaintTarget, makeToLocal } from './paintTarget'

let registered = false

export function registerBuiltinTools(): void {
  if (registered) return
  registered = true
  registerBuiltinPaintCores()
  registerTool(makeSelectToolDef())
  registerTool(makePaintToolDef('brush', 'brush', 'content'))
  registerTool(makePaintToolDef('eraser', 'eraser', 'content'))
  registerTool(makePaintToolDef('pencil', 'pencil', 'content'))

  registerTool(makePaintToolDef('mask-brush', 'brush', 'mask'))
  registerTool(makePaintToolDef('mask-eraser', 'eraser', 'mask'))
}

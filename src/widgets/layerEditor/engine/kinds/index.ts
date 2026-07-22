import { registerNodeKind } from '../nodeKind'
import { adjustmentKind } from './adjustment'
import { fillKind } from './fill'
import { groupKind } from './group'
import { rasterKind } from './raster'
import { textKind } from './text'
import { vectorKind } from './vector'

export { rasterKind } from './raster'
export { textKind } from './text'
export { groupKind } from './group'
export { adjustmentKind } from './adjustment'
export { vectorKind, vectorBitmap, rasterizeVector, deriveVectorTransform } from './vector'
export { fillKind, fillBitmap } from './fill'

let registered = false

export function registerBuiltinKinds(): void {
  if (registered) return
  registered = true
  registerNodeKind(rasterKind)
  registerNodeKind(textKind)
  registerNodeKind(groupKind)
  registerNodeKind(adjustmentKind)
  registerNodeKind(vectorKind)
  registerNodeKind(fillKind)
}

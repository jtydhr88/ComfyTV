import { registerNodeKind } from '../nodeKind'
import { groupKind } from './group'
import { rasterKind } from './raster'
import { textKind } from './text'

export { rasterKind } from './raster'
export { textKind } from './text'
export { groupKind } from './group'

let registered = false

export function registerBuiltinKinds(): void {
  if (registered) return
  registered = true
  registerNodeKind(rasterKind)
  registerNodeKind(textKind)
  registerNodeKind(groupKind)
}

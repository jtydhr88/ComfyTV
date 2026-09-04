import { watch } from 'vue'

import { insideBox, STROKE_ONLY_SHAPES } from '../../engine'
import type { ToolHandler } from '../../types'
import type { StageCtx } from './stageContext'

export function createStageTools(ctx: StageCtx) {
  const {
    editor, tool, paintTarget, brushSize, brushHardness, brushOpacity, brushColor, backgroundColor,
    shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
    shapeSides, shapeStarRatio, shapeTurns, symmetryMode, symmetrySectors, gradientShape, gradientToTransparent, gradientReverse,
    maskView, warpPoints, wandThreshold, wandAntialias, wandContiguous, editingTextId,
  } = ctx

  function syncEngineTool(): void {
    const d = editor.document()
    editor.setBrush({
      size: brushSize.value, hardness: brushHardness.value, opacity: brushOpacity.value,
      flow: 1, color: brushColor.value, bgColor: backgroundColor.value, spacing: 0.1,
      symmetry: symmetryMode.value === 'none'
        ? undefined
        : { mode: symmetryMode.value, sectors: symmetrySectors.value, cx: d.width / 2, cy: d.height / 2 },
    })
    editor.setGradientOptions({
      shape: gradientShape.value,
      color: brushColor.value,
      endColor: gradientToTransparent.value ? null : backgroundColor.value,
      reverse: gradientReverse.value,
    })
    editor.setShapeOptions({
      shape: shapeKind.value,
      fill: shapeFillEnabled.value ? { color: shapeFillColor.value } : null,
      stroke: shapeStrokeEnabled.value || STROKE_ONLY_SHAPES.has(shapeKind.value)
        ? { color: shapeStrokeColor.value, width: Math.max(1, shapeStrokeWidth.value), cap: 'butt', join: 'miter' }
        : null,
      combine: shapeCombine.value,
      sides: shapeSides.value,
      starRatio: shapeStarRatio.value,
      turns: shapeTurns.value,
    })
    let id: string = tool.value
    if (tool.value === 'brush') id = paintTarget.value === 'mask' ? 'mask-brush' : 'brush'
    else if (tool.value === 'eraser') id = paintTarget.value === 'mask' ? 'mask-eraser' : 'eraser'
    else if (tool.value === 'text' || tool.value === 'picker') id = 'select'
    if (editor.activeToolId() !== id) editor.setTool(id)
  }
  watch(
    [tool, paintTarget, brushSize, brushHardness, brushOpacity, brushColor,
     shapeKind, shapeFillEnabled, shapeFillColor, shapeStrokeEnabled, shapeStrokeColor, shapeStrokeWidth, shapeCombine,
     shapeSides, shapeStarRatio, shapeTurns,
     symmetryMode, symmetrySectors, gradientShape, gradientToTransparent, backgroundColor, gradientReverse],
    syncEngineTool
  )
  watch(maskView, () => ctx.requestRender())
  watch(warpPoints, () => editor.setWarpOptions({ points: warpPoints.value }))
  watch([wandThreshold, wandAntialias, wandContiguous], () =>
    editor.setWandOptions({
      threshold: wandThreshold.value,
      antialias: wandAntialias.value,
      contiguous: wandContiguous.value,
    })
  )
  const textToolHandler: ToolHandler = {
    onPointerDown: (_e, pt) => {
      const hit = [...editor.document().root.children].reverse().find((n) => n.kind === 'text' && insideBox(n.transform, pt))
      if (hit && hit.locks.content) {
        editor.setActiveNode(hit.id)
        return true
      }
      const id = hit ? hit.id : ctx.addTextLayerAt(pt)
      editor.setActiveNode(id)
      editingTextId.value = id
      return true
    },
    onPointerMove: () => {},
    onPointerUp: () => {},
    cursorFor: () => 'text',
  }
  const engineToolHandler: ToolHandler = {
    onPointerDown: (e, pt) => {
      syncEngineTool()
      editor.pointerDown(e, pt)
      return true
    },
    onPointerMove: (e, pt) => editor.pointerMove(e, pt),
    onPointerUp: (e, pt) => editor.pointerUp(e, pt),
    cursorFor: (pt) => editor.cursorAt(pt),
  }
  const pickerToolHandler: ToolHandler = {
    onPointerDown: (e, pt) => {
      ctx.pickColorAt(pt, e.ctrlKey || e.metaKey ? 'bg' : 'fg')
      return true
    },
    onPointerMove: (e, pt) => {
      ctx.pickColorAt(pt, e.ctrlKey || e.metaKey ? 'bg' : 'fg')
    },
    onPointerUp: () => {},
    cursorFor: () => 'crosshair',
  }
  function activeToolHandler(): ToolHandler {
    if (editor.floating()) return engineToolHandler
    if (tool.value === 'text') return textToolHandler
    if (tool.value === 'picker') return pickerToolHandler
    return engineToolHandler
  }
  return { syncEngineTool, activeToolHandler }
}

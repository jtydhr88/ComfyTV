import { Dirty, PropCommand, SetTransformCommand } from '../../engine'
import type { StageCtx } from './stageContext'

export function createStageArtboard(ctx: StageCtx) {
  const { editor, compositor, glOk, panZoom } = ctx

  function setArtboardSize(w: number, h: number): void {
    const d = editor.document()
    const before = { w: d.width, h: d.height }
    if (before.w === w && before.h === h) return
    const apply = (v: { w: number; h: number }): void => {
      d.width = v.w
      d.height = v.h
      if (glOk.value) compositor.resize(v.w, v.h)
      panZoom.setArtboardSize(v.w, v.h)
    }
    apply({ w, h })
    editor.history.push(
      new PropCommand('Artboard', Dirty.STRUCTURE, () => ({ w: d.width, h: d.height }), apply, before, { w, h })
    )
    editor.invalidate()
    ctx.fitView()
  }
  function applyCrop(): boolean {
    const rect = editor.cropRect()
    if (!rect) return false
    const d = editor.document()
    if (rect.x === 0 && rect.y === 0 && rect.w === d.width && rect.h === d.height) {
      editor.cropClear()
      return false
    }
    editor.history.beginGroup('Crop')
    editor.selectNone()
    for (const node of [...d.root.children]) {
      const before = { ...node.transform }
      const after = { ...before, x: before.x - rect.x, y: before.y - rect.y }
      node.transform = after
      editor.history.push(new SetTransformCommand('Crop Move', node, before, after))
    }
    const guidesBefore = d.guides ? d.guides.map((g) => ({ ...g })) : []
    if (guidesBefore.length) {
      const shift = (gs: Array<{ axis: 'x' | 'y'; pos: number }>): Array<{ axis: 'x' | 'y'; pos: number }> =>
        gs.map((g) => ({ axis: g.axis, pos: g.pos - (g.axis === 'x' ? rect.x : rect.y) }))
      const after = shift(guidesBefore)
      editor.history.push(
        new PropCommand('Crop Guides', Dirty.META, () => d.guides ?? [], (v) => (d.guides = v), guidesBefore, after)
      )
      d.guides = after
    }
    setArtboardSize(rect.w, rect.h)
    editor.history.endGroup()
    editor.cropClear()
    editor.invalidate()
    ctx.fitView()
    return true
  }
  return { setArtboardSize, applyCrop }
}

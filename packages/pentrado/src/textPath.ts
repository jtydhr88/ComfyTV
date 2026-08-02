import { generateId } from './engine/id'
import type { Vec2 } from './engine/node'
import type { PathData, Stroke } from './engine/vector'
import { measureText, type TextStyle } from './textRender'
import Typr, { type TyprFont } from './vendor/typr'

interface TriplePoint {
  leading: Vec2
  anchor: Vec2
  trailing: Vec2
}

function finishContour(pts: TriplePoint[], out: Stroke[]): void {
  if (pts.length < 2) return
  const anchors: Stroke['anchors'] = []
  for (const p of pts) {
    anchors.push(
      { pos: { ...p.leading }, type: 'control', selected: false },
      { pos: { ...p.anchor }, type: 'anchor', selected: false },
      { pos: { ...p.trailing }, type: 'control', selected: false }
    )
  }
  out.push({ id: generateId('stroke'), anchors, closed: true })
}

/** Convert a text layer's glyph outlines into cubic path strokes (text-local px). */
export function textToPathData(style: TextStyle, font: TyprFont): PathData {
  const scale = style.fontSize / font.head.unitsPerEm
  const metrics = measureText(style, font)
  const asc = font.hhea.ascender * scale
  const lineAdvance = style.fontSize * style.lineHeight
  const pad = Math.ceil(style.fontSize * 0.25)
  const maxWidth = metrics.w - pad * 2
  const alignFactor = style.align === 'center' ? 0.5 : style.align === 'right' ? 1 : 0

  const strokes: Stroke[] = []
  const linesText = (style.text || ' ').split('\n')
  for (let li = 0; li < linesText.length; li++) {
    const items = Typr.U.shape(font, linesText[li])
    let width = 0
    for (const it of items) width += it.ax * scale + style.letterSpacing
    const baseline = pad + asc + li * lineAdvance
    let penX = pad + (maxWidth - width) * alignFactor

    for (const item of items) {
      const glyph = Typr.U.glyphToPath(font, item.g)
      const ox = penX + item.dx * scale
      const oy = baseline - item.dy * scale
      const map = (x: number, y: number): Vec2 => ({ x: ox + x * scale, y: oy - y * scale })

      let contour: TriplePoint[] = []
      let ci = 0
      for (const cmd of glyph.cmds) {
        if (cmd === 'M') {
          finishContour(contour, strokes)
          const p = map(glyph.crds[ci], glyph.crds[ci + 1])
          ci += 2
          contour = [{ leading: { ...p }, anchor: p, trailing: { ...p } }]
        } else if (cmd === 'L') {
          const p = map(glyph.crds[ci], glyph.crds[ci + 1])
          ci += 2
          contour.push({ leading: { ...p }, anchor: p, trailing: { ...p } })
        } else if (cmd === 'C') {
          const c1 = map(glyph.crds[ci], glyph.crds[ci + 1])
          const c2 = map(glyph.crds[ci + 2], glyph.crds[ci + 3])
          const p = map(glyph.crds[ci + 4], glyph.crds[ci + 5])
          ci += 6
          const prev = contour[contour.length - 1]
          if (prev) prev.trailing = c1
          contour.push({ leading: c2, anchor: p, trailing: { ...p } })
        } else if (cmd === 'Q') {
          const q = map(glyph.crds[ci], glyph.crds[ci + 1])
          const p = map(glyph.crds[ci + 2], glyph.crds[ci + 3])
          ci += 4
          const prev = contour[contour.length - 1]
          if (prev) {
            const a = prev.anchor
            prev.trailing = { x: a.x + (2 / 3) * (q.x - a.x), y: a.y + (2 / 3) * (q.y - a.y) }
          }
          contour.push({
            leading: { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
            anchor: p,
            trailing: { ...p },
          })
        } else if (cmd === 'Z') {
          finishContour(contour, strokes)
          contour = []
        }
      }
      finishContour(contour, strokes)
      penX += item.ax * scale + style.letterSpacing
    }
  }
  return { strokes }
}

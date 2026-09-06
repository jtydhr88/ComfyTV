const TITLE = 30
const GAP = 40
const MAX_STEPS = 50

type Rect = [number, number, number, number]

function bounds(node: any): Rect | null {
  const p = node?.pos
  const s = node?.size
  if (!p || !s) return null
  return [p[0], p[1] - TITLE, s[0], s[1] + TITLE]
}

function overlaps(a: Rect, b: Rect): boolean {
  return a[0] < b[0] + b[2] && a[0] + a[2] > b[0]
    && a[1] < b[1] + b[3] && a[1] + a[3] > b[1]
}

export function findFreePos(
  graph: any,
  pos: [number, number],
  size: [number, number],
  skip?: any,
): [number, number] {
  const others = ((graph?._nodes ?? []) as any[])
    .filter(n => n !== skip)
    .map(bounds)
    .filter((r): r is Rect => r !== null)
  let [x, y] = pos
  for (let i = 0; i < MAX_STEPS; i++) {
    const me: Rect = [x, y - TITLE, size[0], size[1] + TITLE]
    const hit = others.filter(o => overlaps(me, o))
    if (!hit.length) break
    y = Math.max(...hit.map(o => o[1] + o[3])) + GAP + TITLE
  }
  return [x, y]
}

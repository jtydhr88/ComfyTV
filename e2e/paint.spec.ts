import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface Probe {
  center: Px
  corner: Px
  edgeInside: Px
  edgeOutside: Px
}
interface PaintResults {
  glOk: boolean
  midStroke?: Probe
  afterBrush?: Probe
  afterUndo?: Probe
  afterRedo?: Probe
  afterErase?: Probe
  roundTripChildren?: number
  selInside?: Px
  selOutside?: Px
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('paint path: brush stroke, undo/redo, eraser through the full editor stack', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runPaintTests?: unknown }).runPaintTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runPaintTests: () => unknown }).runPaintTests())) as PaintResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  const m = res.midStroke!
  expect(m.center[3], `mid-stroke centre ${JSON.stringify(m.center)}`).toBeGreaterThan(200)
  expect(m.center[0]).toBeGreaterThan(200)

  const b = res.afterBrush!
  expect(b.center[3], `brush centre ${JSON.stringify(b.center)}`).toBeGreaterThan(200)
  expect(b.center[0], `brush centre ${JSON.stringify(b.center)}`).toBeGreaterThan(200)
  expect(b.center[1]).toBeLessThan(60)
  expect(b.corner[3], `corner should stay transparent ${JSON.stringify(b.corner)}`).toBeLessThan(10)

  expect(b.edgeInside[3], `inside r=9 ${JSON.stringify(b.edgeInside)}`).toBeGreaterThan(200)
  expect(b.edgeOutside[3], `outside r=15 ${JSON.stringify(b.edgeOutside)}`).toBeLessThan(10)

  expect(res.afterUndo!.center[3], `undo centre ${JSON.stringify(res.afterUndo!.center)}`).toBeLessThan(10)
  expect(res.afterRedo!.center[3], `redo centre ${JSON.stringify(res.afterRedo!.center)}`).toBeGreaterThan(200)

  const e = res.afterErase!
  expect(e.center[3], `erase centre ${JSON.stringify(e.center)}`).toBeLessThan(30)
  expect(e.corner[3], `erase corner ${JSON.stringify(e.corner)}`).toBeGreaterThan(240)

  expect(res.roundTripChildren).toBe(1)

  expect(res.selInside![3], `inside selection painted ${JSON.stringify(res.selInside)}`).toBeGreaterThan(200)
  expect(res.selInside![0]).toBeGreaterThan(200)
  expect(res.selOutside![3], `outside selection clean ${JSON.stringify(res.selOutside)}`).toBeLessThan(10)
})

import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface VectorResults {
  glOk: boolean
  rectInside?: Px
  rectOutside?: Px
  ellipseCenter?: Px
  ellipseCorner?: Px
  lineOn?: Px
  lineOff?: Px
  kinds?: string[]
  scaledInside?: Px
  scaledEdgeIn?: Px
  scaledEdgeOut?: Px
  anchorAfterScale?: { x: number; y: number }
  unscaled?: Px
  roundTripKinds?: string[]
  reloadedRect?: Px
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('vector shape layers draw, transform parametrically, and round-trip on real GPU', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runVectorTests?: unknown }).runVectorTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runVectorTests: () => unknown }).runVectorTests())) as VectorResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  expect(res.kinds).toEqual(['vector', 'vector', 'vector'])

  expect(res.rectInside![0], `rect fill ${JSON.stringify(res.rectInside)}`).toBeGreaterThan(240)
  expect(res.rectInside![3]).toBe(255)
  expect(res.rectOutside![3], `outside rect ${JSON.stringify(res.rectOutside)}`).toBeLessThan(10)

  expect(res.ellipseCenter![1], `ellipse fill ${JSON.stringify(res.ellipseCenter)}`).toBeGreaterThan(240)
  expect(res.ellipseCorner![3], `ellipse bbox corner ${JSON.stringify(res.ellipseCorner)}`).toBeLessThan(60)

  expect(res.lineOn![0], `line stroke ${JSON.stringify(res.lineOn)}`).toBeGreaterThan(240)
  expect(res.lineOn![1]).toBeGreaterThan(240)
  expect(res.lineOff![3], `off line ${JSON.stringify(res.lineOff)}`).toBeLessThan(10)

  expect(res.scaledInside![0], `scaled rect fills new area ${JSON.stringify(res.scaledInside)}`).toBeGreaterThan(240)
  expect(res.scaledEdgeIn![3], `edge inside crisp ${JSON.stringify(res.scaledEdgeIn)}`).toBeGreaterThan(240)
  expect(res.scaledEdgeOut![3], `edge outside crisp ${JSON.stringify(res.scaledEdgeOut)}`).toBeLessThan(10)
  expect(res.anchorAfterScale!.x).toBeCloseTo(8, 3)
  expect(res.anchorAfterScale!.y).toBeCloseTo(8, 3)

  expect(res.unscaled![3], `undo restores original size ${JSON.stringify(res.unscaled)}`).toBeLessThan(10)

  expect(res.roundTripKinds).toEqual(['vector', 'vector', 'vector'])
  expect(res.reloadedRect![0], `reloaded rect ${JSON.stringify(res.reloadedRect)}`).toBeGreaterThan(240)
})

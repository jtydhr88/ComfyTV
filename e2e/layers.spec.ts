import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface LayerResults {
  glOk: boolean
  midFloat?: Px
  anchoredFloat?: Px
  anchoredBase?: Px
  grown?: { w: number; h: number; tw: number; rot: number }
  undone?: Px
  redone?: Px
  layerCount?: number
  mergeOk?: boolean
  mergedBlue?: Px
  mergedGreen?: Px
  mergedCount?: number
  mergeUndoCount?: number
  flattenOk?: boolean
  flatCorner?: Px
  flatBlue?: Px
  flatCount?: number
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('GIMP layer model: floating placement anchors into the layer buffer with union growth', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runLayerTests?: unknown }).runLayerTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runLayerTests: () => unknown }).runLayerTests())) as LayerResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  expect(res.midFloat![1], `floating preview visible ${JSON.stringify(res.midFloat)}`).toBeGreaterThan(120)

  expect(res.layerCount, 'anchor merges into the existing layer, not a new one').toBe(1)
  expect(res.anchoredFloat![1], `anchored pixels ${JSON.stringify(res.anchoredFloat)}`).toBeGreaterThan(120)
  expect(res.anchoredBase![0], `base pixels survive ${JSON.stringify(res.anchoredBase)}`).toBeGreaterThan(120)

  expect(res.grown!.w, 'buffer grew to the union').toBe(56)
  expect(res.grown!.h).toBe(56)
  expect(res.grown!.rot).toBe(0)

  expect(res.undone![3], `undo restores pre-anchor ${JSON.stringify(res.undone)}`).toBeLessThan(10)
  expect(res.redone![1], `redo re-anchors ${JSON.stringify(res.redone)}`).toBeGreaterThan(120)

  expect(res.mergeOk, 'merge down succeeds').toBe(true)
  expect(res.mergedCount, 'merge removes the top layer').toBe(1)
  expect(res.mergedBlue![2], `merged blue pixels ${JSON.stringify(res.mergedBlue)}`).toBeGreaterThan(120)
  expect(res.mergedGreen![1], `merged keeps prior content ${JSON.stringify(res.mergedGreen)}`).toBeGreaterThan(120)
  expect(res.mergeUndoCount, 'merge is one undo step').toBe(2)

  expect(res.flattenOk, 'flatten succeeds').toBe(true)
  expect(res.flatCount).toBe(1)
  expect(res.flatCorner![0], `flatten fills background white ${JSON.stringify(res.flatCorner)}`).toBeGreaterThan(240)
  expect(res.flatCorner![3]).toBe(255)
  expect(res.flatBlue![2], `flatten keeps composite ${JSON.stringify(res.flatBlue)}`).toBeGreaterThan(120)
})

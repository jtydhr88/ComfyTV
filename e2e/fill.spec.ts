import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface FillResults {
  glOk: boolean
  solidCenter?: Px
  solidCorner?: Px
  linLeft?: Px
  linRight?: Px
  linMid?: Px
  radCenter?: Px
  radCorner?: Px
  mixed?: Px
  mergeOk?: boolean
  merged?: Px
  mergedCount?: number
  roundTripKinds?: string[]
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('fill layers render solid + gradients parametrically on real GPU', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runFillTests?: unknown }).runFillTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runFillTests: () => unknown }).runFillTests())) as FillResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  expect(res.solidCenter![2], `solid blue ${JSON.stringify(res.solidCenter)}`).toBeGreaterThan(180)
  expect(res.solidCenter![3]).toBe(255)
  expect(res.solidCorner![2], `solid covers whole canvas ${JSON.stringify(res.solidCorner)}`).toBeGreaterThan(180)

  expect(res.linLeft![0], `linear left dark ${JSON.stringify(res.linLeft)}`).toBeLessThan(30)
  expect(res.linRight![0], `linear right bright ${JSON.stringify(res.linRight)}`).toBeGreaterThan(225)
  expect(res.linMid![0], `linear midpoint ${JSON.stringify(res.linMid)}`).toBeGreaterThan(80)
  expect(res.linMid![0]).toBeLessThan(220)

  expect(res.radCenter![0], `radial center white ${JSON.stringify(res.radCenter)}`).toBeGreaterThan(225)
  expect(res.radCorner![0], `radial corner black ${JSON.stringify(res.radCorner)}`).toBeLessThan(30)

  expect(res.mixed![0], `50% green over red keeps red ${JSON.stringify(res.mixed)}`).toBeGreaterThan(80)
  expect(res.mixed![1], `50% green over red gains green ${JSON.stringify(res.mixed)}`).toBeGreaterThan(80)

  expect(res.mergeOk).toBe(true)
  expect(res.mergedCount).toBe(1)
  expect(res.merged![1], `merged fill baked into raster ${JSON.stringify(res.merged)}`).toBeGreaterThan(225)
  expect(res.merged![0]).toBeLessThan(30)

  expect(res.roundTripKinds).toEqual(['raster'])
})

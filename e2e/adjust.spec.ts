import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface AdjustResults {
  glOk: boolean
  inverted?: Px
  half?: Px
  brightened?: Px
  hidden?: Px
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('adjustment layers transform the composite below them on real GPU', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runAdjustTests?: unknown }).runAdjustTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runAdjustTests: () => unknown }).runAdjustTests())) as AdjustResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  expect(res.inverted![0], `invert red→cyan ${JSON.stringify(res.inverted)}`).toBeLessThan(10)
  expect(res.inverted![1]).toBeGreaterThan(240)
  expect(res.inverted![2]).toBeGreaterThan(240)
  expect(res.inverted![3]).toBe(255)

  expect(res.half![0], `50% opacity mixes ${JSON.stringify(res.half)}`).toBeGreaterThan(100)
  expect(res.half![1]).toBeGreaterThan(100)
  expect(res.half![0]).toBeLessThan(220)

  expect(res.brightened![0], `brightness lifts red ${JSON.stringify(res.brightened)}`).toBeGreaterThan(240)
  expect(res.brightened![1]).toBeGreaterThan(100)
  expect(res.brightened![1]).toBeLessThan(200)

  expect(res.hidden![0], `hidden adjustment restores red ${JSON.stringify(res.hidden)}`).toBeGreaterThan(240)
  expect(res.hidden![1]).toBeLessThan(10)
})

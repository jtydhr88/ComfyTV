import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

type Px = [number, number, number, number]
interface ContextLossResults {
  glOk: boolean
  before?: Px
  after?: Px
  lostImmediately?: boolean
  restoredCalls?: number
  swappedCanvas?: boolean
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('compositor recovers from a lost WebGL context and re-renders', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runContextLossTests?: unknown }).runContextLossTests === 'function')

  const res = (await page.evaluate(() =>
    (window as Window & { runContextLossTests: () => Promise<unknown> }).runContextLossTests()
  )) as ContextLossResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)

  expect(res.before![0], `red before loss ${JSON.stringify(res.before)}`).toBeGreaterThan(240)
  expect(res.lostImmediately).toBe(true)
  expect(res.restoredCalls!, 'recovery notified the host').toBeGreaterThanOrEqual(1)
  expect(res.swappedCanvas, 'fresh canvas after recovery').toBe(true)
  expect(res.after![0], `red re-rendered after recovery ${JSON.stringify(res.after)}`).toBeGreaterThan(240)
  expect(res.after![3]).toBe(255)
})

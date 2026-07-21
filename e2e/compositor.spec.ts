import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))

interface ModeResult {
  blend: string
  got: [number, number, number, number]
  expected: [number, number, number, number]
  maxDiff: number
}
interface Results {
  glOk: boolean
  modes?: ModeResult[]
  alpha?: { got: number[]; expected: number[]; maxDiff: number }
  orientation?: { upper: number[]; lower: number[]; topIsGreen: boolean; bottomIsRed: boolean }
}

const TOL = 4

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('WebGL compositor matches the GIMP-exact CPU reference', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runCompositorTests?: unknown }).runCompositorTests === 'function')

  const res = (await page.evaluate(() => (window as Window & { runCompositorTests: () => unknown }).runCompositorTests())) as Results

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk, 'WebGL2 + EXT_color_buffer_float must be available').toBe(true)

  for (const m of res.modes ?? []) {
    expect(
      m.maxDiff,
      `${m.blend}: got ${JSON.stringify(m.got)} expected ${JSON.stringify(m.expected)}`
    ).toBeLessThanOrEqual(TOL)
  }

  expect(res.alpha!.maxDiff, `alpha: got ${JSON.stringify(res.alpha!.got)} expected ${JSON.stringify(res.alpha!.expected)}`).toBeLessThanOrEqual(TOL)

  expect(res.orientation!.topIsGreen, `upper ${JSON.stringify(res.orientation!.upper)}`).toBe(true)
  expect(res.orientation!.bottomIsRed, `lower ${JSON.stringify(res.orientation!.lower)}`).toBe(true)
})

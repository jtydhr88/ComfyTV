import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/index.html', import.meta.url))
const fixturePath = fileURLToPath(new URL('../temp/2d/comfytv-layers-1785161368317.psd', import.meta.url))

interface LayerReport {
  name: string
  kind: string
  coverage: number
}

interface RoundTripResults {
  glOk: boolean
  before?: { composite: number; layers: LayerReport[] }
  after?: { composite: number; layers: LayerReport[] }
  diff?: { maxDiff: number; avgDiff: number; samples: number }
  warnings?: string[]
  importedKinds?: string[]
  reloaded?: { composite: number; layers: LayerReport[] }
  reloadDiff?: { maxDiff: number; avgDiff: number; samples: number }
  uploadedJobs?: number
}

interface FixtureResults {
  ok: boolean
  error?: string
  width?: number
  height?: number
  warnings?: string[]
  nodes?: Array<{ name: string; kind: string; visible: boolean; transform: { x: number; y: number; w: number; h: number } }>
  composite?: number
  layers?: LayerReport[]
  reloadComposite?: number
  reloadLayers?: LayerReport[]
  uploadedJobs?: number
}

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('PSD round trip: export -> writePsd -> readPsd -> import keeps every layer, then survives persist/reload', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runPsdRoundTrip?: unknown }).runPsdRoundTrip === 'function')

  const res = (await page.evaluate(() =>
    (window as Window & { runPsdRoundTrip: () => unknown }).runPsdRoundTrip()
  )) as RoundTripResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.glOk).toBe(true)
  expect(res.warnings, `import warnings: ${JSON.stringify(res.warnings)}`).toEqual([])
  expect(res.importedKinds).toEqual(['raster', 'raster', 'fill', 'vector', 'adjustment'])

  for (const layer of res.after!.layers) {
    if (layer.coverage < 0) continue
    expect(layer.coverage, `imported layer "${layer.name}" has pixels`).toBeGreaterThan(0.02)
  }
  expect(res.diff!.avgDiff, `composite avg diff ${JSON.stringify(res.diff)}`).toBeLessThan(8)
  expect(res.diff!.maxDiff, `composite max diff ${JSON.stringify(res.diff)}`).toBeLessThan(96)

  expect(res.uploadedJobs, 'imported contents got upload jobs').toBeGreaterThan(0)
  for (const layer of res.reloaded!.layers) {
    if (layer.coverage < 0) continue
    expect(layer.coverage, `reloaded layer "${layer.name}" still has pixels`).toBeGreaterThan(0.02)
  }
  expect(res.reloadDiff!.avgDiff, `reload avg diff ${JSON.stringify(res.reloadDiff)}`).toBeLessThan(8)
})

test('real exported PSD fixture imports with no content loss', async ({ page }) => {
  test.skip(!existsSync(fixturePath), 'fixture psd not present (temp/2d)')
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const buffer = readFileSync(fixturePath)
  await page.route('**/fixture.psd', (route) =>
    route.fulfill({ body: buffer, contentType: 'application/octet-stream' })
  )
  await page.goto('/')
  await page.waitForFunction(() => typeof (window as Window & { runPsdFixture?: unknown }).runPsdFixture === 'function')

  const res = (await page.evaluate(
    (url) => (window as Window & { runPsdFixture: (u: string) => unknown }).runPsdFixture(url),
    '/fixture.psd'
  )) as FixtureResults

  expect(errors, errors.join('\n')).toHaveLength(0)
  expect(res.ok, res.error ?? '').toBe(true)
  expect(res.warnings, `import warnings: ${JSON.stringify(res.warnings)}`).toEqual([])
  expect(res.nodes!.length).toBeGreaterThan(0)

  for (const layer of res.layers!) {
    if (layer.coverage < 0) continue
    expect(layer.coverage, `layer "${layer.name}" (${layer.kind}) has pixels after import`).toBeGreaterThan(0.03)
  }
  expect(res.composite!).toBeGreaterThan(0.5)

  for (const layer of res.reloadLayers!) {
    if (layer.coverage < 0) continue
    expect(layer.coverage, `layer "${layer.name}" still has pixels after persist/reload`).toBeGreaterThan(0.03)
  }
  expect(res.reloadComposite!).toBeGreaterThan(0.5)
})

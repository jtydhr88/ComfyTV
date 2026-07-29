import { mkdirSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { test } from '@playwright/test'

const outDir = fileURLToPath(new URL('../docs-site/images/nodes/', import.meta.url))
mkdirSync(outDir, { recursive: true })
const shot = (slug: string) => `${outDir}${slug}.png`

async function ready(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => (window as Window & { uiReady?: boolean }).uiReady === true, undefined, { timeout: 20000 })
  await page.waitForTimeout(600)
}

const PAGES: Array<{ file: string; slug: string; w: number; h: number }> = [
  { file: '/ui.html', slug: 'layer-editor', w: 1360, h: 860 },
  { file: '/midiroll.html', slug: 'midi-editor', w: 1200, h: 760 },
  { file: '/storyboard.html', slug: 'storyboard-editor', w: 1360, h: 860 },
  { file: '/score.html', slug: 'score-editor', w: 1200, h: 760 },
  { file: '/scene3d.html', slug: 'scene3-d', w: 1360, h: 860 },
  { file: '/material.html', slug: 'material', w: 1200, h: 820 },
]

for (const p of PAGES) {
  test(`docshot: ${p.slug}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.setViewportSize({ width: p.w, height: p.h })
    const resp = await page.goto(p.file)
    if (!resp || resp.status() >= 400) {
      test.skip(true, `${p.file} not built`)
      return
    }
    await ready(page)
    const app = page.locator('#app')
    await app.screenshot({ path: shot(p.slug) })
    if (errors.length) console.warn(`[${p.slug}] page errors:\n` + errors.join('\n'))
  })
}

import { existsSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import { expect, test } from '@playwright/test'

const distHtml = fileURLToPath(new URL('./dist/ui.html', import.meta.url))

test.beforeAll(() => {
  if (!existsSync(distHtml)) {
    throw new Error('e2e/dist not built — run `npm run e2e:build` first')
  }
})

test('layer editor UI mounts and renders the PS-style layout', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/ui.html')
  await page.waitForFunction(() => (window as Window & { uiReady?: boolean }).uiReady === true, undefined, { timeout: 15000 })
  await page.waitForTimeout(400)

  expect(errors, errors.join('\n')).toHaveLength(0)

  const layers = await page.evaluate(() => {
    const ctl = (window as any).editorCtl
    return ctl.layers.value.map((r: any) => r.node.kind)
  })
  expect(layers).toContain('fill')
  expect(layers).toContain('raster')
  expect(layers).toContain('vector')
  expect(layers).toContain('text')

  const moved = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('[draggable="true"]')]
    const find = (t: string) => rows.find((r) => r.textContent?.includes(t)) as HTMLElement | undefined
    const src = find('风景照片')
    const dst = find('标题组')
    if (!src || !dst) return 'rows-missing'
    const dt = new DataTransfer()
    const rect = dst.getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: mid }))
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientY: mid }))
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    const ctl = (window as any).editorCtl
    const row = ctl.layers.value.find((r: any) => r.node.name === '风景照片')
    const parent = ctl.layers.value.find((x: any) => x.node.id === row.parentId)
    return { depth: row.depth, parentName: parent?.node.name }
  })
  expect(moved).toEqual({ depth: 1, parentName: '标题组' })

  await page.waitForTimeout(200)
  await page.screenshot({ path: fileURLToPath(new URL('./ui-screenshot.png', import.meta.url)) })
})

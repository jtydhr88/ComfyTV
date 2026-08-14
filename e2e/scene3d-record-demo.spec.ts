import { writeFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

test.use({ video: { mode: 'on', size: { width: 1280, height: 720 } } })

test('record the shot-cut film through the real pipeline', async ({ page }) => {
  test.setTimeout(420_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/scene3d.html')
  await page.waitForFunction(() => (window as any).uiReady === true, undefined, {
    timeout: 30_000,
  })

  await page.evaluate(() => {
    const orig = URL.createObjectURL.bind(URL)
    ;(window as any).__recordedBlobs = []
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type.includes('webm')) {
        ;(window as any).__recordedBlobs.push(obj)
      }
      return orig(obj)
    }
  })

  await page.waitForTimeout(6000)

  await page.getByText('录制', { exact: true }).click()
  await page.waitForFunction(
    () => (window as any).__recordedBlobs.length > 0,
    undefined,
    { timeout: 360_000 }
  )

  const base64 = await page.evaluate(async () => {
    const blob = (window as any).__recordedBlobs[0] as Blob
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  })
  writeFileSync('test-results/scene3d-film.webm', Buffer.from(base64, 'base64'))
  await page.waitForTimeout(3000)
  expect(errors).toEqual([])
})

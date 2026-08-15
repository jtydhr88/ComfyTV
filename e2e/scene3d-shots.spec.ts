import { expect, test } from '@playwright/test'

test('scene3d shot cut track drives the program monitor', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  await page.goto('/scene3d.html')
  await page.waitForFunction(() => (window as any).uiReady === true, undefined, {
    timeout: 30_000,
  })
  await page.screenshot({ path: 'test-results/scene3d-shot-a.png' })
  await page.waitForTimeout(4500)
  await page.screenshot({ path: 'test-results/scene3d-shot-b.png' })
  await page.getByText('High Lock', { exact: true }).first().click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/scene3d-shot-panel.png' })
  await page
    .getByText('a lone figure crosses a quiet plaza at dusk')
    .first()
    .click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'test-results/scene3d-prompt-panel.png' })
  await page.getByLabel('自动生成').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/scene3d-auto-prompts.png' })
  await page.getByTitle('俯视布局').click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/scene3d-plan-view.png' })
  expect(errors).toEqual([])
})

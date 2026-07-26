import { test, expect } from '@playwright/test'

async function heights(page: any) {
  return page.evaluate(() => {
    const rect = (sel: string) =>
      document.querySelector(sel)?.getBoundingClientRect().height ?? -1
    const scroller = document.querySelector('.ctv-scroll-thin') as HTMLElement
    return {
      node: rect('#lgnode'),
      container: rect('.comfytv-root'),
      shell: rect('[data-testid="roll-shell"]'),
      scrollerClient: scroller?.clientHeight ?? -1,
      scrollerContent: scroller?.scrollHeight ?? -1,
    }
  })
}

test('midi editor flexes with the node instead of inflating it', async ({ page }) => {
  await page.goto('/midiroll.html')
  await page.waitForFunction(() => (window as any).uiReady)

  const base = await heights(page)
  expect(base.node).toBeGreaterThan(600)
  expect(base.node).toBeLessThan(700)
  expect(base.shell).toBeGreaterThan(150)
  expect(base.scrollerContent).toBeGreaterThan(base.scrollerClient + 500)

  await page.evaluate(() => {
    document.getElementById('lgnode')!.style.height = '1000px'
  })
  await page.waitForTimeout(100)
  const tall = await heights(page)
  expect(tall.node).toBeGreaterThan(990)
  expect(tall.shell).toBeGreaterThan(base.shell + 250)
  expect(tall.scrollerContent).toBeGreaterThan(tall.scrollerClient + 200)

  await page.evaluate(() => {
    document.getElementById('lgnode')!.style.height = ''
  })
  await page.waitForTimeout(100)
  const back = await heights(page)
  expect(back.node).toBeLessThan(700)
  expect(back.shell).toBeLessThan(base.shell + 30)
})

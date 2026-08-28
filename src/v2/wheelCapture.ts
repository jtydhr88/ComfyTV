const SCROLLABLE_OVERFLOW = /(auto|scroll|overlay)/

function isTextEntry(el: Element | null): boolean {
  if (!el) return false
  return el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || (el as HTMLElement).isContentEditable
}

function findScrollable(start: HTMLElement | null, root: HTMLElement): HTMLElement | null {
  let el = start
  while (el) {
    if (el.scrollHeight > el.clientHeight + 1 && SCROLLABLE_OVERFLOW.test(getComputedStyle(el).overflowY)) return el
    if (el === root) return null
    el = el.parentElement
  }
  return null
}

export function bindWheelCapture(root: HTMLElement) {
  let held: HTMLElement | null = null
  root.addEventListener('pointerover', (e) => {
    const el = findScrollable(e.target as HTMLElement, root)
    if (held && held !== el && document.activeElement === held) held.blur()
    held = null
    if (!el) return
    if (el.dataset.captureWheel !== 'true') {
      el.dataset.captureWheel = 'true'
      if (!isTextEntry(el) && !el.hasAttribute('tabindex')) el.tabIndex = -1
    }
    if (isTextEntry(el)) return
    if (el.contains(document.activeElement)) return
    if (isTextEntry(document.activeElement)) return
    el.focus({ preventScroll: true })
    held = el
  })
  root.addEventListener('pointerleave', () => {
    if (held && document.activeElement === held) held.blur()
    held = null
  })
}

import { useResizeObserver } from '@vueuse/core'
import { onScopeDispose, watch, type EffectScope } from 'vue'

import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { useStageStore } from '@/stores/stageStore'
import { bindClusterHoverIntent } from '@/v2/nodeDrag'
import { observeProperty } from '@/v2/observeProps'
import { el } from '@/v2/shellCommon'

export function bindShellChrome(node: ComfyNode, opts: {
  scope: EffectScope
  card: HTMLElement
  socketAnchor: HTMLElement
  socketY?: 'center' | { frac: number; cap: number }
  state?: { error?: { message?: string; traceback?: string } | null; durationMs?: number | null; output?: string | null }
}) {
  const anyNode = node as any
  const { scope, card, socketAnchor } = opts
  const socketY = opts.socketY ?? 'center'

  const warnStrip = el('div', 'v2-warn')
  socketAnchor.after(warnStrip)
  let lastWarnKey = ''
  const syncWarnings = (root: HTMLElement) => {
    const map = (anyNode._comfytvSlotWarnings ?? {}) as Record<string, { message: string }>
    const msgs = [...new Set(Object.values(map).map((w) => String(w?.message ?? '')).filter(Boolean))]
    const key = msgs.join('\n')
    root.toggleAttribute('data-v2-warn', msgs.length > 0)
    if (key === lastWarnKey) return
    lastWarnKey = key
    warnStrip.dataset.show = msgs.length ? '1' : ''
    warnStrip.replaceChildren(...msgs.slice(0, 4).map((m) => {
      const row = el('div', 'v2-warn__row')
      row.textContent = m
      return row
    }))
  }

  if (opts.state) {
    const state = opts.state
    const strip = el('div', 'v2-error')
    const msg = el('div', 'v2-error__msg')
    const x = el('button', 'v2-error__x', '×') as HTMLButtonElement
    strip.append(msg, x)
    warnStrip.after(strip)
    x.addEventListener('pointerdown', (e) => e.stopPropagation())
    x.addEventListener('click', (e) => {
      e.stopPropagation()
      useStageStore().clearError(state as any)
    })
    scope.run(() => {
      watch(
        () => state.error,
        (err) => {
          strip.dataset.show = err ? '1' : ''
          const text = String(err?.message ?? '').trim()
          msg.textContent = text
          msg.title = String(err?.traceback ?? '').trim() || text
        },
        { immediate: true },
      )
    })

    const dur = el('div', 'v2-duration')
    socketAnchor.appendChild(dur)
    scope.run(() => {
      watch(
        () => [state.durationMs, state.output] as const,
        ([ms, output]) => {
          if (ms == null || !Number.isFinite(ms) || ms <= 0 || !output) {
            dur.dataset.show = ''
            return
          }
          const secs = ms / 1000
          dur.textContent = secs < 60
            ? `${secs.toFixed(1)}s`
            : `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
          dur.title = t('stage.outputDurationHint')
          dur.dataset.show = '1'
        },
        { immediate: true },
      )
    })
  }

  const titleEl = card.querySelector<HTMLElement>('.v2-handle span')
  const typeLabel = titleEl?.textContent ?? ''
  const defaultTitle = String((node.constructor as any)?.title ?? '')
  const customTitle = () => {
    const raw = String(anyNode.title ?? '').trim()
    return raw && raw !== defaultTitle ? raw : ''
  }
  const syncTitle = () => {
    if (!titleEl || titleEl.isContentEditable) return
    const want = customTitle() || typeLabel
    if (titleEl.textContent !== want) titleEl.textContent = want
  }
  if (titleEl) {
    titleEl.title = t('v2.renameHint')
    titleEl.addEventListener('pointerdown', (e) => {
      if (titleEl.isContentEditable) e.stopPropagation()
    })
    titleEl.addEventListener('dblclick', (e) => {
      e.stopPropagation()
      titleEl.contentEditable = 'plaintext-only'
      titleEl.textContent = customTitle()
      titleEl.focus()
      const range = document.createRange()
      range.selectNodeContents(titleEl)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
    const commit = (cancel: boolean) => {
      if (!titleEl.isContentEditable) return
      const text = (titleEl.textContent ?? '').trim()
      titleEl.contentEditable = 'false'
      if (!cancel) anyNode.title = text || defaultTitle
      syncTitle()
    }
    titleEl.addEventListener('keydown', (e) => {
      if (!titleEl.isContentEditable) return
      e.stopPropagation()
      if (e.key === 'Enter') { e.preventDefault(); commit(false) }
      else if (e.key === 'Escape') { e.preventDefault(); commit(true) }
    })
    titleEl.addEventListener('blur', () => commit(false))
    syncTitle()
  }

  const syncSelected = () => {
    const root = card.closest('[data-node-id]') as HTMLElement | null
    if (!root) return
    root.toggleAttribute('data-v2-selected', !!anyNode.selected)
    queueMicrotask(() => {
      document.body.toggleAttribute(
        'data-v2-toolbar',
        !!document.querySelector('.lg-node[data-v2-selected]'),
      )
    })
  }
  const prevSel = anyNode.onSelected
  anyNode.onSelected = function (...args: unknown[]) {
    prevSel?.apply(this, args)
    syncSelected()
  }
  const prevDesel = anyNode.onDeselected
  anyNode.onDeselected = function (...args: unknown[]) {
    prevDesel?.apply(this, args)
    syncSelected()
  }

  let root: HTMLElement | null = null

  const syncSocketY = () => {
    if (!root) return
    const rootBox = root.getBoundingClientRect()
    const box = socketAnchor.getBoundingClientRect()
    if (rootBox.height > 0 && box.height > 0) {
      const scale = rootBox.height / (root.offsetHeight || rootBox.height)
      const mid = socketY === 'center'
        ? box.height / 2
        : Math.min(box.height * socketY.frac, socketY.cap)
      const y = (box.top + mid - rootBox.top) / (scale || 1)
      root.style.setProperty('--v2-socket-y', `${Math.round(y)}px`)
    }
  }

  const syncAll = () => {
    if (!card.isConnected) return
    const r = card.closest('[data-node-id]') as HTMLElement | null
    if (!r) return
    if (r !== root) {
      root = r
      bindClusterHoverIntent(root, scope)
    }
    if (!root.hasAttribute('data-v2-shell')) root.setAttribute('data-v2-shell', '')
    syncSelected()
    syncTitle()
    syncWarnings(root)
    syncSocketY()
  }

  scope.run(() => {
    useResizeObserver(card, syncAll)
    useResizeObserver(socketAnchor, syncSocketY)
  })

  const disposers = [
    observeProperty(anyNode, 'selected', syncSelected),
    observeProperty(anyNode, 'title', syncTitle),
    observeProperty(anyNode, '_comfytvSlotWarnings', () => { if (root) syncWarnings(root) }),
  ]
  scope.run(() => {
    onScopeDispose(() => { for (const d of disposers) d() })
  })

  const prevConf = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConf?.apply(this, args)
    queueMicrotask(syncAll)
  }

  queueMicrotask(syncAll)
}

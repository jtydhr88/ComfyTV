import { watch, type EffectScope } from 'vue'

import { t } from '@/i18n'
import { type ComfyNode } from '@/lib/comfyApp'
import { getWidget } from '@/utils/widget'
import { el, I } from '@/v2/shellCommon'

const COLLAPSED_PROP = 'v2_panel_collapsed'

export function stageInfoLine(
  node: ComfyNode,
  state: { mainPrompt?: string | null },
): string {
  const wf = String(getWidget(node, 'workflow')?.value ?? '').trim()
  const prompt = String(
    (state.mainPrompt || getWidget(node, 'main_prompt')?.value) ?? '',
  ).replace(/\s+/g, ' ').trim()
  return [wf, prompt].filter(Boolean).join(' · ')
}

export function bindPanelCollapse(node: ComfyNode, opts: {
  scope: EffectScope
  panel: HTMLElement
  footer: HTMLElement
  run: HTMLElement
  info: () => string
}) {
  const anyNode = node as any
  const { panel, footer, run } = opts

  const bar = el('div', 'v2-collapse')
  const chevron = el('span', 'v2-collapse__chevron', I(`<path d="M6 14l6-6 6 6"/>`, 2.2))
  const infoEl = el('span', 'v2-collapse__info')
  bar.append(chevron, infoEl)
  panel.prepend(bar)

  const isCollapsed = () => !!anyNode.properties?.[COLLAPSED_PROP]
  const apply = () => {
    const on = isCollapsed()
    panel.toggleAttribute('data-v2-collapsed', on)
    bar.title = on ? t('v2.panelExpand') : t('v2.panelCollapse')
    infoEl.textContent = opts.info()
    if (on) bar.appendChild(run)
    else footer.appendChild(run)
  }

  bar.addEventListener('pointerdown', (e) => e.stopPropagation())
  bar.addEventListener('click', (e) => {
    e.stopPropagation()
    anyNode.properties = anyNode.properties ?? {}
    anyNode.properties[COLLAPSED_PROP] = !isCollapsed()
    apply()
  })

  opts.scope.run(() => {
    watch(() => opts.info(), (txt) => { infoEl.textContent = txt })
  })

  const prevConf = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConf?.apply(this, args)
    queueMicrotask(apply)
  }

  apply()
}

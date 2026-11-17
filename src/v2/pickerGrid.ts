import { t } from '@/i18n'
import { app, type ComfyNode } from '@/lib/comfyApp'
import { THUMB_CELL, thumbUrl } from '@/utils/thumbUrl'

const GRID_PROP = 'v2_picker_grid'

const GRID_CSS = `
.v2-picker-grid {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: none;
  gap: 6px;
  padding: 6px;
  border-radius: 12px;
  overflow-y: auto;
  background: var(--v2-slab-bg);
}
.v2-preview[data-grid="1"] .v2-picker-grid { display: grid; }
.v2-preview[data-grid="1"] .v2-nav,
.v2-preview[data-grid="1"] .v2-chip,
.v2-preview[data-grid="1"] .v2-strip,
.v2-preview[data-grid="1"] .v2-corner-host { display: none; }
.v2-picker-grid__cell {
  position: relative;
  min-height: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  background: var(--v2-checker);
  background-size: 18px 18px;
}
.v2-picker-grid__cell[data-current="1"] { border-color: #3b82f6; }
.v2-picker-grid__cell img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.v2-picker-grid__n {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(12,12,16,.78);
  color: #e6e6ea;
  font: 600 10px/1.2 system-ui, sans-serif;
}
.v2-picker-grid__cell .v2-strip__x { width: 18px; height: 18px; font-size: 12px; top: 4px; right: 4px; }
.v2-picker-grid__cell:hover .v2-strip__x { display: flex; }
.v2-picker-footer__pin[data-on="1"] { background: rgba(59,130,246,.22); color: #93c5fd; }
`

const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>`

let cssInstalled = false

export function createPickerGrid(node: ComfyNode, preview: HTMLElement, opts: {
  onPick: (index: number) => void
  onRemove: (index: number) => void
}) {
  if (!cssInstalled) {
    cssInstalled = true
    const style = document.createElement('style')
    style.textContent = GRID_CSS
    document.head.appendChild(style)
  }
  const anyNode = node as any
  const grid = document.createElement('div')
  grid.className = 'v2-picker-grid'
  preview.appendChild(grid)

  const button = document.createElement('button')
  button.className = 'v2-picker-footer__pin'
  button.innerHTML = ICON_GRID
  button.addEventListener('pointerdown', (e) => e.stopPropagation())

  let count = 0
  const isOn = () => !!anyNode.properties?.[GRID_PROP]
  const apply = () => {
    const on = isOn() && count > 1
    preview.dataset.grid = on ? '1' : ''
    button.dataset.on = isOn() ? '1' : ''
    button.title = isOn() ? t('v2.pickerSingleView') : t('v2.pickerGridView')
    button.style.display = count > 1 ? '' : 'none'
  }

  button.addEventListener('click', (e) => {
    e.stopPropagation()
    anyNode.properties = anyNode.properties ?? {}
    anyNode.properties[GRID_PROP] = !isOn()
    apply()
  })

  const prevConf = anyNode.onConfigure
  anyNode.onConfigure = function (...args: unknown[]) {
    prevConf?.apply(this, args)
    queueMicrotask(apply)
  }

  const render = (list: Array<{ url: string }>, picked: number) => {
    count = list.length
    apply()
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`
    grid.style.gridTemplateRows = `repeat(${Math.ceil(count / cols)}, minmax(72px, 1fr))`
    grid.replaceChildren()
    for (let i = 0; i < count; i++) {
      const cell = document.createElement('button')
      cell.className = 'v2-picker-grid__cell'
      if (i + 1 === picked) cell.dataset.current = '1'
      const im = document.createElement('img')
      im.src = thumbUrl((app as any).api.apiURL(list[i].url.replace(/^\/api/, '')), THUMB_CELL)
      im.loading = 'lazy'
      im.decoding = 'async'
      const n = document.createElement('span')
      n.className = 'v2-picker-grid__n'
      n.textContent = String(i + 1)
      const rm = document.createElement('div')
      rm.className = 'v2-strip__x'
      rm.textContent = '×'
      rm.title = t('v2.removeItem')
      rm.addEventListener('pointerdown', (e) => e.stopPropagation())
      rm.addEventListener('click', (e) => {
        e.stopPropagation()
        opts.onRemove(i + 1)
      })
      cell.append(im, n, rm)
      cell.addEventListener('pointerdown', (e) => e.stopPropagation())
      cell.addEventListener('click', (e) => {
        e.stopPropagation()
        opts.onPick(i + 1)
      })
      cell.addEventListener('dblclick', (e) => {
        e.stopPropagation()
        anyNode.properties[GRID_PROP] = false
        apply()
      })
      grid.appendChild(cell)
    }
  }

  apply()
  return { button, render }
}

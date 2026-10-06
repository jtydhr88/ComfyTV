import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { installLinkDragHover } from './nodeDrag'

function card() {
  const root = document.createElement('div')
  root.setAttribute('data-node-id', '7')
  root.setAttribute('data-v2-shell', '')
  root.innerHTML = '<div data-testid="node-body-7"><div><div class="in"></div><div class="ml-auto out"></div></div></div>'
  document.body.appendChild(root)
  return { root, input: root.querySelector<HTMLElement>('.in')!, output: root.querySelector<HTMLElement>('.out')! }
}

describe('V2 slot clusters during a canvas link drag', () => {
  const canvas = (app as any).canvas
  let under: Element | null = null

  beforeEach(() => {
    document.elementFromPoint = () => under
    installLinkDragHover()
  })

  afterEach(() => {
    canvas.linkConnector = undefined
    document.dispatchEvent(new PointerEvent('pointermove'))
    document.body.innerHTML = ''
  })

  it('reveals the card and opens the cluster on the side the link is heading to', () => {
    const { root, input, output } = card()
    canvas.linkConnector = { isConnecting: true, state: { connectingTo: 'input' } }
    under = input
    document.dispatchEvent(new PointerEvent('pointermove'))
    expect(root.hasAttribute('data-v2-link-hover')).toBe(true)
    expect(input.classList.contains('v2-open')).toBe(true)

    under = output
    document.dispatchEvent(new PointerEvent('pointermove'))
    expect(input.classList.contains('v2-open')).toBe(false)
    expect(output.classList.contains('v2-open')).toBe(false)

    canvas.linkConnector.state.connectingTo = 'output'
    document.dispatchEvent(new PointerEvent('pointermove'))
    expect(output.classList.contains('v2-open')).toBe(true)
  })

  it('connects a canvas drag dropped on a slot outside the node box instead of leaving it to the search box', () => {
    const { input } = card()
    const surface = document.createElement('canvas')
    document.body.appendChild(surface)
    const node = { isPointInside: vi.fn(() => false) }
    const connector = { isConnecting: true, state: { connectingTo: 'input' }, dropOnNode: vi.fn(), reset: vi.fn() }
    Object.assign(canvas, {
      canvas: surface,
      linkConnector: connector,
      ds: { convertCanvasToOffset: (p: number[]) => p },
      graph: { getNodeById: vi.fn(() => node) },
    })
    under = input

    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 6 }))
    expect(connector.dropOnNode).not.toHaveBeenCalled()

    node.isPointInside.mockReturnValueOnce(true)
    surface.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 6, bubbles: true }))
    expect(connector.dropOnNode).not.toHaveBeenCalled()

    surface.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 6, bubbles: true }))
    expect(canvas.graph.getNodeById).toHaveBeenCalledWith('7')
    expect(connector.dropOnNode).toHaveBeenCalledWith(node, { canvasX: 5, canvasY: 6 })
    expect(connector.reset).toHaveBeenCalled()
  })

  it('clears everything once the drag ends', () => {
    const { root, input } = card()
    canvas.linkConnector = { isConnecting: true, state: { connectingTo: 'input' } }
    under = input
    document.dispatchEvent(new PointerEvent('pointermove'))
    document.dispatchEvent(new PointerEvent('pointerup'))
    expect(root.hasAttribute('data-v2-link-hover')).toBe(false)
    expect(input.classList.contains('v2-open')).toBe(false)

    canvas.linkConnector.isConnecting = false
    document.dispatchEvent(new PointerEvent('pointermove'))
    expect(input.classList.contains('v2-open')).toBe(false)
  })
})

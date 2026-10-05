import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

import { installV2Lod, registerCull, uninstallV2Lod } from './lodV2'

const frame = () => new Promise(r => requestAnimationFrame(() => r(null)))

function playingVideo(parent: HTMLElement): HTMLVideoElement {
  const v = document.createElement('video')
  v.pause = vi.fn()
  parent.appendChild(v)
  return v
}

describe('V2 LOD playback', () => {
  const canvas = (app as any).canvas

  beforeEach(() => {
    canvas.ds = { scale: 1 }
    canvas.visible_area = [0, 0, 1000, 1000]
  })

  afterEach(() => {
    uninstallV2Lod()
    document.body.innerHTML = ''
  })

  it('pauses videos on cards that swap to a poster at far zoom', async () => {
    const card = document.createElement('div')
    card.className = 'v2-card'
    card.setAttribute('data-v2-lod-media', '')
    document.body.appendChild(card)
    const postered = playingVideo(card)
    const other = playingVideo(document.body)
    installV2Lod()
    await frame()
    expect(postered.pause).not.toHaveBeenCalled()

    canvas.ds.scale = 0.3
    await frame()
    await frame()
    expect(postered.pause).toHaveBeenCalled()
    expect(other.pause).not.toHaveBeenCalled()
  })

  it('pauses videos on a card culled offscreen', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const video = playingVideo(root)
    const node = { pos: [100, 100], size: [200, 200] }
    const unregister = registerCull(node, root)
    installV2Lod()
    await frame()
    expect(video.pause).not.toHaveBeenCalled()

    node.pos = [5000, 100]
    await frame()
    await frame()
    expect(root.style.visibility).toBe('hidden')
    expect(video.pause).toHaveBeenCalled()
    unregister()
  })
})

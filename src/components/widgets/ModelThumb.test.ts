import { screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'

const mocks = vi.hoisted(() => ({
  findModelPreviewUrl: vi.fn(async (_src: string): Promise<string | null> => null),
  listeners: [] as Array<(name: string, url: string) => void>,
}))

vi.mock('@/api/nativeAssets', () => ({
  findModelPreviewUrl: mocks.findModelPreviewUrl,
  modelLookupName: (s: string) => s.split('/').pop() ?? s,
  onModelPreviewChanged: (fn: (name: string, url: string) => void) => {
    mocks.listeners.push(fn)
    return () => {
      const i = mocks.listeners.indexOf(fn)
      if (i >= 0) mocks.listeners.splice(i, 1)
    }
  },
}))

import ModelThumb from './ModelThumb.vue'

beforeEach(() => {
  mocks.findModelPreviewUrl.mockReset()
  mocks.findModelPreviewUrl.mockResolvedValue(null)
  mocks.listeners.length = 0
})

describe('ModelThumb', () => {
  it('renders the fallback slot while no thumbnail exists', async () => {
    renderWithPlugins(ModelThumb, {
      props: { src: '3d/robot.glb' },
      slots: { default: '<span data-testid="fallback">box</span>' },
    })
    await waitFor(() => expect(mocks.findModelPreviewUrl).toHaveBeenCalledWith('3d/robot.glb'))
    expect(screen.getByTestId('fallback')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('renders the resolved thumbnail image', async () => {
    mocks.findModelPreviewUrl.mockResolvedValue('/api/assets/p1/content')
    renderWithPlugins(ModelThumb, { props: { src: '3d/robot.glb', alt: 'robot' } })
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', '/api/assets/p1/content')
    expect(img).toHaveAttribute('alt', 'robot')
  })

  it('re-resolves when src changes', async () => {
    mocks.findModelPreviewUrl.mockResolvedValueOnce(null)
    mocks.findModelPreviewUrl.mockResolvedValueOnce('/api/assets/p2/content')
    const { rerender } = renderWithPlugins(ModelThumb, { props: { src: '3d/a.glb' } })
    await waitFor(() => expect(mocks.findModelPreviewUrl).toHaveBeenCalledTimes(1))
    await rerender({ src: '3d/b.glb' })
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', '/api/assets/p2/content')
  })

  it('updates live when a preview is persisted for its model', async () => {
    renderWithPlugins(ModelThumb, { props: { src: '3d/robot.glb' } })
    await waitFor(() => expect(mocks.listeners.length).toBe(1))

    mocks.listeners[0]('other.glb', '/api/assets/px/content')
    expect(screen.queryByRole('img')).toBeNull()

    mocks.listeners[0]('robot.glb', '/api/assets/p3/content')
    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', '/api/assets/p3/content')
  })

  it('unsubscribes from preview updates on unmount', async () => {
    const { unmount } = renderWithPlugins(ModelThumb, { props: { src: '3d/robot.glb' } })
    await waitFor(() => expect(mocks.listeners.length).toBe(1))
    unmount()
    expect(mocks.listeners.length).toBe(0)
  })
})

import { screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderWithPlugins } from '@/__tests__/renderHelpers'

import ValuePreview from './ValuePreview.vue'

describe('ValuePreview — type-driven branches', () => {
  it('shows the empty label when content is null', () => {
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_TEXT', content: null, emptyLabel: '— nothing yet —' },
    })
    expect(screen.getByText('— nothing yet —')).toBeInTheDocument()
  })

  it('renders TEXT content as plain text', () => {
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_TEXT', content: 'hello world' },
    })
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders IMAGE as an <img> with the right src + alt', () => {
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_IMAGE', content: '/view?filename=a.png' },
    })
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', '/view?filename=a.png')
    expect(img).toHaveAttribute('alt', '/view?filename=a.png')
  })

  it('IMAGE in non-compact mode shows the action toolbar (viewFull + download)', () => {
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_IMAGE', content: '/view?filename=a.png' },
    })
    expect(screen.getByTitle(/view full/i)).toBeInTheDocument()
    expect(screen.getByTitle(/download/i)).toBeInTheDocument()
  })

  it('IMAGE in compact mode hides the action toolbar', () => {
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_IMAGE', content: '/view?filename=a.png', compact: true },
    })
    expect(screen.queryByTitle(/view full/i)).not.toBeInTheDocument()
  })

  it('renders STORYBOARD JSON as a list of shots', () => {
    const payload = JSON.stringify({
      shots: [
        { shot_no: '1', duration: '3s', prompt: 'opening' },
        { shot_no: '2', duration: '2s', prompt: 'closeup' },
      ],
    })
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_STORYBOARD', content: payload },
    })
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('opening')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('closeup')).toBeInTheDocument()
  })

  it('STORYBOARD compact mode shows a count chip + truncated list', () => {
    const payload = JSON.stringify({
      shots: [
        { shot_no: '1', prompt: 'a' }, { shot_no: '2', prompt: 'b' },
        { shot_no: '3', prompt: 'c' }, { shot_no: '4', prompt: 'd' },
      ],
    })
    const { container } = renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_STORYBOARD', content: payload, compact: true },
    })
    expect(container.querySelector('.vp-sb-count')?.textContent).toBe('4')
    expect(container.querySelectorAll('.vp-sb-item')).toHaveLength(3)
    expect(container.querySelector('.vp-sb-more')?.textContent).toContain('1 more')
  })

  it('IMAGES batch renders one cell per item', () => {
    const payload = JSON.stringify({
      images: [
        { index: '1', label: 'left',  image_url: '/view?f=l.png' },
        { index: '2', label: 'right', image_url: '/view?f=r.png' },
      ],
    })
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_IMAGES', content: payload },
    })
    const imgs = screen.getAllByRole('img')
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute('src', '/view?f=l.png')
    expect(imgs[1]).toHaveAttribute('src', '/view?f=r.png')
  })

  it('emits item-click with the cell payload when clickMode=pick', async () => {
    const payload = JSON.stringify({
      images: [{ index: '1', label: 'first', prompt: 'p1', image_url: '/view?f=1.png' }],
    })
    const { emitted } = renderWithPlugins(ValuePreview, {
      props: {
        type: 'COMFYTV_IMAGES', content: payload, clickMode: 'pick',
      },
    })
    await userEvent.click(screen.getAllByRole('button')[0])
    const events = emitted('item-click') as Array<[any]>
    expect(events).toHaveLength(1)
    expect(events[0][0]).toEqual({
      index: '1', label: 'first', prompt: 'p1', imageUrl: '/view?f=1.png',
    })
  })

  it('IMAGES with non-pick clickMode renders cells as plain divs (no buttons)', () => {
    const payload = JSON.stringify({
      images: [{ index: '1', image_url: '/x' }],
    })
    renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_IMAGES', content: payload, clickMode: 'refine' },
    })
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })

  it('TIMELINE compact mode shows the segment count', () => {
    const payload = JSON.stringify({
      segments: [{ length: 24 }, { length: 30 }, { length: 18 }],
    })
    const { container } = renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_TIMELINE', content: payload, compact: true },
    })
    expect(container.querySelector('.vp-compact-count-text')?.textContent).toBe('3')
  })

  it('VIDEO renders a <video> element with controls', () => {
    const { container } = renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_VIDEO', content: '/view?filename=clip.mp4' },
    })
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', '/view?filename=clip.mp4')
    expect(video).toHaveAttribute('controls')
  })

  it('AUDIO renders an <audio> element', () => {
    const { container } = renderWithPlugins(ValuePreview, {
      props: { type: 'COMFYTV_AUDIO', content: '/view?filename=a.mp3' },
    })
    expect(container.querySelector('audio')).toBeInTheDocument()
  })
})

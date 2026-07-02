import { describe, it, expect, vi, beforeEach } from 'vitest'

const show = vi.fn()
const close = vi.fn()

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ show, close }),
}))
vi.mock('@/i18n', () => ({ i18n: { global: { t: (k: string) => k } } }))
vi.mock('@/components/dialog/LinkWorkflowDialog.vue', () => ({ default: {} }))

import { openLinkWorkflow } from './openLinkWorkflow'

describe('openLinkWorkflow', () => {
  beforeEach(() => { show.mockReset(); close.mockReset() })

  it('shows the picker dialog with the kind and callbacks', () => {
    const onLinked = vi.fn()
    openLinkWorkflow('image', { onLinked })
    expect(show).toHaveBeenCalledTimes(1)
    const opts = show.mock.calls[0]![0]
    expect(opts.props.kind).toBe('image')
    expect(opts.props.onLinked).toBe(onLinked)
    expect(typeof opts.props.onClose).toBe('function')
  })

  it('defaults onLinked when omitted', () => {
    openLinkWorkflow('video')
    const opts = show.mock.calls[0]![0]
    expect(opts.props.kind).toBe('video')
    expect(typeof opts.props.onLinked).toBe('function')
    expect(() => opts.props.onLinked({ label: 'X' })).not.toThrow()
  })

  it('onClose closes the dialog', () => {
    openLinkWorkflow('image')
    show.mock.calls[0]![0].props.onClose()
    expect(close).toHaveBeenCalled()
  })
})

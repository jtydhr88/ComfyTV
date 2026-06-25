import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkThemeTokens } from './devTokenCheck'

const ORIGINAL_ENV = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_ENV
  document.documentElement.removeAttribute('style')
  vi.restoreAllMocks()
})

describe('checkThemeTokens', () => {
  it('does nothing in production', () => {
    process.env.NODE_ENV = 'production'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    checkThemeTokens()
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns about missing theme tokens in non-production', () => {
    process.env.NODE_ENV = 'development'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    checkThemeTokens()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('theme tokens not found')
  })

  it('does not warn when all tokens are defined', () => {
    process.env.NODE_ENV = 'development'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const spy = vi
      .spyOn(window, 'getComputedStyle')
      .mockReturnValue({ getPropertyValue: () => 'somevalue' } as unknown as CSSStyleDeclaration)
    checkThemeTokens()
    expect(warn).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

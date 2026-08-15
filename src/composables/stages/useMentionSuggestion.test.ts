import { describe, expect, it } from 'vitest'

import { mentionPrefixAllowed } from './useMentionSuggestion'

describe('mentionPrefixAllowed', () => {
  it('allows start of text', () => {
    expect(mentionPrefixAllowed('')).toBe(true)
  })

  it('allows whitespace and newline', () => {
    expect(mentionPrefixAllowed(' ')).toBe(true)
    expect(mentionPrefixAllowed('\n')).toBe(true)
  })

  it('allows CJK directly before @', () => {
    expect(mentionPrefixAllowed('猫')).toBe(true)
    expect(mentionPrefixAllowed('，')).toBe(true)
    expect(mentionPrefixAllowed('。')).toBe(true)
  })

  it('allows punctuation and chips', () => {
    expect(mentionPrefixAllowed(',')).toBe(true)
    expect(mentionPrefixAllowed('(')).toBe(true)
    expect(mentionPrefixAllowed('￼')).toBe(true)
  })

  it('blocks latin letters and digits (email-like)', () => {
    expect(mentionPrefixAllowed('o')).toBe(false)
    expect(mentionPrefixAllowed('Z')).toBe(false)
    expect(mentionPrefixAllowed('9')).toBe(false)
  })
})

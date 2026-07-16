import { describe, expect, it } from 'vitest'

import { renderMarkdownToHtml } from './markdown'

describe('renderMarkdownToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdownToHtml('')).toBe('')
  })

  it('renders basic markdown to HTML', () => {
    const html = renderMarkdownToHtml('Some **bold** and *italic* text')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders links opening in a new tab with rel protection', () => {
    const html = renderMarkdownToHtml('[docs](https://example.com/docs)')
    expect(html).toContain('href="https://example.com/docs"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('>docs</a>')
  })

  it('includes the title attribute when the link has one', () => {
    const html = renderMarkdownToHtml('[docs](https://example.com "Docs Home")')
    expect(html).toContain('title="Docs Home"')
  })

  it('omits the title attribute when the link has none', () => {
    const html = renderMarkdownToHtml('[docs](https://example.com)')
    expect(html).not.toContain('title=')
  })

  it('renders inline markdown inside link text', () => {
    const html = renderMarkdownToHtml('[**bold** link](https://example.com)')
    expect(html).toContain('<strong>bold</strong> link</a>')
  })

  it('renders multiple links each with their own href', () => {
    const html = renderMarkdownToHtml('[a](https://a.example) and [b](https://b.example)')
    expect(html).toContain('href="https://a.example"')
    expect(html).toContain('href="https://b.example"')
  })

  it('keeps plain text content intact', () => {
    const html = renderMarkdownToHtml('just plain text')
    expect(html).toContain('just plain text')
  })
})

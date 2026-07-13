import DOMPurify from 'dompurify'
import { Renderer, marked } from 'marked'

const renderer = new Renderer()
renderer.link = ({ href, title, tokens, text }) => {
  const linkText = tokens ? renderer.parser.parseInline(tokens) : text
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`
}

export function renderMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''
  const html = marked.parse(markdown, { renderer, gfm: true }) as string
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'rel'] })
}

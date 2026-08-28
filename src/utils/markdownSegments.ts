import { marked } from 'marked'

export type MarkdownSegment =
  | { type: 'prose'; raw: string }
  | { type: 'code'; code: string; lang: string }

export interface MediaRef {
  kind: 'image' | 'video' | 'audio'
  url: string
}

const VIDEO_EXT = /\.(mp4|webm|mov|mkv)$/i
const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|opus)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i

function mediaKind(url: string): MediaRef['kind'] | null {
  const path = url.split(/[?#]/)[0] ?? ''
  if (VIDEO_EXT.test(path)) return 'video'
  if (AUDIO_EXT.test(path)) return 'audio'
  if (IMAGE_EXT.test(path)) return 'image'
  return null
}

export function extractMediaRefs(raw: string): MediaRef[] {
  const refs: MediaRef[] = []
  const seen = new Set<string>()
  const push = (url: string, inlineImage: boolean) => {
    const kind = mediaKind(url)
    if (!kind || seen.has(url)) return
    seen.add(url)
    if (kind === 'image' && inlineImage) return
    refs.push({ kind, url })
  }
  const linkRe = /(!?)\[[^\]]*]\(([^()\s]+)(?:\s+"[^"]*")?\)/g
  for (const match of raw.matchAll(linkRe)) {
    push(match[2] ?? '', match[1] === '!')
  }
  const bareRe = /https?:\/\/[^\s<>")\]]+/g
  for (const match of raw.matchAll(bareRe)) {
    push(match[0] ?? '', false)
  }
  return refs
}

export function segmentMarkdown(text: string): MarkdownSegment[] {
  if (!text) return []
  let tokens
  try {
    tokens = marked.lexer(text)
  } catch {
    return [{ type: 'prose', raw: text }]
  }
  const segments: MarkdownSegment[] = []
  let prose = ''
  const flush = () => {
    if (prose.trim()) segments.push({ type: 'prose', raw: prose })
    prose = ''
  }
  for (const token of tokens) {
    if (token.type === 'code') {
      flush()
      segments.push({
        type: 'code',
        code: token.text ?? '',
        lang: String(token.lang ?? '').trim().split(/\s+/)[0] ?? '',
      })
    } else {
      prose += token.raw ?? ''
    }
  }
  flush()
  return segments
}

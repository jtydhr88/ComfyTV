export const LABEL_RE = /^[\p{L}_][\p{L}\p{N}_-]*$/u

export const MENTION_RE = /@([\p{L}_][\p{L}\p{N}_-]*)/gu

export function isValidLabel(s: string): boolean {
  return LABEL_RE.test(s)
}

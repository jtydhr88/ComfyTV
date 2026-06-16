export function promptSegments(prompt: string): string[] {
  return prompt.split(',').map(s => s.trim()).filter(Boolean)
}

function runStart(segs: string[], tokens: string[]): number {
  if (tokens.length === 0) return -1
  for (let i = 0; i + tokens.length <= segs.length; i++) {
    if (tokens.every((t, j) => segs[i + j].toLowerCase() === t.toLowerCase())) return i
  }
  return -1
}

export function hasToken(prompt: string, token: string): boolean {
  return runStart(promptSegments(prompt), promptSegments(token)) >= 0
}

export function toggleToken(prompt: string, token: string): string {
  const segs = promptSegments(prompt)
  const tokens = promptSegments(token)
  if (tokens.length === 0) return segs.join(', ')
  const at = runStart(segs, tokens)
  if (at >= 0) {
    segs.splice(at, tokens.length)
    return segs.join(', ')
  }
  return [...segs, ...tokens].join(', ')
}

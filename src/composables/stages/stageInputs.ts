import type { ResolvedInput } from '@/stores/stageStore'

export function pickSourceImageUrl(inputs: ResolvedInput[], slot = 'image'): string | null {
  const inp = inputs.find(i => i.slot === slot)
  if (!inp || inp.source !== 'upstream' || !inp.content) return null
  return inp.content
}

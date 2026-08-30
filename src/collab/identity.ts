import { z } from 'zod'

import { apiFetch } from '@/api'

const NAME_KEY = 'comfytv:collab:name'

const ADJECTIVES = [
  'Amber', 'Bold', 'Calm', 'Dapper', 'Eager', 'Fuzzy', 'Gentle', 'Happy',
  'Ivory', 'Jolly', 'Keen', 'Lucky', 'Mellow', 'Nimble', 'Plucky', 'Quiet',
]

const ANIMALS = [
  'Badger', 'Crane', 'Dolphin', 'Egret', 'Falcon', 'Gecko', 'Heron', 'Ibis',
  'Jackal', 'Koala', 'Lynx', 'Marten', 'Newt', 'Otter', 'Puffin', 'Raven',
]

const SessionSchema = z.object({ sid: z.string() })

export function hashToInt(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export function colorForSid(sid: string): string {
  const hue = (hashToInt(sid) % 37) * 10
  return `hsl(${hue}, 80%, 62%)`
}

export function randomName(): string {
  const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)]
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`
}

export function loadName(): string {
  try {
    const stored = localStorage.getItem(NAME_KEY)
    if (stored?.trim()) return stored.trim().slice(0, 40)
  } catch { /* storage unavailable */ }
  const name = randomName()
  saveName(name)
  return name
}

export function saveName(name: string): void {
  try { localStorage.setItem(NAME_KEY, name.trim().slice(0, 40)) } catch { /* ignore */ }
}

export async function fetchCollabSession(): Promise<string> {
  const res = await apiFetch('/comfytv/collab/session', SessionSchema)
  return res.sid
}

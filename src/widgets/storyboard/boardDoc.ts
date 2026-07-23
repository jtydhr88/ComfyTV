export interface StoryBoardData {
  uid: string
  newShot: boolean
  durationMs: number | null
  dialogue: string
  action: string
  notes: string
  scenePurpose: string
  character: string
  shotSize: string
  imagePrompt: string
  motionPrompt: string
  refUrl: string | null
  layerState: unknown | null
  compositeUrl: string | null
}

export interface StoryboardDoc {
  version: 1
  width: number
  height: number
  defaultBoardTimingMs: number
  boards: StoryBoardData[]
}

const UID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateBoardUid(): string {
  let out = ''
  for (let i = 0; i < 5; i++) out += UID_ALPHABET[Math.floor(Math.random() * UID_ALPHABET.length)]
  return out
}

export function createBoard(partial?: Partial<StoryBoardData>): StoryBoardData {
  return {
    uid: generateBoardUid(),
    newShot: false,
    durationMs: null,
    dialogue: '',
    action: '',
    notes: '',
    scenePurpose: '',
    character: '',
    shotSize: '',
    imagePrompt: '',
    motionPrompt: '',
    refUrl: null,
    layerState: null,
    compositeUrl: null,
    ...partial,
  }
}

export function createDoc(width = 1280, height = 720): StoryboardDoc {
  return { version: 1, width, height, defaultBoardTimingMs: 2000, boards: [] }
}

export function parseDoc(raw: string): StoryboardDoc | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw || '{}')
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (!Array.isArray(o.boards)) return null
  const doc = createDoc(
    Number.isFinite(Number(o.width)) && Number(o.width) > 0 ? Number(o.width) : 1280,
    Number.isFinite(Number(o.height)) && Number(o.height) > 0 ? Number(o.height) : 720,
  )
  const timing = Number(o.defaultBoardTimingMs)
  if (Number.isFinite(timing) && timing >= 100) doc.defaultBoardTimingMs = timing
  doc.boards = (o.boards as Array<Record<string, unknown>>).map((b) => {
    const dur = Number(b.durationMs)
    return createBoard({
      uid: typeof b.uid === 'string' && b.uid ? b.uid : generateBoardUid(),
      newShot: b.newShot === true,
      durationMs: Number.isFinite(dur) && dur >= 100 ? dur : null,
      dialogue: String(b.dialogue ?? ''),
      action: String(b.action ?? ''),
      notes: String(b.notes ?? ''),
      scenePurpose: String(b.scenePurpose ?? ''),
      character: String(b.character ?? ''),
      shotSize: String(b.shotSize ?? ''),
      imagePrompt: String(b.imagePrompt ?? ''),
      motionPrompt: String(b.motionPrompt ?? ''),
      refUrl: typeof b.refUrl === 'string' && b.refUrl ? b.refUrl : null,
      layerState: b.layerState && typeof b.layerState === 'object' ? b.layerState : null,
      compositeUrl: typeof b.compositeUrl === 'string' && b.compositeUrl ? b.compositeUrl : null,
    })
  })
  return doc
}

export function serializeDoc(doc: StoryboardDoc): string {
  return JSON.stringify(doc)
}

export function boardDurationMs(doc: StoryboardDoc, board: StoryBoardData): number {
  return board.durationMs ?? doc.defaultBoardTimingMs
}

export function totalDurationMs(doc: StoryboardDoc): number {
  return doc.boards.reduce((sum, b) => sum + boardDurationMs(doc, b), 0)
}

function shotLetters(n: number): string {
  let out = ''
  let v = n
  do {
    out = String.fromCharCode(65 + (v % 26)) + out
    v = Math.floor(v / 26) - 1
  } while (v >= 0)
  return out
}

/** Storyboarder-style labels: boards share a "1A" label until the next newShot board. */
export function shotLabels(doc: StoryboardDoc): string[] {
  let shotIndex = -1
  return doc.boards.map((b, i) => {
    if (i === 0 || b.newShot) shotIndex += 1
    return `1${shotLetters(Math.max(0, shotIndex))}`
  })
}

export function boardImageUrl(board: StoryBoardData): string | null {
  return board.compositeUrl || board.refUrl || null
}

/** Images-batch JSON matching the LayerEditor/ImagePool convention. */
export function boardsToImagesJson(doc: StoryboardDoc): string {
  const labels = shotLabels(doc)
  const images: Array<{ index: number; label: string; image_url: string }> = []
  doc.boards.forEach((b, i) => {
    const url = boardImageUrl(b)
    if (!url) return
    images.push({ index: images.length + 1, label: labels[i], image_url: url })
  })
  return JSON.stringify({ images })
}

export function coverImageUrl(doc: StoryboardDoc): string {
  for (const b of doc.boards) {
    const url = boardImageUrl(b)
    if (url) return url
  }
  return ''
}

/** Deep-copy a board under a fresh uid (Storyboarder's Duplicate Board). */
export function duplicateBoardData(board: StoryBoardData): StoryBoardData {
  return {
    ...board,
    uid: generateBoardUid(),
    layerState: board.layerState ? JSON.parse(JSON.stringify(board.layerState)) : null,
  }
}

/** Map an images batch ({images:[{image_url,label}]}) onto reference boards. */
export function boardsFromImagesJson(raw: string): StoryBoardData[] {
  let obj: unknown
  try {
    obj = JSON.parse(raw || '')
  } catch {
    return []
  }
  const images = (obj as { images?: unknown })?.images
  if (!Array.isArray(images)) return []
  return images
    .filter((im: Record<string, unknown>) => typeof im?.image_url === 'string' && im.image_url)
    .map((im: Record<string, unknown>) => createBoard({
      newShot: true,
      refUrl: String(im.image_url),
      notes: typeof im.label === 'string' && im.label !== 'composite' ? im.label : '',
    }))
}

const CJK_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/g

/** Storyboarder-style reading-speed estimate for a board's dialogue. */
export function suggestedDurationMs(board: StoryBoardData): number | null {
  const text = (board.dialogue || '').trim()
  if (!text) return null
  const cjk = (text.match(CJK_RE) || []).length
  const latinWords = text.replace(CJK_RE, ' ').split(/\s+/).filter(Boolean).length
  return Math.max(1000, 500 + cjk * 150 + latinWords * 300)
}

/** Map StoryboardStage LLM shots ({shots:[...]}) onto fresh boards. */
export function boardsFromShotsJson(raw: string): StoryBoardData[] {
  let obj: unknown
  try {
    obj = JSON.parse(raw || '')
  } catch {
    return []
  }
  const shots = (obj as { shots?: unknown })?.shots
  if (!Array.isArray(shots)) return []
  return shots.map((s: Record<string, unknown>) => {
    const durS = Number(s.duration)
    return createBoard({
      newShot: true,
      durationMs: Number.isFinite(durS) && durS > 0 ? Math.round(durS * 1000) : null,
      dialogue: String(s.dialogue ?? ''),
      action: String(s.action ?? ''),
      scenePurpose: String(s.scene_purpose ?? ''),
      character: String(s.character ?? ''),
      shotSize: String(s.shot_size ?? ''),
      imagePrompt: String(s.image_prompt ?? s.prompt ?? ''),
      motionPrompt: String(s.motion_prompt ?? ''),
      refUrl: typeof s.image_url === 'string' && s.image_url ? s.image_url : null,
    })
  })
}

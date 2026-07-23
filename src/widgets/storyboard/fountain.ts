/**
 * Minimal Fountain screenplay parser — just enough for the storyboard
 * script lane: scene headings, action, character/dialogue blocks.
 * Chinese-friendly: `@Name` forces a character cue (the Fountain spec's
 * escape hatch for names that have no uppercase form).
 */
import { createBoard, type StoryBoardData } from './boardDoc'

export interface FountainDialogue {
  character: string
  text: string
}

export interface FountainScene {
  heading: string
  action: string[]
  dialogues: FountainDialogue[]
}

const SCENE_HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[. ]/i
const TRANSITION = /^(>|.*TO:$)/
const PAGE_BREAK = /^={3,}$/

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\[\[[\s\S]*?\]\]/g, '')
}

function isTitlePageLine(line: string): boolean {
  return /^[A-Za-z][A-Za-z ]*:\s*/.test(line) || /^\s{3,}\S/.test(line)
}

function isCharacterCue(line: string, nextNonBlank: string | null): boolean {
  if (!nextNonBlank) return false
  if (line.startsWith('@')) return line.length > 1
  if (!/^[A-Z0-9 .'\-()^]+$/.test(line)) return false
  if (!/[A-Z]/.test(line)) return false
  if (TRANSITION.test(line)) return false
  return true
}

function cleanCharacter(raw: string): string {
  return raw
    .replace(/^@/, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/\s*\^\s*$/, '')
    .trim()
}

export function parseFountain(text: string): FountainScene[] {
  const lines = stripComments(text.replace(/\r\n?/g, '\n')).split('\n')

  let start = 0
  if (lines.length && isTitlePageLine(lines[0]) && lines[0].includes(':')) {
    while (start < lines.length && lines[start].trim() !== '') start++
  }

  const scenes: FountainScene[] = []
  let scene: FountainScene | null = null
  let i = start

  const ensureScene = (): FountainScene => {
    if (!scene) {
      scene = { heading: '', action: [], dialogues: [] }
      scenes.push(scene)
    }
    return scene
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line || PAGE_BREAK.test(line)) {
      i++
      continue
    }
    if (line.startsWith('#') || line.startsWith('=')) {
      i++
      continue
    }

    if (SCENE_HEADING.test(line) || (line.startsWith('.') && !line.startsWith('..'))) {
      scene = {
        heading: line.replace(/^\./, '').replace(/#[^#]*#\s*$/, '').trim(),
        action: [],
        dialogues: [],
      }
      scenes.push(scene)
      i++
      continue
    }

    if (TRANSITION.test(line) && line === line.toUpperCase()) {
      i++
      continue
    }

    const prevBlank = i === start || lines[i - 1].trim() === ''
    const nextNonBlank = i + 1 < lines.length && lines[i + 1].trim() !== '' ? lines[i + 1].trim() : null
    if (prevBlank && isCharacterCue(line, nextNonBlank)) {
      const character = cleanCharacter(line)
      const parts: string[] = []
      i++
      while (i < lines.length && lines[i].trim() !== '') {
        const dl = lines[i].trim()
        if (!(dl.startsWith('(') && dl.endsWith(')'))) parts.push(dl)
        i++
      }
      if (character && parts.length) {
        ensureScene().dialogues.push({ character, text: parts.join(' ') })
      }
      continue
    }

    ensureScene().action.push(line.replace(/^!/, ''))
    i++
  }

  return scenes.filter((s) => s.heading || s.action.length || s.dialogues.length)
}

export function scenesToBoards(scenes: FountainScene[]): StoryBoardData[] {
  return scenes.map((s) => {
    const characters = [...new Set(s.dialogues.map((d) => d.character))]
    return createBoard({
      newShot: true,
      scenePurpose: s.heading,
      action: s.action.join('\n'),
      dialogue: s.dialogues.map((d) => `${d.character}: ${d.text}`).join('\n'),
      character: characters.join(', '),
    })
  })
}

export function fountainToBoards(text: string): StoryBoardData[] {
  return scenesToBoards(parseFountain(text))
}

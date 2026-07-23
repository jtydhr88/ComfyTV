import { describe, expect, it } from 'vitest'

import {
  boardDurationMs,
  boardImageUrl,
  boardsFromImagesJson,
  boardsFromShotsJson,
  boardsToImagesJson,
  coverImageUrl,
  createBoard,
  createDoc,
  duplicateBoardData,
  generateBoardUid,
  parseDoc,
  serializeDoc,
  shotLabels,
  suggestedDurationMs,
  totalDurationMs,
} from './boardDoc'

describe('boardDoc model', () => {
  it('generates 5-char uppercase uids', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateBoardUid()).toMatch(/^[A-Z0-9]{5}$/)
    }
  })

  it('round-trips through serialize/parse', () => {
    const doc = createDoc(1920, 1080)
    doc.defaultBoardTimingMs = 1500
    doc.boards.push(
      createBoard({ uid: 'AAAAA', dialogue: 'hi', durationMs: 3000, newShot: true }),
      createBoard({ uid: 'BBBBB', refUrl: '/view?f=ref.png', layerState: { width: 8, height: 8, root: { kind: 'group', children: [] } } }),
    )
    const back = parseDoc(serializeDoc(doc))!
    expect(back.width).toBe(1920)
    expect(back.defaultBoardTimingMs).toBe(1500)
    expect(back.boards).toHaveLength(2)
    expect(back.boards[0]).toMatchObject({ uid: 'AAAAA', dialogue: 'hi', durationMs: 3000, newShot: true })
    expect(back.boards[1].refUrl).toBe('/view?f=ref.png')
    expect((back.boards[1].layerState as any).width).toBe(8)
  })

  it('parseDoc rejects garbage and non-board JSON', () => {
    expect(parseDoc('not json')).toBeNull()
    expect(parseDoc('{}')).toBeNull()
    expect(parseDoc('{"boards": 3}')).toBeNull()
  })

  it('fills defaults for sparse boards and drops bad durations', () => {
    const doc = parseDoc(JSON.stringify({ boards: [{ uid: 'X', durationMs: 5 }] }))!
    expect(doc.boards[0].durationMs).toBeNull()
    expect(doc.boards[0].dialogue).toBe('')
    expect(doc.boards[0].uid).toBe('X')
  })

  it('duration falls back to defaultBoardTimingMs and totals add up', () => {
    const doc = createDoc()
    doc.boards.push(createBoard({ durationMs: 3000 }), createBoard())
    expect(boardDurationMs(doc, doc.boards[1])).toBe(2000)
    expect(totalDurationMs(doc)).toBe(5000)
  })

  it('shot labels group boards until the next newShot (Storyboarder style)', () => {
    const doc = createDoc()
    doc.boards.push(
      createBoard(),                    // 1A (first board always starts a shot)
      createBoard(),                    // 1A continuation
      createBoard({ newShot: true }),   // 1B
      createBoard(),                    // 1B
      createBoard({ newShot: true }),   // 1C
    )
    expect(shotLabels(doc)).toEqual(['1A', '1A', '1B', '1B', '1C'])
  })

  it('shot letters roll over past Z', () => {
    const doc = createDoc()
    for (let i = 0; i < 28; i++) doc.boards.push(createBoard({ newShot: true }))
    const labels = shotLabels(doc)
    expect(labels[25]).toBe('1Z')
    expect(labels[26]).toBe('1AA')
    expect(labels[27]).toBe('1AB')
  })

  it('boardImageUrl prefers composite over reference', () => {
    expect(boardImageUrl(createBoard({ compositeUrl: '/c.png', refUrl: '/r.png' }))).toBe('/c.png')
    expect(boardImageUrl(createBoard({ refUrl: '/r.png' }))).toBe('/r.png')
    expect(boardImageUrl(createBoard())).toBeNull()
  })

  it('boardsToImagesJson emits shot-labelled batch, skipping empty boards', () => {
    const doc = createDoc()
    doc.boards.push(
      createBoard({ compositeUrl: '/a.png' }),
      createBoard(),
      createBoard({ newShot: true, refUrl: '/b.png' }),
    )
    const batch = JSON.parse(boardsToImagesJson(doc))
    expect(batch.images).toEqual([
      { index: 1, label: '1A', image_url: '/a.png' },
      { index: 2, label: '1B', image_url: '/b.png' },
    ])
    expect(coverImageUrl(doc)).toBe('/a.png')
  })

  it('duplicateBoardData deep-copies the layer document under a fresh uid', () => {
    const src = createBoard({
      uid: 'AAAAA', dialogue: 'hi', durationMs: 1500,
      layerState: { width: 4, height: 4, root: { kind: 'group', children: [{ kind: 'raster', id: 'r1' }] } },
      compositeUrl: '/c.png',
    })
    const copy = duplicateBoardData(src)
    expect(copy.uid).not.toBe('AAAAA')
    expect(copy.dialogue).toBe('hi')
    expect(copy.durationMs).toBe(1500)
    expect(copy.compositeUrl).toBe('/c.png')
    expect(copy.layerState).toEqual(src.layerState)
    ;(copy.layerState as any).root.children.push({ kind: 'raster', id: 'r2' })
    expect((src.layerState as any).root.children).toHaveLength(1)
  })

  it('boardsFromImagesJson seeds one reference board per image', () => {
    const boards = boardsFromImagesJson(JSON.stringify({ images: [
      { index: 1, label: 'composite', image_url: '/a.png' },
      { index: 2, label: 'shot 2', image_url: '/b.png' },
      { index: 3, label: 'broken', image_url: '' },
    ] }))
    expect(boards).toHaveLength(2)
    expect(boards[0]).toMatchObject({ refUrl: '/a.png', newShot: true, notes: '' })
    expect(boards[1]).toMatchObject({ refUrl: '/b.png', notes: 'shot 2' })
    expect(boardsFromImagesJson('nope')).toEqual([])
  })

  it('suggestedDurationMs scales with dialogue length (CJK + latin)', () => {
    expect(suggestedDurationMs(createBoard())).toBeNull()
    const short = suggestedDurationMs(createBoard({ dialogue: '走' }))!
    expect(short).toBe(1000)
    const cjk = suggestedDurationMs(createBoard({ dialogue: '今天必须拿下这场比赛' }))!
    expect(cjk).toBe(500 + 10 * 150)
    const mixed = suggestedDurationMs(createBoard({ dialogue: 'go go 走吧' }))!
    expect(mixed).toBe(Math.max(1000, 500 + 2 * 150 + 2 * 300))
  })

  it('boardsFromShotsJson maps StoryboardStage shots onto newShot boards', () => {
    const shots = JSON.stringify({
      shots: [
        {
          shot_no: '1', duration: 4, image_url: '/ref1.png',
          scene_purpose: '开场', character: '林岳', shot_size: '全景',
          action: '走进车库', dialogue: '走吧', image_prompt: 'garage, cinematic',
          motion_prompt: 'slow pan',
        },
        { shot_no: '2', duration: 0, prompt: 'fallback prompt' },
      ],
    })
    const boards = boardsFromShotsJson(shots)
    expect(boards).toHaveLength(2)
    expect(boards[0]).toMatchObject({
      newShot: true, durationMs: 4000, refUrl: '/ref1.png',
      scenePurpose: '开场', character: '林岳', shotSize: '全景',
      action: '走进车库', dialogue: '走吧', imagePrompt: 'garage, cinematic',
      motionPrompt: 'slow pan',
    })
    expect(boards[1].durationMs).toBeNull()
    expect(boards[1].imagePrompt).toBe('fallback prompt')
    expect(boardsFromShotsJson('nope')).toEqual([])
    expect(boardsFromShotsJson('{"shots": "x"}')).toEqual([])
  })
})

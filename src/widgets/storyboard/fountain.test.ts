import { describe, expect, it } from 'vitest'

import { fountainToBoards, parseFountain, scenesToBoards } from './fountain'

const SCRIPT = `Title: 试驾
Author: Terry

INT. 车库 - 白天 #1#

老旧的车库，尘埃在光柱里浮动。

@林岳
(低声)
走吧。
今天必须拿下。

MECHANIC
Keys are on the bench.

CUT TO:

EXT. 山路 - 黄昏

引擎轰鸣。

= 这行是 synopsis，应被忽略
# 这是 section，应被忽略

.强制场景标题

[[导演备注：慢镜头]]白色赛车冲出弯道。
`

describe('parseFountain', () => {
  const scenes = parseFountain(SCRIPT)

  it('skips the title page and finds all scenes', () => {
    expect(scenes).toHaveLength(3)
    expect(scenes[0].heading).toBe('INT. 车库 - 白天')
    expect(scenes[1].heading).toBe('EXT. 山路 - 黄昏')
    expect(scenes[2].heading).toBe('强制场景标题')
  })

  it('collects action lines and strips inline notes', () => {
    expect(scenes[0].action).toEqual(['老旧的车库，尘埃在光柱里浮动。'])
    expect(scenes[2].action).toEqual(['白色赛车冲出弯道。'])
  })

  it('parses @-forced Chinese characters and uppercase cues, skipping parentheticals', () => {
    expect(scenes[0].dialogues).toEqual([
      { character: '林岳', text: '走吧。 今天必须拿下。' },
      { character: 'MECHANIC', text: 'Keys are on the bench.' },
    ])
  })

  it('drops transitions, sections and synopses', () => {
    const all = JSON.stringify(scenes)
    expect(all).not.toContain('CUT TO')
    expect(all).not.toContain('synopsis')
    expect(all).not.toContain('section')
  })

  it('handles boneyard comments and empty input', () => {
    expect(parseFountain('/* all\ncommented */')).toEqual([])
    expect(parseFountain('')).toEqual([])
  })

  it('treats plain action without headings as a single implicit scene', () => {
    const s = parseFountain('只有一行动作描述。')
    expect(s).toHaveLength(1)
    expect(s[0].heading).toBe('')
    expect(s[0].action).toEqual(['只有一行动作描述。'])
  })
})

describe('scenesToBoards', () => {
  it('maps each scene onto a newShot board with joined fields', () => {
    const boards = fountainToBoards(SCRIPT)
    expect(boards).toHaveLength(3)
    expect(boards[0]).toMatchObject({
      newShot: true,
      scenePurpose: 'INT. 车库 - 白天',
      action: '老旧的车库，尘埃在光柱里浮动。',
      character: '林岳, MECHANIC',
    })
    expect(boards[0].dialogue).toBe('林岳: 走吧。 今天必须拿下。\nMECHANIC: Keys are on the bench.')
    expect(boards[1].scenePurpose).toBe('EXT. 山路 - 黄昏')
  })

  it('deduplicates characters across dialogue blocks', () => {
    const boards = scenesToBoards([{
      heading: 'INT. X',
      action: [],
      dialogues: [
        { character: 'A', text: 'one' },
        { character: 'A', text: 'two' },
        { character: 'B', text: 'three' },
      ],
    }])
    expect(boards[0].character).toBe('A, B')
  })
})

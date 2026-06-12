import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const STAGES_DIR = path.resolve(__dirname, '..')

function readStageCards(): { file: string; src: string }[] {
  return fs
    .readdirSync(STAGES_DIR)
    .filter(f => f.endsWith('StageCard.vue') && f !== 'StageCard.vue')
    .map(f => ({ file: f, src: fs.readFileSync(path.join(STAGES_DIR, f), 'utf-8') }))
}

describe('stage cards forward `node` to <StageCard>', () => {
  const cards = readStageCards()

  it('discovers stage cards', () => {
    expect(cards.length).toBeGreaterThan(5)
  })

  for (const { file, src } of cards) {
    it(`${file} declares a node prop and forwards :node`, () => {
      expect(src).toMatch(/node\??:\s*LGraphNode/)

      const stageCardBlock = src.match(/<StageCard\b[^>]*?(?:\/>|>[^<]*<\/StageCard>)/s)
      expect(stageCardBlock, `${file}: no <StageCard ...> usage`).not.toBeNull()
      expect(stageCardBlock![0]).toMatch(/:node="node"/)
    })
  }
})

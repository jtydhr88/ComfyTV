import { describe, expect, it } from 'vitest'

import { actorOverlapWarnings, type ActorBoundsInfo } from './mcpChecks'

function box(label: string, kind: string,
             min: [number, number, number], max: [number, number, number],
             mounted = false): ActorBoundsInfo {
  return { label, kind, mounted, min, max }
}

describe('actorOverlapWarnings', () => {
  it('flags significant overlaps with a percentage', () => {
    const warnings = actorOverlapWarnings([
      box('Tree', 'tree', [0, 0, 0], [2, 4, 2]),
      box('House', 'house', [1, 0, 1], [5, 3, 5]),
      box('Rock', 'rock', [10, 0, 10], [11, 1, 11]),
    ])
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain("'Tree' (tree) overlaps 'House' (house)")
    expect(warnings[0]).toMatch(/~\d+% of the smaller one/)
  })

  it('ignores tiny touches, roads and mounted actors', () => {
    const warnings = actorOverlapWarnings([
      box('A', 'char', [0, 0, 0], [1, 2, 1]),
      box('B', 'char', [0.95, 0, 0.95], [2, 2, 2]),
      box('Road', 'road', [-10, 0, -1], [10, 0.1, 1]),
      box('Rider', 'char', [0, 0, 0], [1, 2, 1], true),
    ])
    expect(warnings).toHaveLength(0)
  })

  it('returns empty for disjoint scenes', () => {
    expect(actorOverlapWarnings([
      box('A', 'char', [0, 0, 0], [1, 2, 1]),
      box('B', 'car', [5, 0, 5], [8, 1.5, 7]),
    ])).toEqual([])
  })
})

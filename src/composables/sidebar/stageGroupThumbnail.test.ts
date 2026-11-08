import { describe, expect, it } from 'vitest'

import { renderStageGroupThumbnail } from './stageGroupThumbnail'

describe('renderStageGroupThumbnail', () => {
  it('returns null when there are no placed nodes', () => {
    expect(renderStageGroupThumbnail({ nodes: [] }, (t) => t)).toBeNull()
    expect(renderStageGroupThumbnail({ nodes: [{ id: 1 }] }, (t) => t)).toBeNull()
  })
})

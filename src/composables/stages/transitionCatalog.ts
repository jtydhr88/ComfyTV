export interface TransitionGroup {
  id: string
  names: readonly string[]
}

export const TRANSITION_GROUPS: readonly TransitionGroup[] = [
  {
    id: 'fade',
    names: ['fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadegrays', 'fadefast', 'fadeslow'],
  },
  {
    id: 'wipe',
    names: ['wipeleft', 'wiperight', 'wipeup', 'wipedown', 'wipetl', 'wipetr', 'wipebl', 'wipebr'],
  },
  {
    id: 'slide',
    names: ['slideleft', 'slideright', 'slideup', 'slidedown',
            'smoothleft', 'smoothright', 'smoothup', 'smoothdown'],
  },
  {
    id: 'shape',
    names: ['circlecrop', 'rectcrop', 'circleopen', 'circleclose',
            'vertopen', 'vertclose', 'horzopen', 'horzclose'],
  },
  {
    id: 'diagslice',
    names: ['diagtl', 'diagtr', 'diagbl', 'diagbr',
            'hlslice', 'hrslice', 'vuslice', 'vdslice'],
  },
  {
    id: 'coverreveal',
    names: ['coverleft', 'coverright', 'coverup', 'coverdown',
            'revealleft', 'revealright', 'revealup', 'revealdown'],
  },
  {
    id: 'wind',
    names: ['hlwind', 'hrwind', 'vuwind', 'vdwind'],
  },
  {
    id: 'fx',
    names: ['squeezeh', 'squeezev', 'zoomin', 'distance', 'pixelize', 'radial', 'hblur'],
  },
]

export function transitionGroupOf(name: string): string {
  for (const g of TRANSITION_GROUPS) {
    if (g.names.includes(name)) return g.id
  }
  return TRANSITION_GROUPS[0].id
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const listSkills = vi.fn()
vi.mock('@/api', () => ({
  listSkills: (...a: any[]) => listSkills(...a),
}))

import { useSkillSlash } from './useSkillSlash'

function skill(name: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    description: `${name} does things`,
    display_name: '',
    source: 'builtin',
    valid: true,
    enabled: true,
    error: '',
    ...extra,
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
  listSkills.mockResolvedValue({ skills: [
    skill('trailer-cutter'),
    skill('poster-artist', { display_name: 'Poster Artist' }),
    skill('secret', { enabled: false }),
  ] })
})

describe('useSkillSlash', () => {
  it('opens on a leading slash and lazy-loads the list once', async () => {
    const draft = ref('')
    const s = useSkillSlash(draft)
    expect(s.open.value).toBe(false)
    expect(listSkills).not.toHaveBeenCalled()
    draft.value = '/'
    await nextTick()
    await flush()
    expect(s.open.value).toBe(true)
    expect(listSkills).toHaveBeenCalledTimes(1)
    draft.value = ''
    await nextTick()
    draft.value = '/x'
    await nextTick()
    await flush()
    expect(listSkills).toHaveBeenCalledTimes(1)
  })

  it('filters by name and display name, hiding disabled skills', async () => {
    const draft = ref('/')
    const s = useSkillSlash(draft)
    await flush()
    expect(s.matches.value.map(m => m.name)).toEqual(
      ['trailer-cutter', 'poster-artist'])
    draft.value = '/poster'
    expect(s.matches.value.map(m => m.name)).toEqual(['poster-artist'])
    draft.value = '/Artist'
    expect(s.matches.value.map(m => m.name)).toEqual(['poster-artist'])
    draft.value = '/secret'
    expect(s.matches.value).toEqual([])
  })

  it('does not open mid-message or after a newline', async () => {
    const draft = ref('hello /trailer')
    const s = useSkillSlash(draft)
    expect(s.open.value).toBe(false)
    draft.value = '/trailer\nmore'
    expect(s.open.value).toBe(false)
  })

  it('pick strips the slash token and closes the palette', async () => {
    const draft = ref('/trail cut something epic')
    const s = useSkillSlash(draft)
    await flush()
    s.pick(s.matches.value[0]!)
    expect(s.selected.value?.name).toBe('trailer-cutter')
    expect(draft.value).toBe('cut something epic')
    expect(s.open.value).toBe(false)
  })

  it('pickFirst picks the top match and reports whether it did', async () => {
    const draft = ref('/poster')
    const s = useSkillSlash(draft)
    await flush()
    expect(s.pickFirst()).toBe(true)
    expect(s.selected.value?.name).toBe('poster-artist')
    expect(s.pickFirst()).toBe(false)
  })

  it('clear releases the selection', async () => {
    const draft = ref('/trailer-cutter ')
    const s = useSkillSlash(draft)
    await flush()
    s.pickFirst()
    expect(s.selected.value).not.toBeNull()
    s.clear()
    expect(s.selected.value).toBeNull()
  })

  it('retries loading after a failed fetch', async () => {
    listSkills.mockRejectedValueOnce(new Error('offline'))
    const draft = ref('/')
    const s = useSkillSlash(draft)
    await flush()
    expect(s.matches.value).toEqual([])
    draft.value = ''
    await nextTick()
    draft.value = '/'
    await nextTick()
    await flush()
    expect(listSkills).toHaveBeenCalledTimes(2)
    expect(s.matches.value.length).toBe(2)
  })
})

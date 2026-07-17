import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const upsert = vi.hoisted(() => vi.fn())
vi.mock('@/stores/entryStore', () => ({
  useEntryStore: () => ({ upsert }),
}))
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: () => ({ currentProjectId: 'proj-1' }),
}))

import type { MentionSuggestionItem } from '@/composables/stages/useMentionSuggestion'
import { mentionItemKey, useMentionList } from './useMentionList'

const IMG: MentionSuggestionItem = {
  type: 'imageSlot', slot: 2, ordinal: 1, url: null, color: '#fff',
}
const SNIP: MentionSuggestionItem = {
  type: 'snippet',
  module: { id: 'mod-1', label: 'style', body: 'oil painting' } as any,
}

function key(e: Partial<KeyboardEvent>): KeyboardEvent {
  return { preventDefault: vi.fn(), ...e } as KeyboardEvent
}

function setup(initialItems: MentionSuggestionItem[] = [IMG, SNIP], initialQuery = '') {
  const items = ref(initialItems)
  const query = ref(initialQuery)
  const command = vi.fn()
  const focusCreate = vi.fn()
  const list = useMentionList({
    items: () => items.value,
    query: () => query.value,
    command,
    focusCreate,
  })
  return { list, items, query, command, focusCreate }
}

beforeEach(() => {
  upsert.mockReset()
})

describe('mentionItemKey', () => {
  it('keys image slots by label and snippets by module id', () => {
    expect(mentionItemKey(IMG)).toBe('image_2')
    expect(mentionItemKey(SNIP)).toBe('mod-1')
  })
})

describe('useMentionList — partition + create eligibility', () => {
  it('splits items into image and snippet groups', () => {
    const { list } = setup()
    expect(list.imageItems.value).toEqual([IMG])
    expect(list.snippetItems.value).toEqual([SNIP])
  })

  it('canCreate requires a non-empty valid label query', () => {
    const { list, query } = setup()
    expect(list.canCreate.value).toBe(false)
    query.value = 'my_frag'
    expect(list.canCreate.value).toBe(true)
    query.value = '1bad'
    expect(list.canCreate.value).toBe(false)
  })
})

describe('useMentionList — selection', () => {
  it('selecting an image slot commands an imageSlot mention', () => {
    const { list, command } = setup()
    list.selectItem(0)
    expect(command).toHaveBeenCalledWith({ id: 'image_2', label: 'image_2', mentionType: 'imageSlot' })
  })

  it('selecting a snippet commands an entry mention by label', () => {
    const { list, command } = setup()
    list.selectItem(1)
    expect(command).toHaveBeenCalledWith({ id: 'style', label: 'style', mentionType: 'entry' })
  })

  it('selecting past the list opens the create form when allowed', () => {
    const { list, query, focusCreate } = setup([SNIP], 'newfrag')
    list.selectItem(1)
    expect(list.creating.value).toBe(true)
    expect(list.pendingLabel.value).toBe('newfrag')
    expect(focusCreate).toHaveBeenCalled()
    query.value = ''
    list.cancelCreate()
    list.selectItem(1)
    expect(list.creating.value).toBe(false)
  })

  it('out-of-range selection with items is a no-op', () => {
    const { list, command } = setup([], '')
    list.selectItem(0)
    expect(command).not.toHaveBeenCalled()
  })
})

describe('useMentionList — keyboard navigation', () => {
  it('arrows move the active index and reset on item/query change', async () => {
    const { list, items, query } = setup()
    expect(list.activeIndex.value).toBe(0)
    expect(list.onKeyDown(key({ key: 'ArrowDown' }))).toBe(true)
    expect(list.activeIndex.value).toBe(1)
    query.value = 'x'
    await nextTick()
    expect(list.activeIndex.value).toBe(0)
    list.onKeyDown(key({ key: 'ArrowUp' }))
    items.value = [IMG]
    await nextTick()
    expect(list.activeIndex.value).toBe(0)
  })

  it('Enter selects the active item, unknown keys fall through', () => {
    const { list, command } = setup()
    expect(list.onKeyDown(key({ key: 'Enter' }))).toBe(true)
    expect(command).toHaveBeenCalledTimes(1)
    expect(list.onKeyDown(key({ key: 'a' }))).toBe(false)
  })

  it('while creating, only Escape is claimed', () => {
    const { list } = setup([SNIP], 'frag')
    list.startCreate()
    expect(list.onKeyDown(key({ key: 'Escape' }))).toBe(true)
    expect(list.onKeyDown(key({ key: 'ArrowDown' }))).toBe(false)
  })
})

describe('useMentionList — create flow', () => {
  it('saveCreate upserts a fragment and commands the new entry', async () => {
    upsert.mockResolvedValue({ id: 42, label: 'frag' })
    const { list, command } = setup([SNIP], 'frag')
    list.startCreate()
    list.pendingContent.value = '  some content  '
    await list.saveCreate()
    expect(upsert).toHaveBeenCalledWith('proj-1', {
      kind: 'fragment',
      label: 'frag',
      content: 'some content',
    })
    expect(command).toHaveBeenCalledWith({ id: 42, label: 'frag', mentionType: 'entry' })
    expect(list.creating.value).toBe(false)
  })

  it('saveCreate refuses empty content and skips command on failed upsert', async () => {
    const { list, command } = setup([SNIP], 'frag')
    list.startCreate()
    list.pendingContent.value = '   '
    await list.saveCreate()
    expect(upsert).not.toHaveBeenCalled()

    upsert.mockResolvedValue(null)
    list.pendingContent.value = 'body'
    await list.saveCreate()
    expect(command).not.toHaveBeenCalled()
  })

  it('cancelCreate clears the pending state', () => {
    const { list } = setup([SNIP], 'frag')
    list.startCreate()
    list.pendingContent.value = 'draft'
    list.cancelCreate()
    expect(list.creating.value).toBe(false)
    expect(list.pendingLabel.value).toBe('')
    expect(list.pendingContent.value).toBe('')
  })

  it('onCreateKeydown maps Escape to cancel and Ctrl+Enter to save', async () => {
    upsert.mockResolvedValue({ id: 1, label: 'frag' })
    const { list } = setup([SNIP], 'frag')
    list.startCreate()
    list.pendingContent.value = 'body'
    const enter = key({ key: 'Enter', ctrlKey: true })
    list.onCreateKeydown(enter)
    expect(enter.preventDefault).toHaveBeenCalled()
    await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1))

    list.startCreate()
    list.onCreateKeydown(key({ key: 'Escape' }))
    expect(list.creating.value).toBe(false)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

import { makeI18n } from '@/__tests__/renderHelpers'

const { holder, entryList, stageStates, tippyDelegate } = vi.hoisted(() => ({
  holder: { options: null as any, editor: null as any },
  entryList: vi.fn((_pid: string): any[] => []),
  stageStates: new Map<any, any>(),
  tippyDelegate: vi.fn((..._a: unknown[]) => ({ destroy: vi.fn() })),
}))

vi.mock('@tiptap/vue-3', async () => {
  const { ref } = await import('vue')
  return {
    useEditor: (opts: any) => {
      holder.options = opts
      return ref(holder.editor)
    },
    EditorContent: { name: 'EditorContent', render: () => null },
    VueRenderer: class { destroy() {} },
  }
})
vi.mock('tippy.js', () => ({
  default: vi.fn(() => []),
  delegate: tippyDelegate,
}))
vi.mock('@/stores/entryStore', () => ({
  useEntryStore: () => ({ list: entryList }),
}))
vi.mock('@/stores/projectStore', () => ({
  useProjectStore: () => ({ currentProjectId: 'proj-1' }),
}))
vi.mock('@/stores/stageStore', () => ({
  useStageStore: () => ({ getStage: (n: any) => stageStates.get(n) }),
}))
vi.mock('@/stores/assetStore', () => ({
  useAssetStore: () => ({ byId: () => undefined }),
}))

import { Fragment, Schema } from '@tiptap/pm/model'

import { chipifyFragment, entryTooltipText, textToContent, useMainPromptInput } from './useMainPromptInput'

function makeFakeEditor(initialText = '') {
  const state = { text: initialText }
  const editor = {
    state,
    getText: vi.fn(() => state.text),
    commands: { setContent: vi.fn() },
    view: { dom: document.createElement('div') },
    destroy: vi.fn(),
  }
  return editor
}

function makeNode(promptValue = '', placeholder?: string) {
  return {
    widgets: [{
      name: 'main_prompt',
      value: promptValue,
      options: placeholder ? { placeholder } : {},
      callback: vi.fn(),
    }],
  } as any
}

let wrappers: VueWrapper[] = []

function setup(node: any) {
  let api!: ReturnType<typeof useMainPromptInput>
  const wrapper = mount(defineComponent({
    setup() {
      api = useMainPromptInput(() => node, { name: 'StubMentionList' })
      return () => null
    },
  }), { global: { plugins: [makeI18n()] } })
  wrappers.push(wrapper)
  return { api, wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
  holder.options = null
  holder.editor = makeFakeEditor()
  stageStates.clear()
  entryList.mockReturnValue([])
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

describe('textToContent', () => {
  it('converts @tokens into mention nodes between text runs', () => {
    const doc = textToContent('a @style b @ref2 c')
    const para = doc.content![0].content!
    expect(para).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'mention', attrs: { id: 'style', label: 'style' } },
      { type: 'text', text: ' b ' },
      { type: 'mention', attrs: { id: 'ref2', label: 'ref2' } },
      { type: 'text', text: ' c' },
    ])
  })

  it('handles leading/trailing mentions and unicode labels', () => {
    const doc = textToContent('@开头 tail')
    const para = doc.content![0].content!
    expect(para[0]).toEqual({ type: 'mention', attrs: { id: '开头', label: '开头' } })
    expect(para[1]).toEqual({ type: 'text', text: ' tail' })
  })

  it('plain text and empty strings produce simple paragraphs', () => {
    expect(textToContent('just text').content![0].content)
      .toEqual([{ type: 'text', text: 'just text' }])
    expect(textToContent('').content![0].content).toBeUndefined()
  })
})

describe('chipifyFragment', () => {
  const schema = new Schema({
    nodes: {
      doc: { content: 'block+' },
      paragraph: { group: 'block', content: 'inline*' },
      text: { group: 'inline' },
      mention: {
        group: 'inline', inline: true, atom: true,
        attrs: { id: { default: null }, label: { default: null } },
      },
    },
  })

  function para(text: string) {
    return Fragment.from(schema.nodes.paragraph.create(null, schema.text(text)))
  }

  function flatten(fragment: Fragment): Array<{ type: string; text?: string; label?: string }> {
    const out: Array<{ type: string; text?: string; label?: string }> = []
    fragment.forEach((n) => {
      if (n.isText) out.push({ type: 'text', text: n.text! })
      else if (n.type.name === 'mention') out.push({ type: 'mention', label: n.attrs.label })
      else out.push(...flatten(n.content))
    })
    return out
  }

  it('normalizes raw slot tokens in pasted text and chips them', () => {
    const out = chipifyFragment(para('以@图片#0 为主体，动作学@视频 1'))
    expect(flatten(out)).toEqual([
      { type: 'text', text: '以' },
      { type: 'mention', label: 'image_0' },
      { type: 'text', text: ' 为主体，动作学' },
      { type: 'mention', label: 'video_1' },
    ])
  })

  it('chips slot tokens glued to CJK prose without eating the prose', () => {
    const out = chipifyFragment(para('@图片#0入夜月色清冷，@图片#13肩扛纸箱'))
    expect(flatten(out)).toEqual([
      { type: 'mention', label: 'image_0' },
      { type: 'text', text: '入夜月色清冷，' },
      { type: 'mention', label: 'image_13' },
      { type: 'text', text: '肩扛纸箱' },
    ])
  })

  it('canonical tokens glued to CJK chip as slots, not as long entry labels', () => {
    const out = chipifyFragment(para('@image_2中文正文'))
    expect(flatten(out)).toEqual([
      { type: 'mention', label: 'image_2' },
      { type: 'text', text: '中文正文' },
    ])
  })

  it('chips canonical tokens and entry labels like a load would', () => {
    const out = chipifyFragment(para('a @image_2 b @style c'))
    expect(flatten(out)).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'mention', label: 'image_2' },
      { type: 'text', text: ' b ' },
      { type: 'mention', label: 'style' },
      { type: 'text', text: ' c' },
    ])
  })

  it('passes token-free text through unchanged', () => {
    const out = chipifyFragment(para('nothing to see here'))
    expect(flatten(out)).toEqual([{ type: 'text', text: 'nothing to see here' }])
  })

  it('leaves fragments alone when the schema has no mention node', () => {
    const bare = new Schema({
      nodes: {
        doc: { content: 'block+' },
        paragraph: { group: 'block', content: 'inline*' },
        text: { group: 'inline' },
      },
    })
    const frag = Fragment.from(bare.nodes.paragraph.create(null, bare.text('see @图片#0')))
    expect(flatten(chipifyFragment(frag))).toEqual([{ type: 'text', text: 'see @图片#0' }])
  })
})

describe('entryTooltipText', () => {
  const t = (key: string, args?: Record<string, unknown>) =>
    `${key}${args ? ':' + JSON.stringify(args) : ''}`
  const nodeWithSlot2 = { inputs: [{ name: 'images.image2', link: 1 }] } as any

  it('describes a wired image slot with its send ordinal', () => {
    const s = entryTooltipText('image_2', nodeWithSlot2, [], t)
    expect(s).toContain('mention.imageItemTitle')
    expect(s).toContain('"n":2')
    expect(s).toContain('mention.imageExpand')
  })

  it('flags an image slot missing from the send order', () => {
    expect(entryTooltipText('image_5', nodeWithSlot2, [], t))
      .toBe('mention.imageTooltipMissing:{"n":5}')
  })

  it('falls back to entry contents by label', () => {
    const entries = [
      { kind: 'fragment', label: 'style', content: 'oil painting' },
      { kind: 'idea', label: 'style', content: 'watercolor' },
      { kind: 'fragment', label: 'other', content: 'x' },
    ]
    expect(entryTooltipText('style', undefined, [entries[0]], t)).toBe('oil painting')
    expect(entryTooltipText('style', undefined, entries, t))
      .toBe('[fragment] oil painting\n──────\n[idea] watercolor')
    expect(entryTooltipText('nope', undefined, [], t))
      .toBe('@nope — no matching entry (will stay literal at run)')
  })
})

describe('useMainPromptInput — editor wiring', () => {
  it('seeds the editor from the widget value and exposes widget/placeholder', () => {
    const node = makeNode('hello @style', 'type here')
    const { api } = setup(node)
    expect(api.widget.value?.name).toBe('main_prompt')
    expect(api.placeholder.value).toBe('type here')
    expect(api.promptText.value).toBe('hello @style')
    expect(holder.options.content).toEqual(textToContent('hello @style'))
  })

  it('onUpdate mirrors the editor text into widget, state and promptText without firing callbacks', () => {
    const node = makeNode('old')
    const st = reactive({ mainPrompt: 'old' })
    stageStates.set(node, st)
    const { api } = setup(node)

    holder.editor.state.text = 'new text'
    holder.options.onUpdate({ editor: holder.editor })

    expect(api.promptText.value).toBe('new text')
    expect(node.widgets[0].value).toBe('new text')
    expect(node.widgets[0].callback).not.toHaveBeenCalled()
    expect(st.mainPrompt).toBe('new text')
  })

  it('applyPromptText resets the document and persists', () => {
    const node = makeNode('old')
    const st = reactive({ mainPrompt: 'old' })
    stageStates.set(node, st)
    const { api } = setup(node)

    api.applyPromptText('applied @frag')
    expect(holder.editor.commands.setContent).toHaveBeenCalledWith(
      textToContent('applied @frag'),
      { emitUpdate: false },
    )
    expect(api.promptText.value).toBe('applied @frag')
    expect(node.widgets[0].value).toBe('applied @frag')
    expect(st.mainPrompt).toBe('applied @frag')
  })

  it('external stage-state changes rewrite the editor, identical text is ignored', async () => {
    const node = makeNode('same')
    holder.editor = makeFakeEditor('same')
    const st = reactive({ mainPrompt: 'same' })
    stageStates.set(node, st)
    setup(node)

    st.mainPrompt = 'changed upstream'
    await nextTick()
    expect(holder.editor.commands.setContent).toHaveBeenCalledWith(
      textToContent('changed upstream'),
      { emitUpdate: false },
    )

    holder.editor.commands.setContent.mockClear()
    holder.editor.state.text = 'changed upstream'
    st.mainPrompt = 'changed upstream'
    await nextTick()
    expect(holder.editor.commands.setContent).not.toHaveBeenCalled()
  })

  it('installs chip tooltips on mount and tears everything down on unmount', async () => {
    const node = makeNode('x')
    const { wrapper } = setup(node)
    await nextTick()
    await Promise.resolve()
    expect(entryList).toHaveBeenCalledWith('proj-1')
    expect(tippyDelegate).toHaveBeenCalledTimes(1)
    expect(tippyDelegate.mock.calls[0][0]).toBe(holder.editor.view.dom)

    const delegateInstance = tippyDelegate.mock.results[0].value
    wrapper.unmount()
    expect(delegateInstance.destroy).toHaveBeenCalled()
    expect(holder.editor.destroy).toHaveBeenCalled()
  })

  it('tolerates a node without the main_prompt widget', () => {
    const { api } = setup({ widgets: [] })
    expect(api.widget.value).toBeUndefined()
    expect(api.placeholder.value).toBe('')
    holder.editor.state.text = 'typed'
    holder.options.onUpdate({ editor: holder.editor })
    expect(api.promptText.value).toBe('typed')
  })
})

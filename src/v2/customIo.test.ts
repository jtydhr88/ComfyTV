import { describe, expect, it } from 'vitest'

import type { ExposedWidget, GuiNode } from '@/composables/sidebar/workflowConfigCatalog'
import {
  applySlotLabels,
  classifyWidget,
  defaultInputLabel,
  exposedRefTypes,
  hasPromptInput,
  inputBySlot,
  inputKey,
  moveItem,
  outputKindOf,
  parseCustomIo,
  parseMultiOutputs,
  previewKindOf,
  slotName,
  toggleInput,
  toggleOutput,
} from '@/v2/customIo'

function widget(over: Partial<ExposedWidget>): ExposedWidget {
  return {
    node_id: '1', node_title: 'Load Image', node_type: 'LoadImage', group_title: null,
    widget_name: 'image', widget_type: 'COMBO', widget_props: {}, current_value: 'a.png',
    stage_binding: null, override_value: null, cast: null,
    ...over,
  }
}

describe('customIo', () => {
  it('classifies widgets by upload flag and type', () => {
    expect(classifyWidget(widget({ widget_props: { image_upload: true } }))).toBe('image')
    expect(classifyWidget(widget({ widget_props: { video_upload: true } }))).toBe('video')
    expect(classifyWidget(widget({ widget_props: { audio_upload: true } }))).toBe('audio')
    expect(classifyWidget(widget({ widget_props: { file_upload: true } }))).toBe('model')
    expect(classifyWidget(widget({ widget_type: 'STRING' }))).toBe('text')
    expect(classifyWidget(widget({ widget_type: 'INT' }))).toBe('param')
    expect(classifyWidget(widget({ widget_type: 'COMBO' }))).toBe('param')
    expect(classifyWidget(widget({ widget_type: 'WEIRD' }))).toBeNull()
  })

  it('maps output nodes to kinds', () => {
    expect(outputKindOf({ id: '1', type: 'SaveImage' })).toBe('image')
    expect(outputKindOf({ id: '1', type: 'SaveVideo' })).toBe('video')
    expect(outputKindOf({ id: '1', type: 'SaveGLB' })).toBe('model')
    expect(outputKindOf({ id: '1', type: 'ShowText' })).toBe('text')
    expect(outputKindOf({ id: '1', type: 'Foo', is_output: true, out_type: 'STRING' })).toBe('text')
    expect(outputKindOf({ id: '1', type: 'Foo', is_output: true, out_type: 'LATENT' })).toBeNull()
    expect(outputKindOf({ id: '1', type: 'KSampler', is_output: false, out_type: 'LATENT' })).toBeNull()
  })

  it('toggles inputs and assigns per-kind slots and keys', () => {
    let io = parseCustomIo({})
    io = toggleInput(io, widget({ node_id: '17', widget_props: { image_upload: true } }), 'image')
    io = toggleInput(io, widget({ node_id: '18', node_title: 'End', widget_props: { image_upload: true } }), 'image')
    io = toggleInput(io, widget({ node_id: '47:23', widget_name: 'text', widget_type: 'STRING', current_value: 'cat' }), 'text')
    io = toggleInput(io, widget({ node_id: '3', widget_name: 'seed', widget_type: 'INT', widget_props: { min: 0, max: 9 }, current_value: 5 }), 'param')
    expect(io.inputs.map(i => [i.kind, i.slot])).toEqual([['image', 0], ['image', 1], ['text', 0], ['param', undefined]])
    expect(io.inputs[0].required).toBe(true)
    expect(io.inputs[1].label).toBe('End')
    expect(io.inputs[2].key).toBe(inputKey('47:23', 'text'))
    expect(io.inputs[2].default).toBe('cat')
    expect(io.inputs[3].props).toEqual({ min: 0, max: 9 })
    io = toggleInput(io, widget({ node_id: '17', widget_props: { image_upload: true } }), 'image')
    expect(io.inputs.map(i => [i.node, i.slot])).toEqual([['18', 0], ['47:23', 0], ['3', undefined]])
  })

  it('keeps one output per kind and one per node', () => {
    const save: GuiNode = { id: '9', type: 'SaveImage', title: 'Final' }
    const save2: GuiNode = { id: '10', type: 'SaveImage' }
    const vid: GuiNode = { id: '92', type: 'SaveVideo' }
    let io = toggleOutput(parseCustomIo({}), save, 'image')
    io = toggleOutput(io, vid, 'video')
    expect(io.outputs.map(o => [o.node, o.kind, o.label])).toEqual([['9', 'image', 'Final'], ['92', 'video', 'SaveVideo']])
    io = toggleOutput(io, save2, 'image')
    expect(io.outputs.map(o => [o.node, o.kind])).toEqual([['9', 'image'], ['92', 'video'], ['10', 'images']])
    const save3: GuiNode = { id: '11', type: 'SaveImage' }
    io = toggleOutput(io, save3, 'image')
    expect(io.outputs.map(o => [o.node, o.kind])).toEqual([['92', 'video'], ['10', 'images'], ['11', 'image']])
    io = toggleOutput(io, save2, 'image')
    expect(io.outputs.map(o => o.node)).toEqual(['92', '11'])
  })

  it('parses stored meta and labels litegraph slots', () => {
    const io = parseCustomIo({ custom_io: {
      inputs: [
        { node: '17', input: 'image', kind: 'image', label: 'Start', slot: 0, required: true },
        { node: '3', input: 'seed', kind: 'param', ptype: 'INT' },
        { node: '5', input: 'text', kind: 'text', label: 'Prompt' },
        { node: '6', input: 'text', kind: 'text', label: 'Main', prompt: true },
      ],
      outputs: [{ node: '92', kind: 'video', label: 'Clip' }],
    } })
    expect(slotName('image', 0)).toBe('images.image0')
    expect(inputBySlot(io, 'images.image0')?.label).toBe('Start')
    expect(inputBySlot(io, 'texts.text0')?.label).toBe('Prompt')
    expect(inputBySlot(io, 'images.image1')).toBeUndefined()
    const node = {
      inputs: [{ name: 'images.image0' }, { name: 'videos.video0', label: 'old' }] as any[],
      outputs: [{ name: 'image' }, { name: 'video' }] as any[],
    }
    applySlotLabels(node, io)
    expect(node.inputs[0].label).toBe('Start')
    expect(node.inputs[1].label).toBeUndefined()
    expect(node.outputs[1].label).toBe('Clip')
    expect(node.outputs[0].label).toBeUndefined()
    expect(hasPromptInput(io)).toBe(true)
    expect(io.inputs[2].prompt).toBe(false)
    expect(io.inputs[3].prompt).toBe(true)
    expect(exposedRefTypes(io)).toEqual(['image'])
    expect(previewKindOf(io.outputs[0].kind)).toBe('video')
    expect(previewKindOf('images')).toBe('image')
  })

  it('names media inputs by kind and index unless the node has a custom title', () => {
    let io = parseCustomIo({})
    const w1 = widget({ node_id: '1', node_title: 'LoadImage', widget_props: { image_upload: true } })
    expect(defaultInputLabel(io, w1, 'image', 'Image')).toBe('Image 1')
    io = toggleInput(io, w1, 'image', defaultInputLabel(io, w1, 'image', 'Image'))
    const w2 = widget({ node_id: '2', node_title: 'LoadImage', widget_props: { image_upload: true } })
    expect(defaultInputLabel(io, w2, 'image', 'Image')).toBe('Image 2')
    expect(defaultInputLabel(io, widget({ node_id: '3', node_title: 'Hero shot', widget_props: { image_upload: true } }), 'image', 'Image')).toBe('Hero shot')
    expect(defaultInputLabel(io, widget({ node_id: '4', node_title: 'KSampler', node_type: 'KSampler', widget_name: 'seed', widget_type: 'INT' }), 'param')).toBe('KSampler.seed')
    expect(parseCustomIo({ custom_io: { inputs: [{ node: '4', input: 'seed', kind: 'param', ptype: 'INT', random: true }], outputs: [] } }).inputs[0].random).toBe(true)
  })

  it('parses multi outputs and moves items', () => {
    expect(parseMultiOutputs('{"video":"/v","image":"/i","nope":"x"}')).toEqual({ video: '/v', image: '/i' })
    expect(parseMultiOutputs('garbage')).toEqual({})
    expect(moveItem([1, 2, 3], 0, 2)).toEqual([2, 3, 1])
    expect(moveItem([1, 2, 3], 2, 9)).toEqual([1, 2, 3])
  })
})

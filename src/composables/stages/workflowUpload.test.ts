import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '@/lib/comfyApp'

const importWorkflow = vi.fn()
const getStageMeta = vi.fn()

vi.mock('@/api', () => ({ importWorkflow: (...a: any[]) => importWorkflow(...a) }))
vi.mock('@/composables/stages/stageMeta', () => ({
  getStageMeta: (...a: any[]) => getStageMeta(...a),
}))

// imported after the mocks are declared
import { addWorkflowUploadButton } from './workflowUpload'

function makeNode() {
  const widgets: any[] = []
  const node: any = {
    widgets,
    addWidget(type: string, name: string, value: unknown, callback: any) {
      const w: any = { type, name, value, callback }
      widgets.push(w)
      return w
    },
  }
  return node
}

describe('addWorkflowUploadButton', () => {
  beforeEach(() => {
    importWorkflow.mockReset()
    getStageMeta.mockReset()
    ;(app as any).graph._nodes = []
  })
  afterEach(() => {
    document.body.querySelectorAll('input[type=file]').forEach((el) => el.remove())
  })

  it('is a no-op without addWidget or wfWidget', () => {
    expect(() => addWorkflowUploadButton({}, { name: 'workflow' }, 'image')).not.toThrow()
    const node = makeNode()
    addWorkflowUploadButton(node, null, 'image')
    expect(node.widgets).toHaveLength(0)
  })

  it('adds the upload button right after the workflow widget', () => {
    const node = makeNode()
    const wf = node.addWidget('combo', 'workflow', 'A', null)
    node.addWidget('number', 'steps', 10, null) // something after wf
    addWorkflowUploadButton(node, wf, 'image')
    const names = node.widgets.map((w: any) => w.name)
    expect(names[0]).toBe('workflow')
    expect(node.widgets[1].__comfytvUpload).toBe(true)
    expect(node.widgets[1].serialize).toBe(false)
  })

  it('does not add a second button if one already exists', () => {
    const node = makeNode()
    const wf = node.addWidget('combo', 'workflow', 'A', null)
    addWorkflowUploadButton(node, wf, 'image')
    const count = node.widgets.length
    addWorkflowUploadButton(node, wf, 'image')
    expect(node.widgets.length).toBe(count)
  })

  it('installs a compacting onSerialize hook', () => {
    const node = makeNode()
    const wf = node.addWidget('combo', 'workflow', 'A', null)
    addWorkflowUploadButton(node, wf, 'image')
    expect(node.__comfytvCompactWidgets).toBe(true)
    const o: any = { widgets_values: [1, 2, 3] }
    node.onSerialize(o)
    expect(o.widgets_values).toEqual([1, 2, 3])
  })

  async function runUpload(node: any, fileText: string) {
    const wf = node.widgets.find((w: any) => w.name === 'workflow')
    const btn = node.widgets.find((w: any) => w.__comfytvUpload)
    btn.callback() // triggers doUpload(), which appends an <input>
    const input = document.body.querySelector('input[type=file]') as HTMLInputElement
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [{ name: 'wf.json', text: async () => fileText }],
    })
    await (input as any).onchange()
    return wf
  }

  it('imports a valid file, registers the option and selects it', async () => {
    importWorkflow.mockResolvedValueOnce({ label: 'NewWF' })
    getStageMeta.mockReturnValue({ workflow_kind: 'image' })

    const consumer: any = {
      comfyClass: 'ComfyTV.ImageStage',
      widgets: [{ name: 'workflow', options: { values: ['A'] } }],
    }
    ;(app as any).graph._nodes = [consumer]

    const node = makeNode()
    const wf = node.addWidget('combo', 'workflow', 'A', vi.fn())
    addWorkflowUploadButton(node, wf, 'image')

    await runUpload(node, '{"nodes":[]}')

    expect(importWorkflow).toHaveBeenCalledWith('image', 'wf.json', '{"nodes":[]}')
    expect(wf.value).toBe('NewWF')
    expect(wf.callback).toHaveBeenCalledWith('NewWF')
    expect(consumer.widgets[0].options.values).toContain('NewWF')
  })

  it('rejects an invalid JSON file without importing', async () => {
    const node = makeNode()
    const wf = node.addWidget('combo', 'workflow', 'A', null)
    addWorkflowUploadButton(node, wf, 'image')

    await runUpload(node, 'not-json{')

    expect(importWorkflow).not.toHaveBeenCalled()
    expect(wf.value).toBe('A')
  })
})

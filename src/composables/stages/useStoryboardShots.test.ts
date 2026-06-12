import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import { app } from '@/lib/comfyApp'
import type { StageState } from '@/stores/stageStore'

import { useStoryboardShots } from './useStoryboardShots'

const jsonResp = (data: any, status = 200) =>
  new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json' },
  })

function makeWidget(name: string, value: any = '') {
  return { name, value, callback: vi.fn() }
}

function makeNode(widgets: any[] = []): any {
  return { widgets, onConfigure: null as any }
}

function makeState(over: Partial<StageState> = {}): StageState {
  return reactive({
    kind: 'storyboard',
    variant: 'generator',
    outputType: 'COMFYTV_STORYBOARD',
    output: null,
    outputs: [null],
    running: false,
    inputs: [],
    mainPrompt: '',
    ...over,
  }) as StageState
}

describe('useStoryboardShots', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('add/remove/move maintain order', () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const state = makeState()
    const { shots, addShot, removeShot, move } = useStoryboardShots(node, state)
    addShot(); addShot(); addShot()
    expect(shots.value).toHaveLength(3)

    const [a, b, c] = shots.value.map(s => s.id)
    move(0, 1)
    expect(shots.value.map(s => s.id)).toEqual([b, a, c])
    removeShot(a)
    expect(shots.value.map(s => s.id)).toEqual([b, c])
  })

  it('setField writes the field and the optional mirror', () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const state = makeState()
    const { shots, addShot, setField } = useStoryboardShots(node, state)
    addShot()
    const id = shots.value[0].id
    setField(id, 'image_prompt', 'a cat', 'prompt')
    expect(shots.value[0].image_prompt).toBe('a cat')
    expect(shots.value[0].prompt).toBe('a cat')
  })

  it('setDuration clamps to [1, 60]', () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const { shots, addShot, setDuration } = useStoryboardShots(node, makeState())
    addShot()
    const id = shots.value[0].id
    setDuration(id, 0)
    expect(shots.value[0].duration).toBe(1)
    setDuration(id, 999)
    expect(shots.value[0].duration).toBe(60)
    setDuration(id, 5.7)
    expect(shots.value[0].duration).toBe(6)
  })

  it('commit writes serialized JSON to the storyboard_data widget and state.output', () => {
    const w = makeWidget('storyboard_data', '')
    const node = makeNode([w])
    const state = makeState()
    const { addShot } = useStoryboardShots(node, state)
    addShot()
    expect(w.value).not.toBe('')
    expect(w.callback).toHaveBeenCalled()
    const parsed = JSON.parse(w.value)
    expect(Array.isArray(parsed.shots)).toBe(true)
    expect(parsed.shots[0].shot_no).toBe('1')
    expect(state.output).toBe(w.value)
  })

  it('restore loads shots from the widget value on mount', () => {
    const seed = {
      shots: [
        { shot_no: '1', duration: 4, image_prompt: 'first', character: 'A' },
        { shot_no: '2', duration: 7, prompt: 'fallback prompt' },
      ],
    }
    const node = makeNode([makeWidget('storyboard_data', JSON.stringify(seed))])
    const { shots } = useStoryboardShots(node, makeState())
    expect(shots.value).toHaveLength(2)
    expect(shots.value[0].duration).toBe(4)
    expect(shots.value[0].image_prompt).toBe('first')
    expect(shots.value[0].character).toBe('A')
    expect(shots.value[1].image_prompt).toBe('fallback prompt')
    expect(shots.value[1].prompt).toBe('fallback prompt')
  })

  it('restore picks up state.output when widget is empty', () => {
    const seed = { shots: [{ shot_no: '1', duration: 3, image_prompt: 'from-state' }] }
    const node = makeNode([makeWidget('storyboard_data', '')])
    const state = makeState({ output: JSON.stringify(seed) })
    const { shots } = useStoryboardShots(node, state)
    expect(shots.value).toHaveLength(1)
    expect(shots.value[0].image_prompt).toBe('from-state')
  })

  it('watch on state.output re-loads when an upstream payload arrives', async () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const state = makeState()
    const { shots } = useStoryboardShots(node, state)
    expect(shots.value).toHaveLength(0)

    state.output = JSON.stringify({
      shots: [{ shot_no: '1', duration: 3, image_prompt: 'pushed' }],
    })
    await nextTick()
    expect(shots.value).toHaveLength(1)
    expect(shots.value[0].image_prompt).toBe('pushed')
  })

  it('setImage sets the image_url and commits', () => {
    const w = makeWidget('storyboard_data', '')
    const node = makeNode([w])
    const { shots, addShot, setImage } = useStoryboardShots(node, makeState())
    addShot()
    setImage(shots.value[0].id, '/view?x=1')
    expect(shots.value[0].image_url).toBe('/view?x=1')
    const parsed = JSON.parse(w.value)
    expect(parsed.shots[0].image_url).toBe('/view?x=1')
  })

  it('regenerateShot merges the backend response into the shot at the target index', async () => {
    const node = makeNode([
      makeWidget('storyboard_data', ''),
      makeWidget('workflow', 'qwen3'),
      makeWidget('main_prompt', 'a story'),
      makeWidget('characters', 'A, B'),
    ])
    const { shots, addShot, regenerateShot } = useStoryboardShots(node, makeState())
    addShot()
    const id = shots.value[0].id
    const originalImage = '/keep-this-image'
    shots.value[0].image_url = originalImage

    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({
      shot: {
        duration: 5,
        image_prompt: 'a regenerated scene',
        character: 'A',
        image_url: '/server-suggested-but-ignored',
      },
    }))

    await regenerateShot(id, 1)
    expect(shots.value[0].id).toBe(id)
    expect(shots.value[0].duration).toBe(5)
    expect(shots.value[0].image_prompt).toBe('a regenerated scene')
    expect(shots.value[0].character).toBe('A')
    expect(shots.value[0].image_url).toBe(originalImage)

    const [path, init] = fetchApi.mock.calls[0]
    expect(path).toBe('/comfytv/storyboard/regenerate_shot')
    const body = JSON.parse(init.body as string)
    expect(body.workflow).toBe('qwen3')
    expect(body.premise).toBe('a story')
    expect(body.characters).toBe('A, B')
    expect(body.target_shot_no).toBe(1)
  })

  it('regenerateShot serializes: regeneratingId stays pinned to the in-flight shot', async () => {
    const node = makeNode([
      makeWidget('storyboard_data', ''), makeWidget('workflow', 'x'),
      makeWidget('main_prompt', ''), makeWidget('characters', ''),
    ])
    const { shots, addShot, regenerateShot, regeneratingId } = useStoryboardShots(node, makeState())
    addShot(); addShot()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>

    let resolve!: (r: Response) => void
    fetchApi.mockReturnValueOnce(new Promise<Response>(r => { resolve = r }))

    const id1 = shots.value[0].id
    const id2 = shots.value[1].id
    const inflight = regenerateShot(id1, 1)
    expect(regeneratingId.value).toBe(id1)

    await regenerateShot(id2, 2)
    expect(regeneratingId.value).toBe(id1)

    resolve(jsonResp({ shot: { duration: 2 } }))
    await inflight
    expect(regeneratingId.value).toBeNull()
  })

  it('regenerateShot reports backend HTTP failure via toast and resets the lock', async () => {
    const toastAdd = vi.fn()
    ;(app as any).extensionManager = { toast: { add: toastAdd } }
    const node = makeNode([
      makeWidget('storyboard_data', ''), makeWidget('workflow', 'x'),
      makeWidget('main_prompt', ''), makeWidget('characters', ''),
    ])
    const { shots, addShot, regenerateShot, regeneratingId } = useStoryboardShots(node, makeState())
    addShot()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(new Response('boom', { status: 500 }))

    await regenerateShot(shots.value[0].id, 1)
    expect(toastAdd).toHaveBeenCalled()
    expect(toastAdd.mock.calls[0][0].severity).toBe('warn')
    expect(regeneratingId.value).toBeNull()
  })

  it('pickFile + onFilePicked uploads the file and writes /view URL into image_url', async () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const { shots, addShot, pickFile, fileInputEl, onFilePicked } = useStoryboardShots(node, makeState())
    addShot()
    const id = shots.value[0].id
    fileInputEl.value = { click: vi.fn() } as any
    pickFile(id)
    expect(fileInputEl.value?.click).toHaveBeenCalled()

    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockResolvedValueOnce(jsonResp({ name: 'uploaded.png' }))

    const file = new File(['data'], 'src.png', { type: 'image/png' })
    const fakeEvent = { target: { files: [file], value: 'src.png' } } as unknown as Event
    await onFilePicked(fakeEvent)
    expect(shots.value[0].image_url).toBe(
      '/view?filename=uploaded.png&subfolder=storyboard&type=input',
    )
  })

  it('onFilePicked is a no-op if no shot is pending (e.g. user picked without click)', async () => {
    const node = makeNode([makeWidget('storyboard_data', '')])
    const { shots, addShot, onFilePicked } = useStoryboardShots(node, makeState())
    addShot()
    const fetchApi = (app as any).api.fetchApi as ReturnType<typeof vi.fn>
    fetchApi.mockClear()
    const file = new File(['data'], 'x.png', { type: 'image/png' })
    const fakeEvent = { target: { files: [file], value: 'x.png' } } as unknown as Event
    await onFilePicked(fakeEvent)
    expect(fetchApi).not.toHaveBeenCalled()
    expect(shots.value[0].image_url).toBeNull()
  })
})

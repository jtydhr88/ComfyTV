import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, reactive } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'

const fakeStore = reactive({
  load: vi.fn(),
  hasRemotes: true,
  enabledServers: [] as Array<{ id: number; label: string; enabled: boolean }>,
  statusFor: vi.fn((_id: number) => undefined as any),
  byId: vi.fn((_id: number) => undefined as any),
  subscribeStatus: vi.fn(() => releaseSpy),
})
const releaseSpy = vi.fn()

vi.mock('@/stores/serverStore', () => ({
  LOCAL_SERVER: 'local',
  useServerStore: () => fakeStore,
}))

import { useStageServerSelect } from './useStageServerSelect'
import type { StageState } from '@/stores/stageStore'

function makeState(over: Partial<StageState> = {}): StageState {
  return { kind: 'image', variant: 'generator', inputs: [] as any[], ...over } as StageState
}

let wrappers: VueWrapper[] = []

function setup(state: StageState, node: any = { properties: {} }) {
  let api!: ReturnType<typeof useStageServerSelect>
  const wrapper = mount(defineComponent({
    setup() {
      api = useStageServerSelect(() => state, () => node)
      return () => null
    },
  }))
  wrappers.push(wrapper)
  return { api, wrapper, node }
}

beforeEach(() => {
  vi.clearAllMocks()
  fakeStore.hasRemotes = true
  fakeStore.enabledServers = []
  fakeStore.subscribeStatus.mockReturnValue(releaseSpy)
})

afterEach(() => {
  wrappers.forEach(w => w.unmount())
  wrappers = []
})

describe('useStageServerSelect — visibility', () => {
  it('shows only for runnable stages with a node and remotes', () => {
    expect(setup(makeState()).api.showServerSelect.value).toBe(true)
    expect(setup(makeState({ variant: 'loader' })).api.showServerSelect.value).toBe(false)
    expect(setup(makeState({ variant: 'transform' })).api.showServerSelect.value).toBe(false)
    expect(setup(makeState({ kind: 'image-picker' })).api.showServerSelect.value).toBe(false)
    expect(setup(makeState(), null).api.showServerSelect.value).toBe(false)
  })

  it('hides when there are no remotes and triggers a load on setup', () => {
    fakeStore.hasRemotes = false
    const { api } = setup(makeState())
    expect(api.showServerSelect.value).toBe(false)
    expect(fakeStore.load).toHaveBeenCalled()
  })
})

describe('useStageServerSelect — options', () => {
  it('lists local first, then enabled servers with status-aware labels', () => {
    fakeStore.enabledServers = [
      { id: 1, label: 'gpu-a', enabled: true },
      { id: 2, label: 'gpu-b', enabled: true },
      { id: 3, label: 'gpu-c', enabled: true },
    ]
    fakeStore.statusFor.mockImplementation((id: number) => {
      if (id === 2) return { online: false, running: 0, pending: 0 }
      if (id === 3) return { online: true, running: 1, pending: 2 }
      return undefined
    })
    const { api } = setup(makeState())
    const opts = api.serverOptions.value
    expect(opts[0].value).toBe('local')
    expect(opts[1]).toEqual({ value: '1', label: 'gpu-a' })
    expect(opts[2].value).toBe('2')
    expect(opts[2].label).toMatch(/^gpu-b · /)
    expect(opts[3].label).toMatch(/^gpu-c · /)
  })
})

describe('useStageServerSelect — selection', () => {
  it('defaults to local without a stored property', () => {
    const { api } = setup(makeState())
    expect(api.serverSelection.value).toBe('local')
  })

  it('resolves a stored id only while that server stays enabled', () => {
    fakeStore.byId.mockImplementation((id: number) =>
      id === 5 ? { id: 5, label: 'x', enabled: true } : undefined)
    const { api } = setup(makeState(), { properties: { comfytv_server: '5' } })
    expect(api.serverSelection.value).toBe('5')

    const disabled = setup(makeState(), { properties: { comfytv_server: '9' } })
    expect(disabled.api.serverSelection.value).toBe('local')
  })

  it('onServerPick persists onto the node and refreshes the selection', () => {
    fakeStore.byId.mockImplementation((id: number) =>
      id === 7 ? { id: 7, label: 'y', enabled: true } : undefined)
    const node: any = {}
    const { api } = setup(makeState(), node)
    api.onServerPick(7)
    expect(node.properties.comfytv_server).toBe('7')
    expect(api.serverSelection.value).toBe('7')
  })

  it('onServerPick is a no-op without a node', () => {
    const { api } = setup(makeState(), null)
    expect(() => api.onServerPick('local')).not.toThrow()
  })
})

describe('useStageServerSelect — status subscription', () => {
  it('subscribes while visible, releases when hidden and on unmount', async () => {
    const { wrapper } = setup(makeState())
    expect(fakeStore.subscribeStatus).toHaveBeenCalledTimes(1)

    fakeStore.hasRemotes = false
    await nextTick()
    expect(releaseSpy).toHaveBeenCalledTimes(1)

    fakeStore.hasRemotes = true
    await nextTick()
    expect(fakeStore.subscribeStatus).toHaveBeenCalledTimes(2)

    wrapper.unmount()
    expect(releaseSpy).toHaveBeenCalledTimes(2)
  })

  it('never subscribes when the select is never shown', () => {
    fakeStore.hasRemotes = false
    setup(makeState())
    expect(fakeStore.subscribeStatus).not.toHaveBeenCalled()
  })
})

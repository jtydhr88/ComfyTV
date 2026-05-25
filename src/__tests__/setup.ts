import { vi } from 'vitest'

vi.mock('@/lib/comfyApp', () => {
  const fetchApi = vi.fn(async (_path: string, _init?: RequestInit) => {
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  })

  return {
    app: {
      api: {
        fetchApi,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
      graph: {
        _nodes: [] as any[],
        add: vi.fn(),
        getNodeById: vi.fn(),
        links: new Map(),
      },
      graphToPrompt: vi.fn(async () => ({ output: {}, workflow: {} })),
      registerExtension: vi.fn(),
      ui: { dialog: { show: vi.fn() } },
      canvas: { setDirty: vi.fn(), selected_nodes: {} },
    },
  }
})

const originalError = console.error
console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '')
  if (msg.includes('[Vue warn]')) return
  originalError(...args)
}

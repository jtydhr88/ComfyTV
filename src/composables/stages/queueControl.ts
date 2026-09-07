export type CancelOutcome = 'deleted' | 'interrupted' | 'gone' | 'unknown'

type QueueSnapshot = { queue_running?: unknown[]; queue_pending?: unknown[] }

function holds(list: unknown, promptId: string): boolean {
  return Array.isArray(list)
    && list.some((e) => Array.isArray(e) && String(e[1]) === promptId)
}

async function readQueue(api: any): Promise<QueueSnapshot | null> {
  try {
    const r = await api.fetchApi('/queue')
    return (await r.json()) as QueueSnapshot
  } catch {
    return null
  }
}

function post(api: any, path: string, body: unknown) {
  return api.fetchApi(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function promptInQueue(api: any, promptId: string): Promise<boolean | null> {
  const q = await readQueue(api)
  if (!q) return null
  return holds(q.queue_pending, promptId) || holds(q.queue_running, promptId)
}

export async function cancelPrompt(api: any, promptId: string): Promise<CancelOutcome> {
  const q = await readQueue(api)
  if (!q) {
    await post(api, '/interrupt', { prompt_id: promptId })
    return 'unknown'
  }
  if (holds(q.queue_pending, promptId)) {
    await post(api, '/queue', { delete: [promptId] })
    return 'deleted'
  }
  if (holds(q.queue_running, promptId)) {
    await post(api, '/interrupt', { prompt_id: promptId })
    return 'interrupted'
  }
  return 'gone'
}

import { apiSend } from '@/api'
import { LatestOutputSchema } from '@/api/schemas'
import { app } from '@/lib/comfyApp'

export async function postEditText(outputId: number, text: string) {
  return (await apiSend(`/comfytv/outputs/${outputId}/edit_text`, 'POST', LatestOutputSchema, { text })).output
}

export async function postRestoreText(outputId: number) {
  return (await apiSend(`/comfytv/outputs/${outputId}/restore_text`, 'POST', LatestOutputSchema, {})).output
}

export async function postPickedIndex(outputId: number, pickedIndex: number): Promise<void> {
  try {
    const res = await app.api?.fetchApi?.(`/comfytv/outputs/${outputId}/picked_index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ picked_index: pickedIndex }),
    })
    if (res && !res.ok && res.status !== 404) {
      console.warn('[ComfyTV/pick] persist picked_index failed', res.status)
    }
  } catch (e) {
    console.warn('[ComfyTV/pick] persist picked_index threw', e)
  }
}

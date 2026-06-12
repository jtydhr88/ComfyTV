import { app } from '@/lib/comfyApp'

export interface UploadOptions {
  subfolder: string
  type?: 'input' | 'temp' | 'output'
  filename?: string
  filenamePrefix?: string
}

export interface UploadResult {
  name: string
  subfolder: string
  type: 'input' | 'temp' | 'output'
  url: string
}

export async function uploadCanvas(
  canvas: HTMLCanvasElement,
  opts: UploadOptions,
): Promise<string> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) throw new Error('canvas.toBlob returned null')
  return uploadBlob(blob, opts)
}

export async function uploadBlobNamed(blob: Blob, opts: UploadOptions): Promise<UploadResult> {
  const subfolder = opts.subfolder
  const type = opts.type ?? 'input'
  const filename = opts.filename
    ?? `${opts.filenamePrefix ?? 'comfytv'}-${Date.now()}.png`

  const body = new FormData()
  body.append('image', blob, filename)
  body.append('subfolder', subfolder)
  body.append('type', type)

  const resp = await (app as any).api.fetchApi('/upload/image', { method: 'POST', body })
  if (resp.status !== 200) {
    throw new Error(`upload ${resp.status} ${resp.statusText}`)
  }
  const data = await resp.json() as { name?: string }
  if (!data?.name) throw new Error('upload response missing `name`')

  const url = `/view?filename=${encodeURIComponent(data.name)}`
            + `&subfolder=${encodeURIComponent(subfolder)}`
            + `&type=${encodeURIComponent(type)}`
  return { name: data.name, subfolder, type, url }
}

export async function uploadBlob(blob: Blob, opts: UploadOptions): Promise<string> {
  return (await uploadBlobNamed(blob, opts)).url
}

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

export async function uploadCanvas(canvas: HTMLCanvasElement, _opts: UploadOptions): Promise<string> {
  return canvas.toDataURL('image/png')
}

export async function uploadBlobNamed(blob: Blob, opts: UploadOptions): Promise<UploadResult> {
  return {
    name: opts.filename ?? 'stub.png',
    subfolder: opts.subfolder,
    type: opts.type ?? 'input',
    url: URL.createObjectURL(blob),
  }
}

export async function uploadBlob(blob: Blob, opts: UploadOptions): Promise<string> {
  return (await uploadBlobNamed(blob, opts)).url
}

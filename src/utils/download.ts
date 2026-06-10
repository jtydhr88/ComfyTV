const DEFAULT_DOWNLOAD_FILENAME = 'download'

export function extractFilenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url, location.origin)
    return u.searchParams.get('filename')
  } catch {
    return null
  }
}

export function extractFilenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null

  const extended = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (extended?.[1]) {
    try { return decodeURIComponent(extended[1]) } catch { /* fall through */ }
  }

  const quoted = header.match(/filename="([^"]+)"/i)
  if (quoted?.[1]) return quoted[1]

  const unquoted = header.match(/filename=([^;\s]+)/i)
  if (unquoted?.[1]) return unquoted[1]

  return null
}

function triggerLinkDownload(href: string, filename: string): void {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  triggerLinkDownload(url, filename)
  queueMicrotask(() => URL.revokeObjectURL(url))
}

export async function downloadFile(url: string, filename?: string): Promise<void> {
  if (!url) throw new Error('downloadFile: empty url')

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`download fetch ${response.status} ${response.statusText}`)
  }

  const headerFilename = extractFilenameFromContentDisposition(
    response.headers.get('Content-Disposition'),
  )
  const blob = await response.blob()

  const finalName =
    filename
    || headerFilename
    || extractFilenameFromUrl(url)
    || DEFAULT_DOWNLOAD_FILENAME

  downloadBlob(finalName, blob)
}

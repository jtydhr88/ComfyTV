/**
 * Minimal zero-dependency PDF writer: one full-page JPEG per page
 * (DCTDecode passthrough). Text/CJK shaping is done by the canvas that
 * produced the JPEG, so the PDF layer never needs fonts.
 */
export interface JpegPage {
  data: Uint8Array
  width: number
  height: number
}

const enc = new TextEncoder()

export function buildPdfFromJpegPages(pages: JpegPage[], pageW: number, pageH: number): Uint8Array {
  if (!pages.length) throw new Error('no pages')

  const chunks: Uint8Array[] = []
  let offset = 0
  const offsets: number[] = [] // 1-based object byte offsets

  function push(s: string | Uint8Array): void {
    const bytes = typeof s === 'string' ? enc.encode(s) : s
    chunks.push(bytes)
    offset += bytes.length
  }
  function beginObj(num: number, body: string): void {
    offsets[num] = offset
    push(`${num} 0 obj\n${body}`)
  }
  function endObj(): void {
    push('\nendobj\n')
  }

  push('%PDF-1.4\n%\xB5\xB5\xB5\xB5\n')

  const pageObj = (i: number) => 3 + i * 3
  const imageObj = (i: number) => 4 + i * 3
  const contentObj = (i: number) => 5 + i * 3

  beginObj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  endObj()
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')
  beginObj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  endObj()

  pages.forEach((page, i) => {
    beginObj(pageObj(i),
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 ${imageObj(i)} 0 R >> >> ` +
      `/Contents ${contentObj(i)} 0 R >>`)
    endObj()

    offsets[imageObj(i)] = offset
    push(`${imageObj(i)} 0 obj\n` +
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
      `/Length ${page.data.length} >>\nstream\n`)
    push(page.data)
    push('\nendstream\nendobj\n')

    const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`
    beginObj(contentObj(i),
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    endObj()
  })

  const objCount = 2 + pages.length * 3
  const xrefStart = offset
  let xref = `xref\n0 ${objCount + 1}\n0000000000 65535 f \n`
  for (let n = 1; n <= objCount; n++) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  }
  push(xref)
  push(`trailer\n<< /Size ${objCount + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`)

  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

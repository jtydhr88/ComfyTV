import { describe, expect, it } from 'vitest'

import { buildPdfFromJpegPages } from './pdfWriter'
import { paginate } from './pdfExport'

const dec = new TextDecoder('latin1')

function fakeJpeg(seed: number, len = 64): Uint8Array {
  const d = new Uint8Array(len)
  d[0] = 0xff
  d[1] = 0xd8
  for (let i = 2; i < len; i++) d[i] = (seed * 31 + i) % 256
  d[len - 2] = 0xff
  d[len - 1] = 0xd9
  return d
}

function indexOfBytes(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}

describe('buildPdfFromJpegPages', () => {
  it('produces a structurally valid multi-page PDF', () => {
    const pdf = buildPdfFromJpegPages(
      [
        { data: fakeJpeg(1), width: 1684, height: 1190 },
        { data: fakeJpeg(2), width: 1684, height: 1190 },
      ],
      842, 595,
    )
    const text = dec.decode(pdf)

    expect(text.startsWith('%PDF-1.4')).toBe(true)
    expect(text.endsWith('%%EOF\n')).toBe(true)
    expect(text).toContain('/Type /Catalog')
    expect(text).toContain('/Count 2')
    expect(text.match(/\/Type \/Page /g)).toHaveLength(2)
    expect(text.match(/\/Filter \/DCTDecode/g)).toHaveLength(2)
    expect(text).toContain('/MediaBox [0 0 842 595]')
    expect(text).toContain('q 842 0 0 595 0 0 cm /Im0 Do Q')
  })

  it('embeds the JPEG bytes untouched', () => {
    const jpeg = fakeJpeg(7, 128)
    const pdf = buildPdfFromJpegPages([{ data: jpeg, width: 10, height: 10 }], 842, 595)
    expect(indexOfBytes(pdf, jpeg)).toBeGreaterThan(0)
    const text = dec.decode(pdf)
    expect(text).toContain(`/Length ${jpeg.length} >>`)
  })

  it('writes an xref table whose offsets land on the object headers', () => {
    const pdf = buildPdfFromJpegPages([{ data: fakeJpeg(3) }, { data: fakeJpeg(4) }].map(
      (p) => ({ ...p, width: 4, height: 4 }),
    ), 842, 595)
    const text = dec.decode(pdf)

    const xrefStart = Number(text.match(/startxref\n(\d+)\n/)![1])
    expect(text.slice(xrefStart, xrefStart + 4)).toBe('xref')

    const entries = [...text.slice(xrefStart).matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]))
    expect(entries).toHaveLength(8) // catalog + pages + 2×(page,image,content)
    entries.forEach((off, i) => {
      expect(text.slice(off).startsWith(`${i + 1} 0 obj`)).toBe(true)
    })
  })

  it('rejects an empty page list', () => {
    expect(() => buildPdfFromJpegPages([], 842, 595)).toThrow()
  })
})

describe('paginate', () => {
  it('chunks board indices into pages', () => {
    expect(paginate(7, 6)).toEqual([[0, 1, 2, 3, 4, 5], [6]])
    expect(paginate(6, 6)).toEqual([[0, 1, 2, 3, 4, 5]])
    expect(paginate(0, 6)).toEqual([])
  })
})

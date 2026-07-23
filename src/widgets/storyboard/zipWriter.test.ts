import { describe, expect, it } from 'vitest'

import { buildZip, crc32 } from './zipWriter'

const enc = new TextEncoder()
const dec = new TextDecoder('latin1')

function readU32(buf: Uint8Array, at: number): number {
  return (buf[at] | (buf[at + 1] << 8) | (buf[at + 2] << 16) | (buf[at + 3] << 24)) >>> 0
}
function readU16(buf: Uint8Array, at: number): number {
  return buf[at] | (buf[at + 1] << 8)
}

describe('crc32', () => {
  it('matches known vectors', () => {
    expect(crc32(enc.encode(''))).toBe(0)
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926)
    expect(crc32(enc.encode('hello'))).toBe(0x3610a686)
  })
})

describe('buildZip', () => {
  it('produces a structurally valid STORE archive', () => {
    const a = enc.encode('alpha-data')
    const b = enc.encode('beta')
    const zip = buildZip([
      { name: 'board-001.png', data: a },
      { name: '分镜-002.png', data: b },
    ])

    // local header magic at start
    expect(readU32(zip, 0)).toBe(0x04034b50)

    // EOCD at the end
    const eocd = zip.length - 22
    expect(readU32(zip, eocd)).toBe(0x06054b50)
    expect(readU16(zip, eocd + 10)).toBe(2) // total entries

    const centralStart = readU32(zip, eocd + 16)
    expect(readU32(zip, centralStart)).toBe(0x02014b50)

    // central entry 1: crc + sizes + name
    expect(readU32(zip, centralStart + 16)).toBe(crc32(a))
    expect(readU32(zip, centralStart + 20)).toBe(a.length)
    const nameLen = readU16(zip, centralStart + 28)
    const name = new TextDecoder().decode(zip.slice(centralStart + 46, centralStart + 46 + nameLen))
    expect(name).toBe('board-001.png')

    // file payloads are embedded verbatim
    expect(dec.decode(zip)).toContain('alpha-data')
    expect(dec.decode(zip)).toContain('beta')
  })

  it('local header offset in central directory points at the entry', () => {
    const zip = buildZip([
      { name: 'a.bin', data: enc.encode('xxxx') },
      { name: 'b.bin', data: enc.encode('yyyyyy') },
    ])
    const eocd = zip.length - 22
    const centralStart = readU32(zip, eocd + 16)
    // second central entry follows the first
    const firstNameLen = readU16(zip, centralStart + 28)
    const second = centralStart + 46 + firstNameLen
    expect(readU32(zip, second)).toBe(0x02014b50)
    const localOffset = readU32(zip, second + 42)
    expect(readU32(zip, localOffset)).toBe(0x04034b50)
  })

  it('rejects empty archives', () => {
    expect(() => buildZip([])).toThrow()
  })
})

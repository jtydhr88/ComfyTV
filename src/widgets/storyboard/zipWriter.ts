/**
 * Minimal zero-dependency ZIP writer (STORE method, no compression).
 * Enough for "download all board PNGs as one archive".
 */
export interface ZipEntry {
  name: string
  data: Uint8Array
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

const enc = new TextEncoder()

export function buildZip(entries: ZipEntry[]): Uint8Array {
  if (!entries.length) throw new Error('no entries')

  const chunks: Uint8Array[] = []
  let offset = 0
  const push = (b: Uint8Array): void => {
    chunks.push(b)
    offset += b.length
  }
  const u16 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff])
  const u32 = (v: number) => new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff])
  const concat = (...parts: Uint8Array[]): Uint8Array => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let at = 0
    for (const p of parts) {
      out.set(p, at)
      at += p.length
    }
    return out
  }

  const central: Uint8Array[] = []
  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const crc = crc32(entry.data)
    const localOffset = offset
    // local file header: STORE, UTF-8 names (bit 11)
    push(concat(
      u32(0x04034b50), u16(20), u16(0x0800), u16(0),
      u16(0), u16(0),
      u32(crc), u32(entry.data.length), u32(entry.data.length),
      u16(name.length), u16(0),
      name,
    ))
    push(entry.data)
    central.push(concat(
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0),
      u16(0), u16(0),
      u32(crc), u32(entry.data.length), u32(entry.data.length),
      u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset),
      name,
    ))
  }

  const centralStart = offset
  for (const c of central) push(c)
  const centralSize = offset - centralStart
  push(concat(
    u32(0x06054b50), u16(0), u16(0),
    u16(entries.length), u16(entries.length),
    u32(centralSize), u32(centralStart),
    u16(0),
  ))

  const out = new Uint8Array(offset)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

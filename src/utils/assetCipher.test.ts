import { describe, expect, it } from 'vitest'

import {
  decryptAsset,
  decryptAssetJson,
  decryptAssetText,
  encryptAsset
} from './assetCipher'

function bufOf(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer
}

describe('assetCipher', () => {
  it('round-trips arbitrary bytes', async () => {
    const plain = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 1, 2, 254, 255])
    const cipher = await encryptAsset(plain)
    expect(Array.from(cipher.subarray(0, 4))).toEqual([0x43, 0x54, 0x56, 0x31])
    expect(cipher.length).toBeGreaterThan(plain.length)
    const out = new Uint8Array(await decryptAsset(bufOf(cipher)))
    expect(Array.from(out)).toEqual(Array.from(plain))
  })

  it('round-trips JSON via the text/json helpers', async () => {
    const value = { characters: [{ id: 'human' }], n: 42 }
    const cipher = await encryptAsset(
      new TextEncoder().encode(JSON.stringify(value))
    )
    expect(await decryptAssetText(bufOf(cipher))).toBe(JSON.stringify(value))
    expect(await decryptAssetJson(bufOf(cipher))).toEqual(value)
  })

  it('uses a fresh IV per call (ciphertexts differ)', async () => {
    const plain = new TextEncoder().encode('same input')
    const a = await encryptAsset(plain)
    const b = await encryptAsset(plain)
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  it('passes plaintext through when the magic header is absent', async () => {
    const plain = new TextEncoder().encode('{"characters":[]}')
    const out = await decryptAsset(bufOf(plain))
    expect(new TextDecoder().decode(out)).toBe('{"characters":[]}')
    expect(await decryptAssetJson(bufOf(plain))).toEqual({ characters: [] })
  })

  it('rejects a tampered ciphertext (GCM auth)', async () => {
    const cipher = await encryptAsset(new TextEncoder().encode('secret'))
    cipher[cipher.length - 1] ^= 0xff
    await expect(decryptAsset(bufOf(cipher))).rejects.toBeTruthy()
  })
})

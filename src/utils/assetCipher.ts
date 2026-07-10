const MAGIC = new Uint8Array([0x43, 0x54, 0x56, 0x31])
const IV_LENGTH = 12

function assembleKeyBytes(): Uint8Array {
  const s0 = Uint8Array.from(
    [0x3a, 0xf9, 0x5e, 0x6d, 0xaa, 0xec, 0xbe, 0x3e],
    (b) => b ^ 0x5c
  )
  const s1 = Uint8Array.from(
    [0xf2, 0xd0, 0x0d, 0xd7, 0xf5, 0x0e, 0x3a, 0xad]
  ).reverse()
  const s2 = Uint8Array.from(
    [0x4e, 0x19, 0x50, 0x5c, 0x1d, 0x6b, 0xa0, 0x6b],
    (b) => (b - 0x1f) & 0xff
  )
  const s3 = Uint8Array.from(
    [0x27, 0x15, 0x68, 0x45, 0x61, 0x87, 0x56, 0x1e],
    (b, i) => b ^ (0x30 + i)
  )
  const key = new Uint8Array(32)
  key.set(s0, 0)
  key.set(s1, 8)
  key.set(s2, 16)
  key.set(s3, 24)
  return key
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(
    view.byteOffset,
    view.byteOffset + view.byteLength
  ) as ArrayBuffer
}

let keyPromise: Promise<CryptoKey> | null = null

function getAssetKey(): Promise<CryptoKey> {
  keyPromise ??= crypto.subtle.importKey(
    'raw',
    toArrayBuffer(assembleKeyBytes()),
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  )
  return keyPromise
}

export async function encryptAsset(
  plaintext: ArrayBuffer | Uint8Array
): Promise<Uint8Array> {
  const key = await getAssetKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const data =
    plaintext instanceof Uint8Array ? plaintext : new Uint8Array(plaintext)
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      toArrayBuffer(data)
    )
  )
  const out = new Uint8Array(MAGIC.length + IV_LENGTH + cipher.length)
  out.set(MAGIC, 0)
  out.set(iv, MAGIC.length)
  out.set(cipher, MAGIC.length + IV_LENGTH)
  return out
}

function hasMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= MAGIC.length + IV_LENGTH &&
    MAGIC.every((m, i) => bytes[i] === m)
  )
}

export async function decryptAsset(
  ciphertext: ArrayBuffer
): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(ciphertext)
  if (!hasMagic(bytes)) return ciphertext
  const key = await getAssetKey()
  const iv = bytes.subarray(MAGIC.length, MAGIC.length + IV_LENGTH)
  const body = bytes.subarray(MAGIC.length + IV_LENGTH)
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(body)
  )
}

export async function decryptAssetText(
  ciphertext: ArrayBuffer
): Promise<string> {
  return new TextDecoder().decode(await decryptAsset(ciphertext))
}

export async function decryptAssetJson(
  ciphertext: ArrayBuffer
): Promise<unknown> {
  return JSON.parse(await decryptAssetText(ciphertext))
}

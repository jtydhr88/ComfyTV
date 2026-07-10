import { readdir, readFile, mkdir, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { encryptAsset } from '../src/utils/assetCipher.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'assets_src')
const OUT = join(ROOT, 'assets')

const TREES = ['scene3d', 'camera_presets']

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

async function encryptTree(tree) {
  const srcDir = join(SRC, tree)
  const outDir = join(OUT, tree)
  if (!existsSync(srcDir)) {
    console.warn(`[encrypt-assets] skip ${tree}: no assets_src/${tree}`)
    return 0
  }
  await rm(outDir, { recursive: true, force: true })
  let count = 0
  for await (const srcPath of walk(srcDir)) {
    const rel = relative(srcDir, srcPath)
    const outPath = join(outDir, rel)
    await mkdir(dirname(outPath), { recursive: true })
    const plaintext = await readFile(srcPath)
    const cipher = await encryptAsset(plaintext)
    await writeFile(outPath, cipher)
    count += 1
  }
  return count
}

if (!existsSync(SRC)) {
  console.error(
    `[encrypt-assets] missing ${SRC}\n` +
      `  Put the plaintext assets under assets_src/{${TREES.join(',')}}/ first.`
  )
  process.exit(1)
}

let total = 0
for (const tree of TREES) total += await encryptTree(tree)
console.log(`[encrypt-assets] encrypted ${total} file(s) into assets/`)

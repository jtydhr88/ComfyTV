import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dest = path.resolve(here, '../packages/pentrado/src')
const src = process.env.PENTRADO_SRC ?? 'G:/pentrado/src'

if (!fs.existsSync(path.join(src, 'engine'))) {
  console.error(`[sync-pentrado] source not found or not a pentrado src dir: ${src}`)
  console.error('  set PENTRADO_SRC to the standalone repo\'s src/ directory')
  process.exit(1)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })

const count = fs.readdirSync(dest, { recursive: true }).length
console.log(`[sync-pentrado] ${src} -> ${dest} (${count} entries)`)
console.log('[sync-pentrado] now run: npm run typecheck && npx vitest run && npm run build')

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const pkgDir = path.resolve(here, '../packages/pentrado')
const dest = path.join(pkgDir, 'src')
const src = process.env.PENTRADO_SRC ?? 'G:/github/pentrado/src'
const repo = path.dirname(src)

if (!fs.existsSync(path.join(src, 'engine'))) {
  console.error(`[sync-pentrado] source not found or not a pentrado src dir: ${src}`)
  console.error('  set PENTRADO_SRC to the standalone repo\'s src/ directory')
  process.exit(1)
}

const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()

if (git('status', '--porcelain', '--', 'src', 'package.json')) {
  console.error(`[sync-pentrado] ${repo} has uncommitted changes under src/ or package.json — commit them first`)
  process.exit(1)
}

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(src, dest, { recursive: true })

const [commit, date] = git('log', '-1', '--format=%H %cI').split(' ')
fs.writeFileSync(path.join(pkgDir, 'SOURCE.json'),
  JSON.stringify({ repo: 'jtydhr88/pentrado', commit, date }, null, 2) + '\n')

const upstreamVersion = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8')).version
const pkgPath = path.join(pkgDir, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
pkg.version = upstreamVersion
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

const count = fs.readdirSync(dest, { recursive: true }).length
console.log(`[sync-pentrado] ${src} @ ${commit.slice(0, 8)} (${upstreamVersion}) -> ${dest} (${count} entries)`)
console.log('[sync-pentrado] now run: npm run typecheck && npx vitest run && npm run build')

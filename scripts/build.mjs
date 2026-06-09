import { execSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = resolve(ROOT, 'dist')

if (!existsSync(DIST)) {
  mkdirSync(DIST, { recursive: true })
}

// 1. Rollup JS
console.log('[build] rollup -c')
execSync('npx rollup -c', { cwd: ROOT, stdio: 'inherit' })

// 2. HTML: copy from src/*/ to dist/, strip ../../dist/
const HTML_SOURCES = [
  { src: 'src/sidepanel/sidepanel.html', dest: 'dist/sidepanel.html' },
  { src: 'src/config/config.html', dest: 'dist/config.html' },
  { src: 'src/manual-select/manual-select.html', dest: 'dist/manual-select.html' },
  { src: 'src/question-bank/question-bank.html', dest: 'dist/question-bank.html' },
]

for (const { src, dest } of HTML_SOURCES) {
  const html = readFileSync(resolve(ROOT, src), 'utf-8')
  const transformed = html.replace(/\.\.\/\.\.\/dist\//g, '')
  writeFileSync(resolve(ROOT, dest), transformed, 'utf-8')
  console.log(`[build] ${src} → ${dest}`)
}

// 3. manifest.json: strip "dist/" prefix from all string values
const manifestRaw = readFileSync(resolve(ROOT, 'manifest.json'), 'utf-8')
const manifest = JSON.parse(manifestRaw)

function stripDistPrefix(obj) {
  if (typeof obj === 'string') {
    return obj.startsWith('dist/') ? obj.slice(5) : obj
  }
  if (Array.isArray(obj)) {
    return obj.map(stripDistPrefix)
  }
  if (obj && typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = stripDistPrefix(value)
    }
    return result
  }
  return obj
}

const stripped = stripDistPrefix(manifest)
writeFileSync(resolve(DIST, 'manifest.json'), JSON.stringify(stripped, null, 2), 'utf-8')
console.log('[build] manifest.json → dist/manifest.json')
console.log('[build] done')

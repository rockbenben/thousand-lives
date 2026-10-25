// Sweep every image in the repo and check two things:
//   1. the file's own pixel size against the spec its slot requires
//   2. the file's pixel size against the largest box it is displayed in —
//      a file smaller than its display box means the browser upscales it,
//      which is the "强行放大" defect
//
//   node scripts/verify-art.mjs
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { planFor, SURFACES, DPR, MAX_UPSCALE } from './art-surfaces.mjs'
import { webpDimsOf } from './webp-dims.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')

// The scripts in here drive the pipeline and the checks, and nothing else
// compiles them: the test suite and tsc both look at src/ only. A syntax
// error in a script therefore reaches the running pipeline before anything
// notices, and the supervisor just retries a broken command every minute.
// So check them first, and make it loud.
//
// The .ts scripts count as well: six of them (art-inventory, content-check,
// sim-balance, balance-greedy, logic-check, _sim-shared) run through vite's
// module runner, so a syntax error in one of those breaks a tooling command
// just as quietly. They are parsed with the project's own TypeScript
// compiler, not with `node --check`: node only strips the types off a .ts
// file on a recent enough runtime, and the project supports Node 20, where
// the check reports every type annotation as a syntax error. The compiler's
// parser is the one that will actually read these files.
//
// (scripts/slice-fonts.py is the one script still unchecked: it is Python,
// it needs fontTools, and it regenerates committed artifacts rather than
// running in the pipeline.)
console.log('\nscript syntax')
let syntaxBad = 0
const SCRIPT_DIR = path.join(ROOT, 'scripts')

/** The project's TypeScript, or null when it is not installed. */
const ts = await import('typescript')
  .then((m) => m.default ?? m)
  .catch(() => null)

/** The syntax errors in a .ts file, one line per error. */
function tsSyntaxErrors(file) {
  const out = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  })
  return (out.diagnostics ?? [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '))
}

for (const f of fs.readdirSync(SCRIPT_DIR).filter((f) => f.endsWith('.mjs') || f.endsWith('.ts'))) {
  const p = path.join(SCRIPT_DIR, f)
  if (f.endsWith('.ts')) {
    if (!ts) {
      console.log(`  SKIP scripts/${f}: typescript is not installed`)
      continue
    }
    const errs = tsSyntaxErrors(p)
    if (errs.length) {
      syntaxBad++
      console.log(`  SYNTAX ERROR scripts/${f}: ${errs.join(' / ')}`)
    }
    continue
  }
  try {
    execFileSync('node', ['--check', p], { stdio: 'pipe' })
  } catch (e) {
    syntaxBad++
    console.log(`  SYNTAX ERROR scripts/${f}: ${String(e.stderr || e.message).split('\n').find((l) => l.includes('Error')) || ''}`)
  }
}
console.log(syntaxBad ? `  ${syntaxBad} script(s) do not parse` : '  all scripts parse')

// The pixel size of a file, read from its WebP header.
// scripts/webp-dims.mjs owns that parse: there was a second copy of it in
// scripts/art-inventory.ts and the two disagreed on the lossless layout, so
// a lossless file was reported with the wrong size by one of the two.

// The spec each slot must reach, and the widest box it is painted into,
// both come from scripts/art-surfaces.mjs — the registry of every surface the
// art appears in. Keeping them here in a second hand-written copy is how the
// two drifted apart in the first place.
const DIRS = {
  'src/assets/nodes': 'node',
  'src/assets/node-themes': 'theme',
  'src/assets/cover-*.webp': 'cover',
  'src/assets/endings': 'ending',
  'src/assets/achievements': 'achievement',
}
const SPEC = {}
for (const [dir, kind] of Object.entries(DIRS)) {
  SPEC[dir] = planFor(kind).pixels
}

/**
 * How much the browser magnifies the art when it paints it into a surface.
 * cover: the image is scaled up until it fills the box, and whichever axis
 *   binds is the factor -- that factor IS the "forced upscale" this project
 *   set out to remove, so it is measured per surface. A width-only estimate
 *   hides the portrait tablet, where the height binds instead.
 * contain: the image is scaled down to fit; never magnified.
 * band: the image is drawn at the full width of the box (phone portrait),
 *   so only the width matters.
 */
function magnification(surface, d) {
  const dev = surface.dpr ?? DPR
  const bw = surface.box[0] * dev
  const bh = surface.box[1] * dev
  if (surface.fit === 'contain') return Math.min(bw / d[0], bh / d[1])
  if (surface.fit === 'band') return bw / d[0]
  return Math.max(bw / d[0], bh / d[1])
}

let problems = 0
let upscaled = 0

for (const [dir, kind] of Object.entries(DIRS)) {
  const [ew, eh] = SPEC[dir]
  const abs = path.join(ROOT, dir)
  let files
  if (dir.includes('*')) {
    const dirName = path.dirname(dir)
    const re = new RegExp('^' + path.basename(dir).replace(/\*/g, '.*') + '$')
    files = fs.readdirSync(path.join(ROOT, dirName)).filter((f) => re.test(f)).map((f) => path.join(dirName, f))
  } else {
    files = fs.statSync(abs).isDirectory() ? fs.readdirSync(abs).map((f) => path.join(dir, f)) : [dir]
  }
  const shape = {}
  const worstBySurface = new Map(SURFACES[kind].map((s) => [s.name, 0]))
  let total = 0
  for (const rel of files) {
    const p = path.join(ROOT, rel)
    const d = webpDimsOf(p)
    const sz = fs.statSync(p).size
    total += sz
    const key = d ? `${d[0]}x${d[1]}` : 'unreadable'
    shape[key] = (shape[key] || 0) + 1
    if (d) {
      for (const s of SURFACES[kind]) {
        const m = magnification(s, d)
        if (m > worstBySurface.get(s.name)) worstBySurface.set(s.name, m)
      }
    }
    // 合规 = 比例对得上，且每一边都不小于规格（后端直出可能略大于规格，不算问题）
    const aspectOk = d && Math.abs(d[0] / d[1] - ew / eh) < 0.01
    const sizeOk = d && d[0] >= ew && d[1] >= eh
    if (!aspectOk || !sizeOk) {
      if (problems < 20) {
        const why = !d ? '读不出尺寸' : !aspectOk ? `比例非 ${ew}:${eh}` : `小于规格 ${ew}x${eh}`
        console.log(`  OFF-SPEC  ${rel} = ${key} (${(sz / 1024).toFixed(0)}KB) — ${why}`)
      }
      problems++
    } else if (sz < 20000) {
      if (problems < 20) console.log(`  TOO-SMALL ${rel} = ${key} (${(sz / 1024).toFixed(1)}KB)`)
      problems++
    }
  }
  const disp = SURFACES[kind].map((s) => `${s.name} ${worstBySurface.get(s.name).toFixed(2)}×`).join('  ')
  const over = [...worstBySurface.entries()].filter(([, m]) => m > MAX_UPSCALE)
  console.log(
    `${dir}: ${files.length} files, ${(total / 1024 / 1024).toFixed(1)}MB  ${JSON.stringify(shape)}\n` +
      `    display: ${disp}`,
  )
  if (over.length) {
    console.log(`    ⚠ 放大超过 ${MAX_UPSCALE} 倍：${over.map(([n, m]) => `${n} ${m.toFixed(2)}×`).join(' ')}`)
    upscaled += over.length
  }
}

// The vertical thumbnail the fate card and the ending gallery paint. It is
// cut from the ending picture, so a missing one means the fate card falls
// back to downloading the whole 2K file, and a stale one shows the old
// picture next to the new one.
console.log('\nending thumbs (fate card 384x512, archive tile 105x140)')
{
  const END_DIR = 'src/assets/endings'
  const THUMB_DIR = 'src/assets/ending-thumbs'
  const abs = path.join(ROOT, END_DIR)
  const files = fs.existsSync(abs) ? fs.readdirSync(abs).filter((f) => f.endsWith('.webp')) : []
  let missing = 0
  let wrong = 0
  let bytes = 0
  for (const f of files) {
    const t = path.join(ROOT, THUMB_DIR, f)
    if (!fs.existsSync(t)) {
      if (missing < 10) console.log(`  MISSING  ${THUMB_DIR}/${f}`)
      missing++
      continue
    }
    const d = webpDimsOf(t)
    bytes += fs.statSync(t).size
    if (!d || d[0] !== 768 || d[1] !== 1024) {
      if (wrong < 10) console.log(`  WRONG-SIZE  ${THUMB_DIR}/${f} = ${d ? d.join('x') : 'unreadable'} (768x1024)`)
      wrong++
    }
  }
  console.log(`  ${files.length - missing - wrong}/${files.length} thumbs ok, ${(bytes / 1024 / 1024).toFixed(1)}MB`)
  problems += missing + wrong
}

// static site assets
console.log('\npublic/ (static assets)')
const pub = path.join(ROOT, 'public')
for (const f of ['og.jpg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'pwa-maskable-512x512.png']) {
  const p = path.join(pub, f)
  if (!fs.existsSync(p)) continue
  const d = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', p], { encoding: 'utf8' }).trim()
  console.log(`  ${f}: ${d} (${(fs.statSync(p).size / 1024).toFixed(0)}KB)`)
}
const ogDir = path.join(pub, 'og')
if (fs.existsSync(ogDir)) {
  const fs2 = fs.readdirSync(ogDir)
  let ogBad = 0
  for (const f of fs2) {
    const d = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(ogDir, f)], { encoding: 'utf8' }).trim()
    if (d !== '1200,630') ogBad++
  }
  console.log(`  og/: ${fs2.length} files, non-1200x630: ${ogBad}`)
}

// Orphan assets: every file under src/assets that no import can reach.
// Assets are pulled in two ways, and both have to be counted or the check lies:
//   - literal imports  (`import coverBook from '../assets/cover-book.webp'`)
//   - glob imports    (`import.meta.glob('../assets/achievements/*.webp')`)
// A glob is resolved against the directory of the file that declares it.
console.log('\norphan check (src/assets)')
const srcFiles = []
for (const d of ['src', 'index.html']) {
  const walk = (p) => {
    if (!fs.existsSync(p)) return
    if (fs.statSync(p).isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e))
    else if (/\.(ts|tsx|css|html)$/.test(p)) srcFiles.push(p)
  }
  walk(path.join(ROOT, d))
}

const assetRoot = path.join(ROOT, 'src/assets')
const assets = []
const walkAssets = (p) => {
  for (const e of fs.readdirSync(p)) {
    const f = path.join(p, e)
    if (fs.statSync(f).isDirectory()) walkAssets(f)
    else assets.push(path.relative(ROOT, f).split(path.sep).join('/'))
  }
}
if (fs.existsSync(assetRoot)) walkAssets(assetRoot)

const literalNames = new Set()
const globPatterns = []
for (const p of srcFiles) {
  const text = fs.readFileSync(p, 'utf8')
  for (const m of text.matchAll(/[\w./-]+\.(?:webp|png|jpe?g|gif|svg|avif)\b/g)) literalNames.add(path.posix.basename(m[0]))
  const rel = path.relative(ROOT, p).split(path.sep).join('/')
  const dir = path.posix.dirname(rel)
  for (const m of text.matchAll(/['"`]([^'"`\n]*assets\/[^'"`\n]*\*[^'"`\n]*)['"`]/g)) {
    globPatterns.push(path.posix.join(dir, m[1]))
  }
}
const globRes = globPatterns.map((g) =>
  new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$'),
)
const reachable = (rel) => {
  if (literalNames.has(path.posix.basename(rel))) return true
  return globRes.some((re) => re.test(rel))
}
const orphans = assets.filter((rel) => !reachable(rel))
if (orphans.length === 0) console.log(`  ${assets.length} assets, all reachable`)
else for (const rel of orphans) console.log(`  ${rel}: ORPHAN (no import in src/ or index.html can reach it)`)

const failed = problems + upscaled + syntaxBad
console.log(
  failed === 0
    ? '\nALL OK'
    : `\nPROBLEMS: ${problems} 张不合规格 · ${upscaled} 处展示面放大超过 ${MAX_UPSCALE} 倍 · ${syntaxBad} 个脚本语法错误`,
)
process.exit(failed === 0 ? 0 : 1)

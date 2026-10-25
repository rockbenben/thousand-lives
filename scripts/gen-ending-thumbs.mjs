// Cut the vertical thumbnail the fate card and the ending gallery show.
//
// The ending art is 2528x1696 now (2K, the same tier as everything else).
// Two of the three places it appears are small vertical crops of it:
//
//   命运之卡   384x512 CSS  -> 768x1024 device px, a 3:4 crop that keeps the
//   图鉴格子   105x140 CSS  -> 210x280 device px, the same 3:4 crop
//
// Serving the full 2528x1696 ending to a 384px card means downloading ~200 KB
// for a picture that is painted at 768 device pixels, and the archive page
// pulls one of those per ending it shows. The thumb is the same crop the card
// makes -- object-fit: cover with object-position: center -- at exactly the
// size the card paints, so it is the same picture at a fraction of the bytes.
//
// The ending page and the detail overlay still use the full 2K file, and so
// does the lightbox, which shows it at its native size.
//
//   node scripts/gen-ending-thumbs.mjs [--only <file stem>]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENDINGS = path.join(ROOT, 'src/assets/endings')
const OUT = path.join(ROOT, 'src/assets/ending-thumbs')
// 命运之卡 384 CSS px at DPR 2
const W = 768
const H = 1024

const argv = process.argv.slice(2)
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null

fs.mkdirSync(OUT, { recursive: true })
const files = fs
  .readdirSync(ENDINGS)
  .filter((f) => f.endsWith('.webp'))
  .filter((f) => !only || f.replace(/\.webp$/, '') === only)

if (!files.length) {
  console.log('no ending pictures to cut')
  process.exit(0)
}

let total = 0
for (const f of files) {
  const src = path.join(ENDINGS, f)
  const dest = path.join(OUT, f)
  // The centre 3:4 of a 3:2 picture: width = height * 3/4, taken from the middle.
  // The card shows object-fit: cover of the same region, so the framing matches.
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', src,
    '-vf', `crop=ih*3/4:ih:(iw-ih*3/4)/2:0,scale=${W}:${H}`,
    '-c:v', 'libwebp', '-q:v', '82', '-compression_level', '6',
    dest,
  ])
  const kb = fs.statSync(dest).size / 1024
  total += kb
  console.log(`${f}  ${kb.toFixed(0)}KB`)
}
console.log(`→ ${path.relative(ROOT, OUT)}  ${files.length} files, ${(total / 1024).toFixed(1)}MB`)

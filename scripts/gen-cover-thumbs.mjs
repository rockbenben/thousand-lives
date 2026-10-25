// Cut the square thumbnail the scenario cards show.
//
// The card is 252x252 CSS px, so at DPR 2 it needs 504 device pixels. The
// cover is 2752x1536, because it also has to fill the 1440px-wide VN stage.
// Serving the full cover to the card means ten images of ~200 KB on the first
// screen for 504 pixels of paint -- measured 2.09 MB, of which 1.7 MB is
// pixels nobody ever sees.
//
// The thumb is the same crop the card makes: object-fit: cover with
// object-position: center, so the centre square of the cover, scaled down.
// Same picture, same framing, a tenth of the bytes.
//
// It is cut at 512 rather than at the 504 device pixels the card paints:
// 512 is the round number the browser can decode without a rescale, and the
// 8 extra pixels cost nothing next to the saving.
//
//   node scripts/gen-cover-thumbs.mjs [--only <id>]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const COVERS = path.join(ROOT, 'src/assets')
const OUT = path.join(COVERS, 'cover-thumbs')
const SIZE = 512

const argv = process.argv.slice(2)
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null

fs.mkdirSync(OUT, { recursive: true })
const covers = fs
  .readdirSync(COVERS)
  .filter((f) => f.startsWith('cover-') && f.endsWith('.webp'))
  .filter((f) => !only || f.replace(/^cover-/, '').replace(/\.webp$/, '') === only)

for (const f of covers) {
  const id = f.replace(/^cover-/, '').replace(/\.webp$/, '')
  const dest = path.join(OUT, `${id}.webp`)
  // crop=ih:ih:(iw-ih)/2:0 takes the centre square of the cover, which is what
  // the card shows; then scale it to the size the card actually paints.
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', path.join(COVERS, f),
    '-vf', `crop=ih:ih:(iw-ih)/2:0,scale=${SIZE}:${SIZE}`,
    '-c:v', 'libwebp', '-q:v', '82', '-compression_level', '6',
    dest,
  ])
  console.log(`${id}.webp  ${(fs.statSync(dest).size / 1024).toFixed(0)}KB`)
}
console.log(`→ ${path.relative(ROOT, OUT)}`)

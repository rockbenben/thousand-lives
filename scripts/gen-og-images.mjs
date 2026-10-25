// Regenerate the per-scenario Open Graph images from the (now native) covers.
//
// The og images used to be 1200x805 — a straight 3:2 downscale of the old
// 1264x848 cover. The site's own card (public/og.jpg) is 1200x630, the size
// social platforms expect for a large summary card, so a 3:2 og image loses the
// bottom 22% to cropping. The covers are 16:9 now (2752x1536), which is close
// to the 1.91:1 of an og card, so the crop is only a few percent of the height.
//
// The cut takes the top 94% of the scaled height, starting 6% down: the covers
// are composed with the subject in the upper part and open space below, so the
// bottom strip is what gets dropped.
//
//   node scripts/gen-og-images.mjs
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const COVERS = path.join(ROOT, 'src/assets')
const OUT = path.join(ROOT, 'public/og')
const W = 1200
const H = 630

fs.mkdirSync(OUT, { recursive: true })
const covers = fs.readdirSync(COVERS).filter((f) => f.startsWith('cover-') && f.endsWith('.webp'))
for (const f of covers) {
  const id = f.replace(/^cover-/, '').replace(/\.webp$/, '')
  const dest = path.join(OUT, `${id}.jpg`)
  // scale to width 1200 (16:9 -> 1200x670), then take 94% of the height
  // starting 6% down. min() keeps the crop inside the frame whatever the
  // source ratio is, so it can never ask for a row that does not exist.
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', path.join(COVERS, f),
    '-vf', `scale=${W}:-2,crop=${W}:min(${H}\\,ih*0.94):0:ih*0.06`,
    '-q:v', '3',
    dest,
  ])
  const d = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', dest], { encoding: 'utf8' }).trim()
  console.log(`${id}.jpg  ${d}  ${(fs.statSync(dest).size / 1024).toFixed(0)}KB`)
}
console.log(`→ ${OUT}`)

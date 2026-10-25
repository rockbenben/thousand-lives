// Build a contact sheet of the share images, so a review is one look.
//
// The og card is the only picture a visitor sees before they click, and at
// 300 px across an atmospheric scene of a corridor and a figure says nothing
// about the genre. Reviewing ten of them one by one is how that slips
// through; one sheet is how it gets caught.
//
//   node scripts/contact-sheet.mjs [dir] [out.png] [cols] [cellWidth]
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DIR = path.resolve(ROOT, process.argv[2] || 'public/og')
const OUT = path.resolve(process.argv[3] || path.join(os.tmpdir(), 'tl-contact-sheet.png'))
const COLS = Number(process.argv[4] || 5)
const W = Number(process.argv[5] || 480)

const files = fs
  .readdirSync(DIR)
  .filter((f) => /\.(jpg|jpeg|png|webp)$/.test(f))
  .sort()
if (!files.length) {
  console.error(`no images in ${DIR}`)
  process.exit(1)
}

// keep the aspect ratio of the first image for every cell
const probe = execFileSync(
  'ffprobe',
  ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(DIR, files[0])],
  { encoding: 'utf8' },
).trim()
const [pw, ph] = probe.split(',').map(Number)
const CELL_H = Math.round((W * ph) / pw)

const inputs = []
const chain = []
const layout = []
// Label every cell with its file name: a review of sixty images is useless
// if you cannot say afterwards which one was the problem.
const FONT = 'C\\:/Windows/Fonts/simsunb.ttf'
for (let i = 0; i < files.length; i++) {
  inputs.push('-i', path.join(DIR, files[i]))
  const label = files[i].replace(/\.[^.]+$/, '').replace(/[':\\]/g, '')
  chain.push(
    `[${i}:v]scale=${W}:${CELL_H},drawtext=fontfile='${FONT}':text='${label}':x=6:y=${CELL_H - 30}:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=4[c${i}]`,
  )
  layout.push(`${(i % COLS) * W}_${Math.floor(i / COLS) * CELL_H}`)
}
const stack = `${files.map((_, i) => `[c${i}]`).join('')}xstack=inputs=${files.length}:layout=${layout.join('|')}[out]`

execFileSync('ffmpeg', [
  '-y', '-v', 'error',
  ...inputs,
  '-filter_complex', `${chain.join(';')};${stack}`,
  '-map', '[out]',
  OUT,
])
console.log(`${files.length} image(s) from ${path.relative(ROOT, DIR)} → ${OUT}`)
console.log('  ' + files.map((f) => f.replace(/\.[^.]+$/, '')).join('  '))

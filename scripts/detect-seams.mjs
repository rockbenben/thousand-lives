// Find the seams an image model leaves behind when it stitches two scenes,
// and the black bars it leaves behind when it paints inside the frame.
//
// Two seam shapes show up, both with a hard straight edge and a jump in the
// pixels on one side of it:
//   - a vertical seam: a narrow portrait panel in the middle of a wide
//     frame, the sides filled in -- measured on the 16:9 covers
//   - a horizontal seam: the picture split into a top half and a bottom
//     half, two different scenes -- measured on an ending
//
// The tell is the same in both cases: the difference between two adjacent
// columns (or rows) is far above the average difference everywhere else.
//
// The second thing this looks for is the picture painted inside the frame:
// the model draws the scene on a smaller canvas and leaves the rest of the
// picture black. The style rule bans that ("the picture reaches every edge
// of the frame"), and it shows up as solid black rows at the top and the
// bottom of an otherwise lit picture.
//
//   node scripts/detect-seams.mjs [dir] [sample]
//
// Screening only: a door frame, a fence post or a medallion ring also produce
// a strong straight edge, so every hit has to be looked at. The same goes
// for the black bars: a badge is a round medallion on a dark field, so its
// top and bottom rows are dark on purpose.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TARGET = process.argv[2] || 'src/assets'
const SAMPLE = Number(process.argv[3] || 0) // 0 = every file
const COLS = 160
// a row this dark counts as unpainted
const DARK = 6
// four rows of black on both edges is a bar, not a shadow
const BAR = 4

function files(dir) {
  const out = []
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name)
      if (e.isDirectory()) walk(f)
      else if (/\.(webp|png|jpe?g)$/.test(e.name)) out.push(f)
    }
  }
  walk(path.join(ROOT, dir))
  return out
}

/** the biggest jump between neighbouring columns / rows, and how big it is against the mean */
function seams(file) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `scale=${COLS}:-2,format=gray`, '-f', 'rawvideo', '-'],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  if (!raw.length || raw.length % COLS !== 0) return null
  const rows = raw.length / COLS

  const colDiff = new Float64Array(COLS - 1)
  for (let c = 0; c < COLS - 1; c++) {
    let sum = 0
    for (let r = 0; r < rows; r++) sum += Math.abs(raw[r * COLS + c] - raw[r * COLS + c + 1])
    colDiff[c] = sum / rows
  }
  const rowDiff = new Float64Array(rows - 1)
  for (let r = 0; r < rows - 1; r++) {
    let sum = 0
    for (let c = 0; c < COLS; c++) sum += Math.abs(raw[r * COLS + c] - raw[(r + 1) * COLS + c])
    rowDiff[r] = sum / COLS
  }
  const peak = (d) => {
    const mean = d.reduce((a, b) => a + b, 0) / d.length
    const max = Math.max(...d)
    return { mean, max, ratio: max / (mean || 1), at: d.indexOf(max) }
  }
  const v = peak(colDiff)
  const h = peak(rowDiff)
  // the unpainted margin: how many rows at each edge stay black
  const rowMean = (r) => {
    let sum = 0
    for (let c = 0; c < COLS; c++) sum += raw[r * COLS + c]
    return sum / COLS
  }
  let top = 0
  while (top < rows && rowMean(top) < DARK) top++
  let bot = 0
  while (bot < rows && rowMean(rows - 1 - bot) < DARK) bot++
  return {
    v,
    h,
    cols: COLS,
    rows,
    edges: { top, bot },
    // a row seam is worth reporting only if it is not also a column seam
    worst: h.ratio > v.ratio ? { axis: 'row', ...h } : { axis: 'col', ...v },
  }
}

const all = fs.existsSync(path.join(ROOT, TARGET)) && fs.statSync(path.join(ROOT, TARGET)).isFile()
  ? [path.join(ROOT, TARGET)]
  : files(TARGET)
const list = SAMPLE > 0 && all.length > SAMPLE
  ? all.filter((_, i) => i % Math.ceil(all.length / SAMPLE) === 0)
  : all

const flagged = []
const barred = []
for (const f of list) {
  const s = seams(f)
  if (!s) continue
  if (s.worst.ratio > 6) flagged.push({ f, ...s })
  if (s.edges.top >= BAR && s.edges.bot >= BAR) barred.push({ f, ...s })
}
flagged.sort((a, b) => b.worst.ratio - a.worst.ratio)
console.log(`scanned ${list.length} file(s) in ${TARGET}`)
if (!flagged.length) {
  console.log('no seam found')
} else {
  console.log(`${flagged.length} file(s) with a hard seam:`)
  for (const x of flagged) {
    console.log(
      `  ${x.f.replace(ROOT + path.sep, '')}  ${x.worst.axis}-seam ratio=${x.worst.ratio.toFixed(1)} at ${x.worst.axis === 'col' ? 'column' : 'row'} ${x.worst.at}/${x.worst.axis === 'col' ? x.cols : x.rows}  (col ${x.v.ratio.toFixed(1)} / row ${x.h.ratio.toFixed(1)})`,
    )
  }
}

// the picture painted inside the frame instead of filling it
if (barred.length) {
  console.log(`${barred.length} file(s) with an unpainted margin (black bars):`)
  for (const x of barred) {
    console.log(
      `  ${x.f.replace(ROOT + path.sep, '')}  top ${x.edges.top} rows, bottom ${x.edges.bot} rows of ${x.rows}`,
    )
  }
}

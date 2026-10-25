// What the image connector actually returns, measured instead of assumed.
//
// The connector's schema lists the aspect ratios and the resolution tiers it
// accepts, but not the pixel size each combination produces. Assuming that
// table is how an art spec drifts away from the service: a wrong guess either
// fails the final check for every file of that kind, or lets an undersized
// render pass as "native".
//
// So the pipeline measures the native size of the renders it takes and keeps
// the numbers in scripts/.regen-state-native.json (git-ignored). The spec
// table in scripts/art-surfaces.mjs falls back to a conservative guess only
// for combinations that have not been rendered yet.
//
//   node scripts/native-sizes.mjs      # print what has been measured so far
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const FILE = path.resolve(import.meta.dirname, '..', 'scripts/.regen-state-native.json')

/**
 * Measure a downloaded render.
 * ffprobe, not a hand-rolled header parse: the connector picks the file
 * format (the extension of the produced file is not fixed), and ffprobe reads
 * both without guessing.
 * @param {string} file
 * @returns {[number, number]|null}
 */
export function measureImage(file) {
  try {
    const out = execFileSync(
      'ffprobe',
      [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height',
        '-of', 'csv=p=0',
        file,
      ],
      { encoding: 'utf8' },
    ).trim()
    const [w, h] = out.split(',').map(Number)
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? [w, h] : null
  } catch {
    return null
  }
}

/** Everything measured so far, keyed by "<resolution> <aspect>". */
export function loadNative() {
  if (!fs.existsSync(FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return {}
  }
}

/**
 * Record what one render actually measured.
 * @returns {boolean} true when the number changed (so the caller can log it)
 */
export function recordNative(resolution, aspect, dims) {
  const all = loadNative()
  const key = `${resolution} ${aspect}`
  const cur = all[key]
  if (cur && cur[0] === dims[0] && cur[1] === dims[1]) return false
  all[key] = dims
  fs.writeFileSync(FILE, JSON.stringify(all, null, 1))
  return true
}

/**
 * The measured native size of a combination, or null when it was never rendered.
 * @returns {[number, number]|null}
 */
export function lookupNative(resolution, aspect) {
  const v = loadNative()[`${resolution} ${aspect}`]
  return Array.isArray(v) && v.length === 2 ? v : null
}

// 直接运行时打印实测结果
if (process.argv[1] && process.argv[1].endsWith('native-sizes.mjs')) {
  const all = loadNative()
  const keys = Object.keys(all)
  if (!keys.length) console.log('nothing measured yet')
  for (const k of keys) console.log(`${k}  ${all[k][0]}x${all[k][1]}`)
}

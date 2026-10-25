// Supervisor for the art regeneration.
//
//   node scripts/regen-art-supervisor.mjs [--sleep 600] [--shards 4] [--batch 6]
//
// The plan balance behind the image connector is a billing limit, not a rate
// limit, so the run is spread over several renderer processes.
//
// Measured, with the connector as it is today:
//
//   one process, one image at a time        30.5 s per image
//   one process, two calls in flight        66.8 s per image   (worse)
//   two processes, one call each            14.3 s per image
//   four processes, one call each            5.4 s per image
//
// The connector renders one image at a time per session and several sessions
// do run in parallel, but two calls inside ONE process slow each other down.
// So the parallelism has to come from separate processes, and the slots have
// to be split between them or they would render the same slot twice.
//
// Each process is a shard: it owns the slots whose path hashes into its shard
// and keeps its own state file. After every round the shard files are merged
// back into the two queue files, so the rest of the tooling keeps reading one
// file per queue.
//
// Rounds follow each other without a pause while the balance lasts; when the
// balance runs out the run sleeps and resumes where it stopped, because the
// state files record finished slots.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { shardOf } from './art-shards.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const SLEEP = Number(arg('sleep', 600)) * 1000
const SHARDS = Math.max(1, Number(arg('shards', 4)))
const BATCH = Math.max(1, Number(arg('batch', 6)))
const LIMIT = Math.max(1, Number(arg('limit', 6)))

const QUEUES = [
  // The badge queue goes first on purpose. A badge is the cheapest way to learn
  // what the connector really returns for 1K 1:1, and that number decides the
  // tier for all 61 badges. Measuring it on the last render of the run would
  // cost 61 renders to fix. The cover leads the other queue for the same
  // reason: 16:9 is the one aspect nobody has rendered yet.
  { name: 'badge/ending', kinds: 'achievement,ending', state: 'scripts/.regen-state-end.json' },
  { name: 'cover/node/theme', kinds: 'cover,node,theme', state: 'scripts/.regen-state.json' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// The shard state file for a queue: scripts/.regen-state.json -> ...-s0.json
function shardState(base, i) {
  return base.replace(/\.json$/, `-s${i}.json`)
}

function readJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null
}

// A shard starts from the queue file's own history, so the slots that are
// already on disk are not rendered again.
function seedShard(base, i) {
  const p = path.join(ROOT, shardState(base, i))
  if (fs.existsSync(p)) return p
  const src = readJson(path.join(ROOT, base)) || { done: [], failed: {}, hashes: {}, restyle: [] }
  const mine = (list) => (list || []).filter((x) => shardOf(x, SHARDS) === i)
  const hashes = {}
  for (const [k, v] of Object.entries(src.hashes || {})) {
    if (shardOf(k, SHARDS) === i) hashes[k] = v
  }
  fs.writeFileSync(
    p,
    JSON.stringify(
      {
        done: mine(src.done),
        failed: {},
        hashes,
        restyle: mine(src.restyle),
        tiers: src.tiers || {},
      },
      null,
      1,
    ),
    'utf8',
  )
  return p
}

// Merge the shard files back into the queue file: the union of what the
// shards finished. The shards own disjoint slots, so nothing is lost.
//
// The shards are also the authority on what is still stale: a shard that
// re-renders a slot drops it from its own restyle list, and keeping the old
// entry from the queue file would keep that slot looking stale forever. The
// queue file's own entries are only kept for shards whose file is missing.
function mergeShards(base) {
  const p = path.join(ROOT, base)
  const merged = readJson(p) || { done: [], failed: {}, hashes: {}, restyle: [], tiers: {} }
  const done = new Set(merged.done || [])
  const hashes = { ...(merged.hashes || {}) }
  const restyle = new Set()
  const seen = new Set()
  for (let i = 0; i < SHARDS; i++) {
    const s = readJson(path.join(ROOT, shardState(base, i)))
    if (!s) continue
    seen.add(i)
    for (const d of s.done || []) done.add(d)
    for (const [k, v] of Object.entries(s.hashes || {})) hashes[k] = v
    for (const r of s.restyle || []) restyle.add(r)
  }
  for (const r of merged.restyle || []) {
    let owner = -1
    for (let i = 0; i < SHARDS; i++) if (shardOf(r, SHARDS) === i) owner = i
    if (!seen.has(owner)) restyle.add(r)
  }
  merged.done = [...done]
  merged.hashes = hashes
  merged.restyle = [...restyle]
  fs.writeFileSync(p, JSON.stringify(merged, null, 1), 'utf8')
  return { done: done.size, pending: null }
}

function renderOne(q, i) {
  // the shard starts from the queue file's own history, so the slots that are
  // already on disk are not rendered again
  seedShard(q.state, i)
  // no --resolution: each kind takes the tier its surfaces need (scenes 2K,
  // badges 1K), and the tier is re-derived from the measured native size
  const args = [
    path.join(ROOT, 'scripts/regen-art.mjs'),
    '--kinds', q.kinds,
    '--state', shardState(q.state, i),
    '--shard', `${i}/${SHARDS}`,
    '--batch', String(BATCH),
    '--concurrency', '1',
    '--limit', String(LIMIT),
    '--quality', '82',
  ]
  return new Promise((resolve) => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    const cap = (buf) => {
      out += buf
      if (out.length > 100000) out = out.slice(-100000)
    }
    child.stdout.on('data', cap)
    child.stderr.on('data', cap)
    child.on('close', (code) => resolve({ code: code ?? 1, out }))
  })
}

// the regen script always prints "slots: N total · X already done · Y pending",
// so the pending count is the authoritative "how much is left" signal. The
// number comes BEFORE the word: "· 1406 pending ·".
function pending(out) {
  const m = out.match(/(\d+) pending/)
  return m ? Number(m[1]) : null
}

function produced(out) {
  const m = out.match(/produced (\d+)/)
  return m ? Number(m[1]) : 0
}

let round = 0
// --merge-only: merge the shard files into the queue files and stop. The
// merge is what keeps the bookkeeping when the shards work, so it is worth
// being able to run it on its own.
if (argv.includes('--merge-only')) {
  for (const q of QUEUES) {
    const m = mergeShards(q.state)
    console.log(`${q.name}: done ${m.done}`)
  }
  process.exit(0)
}
for (;;) {
  round++
  const t0 = Date.now()
  // every shard of every queue runs at the same time: the connector is the
  // only thing that can be slow, and it is at its best with several sessions
  const runs = []
  for (const q of QUEUES) {
    for (let i = 0; i < SHARDS; i++) runs.push({ q, i })
  }
  const results = await Promise.all(runs.map((r) => renderOne(r.q, r.i)))

  let exhausted = false
  let made = 0
  // per queue: how many shards reported, and how much work they still see
  const left = new Map()
  for (const q of QUEUES) left.set(q.name, { sum: 0, count: 0 })
  for (let k = 0; k < results.length; k++) {
    const r = results[k]
    const { q, i } = runs[k]
    made += produced(r.out)
    // the pending count is read before the quota check, so the log still shows
    // how much is left when the balance runs out
    const p = pending(r.out)
    if (p !== null) {
      const acc = left.get(q.name)
      acc.sum += p
      acc.count++
    }
    if (r.code === 2) {
      exhausted = true
      console.log(`[${q.name} shard ${i}] plan balance exhausted`)
      continue
    }
    if (r.code !== 0) console.log(`[${q.name} shard ${i}] exit=${r.code} ${r.out.trim().split('\n').slice(-1)[0]}`)
  }
  // a shard that did not report leaves its queue unknown, and an unknown queue
  // is never "complete"
  const leftPending = new Map()
  for (const q of QUEUES) {
    const acc = left.get(q.name)
    leftPending.set(q.name, acc.count === SHARDS ? acc.sum : null)
  }

  const counts = []
  for (const q of QUEUES) {
    mergeShards(q.state)
    counts.push(`${q.name}=${leftPending.get(q.name) ?? '?'}`)
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(0)
  const perImage = made ? ((Date.now() - t0) / 1000 / made).toFixed(1) : 'n/a'
  console.log(
    `round ${round}: ${made} image(s) in ${secs}s (${perImage}s/image) · pending ${counts.join(' ')}`,
  )

  // complete only when every queue reports zero pending. "No image produced"
  // alone is not enough: a failed round produces nothing either, and a queue
  // whose shards did not all report is unknown, not finished.
  if (
    !exhausted &&
    leftPending.size === QUEUES.length &&
    [...leftPending.values()].every((x) => x === 0)
  ) {
    console.log('=== both queues complete ===')
    break
  }
  if (exhausted) {
    const waited = Math.round(SLEEP / 60000)
    console.log(`--- plan balance exhausted; waiting ${waited} min for the next window ---`)
    await sleep(SLEEP)
  } else if (made === 0) {
    // nothing rendered and nothing exhausted: a transient error, not the end.
    // Back off instead of spinning on the connector.
    console.log('--- no image produced and no quota stop; retrying in 60s ---')
    await sleep(60000)
  }
}

// Which shard a slot belongs to.
//
//   shardOf(path, n)
//
// The image connector renders one image at a time per session, but several
// sessions at once do run in parallel: four renderer processes measured 5.4 s
// per image against 30.5 s for a single one, and two calls inside a single
// process were slower than one. So the run is split into shards, each shard
// owning a disjoint slice of the slots, and each shard writes its own state
// file.
//
// The split has to be stable and identical in the renderer and in the
// supervisor, so it lives here.
export function shardOf(p, n) {
  if (!(n > 1)) return 0
  let h = 2166136261 >>> 0
  for (let i = 0; i < p.length; i++) {
    h ^= p.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h % n
}

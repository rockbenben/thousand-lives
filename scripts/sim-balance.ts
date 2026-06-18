/**
 * 平衡模拟器：用真实引擎（local.ts + state.ts）跑大量本地局，统计死亡率/结局分布。
 * 运行：npx vite-node scripts/sim-balance.ts [scenarioId|all] [games] [key:decay,key:decay...]
 *   例：npx vite-node scripts/sim-balance.ts spy 2000 cover:2
 *       npx vite-node scripts/sim-balance.ts all 1500
 *
 * 判死：结构化——任一「致死属性」终局 ≤ deathBelow 即记为死亡（跨题材通用，不靠基调正则）。
 * 三种玩家策略：
 *   random  —— 随机选项（乱点的下限）
 *   survive —— 避死：选「致死属性结算后最小值最高」的选项（谨慎玩家）
 *   greedy  —— 抓收益：选「属性增益总和最大」的选项（贪奖励、不顾安危）
 */
import { builtinScenarios } from '../src/scenarios'
import { initState, applyChoice } from '../src/engine/state'
import { localTurn } from '../src/engine/local'
import { gradeRun } from '../src/engine/grade'
import type { Scenario } from '../src/scenarios/schema'
import type { GameState, TurnResult } from '../src/engine/types'

// 可复现的伪随机（mulberry32），让每次跑结果稳定、可对照前后改动
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Strategy = (sc: Scenario, st: GameState, tr: TurnResult) => number

const deathAttrs = (sc: Scenario) => sc.attributes.filter((a) => a.deathBelow !== undefined)

const strategies: Record<string, (rng: () => number) => Strategy> = {
  random: (rng) => (_sc, _st, tr) => Math.floor(rng() * tr.choices.length),
  survive: () => (sc, st, tr) => {
    const dk = deathAttrs(sc).map((a) => a.key)
    let best = 0
    let bestScore = -Infinity
    tr.choices.forEach((c, i) => {
      const minDeath = Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0)))
      const sum = Object.values(c.effects).reduce((s, v) => s + v, 0)
      const score = minDeath * 100 + sum
      if (score > bestScore) { bestScore = score; best = i }
    })
    return best
  },
  greedy: () => (_sc, _st, tr) => {
    let best = 0
    let bestSum = -Infinity
    tr.choices.forEach((c, i) => {
      const sum = Object.values(c.effects).reduce((s, v) => s + v, 0)
      if (sum > bestSum) { bestSum = sum; best = i }
    })
    return best
  },
}

function playOne(sc: Scenario, strat: Strategy, rng: () => number) {
  let st = initState(sc, sc.openings?.[0], sc.ambitions?.[0], 'local')
  let guard = 0
  while (!st.ended && guard++ < sc.maxTurns + 5) {
    const tr = localTurn(sc, st, rng)
    st = applyChoice(sc, st, tr, strat(sc, st, tr), rng)
  }
  return st
}

// 结构化判死：终局有任一致死属性 ≤ deathBelow
function diedStructurally(sc: Scenario, st: GameState) {
  return deathAttrs(sc).some((a) => (st.attributes[a.key] ?? 0) <= a.deathBelow!)
}

// 「坏结局」：真死亡，或结局基调含悲剧/横死关键词（油尽/羽化/形神俱灭/暴露被捕/抄家…）。
// 比纯结构判死更贴近玩家体感——多数题材有「低位非零」触发的悲剧结局。
const TRAGIC = /死|亡|殁|灭|陨|坐化|羽化|身死|道消|镇压|堕|败|罪|诛|狱|凄凉|流落|暴露|被捕|沉|覆|绝|抹杀|横遭|不测|客死|尸|孤|残/
function badEnding(sc: Scenario, st: GameState) {
  return diedStructurally(sc, st) || (st.ended ? TRAGIC.test(st.ended.tone) : false)
}

// 注入假设性衰减（不改剧本源文件，仅用于「看效果再定」）
function withDecay(base: Scenario, decay: Record<string, number>): Scenario {
  if (Object.keys(decay).length === 0) return base
  return {
    ...base,
    attributes: base.attributes.map((a) => (decay[a.key] ? { ...a, decayPerTurn: decay[a.key] } : a)),
  }
}

function run(scId: string, games: number, decay: Record<string, number>) {
  const base = builtinScenarios.find((s) => s.id === scId)
  if (!base) return
  const sc = withDecay(base, decay)
  const injected = Object.entries(decay).map(([k, v]) => `${k}:${v}`).join(',')
  const dattrs = deathAttrs(sc).map((a) => `${a.name}(init ${a.initial}${a.decayPerTurn ? ` decay ${a.decayPerTurn}` : ''})`).join(' / ')
  console.log(`\n══ ${sc.title} (${sc.id}) · ${games}局 · ${sc.maxTurns}${sc.turnUnit}${injected ? ` · [注入 ${injected}]` : ''} ══`)
  console.log(`   致死属性: ${dattrs || '无'}`)

  const pct = (n: number) => `${((n / games) * 100).toFixed(1)}%`.padStart(6)
  for (const name of Object.keys(strategies)) {
    const rng = makeRng(0xc0ffee + name.length * 7919)
    const strat = strategies[name](rng)
    let deaths = 0, bad = 0, reachedMax = 0
    for (let i = 0; i < games; i++) {
      const st = playOne(sc, strat, rng)
      if (diedStructurally(sc, st)) deaths++
      if (badEnding(sc, st)) bad++
      if (st.history.length >= sc.maxTurns) reachedMax++
    }
    console.log(`   [${name.padEnd(7)}] 真死亡 ${pct(deaths)}   坏结局 ${pct(bad)}   活到满期 ${pct(reachedMax)}`)
  }
}

// 解析 "key:val,key:val"
function parseDecay(s: string | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  if (!s) return out
  for (const part of s.split(',')) {
    const [k, v] = part.split(':')
    if (k && v) out[k.trim()] = Number(v)
  }
  return out
}

const arg = process.argv[2] ?? 'xian'
const games = Number(process.argv[3] ?? 2000)
const decay = parseDecay(process.argv[4])
const ids = arg === 'all' ? builtinScenarios.map((s) => s.id) : [arg]
for (const id of ids) run(id, games, decay)

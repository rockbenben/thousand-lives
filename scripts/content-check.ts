/**
 * 内容整体体检：跨题材「结局可达性 / 死结局 / 同质化 / 阈值可行性」综合审计。
 *
 * 运行：npx vite-node scripts/content-check.ts [scenarioId|all] [gamesPerStratPerOpening]
 *   例：npx vite-node scripts/content-check.ts all 2000
 *       npx vite-node scripts/content-check.ts spy 3000
 *
 * 做法：每题材跑「全开局 × 5 种策略」大量真实本地局（random/survive/greedy/climber/explorer），
 *      把每个 ending tone 的触发次数累加，再做一轮静态阈值可行性校验。
 * 报告：
 *   ① 结局覆盖：定义 N / 触发 M / 死结局 K（并列出从未触发的 tone + 其 condition，供排查是否真不可达）
 *   ② 同质化：最大单一结局占比（越低越好；>50% 提示该剧本结局过于集中）
 *   ③ 登顶可达：explorer/climber 能否摸到最高境界印记（apex realm 触达率）
 *   ④ 阈值可行性：任一 `attr>=V` 的 V 若超过该属性的可达上限（ceilingUnlocks 顶档或 max）即真·死结局，标红
 *
 * 死结局说明：很多「未触发」属正常——`<attr><=-1` 哨兵彩蛋(endTone 强制、概率稀有)、
 *   或需特定开局/支线 flag + 高属性的组合，本脚本的 5 策略 × 全开局已尽量覆盖，但极稀有路径仍可能漏掉，
 *   故输出标注「疑似」，需结合 condition 人工判断（阈值可行性那一栏是硬判定）。
 */
import { builtinScenarios } from '../src/scenarios'
import { initState, applyChoice } from '../src/engine/state'
import { localTurn } from '../src/engine/local'
import { parseCondition } from '../src/engine/condition'
import type { Scenario } from '../src/scenarios/schema'
import type { GameState, TurnResult } from '../src/engine/types'

const LETHAL = /形神俱灭|横死|暴毙|身死|道消|坐化|羽化|走火|经脉俱断|抹杀|殒命|当场/

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

const deathKeys = (sc: Scenario) => sc.attributes.filter((a) => a.deathBelow !== undefined).map((a) => a.key)
const ladderFlags = (sc: Scenario) => {
  const out = new Set<string>()
  for (const a of sc.attributes) for (const u of a.ceilingUnlocks ?? []) out.add(u.flag)
  return out
}
// 最高境界印记（ceilingUnlocks 顶档对应的 flag）
function apexFlag(sc: Scenario): string | null {
  let best: { flag: string; max: number } | null = null
  for (const a of sc.attributes) for (const u of a.ceilingUnlocks ?? []) if (!best || u.max > best.max) best = { flag: u.flag, max: u.max }
  return best?.flag ?? null
}

type Pick = (sc: Scenario, st: GameState, tr: TurnResult) => number
const sumEff = (c: { effects: Record<string, number> }) => Object.values(c.effects ?? {}).reduce((a, v) => a + v, 0)

const strategies: Record<string, (rng: () => number) => Pick> = {
  // 乱点（覆盖广度）
  random: (rng) => (_sc, _st, tr) => Math.floor(rng() * tr.choices.length),
  // 避死求稳（走向平和/苟活类结局）
  survive: () => (sc, st, tr) => {
    const dk = deathKeys(sc)
    let best = 0, bs = -Infinity
    tr.choices.forEach((c, i) => {
      const risky = (c.outcomes ?? []).some((o) => o.endTone && LETHAL.test(o.endTone)) || (c.endTone && LETHAL.test(c.endTone))
      if (risky) return
      const m = dk.length ? Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0))) : 0
      const s = m * 100 + sumEff(c)
      if (s > bs) { bs = s; best = i }
    })
    return best
  },
  // 抓收益（高属性类结局）
  greedy: () => (_sc, _st, tr) => {
    let best = 0, bs = -Infinity
    tr.choices.forEach((c, i) => { const s = sumEff(c); if (s > bs) { bs = s; best = i } })
    return best
  },
  // 精算登顶（冲境界印记、权衡生死 → apex/境界结局）
  climber: () => (sc, st, tr) => {
    const lad = ladderFlags(sc), held = new Set(st.flags ?? []), dk = deathKeys(sc)
    const minD = (c: { effects: Record<string, number> }) => (dk.length ? Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0))) : 99)
    let g = -1, gs = -Infinity
    tr.choices.forEach((c, i) => {
      const gn = (c.flagsSet ?? []).some((f) => lad.has(f) && !held.has(f)) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).some((f) => lad.has(f) && !held.has(f)))
      if (!gn || minD(c) < 14) return
      const s = sumEff(c); if (s > gs) { gs = s; g = i }
    })
    if (g >= 0) return g
    let best = 0, bs = -Infinity
    tr.choices.forEach((c, i) => {
      const risky = (c.outcomes ?? []).some((o) => o.endTone && LETHAL.test(o.endTone)) || (c.endTone && LETHAL.test(c.endTone))
      if (risky) return
      const s = minD(c) * 100 + sumEff(c); if (s > bs) { bs = s; best = i }
    })
    return best
  },
  // 探索者：优先抢「任意未持有 flag」的选项（触达支线/开局/印记门控内容），否则避死
  explorer: () => (sc, st, tr) => {
    const held = new Set(st.flags ?? []), dk = deathKeys(sc)
    const minD = (c: { effects: Record<string, number> }) => (dk.length ? Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0))) : 99)
    let g = -1, gs = -Infinity
    tr.choices.forEach((c, i) => {
      const fls = [...(c.flagsSet ?? []), ...(c.outcomes ?? []).flatMap((o) => o.flagsSet ?? [])]
      const gn = fls.some((f) => !held.has(f))
      if (!gn || minD(c) < 12) return
      const s = sumEff(c) + 5; if (s > gs) { gs = s; g = i }
    })
    if (g >= 0) return g
    let best = 0, bs = -Infinity
    tr.choices.forEach((c, i) => { const s = minD(c) * 100 + sumEff(c); if (s > bs) { bs = s; best = i } })
    return best
  },
}

function playOne(sc: Scenario, opening: Scenario['openings'] extends (infer O)[] | undefined ? O : never, pick: Pick, rng: () => number): GameState {
  let st = initState(sc, opening as never, sc.ambitions?.[0], 'local')
  const cap = (sc.maxTurns ?? 0) > 0 ? sc.maxTurns! + 5 : 200
  let g = 0
  while (!st.ended && g++ < cap) {
    const tr = localTurn(sc, st, rng)
    st = applyChoice(sc, st, tr, pick(sc, st, tr), rng)
  }
  return st
}

// 静态阈值可行性：attr>=V 的 V 是否超过该属性可达上限
function clauses(node: ReturnType<typeof parseCondition> | undefined): ReturnType<typeof parseCondition>[] {
  if (!node) return []
  // and/or 节点带 left/right 子句；其余（cmp/has/…）为叶子
  const anyNode = node as unknown as { kind: string; left?: ReturnType<typeof parseCondition>; right?: ReturnType<typeof parseCondition> }
  if ((anyNode.kind === 'and' || anyNode.kind === 'or') && (anyNode.left || anyNode.right)) return [...clauses(anyNode.left), ...clauses(anyNode.right)]
  return [node]
}
function infeasibleEndings(sc: Scenario): string[] {
  const cap: Record<string, number> = {}
  for (const a of sc.attributes) {
    const uc = (a.ceilingUnlocks ?? []).map((u) => u.max)
    cap[a.key] = Math.max(a.max ?? 0, ...(uc.length ? uc : [a.max ?? 0]))
  }
  const bad: string[] = []
  for (const e of sc.endings) for (const c of clauses(parseCondition(e.condition)))
    if (c.kind === 'cmp' && c.op === '>=' && cap[c.attr] !== undefined && c.value > cap[c.attr])
      bad.push(`「${e.tone}」需 ${c.attr}>=${c.value} 但上限仅 ${cap[c.attr]}`)
  return bad
}

// 方向策略：把某属性推到极高/极低（在结算后致死属性留 6 缓冲以免过早送命），覆盖 attr>=高 / attr<=低 阈值结局
const pushAttr = (key: string, dir: 1 | -1): Pick => (sc, st, tr) => {
  const dk = deathKeys(sc)
  let best = 0, bs = -Infinity
  tr.choices.forEach((c, i) => {
    const m = dk.length ? Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0))) : 99
    // 推「低」时允许送死（要触发死线结局）；推「高」时尽量别中途暴毙
    if (dir === 1 && m < 6) return
    const v = dir * ((st.attributes[key] ?? 0) + (c.effects?.[key] ?? 0))
    if (v > bs) { bs = v; best = i }
  })
  return best
}

let seed = 0xC0FFEE
function check(scId: string, games: number) {
  const sc = builtinScenarios.find((s) => s.id === scId)
  if (!sc) { console.log(`未找到题材 ${scId}`); return }
  const tally = new Map<string, number>()
  const openings: unknown[] = sc.openings && sc.openings.length ? sc.openings : [undefined]
  let apexHit = 0, apexRuns = 0
  const apex = apexFlag(sc)
  // 5 个通用策略 + 每属性的「推高/压低」方向策略（后者各开局少量即可，专为触发阈值结局两端）
  const picks: { name: string; make: () => Pick; runs: number }[] = [
    ...Object.keys(strategies).map((name) => ({ name, make: () => strategies[name](makeRng(seed++)), runs: games })),
    ...sc.attributes.flatMap((a) => [
      { name: `max:${a.key}`, make: () => pushAttr(a.key, 1), runs: Math.ceil(games / 2) },
      { name: `min:${a.key}`, make: () => pushAttr(a.key, -1), runs: Math.ceil(games / 2) },
    ]),
  ]
  for (const op of openings) {
    for (const p of picks) {
      const strat = p.make()
      for (let i = 0; i < p.runs; i++) {
        const st = playOne(sc, op as never, strat, makeRng(seed++))
        if (st.ended) tally.set(st.ended.tone, (tally.get(st.ended.tone) ?? 0) + 1)
        if (p.name === 'climber' || p.name === 'explorer') { apexRuns++; if (apex && (st.flags ?? []).includes(apex)) apexHit++ }
      }
    }
  }
  const total = [...tally.values()].reduce((a, b) => a + b, 0)
  const defined = sc.endings.map((e) => e.tone)
  const fired = new Set(tally.keys())
  const never = sc.endings.filter((e) => !fired.has(e.tone))
  const topEntry = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  const infeasible = infeasibleEndings(sc)

  console.log(`\n══ 内容体检 · ${sc.title} (${sc.id}) ══`)
  console.log(`   结局: 定义 ${defined.length} | 触发 ${fired.size} | 疑似死结局 ${never.length}`)
  for (const e of never) console.log(`      ✗ 「${e.tone}」  [${e.condition}]`)
  console.log(`   最大单一结局占比(同质化): ${topEntry ? ((topEntry[1] / total) * 100).toFixed(1) + '%  「' + topEntry[0] + '」' : '—'}`)
  if (apex) console.log(`   最高境界(${apex})触达率[climber/explorer]: ${apexRuns ? ((apexHit / apexRuns) * 100).toFixed(1) : '0'}%`)
  console.log(`   阈值可行性: ${infeasible.length ? '✗ ' + infeasible.length + ' 处超上限' : '✓ 全部 >= 阈值在可达上限内'}`)
  for (const b of infeasible) console.log(`      ✗ ${b}`)
  return { id: sc.id, never: never.length, top: topEntry ? topEntry[1] / total : 0, infeasible: infeasible.length }
}

const arg = process.argv[2] ?? 'all'
const games = Number(process.argv[3] ?? 1500)
const ids = arg === 'all' ? builtinScenarios.map((s) => s.id) : [arg]
const rows = ids.map((id) => check(id, games)).filter(Boolean) as { id: string; never: number; top: number; infeasible: number }[]
if (rows.length > 1) {
  console.log(`\n══ 汇总 ══`)
  for (const r of rows.sort((a, b) => b.top - a.top))
    console.log(`   ${r.id.padEnd(12)} 疑似死结局 ${String(r.never).padStart(2)} | 同质化 ${(r.top * 100).toFixed(0).padStart(3)}% | 阈值不可行 ${r.infeasible}`)
}

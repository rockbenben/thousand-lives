// 难度自测：进取(逐利不避死) / 求稳(避死保命) 两策略下的 死亡/好/坏 占比
// 用法：npx vite-node scripts/balance-greedy.ts [scenarioId ...]   (缺省跑全部)
// 好/坏 = gradeRun 评级 S/A=好, C/D=坏；death = 任一死亡属性<=deathBelow
import { builtinScenarios } from '../src/scenarios'
import { initState, applyChoice } from '../src/engine/state'
import { localTurn } from '../src/engine/local'
import { gradeRun } from '../src/engine/grade'
import type { Scenario, GameState, TurnResult } from '../src/engine/types'
import { makeRng, deathAttrs as dk } from './_sim-shared'
const LETHAL = /形神俱灭|横死|暴毙|身死|殒命|当场|就义|殉国|败露|被杀|葬身|油尽|力竭|抹杀|沉|溺|坠|焚|崩|殁|亡/
// 求稳：避一切致命 endTone，保命优先
const stable = (sc: Scenario, st: GameState, tr: TurnResult) => {
  const k = dk(sc); let b = 0, bs = -1e9
  tr.choices.forEach((c, i) => {
    const ri = (c.outcomes ?? []).some((o: any) => o.endTone && LETHAL.test(o.endTone)) || ((c as any).endTone && LETHAL.test((c as any).endTone))
    const m = k.length ? Math.min(...k.map((a) => (st.attributes[a.key] ?? 0) + (c.effects?.[a.key] ?? 0))) : 99
    const s = m * 100 + (ri ? -9999 : 0); if (s > bs) { bs = s; b = i }
  }); return b
}
// 进取：只追新印记 + 正收益，不避死、不顾安危（真冒进，有好有坏）
const push = (sc: Scenario, st: GameState, tr: TurnResult) => {
  const h = new Set(st.flags ?? []); let b = 0, bs = -1e9
  tr.choices.forEach((c, i) => {
    const f = [...((c as any).flagsSet ?? []), ...((c.outcomes ?? []).flatMap((o: any) => o.flagsSet ?? []))].some((x: string) => !h.has(x))
    const sum = Object.values(c.effects ?? {}).reduce((a: number, v: any) => a + (v as number), 0)
    const s = (f ? 60 : 0) + sum; if (s > bs) { bs = s; b = i }
  }); return b
}
const died = (sc: Scenario, st: GameState) => dk(sc).some((a) => (st.attributes[a.key] ?? 99) <= (a as any).deathBelow)
function run(sc: Scenario, strat: any, N = 200) {
  let dead = 0, good = 0, bad = 0
  for (let seed = 1; seed <= N; seed++) {
    const rng = makeRng(seed * 7919); let st = initState(sc, sc.openings?.[0], '', 'local'); let g = 0
    while (!st.ended && g++ < ((sc.maxTurns ?? 55) + 8)) { const tr = localTurn(sc, st, rng); st = applyChoice(sc, st, tr, strat(sc, st, tr, rng), rng) }
    const d = died(sc, st); const r = gradeRun(sc, st).rating
    if (d) dead++
    if (!d && (r === 'S' || r === 'A')) good++   // 好=存活且高评级；死了一律不算好
    if (d || r === 'C' || r === 'D') bad++         // 坏=死亡 或 存活但低评级
  }
  return { dead: dead / N * 100, good: good / N * 100, bad: bad / N * 100 }
}
const args = process.argv.slice(2)
const list = args.length ? builtinScenarios.filter((s) => args.includes(s.id)) : builtinScenarios
console.log('题材        | 求稳死 | 进取: 死  好  坏')
for (const sc of list) {
  const s = run(sc, stable), p = run(sc, push)
  console.log(`${sc.id.padEnd(11)} | ${s.dead.toFixed(0).padStart(4)}% | ${p.dead.toFixed(0).padStart(3)}% ${p.good.toFixed(0).padStart(3)}% ${p.bad.toFixed(0).padStart(3)}%`)
}

// 剧本逻辑结构守卫：判据与 scripts/logic-check.ts 同源（logicAudit）。
// 除了「十篇零硬伤」，还各造一个坏副本验每条规则真会响——否则「零硬伤」可能只是规则没接线。
import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { auditScenarioLogic } from './logicAudit'
import type { Scenario } from './schema'

describe('剧本逻辑结构（印记链 / endTone 悬空 / 里程碑时间窗）', () => {
  it('十篇内置剧本无确定性硬伤', () => {
    const all = builtinScenarios.flatMap((sc) => auditScenarioLogic(sc).hard.map((h) => `[${sc.id}] ${h}`))
    expect(all).toEqual([])
  })

  // L 依赖 maxTurns 推关键回合，夹具须选有 maxTurns 的剧本（仙侠是涌现式、无 maxTurns）
  const base = builtinScenarios.find((s) => s.id === 'officialdom')!
  const clone = (): Scenario => structuredClone(base)
  const ladderFlag = base.attributes
    .flatMap((a) => (a.ceilingUnlocks ?? []).map((u) => u.flag))
    .find((f) => !(base.openings ?? []).some((o) => o.flag === f))!

  it('G：endTone 指向不存在的基调 → 报', () => {
    const sc = clone()
    outer: for (const e of sc.localEvents ?? [])
      for (const c of e.choices) {
        if (c.endTone) {
          c.endTone = '查无此基调'
          break outer
        }
        for (const o of c.outcomes ?? [])
          if (o.endTone) {
            o.endTone = '查无此基调'
            break outer
          }
      }
    expect(auditScenarioLogic(sc).hard.some((h) => h.startsWith('G '))).toBe(true)
  })

  it('H：晋阶印记无人授予 → 报', () => {
    const sc = clone()
    sc.localEvents = (sc.localEvents ?? []).filter(
      (e) =>
        !e.choices.some(
          (c) =>
            (c.flagsSet ?? []).includes(ladderFlag) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(ladderFlag)),
        ),
    )
    expect(auditScenarioLogic(sc).hard.some((h) => h.startsWith('H ') && h.includes(ladderFlag))).toBe(true)
  })

  it('I：印记授予处要求先持有自身 → 报自锁', () => {
    const sc = clone()
    for (const e of sc.localEvents ?? [])
      if (
        e.choices.some(
          (c) => (c.flagsSet ?? []).includes(ladderFlag) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(ladderFlag)),
        )
      ) {
        e.requires = `has(${ladderFlag})`
        break
      }
    expect(auditScenarioLogic(sc).hard.some((h) => h.startsWith('I ') && h.includes(ladderFlag))).toBe(true)
  })

  it('L：里程碑 minTurn 晚于最后一个关键回合 → 报', () => {
    const sc = clone()
    const km = (sc.localEvents ?? []).find((e) => e.keyMoment)!
    km.minTurn = (sc.maxTurns ?? 40) + 5
    expect(auditScenarioLogic(sc).hard.some((h) => h.startsWith('L '))).toBe(true)
  })

  it('反例：把里程碑的 minTurn 挪回窗口内 → 不该报', () => {
    const sc = clone()
    const km = (sc.localEvents ?? []).find((e) => e.keyMoment)!
    km.minTurn = 1
    expect(auditScenarioLogic(sc).hard.some((h) => h.startsWith('L '))).toBe(false)
  })
})

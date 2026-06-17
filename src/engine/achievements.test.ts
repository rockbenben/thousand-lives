import { describe, it, expect } from 'vitest'
import { computeAchievements } from './achievements'
import type { RunStats } from '../storage'

const noStats: RunStats = {
  runs: 0, ratings: [], anyLocal: false, anyAi: false, deaths: 0,
  sRanks: 0, maxTurns: 0, maxGoal: 0, customCleared: false, aliveClear: false,
  sRankScenarios: [],
}
const done = (id: string, achs: ReturnType<typeof computeAchievements>) =>
  achs.find((a) => a.id === id)!.done

describe('computeAchievements', () => {
  it('全空时只有 first 未达成、其余皆未解锁', () => {
    const a = computeAchievements({ scenarios: [{ id: 'x', seen: 0, total: 20 }], stats: noStats })
    expect(a.every((x) => !x.done)).toBe(true)
  })

  it('first 在解锁任一结局后达成', () => {
    const a = computeAchievements({ scenarios: [{ id: 'x', seen: 1, total: 20 }], stats: noStats })
    expect(done('first', a)).toBe(true)
  })

  it('阅尽千道：每个剧本都通关', () => {
    const all = computeAchievements({
      scenarios: [
        { id: 'a', seen: 1, total: 20 },
        { id: 'b', seen: 2, total: 20 },
      ],
      stats: noStats,
    })
    expect(done('all-scenarios', all)).toBe(true)
    const partial = computeAchievements({
      scenarios: [
        { id: 'a', seen: 1, total: 20 },
        { id: 'b', seen: 0, total: 20 },
      ],
      stats: noStats,
    })
    expect(done('all-scenarios', partial)).toBe(false)
  })

  it('百味/千面按累计结局数', () => {
    const a = computeAchievements({
      scenarios: [
        { id: 'a', seen: 12, total: 20 },
        { id: 'b', seen: 9, total: 20 },
      ],
      stats: noStats,
    })
    expect(done('seen-20', a)).toBe(true)
    expect(done('seen-50', a)).toBe(false)
    expect(a.find((x) => x.id === 'seen-50')!.progress).toEqual({ cur: 21, total: 50 })
  })

  it('功德圆满：集齐某剧本全部结局', () => {
    const a = computeAchievements({ scenarios: [{ id: 'a', seen: 20, total: 20 }], stats: noStats })
    expect(done('complete-one', a)).toBe(true)
  })

  it('S 级与本地通关来自 stats', () => {
    const a = computeAchievements({
      scenarios: [{ id: 'a', seen: 1, total: 20 }],
      stats: { ...noStats, runs: 3, ratings: ['B', 'S'], anyLocal: true, deaths: 2 },
    })
    expect(done('s-rank', a)).toBe(true)
    expect(done('local-clear', a)).toBe(true)
    expect(done('ai-clear', a)).toBe(false)
    expect(done('death-1', a)).toBe(true)
  })
})

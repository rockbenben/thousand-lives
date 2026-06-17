import { describe, it, expect } from 'vitest'
import { gradeRun } from './grade'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState } from './state'

const sc: Scenario = scenarioSchema.parse({
  id: 'g', title: '测试', emoji: '🎲', intro: 'x',
  attributes: [
    { key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0,
      bands: [
        { upTo: 20, label: '濒死', severity: 'critical' },
        { upTo: 100, label: '康健', severity: 'high' },
      ] },
  ],
  maxTurns: 10, systemPrompt: 'x',
  endings: [{ condition: 'maxTurns', tone: '终' }],
})

const stateAt = (hp: number, turns: number, tone?: string) => ({
  ...initState(sc),
  attributes: { hp },
  history: Array.from({ length: turns }, () => ({ narrative: 'x', choiceText: 'x', summary: 'x' })),
  ended: tone ? { tone, reason: 'x' } : undefined,
})

describe('gradeRun', () => {
  it('满状态满回合 → 高评级', () => {
    const g = gradeRun(sc, stateAt(100, 10, '终'))
    expect(g.rating).toBe('S')
  })
  it('早死低状态 → 低评级', () => {
    const g = gradeRun(sc, stateAt(0, 1, '死亡'))
    expect(['C', 'D']).toContain(g.rating)
  })
  it('称号即结局基调本身（不再叠属性档位前缀，避免三段/重复）', () => {
    const g = gradeRun(sc, stateAt(0, 5, '死亡'))
    expect(g.title).toBe('死亡')
  })
  it('属性为 NaN/越界时评级不崩（夹取到 [0,1]）', () => {
    const g = gradeRun(sc, { ...stateAt(50, 5), attributes: { hp: NaN } })
    expect(['S', 'A', 'B', 'C', 'D']).toContain(g.rating)
  })
})

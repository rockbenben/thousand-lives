import { describe, it, expect } from 'vitest'
import { hookQuestion } from './hookQuestion'
import { initState } from '../engine/state'
import { builtinScenarios } from '../scenarios'

const sc = builtinScenarios.find((b) => b.id === 'xian')!

describe('hookQuestion', () => {
  it('进行中：含题材、非空、是问句', () => {
    const q = hookQuestion(sc, initState(sc))
    expect(q).toContain(sc.title)
    expect(q.endsWith('？')).toBe(true)
  })
  it('有结局：点出结局基调', () => {
    const st = { ...initState(sc), ended: { tone: '羽化登仙', reason: '' }, history: [{ narrative: '', choiceText: '', summary: '' }] }
    expect(hookQuestion(sc, st)).toContain('羽化登仙')
  })
  it('极端横祸：引用灾祸引子', () => {
    const st = { ...initState(sc), fateHighlight: { text: '飞来横祸——一场无妄之灾', kind: 'disaster' as const, turn: 3 } }
    const q = hookQuestion(sc, st)
    expect(q).toContain('飞来横祸')
    expect(q).not.toContain('一场无妄之灾') // lead() 只取破折号前的引子，剥掉尾巴
  })
})

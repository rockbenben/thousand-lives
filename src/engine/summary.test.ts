import { describe, it, expect } from 'vitest'
import { buildSummaryCard } from './summary'
import { wasteland } from '../scenarios/wasteland'
import { initState } from './state'

describe('buildSummaryCard', () => {
  it('含标题、结局、回合数、最终属性与结局文', () => {
    const st = {
      ...initState(wasteland),
      history: [
        { narrative: 'n1', choiceText: '搜刮药店', summary: '找到药品' },
        { narrative: 'n2', choiceText: '夜行', summary: '遭遇感染者' },
      ],
      ended: { tone: '死亡', reason: '生命耗尽' },
    }
    const card = buildSummaryCard(wasteland, st, '你倒在了黎明前。')
    expect(card).toContain('千世书')
    expect(card).toContain('末世求生')
    expect(card).toContain('死亡')
    expect(card).toContain('2 天')
    expect(card).toContain('生命')
    expect(card).toContain('你倒在了黎明前。')
    expect(card).toContain('找到药品')
  })
})

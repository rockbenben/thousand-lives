import { describe, it, expect } from 'vitest'
import { wasteland } from './wasteland'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('wasteland 尺度与前提', () => {
  it('turnUnit=月、maxTurns=36（三年末世）', () => {
    expect(wasteland.turnUnit).toBe('月')
    expect(wasteland.maxTurns).toBe(36)
  })
  it('intro 与 systemPrompt 改为「救援无望·长期重建」框架（去掉「撑过三十天」「等待...军方救援」）', () => {
    expect(wasteland.intro).not.toContain('三十天')
    expect(wasteland.systemPrompt).toContain('每回合代表一个月')
    expect(wasteland.systemPrompt).toContain('据点')
    expect(wasteland.systemPrompt).not.toContain('每回合代表一天')
  })
})

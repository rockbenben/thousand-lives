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

describe('wasteland 物资据点封顶', () => {
  it('无据点印记时物资封顶 50（= base，≥ initial 不被削）', () => {
    expect(clampEffects(wasteland, { supplies: 50 }, { supplies: 20 }, []).supplies).toBe(50)
  })
  it('落脚点→65 据点→80 堡垒→92 营地→100 逐级解锁', () => {
    expect(clampEffects(wasteland, { supplies: 60 }, { supplies: 20 }, ['落脚点']).supplies).toBe(65)
    expect(clampEffects(wasteland, { supplies: 75 }, { supplies: 20 }, ['落脚点', '据点']).supplies).toBe(80)
    expect(clampEffects(wasteland, { supplies: 90 }, { supplies: 20 }, ['落脚点', '据点', '堡垒']).supplies).toBe(92)
    expect(clampEffects(wasteland, { supplies: 95 }, { supplies: 20 }, ['落脚点', '据点', '堡垒', '营地']).supplies).toBe(100)
  })
  it('生命与理智不设据点封顶', () => {
    expect(clampEffects(wasteland, { hp: 95 }, { hp: 20 }, []).hp).toBe(100)
    expect(clampEffects(wasteland, { sanity: 95 }, { sanity: 20 }, []).sanity).toBe(100)
  })
})

describe('wasteland 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 便利店店员: '店员', 退役军医: '军医', 高中生: '高中生' }
    for (const [name, flag] of Object.entries(want)) {
      const op = wasteland.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(wasteland, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = wasteland.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('店员')).toBeGreaterThanOrEqual(1)
    expect(byFlag('军医')).toBeGreaterThanOrEqual(1)
    expect(byFlag('高中生')).toBeGreaterThanOrEqual(1)
  })
})

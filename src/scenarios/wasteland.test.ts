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

describe('wasteland 建据点闸门', () => {
  it('四道建据点机缘均为 keyMoment、授对应据点印记、按序串链', () => {
    const want = [
      { summary: '觅一处栖身', flag: '落脚点', prev: undefined as string | undefined, pick: '清场加固，据为巢穴' },
      { summary: '加固扩建', flag: '据点', prev: '落脚点', pick: '扩建据点，囤粮储水' },
      { summary: '筑墙设防', flag: '堡垒', prev: '据点', pick: '筑墙设防，严阵以待' },
      { summary: '聚拢幸存者', flag: '营地', prev: '堡垒', pick: '接纳幸存者，立规矩号令一方' },
    ]
    for (const w of want) {
      const ev = (wasteland.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扩建据点当回合物资可破落脚点上限 65', () => {
    let st = initState(wasteland, wasteland.openings![0])
    st = { ...st, attributes: { hp: 70, sanity: 60, supplies: 65 }, flags: ['落脚点'], history: Array(8).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wasteland.localEvents ?? []).find((e) => e.summary === '加固扩建')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据点'))
    const next = applyChoice(wasteland, st, tr as any, idx, () => 0.5) // 0.5>=0.18 不触发命运无常
    expect(next.flags).toContain('据点')
    expect(next.attributes.supplies).toBeGreaterThan(65) // 该支 supplies+10，破落脚点上限65（据点上限80）
  })
})

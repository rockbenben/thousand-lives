import { describe, it, expect } from 'vitest'
import { officialdom } from './officialdom'
import { clampEffects, initState, applyChoice } from '../engine/state'

describe('officialdom 长度与圣眷衰减（70岁荣休）', () => {
  it('maxTurns 扩到 44（进士→70岁荣休）', () => {
    expect(officialdom.maxTurns).toBe(44)
  })
  it('圣眷 decay 降为 1（44年长跑可活）', () => {
    const favor = officialdom.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn).toBe(1)
  })
  it('systemPrompt 不再硬编「第 24 年」', () => {
    expect(officialdom.systemPrompt).not.toContain('第 24 年')
  })
})

describe('officialdom 权势官阶封顶', () => {
  it('无官阶印记时权势封顶 30', () => {
    expect(clampEffects(officialdom, { power: 28 }, { power: 50 }, []).power).toBe(30)
  })
  it('知府印记解锁封顶 50', () => {
    expect(clampEffects(officialdom, { power: 45 }, { power: 50 }, ['知府']).power).toBe(50)
  })
  it('封疆印记解锁封顶 70', () => {
    expect(clampEffects(officialdom, { power: 60 }, { power: 50 }, ['知府', '封疆']).power).toBe(70)
  })
  it('九卿印记解锁封顶 85', () => {
    expect(clampEffects(officialdom, { power: 80 }, { power: 50 }, ['知府', '封疆', '九卿']).power).toBe(85)
  })
  it('阁老印记解锁封顶 100', () => {
    expect(clampEffects(officialdom, { power: 95 }, { power: 50 }, ['知府', '封疆', '九卿', '阁老']).power).toBe(100)
  })
  it('圣眷与官声不设官阶封顶', () => {
    expect(clampEffects(officialdom, { favor: 95 }, { favor: 50 }, []).favor).toBe(100)
    expect(clampEffects(officialdom, { name: 95 }, { name: 50 }, []).name).toBe(100)
  })
})

describe('officialdom 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门进士', '世家子弟', '内廷养子']) {
      const op = officialdom.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(officialdom, op).flags).toContain(n)
    }
  })
  it('内廷养子专属事件带 has(内廷养子) 门控', () => {
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '内廷阴影')
    expect(ev?.requires).toContain('has(内廷养子)')
  })
})

describe('officialdom 升迁闸门', () => {
  it('四道升迁机缘均为 keyMoment 且授对应官阶印记、按序串链', () => {
    const want = [
      { summary: '擢升知府', flag: '知府', prev: undefined },
      { summary: '晋升封疆', flag: '封疆', prev: '知府' },
      { summary: '晋位九卿', flag: '九卿', prev: '封疆' },
      { summary: '入阁拜相', flag: '阁老', prev: '九卿' },
    ]
    for (const w of want) {
      const ev = (officialdom.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const grants = ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag))
      expect(grants, w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('擢升知府后同回合权势可破 30 上限', () => {
    let st = initState(officialdom, officialdom.openings!.find((o) => o.name === '寒门进士'))
    st = { ...st, attributes: { power: 28, name: 50, favor: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '擢升知府')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('知府'))
    const next = applyChoice(officialdom, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('知府')
    expect(next.attributes.power).toBeGreaterThan(30)
  })
})

import { describe, it, expect } from 'vitest'
import { scifi } from './scifi'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('scifi 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      殖民舰长: '殖民舰长',
      首席科学家: '首席科学家',
      临危受命的代理舰长: '代理舰长',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = scifi.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(scifi, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = scifi.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('殖民舰长')).toBeGreaterThanOrEqual(1)
    expect(byFlag('首席科学家')).toBeGreaterThanOrEqual(1)
    expect(byFlag('代理舰长')).toBeGreaterThanOrEqual(1)
  })
})

describe('scifi 科技航程封顶', () => {
  it('无航程印记时科技封顶 25（= base，≥ initial 不被削）', () => {
    expect(clampEffects(scifi, { tech: 25 }, { tech: 20 }, []).tech).toBe(25)
  })
  it('开局科技 15 不被 base ceiling 削', () => {
    expect(clampEffects(scifi, { tech: 15 }, {}, []).tech).toBe(15)
  })
  it('深空→45 越障→70 抵近→90 扎根→100 逐级解锁', () => {
    expect(clampEffects(scifi, { tech: 40 }, { tech: 30 }, ['深空']).tech).toBe(45)
    expect(clampEffects(scifi, { tech: 60 }, { tech: 30 }, ['深空', '越障']).tech).toBe(70)
    expect(clampEffects(scifi, { tech: 85 }, { tech: 30 }, ['深空', '越障', '抵近']).tech).toBe(90)
    expect(clampEffects(scifi, { tech: 95 }, { tech: 30 }, ['深空', '越障', '抵近', '扎根']).tech).toBe(100)
  })
  it('船体与文明不设航程封顶', () => {
    expect(clampEffects(scifi, { integrity: 95 }, { integrity: 20 }, []).integrity).toBe(100)
    expect(clampEffects(scifi, { colony: 95 }, { colony: 20 }, []).colony).toBe(100)
  })
})

describe('scifi 升程闸门', () => {
  it('四道升程机缘均为 keyMoment、授对应航程印记、按序串链', () => {
    const want = [
      { summary: '水源告急', flag: '深空', prev: undefined, pick: '研发新型水循环装置' },
      { summary: '陨石带', flag: '越障', prev: '深空', pick: '研发临时护盾再穿越' },
      { summary: '候选行星', flag: '抵近', prev: '越障', pick: '改道详查，或是新家园' },
      { summary: '第一座城', flag: '扎根', prev: '抵近', pick: '开放包容，广纳人心' },
    ]
    for (const w of want) {
      const ev = (scifi.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扎根闸门保留 colony>=50 数值门控（不被 has 覆盖）', () => {
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '第一座城')!
    expect(ev.requires).toContain('has(抵近)')
    expect(ev.requires).toContain('colony>=50')
  })
  it('助渡深空当回合科技可破 25 上限', () => {
    let st = initState(scifi, scifi.openings![0])
    st = { ...st, attributes: { tech: 25, integrity: 60, colony: 50 }, history: Array(3).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '水源告急')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('深空'))
    const next = applyChoice(scifi, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('深空')
    expect(next.attributes.tech).toBeGreaterThan(25)
  })
})

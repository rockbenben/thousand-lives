import { describe, it, expect } from 'vitest'
import { spy } from './spy'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('spy 情报功勋封顶', () => {
  it('无功勋印记时情报封顶 15（= base，≥ initial 不被削）', () => {
    expect(clampEffects(spy, { intel: 15 }, { intel: 20 }, []).intel).toBe(15)
  })
  it('立功→50 建功→75 奇功→90 殊勋→100 逐级解锁', () => {
    expect(clampEffects(spy, { intel: 45 }, { intel: 20 }, ['立功']).intel).toBe(50)
    expect(clampEffects(spy, { intel: 70 }, { intel: 20 }, ['立功', '建功']).intel).toBe(75)
    expect(clampEffects(spy, { intel: 85 }, { intel: 20 }, ['立功', '建功', '奇功']).intel).toBe(90)
    expect(clampEffects(spy, { intel: 95 }, { intel: 20 }, ['立功', '建功', '奇功', '殊勋']).intel).toBe(100)
  })
  it('掩护与信任不设功勋封顶', () => {
    expect(clampEffects(spy, { cover: 95 }, { cover: 20 }, []).cover).toBe(100)
    expect(clampEffects(spy, { trust: 95 }, { trust: 20 }, []).trust).toBe(100)
  })
})

describe('spy 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 潜伏特工: '潜伏特工', 双面间谍: '双面间谍', 觉醒的伪职: '觉醒伪职' }
    for (const [name, flag] of Object.entries(want)) {
      const op = spy.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(spy, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = spy.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('潜伏特工')).toBeGreaterThanOrEqual(1)
    expect(byFlag('双面间谍')).toBeGreaterThanOrEqual(1)
    expect(byFlag('觉醒伪职')).toBeGreaterThanOrEqual(1)
  })
})

describe('spy 升功勋闸门', () => {
  it('四道升功勋机缘均为 keyMoment、授对应功勋印记、按序串链', () => {
    const want = [
      { summary: '舞厅套话', flag: '立功', need: undefined as string | undefined, pick: '步步引话，套取布防' },
      { summary: '策反译电员', flag: '建功', need: 'has(立功) & cover>=50', pick: '动之以情、济其困厄，徐图策反' },
      { summary: '日侨名册', flag: '奇功', need: 'has(建功)', pick: '通宵比对，挖出潜藏暗桩' },
      { summary: '密电草稿', flag: '殊勋', need: 'has(奇功)', pick: '冒险去敌机要室盗取密码本' },
    ]
    for (const w of want) {
      const ev = (spy.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.need) expect(ev!.requires, w.summary).toBe(w.need)
    }
  })
  it('套取布防当回合情报可破 15 上限', () => {
    let st = initState(spy, spy.openings![0])
    st = { ...st, attributes: { cover: 60, intel: 15, trust: 45 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (spy.localEvents ?? []).find((e) => e.summary === '舞厅套话')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('立功'))
    const next = applyChoice(spy, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('立功')
    expect(next.attributes.intel).toBeGreaterThan(15) // 该支 intel+12，破上限 15（立功上限 50）
  })
})

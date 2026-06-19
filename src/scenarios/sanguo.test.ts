import { describe, it, expect } from 'vitest'
import { sanguo } from './sanguo'
import { clampEffects, initState, applyChoice } from '../engine/state'

describe('sanguo 谋略势力封顶', () => {
  it('无势力印记时谋略封顶 30（= initial，不被削）', () => {
    expect(clampEffects(sanguo, { wit: 30 }, { wit: 20 }, []).wit).toBe(30)
  })
  it('据州印记解锁封顶 45', () => {
    expect(clampEffects(sanguo, { wit: 40 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('称雄印记解锁封顶 70', () => {
    expect(clampEffects(sanguo, { wit: 60 }, { wit: 20 }, ['据州', '称雄']).wit).toBe(70)
  })
  it('鼎足印记解锁封顶 88', () => {
    expect(clampEffects(sanguo, { wit: 80 }, { wit: 20 }, ['据州', '称雄', '鼎足']).wit).toBe(88)
  })
  it('霸业印记解锁封顶 100', () => {
    expect(clampEffects(sanguo, { wit: 95 }, { wit: 20 }, ['据州', '称雄', '鼎足', '霸业']).wit).toBe(100)
  })
  it('失势降阶：有据州称雄、失称雄后谋略上限回落 45', () => {
    // flagsClear 把 称雄 去掉，只剩 据州 → ceiling 45
    expect(clampEffects(sanguo, { wit: 45 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('声望与信任不设封顶；信任带每年衰减', () => {
    expect(clampEffects(sanguo, { repute: 95 }, { repute: 20 }, []).repute).toBe(100)
    expect(sanguo.attributes.find((a) => a.key === 'trust')!.decayPerTurn).toBe(1)
  })
})

describe('sanguo 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门游学士子', '世家子弟', '降将谋臣']) {
      const op = sanguo.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(sanguo, op).flags).toContain(n)
    }
  })
  it('身份专属事件带 has() 门控（至少各一）', () => {
    const evs = sanguo.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('降将谋臣')).toBeGreaterThanOrEqual(1)
    expect(byFlag('世家子弟')).toBeGreaterThanOrEqual(1)
    expect(byFlag('寒门游学士子')).toBeGreaterThanOrEqual(1)
  })
})

describe('sanguo 升势闸门', () => {
  it('四道升势机缘均为 keyMoment 且授对应势力印记、按序串链', () => {
    const want = [
      { summary: '助主据州', flag: '据州', prev: undefined },
      { summary: '助主称雄', flag: '称雄', prev: '据州' },
      { summary: '三分定策', flag: '鼎足', prev: '称雄' },
      { summary: '一统在望', flag: '霸业', prev: '鼎足' },
    ]
    for (const w of want) {
      const ev = (sanguo.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      expect(ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag)), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('助主据州后同回合谋略可破 30 上限', () => {
    let st = initState(sanguo, sanguo.openings!.find((o) => o.name === '寒门游学士子'))
    st = { ...st, attributes: { wit: 30, repute: 40, trust: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '助主据州')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据州'))
    const next = applyChoice(sanguo, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('据州')
    expect(next.attributes.wit).toBeGreaterThan(30)
  })
})

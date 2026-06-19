import { describe, it, expect } from 'vitest'
import { bookTransmigration } from './book'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

const book = bookTransmigration

describe('book 剧情偏离封顶', () => {
  it('无偏离印记时偏离封顶 10（= base，≥ initial 不被削）', () => {
    expect(clampEffects(book, { plot: 10 }, { plot: 20 }, []).plot).toBe(10)
  })
  it('撬动→30 生变→60 颠覆→85 改天→100 逐级解锁', () => {
    expect(clampEffects(book, { plot: 25 }, { plot: 20 }, ['撬动']).plot).toBe(30)
    expect(clampEffects(book, { plot: 50 }, { plot: 20 }, ['撬动', '生变']).plot).toBe(60)
    expect(clampEffects(book, { plot: 80 }, { plot: 20 }, ['撬动', '生变', '颠覆']).plot).toBe(85)
    expect(clampEffects(book, { plot: 95 }, { plot: 20 }, ['撬动', '生变', '颠覆', '改天']).plot).toBe(100)
  })
  it('主角好感与安全值不设偏离封顶', () => {
    expect(clampEffects(book, { favor: 95 }, { favor: 20 }, []).favor).toBe(100)
    expect(clampEffects(book, { safety: 95 }, { safety: 20 }, []).safety).toBe(100)
  })
})

describe('book 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 恶毒女配: '恶毒女配', 反派之女: '反派之女', 陪嫁婢女: '陪嫁婢女' }
    for (const [name, flag] of Object.entries(want)) {
      const op = book.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(book, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = book.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('恶毒女配')).toBeGreaterThanOrEqual(1)
    expect(byFlag('反派之女')).toBeGreaterThanOrEqual(1)
    expect(byFlag('陪嫁婢女')).toBeGreaterThanOrEqual(1)
  })
})

describe('book 升偏离闸门', () => {
  it('四道升偏离机缘均为 keyMoment、授对应偏离印记、按序串链', () => {
    const want = [
      { summary: '宫宴落水', flag: '撬动', prev: undefined as string | undefined, pick: '反其道行之，当众救下女主' },
      { summary: '反派密谈', flag: '生变', prev: '撬动', pick: '阳奉阴违，暗中给反派使绊' },
      { summary: '储位之争', flag: '颠覆', prev: '生变', pick: '押注太子，倾力相助' },
      { summary: '宫变前夜', flag: '改天', prev: '颠覆', pick: '先发制人，连夜布局逼宫' },
    ]
    for (const w of want) {
      const ev = (book.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('救女主当回合偏离可破 10 上限', () => {
    let st = initState(book, book.openings![0])
    st = { ...st, attributes: { plot: 10, favor: 20, safety: 60 }, history: [] }
    const ev = (book.localEvents ?? []).find((e) => e.summary === '宫宴落水')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('撬动'))
    const next = applyChoice(book, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('撬动')
    expect(next.attributes.plot).toBeGreaterThan(10) // 该支 plot+12，破上限 10（撬动上限 30）
  })
})

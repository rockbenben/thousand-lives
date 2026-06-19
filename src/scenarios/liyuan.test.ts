import { describe, it, expect } from 'vitest'
import { liyuan } from './liyuan'
import { clampEffects, initState, applyChoice } from '../engine/state'

describe('liyuan 技艺名位封顶', () => {
  it('无名位印记时技艺封顶 20', () => {
    expect(clampEffects(liyuan, { art: 18 }, { art: 50 }, []).art).toBe(20)
  })
  it('搭班印记解锁封顶 45', () => {
    expect(clampEffects(liyuan, { art: 40 }, { art: 50 }, ['搭班']).art).toBe(45)
  })
  it('挑梁印记解锁封顶 70', () => {
    expect(clampEffects(liyuan, { art: 60 }, { art: 50 }, ['搭班', '挑梁']).art).toBe(70)
  })
  it('名伶印记解锁封顶 90', () => {
    expect(clampEffects(liyuan, { art: 85 }, { art: 50 }, ['搭班', '挑梁', '名伶']).art).toBe(90)
  })
  it('泰斗印记解锁封顶 100', () => {
    expect(clampEffects(liyuan, { art: 95 }, { art: 50 }, ['搭班', '挑梁', '名伶', '泰斗']).art).toBe(100)
  })
  it('安稳与声名不设名位封顶', () => {
    expect(clampEffects(liyuan, { safety: 95 }, { safety: 50 }, []).safety).toBe(100)
    expect(clampEffects(liyuan, { fame: 95 }, { fame: 50 }, []).fame).toBe(100)
  })
})

describe('liyuan 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['戏班学徒', '落魄世家小姐', '票友下海']) {
      const op = liyuan.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(liyuan, op).flags).toContain(n)
    }
  })
  it('身份专属事件带 has() 门控（至少各一）', () => {
    const evs = liyuan.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('落魄世家小姐')).toBeGreaterThanOrEqual(1)
    expect(byFlag('票友下海')).toBeGreaterThanOrEqual(1)
    expect(byFlag('戏班学徒')).toBeGreaterThanOrEqual(1)
  })
})

describe('liyuan 升艺闸门', () => {
  it('四道升艺机缘均为 keyMoment 且授对应名位印记、按序串链', () => {
    const want = [
      { summary: '出科搭班', flag: '搭班', prev: undefined },
      { summary: '挑梁担纲', flag: '挑梁', prev: '搭班' },
      { summary: '唱红名动', flag: '名伶', prev: '挑梁' },
      { summary: '开宗立派', flag: '泰斗', prev: '名伶' },
    ]
    for (const w of want) {
      const ev = (liyuan.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      expect(ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag)), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('出科搭班后同回合技艺可破 20 上限', () => {
    let st = initState(liyuan, liyuan.openings!.find((o) => o.name === '戏班学徒'))
    st = { ...st, attributes: { art: 18, fame: 40, safety: 70 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (liyuan.localEvents ?? []).find((e) => e.summary === '出科搭班')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('搭班'))
    const next = applyChoice(liyuan, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('搭班')
    expect(next.attributes.art).toBeGreaterThan(20)
  })
})

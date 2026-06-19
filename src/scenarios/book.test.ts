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

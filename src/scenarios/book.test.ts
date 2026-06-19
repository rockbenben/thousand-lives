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

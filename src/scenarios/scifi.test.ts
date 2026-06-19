import { describe, it, expect } from 'vitest'
import { scifi } from './scifi'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

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

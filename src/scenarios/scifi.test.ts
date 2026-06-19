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

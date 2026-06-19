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

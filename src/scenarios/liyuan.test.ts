import { describe, it, expect } from 'vitest'
import { liyuan } from './liyuan'
import { clampEffects, initState } from '../engine/state'

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

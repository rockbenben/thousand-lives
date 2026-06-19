import { describe, it, expect } from 'vitest'
import { liyuan } from './liyuan'
import { clampEffects } from '../engine/state'

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

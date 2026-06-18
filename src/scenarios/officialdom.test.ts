import { describe, it, expect } from 'vitest'
import { officialdom } from './officialdom'
import { clampEffects } from '../engine/state'

describe('officialdom 长度与圣眷衰减（70岁荣休）', () => {
  it('maxTurns 扩到 44（进士→70岁荣休）', () => {
    expect(officialdom.maxTurns).toBe(44)
  })
  it('圣眷 decay 降为 1（44年长跑可活）', () => {
    const favor = officialdom.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn).toBe(1)
  })
  it('systemPrompt 不再硬编「第 24 年」', () => {
    expect(officialdom.systemPrompt).not.toContain('第 24 年')
  })
})

describe('officialdom 权势官阶封顶', () => {
  it('无官阶印记时权势封顶 30', () => {
    expect(clampEffects(officialdom, { power: 28 }, { power: 50 }, []).power).toBe(30)
  })
  it('知府印记解锁封顶 50', () => {
    expect(clampEffects(officialdom, { power: 45 }, { power: 50 }, ['知府']).power).toBe(50)
  })
  it('封疆印记解锁封顶 70', () => {
    expect(clampEffects(officialdom, { power: 60 }, { power: 50 }, ['知府', '封疆']).power).toBe(70)
  })
  it('九卿印记解锁封顶 85', () => {
    expect(clampEffects(officialdom, { power: 80 }, { power: 50 }, ['知府', '封疆', '九卿']).power).toBe(85)
  })
  it('阁老印记解锁封顶 100', () => {
    expect(clampEffects(officialdom, { power: 95 }, { power: 50 }, ['知府', '封疆', '九卿', '阁老']).power).toBe(100)
  })
  it('圣眷与官声不设官阶封顶', () => {
    expect(clampEffects(officialdom, { favor: 95 }, { favor: 50 }, []).favor).toBe(100)
    expect(clampEffects(officialdom, { name: 95 }, { name: 50 }, []).name).toBe(100)
  })
})

import { describe, it, expect } from 'vitest'
import { officialdom } from './officialdom'

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

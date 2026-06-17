import { describe, it, expect } from 'vitest'
import { keyMomentTurns, isKeyMoment } from './keymoment'

describe('keyMoment', () => {
  it('30 回合约每 4 回合一个、终局在内', () => {
    expect(keyMomentTurns(30)).toEqual([4, 8, 11, 15, 19, 23, 26, 30])
  })
  it('isKeyMoment 命中里程碑回合', () => {
    expect(isKeyMoment(15, 30)).toBe(true)
    expect(isKeyMoment(30, 30)).toBe(true)
    expect(isKeyMoment(14, 30)).toBe(false)
  })
  it('短剧本去重不重复', () => {
    const t = keyMomentTurns(2)
    expect(new Set(t).size).toBe(t.length)
    expect(t).toContain(2) // 终局始终是关键
  })
  it('maxTurns=1 退化为第 1 回合', () => {
    expect(keyMomentTurns(1)).toEqual([1])
  })
})

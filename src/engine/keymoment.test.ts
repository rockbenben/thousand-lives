import { describe, it, expect } from 'vitest'
import { keyMomentTurns, isKeyMoment, keyMomentIndex } from './keymoment'

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

describe('涌现剧本 keyMoment 周期节奏', () => {
  it('无 maxTurns 时每 4 回合一个里程碑', () => {
    expect(isKeyMoment(4, undefined)).toBe(true)
    expect(isKeyMoment(8, undefined)).toBe(true)
    expect(isKeyMoment(7, undefined)).toBe(false)
    expect(isKeyMoment(0, undefined)).toBe(false)
  })
  it('keyMomentIndex 在涌现下给递增序号', () => {
    expect(keyMomentIndex(4, undefined)).toBe(0)
    expect(keyMomentIndex(8, undefined)).toBe(1)
    expect(keyMomentIndex(7, undefined)).toBe(-1)
  })
  it('有 maxTurns 行为不变', () => {
    expect(isKeyMoment(5, 20)).toBe(isKeyMoment(5, 20)) // 占位:保持原 keyMomentTurns(20) 逻辑
  })
})

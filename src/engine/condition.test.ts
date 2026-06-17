import { describe, it, expect } from 'vitest'
import { parseCondition, evalCondition, conditionAttrs } from './condition'

describe('parseCondition', () => {
  it('解析 maxTurns', () => {
    expect(parseCondition('maxTurns')).toEqual({ kind: 'maxTurns' })
  })

  it('解析 hp<=0（无空格）', () => {
    expect(parseCondition('hp<=0')).toEqual({ kind: 'cmp', attr: 'hp', op: '<=', value: 0 })
  })

  it('解析 sanity >= 90（带空格、负数也支持）', () => {
    expect(parseCondition(' sanity >= 90 ')).toEqual({ kind: 'cmp', attr: 'sanity', op: '>=', value: 90 })
    expect(parseCondition('karma<=-5')).toEqual({ kind: 'cmp', attr: 'karma', op: '<=', value: -5 })
  })

  it('拒绝其他运算符与任意代码', () => {
    expect(() => parseCondition('hp == 1')).toThrow()
    expect(() => parseCondition('alert(1)')).toThrow()
    expect(() => parseCondition('hp <= sanity')).toThrow()
  })
})

describe('evalCondition', () => {
  const attrs = { hp: 0, sanity: 95 }
  it('cmp 求值', () => {
    expect(evalCondition(parseCondition('hp<=0'), attrs, 5, 30)).toBe(true)
    expect(evalCondition(parseCondition('sanity>=90'), attrs, 5, 30)).toBe(true)
    expect(evalCondition(parseCondition('sanity<=10'), attrs, 5, 30)).toBe(false)
  })
  it('未知属性恒为 false', () => {
    expect(evalCondition(parseCondition('gold<=0'), attrs, 5, 30)).toBe(false)
  })
  it('maxTurns 在回合数达到上限时为 true', () => {
    expect(evalCondition(parseCondition('maxTurns'), attrs, 30, 30)).toBe(true)
    expect(evalCondition(parseCondition('maxTurns'), attrs, 29, 30)).toBe(false)
  })
})

describe('复合条件（与）', () => {
  it('解析 & 连接的多子句', () => {
    expect(parseCondition('maxTurns & favor>=70 & power>=70')).toEqual({
      kind: 'and',
      parts: [
        { kind: 'maxTurns' },
        { kind: 'cmp', attr: 'favor', op: '>=', value: 70 },
        { kind: 'cmp', attr: 'power', op: '>=', value: 70 },
      ],
    })
  })
  it('全部子句满足才为 true', () => {
    const c = parseCondition('maxTurns & favor>=70 & power<=30')
    expect(evalCondition(c, { favor: 80, power: 20 }, 24, 24)).toBe(true)
    expect(evalCondition(c, { favor: 80, power: 50 }, 24, 24)).toBe(false) // power 不满足
    expect(evalCondition(c, { favor: 80, power: 20 }, 23, 24)).toBe(false) // 未到 maxTurns
  })
  it('任一子句语法非法则整体抛错', () => {
    expect(() => parseCondition('favor>=70 & hp == 1')).toThrow()
  })
  it('conditionAttrs 提取所有引用属性', () => {
    expect(conditionAttrs(parseCondition('maxTurns & favor>=70 & power<=30')).sort()).toEqual(
      ['favor', 'power'],
    )
    expect(conditionAttrs(parseCondition('hp<=0'))).toEqual(['hp'])
    expect(conditionAttrs(parseCondition('maxTurns'))).toEqual([])
  })
})

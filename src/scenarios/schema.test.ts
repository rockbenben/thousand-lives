import { describe, it, expect } from 'vitest'
import { scenarioSchema, importScenarioSchema } from './schema'

const valid = {
  id: 'test',
  title: '测试剧本',
  emoji: '🎲',
  intro: '这是开局描述',
  attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 }],
  maxTurns: 10,
  systemPrompt: '你是游戏主持人',
  endings: [{ condition: 'maxTurns', tone: '幸存' }],
}

describe('scenarioSchema', () => {
  it('接受合法剧本并填充 turnUnit 默认值', () => {
    const sc = scenarioSchema.parse(valid)
    expect(sc.turnUnit).toBe('回合')
    expect(sc.attributes[0].deathBelow).toBe(0)
  })

  it('拒绝空属性列表', () => {
    expect(() => scenarioSchema.parse({ ...valid, attributes: [] })).toThrow()
  })

  it('拒绝非 ASCII 标识符的属性 key', () => {
    expect(() =>
      scenarioSchema.parse({ ...valid, attributes: [{ key: '生命', name: '生命', initial: 1, max: 10 }] }),
    ).toThrow()
  })

  it('拒绝 initial 越界（>max 或 <0）', () => {
    expect(() =>
      scenarioSchema.parse({ ...valid, attributes: [{ key: 'hp', name: '生命', initial: 150, max: 100 }] }),
    ).toThrow()
    expect(() =>
      scenarioSchema.parse({ ...valid, attributes: [{ key: 'hp', name: '生命', initial: -1, max: 100 }] }),
    ).toThrow()
  })

  it('拒绝 deathBelow >= initial（开局即死）', () => {
    expect(() =>
      scenarioSchema.parse({ ...valid, attributes: [{ key: 'hp', name: '生命', initial: 10, max: 100, deathBelow: 10 }] }),
    ).toThrow()
  })

  it('拒绝空 endings', () => {
    expect(() => scenarioSchema.parse({ ...valid, endings: [] })).toThrow()
  })

  it('拒绝重复的属性 key', () => {
    expect(() =>
      scenarioSchema.parse({
        ...valid,
        attributes: [
          { key: 'hp', name: '生命', initial: 80, max: 100 },
          { key: 'hp', name: '体力', initial: 50, max: 100 },
        ],
      }),
    ).toThrow('重复')
  })

  it('导入时拒绝引用未定义属性的结局条件', () => {
    expect(() =>
      importScenarioSchema.parse({ ...valid, endings: [{ condition: 'mana<=0', tone: '枯竭' }] }),
    ).toThrow('未定义的属性')
  })

  it('加载时容忍未定义属性的结局条件（旧数据兼容，运行期 evalCondition 返回 false）', () => {
    expect(() =>
      scenarioSchema.parse({ ...valid, endings: [{ condition: 'mana<=0', tone: '枯竭' }] }),
    ).not.toThrow()
  })

  it('拒绝语法非法的结局条件', () => {
    expect(() =>
      scenarioSchema.parse({ ...valid, endings: [{ condition: 'hp == 0', tone: '死亡' }] }),
    ).toThrow('无法解析')
  })

  it('接受合法 bands 并填充 severity 默认值', () => {
    const sc = scenarioSchema.parse({
      ...valid,
      attributes: [
        {
          key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0,
          bands: [
            { upTo: 20, label: '濒死', severity: 'critical' },
            { upTo: 100, label: '健康' },
          ],
        },
      ],
    })
    expect(sc.attributes[0].bands?.[1].severity).toBe('normal')
  })

  it('拒绝 upTo 非升序的 bands', () => {
    expect(() =>
      scenarioSchema.parse({
        ...valid,
        attributes: [
          {
            key: 'hp', name: '生命', initial: 80, max: 100,
            bands: [
              { upTo: 50, label: 'a' },
              { upTo: 20, label: 'b' },
            ],
          },
        ],
      }),
    ).toThrow('升序')
  })

  it('openings 可选', () => {
    const sc = scenarioSchema.parse({ ...valid, openings: [{ name: '学生', prompt: '一名学生' }] })
    expect(sc.openings?.[0].name).toBe('学生')
  })
})

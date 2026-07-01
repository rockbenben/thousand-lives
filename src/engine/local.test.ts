import { describe, it, expect } from 'vitest'
import { hasLocalMode, pickLocalEvent, localTurn, localEnding } from './local'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState } from './state'

const sc: Scenario = scenarioSchema.parse({
  id: 'lt', title: '测试', intro: '开局',
  attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 }],
  maxTurns: 10, systemPrompt: 'GM',
  endings: [{ condition: 'maxTurns', tone: '终' }],
  localEvents: [
    { narrative: '事件A', choices: [{ text: 'a1', effects: { hp: -5 } }, { text: 'a2', effects: {} }], summary: 'A', minTurn: 1, maxTurn: 1, once: true },
    { narrative: '事件B', choices: [{ text: 'b1', effects: {} }, { text: 'b2', effects: {} }], summary: 'B' },
    { narrative: '事件C', choices: [{ text: 'c1', effects: {} }, { text: 'c2', effects: {} }], summary: 'C', itemsGained: ['宝物'] },
  ],
})

const stateWithSummaries = (summaries: string[]) => ({
  ...initState(sc),
  history: summaries.map((s) => ({ narrative: 'x', choiceText: 'x', summary: s })),
})

describe('local engine', () => {
  it('hasLocalMode 判断事件池非空', () => {
    expect(hasLocalMode(sc)).toBe(true)
    expect(hasLocalMode({ ...sc, localEvents: [] })).toBe(false)
    expect(hasLocalMode({ ...sc, localEvents: undefined })).toBe(false)
  })

  it('回合区间限制：第1回合可出 A，第2回合不出 A', () => {
    // rng=0 → 取池中第一个
    expect(pickLocalEvent(sc, stateWithSummaries([]), () => 0)?.summary).toBe('A')
    // 第2回合（已有1条历史），A 的 maxTurn=1 不再可用，且 A 已用过
    const e2 = pickLocalEvent(sc, stateWithSummaries(['A']), () => 0)
    expect(e2?.summary).not.toBe('A')
  })

  it('不重复已出现过的事件（除非池耗尽）', () => {
    // 已出 B，rng=0 应取剩余 fresh 中第一个（A 受 maxTurn 限制不在第3回合，故为 C）
    const e = pickLocalEvent(sc, stateWithSummaries(['x', 'B']), () => 0)
    expect(e?.summary).toBe('C')
  })

  it('池全部出现过时放宽重复，仍返回事件而非 null', () => {
    const e = pickLocalEvent(sc, stateWithSummaries(['A', 'B', 'C']), () => 0)
    expect(e).not.toBeNull()
  })

  it('requires 门控：状态不满足则不抽到（除非池耗尽兜底）', () => {
    const gated: Scenario = scenarioSchema.parse({
      ...sc, id: 'g2',
      localEvents: [
        { narrative: '常规', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'N' },
        { narrative: '危急专属', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'CRIT', requires: 'hp<=20' },
      ],
    })
    // hp=80 → CRIT 不满足，只可能出 N
    expect(pickLocalEvent(gated, { ...initState(gated), attributes: { hp: 80 } }, () => 0)?.summary).toBe('N')
    // hp=10 → CRIT 满足；N 已出过则抽到 CRIT
    expect(
      pickLocalEvent(gated, { ...initState(gated), attributes: { hp: 10 }, history: [{ narrative: 'x', choiceText: 'x', summary: 'N' }] }, () => 0)?.summary,
    ).toBe('CRIT')
  })

  it('requiresItem 门控：未持有则不抽到', () => {
    const gated: Scenario = scenarioSchema.parse({
      ...sc, id: 'g3',
      localEvents: [
        { narrative: '常规', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'N' },
        { narrative: '用钥匙', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'KEY', requiresItem: '钥匙' },
      ],
    })
    expect(pickLocalEvent(gated, { ...initState(gated) }, () => 0)?.summary).toBe('N')
    expect(
      pickLocalEvent(gated, { ...initState(gated), inventory: ['钥匙'], history: [{ narrative: 'x', choiceText: 'x', summary: 'N' }] }, () => 0)?.summary,
    ).toBe('KEY')
  })

  it('门控语法非法不崩，跳过该事件', () => {
    const bad: Scenario = scenarioSchema.parse({
      ...sc, id: 'g4',
      localEvents: [
        { narrative: '常规', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'N' },
        { narrative: '坏门控', choices: [{ text: 'x', effects: {} }, { text: 'y', effects: {} }], summary: 'BAD', requires: 'hp == 0' },
      ],
    })
    expect(() => pickLocalEvent(bad, initState(bad), () => 0)).not.toThrow()
    expect(pickLocalEvent(bad, initState(bad), () => 0)?.summary).toBe('N')
  })

  it('localTurn 产出合法 TurnResult，含 recommend 与物品', () => {
    const t = localTurn(sc, stateWithSummaries(['x', 'A', 'B']), () => 0) // → C
    expect(t.summary).toBe('C')
    expect(t.choices.length).toBeGreaterThanOrEqual(2)
    expect(t.itemsGained).toEqual(['宝物'])
    expect(typeof t.recommend).toBe('number')
    expect(t.recommend! >= 0 && t.recommend! < t.choices.length).toBe(true)
  })

  it('localEnding 含结局基调与回合数', () => {
    const st = { ...stateWithSummaries(['A', 'B']), ended: { tone: '终', reason: 'maxTurns' } }
    const txt = localEnding(sc, st)
    expect(txt).toContain('终')
    expect(txt).toContain('2')
  })
})

describe('localTurn 透传新字段', () => {
  const sc = scenarioSchema.parse({
    id: 'p', title: 'P', intro: '开局',
    attributes: [{ key: 'hp', name: '生命', initial: 50, max: 100, deathBelow: 0 }],
    maxTurns: 30, systemPrompt: 'GM', endings: [{ condition: 'maxTurns', tone: '终' }],
    localEvents: [{
      narrative: '机缘', summary: '奇遇',
      choices: [
        { text: '赌', effects: {}, outcomes: [{ weight: 1, effects: { hp: 5 }, flagsSet: ['吉'] }] },
        { text: '走凶地', effects: {}, endTone: '暴毙' },
      ],
    }],
  })
  it('TurnResult 的 choices 携带 outcomes 与 endTone', () => {
    const st = initState(sc, undefined, undefined, 'local')
    const tr = localTurn(sc, st, () => 0)
    expect(tr.choices[0].outcomes?.[0].flagsSet).toEqual(['吉'])
    expect(tr.choices[1].endTone).toBe('暴毙')
  })
})

describe('pickLocalEvent 印记门控', () => {
  const sc = scenarioSchema.parse({
    id: 'g', title: 'G', intro: '开局',
    attributes: [{ key: 'hp', name: '生命', initial: 50, max: 100, deathBelow: 0 }],
    maxTurns: 30, systemPrompt: 'GM', endings: [{ condition: 'maxTurns', tone: '终' }],
    localEvents: [
      { narrative: '需印记', summary: '魔事', requires: 'has(魔道)',
        choices: [{ text: 'a', effects: {} }, { text: 'b', effects: {} }] },
      { narrative: '通用', summary: '常事',
        choices: [{ text: 'a', effects: {} }, { text: 'b', effects: {} }] },
    ],
  })
  it('无印记时拿不到 has(魔道) 门控的事件', () => {
    const st = initState(sc, undefined, undefined, 'local')
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(pickLocalEvent(sc, st, () => Math.random())!.summary)
    expect(seen.has('魔事')).toBe(false)
  })
  it('持有印记后可拿到', () => {
    const st = { ...initState(sc, undefined, undefined, 'local'), flags: ['魔道'] }
    let got = false
    for (let i = 0; i < 50 && !got; i++) if (pickLocalEvent(sc, st, () => Math.random())!.summary === '魔事') got = true
    expect(got).toBe(true)
  })
})

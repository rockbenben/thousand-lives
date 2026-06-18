import { describe, it, expect } from 'vitest'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState, clampEffects, checkEnding, applyChoice, resolveCustomAction, applyMemory, nextProgress, rollFortune } from './state'
import type { TurnResult } from './types'

const sc: Scenario = scenarioSchema.parse({
  id: 'test',
  title: '测试',
  emoji: '🎲',
  intro: '开局',
  attributes: [
    { key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 },
    { key: 'gold', name: '金币', initial: 50, max: 100 },
  ],
  maxTurns: 3,
  systemPrompt: 'GM',
  endings: [
    { condition: 'gold>=100', tone: '暴富' },
    { condition: 'maxTurns', tone: '平凡' },
  ],
})

const turn = (effects: Record<string, number>): TurnResult => ({
  narrative: '剧情',
  choices: [{ text: '行动', effects }],
  summary: '摘要',
})

describe('rollFortune（命运无常）', () => {
  it('不传 rng 时 applyChoice 确定性应用原始 effects、无 twist', () => {
    const st = applyChoice(sc, initState(sc), turn({ gold: 10 }), 0)
    expect(st.attributes.gold).toBe(60)
    expect(st.history[0].twist).toBeUndefined()
  })
  it('rng 高于阈值时不触发转折（沿用原 effects）', () => {
    const { effects, twist } = rollFortune({ gold: 10 }, () => 0.9)
    expect(effects.gold).toBe(10)
    expect(twist).toBeUndefined()
  })
  it('触发正向转折时收益被放大并带提示', () => {
    // rng 序列:① <0.18 触发 ② <0.5 判 good ③ 文案池选 index 0
    const seq = [0.05, 0.1, 0]
    let i = 0
    const { effects, twist } = rollFortune({ gold: 10 }, () => seq[i++])
    expect(effects.gold).toBeGreaterThan(10)
    expect(twist).toContain('命运无常')
  })
  it('空 effects 不会触发转折', () => {
    const { twist } = rollFortune({}, () => 0)
    expect(twist).toBeUndefined()
  })
})

describe('decayPerTurn（每回合自动衰减）', () => {
  const decaySc: Scenario = scenarioSchema.parse({
    id: 'decay',
    title: '衰减',
    emoji: '⌛',
    intro: '开局',
    attributes: [
      { key: 'life', name: '寿元', initial: 60, max: 100, deathBelow: 0, decayPerTurn: 2 },
      { key: 'power', name: '修为', initial: 10, max: 100 },
    ],
    maxTurns: 50,
    systemPrompt: 'GM',
    endings: [{ condition: 'maxTurns', tone: '落幕' }],
  })
  const t = (effects: Record<string, number>): TurnResult => ({
    narrative: '剧情', choices: [{ text: '行动', effects }], summary: '摘要',
  })

  it('每回合在 effect 之外自动扣减衰减量', () => {
    // 寿元 60，本回合 effect 不动寿元 → 仅衰减 -2 → 58；修为无衰减照常 +5
    const st = applyChoice(decaySc, initState(decaySc, undefined, undefined, 'local'), t({ power: 5 }), 0)
    expect(st.attributes.life).toBe(58)
    expect(st.attributes.power).toBe(15)
  })

  it('衰减与本回合 effect 叠加结算', () => {
    // 寿元 effect +6，叠加衰减 -2 → 净 +4 → 64
    const st = applyChoice(decaySc, initState(decaySc, undefined, undefined, 'local'), t({ life: 6 }), 0)
    expect(st.attributes.life).toBe(64)
  })

  it('衰减不受命运无常缩放（仅 effect 被缩放）', () => {
    // rng 触发正向转折放大 effect，但衰减恒为 -2：power +10 被放大、life 仍只 -2
    const seq = [0.05, 0.1, 0]
    let i = 0
    const st = applyChoice(decaySc, initState(decaySc, undefined, undefined, 'local'), t({ power: 10 }), 0, () => seq[i++])
    expect(st.attributes.power).toBeGreaterThan(20)
    expect(st.attributes.life).toBe(58)
  })

  it('持续衰减可触发死亡结局', () => {
    let st = initState(decaySc, undefined, undefined, 'local')
    // 不补寿元，纯衰减：60 / 2 = 30 回合后归零
    for (let i = 0; i < 30 && !st.ended; i++) st = applyChoice(decaySc, st, t({ power: 1 }), 0)
    expect(st.attributes.life).toBe(0)
    expect(st.ended?.tone).toBe('死亡')
  })

  it('resolveCustomAction 同样施加衰减', () => {
    const st = resolveCustomAction(
      decaySc,
      initState(decaySc, undefined, undefined, 'local'),
      { narrative: '场景', summary: '摘要' },
      '自定义行动',
      { narrative: '', choices: [], summary: '', actionEffects: { power: 3 } },
    )
    expect(st.attributes.life).toBe(58)
    expect(st.attributes.power).toBe(13)
  })

  it('不设 decayPerTurn 的属性不衰减（向后兼容）', () => {
    const st = applyChoice(sc, initState(sc), turn({ gold: 10 }), 0)
    expect(st.attributes.hp).toBe(80) // 无 decayPerTurn，hp 不变
  })
})

describe('initState', () => {
  it('按 initial 初始化属性并记录开局身份', () => {
    const st = initState(sc, { name: '商人', prompt: '精明的商人' })
    expect(st.attributes).toEqual({ hp: 80, gold: 50 })
    expect(st.history).toEqual([])
    expect(st.opening).toBe('商人——精明的商人')
    expect(initState(sc).opening).toBeUndefined()
  })
  it('按 opening.flag 写入身份印记，无 flag 则为空', () => {
    const withFlag = scenarioSchema.parse({
      id: 'f', title: 'F', emoji: '🚩', intro: '开局',
      attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 }],
      openings: [{ name: '魔道', prompt: '魔功传人', flag: '魔道' }],
      maxTurns: 5, systemPrompt: 'GM', endings: [{ condition: 'maxTurns', tone: '终' }],
    })
    expect(initState(withFlag, withFlag.openings![0]).flags).toEqual(['魔道'])
    expect(initState(withFlag).flags).toEqual([])
  })
})

describe('applyMemory', () => {
  it('追加去重、去空白、缺省安全', () => {
    expect(applyMemory(undefined, undefined)).toEqual([])
    expect(applyMemory(['结识老张'], ['结识老张', ' 立誓复仇 ', ''])).toEqual(['结识老张', '立誓复仇'])
  })
  it('超过上限保留最新', () => {
    const old = Array.from({ length: 16 }, (_, i) => `事${i}`)
    const next = applyMemory(old, ['新一', '新二'])
    expect(next.length).toBe(16)
    expect(next.slice(-2)).toEqual(['新一', '新二'])
    expect(next).not.toContain('事0')
  })
  it('initState 初始化空记忆栏', () => {
    expect(initState(sc).memory).toEqual([])
  })
  it('applyChoice 合并 memoryAdd 到状态', () => {
    const st = initState(sc)
    const res: TurnResult = { ...turn({ gold: 5 }), memoryAdd: ['遇见神秘商人'] }
    expect(applyChoice(sc, st, res, 0).memory).toEqual(['遇见神秘商人'])
  })
})

describe('nextProgress', () => {
  it('有效值 clamp 0~100 并取整，否则沿用旧值', () => {
    expect(nextProgress(undefined, undefined)).toBeUndefined()
    expect(nextProgress(30, undefined)).toBe(30) // 本回合没给则保留
    expect(nextProgress(30, 55.6)).toBe(56)
    expect(nextProgress(30, 140)).toBe(100)
    expect(nextProgress(30, -5)).toBe(0)
    expect(nextProgress(30, NaN)).toBe(30)
  })
  it('applyChoice 写入 goalProgress', () => {
    const res: TurnResult = { ...turn({ gold: 5 }), goalProgress: 42 }
    expect(applyChoice(sc, initState(sc), res, 0).goalProgress).toBe(42)
  })
})

describe('clampEffects', () => {
  it('夹取到 [0, max]，未知 key 静默丢弃', () => {
    expect(clampEffects(sc, { hp: 80, gold: 50 }, { hp: 999, gold: -999, mana: 10 }))
      .toEqual({ hp: 100, gold: 0 })
  })
  it('非有限数值忽略', () => {
    expect(clampEffects(sc, { hp: 80, gold: 50 }, { hp: NaN })).toEqual({ hp: 80, gold: 50 })
  })
})

describe('checkEnding', () => {
  it('deathBelow 优先：hp<=0 即死亡', () => {
    expect(checkEnding(sc, { hp: 0, gold: 100 }, 1)).toEqual({ tone: '死亡', reason: '生命耗尽' })
  })
  it('同属性的自定义 <= 结局 tone 优先于通用死亡', () => {
    const withCustomDeath: Scenario = scenarioSchema.parse({
      id: 'island',
      title: '荒岛',
      emoji: '🏝️',
      intro: 'x',
      attributes: [{ key: 'hp', name: '体力', initial: 80, max: 100, deathBelow: 0 }],
      maxTurns: 20,
      systemPrompt: 'x',
      endings: [
        { condition: 'maxTurns', tone: '获救' },
        { condition: 'hp<=0', tone: '力竭死亡' },
      ],
    })
    expect(checkEnding(withCustomDeath, { hp: 0 }, 5)).toEqual({ tone: '力竭死亡', reason: 'hp<=0' })
    // 最后一回合死亡：死亡仍优先于 maxTurns 获救
    expect(checkEnding(withCustomDeath, { hp: 0 }, 20)).toEqual({ tone: '力竭死亡', reason: 'hp<=0' })
  })
  it('非死亡阈值的 <= 结局不能顶替死亡', () => {
    const withInjury: Scenario = scenarioSchema.parse({
      id: 'inj',
      title: '荒岛',
      emoji: '🏝️',
      intro: 'x',
      attributes: [{ key: 'hp', name: '体力', initial: 80, max: 100, deathBelow: 0 }],
      maxTurns: 20,
      systemPrompt: 'x',
      endings: [
        { condition: 'hp<=40', tone: '重伤隐退' },
        { condition: 'hp<=0', tone: '力竭死亡' },
      ],
    })
    // 单回合从 45 直落到 0：hp<=40 虽然为真但非死亡级结局，必须命中 hp<=0
    expect(checkEnding(withInjury, { hp: 0 }, 5)).toEqual({ tone: '力竭死亡', reason: 'hp<=0' })
    // 只有非死亡级结局时回退到通用死亡
    const onlyInjury: Scenario = scenarioSchema.parse({
      ...withInjury,
      id: 'inj2',
      endings: [{ condition: 'hp<=40', tone: '重伤隐退' }],
    })
    expect(checkEnding(onlyInjury, { hp: 0 }, 5)).toEqual({ tone: '死亡', reason: '体力耗尽' })
  })
  it('多属性同时致死：任一致死属性的自定义死亡结局可命中', () => {
    const multi: Scenario = scenarioSchema.parse({
      id: 'multi',
      title: 'x',
      emoji: '🎲',
      intro: 'x',
      attributes: [
        { key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 },
        { key: 'sanity', name: '理智', initial: 80, max: 100, deathBelow: 0 },
      ],
      maxTurns: 20,
      systemPrompt: 'x',
      endings: [{ condition: 'sanity<=0', tone: '疯狂' }],
    })
    // 作者只为 sanity 写了死亡结局；hp 在属性列表中靠前也不能遮蔽它
    expect(checkEnding(multi, { hp: 0, sanity: 0 }, 5)).toEqual({ tone: '疯狂', reason: 'sanity<=0' })
    // 只有 hp 致死时仍是通用死亡
    expect(checkEnding(multi, { hp: 0, sanity: 50 }, 5)).toEqual({ tone: '死亡', reason: '生命耗尽' })
  })
  it('endings 按顺序命中', () => {
    expect(checkEnding(sc, { hp: 50, gold: 100 }, 1)).toEqual({ tone: '暴富', reason: 'gold>=100' })
  })
  it('maxTurns 满期触发', () => {
    expect(checkEnding(sc, { hp: 50, gold: 50 }, 3)).toEqual({ tone: '平凡', reason: 'maxTurns' })
    expect(checkEnding(sc, { hp: 50, gold: 50 }, 2)).toBeNull()
  })
  it('endings 全部未命中时，到期兜底收束而非无限继续', () => {
    const noEnd: Scenario = scenarioSchema.parse({
      id: 'noend',
      title: '无终局',
      emoji: '🎲',
      intro: '开局',
      attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100 }],
      maxTurns: 3,
      systemPrompt: 'GM',
      endings: [{ condition: 'hp>=999', tone: '不可能' }],
    })
    expect(checkEnding(noEnd, { hp: 80 }, 2)).toBeNull()
    expect(checkEnding(noEnd, { hp: 80 }, 3)).toEqual({ tone: '落幕', reason: 'maxTurns' })
  })
})

describe('applyChoice', () => {
  it('结算属性、追加历史、推进回合', () => {
    const st = initState(sc)
    const next = applyChoice(sc, st, turn({ hp: -10, gold: 20 }), 0)
    expect(next.attributes).toEqual({ hp: 70, gold: 70 })
    expect(next.history).toHaveLength(1)
    expect(next.history[0]).toEqual({ narrative: '剧情', choiceText: '行动', summary: '摘要' })
    expect(next.ended).toBeUndefined()
    expect(st.history).toHaveLength(0) // 不可变
  })
  it('致死选择产生 ended', () => {
    const st = initState(sc)
    const next = applyChoice(sc, st, turn({ hp: -100 }), 0)
    expect(next.ended).toEqual({ tone: '死亡', reason: '生命耗尽' })
  })
  it('非法选项下标抛错', () => {
    expect(() => applyChoice(sc, initState(sc), turn({}), 5)).toThrow()
  })
  it('结算物品：获得追加、失去移除、去重、trim', () => {
    const st = { ...initState(sc), inventory: ['火把', '干粮'] }
    const res: TurnResult = {
      ...turn({}),
      itemsGained: ['绳索', ' 匕首 ', '火把'], // 火把已持有不重复
      itemsLost: ['干粮'],
    }
    const next = applyChoice(sc, st, res, 0)
    expect(next.inventory).toEqual(['火把', '绳索', '匕首'])
  })
  it('initState 含空行囊', () => {
    expect(initState(sc).inventory).toEqual([])
  })
})

describe('resolveCustomAction', () => {
  const scene = { narrative: '你站在岔路口。', summary: '抉择' }
  it('应用 actionEffects、把场景+行动记入历史', () => {
    const st = initState(sc)
    const resolved: TurnResult = {
      narrative: '你贿赂成功，守卫放行。',
      choices: [{ text: 'a', effects: {} }, { text: 'b', effects: {} }],
      summary: '混入城中',
      actionEffects: { gold: -20, hp: 5 },
    }
    const next = resolveCustomAction(sc, st, scene, '贿赂守卫', resolved)
    expect(next.attributes).toEqual({ hp: 85, gold: 30 })
    expect(next.history).toHaveLength(1)
    // 历史记录的是"行动发生的场景"+玩家行动文本
    expect(next.history[0]).toEqual({ narrative: '你站在岔路口。', choiceText: '贿赂守卫', summary: '抉择' })
  })
  it('actionEffects 缺省时属性不变', () => {
    const st = initState(sc)
    const resolved: TurnResult = { narrative: 'n', choices: [{ text: 'a' }, { text: 'b' }] as never, summary: 's' }
    const next = resolveCustomAction(sc, st, scene, '发呆', resolved)
    expect(next.attributes).toEqual({ hp: 80, gold: 50 })
  })
  it('自定义行动致死时产生 ended', () => {
    const st = initState(sc)
    const resolved: TurnResult = {
      narrative: 'n', choices: [{ text: 'a', effects: {} }, { text: 'b', effects: {} }], summary: 's',
      actionEffects: { hp: -100 },
    }
    const next = resolveCustomAction(sc, st, scene, '硬闯', resolved)
    expect(next.ended).toEqual({ tone: '死亡', reason: '生命耗尽' })
  })
})

describe('机缘封顶 ceiling/ceilingUnlocks', () => {
  const capSc: Scenario = scenarioSchema.parse({
    id: 'cap', title: 'C', emoji: '⛰️', intro: '开局',
    attributes: [{
      key: 'cultivation', name: '修为', initial: 10, max: 100,
      ceiling: 45, ceilingUnlocks: [{ flag: '金丹', max: 70 }],
    }],
    maxTurns: 5, systemPrompt: 'GM', endings: [{ condition: 'maxTurns', tone: '终' }],
  })
  it('无印记时截在 ceiling', () => {
    expect(clampEffects(capSc, { cultivation: 44 }, { cultivation: 10 }, []).cultivation).toBe(45)
  })
  it('持有解锁印记后截在更高上限', () => {
    expect(clampEffects(capSc, { cultivation: 44 }, { cultivation: 50 }, ['金丹']).cultivation).toBe(70)
  })
})

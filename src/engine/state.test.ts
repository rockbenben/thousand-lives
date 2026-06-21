import { describe, it, expect } from 'vitest'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState, clampEffects, checkEnding, applyChoice, resolveCustomAction, applyMemory, nextProgress, rollFortune, rollOutcome, applyFlags, reachableEndingTones } from './state'
import { builtinScenarios } from '../scenarios'
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

describe('reachableEndingTones（图鉴/成就口径：仅计可真正触达的基调）', () => {
  it('某致死属性无专属死亡级结局时，通用「死亡」会回退触发 → 计入', () => {
    // sc 的 hp 有死线但无 hp<=0 结局：归零时 checkEnding 回退到通用「死亡」
    expect(checkEnding(sc, { hp: 0, gold: 50 }, 1, [])?.tone).toBe('死亡')
    expect(reachableEndingTones(sc)).toContain('死亡')
  })
  it('每个致死属性都有专属死亡级结局时，通用「死亡」永不触发 → 不计入（否则集齐成就差一格、永不可达）', () => {
    const withDeath = scenarioSchema.parse({
      ...sc,
      endings: [...sc.endings, { condition: 'hp<=0', tone: '力竭而亡' }],
    })
    expect(checkEnding(withDeath, { hp: 0, gold: 50 }, 1, [])?.tone).toBe('力竭而亡')
    expect(reachableEndingTones(withDeath)).not.toContain('死亡')
  })
  it('回归护栏：内置剧本仅在确有致死属性缺专属死局时才计入「死亡」（杜绝幽灵槽）', () => {
    const hasSimpleDeathEnding = (s: Scenario, key: string, deathBelow: number) =>
      s.endings.some((e) => {
        const m = (e.condition || '').trim().match(/^([a-zA-Z]+)<=(-?\d+)$/)
        return !!m && m[1] === key && Number(m[2]) <= deathBelow
      })
    for (const s of builtinScenarios) {
      const fallbackReachable = s.attributes.some(
        (a) => a.deathBelow !== undefined && !hasSimpleDeathEnding(s, a.key, a.deathBelow),
      )
      // 计入「死亡」当且仅当通用死亡确可回退触发
      expect(reachableEndingTones(s).includes('死亡'), s.id).toBe(fallbackReachable)
    }
  })
})

describe('checkEnding 择优（满足的结局取最具体者，与数组顺序无关）', () => {
  // 更具体的结局排在「更宽」的后面：旧的「数组顺序首中」会取宽的（遮蔽），新引擎应取具体的
  const byClause = scenarioSchema.parse({
    ...sc,
    endings: [
      { condition: 'maxTurns & gold>=50', tone: '宽' },
      { condition: 'maxTurns & gold>=50 & hp>=80', tone: '具体' },
    ],
  })
  it('同时满足时取「更具体」(子句更多者)，尽管它排在后面', () => {
    expect(checkEnding(byClause, { hp: 90, gold: 60 }, 3, [])?.tone).toBe('具体')
  })
  it('只满足宽条件时仍取宽的', () => {
    expect(checkEnding(byClause, { hp: 70, gold: 60 }, 3, [])?.tone).toBe('宽')
  })
  // 同子句数、但阈值更严（蕴含）：严的排在后面也应胜（clause-count 解决不了，靠蕴含判定）
  const byThreshold = scenarioSchema.parse({
    ...sc,
    endings: [
      { condition: 'gold>=50', tone: '小富' },
      { condition: 'gold>=90', tone: '巨富' },
    ],
  })
  it('阈值更严的结局(蕴含更宽者)胜出，尽管它排在后面', () => {
    expect(checkEnding(byThreshold, { hp: 80, gold: 95 }, 1, [])?.tone).toBe('巨富')
    expect(checkEnding(byThreshold, { hp: 80, gold: 60 }, 1, [])?.tone).toBe('小富')
  })
  // 同等具体的多种死法（同条件 hp<=0）：传 rng 随机取一，使数值相同也死得不同；带语境者(has)靠 salience 胜出
  const deathPool = scenarioSchema.parse({
    ...sc,
    endings: [
      { condition: 'hp<=0 & has(据点)', tone: '殉地' },
      { condition: 'hp<=0', tone: '甲' },
      { condition: 'hp<=0', tone: '乙' },
      { condition: 'hp<=0', tone: '丙' },
      { condition: 'maxTurns', tone: '兜底' },
    ],
  })
  it('多个同条件死法：传 rng 能随机覆盖到不止一种', () => {
    const seen = new Set<string>()
    for (const v of [0.0, 0.34, 0.5, 0.67, 0.99]) seen.add(checkEnding(deathPool, { hp: 0 }, 1, [], () => v)!.tone)
    expect(seen.size).toBeGreaterThan(1)
    expect([...seen].every((t) => ['甲', '乙', '丙'].includes(t))).toBe(true)
  })
  it('不传 rng 时取首个，确定可复现', () => {
    expect(checkEnding(deathPool, { hp: 0 }, 1, [])?.tone).toBe('甲')
  })
  it('带语境死法 has(据点) 靠 salience 胜过裸 hp<=0 池', () => {
    expect(checkEnding(deathPool, { hp: 0 }, 1, ['据点'], () => 0.99)?.tone).toBe('殉地')
  })
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

describe('rollOutcome 加权分支', () => {
  const choice = {
    text: '帮老人', effects: {}, outcomes: [
      { weight: 1, effects: { hp: -5 }, flagsSet: ['结怨'] },
      { weight: 3, effects: { hp: 5 } },
    ],
  }
  it('无 outcomes 返回 null', () => {
    expect(rollOutcome({ text: 'x', effects: {} }, () => 0)).toBeNull()
  })
  it('rng 落在首段权重内取第一项', () => {
    // total=4，rng()*4=0 → 命中 weight1 的第一项
    expect(rollOutcome(choice, () => 0)?.flagsSet).toEqual(['结怨'])
  })
  it('rng 落在后段取第二项', () => {
    // rng()=0.9 → 0.9*4=3.6 > 1 → 第二项
    expect(rollOutcome(choice, () => 0.9)?.effects).toEqual({ hp: 5 })
  })
})

describe('applyFlags 印记增减', () => {
  it('并入新印记（去重去空）、移除指定印记', () => {
    expect(applyFlags(['吉', '凶'], ['吉', '福'], ['凶'])).toEqual(['吉', '福'])
    expect(applyFlags([], ['  '], [])).toEqual([])
  })
})

describe('同回合突破封顶用选择后印记', () => {
  const sc2 = scenarioSchema.parse({
    id: 'brk', title: 'B', emoji: '⛰️', intro: 'x',
    attributes: [{ key: 'p', name: '修为', initial: 10, max: 100, ceiling: 20, ceilingUnlocks: [{ flag: '甲', max: 60 }] }],
    maxTurns: 5, systemPrompt: 'g', endings: [{ condition: 'maxTurns', tone: '终' }],
  })
  it('同回合授印记后修为可达新上限', () => {
    const st = { ...initState(sc2, undefined, undefined, 'local'), attributes: { p: 19 } }
    const tr: TurnResult = { narrative: 'n', summary: 's', choices: [{ text: '破', effects: {}, outcomes: [{ weight: 1, effects: { p: 50 }, flagsSet: ['甲'] }] }] }
    const next = applyChoice(sc2, st, tr, 0, () => 0)
    expect(next.flags).toContain('甲')
    expect(next.attributes.p).toBe(60) // 旧实现会卡在 20
  })
})

describe('applyChoice 整合 outcomes/flags', () => {
  const sc2: Scenario = scenarioSchema.parse({
    id: 'i', title: 'I', emoji: '🎯', intro: '开局',
    attributes: [{ key: 'hp', name: '生命', initial: 50, max: 100, deathBelow: 0 }],
    maxTurns: 5, systemPrompt: 'GM', endings: [{ condition: 'maxTurns', tone: '终' }],
  })
  const turnOut = (): TurnResult => ({
    narrative: '剧情', summary: '摘要',
    choices: [{ text: '赌', effects: {}, outcomes: [
      { weight: 1, effects: { hp: 10 }, flagsSet: ['吉'] },
    ] }],
  })
  it('outcomes 分支应用 effects 与 flags，且跳过命运无常缩放', () => {
    const st = applyChoice(sc2, initState(sc2, undefined, undefined, 'local'), turnOut(), 0, () => 0)
    expect(st.attributes.hp).toBe(60)        // 10 原值，未被放大
    expect(st.flags).toEqual(['吉'])
  })
  it('flagsClear 移除印记', () => {
    let st = initState(sc2, undefined, undefined, 'local')
    st = { ...st, flags: ['吉', '凶'] }
    const tr: TurnResult = { narrative: 'n', summary: 's',
      choices: [{ text: 'c', effects: {}, flagsClear: ['凶'] }] }
    expect(applyChoice(sc2, st, tr, 0).flags).toEqual(['吉'])
  })
})

describe('forceEnding 强制结局（天堂地狱）', () => {
  const sc3: Scenario = scenarioSchema.parse({
    id: 'h', title: 'H', emoji: '🎲', intro: '开局',
    attributes: [{ key: 'hp', name: '生命', initial: 90, max: 100, deathBelow: 0 }],
    maxTurns: 30, systemPrompt: 'GM',
    endings: [{ condition: 'maxTurns', tone: '终' }, { condition: 'hp<=0', tone: '死' }],
  })
  it('endTone 无视数值直接定结局', () => {
    const tr: TurnResult = { narrative: 'n', summary: 's',
      choices: [{ text: '踩中凶煞', effects: {}, endTone: '当场暴毙' }] }
    const st = applyChoice(sc3, initState(sc3, undefined, undefined, 'local'), tr, 0)
    expect(st.ended).toEqual({ tone: '当场暴毙', reason: 'forced' })
    expect(st.attributes.hp).toBe(90) // 数值健康也照样结束
  })
  it('outcomes 分支也能携带 endTone', () => {
    const tr: TurnResult = { narrative: 'n', summary: 's',
      choices: [{ text: '探秘境', effects: {}, outcomes: [{ weight: 1, endTone: '得道飞升' }] }] }
    const st = applyChoice(sc3, initState(sc3, undefined, undefined, 'local'), tr, 0, () => 0)
    expect(st.ended?.tone).toBe('得道飞升')
  })
})

describe('maxTurns 可选 + 涌现终止', () => {
  const emergent: Scenario = scenarioSchema.parse({
    id: 'e', title: 'E', emoji: '♾️', intro: '开局',
    attributes: [{ key: 'life', name: '寿元', initial: 60, max: 100, deathBelow: 0 }],
    systemPrompt: 'GM', // 注意：无 maxTurns
    endings: [{ condition: 'life<=0', tone: '油尽' }],
  })
  it('无 maxTurns 时不在第 30 回合自动落幕', () => {
    expect(checkEnding(emergent, { life: 50 }, 30)).toBeNull()
  })
  it('无 maxTurns 时寿元归零仍正常死亡', () => {
    expect(checkEnding(emergent, { life: 0 }, 10)?.tone).toBe('油尽')
  })
  it('无 maxTurns 时到达硬兜底强制收束', () => {
    expect(checkEnding(emergent, { life: 50 }, 300)?.reason).toBe('hardcap')
  })
  it('结局条件能读 flags', () => {
    const sc = scenarioSchema.parse({
      id: 's', title: 'S', emoji: '🚩', intro: '开局',
      attributes: [{ key: 'hp', name: '生命', initial: 50, max: 100, deathBelow: 0 }],
      maxTurns: 30, systemPrompt: 'GM',
      endings: [{ condition: 'maxTurns & has(金丹)', tone: '功成' }, { condition: 'maxTurns', tone: '蹉跎' }],
    })
    expect(checkEnding(sc, { hp: 50 }, 30, ['金丹'])?.tone).toBe('功成')
    expect(checkEnding(sc, { hp: 50 }, 30, [])?.tone).toBe('蹉跎')
  })
})

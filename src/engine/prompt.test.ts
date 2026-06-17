import { describe, it, expect } from 'vitest'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState } from './state'
import { buildTurnMessages, buildEndingMessages } from './prompt'
import type { GameState, TurnRecord } from './types'

const sc: Scenario = scenarioSchema.parse({
  id: 'test', title: '测试', emoji: '🎲', intro: '末日开局',
  attributes: [
    { key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 },
    { key: 'gold', name: '金币', initial: 50, max: 100 },
  ],
  maxTurns: 5, systemPrompt: '你是末日GM',
  endings: [{ condition: 'maxTurns', tone: '幸存' }],
})

const rec = (i: number): TurnRecord => ({
  narrative: `第${i}回合剧情`, choiceText: `选择${i}`, summary: `摘要${i}`,
})

const withHistory = (n: number): GameState => ({
  ...initState(sc, { name: '商人', prompt: '精明' }),
  history: Array.from({ length: n }, (_, i) => rec(i + 1)),
})

describe('buildTurnMessages', () => {
  it('首回合：含 intro、身份、格式契约与属性 key', () => {
    const [sys, user] = buildTurnMessages(sc, withHistory(0))
    expect(sys.role).toBe('system')
    expect(sys.content).toContain('你是末日GM')
    expect(sys.content).toContain('hp, gold')
    expect(user.content).toContain('末日开局')
    expect(user.content).toContain('商人')
    expect(user.content).toContain('第 1 回合')
  })

  it('第 5 回合：最近 3 回合保留原文，第 1 回合进前情提要', () => {
    const [, user] = buildTurnMessages(sc, withHistory(4))
    expect(user.content).toContain('摘要1')
    expect(user.content).not.toContain('第1回合剧情')
    expect(user.content).toContain('第2回合剧情')
    expect(user.content).toContain('第4回合剧情')
    expect(user.content).toContain('选择4')
  })

  it('最后一回合带收束提示', () => {
    const [, user] = buildTurnMessages(sc, withHistory(4))
    expect(user.content).toContain('最后')
  })

  it('当前属性值与命名状态写入 user 消息', () => {
    const [, user] = buildTurnMessages(sc, withHistory(0))
    expect(user.content).toContain('生命 80')
    expect(user.content).toContain('【当前状态】')
  })

  it('落入带 directive 的低位状态时注入硬指令', () => {
    const banded: Scenario = scenarioSchema.parse({
      id: 'b', title: 't', emoji: '🎲', intro: 'i',
      attributes: [
        {
          key: 'sanity', name: '理智', initial: 80, max: 100, deathBelow: 0,
          bands: [
            { upTo: 20, label: '崩溃', severity: 'critical', directive: '必现幻觉。' },
            { upTo: 100, label: '清醒', severity: 'normal' },
          ],
        },
      ],
      maxTurns: 5, systemPrompt: 'GM',
      endings: [{ condition: 'maxTurns', tone: '幸存' }],
    })
    const st = { ...initState(banded), attributes: { sanity: 10 } }
    const [, user] = buildTurnMessages(banded, st)
    expect(user.content).toContain('【状态影响（必须遵守）】')
    expect(user.content).toContain('必现幻觉')
    expect(user.content).toContain('突发危机')
  })

  it('持有物品写入 user 消息，contract 含物品字段', () => {
    const st = { ...withHistory(1), inventory: ['手电筒', '退烧药'] }
    const [sys, user] = buildTurnMessages(sc, st)
    expect(user.content).toContain('【持有物品】手电筒、退烧药')
    expect(sys.content).toContain('itemsGained')
  })

  it('契约采用部分执行口径，不含硬门控（封锁选项）措辞', () => {
    const [sys] = buildTurnMessages(sc, withHistory(0))
    expect(sys.content).toContain('部分执行')
    expect(sys.content).not.toContain('选项要因此被限制')
  })

  it('关键抉择回合注入命运转折指令', () => {
    // sc.maxTurns=5 → 关键回合为 [1,3,4,5]（quartile round）
    const [, userKey] = buildTurnMessages(sc, withHistory(2)) // 第 3 回合
    expect(userKey.content).toContain('关键抉择')
    const [, userPlain] = buildTurnMessages(sc, withHistory(1)) // 第 2 回合
    expect(userPlain.content).not.toContain('关键抉择')
  })

  it('设定了目标时注入【玩家目标】到回合与结局', () => {
    const st = { ...withHistory(0), ambition: '扳倒太后登上后位' }
    const [, user] = buildTurnMessages(sc, st)
    expect(user.content).toContain('【玩家目标】')
    expect(user.content).toContain('扳倒太后登上后位')
    const [, endUser] = buildEndingMessages(sc, st, { tone: '善终', reason: 'maxTurns' })
    expect(endUser.content).toContain('扳倒太后登上后位')
  })

  it('未设目标时不注入目标行', () => {
    const [, user] = buildTurnMessages(sc, withHistory(0))
    expect(user.content).not.toContain('【玩家目标】')
  })

  it('自定义行动：注入行动文本并要求 actionEffects', () => {
    const [, user] = buildTurnMessages(sc, withHistory(1), '我去贿赂守卫')
    expect(user.content).toContain('玩家自行行动')
    expect(user.content).toContain('我去贿赂守卫')
    expect(user.content).toContain('actionEffects')
    expect(user.content).not.toContain('请生成第') // 走自定义分支，不是常规结尾
  })

  it('自定义行动：传入当前场景时注入【当前场景】，让 AI 看到行动所处情境', () => {
    // 玩家正反应的场景在 pendingTurn、尚未进 history，必须显式传入
    const scene = '你潜入敌营，帐内烛火摇曳，守卫正在打盹。'
    const [, user] = buildTurnMessages(sc, withHistory(1), '我去贿赂守卫', scene)
    expect(user.content).toContain('【当前场景】')
    expect(user.content).toContain(scene)
    // 未传场景时不应凭空出现该标记（向后兼容）
    const [, noScene] = buildTurnMessages(sc, withHistory(1), '我去贿赂守卫')
    expect(noScene.content).not.toContain('【当前场景】')
  })
})

describe('buildEndingMessages', () => {
  it('包含全程摘要、最终属性与结局基调，要求纯文本', () => {
    const st = { ...withHistory(3), ended: { tone: '死亡', reason: '生命耗尽' } }
    const [sys, user] = buildEndingMessages(sc, st, st.ended!)
    expect(sys.content).toContain('你是末日GM')
    expect(user.content).toContain('摘要1')
    expect(user.content).toContain('死亡')
    expect(user.content).toContain('不要输出 JSON')
  })
})

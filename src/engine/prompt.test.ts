import { describe, it, expect } from 'vitest'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { builtinScenarios } from '../scenarios'
import { wuxia } from '../scenarios/wuxia'
import { initState } from './state'
import { buildTurnMessages, buildEndingMessages, scenarioUsesFlags } from './prompt'
import type { GameState, TurnRecord } from './types'

const xian = builtinScenarios.find((s) => s.id === 'xian')!

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

describe('涌现剧本 prompt header', () => {
  it('xian（无 maxTurns）的提示不含 undefined', () => {
    const xian = builtinScenarios.find((s) => s.id === 'xian')!
    const msgs = buildTurnMessages(xian, initState(xian, xian.openings![0], undefined, 'ai'))
    const user = msgs.find((m) => m.role === 'user')!.content
    expect(user).not.toContain('undefined')
    expect(user).toContain(`第 1 ${xian.turnUnit}`)
  })
  it('有 maxTurns 的剧本仍标出总数', () => {
    const sg = builtinScenarios.find((s) => s.id === 'spy')! // spy 有 maxTurns
    const msgs = buildTurnMessages(sg, initState(sg, undefined, undefined, 'ai'))
    const user = msgs.find((m) => m.role === 'user')!.content
    expect(user).toContain(`共 ${sg.maxTurns}`)
  })
})

describe('印记/境界注入（门控）', () => {
  const xian = builtinScenarios.find((s) => s.id === 'xian')!
  const noFlag = builtinScenarios.find((s) => s.id === 'book')! // 穿书：尚未铺机缘，作无 flag 题材样本（wasteland 已铺据点印记）
  it('scenarioUsesFlags 仅对带 flag/ceilingUnlocks 的剧本为真', () => {
    expect(scenarioUsesFlags(xian)).toBe(true)
    expect(scenarioUsesFlags(noFlag)).toBe(false)
  })
  it('xian 提示含当前印记、晋阶之序（叙事化，不含数值封顶）、flagsSet/endTone 契约与词表', () => {
    const st = { ...initState(xian, xian.openings!.find((o) => o.flag === '魔道'), undefined, 'ai') }
    const msgs = buildTurnMessages(xian, st)
    const all = msgs.map((m) => m.content).join('\n')
    expect(all).toContain('当前印记')
    expect(all).toContain('魔道')
    // 改为叙事化「晋阶之序」，用本剧术语「境界」，不再暴露「封顶/上限 N」数值机制
    expect(all).toContain('晋阶之序')
    expect(all).toContain('境界') // xian tierLabel
    expect(all).toContain('筑基→金丹→元婴→化神') // 阶序
    expect(all).not.toContain('封顶')
    expect(all).not.toContain('上限')
    expect(all).toContain('flagsSet')
    expect(all).toContain('金丹') // 印记词表
    expect(all).toContain('endTone')
  })
  it('官阶题材（officialdom）晋阶之序用本剧术语「官阶」，不串味「境界」', () => {
    const officialdom = builtinScenarios.find((s) => s.id === 'officialdom')!
    const st = initState(officialdom, officialdom.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(officialdom, st).map((m) => m.content).join('\n')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('官阶') // officialdom tierLabel
    expect(all).toContain('知府→封疆→九卿→阁老')
    expect(all).not.toContain('境界')
    expect(all).not.toContain('封顶')
  })
  it('无 flag 题材（book）提示不含印记/境界/flagsSet 段', () => {
    const msgs = buildTurnMessages(noFlag, initState(noFlag, undefined, undefined, 'ai'))
    const all = msgs.map((m) => m.content).join('\n')
    expect(all).not.toContain('当前印记')
    expect(all).not.toContain('flagsSet')
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

describe('prompt 词表注入通用化（非 xian-硬编）', () => {
  it('wuxia 的哨兵隐藏结局基调被注入 endTone 契约（life<=-1 也识别）', () => {
    const st = initState(wuxia, wuxia.openings!.find((o) => o.flag)!, undefined, 'ai')
    const sys = buildTurnMessages(wuxia, st).find((m) => m.role === 'system')!.content
    // 奇缘证道 仅经 hiddenTones 词表注入（不在 systemPrompt 文本里），故能证明注入生效
    expect(sys).toContain('奇缘证道')
    expect(sys).toContain('暗伤迸发')
  })
  it('wuxia 契约境界顺序用本题材印记（入流→一流→绝顶→宗师，非炼气→筑基）', () => {
    const st = initState(wuxia, wuxia.openings!.find((o) => o.flag)!, undefined, 'ai')
    const sys = buildTurnMessages(wuxia, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('入流→一流→绝顶→宗师')
    expect(sys).not.toContain('炼气→筑基→金丹→元婴→化神')
  })
  it('xian 回归：飞升等哨兵基调仍注入，境界顺序为 xian 印记', () => {
    const st = initState(xian, xian.openings!.find((o) => o.flag)!, undefined, 'ai')
    const sys = buildTurnMessages(xian, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('渡劫飞升·得道成仙') // xian lifespan<=-1 哨兵基调仍在词表
    expect(sys).toContain('筑基→金丹→元婴→化神')
  })
})

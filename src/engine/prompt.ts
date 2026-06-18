import type { Scenario } from '../scenarios/schema'
import type { ChatMessage, GameState, Ending } from './types'
import { bandOf, type ResolvedBand } from './bands'
import { isKeyMoment } from './keymoment'

const RECENT_TURNS = 3

function formatContract(attrKeys: string[], useItems: boolean, hasGoal: boolean): string {
  const itemField = useItems
    ? '；可选 "itemsGained":["新获得的物品"] 与 "itemsLost":["失去/消耗的物品"]'
    : ''
  const goalField = hasGoal ? ',"goalProgress":0到100的整数' : ''
  return [
    '回复格式（两段，严格遵守）：',
    '1. 直接输出本回合剧情正文：200~400字纯叙事文本，不要标题、列表或代码围栏；正文到剧情场景为止，禁止在正文里罗列、编号或预告任何选项',
    '   若上一回合玩家有行动，正文开头先点明它在"当时的状态下"实际达成到什么程度（完全做到 / 只做到一半 / 弄巧成拙），再展开后续',
    '2. 正文结束后另起一行，输出一个 JSON 对象，选项只出现在这里，JSON 前后不要围栏或任何其他文字：',
    `{"choices":[{"text":"选项文字","effects":{"属性key":整数增减}}],"summary":"不超过30字的本回合摘要","recommend":0${itemField},"memoryAdd":["本回合新出现、需长期记住的关键事实"]${goalField}}`,
    `- choices 给 3~4 个选项；effects 的 key 只能取：${attrKeys.join(', ')}；数值为整数，可为负`,
    '- 数值纪律：收益与风险成正比；每回合至少一个选项带明显负面效果；禁止出现全部选项都是正面效果的回合',
    '- 部分执行（不要封锁、灰掉或否决任何选项，也不要让选项注定失败）：每个选项玩家都能尝试。当前状态越好，行动越能如愿；状态越差，同一行动越只能勉强达成甚至适得其反。把这种"打折"直接写进该选项的 effects（收益缩水、代价加重）和选项文字（如"勉力一试""仓促"），而不是把选项拿掉',
    '- 另给一个 "recommend"：你认为这个角色依其身份、性格与目标，最可能选的那个选项的下标（从 0 开始的整数）',
    '- "memoryAdd"：仅当本回合出现值得长期记住的事实（结识/失去的人物、立下的誓约、重大背叛或恩怨、揭开的世界设定、获得的称号身份等）时，列出 1~2 条不超过20字的简短记录；若本回合无此类事实则给空数组 []。务必与【人物与往事】已有记忆保持一致、不自相矛盾',
    ...(hasGoal
      ? [
          '- "goalProgress"：结合剧情进展，估计玩家距其【玩家目标】的完成度，给一个 0~100 的整数（0=毫无进展，100=目标已达成）。它应随剧情合理增减、不要无端跳变，目标受挫时可下降',
        ]
      : []),
    ...(useItems
      ? ['- 物品：剧情中获得道具时写入 itemsGained，消耗/损毁时写入 itemsLost；可让某些选项依赖玩家已持有的物品']
      : []),
  ].join('\n')
}

// 汇总当前各属性的状态段，供 UI/prompt 复用
export function currentBands(sc: Scenario, attrs: Record<string, number>) {
  return sc.attributes.map((a) => ({ attr: a, band: bandOf(a, attrs[a.key]) }))
}

// 把落入 critical/low 段且带 directive 的状态收集为硬指令；critical 额外要求开场即写后果
function stateDirectives(
  bands: { attr: { name: string }; band: ResolvedBand }[],
  turn: number,
): string[] {
  const out: string[] = []
  for (const { attr, band } of bands) {
    if (band.directive && (band.severity === 'critical' || band.severity === 'low')) {
      out.push(`- ${attr.name}【${band.label}】：${band.directive}`)
    }
  }
  const critical = bands.filter((b) => b.band.severity === 'critical')
  const high = bands.filter((b) => b.band.severity === 'high')
  if (critical.length > 0) {
    // 突发危机：危急状态下本回合开场必须直接呈现其恶果，制造起伏而非平铺
    const names = critical.map((b) => b.attr.name).join('、')
    out.push(`- 突发危机：${names}已处于危急，本回合开场必须立刻呈现由此引发的具体恶果或险情。`)
  } else if (high.length > 0 && turn % 3 === 0) {
    // 机遇：高位状态偶尔给正向转机，避免节奏雷同
    out.push(`- 转机：${high.map((b) => b.attr.name).join('、')}处于高位，本回合可出现一个与之相关的机遇。`)
  }
  return out
}

export function buildTurnMessages(
  sc: Scenario,
  st: GameState,
  customAction?: string,
  // 自定义行动结算时，玩家正反应的当前场景还在 pendingTurn、尚未进 history，
  // 必须显式传入，否则 AI 看不到该行动所处的情境，会接续到上一幕、造成叙事错位。
  sceneNarrative?: string,
): ChatMessage[] {
  const keys = sc.attributes.map((a) => a.key)
  const useItems = true
  const system = [
    sc.systemPrompt,
    '',
    `属性说明：${sc.attributes.map((a) => `${a.key}=${a.name}（0~${a.max}）`).join('，')}`,
    formatContract(keys, useItems, !!st.ambition),
  ].join('\n')

  const done = st.history.length
  const current = done + 1
  const bands = currentBands(sc, st.attributes)
  const inventory = st.inventory ?? []
  const lines: string[] = []
  lines.push(
    sc.maxTurns !== undefined
      ? `【第 ${current} ${sc.turnUnit}，共 ${sc.maxTurns} ${sc.turnUnit}】`
      : `【第 ${current} ${sc.turnUnit}】`,
  )
  // 数值 + 命名状态一起给，AI 才能据状态改写而非只看裸数字
  lines.push(
    `【当前状态】${bands.map(({ attr, band }) => `${attr.name} ${st.attributes[attr.key]}（${band.label}）`).join('，')}`,
  )
  if (inventory.length > 0) lines.push(`【持有物品】${inventory.join('、')}`)

  const memory = st.memory ?? []
  if (memory.length > 0) {
    lines.push(
      `【人物与往事（记忆，须保持一致）】${memory.join('；')} —— 后续剧情必须与这些事实吻合，提及相关人物/事件时不得自相矛盾。`,
    )
  }

  if (st.ambition) {
    lines.push(
      `【玩家目标】${st.ambition} —— 围绕它编织机遇与阻碍，让剧情朝它推进或受挫，但不要替玩家强行达成。`,
    )
  }

  // 身份贯穿全程注入（非仅开局），并要求 AI 据此合理化剧情，避免长局里身份与剧情脱节
  if (st.opening) {
    lines.push(
      `【玩家身份】${st.opening} —— 这是主角的身份、出身与设定，贯穿全程：剧情走向、人物言行、他人对主角的态度都须与之契合、据此合理演绎，不得与身份脱节或自相矛盾。`,
    )
  }

  if (done === 0) {
    lines.push(`【开局】${sc.intro}`)
  } else {
    const older = st.history.slice(0, -RECENT_TURNS)
    if (older.length > 0) {
      lines.push(`【前情提要】${older.map((t) => t.summary).join('；')}`)
    }
    for (const t of st.history.slice(-RECENT_TURNS)) {
      lines.push(`【剧情】${t.narrative}`)
      lines.push(`【玩家选择】${t.choiceText}`)
    }
  }

  const directives = stateDirectives(bands, current)
  if (directives.length > 0) {
    lines.push('【状态影响（必须遵守）】')
    lines.push(...directives)
  }

  if (sc.maxTurns !== undefined && isKeyMoment(current, sc.maxTurns)) {
    lines.push(
      '【关键抉择】本回合是命运转折点：各选项的属性摆动应明显大于平时（约 1.5~2 倍），后果更深远；正文要渲染出这一刻的分量与紧张。',
    )
  }

  if (sc.maxTurns !== undefined && current >= sc.maxTurns) {
    lines.push(`这是最后一${sc.turnUnit}，请将剧情推向收束。`)
  }

  if (customAction) {
    // 自定义行动：玩家不选预设，引擎需要 AI 额外结算该行动的属性影响
    if (sceneNarrative) lines.push(`【当前场景】${sceneNarrative}`)
    lines.push(
      `【玩家自行行动】玩家在上述当前场景中放弃预设选项，选择：「${customAction}」`,
      '请：1) 按"部分执行"判断该行动在当前状态下实际达成到什么程度，把它对属性的直接增减写进 JSON 顶层的 "actionEffects":{"属性key":整数}（只算这个行动本身的影响）；2) 正文先写该行动的结果，再推进到新场景；3) 给出新的 choices。',
    )
  } else {
    lines.push(`请生成第 ${current} ${sc.turnUnit}的剧情与选项。`)
  }

  return [
    { role: 'system', content: system },
    { role: 'user', content: lines.join('\n') },
  ]
}

export function buildEndingMessages(sc: Scenario, st: GameState, ending: Ending): ChatMessage[] {
  const bands = currentBands(sc, st.attributes)
  const memory = st.memory ?? []
  const lines = [
    `【全程回顾】${st.history.map((t) => t.summary).join('；')}`,
    ...(memory.length > 0 ? [`【人物与往事】${memory.join('；')} —— 结局应呼应这些人物与事件的下场。`] : []),
    `【最终状态】${bands.map(({ attr, band }) => `${attr.name} ${st.attributes[attr.key]}（${band.label}）`).join('，')}`,
    ...(st.ambition ? [`【玩家曾立下的目标】${st.ambition} —— 在结局里点明它最终实现、落空还是变质。`] : []),
    `【结局】基调：${ending.tone}（触发：${ending.reason}），发生在第 ${st.history.length} ${sc.turnUnit}`,
    '请用纯文本写一段 300 字左右的结局叙事，呼应玩家的关键抉择与最终状态。不要输出 JSON。',
  ]
  return [
    { role: 'system', content: sc.systemPrompt },
    { role: 'user', content: lines.join('\n') },
  ]
}

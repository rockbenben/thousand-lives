import type { Scenario, LocalEvent } from '../scenarios/schema'
import type { GameState, TurnResult } from './types'
import { parseCondition, evalCondition } from './condition'
import { isKeyMoment } from './keymoment'

export type Rng = () => number

export function hasLocalMode(sc: Scenario): boolean {
  return (sc.localEvents?.length ?? 0) > 0
}

// 从事件池挑一个当前可用事件：满足回合区间 + 状态/物品门控、未在本局出现过（once 永不重复）；加权随机。
// 可用池为空时逐步放宽（重复非 once → 放宽门控仅守 once → 任意），保证总能出一个。
export function pickLocalEvent(sc: Scenario, st: GameState, rng: Rng = Math.random): LocalEvent | null {
  const events = sc.localEvents ?? []
  if (events.length === 0) return null
  const turn = st.history.length + 1
  const usedSummaries = new Set(st.history.map((h) => h.summary))
  const inv = st.inventory ?? []
  const inRange = (e: LocalEvent) =>
    (e.minTurn === undefined || turn >= e.minTurn) && (e.maxTurn === undefined || turn <= e.maxTurn)
  const meetsGate = (e: LocalEvent) => {
    if (e.requiresItem && !inv.includes(e.requiresItem)) return false
    if (e.requires) {
      try {
        if (!evalCondition(parseCondition(e.requires), st.attributes, turn, sc.maxTurns)) return false
      } catch {
        return false // 门控语法非法：视为不满足，跳过（不崩）
      }
    }
    return true
  }
  const eligible = (e: LocalEvent) => inRange(e) && meetsGate(e)
  const fresh = (e: LocalEvent) => !usedSummaries.has(e.summary)
  const onceOk = (e: LocalEvent) => !(e.once && usedSummaries.has(e.summary))
  // 里程碑事件只在关键回合出现；普通回合排除它们(为关键回合保留)。
  // 涌现剧本（无 maxTurns）不产生关键回合，里程碑事件全部不触发。
  const keyTurn = sc.maxTurns !== undefined && isKeyMoment(turn, sc.maxTurns)
  const phaseOk = (e: LocalEvent) => (keyTurn ? !!e.keyMoment : !e.keyMoment)

  // 先在「本阶段」内挑(关键→里程碑、普通→非里程碑),逐步放宽:先松 fresh,再松阶段限制
  let pool = events.filter((e) => eligible(e) && fresh(e) && phaseOk(e))
  if (pool.length === 0) pool = events.filter((e) => eligible(e) && onceOk(e) && phaseOk(e))
  if (pool.length === 0) pool = events.filter((e) => eligible(e) && fresh(e))
  if (pool.length === 0) pool = events.filter((e) => eligible(e) && onceOk(e))
  if (pool.length === 0) pool = events.filter(eligible)
  if (pool.length === 0) pool = events.filter(onceOk)
  if (pool.length === 0) pool = events

  // 事件「分量」：选项里最大的单项效应绝对值——越大越是改变命运的大事件。
  const magOf = (e: LocalEvent) => {
    let m = 0
    for (const c of e.choices) for (const v of Object.values(c.effects)) m = Math.max(m, Math.abs(v))
    return m
  }
  // 阶段升格偏置:期望事件量级随回合进度上升(初期小吏小事 → 后期朝堂大事),
  // 贴合期望者加权更高(×0.5~×1.5),但不排除任何事件,保留意外与变数。
  const progress = sc.maxTurns !== undefined && sc.maxTurns > 0 ? Math.min(1, turn / sc.maxTurns) : 0.5
  const stageBias = (e: LocalEvent) => 0.5 + (1 - Math.abs(Math.min(1, magOf(e) / 14) - progress))

  // 连贯性偏置：已解锁的「剧情弧」事件优先推进，避免被通用事件淹没成散乱片段。
  // requiresItem（玩家已持该物品 → 该弧的后续）权重最高；requires（属性门控）次之。
  const effWeight = (e: LocalEvent) =>
    (e.weight ?? 1) * (e.requiresItem ? 5 : e.requires ? 2 : 1) * stageBias(e)

  const total = pool.reduce((s, e) => s + effWeight(e), 0)
  let r = rng() * total
  for (const e of pool) {
    r -= effWeight(e)
    if (r <= 0) return e
  }
  return pool[pool.length - 1]
}

// 本地模式生成一回合：把抽到的事件转成 TurnResult（含给托管用的随机 recommend）。
export function localTurn(sc: Scenario, st: GameState, rng: Rng = Math.random): TurnResult {
  const e = pickLocalEvent(sc, st, rng)
  if (!e) {
    return {
      narrative: sc.intro,
      choices: [
        { text: '继续前行', effects: {} },
        { text: '静观其变', effects: {} },
      ],
      summary: '继续',
    }
  }
  return {
    narrative: e.narrative,
    choices: e.choices.map((c) => ({ text: c.text, effects: c.effects, reaction: c.reaction })),
    summary: e.summary,
    itemsGained: e.itemsGained,
    itemsLost: e.itemsLost,
    recommend: Math.floor(rng() * e.choices.length),
  }
}

// 本地模式的结局尾声（无 AI）：优先用该结局的专属 epilogue，叠加曾立下的目标，拼一段收束文字。
// 本地模式提示与关键抉择不在此拼入——前者由 UI 单独呈现（不污染可分享文案），后者见结局页的文字版分享卡。
export function localEnding(sc: Scenario, st: GameState): string {
  const tone = st.ended?.tone ?? '落幕'
  // 优先使用该结局的专属尾声；缺省时回退到通用模板
  const matched = st.ended
    ? sc.endings.find((e) => e.tone === st.ended!.tone && e.epilogue)
    : undefined
  const lines = [
    matched?.epilogue ??
      `历经 ${st.history.length} ${sc.turnUnit}，你的故事走向了「${tone}」。`,
    st.ambition ? `你曾立下的目标——${st.ambition}——成败留与后人评说。` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

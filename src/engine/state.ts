import type { Scenario, Opening, Attribute } from '../scenarios/schema'
import { parseCondition, evalCondition } from './condition'
import type { GameState, TurnResult, Ending, Choice, Outcome } from './types'

export function initState(
  sc: Scenario,
  opening?: Opening,
  ambition?: string,
  mode: 'ai' | 'local' = 'ai',
): GameState {
  const attributes: Record<string, number> = {}
  for (const a of sc.attributes) attributes[a.key] = a.initial
  return {
    scenarioId: sc.id,
    attributes,
    history: [],
    inventory: [],
    opening: opening ? `${opening.name}——${opening.prompt}` : undefined,
    ambition: ambition?.trim() || undefined,
    mode,
    memory: [],
    flags: opening?.flag ? [opening.flag] : [],
  }
}

const MAX_INVENTORY = 12
const MAX_MEMORY = 16

// 合并本回合新增的关键记忆：去重、去空，超上限保留最新（旧记忆自然淡出）
export function applyMemory(memory: string[] | undefined, add: string[] | undefined): string[] {
  const kept = [...(memory ?? [])]
  for (const raw of add ?? []) {
    const fact = raw.trim()
    if (fact && !kept.includes(fact)) kept.push(fact)
  }
  return kept.length > MAX_MEMORY ? kept.slice(kept.length - MAX_MEMORY) : kept
}

// 目标进度：本回合给了有效值就取（clamp 0~100、取整），否则沿用上一回合
export function nextProgress(prev: number | undefined, next: number | undefined): number | undefined {
  if (typeof next !== 'number' || !Number.isFinite(next)) return prev
  return Math.min(100, Math.max(0, Math.round(next)))
}

// 应用本回合的物品增减：先移除失去的，再追加获得的（去重），上限截断保留最新
export function applyItems(inventory: string[], res: TurnResult): string[] {
  const lost = new Set((res.itemsLost ?? []).map((s) => s.trim()).filter(Boolean))
  const kept = inventory.filter((i) => !lost.has(i))
  for (const raw of res.itemsGained ?? []) {
    const item = raw.trim()
    if (item && !kept.includes(item)) kept.push(item)
  }
  return kept.length > MAX_INVENTORY ? kept.slice(kept.length - MAX_INVENTORY) : kept
}

// 每回合的自动衰减：把声明了 decayPerTurn 的属性转成 -decayPerTurn 的 effect。
// 衰减是「岁月的硬税」，不参与命运无常缩放，单独叠加在本回合 effect 之上。
export function decayEffects(sc: Scenario): Record<string, number> {
  const m: Record<string, number> = {}
  for (const a of sc.attributes) if (a.decayPerTurn) m[a.key] = -a.decayPerTurn
  return m
}

// 合并多组 effect（按 key 求和），用于把本回合 effect 与衰减叠加后一次性 clamp。
export function mergeEffects(...maps: Record<string, number>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = (out[k] ?? 0) + v
  return out
}

// 属性的有效上限：基线 ceiling（缺省 max），叠加已持有印记解锁的更高上限，最终不超过 max。
export function effectiveCeiling(a: Attribute, flags: string[]): number {
  let cap = a.ceiling ?? a.max
  for (const u of a.ceilingUnlocks ?? []) if (flags.includes(u.flag)) cap = Math.max(cap, u.max)
  return Math.min(a.max, cap)
}

export function clampEffects(
  sc: Scenario,
  attrs: Record<string, number>,
  effects: Record<string, number>,
  flags: string[] = [],
): Record<string, number> {
  const next = { ...attrs }
  for (const a of sc.attributes) {
    const d = effects[a.key]
    if (typeof d === 'number' && Number.isFinite(d)) {
      next[a.key] = Math.min(effectiveCeiling(a, flags), Math.max(0, next[a.key] + d))
    }
  }
  return next
}

export function checkEnding(
  sc: Scenario,
  attrs: Record<string, number>,
  completedTurns: number,
): Ending | null {
  const dead = sc.attributes.filter(
    (a) => a.deathBelow !== undefined && attrs[a.key] <= a.deathBelow,
  )
  if (dead.length > 0) {
    // 作者若为任一致死属性写了死亡级（阈值 <= deathBelow）的 <= 结局，用作者的 tone 而非通用死亡。
    // 阈值高于 deathBelow 的 <= 结局（如 hp<=40 重伤）不是死亡结局，不能顶替死亡。
    const custom = sc.endings.find((e) => {
      const c = parseCondition(e.condition)
      return (
        c.kind === 'cmp' &&
        c.op === '<=' &&
        dead.some((a) => c.attr === a.key && c.value <= a.deathBelow!) &&
        evalCondition(c, attrs, completedTurns, sc.maxTurns)
      )
    })
    if (custom) return { tone: custom.tone, reason: custom.condition }
    return { tone: '死亡', reason: `${dead[0].name}耗尽` }
  }
  for (const e of sc.endings) {
    if (evalCondition(parseCondition(e.condition), attrs, completedTurns, sc.maxTurns)) {
      return { tone: e.tone, reason: e.condition }
    }
  }
  // endings 不保证包含 maxTurns 条件：到期仍无命中时兜底收束，否则游戏会无限超出回合上限
  if (completedTurns >= sc.maxTurns) return { tone: '落幕', reason: 'maxTurns' }
  return null
}

// 「命运无常」：本地模式下同一选择偶有意外转折，结果好于或坏于预期，
// 使相同抉择也可能走向不同。仅在传入 rng 时启用（AI 模式/测试保持确定性）。
const FORTUNE_CHANCE = 0.18
// 转折提示文案池:多样化,避免反复看到同一句而失了「无常」的彩头感
const FORTUNE_GOOD = [
  '命运无常 · 时来运转——这一步竟比预想的更顺。',
  '命运无常 · 无心插柳——你竟讨得了意料之外的彩头。',
  '命运无常 · 天公作美——局面比你盘算的还顺了几分。',
  '命运无常 · 福至心灵——阴差阳错间，反倒成了好事。',
  '命运无常 · 柳暗花明——本以为要糟，偏偏绝处生花。',
]
const FORTUNE_BAD = [
  '命运无常 · 世事难料——事情没全照你盘算的来。',
  '命运无常 · 人算天算——半路杀出了意料之外的波折。',
  '命运无常 · 造化弄人——你算到了开头，没算到这结尾。',
  '命运无常 · 节外生枝——偏偏在这一步上出了岔子。',
  '命运无常 · 阴差阳错——一步之差，到底走了样。',
]
export function rollFortune(
  effects: Record<string, number>,
  rng: () => number,
): { effects: Record<string, number>; twist?: string } {
  const hasEffect = Object.values(effects).some((v) => typeof v === 'number' && v !== 0)
  if (!hasEffect || rng() >= FORTUNE_CHANCE) return { effects }
  const good = rng() < 0.5
  const scaled: Record<string, number> = {}
  for (const [k, v] of Object.entries(effects)) {
    if (good) scaled[k] = v >= 0 ? Math.round(v * 1.6) + 1 : Math.round(v * 0.4)
    else scaled[k] = v > 0 ? Math.round(v * 0.3) : Math.round(v * 1.6) - 1
  }
  const pool = good ? FORTUNE_GOOD : FORTUNE_BAD
  return { effects: scaled, twist: pool[Math.floor(rng() * pool.length) % pool.length] }
}

// 加权分支：无 outcomes 返回 null；否则按 weight 加权掷骰取一
export function rollOutcome(choice: Choice, rng: () => number): Outcome | null {
  const outs = choice.outcomes
  if (!outs || outs.length === 0) return null
  const total = outs.reduce((s, o) => s + (o.weight ?? 1), 0)
  let r = rng() * total
  for (const o of outs) {
    r -= o.weight ?? 1
    if (r <= 0) return o
  }
  return outs[outs.length - 1]
}

export function applyChoice(
  sc: Scenario,
  st: GameState,
  turnRes: TurnResult,
  choiceIdx: number,
  rng?: () => number,
): GameState {
  const choice = turnRes.choices[choiceIdx]
  if (!choice) throw new Error(`选项不存在: ${choiceIdx}`)
  const { effects, twist } = rng
    ? rollFortune(choice.effects, rng)
    : { effects: choice.effects, twist: undefined }
  // 本回合 effect（已含命运无常缩放）叠加每回合衰减，一次性结算
  const attributes = clampEffects(sc, st.attributes, mergeEffects(effects, decayEffects(sc)), st.flags)
  const history = [
    ...st.history,
    {
      narrative: turnRes.narrative,
      choiceText: choice.text,
      summary: turnRes.summary,
      ...(choice.reaction ? { reaction: choice.reaction } : {}),
      ...(twist ? { twist } : {}),
    },
  ]
  return {
    ...st,
    attributes,
    history,
    inventory: applyItems(st.inventory ?? [], turnRes),
    memory: applyMemory(st.memory, turnRes.memoryAdd),
    goalProgress: nextProgress(st.goalProgress, turnRes.goalProgress),
    ended: checkEnding(sc, attributes, history.length) ?? undefined,
  }
}

// 结算玩家的自定义行动：scene 是行动发生的场景（被解析的 pendingTurn），
// resolved 是解析回合返回的结果，其 actionEffects 是该行动的属性影响。
// 与 applyChoice 对称：把场景+行动文本记入历史，应用行动结算。物品/新选项随 resolved 一并带入新的 pendingTurn，不在此处结算。
export function resolveCustomAction(
  sc: Scenario,
  st: GameState,
  scene: { narrative: string; summary: string },
  action: string,
  resolved: TurnResult,
): GameState {
  const attributes = clampEffects(
    sc,
    st.attributes,
    mergeEffects(resolved.actionEffects ?? {}, decayEffects(sc)),
    st.flags,
  )
  const history = [
    ...st.history,
    { narrative: scene.narrative, choiceText: action, summary: scene.summary },
  ]
  return {
    ...st,
    attributes,
    history,
    memory: applyMemory(st.memory, resolved.memoryAdd),
    goalProgress: nextProgress(st.goalProgress, resolved.goalProgress),
    ended: checkEnding(sc, attributes, history.length) ?? undefined,
  }
}

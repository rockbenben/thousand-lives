import type { Scenario, Opening, Attribute } from '../scenarios/schema'
import { parseCondition, evalCondition, conditionImplies, type Condition } from './condition'
import type { GameState, TurnResult, Ending, Choice, Outcome } from './types'

// 条件是否含「死亡级」子句：某致死属性 <= 其死线（hp<=40 这类高于死线的「重伤」不算死亡）。
function hasDeathClause(c: Condition, deathBelow: Map<string, number>): boolean {
  const parts = c.kind === 'and' ? c.parts : [c]
  return parts.some(
    (p) => p.kind === 'cmp' && p.op === '<=' && deathBelow.has(p.attr) && p.value <= deathBelow.get(p.attr)!,
  )
}

// 局内状态里开局身份的规范字符串（name——prompt）：initState 写入与分享链反查开局下标两端共用，
// 单一来源避免格式漂移（曾因两处各拼一份，改分隔符会让挑战链静默丢 ?o=）。
export function openingLabel(o: Opening): string {
  return `${o.name}——${o.prompt}`
}

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
    opening: opening ? openingLabel(opening) : undefined,
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

// 目标进度：本回合给了有效值就取（clamp 0~100、取整），否则沿用上一回合。
// 做「棘轮」平滑——上升随剧情自由，回落每回合最多 GOAL_MAX_DROP 一小步：
// AI 每回合主观重估 goalProgress 常大幅乱跳/倒退，直接展示会让进度条闪回；
// 缓降后，据此派生的定性阶段稳步前进、不闪退，仍能反映持续受挫（多回合渐降）。
const GOAL_MAX_DROP = 6
export function nextProgress(prev: number | undefined, next: number | undefined): number | undefined {
  if (typeof next !== 'number' || !Number.isFinite(next)) return prev
  const target = Math.min(100, Math.max(0, Math.round(next)))
  if (prev === undefined) return target
  return target >= prev ? target : Math.max(target, prev - GOAL_MAX_DROP)
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

// 涌现剧本（无 maxTurns）的硬兜底：到此回合数强制收束，防病态无限循环
export const EMERGENT_HARD_CAP = 300

export function checkEnding(
  sc: Scenario,
  attrs: Record<string, number>,
  completedTurns: number,
  flags: string[] = [],
  rng?: () => number,
): Ending | null {
  const deathBelow = new Map(
    sc.attributes.filter((a) => a.deathBelow !== undefined).map((a) => [a.key, a.deathBelow!]),
  )
  const dead = sc.attributes.filter(
    (a) => a.deathBelow !== undefined && attrs[a.key] <= a.deathBelow,
  )
  if (dead.length > 0) {
    // 死亡级结局：条件含「某致死属性 <= 其死线」子句者（hp<=40 这类高于死线的重伤不算）。
    // 先按 salience 取最具体（带语境的死法如 `hp<=0 & has(据点)` 胜过裸 `hp<=0`），
    // 再在「同等具体（互不蕴含）的并列死法」里**随机取一**——使数值相同也可能饿死/渴死/病死/中毒死，
    // 死得不同（仅传入 rng 时随机，否则取首个保持确定，便于测试/AI 复现）。
    const deathEndings = sc.endings
      .map((e) => ({ e, cond: parseCondition(e.condition) }))
      .filter(
        (x) =>
          hasDeathClause(x.cond, deathBelow) &&
          evalCondition(x.cond, attrs, completedTurns, sc.maxTurns, flags),
      )
    const top = deathEndings.filter(
      (x) =>
        !deathEndings.some(
          (y) => y !== x && conditionImplies(y.cond, x.cond) && !conditionImplies(x.cond, y.cond),
        ),
    )
    if (top.length > 0) {
      const pick =
        rng && top.length > 1 ? top[Math.min(top.length - 1, Math.floor(rng() * top.length))] : top[0]
      return { tone: pick.e.tone, reason: pick.e.condition }
    }
    return { tone: '死亡', reason: `${dead[0].name}耗尽` }
  }
  // 非死亡：在所有满足条件的结局中取「最具体」者——不被任何更严格（严格蕴含）的满足结局压制者；
  // 各自独立（互不蕴含）时按数组顺序取靠前。于是更具体的结局永不被过宽的结局遮蔽，数组顺序仅作并列次序。
  const satisfied = sc.endings
    .map((e) => ({ e, cond: parseCondition(e.condition) }))
    .filter((x) => evalCondition(x.cond, attrs, completedTurns, sc.maxTurns, flags))
  for (const x of satisfied) {
    const dominated = satisfied.some(
      (y) => y !== x && conditionImplies(y.cond, x.cond) && !conditionImplies(x.cond, y.cond),
    )
    if (!dominated) return { tone: x.e.tone, reason: x.e.condition }
  }
  // 软上限剧本：到 maxTurns 兜底收束
  if (sc.maxTurns !== undefined && completedTurns >= sc.maxTurns) return { tone: '落幕', reason: 'maxTurns' }
  // 涌现剧本：高位硬兜底
  if (sc.maxTurns === undefined && completedTurns >= EMERGENT_HARD_CAP)
    return { tone: '落幕', reason: 'hardcap' }
  return null
}

// 图鉴/成就口径：剧本「可真正触达」的结局基调全集。
// 通用「死亡」是 checkEnding 在某致死属性归零、却没有作者写的死亡级结局时的兜底基调；
// 仅当确有某致死属性缺少 简单 `key<=阈值`（阈值<=deathBelow）结局时它才会被触发——此时才计入。
// 否则它是一个永不触发的幽灵槽：会让「集齐全部结局」成就与图鉴永远差一格、不可达。
// 判定口径与上方 checkEnding 死亡分支严格一致（仅 kind==='cmp' 的 <= 简单条件算作死亡级结局）。
export function reachableEndingTones(sc: Scenario): string[] {
  const tones = sc.endings.map((e) => e.tone)
  const deaths = sc.attributes.filter((a) => a.deathBelow !== undefined)
  const genericDeathReachable = deaths.some(
    (a) =>
      !sc.endings.some((e) => {
        const c = parseCondition(e.condition)
        return c.kind === 'cmp' && c.op === '<=' && c.attr === a.key && c.value <= a.deathBelow!
      }),
  )
  if (genericDeathReachable) tones.push('死亡')
  return [...new Set(tones)]
}

// 「命运无常」：本地模式下同一选择偶有意外转折，结果好于或坏于预期，
// 使相同抉择也可能走向不同。仅在传入 rng 时启用（AI 模式/测试保持确定性）。
const FORTUNE_CHANCE = 0.10
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
  turnIndex?: number,
): { effects: Record<string, number>; twist?: string } {
  // 前 1 回合不触发命运无常（开局先让玩家站稳；turnIndex = 已完成回合数，0 即首回合）
  if (turnIndex !== undefined && turnIndex < 1) return { effects }
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

// ── 极端命运事件：稀有的大开大合，制造可分享的「卧槽」瞬间 ──
// 不是数值微调，而是一段生动文案 + 大幅后果；命中记入 GameState.fateHighlight 供命运卡引用。
const EXTREME_CHANCE = 0.018
const EXTREME_WINDFALL = [
  '天降横财——一笔泼天的造化兜头砸来，半生奔忙忽成笑谈。',
  '时来天地皆同力——莫名的际遇接踵而至，你竟一步登天。',
  '绝处逢生——本已万念俱灰，命运却在此刻陡然翻盘。',
  '贵人天降——一位素不相识者倾力相助，局面豁然开朗。',
  '福星高照——这一程顺得不可思议，连你自己都不敢信。',
]
const EXTREME_DISASTER = [
  '飞来横祸——一场无妄之灾兜头罩下，多年经营毁于一旦。',
  '运去英雄不自由——天意忽然翻脸，你被推入万劫深渊。',
  '祸不单行——厄运接二连三，竟没给你半分喘息。',
  '小人暗算——你算尽了天下，独独没算到背后这一刀。',
  '天降大难——一夕之间，你从云端跌落泥淖。',
]

export interface ExtremeFate {
  text: string
  kind: 'windfall' | 'disaster'
  effects: Record<string, number>
}

// 极端命运比命运无常更狠（可致命），故放行更晚：前 EXTREME_SKIP_TURNS 回合不触发。
const EXTREME_SKIP_TURNS = 2
// 后果按各属性量程（max-min）缩放，跨题材轻重一致：windfall 普涨 35%，disaster 普跌 22%、致命属性重击 40%。
export function rollExtremeFate(
  sc: Scenario,
  rng: () => number,
  turnIndex?: number,
): ExtremeFate | null {
  if (turnIndex !== undefined && turnIndex < EXTREME_SKIP_TURNS) return null
  if (rng() >= EXTREME_CHANCE) return null
  const windfall = rng() < 0.5
  const range = (a: Attribute) => Math.max(1, a.max ?? 100) // 下限隐含 0，量程≈max
  const effects: Record<string, number> = {}
  for (const a of sc.attributes) {
    if (windfall) effects[a.key] = Math.round(range(a) * 0.35) // clampEffects 收口到上限
    else effects[a.key] = a.deathBelow !== undefined
      ? -Math.round(range(a) * 0.4)
      : -Math.round(range(a) * 0.22)
  }
  const pool = windfall ? EXTREME_WINDFALL : EXTREME_DISASTER
  const text = pool[Math.floor(rng() * pool.length) % pool.length]
  return { text, kind: windfall ? 'windfall' : 'disaster', effects }
}

// 应用印记增减：先去掉 clear，再并入 set（去重）
export function applyFlags(flags: string[], set?: string[], clear?: string[]): string[] {
  const cleared = new Set((clear ?? []).map((s) => s.trim()).filter(Boolean))
  const kept = flags.filter((f) => !cleared.has(f))
  for (const raw of set ?? []) {
    const f = raw.trim()
    if (f && !kept.includes(f)) kept.push(f)
  }
  return kept
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
  const flags0 = st.flags ?? []

  // 有 outcomes 则掷骰取一分支（命运无常跳过——outcomes 自带变数）；极端命运是「天意」、对两路都掷
  const picked = rng ? rollOutcome(choice, rng) : (choice.outcomes?.[0] ?? null)
  let baseEffects: Record<string, number>
  let twist: string | undefined
  let fateHighlight: GameState['fateHighlight'] | undefined
  let setFlags = choice.flagsSet
  let clearFlags = choice.flagsClear
  let endTone = choice.endTone
  let reaction = choice.reaction
  let itemsGained = turnRes.itemsGained
  let itemsLost = turnRes.itemsLost
  if (picked) {
    baseEffects = picked.effects ?? {}
    setFlags = picked.flagsSet ?? setFlags
    clearFlags = picked.flagsClear ?? clearFlags
    endTone = picked.endTone ?? endTone
    reaction = picked.reaction ?? reaction
    if (picked.itemsGained) itemsGained = picked.itemsGained
    if (picked.itemsLost) itemsLost = picked.itemsLost
    // 极端命运独立于 outcomes：选了 outcomes 分支也可被横祸/横财命中——否则 outcomes 化的剧本永不触发命运卡高光
    if (rng) {
      const extreme = rollExtremeFate(sc, rng, st.history.length)
      if (extreme) {
        baseEffects = mergeEffects(baseEffects, extreme.effects)
        twist = extreme.text
        fateHighlight = { text: extreme.text, kind: extreme.kind, turn: st.history.length + 1 }
      }
    }
  } else if (rng) {
    // 无 outcomes：先掷极端命运（前 2 回合不触发）；未中再走命运无常（前 1 回合不触发，outcomes 自带变数故仅此路掷）
    const extreme = rollExtremeFate(sc, rng, st.history.length)
    if (extreme) {
      baseEffects = mergeEffects(choice.effects, extreme.effects)
      twist = extreme.text
      fateHighlight = { text: extreme.text, kind: extreme.kind, turn: st.history.length + 1 }
    } else {
      const f = rollFortune(choice.effects, rng, st.history.length)
      baseEffects = f.effects
      twist = f.twist
    }
  } else {
    baseEffects = choice.effects
  }

  const flags = applyFlags(flags0, setFlags, clearFlags)
  // 同回合突破：用「选择后」印记算封顶，使本回合授境界印记 + 属性增益能达新上限
  const attributes = clampEffects(sc, st.attributes, mergeEffects(baseEffects, decayEffects(sc)), flags)
  const history = [
    ...st.history,
    {
      narrative: turnRes.narrative,
      choiceText: choice.text,
      summary: turnRes.summary,
      ...(reaction ? { reaction } : {}),
      ...(twist ? { twist } : {}),
    },
  ]
  const ended = endTone
    ? { tone: endTone, reason: 'forced' }
    : checkEnding(sc, attributes, history.length, flags, rng ?? Math.random) ?? undefined
  return {
    ...st,
    attributes,
    flags,
    history,
    inventory: applyItems(st.inventory ?? [], { ...turnRes, itemsGained, itemsLost }),
    memory: applyMemory(st.memory, turnRes.memoryAdd),
    goalProgress: nextProgress(st.goalProgress, turnRes.goalProgress),
    // 首个极端命运一旦定格便保留，不被后续极端事件覆盖（命运卡引用「这一生第一次被命运拨动」的瞬间）
    ...(fateHighlight && !st.fateHighlight ? { fateHighlight } : {}),
    ended,
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
  const flags = st.flags ?? []
  const attributes = clampEffects(
    sc,
    st.attributes,
    mergeEffects(resolved.actionEffects ?? {}, decayEffects(sc)),
    flags,
  )
  const history = [
    ...st.history,
    { narrative: scene.narrative, choiceText: action, summary: scene.summary },
  ]
  return {
    ...st,
    attributes,
    flags,
    history,
    memory: applyMemory(st.memory, resolved.memoryAdd),
    goalProgress: nextProgress(st.goalProgress, resolved.goalProgress),
    ended: checkEnding(sc, attributes, history.length, flags, Math.random) ?? undefined,
  }
}

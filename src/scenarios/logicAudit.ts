// 剧本逻辑结构审查：invariants.test.ts 管「引用是否存在」，这里管「印记链与时间窗是否自洽」。
// 规则编号 G-L 与 scripts/logic-check.ts 的报告前缀一致；两侧共用本文件，避免判据分叉。
import { keyMomentTurns } from '../engine/keymoment'
import type { Scenario } from './schema'

export interface LogicAudit {
  /** 确定性缺陷：内容永不触发或触发后无定义 */
  hard: string[]
  /** 需人工判断的结构性压力，非错误 */
  soft: string[]
}

export function auditScenarioLogic(sc: Scenario): LogicAudit {
  const hard: string[] = []
  const soft: string[] = []
  const ev = sc.localEvents ?? []
  const toneSet = new Set(sc.endings.map((e) => e.tone))
  const openingFlags = new Set((sc.openings ?? []).map((o) => o.flag).filter(Boolean) as string[])

  // ── G. endTone 悬空：选项直接指定的基调必须在 endings 里，否则尾声/配图/图鉴全落空 ──
  const endTones = new Map<string, number>()
  for (const e of ev)
    for (const c of e.choices) {
      for (const t of [c.endTone, ...(c.outcomes ?? []).map((o) => o.endTone)])
        if (t) endTones.set(t, (endTones.get(t) ?? 0) + 1)
    }
  for (const [t, n] of endTones)
    if (!toneSet.has(t))
      hard.push(`G endTone「${t}」被 ${n} 处选项引用，却不在 endings 里 → 触发后无对应结局定义（尾声/配图/图鉴全落空）`)

  // ── H. 封顶印记无人授予：ceilingUnlocks 的印记只能靠事件 flagsSet 发放（或开局自带），
  //      漏发则该属性永久卡在当前上限，且不会有任何报错——只是玩家永远摸不到 ──
  const grantedFlags = new Set<string>()
  for (const e of ev)
    for (const c of e.choices) {
      ;(c.flagsSet ?? []).forEach((f) => grantedFlags.add(f))
      for (const o of c.outcomes ?? []) (o.flagsSet ?? []).forEach((f) => grantedFlags.add(f))
    }
  for (const a of sc.attributes)
    for (const u of a.ceilingUnlocks ?? [])
      if (!grantedFlags.has(u.flag) && !openingFlags.has(u.flag))
        hard.push(
          `H 封顶印记「${u.flag}」(提升 ${a.key} 上限到 ${u.max}) 无任何事件授予、也不是开局印记 → ${a.key} 永久卡在 ${a.ceiling ?? a.max}`,
        )

  // ── I. 晋阶链自锁：授予 X 印记的事件若全部要求「先持有 X 或更晚一阶」，则该阶永远到不了，
  //      其后各阶连带断链 ──
  const ladderOrder = new Map<string, number>()
  for (const a of sc.attributes) (a.ceilingUnlocks ?? []).forEach((u, i) => ladderOrder.set(u.flag, i))
  for (const flag of ladderOrder.keys()) {
    if (openingFlags.has(flag)) continue
    const gs = ev.filter((e) =>
      e.choices.some(
        (c) => (c.flagsSet ?? []).includes(flag) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(flag)),
      ),
    )
    if (!gs.length) continue // 无人授予由 H 报，避免重复
    const allSelfLocked = gs.every((e) => {
      const held = [...(e.requires ?? '').matchAll(/has\(\s*([^)]+?)\s*\)/g)].map((m) => m[1])
      return held.some((h) => h === flag || (ladderOrder.get(h) ?? -1) > (ladderOrder.get(flag) ?? -1))
    })
    if (allSelfLocked)
      hard.push(`I 印记「${flag}」的授予事件全部要求先持有自身或更晚阶（${gs.map((e) => e.summary).join(' / ')}）→ 该阶永不可达`)
  }

  // ── J（已删）「门槛高于门控印记的封顶」：印记是累积持有的，只看该事件 requires 里列出的那几个
  //      会漏掉玩家同时持有的晋阶印记，实测在缥缈仙途误报 82 条。可达上限的完整口径已由
  //      content-check 的「阈值可行性」覆盖（attr>=V 对 ceilingUnlocks 顶档与 max 取大），不重复。 ──

  // ── K. 致死属性衰减可持续性（提示）：只靠衰减能否活满 maxTurns，须净回补多少 ──
  if (sc.maxTurns)
    for (const a of sc.attributes) {
      if (a.deathBelow === undefined || !a.decayPerTurn) continue
      const floor = a.initial - a.decayPerTurn * sc.maxTurns
      if (floor >= a.deathBelow) continue
      const mustGain = a.deathBelow + 1 - floor
      // 数「能给正值的事件个数」才是可行动面；把各事件正向量相加得到的上界（曾报 700+）无意义，
      // 因为一回合只抽一个事件。
      const granters = ev.filter((e) =>
        e.choices.some(
          (c) => (c.effects?.[a.key] ?? 0) > 0 || (c.outcomes ?? []).some((o) => (o.effects?.[a.key] ?? 0) > 0),
        ),
      )
      soft.push(
        `K 致死属性 ${a.key}(${a.name}) 初值 ${a.initial}、每回合衰减 ${a.decayPerTurn}、${sc.maxTurns} 回合后自然为 ${floor} → 想活满须净回补 ≥${mustGain}；池内能给该属性正值的 ${granters.length}/${ev.length} 个事件`,
      )
    }

  // ── L. 里程碑落在关键回合之外：keyMoment 事件只在关键回合出现（pickLocalEvent 的 phaseOk），
  //      minTurn 若晚于最后一个关键回合则该事件永不出现 ──
  if (sc.maxTurns) {
    const keys = keyMomentTurns(sc.maxTurns)
    const last = keys[keys.length - 1]
    for (const e of ev) {
      if (!e.keyMoment) continue
      if ((e.minTurn ?? 1) > last)
        hard.push(`L 里程碑「${e.summary}」minTurn ${e.minTurn} 超过最后一个关键回合 ${last} → 永不出现`)
      else if ((e.minTurn ?? 1) === last && !e.once)
        soft.push(`L 里程碑「${e.summary}」minTurn ${e.minTurn} 恰为最后一个关键回合，只有一次出场机会`)
    }
  }

  return { hard, soft }
}

// 内容逻辑审查（一次性扫描）：scenarioSchema 只校验语法/结构，不校验“引用完整性与可达性”。
// 本扫描覆盖运行期 schema 放过、但会造成“不可达结局/死事件/无效 effect”的内容逻辑缺陷。
import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { parseCondition, conditionAttrs, type Condition, type Clause } from '../engine/condition'

const clausesOf = (c: Condition): Clause[] => (c.kind === 'and' ? c.parts : [c])

describe('内容逻辑审查：跨剧本引用完整性与可达性', () => {
  const violations: string[] = []
  const notes: string[] = []

  for (const sc of builtinScenarios) {
    const tag = `[${sc.id}]`
    const attrByKey = new Map(sc.attributes.map((a) => [a.key, a]))
    const attrKeys = new Set(attrByKey.keys())

    // ── A. 结局条件 ──
    sc.endings.forEach((e, i) => {
      let cond: Condition
      try {
        cond = parseCondition(e.condition)
      } catch (err) {
        violations.push(`${tag} ending#${i} "${e.condition}" 解析失败: ${String(err)}`)
        return
      }
      // A1. 引用的属性必须存在（否则 evalClause 恒 false → 结局永不可达）
      for (const a of conditionAttrs(cond)) {
        if (!attrKeys.has(a)) violations.push(`${tag} ending#${i}(${e.tone}) 引用不存在属性 "${a}" → 该结局永不可达`)
      }
      // A2. 单子句越界（恒不可达）：>=v 但 v>max；<=v 但 v<0（属性被 clamp 到 [0,max]）
      const cmps = clausesOf(cond).filter((c): c is Extract<Clause, { kind: 'cmp' }> => c.kind === 'cmp')
      for (const c of cmps) {
        const a = attrByKey.get(c.attr)
        if (!a) continue
        if (c.op === '>=' && c.value > a.max) violations.push(`${tag} ending#${i}(${e.tone}) "${c.attr}>=${c.value}" 超过 max=${a.max} → 永不可达`)
        // 允许 value < deathBelow 的 <= 条件：这是"仅由 endTone 触发"的隐藏结局惯用模式（condition 永不自然成立）。
        // 只有 deathBelow 以上（含 0）且为负才算真正的越界无效。
        if (c.op === '<=' && c.value < 0 && (a.deathBelow === undefined || c.value >= a.deathBelow)) {
          violations.push(`${tag} ending#${i}(${e.tone}) "${c.attr}<=${c.value}" 低于下限 0 → 永不可达`)
        }
      }
      // A3. 同属性自相矛盾：lo>=L & lo<=H 且 L>H → 不可达
      const byAttr = new Map<string, { ge?: number; le?: number }>()
      for (const c of cmps) {
        const slot = byAttr.get(c.attr) ?? {}
        if (c.op === '>=') slot.ge = Math.max(slot.ge ?? -Infinity, c.value)
        else slot.le = Math.min(slot.le ?? Infinity, c.value)
        byAttr.set(c.attr, slot)
      }
      for (const [k, s] of byAttr) {
        if (s.ge !== undefined && s.le !== undefined && s.ge > s.le) violations.push(`${tag} ending#${i}(${e.tone}) "${k}" 区间矛盾 >=${s.ge} & <=${s.le} → 永不可达`)
      }
    })

    // ── B. 本地事件池 ──
    const ev = sc.localEvents ?? []
    // B0. summary 必须池内唯一：pickLocalEvent/once 去重与 generateScenario 都以 summary 为键，
    // 重复 summary 会让其中一个事件被永久去重吞掉（成为死内容）。
    const seenSummary = new Set<string>()
    ev.forEach((e, i) => {
      if (seenSummary.has(e.summary)) violations.push(`${tag} localEvent#${i} summary "${e.summary}" 重复 → 该事件被去重吞掉、永不触发`)
      seenSummary.add(e.summary)
    })
    // 道具可在「事件级」或「选项 outcomes 分支级」发放（引擎 applyChoice 两处都认）；两处都采集，否则移入 outcomes 的发放会被误判为不可达
    const grantedItems = new Set([
      ...ev.flatMap((e) => e.itemsGained ?? []),
      ...ev.flatMap((e) => e.choices.flatMap((c) => (c.outcomes ?? []).flatMap((o) => o.itemsGained ?? []))),
    ])
    ev.forEach((e, i) => {
      // B1. choices.effects 的 key 必须是已定义属性（否则写入幻影属性、目标属性纹丝不动）
      e.choices.forEach((ch, j) => {
        for (const k of Object.keys(ch.effects ?? {})) {
          if (!attrKeys.has(k)) violations.push(`${tag} localEvent#${i} choice#${j} effects 含未定义属性 "${k}" → 该 effect 无效`)
        }
      })
      // B2. requires 引用的属性必须存在（否则事件永不触发 → 死内容）
      if (e.requires) {
        try {
          for (const a of conditionAttrs(parseCondition(e.requires))) {
            if (!attrKeys.has(a)) violations.push(`${tag} localEvent#${i} requires "${e.requires}" 引用不存在属性 "${a}" → 事件永不触发`)
          }
        } catch (err) {
          violations.push(`${tag} localEvent#${i} requires "${e.requires}" 解析失败: ${String(err)}`)
        }
      }
      // B3. requiresItem 必须能被某事件 itemsGained 授予（否则本地模式永远无法持有 → 死事件）
      if (e.requiresItem && !grantedItems.has(e.requiresItem)) {
        violations.push(`${tag} localEvent#${i} requiresItem "${e.requiresItem}" 无任何事件授予 → 事件永不触发`)
      }
      // B4. 回合窗口：minTurn<=maxTurn 且都在 [1, maxTurns]
      if (e.minTurn !== undefined && e.maxTurn !== undefined && e.minTurn > e.maxTurn) violations.push(`${tag} localEvent#${i} minTurn ${e.minTurn} > maxTurn ${e.maxTurn} → 永不触发`)
      if (e.minTurn !== undefined && sc.maxTurns !== undefined && e.minTurn > sc.maxTurns) violations.push(`${tag} localEvent#${i} minTurn ${e.minTurn} > 剧本 maxTurns ${sc.maxTurns} → 永不触发`)
    })

    // ── D.（已退役）结局排序遮蔽校验。
    // checkEnding 已改为「满足的结局中取最具体者」（用 conditionImplies 择优，不再按数组顺序首中），
    // 过宽的结局不再遮蔽更具体的，作者也无须再为防遮蔽手工排序——故此校验取消。
    // isDeathEnding 保留供 E 节使用。
    const isDeathEnding = (cond: Condition): boolean => {
      const cs = clausesOf(cond)
      return cs.some(
        (c) => c.kind === 'cmp' && c.op === '<=' && (attrByKey.get(c.attr)?.deathBelow ?? -Infinity) >= c.value,
      )
    }
    // ── C. 本地模式可玩性：有事件池则至少要有非门控事件可抽（避免开局无事件可选）──
    if (ev.length > 0) {
      const ungated = ev.filter((e) => !e.requires && !e.requiresItem && (e.minTurn ?? 1) <= 1)
      if (ungated.length === 0) notes.push(`${tag} 本地事件池首回合无任何无门控事件可抽（全部带 requires/requiresItem/minTurn>1）`)
    }

    // ── E. 每个剧本至少要有一个“成功/存活”结局（非死亡、非 maxTurns 兜底），否则只能走向死亡/超时 ──
    const success = sc.endings.filter((e) => {
      const cond = parseCondition(e.condition)
      return !isDeathEnding(cond) && clausesOf(cond).some((c) => c.kind === 'cmp')
    })
    if (success.length === 0) violations.push(`${tag} 无任何“成功/存活”结局（仅死亡/超时）→ 玩家无正向目标`)

    // ── F. keyMoment「命运抉择」功能完整性：有本地事件池却无 keyMoment 事件，则该功能对此剧本是死的 ──
    if (ev.length > 0 && !ev.some((e) => e.keyMoment)) {
      notes.push(`${tag} 有本地事件池但无 keyMoment 事件 → “命运抉择”关键回合无专属大卡`)
    }
  }

  it('打印审查结果', () => {
    if (notes.length) console.log('\n— 提示（需人工判断，非硬错误）—\n' + notes.join('\n'))
    if (violations.length) console.log('\n— 违规（确定性逻辑缺陷）—\n' + violations.join('\n'))
    expect(violations).toEqual([])
  })

  it('所有内置剧本的结局条件可解析（含 has()）', () => {
    for (const sc of builtinScenarios)
      for (const e of sc.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
})

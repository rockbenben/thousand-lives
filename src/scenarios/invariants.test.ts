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
        if (c.op === '<=' && c.value < 0) violations.push(`${tag} ending#${i}(${e.tone}) "${c.attr}<=${c.value}" 低于下限 0 → 永不可达`)
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
    const grantedItems = new Set(ev.flatMap((e) => e.itemsGained ?? []))
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

    // ── D. 结局优先级遮蔽：generic 循环按数组顺序取首个命中。
    // 排除死亡型结局（attr<=deathBelow，由 checkEnding 的 dead 分支单独处理，不走 generic 循环）。
    // 若较晚的结局 B 蕴含较早的结局 A（B 成立则 A 必成立），则 B 永不可达（A 先命中）。
    // Norm 包含 has/!has 标记集合：hasReq = 必须持有的印记，hasNeg = 必须不持有的印记。
    // implies(B, A) 含义：B 成立则 A 必成立（A 是 B 的必要条件）。
    // 对标记而言：若 A 要求某印记但 B 不要求，则 B 可在不持该印记时成立，A 不一定成立 → 不蕴含。
    type Norm = { mt: boolean; ge: Map<string, number>; le: Map<string, number>; hasReq: Set<string>; hasNeg: Set<string> }
    const norm = (cond: Condition): Norm => {
      const n: Norm = { mt: false, ge: new Map(), le: new Map(), hasReq: new Set(), hasNeg: new Set() }
      for (const c of clausesOf(cond)) {
        if (c.kind === 'maxTurns') n.mt = true
        else if (c.kind === 'cmp') {
          if (c.op === '>=') n.ge.set(c.attr, Math.max(n.ge.get(c.attr) ?? -Infinity, c.value))
          else n.le.set(c.attr, Math.min(n.le.get(c.attr) ?? Infinity, c.value))
        } else if (c.kind === 'has') {
          // 记录 has()/!has() 约束，用于蕴含判断
          if (c.neg) n.hasNeg.add(c.flag)
          else n.hasReq.add(c.flag)
        }
      }
      return n
    }
    const implies = (B: Norm, A: Norm): boolean => {
      if (A.mt && !B.mt) return false
      for (const [k, v] of A.ge) if (!(B.ge.has(k) && B.ge.get(k)! >= v)) return false
      for (const [k, v] of A.le) if (!(B.le.has(k) && B.le.get(k)! <= v)) return false
      // 若 A 要求持有某印记，但 B 未要求持有（或 B 明确否定该印记），则 B 不蕴含 A
      for (const f of A.hasReq) if (!B.hasReq.has(f)) return false
      // 若 A 要求不持有某印记，但 B 未要求不持有（或 B 明确要求持有），则 B 不蕴含 A
      for (const f of A.hasNeg) if (!B.hasNeg.has(f)) return false
      return true
    }
    const isDeathEnding = (cond: Condition): boolean => {
      const cs = clausesOf(cond)
      return cs.some(
        (c) => c.kind === 'cmp' && c.op === '<=' && (attrByKey.get(c.attr)?.deathBelow ?? -Infinity) >= c.value,
      )
    }
    const generic = sc.endings
      .map((e, idx) => ({ e, idx, cond: parseCondition(e.condition) }))
      .filter((x) => !isDeathEnding(x.cond))
    for (let bi = 0; bi < generic.length; bi++) {
      for (let ai = 0; ai < bi; ai++) {
        if (implies(norm(generic[bi].cond), norm(generic[ai].cond))) {
          violations.push(
            `${tag} ending#${generic[bi].idx}(${generic[bi].e.tone}) 被更靠前的 ending#${generic[ai].idx}(${generic[ai].e.tone}) 遮蔽 → 永不可达（应把更严格的结局排在前面）`,
          )
          break
        }
      }
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

export type Clause =
  | { kind: 'maxTurns' }
  | { kind: 'has'; flag: string; neg: boolean }
  | { kind: 'cmp'; attr: string; op: '<=' | '>='; value: number }

// 条件 = 一个或多个子句的「与」（用 & 连接）。单子句时 parts 仅一项。
export type Condition = Clause | { kind: 'and'; parts: Clause[] }

function parseClause(input: string): Clause {
  const s = input.trim()
  if (s === 'maxTurns') return { kind: 'maxTurns' }
  const h = s.match(/^(!?)has\(\s*([^)]+?)\s*\)$/)
  if (h) return { kind: 'has', flag: h[2], neg: h[1] === '!' }
  const m = s.match(/^([a-z][a-zA-Z0-9_]*)\s*(<=|>=)\s*(-?\d+)$/)
  if (!m) throw new Error(`无法解析结局条件: ${input}`)
  return { kind: 'cmp', attr: m[1], op: m[2] as '<=' | '>=', value: Number(m[3]) }
}

export function parseCondition(input: string): Condition {
  const parts = input.split('&').map((p) => p.trim()).filter(Boolean)
  if (parts.length === 0) throw new Error(`无法解析结局条件: ${input}`)
  if (parts.length === 1) return parseClause(parts[0])
  return { kind: 'and', parts: parts.map(parseClause) }
}

function evalClause(
  c: Clause,
  attrs: Record<string, number>,
  completedTurns: number,
  maxTurns: number | undefined,
  flags: string[],
): boolean {
  if (c.kind === 'maxTurns') return maxTurns !== undefined && completedTurns >= maxTurns
  if (c.kind === 'has') {
    const present = flags.includes(c.flag)
    return c.neg ? !present : present
  }
  // 伪属性 `turn`：解析为当前已完成回合数，供结局加「最早触发回合」门（如 name<=4 & turn>=18，
  // 避免低值早结局在开局数回合就猝死、给玩家恢复窗口）。非真实属性，不参与属性存在性校验。
  const v = c.attr === 'turn' ? completedTurns : attrs[c.attr]
  if (v === undefined) return false
  return c.op === '<=' ? v <= c.value : v >= c.value
}

export function evalCondition(
  c: Condition,
  attrs: Record<string, number>,
  completedTurns: number,
  maxTurns: number | undefined,
  flags: string[] = [],
): boolean {
  if (c.kind === 'and')
    return c.parts.every((p) => evalClause(p, attrs, completedTurns, maxTurns, flags))
  return evalClause(c, attrs, completedTurns, maxTurns, flags)
}

// 提取条件中引用的所有属性 key（供 import 校验属性是否存在）
export function conditionAttrs(c: Condition): string[] {
  const clauses = c.kind === 'and' ? c.parts : [c]
  // 排除伪属性 `turn`（回合门，非剧本属性）——否则属性存在性校验会误判其不存在。
  return clauses.flatMap((p) => (p.kind === 'cmp' && p.attr !== 'turn' ? [p.attr] : []))
}

// 把条件归一为各维度约束集合，用于「蕴含/区域包含」判断。
type Norm = { mt: boolean; ge: Map<string, number>; le: Map<string, number>; hasReq: Set<string>; hasNeg: Set<string> }
function normalize(c: Condition): Norm {
  const n: Norm = { mt: false, ge: new Map(), le: new Map(), hasReq: new Set(), hasNeg: new Set() }
  for (const p of c.kind === 'and' ? c.parts : [c]) {
    if (p.kind === 'maxTurns') n.mt = true
    else if (p.kind === 'cmp') {
      if (p.op === '>=') n.ge.set(p.attr, Math.max(n.ge.get(p.attr) ?? -Infinity, p.value))
      else n.le.set(p.attr, Math.min(n.le.get(p.attr) ?? Infinity, p.value))
    } else if (p.kind === 'has') (p.neg ? n.hasNeg : n.hasReq).add(p.flag)
  }
  return n
}

// a 成立则 b 必成立（a 的满足区域 ⊆ b）——即 a「至少和 b 一样严格」。保守可靠（只认必要条件，不会误判蕴含）。
// 用途：结局择优——满足的结局里取「最具体」者（不被更严结局严格蕴含者），使数组顺序不再造成遮蔽。
export function conditionImplies(a: Condition, b: Condition): boolean {
  const A = normalize(a)
  const B = normalize(b)
  if (B.mt && !A.mt) return false
  for (const [k, v] of B.ge) if (!(A.ge.has(k) && A.ge.get(k)! >= v)) return false
  for (const [k, v] of B.le) if (!(A.le.has(k) && A.le.get(k)! <= v)) return false
  for (const f of B.hasReq) if (!A.hasReq.has(f)) return false
  for (const f of B.hasNeg) if (!A.hasNeg.has(f)) return false
  return true
}

// 条件的满足域是否非空。属性钳在 [0, max]（见 state.clampEffects），`turn`/已完成回合数亦不为负，
// 故 `attr<=负数`、`attr>max`、同一属性上下界交叉、印记既要又要，都使该结局在任何状态下都不成立。
// caps 传该剧本各属性的上限；未收录的键（如伪属性 turn）按无上界处理。
export function conditionSatisfiable(c: Condition, caps: Record<string, number> = {}): boolean {
  const n = normalize(c)
  for (const f of n.hasReq) if (n.hasNeg.has(f)) return false
  for (const k of [...n.ge.keys(), ...n.le.keys()]) {
    const lo = Math.max(0, n.ge.get(k) ?? 0)
    const hi = Math.min(n.le.get(k) ?? Infinity, caps[k] ?? Infinity)
    if (lo > hi) return false
  }
  return true
}

// ── 区域覆盖：判断「目标域是否被若干子域的并集穷尽」 ─────────────────────────────
// conditionImplies 只能证明「目标 ⊆ 单个子域」。现实中常见多条结局分段合起来盖住一条：
// art 70~84 归三个开局变体、85 以上归另一条——单看谁都盖不住，合起来盖死了。
// 做法是递归切分：每步挑一个能把目标切开的轴（数值上下界 / 印记有无 / maxTurns 有无），
// 两半都必须被盖住才算盖住。切分对整数域穷尽无重叠，故结论可靠；结局条件只有三五个轴，
// 实际几十次递归即收敛，depth 只是防御性上界。
export type Region = {
  mt: 0 | 1 | 2 // 0 不限、1 要求满期、2 要求未满期
  ge: Map<string, number>
  le: Map<string, number>
  hasReq: Set<string>
  hasNeg: Set<string>
}

export function regionOf(c: Condition): Region {
  const r: Region = { mt: 0, ge: new Map(), le: new Map(), hasReq: new Set(), hasNeg: new Set() }
  for (const p of c.kind === 'and' ? c.parts : [c]) {
    if (p.kind === 'maxTurns') r.mt = 1
    else if (p.kind === 'cmp') {
      if (p.op === '>=') r.ge.set(p.attr, Math.max(r.ge.get(p.attr) ?? -Infinity, p.value))
      else r.le.set(p.attr, Math.min(r.le.get(p.attr) ?? Infinity, p.value))
    } else if (p.kind === 'has') (p.neg ? r.hasNeg : r.hasReq).add(p.flag)
  }
  return r
}

const withBounds = (r: Region, ge: [string, number][], le: [string, number][], flags?: { req?: string; neg?: string }): Region => {
  const n = { mt: r.mt, ge: new Map(r.ge), le: new Map(r.le), hasReq: new Set(r.hasReq), hasNeg: new Set(r.hasNeg) }
  for (const [k, v] of ge) n.ge.set(k, Math.max(n.ge.get(k) ?? -Infinity, v))
  for (const [k, v] of le) n.le.set(k, Math.min(n.le.get(k) ?? Infinity, v))
  if (flags?.req) n.hasReq.add(flags.req)
  if (flags?.neg) n.hasNeg.add(flags.neg)
  return n
}

export function regionEmpty(r: Region, caps: Record<string, number>): boolean {
  for (const f of r.hasReq) if (r.hasNeg.has(f)) return true
  for (const k of [...r.ge.keys(), ...r.le.keys()]) {
    const lo = Math.max(0, r.ge.get(k) ?? 0)
    const hi = Math.min(r.le.get(k) ?? Infinity, caps[k] ?? Infinity)
    if (lo > hi) return true
  }
  return false
}

// a ⊆ b：a 成立则 b 必成立
export function regionImplies(a: Region, b: Region): boolean {
  if (b.mt !== 0 && a.mt !== b.mt) return false
  for (const [k, v] of b.ge) if (!(a.ge.has(k) && a.ge.get(k)! >= v)) return false
  for (const [k, v] of b.le) if (!(a.le.has(k) && a.le.get(k)! <= v)) return false
  for (const f of b.hasReq) if (!a.hasReq.has(f)) return false
  for (const f of b.hasNeg) if (!a.hasNeg.has(f)) return false
  return true
}

/** target 是否被 parts 的并集完全盖住。空 target 视为已盖住（无从谈起）。 */
export function regionCoveredBy(target: Region, parts: Region[], caps: Record<string, number>, depth = 24): boolean {
  if (regionEmpty(target, caps)) return true
  if (parts.some((p) => regionImplies(target, p))) return true
  if (depth <= 0) return false
  // 二切分对整数域穷尽（A∪B 恰为 t），故选哪根轴结论都一样，不必回溯试别的切法；
  // 唯一要避开的是「一半为空、另一半没变」的退化切分——它不推进，会把递归深度白白耗光。
  for (const [a, b] of splitsOf(target, parts)) {
    const key = regionKey(target)
    const emptyA = regionEmpty(a, caps)
    const emptyB = regionEmpty(b, caps)
    if ((emptyB && regionKey(a) === key) || (emptyA && regionKey(b) === key)) continue
    return regionCoveredBy(a, parts, caps, depth - 1) && regionCoveredBy(b, parts, caps, depth - 1)
  }
  return false
}

const regionKey = (r: Region) =>
  [
    r.mt,
    [...r.ge].sort().map(([k, v]) => `${k}>=${v}`).join(','),
    [...r.le].sort().map(([k, v]) => `${k}<=${Number.isFinite(v) ? v : 'inf'}`).join(','),
    [...r.hasReq].sort().join('+'),
    [...r.hasNeg].sort().join('-'),
  ].join('|')

// 列出所有能把 t 切一刀的候选：每个候选子域上，凡 t 尚未跟上的约束轴都产生一次二分。
function splitsOf(t: Region, parts: Region[]): [Region, Region][] {
  const out: [Region, Region][] = []
  for (const p of parts) {
    for (const [k, v] of p.le) if (!(t.le.has(k) && t.le.get(k)! <= v)) out.push([withBounds(t, [], [[k, v]]), withBounds(t, [[k, v + 1]], [])])
    for (const [k, v] of p.ge) if (!(t.ge.has(k) && t.ge.get(k)! >= v)) out.push([withBounds(t, [[k, v]], []), withBounds(t, [], [[k, v - 1]])])
    for (const f of p.hasReq) if (!t.hasReq.has(f) && !t.hasNeg.has(f)) out.push([withBounds(t, [], [], { req: f }), withBounds(t, [], [], { neg: f })])
    for (const f of p.hasNeg) if (!t.hasNeg.has(f) && !t.hasReq.has(f)) out.push([withBounds(t, [], [], { neg: f }), withBounds(t, [], [], { req: f })])
    if (p.mt !== 0 && t.mt === 0)
      out.push([
        { ...t, mt: p.mt },
        { ...t, mt: p.mt === 1 ? 2 : 1 },
      ])
  }
  return out
}

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

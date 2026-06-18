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
  const v = attrs[c.attr]
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
  return clauses.flatMap((p) => (p.kind === 'cmp' ? [p.attr] : []))
}

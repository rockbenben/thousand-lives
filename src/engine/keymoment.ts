// 关键抉择（命运转折点）：约每 4 回合一个、终局必为其一，全程约 maxTurns/4 次，
// 节点更密、剧情卡更多，又不至于回回都是。这些回合属性摆动更大、叙事更具分量。
export function keyMomentTurns(maxTurns: number): number[] {
  if (maxTurns <= 1) return [1]
  const n = Math.max(2, Math.round(maxTurns / 4))
  const ts = Array.from({ length: n }, (_, i) =>
    Math.max(1, Math.round(((i + 1) / n) * maxTurns)),
  )
  return [...new Set(ts)]
}

// 关键节点的序号（第几个命运抉择，从 0 起）；非关键回合返回 -1。用于给剧情卡分配专属配图。
// 节点的「名称」直接用该回合事件的 summary（内容化、各不相同），不在此另取位置名。
export function keyMomentIndex(turnNo: number, maxTurns: number): number {
  return keyMomentTurns(maxTurns).indexOf(turnNo)
}

export function isKeyMoment(turnNo: number, maxTurns: number): boolean {
  return keyMomentTurns(maxTurns).includes(turnNo)
}

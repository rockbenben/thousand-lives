import type { Scenario } from '../scenarios/schema'
import type { GameState } from './types'
import { gradeRun } from './grade'

export function buildSummaryCard(sc: Scenario, st: GameState, endingText: string): string {
  const picks = st.history
    .filter((_, i) => i % 5 === 0 || i === st.history.length - 1)
    .map((t) => `· ${t.summary}（${t.choiceText}）`)
  const grade = gradeRun(sc, st)
  const lines = [
    `《千世书 · ${sc.title}》`,
    `结局：${st.ended?.tone ?? '进行中'} — 历经 ${st.history.length} ${sc.turnUnit}`,
    `评价：${grade.rating} 级`,
    ...(st.fateHighlight ? [`命运：${st.fateHighlight.text}`] : []),
    `最终属性：${sc.attributes.map((a) => `${a.name} ${st.attributes[a.key]}`).join(' / ')}`,
    '',
    '关键抉择：',
    ...picks,
  ]
  if (endingText) lines.push('', endingText)
  return lines.join('\n')
}

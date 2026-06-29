import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'

// 取「命运无常」类文案破折号前的引子（「天降横财——…」→「天降横财」）
function lead(s: string): string {
  const i = s.indexOf('——')
  return i > 0 ? s.slice(0, i) : s
}

// 结果定制 + 好奇缺口的挑衅式钩子问句——勾人点开同款开局来玩。
export function hookQuestion(sc: Scenario, st: GameState): string {
  const fh = st.fateHighlight
  if (fh?.kind === 'disaster') {
    return `我在「${sc.title}」撞上「${lead(fh.text)}」满盘皆崩——换你，这一劫躲得过吗？`
  }
  if (fh?.kind === 'windfall') {
    return `我在「${sc.title}」天降「${lead(fh.text)}」一步登天——你有这命数吗？`
  }
  const tone = st.ended?.tone
  const turns = st.history.length
  if (tone) {
    return `我在「${sc.title}」走到了「${tone}」(历${turns}${sc.turnUnit})——同样的开局，换你能走出什么结局？`
  }
  return `我正在「${sc.title}」里改写命运——换你，这一生会怎么走？`
}

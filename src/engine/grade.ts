import type { Scenario } from '../scenarios/schema'
import type { GameState } from './types'

export interface RunGrade {
  rating: 'S' | 'A' | 'B' | 'C' | 'D'
  title: string
}

// 由最终状态评出称号与评级，供结局页/分享卡使用。剧本无关、纯函数。
export function gradeRun(sc: Scenario, st: GameState): RunGrade {
  const tone = st.ended?.tone ?? '落幕'
  const ratios = sc.attributes.map((a) => {
    const v = st.attributes[a.key]
    return a.max > 0 && Number.isFinite(v) ? Math.min(1, Math.max(0, v / a.max)) : 0
  })
  const avg = ratios.length ? ratios.reduce((s, r) => s + r, 0) / ratios.length : 0
  const surv = sc.maxTurns > 0 ? Math.min(1, st.history.length / sc.maxTurns) : 0
  // 走得越久 + 最终属性越健康 → 分越高
  const score = surv * 0.5 + avg * 0.5
  const rating: RunGrade['rating'] =
    score >= 0.82 ? 'S' : score >= 0.66 ? 'A' : score >= 0.5 ? 'B' : score >= 0.34 ? 'C' : 'D'

  // 称号直接用结局基调本身——它本就是完整称谓（如「权倾朝野·一手遮天」），
  // 不再叠加属性档位前缀，避免出现三段式或与基调重复的怪称号
  return { rating, title: tone }
}

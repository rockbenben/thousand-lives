// 目标进度的定性阶段：AI 逐回合估的 goalProgress（0~100）本就主观、不宜当精确百分比展示。
// 归到 5 档粗粒度阶段，配合 state.nextProgress 的棘轮平滑，阶段稳步前进、不闪退。
export const GOAL_STAGES = ['尚未起步', '略有进展', '渐入佳境', '近在咫尺', '已达成'] as const

// step：0~4，用于粗粒度进度条填充（step/4）；label：阶段文案。
export function goalStage(progress: number): { label: string; step: number } {
  const step = progress >= 100 ? 4 : progress >= 75 ? 3 : progress >= 45 ? 2 : progress >= 15 ? 1 : 0
  return { label: GOAL_STAGES[step], step }
}

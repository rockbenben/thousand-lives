export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface Choice {
  text: string
  effects: Record<string, number>
  // 选择后他人的即时反馈（本地事件可选）
  reaction?: string
}

export interface TurnResult {
  narrative: string
  choices: Choice[]
  summary: string
  // 本回合获得/失去的物品（AI 生成，可选）
  itemsGained?: string[]
  itemsLost?: string[]
  // 玩家自定义行动的属性结算（仅自定义行动的解析回合返回）
  actionEffects?: Record<string, number>
  // AI 托管推荐选项下标（该角色最可能的选择）
  recommend?: number
  // 本回合产生的、需长期记住的关键事实（结识的人物、立下的誓、背叛、世界设定等），注入后续每回合保持长篇一致
  memoryAdd?: string[]
  // AI 对「玩家离既定目标有多近」的估计（0~100）；仅在玩家设了目标时返回
  goalProgress?: number
}

export interface TurnRecord {
  narrative: string
  choiceText: string
  summary: string
  // 该回合所选行动引发的他人即时反馈（本地事件可选）
  reaction?: string
  // 「命运无常」偶发转折：同一选择有时结果好于/坏于预期（仅本地模式触发）
  twist?: string
}

export interface Ending {
  tone: string
  reason: string
}

export interface GameState {
  scenarioId: string
  attributes: Record<string, number>
  history: TurnRecord[]
  inventory: string[]
  opening?: string
  // 玩家设定的野心/目标，贯穿全程注入剧情走向
  ambition?: string
  // 'local' = 无需 AI 的本地事件模式；缺省视为 'ai'（向后兼容旧存档）
  mode?: 'ai' | 'local'
  // 记忆栏：贯穿全程的关键事实（AI 模式由模型逐回合补充），注入每回合提示以维持长篇一致
  memory?: string[]
  // 目标进度（0~100）：AI 模式下由模型逐回合评估玩家离 ambition 有多近，供 UI 展示
  goalProgress?: number
  // 印记：隐藏的具名状态（身份/机缘/因果种子），门控事件、结局、属性封顶
  flags?: string[]
  ended?: Ending
}

import type { Scenario } from '../scenarios/schema'
import type { GameState, TurnResult } from '../engine/types'
import type { AIConfig } from './types'
import { localTurn } from '../engine/local'
import { buildTurnMessages } from '../engine/prompt'
import { requestTurn } from './client'
import { visibleNarrative } from './turn'

// 回合内容的来源（TurnSource）：把「AI 在线生成」与「免 Key 本地事件池」统一到一个契约后，
// Play 只依赖这层能力声明，不再到处 `mode === 'local'` 散落分支。新增一种来源（如脚本回放、
// 另一套后端）只需再实现一个 TurnSource，UI 无需改动。
export interface TurnRequest {
  scenario: Scenario
  state: GameState
  // 自定义行动结算：玩家输入的行动文本（仅 supportsCustomAction 的来源会传）
  resolvingAction?: string
  // 自定义行动结算：行动发生时的当前场景正文，供来源还原情境
  sceneNarrative?: string
  // 流式来源逐字回调「可见正文」；非流式来源忽略
  onStream?: (visible: string) => void
  // 在途中断信号；非流式来源忽略
  signal?: AbortSignal
}

export interface TurnSource {
  readonly mode: 'ai' | 'local'
  // 是否流式产出：true 则 Play 显示「落笔中」并接收逐字回调，落盘后跳过打字机（已实时展示过）；
  // false 则即时产出、不显示加载态，交由打字机动画呈现
  readonly streaming: boolean
  // 是否支持「自由行动」（自定义文字行动需模型裁定，本地事件池无此能力）
  readonly supportsCustomAction: boolean
  // 落子时注入的随机源：本地注入「命运无常」偶然性，AI 返回 undefined（模型自带变数）
  readonly choiceRng: (() => number) | undefined
  generate(req: TurnRequest): Promise<TurnResult>
}

// 免 Key 本地模式：从剧本事件池同步产出下一回合，忽略流式与中断
export function localSource(): TurnSource {
  return {
    mode: 'local',
    streaming: false,
    supportsCustomAction: false,
    choiceRng: Math.random,
    generate: (req) => Promise.resolve(localTurn(req.scenario, req.state)),
  }
}

// AI 在线模式：走网络流式生成；getConfig 在每次请求时取最新配置，缺失即抛错（保持原有提示）
export function aiSource(getConfig: () => AIConfig): TurnSource {
  return {
    mode: 'ai',
    streaming: true,
    supportsCustomAction: true,
    choiceRng: undefined,
    generate: async (req) =>
      requestTurn(
        getConfig(),
        buildTurnMessages(req.scenario, req.state, req.resolvingAction, req.sceneNarrative),
        undefined,
        req.onStream ? (t) => req.onStream!(visibleNarrative(t)) : undefined,
        req.signal,
      ),
  }
}

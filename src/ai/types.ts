export type Provider = 'openai' | 'anthropic' | 'gemini'

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high'

export interface AIConfig {
  provider: Provider
  baseURL?: string
  apiKey: string
  model: string
  /** 设置页选中的服务商预设，仅用于恢复 UI 状态 */
  presetId?: string
  /**
   * 思考强度，缺省按 'off'。真正发什么参数由 thinkingWireFor 逐 SKU 决定 ——
   * 有的厂商没有关闭值，'off' 在那里只能是「最低档」（仍在推理、仍在计费）。
   */
  thinkingLevel?: ThinkingLevel
  /**
   * CORS 中转地址；空/缺省 = 直连。
   *
   * 有些服务商不给浏览器发 CORS 头（预检 404 之类），直连在浏览器里根本发不出去
   * ——它们在目录里标着 directBlocked，默认就开着这一项。
   *
   * ⚠ 开了之后，你的 API key 与完整 prompt 会经过这台中转再到服务商。中转只
   * 转发不留存，但"经过"这件事本身是真的 —— 在意的话自建一个（见 README）。
   */
  proxy?: string
}

export class AIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

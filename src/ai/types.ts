export type Provider = 'openai' | 'anthropic' | 'gemini'

export interface AIConfig {
  provider: Provider
  baseURL?: string
  apiKey: string
  model: string
  /** 设置页选中的服务商预设，仅用于恢复 UI 状态 */
  presetId?: string
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

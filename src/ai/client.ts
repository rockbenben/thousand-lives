import { ZodError } from 'zod'
import { AIError, type AIConfig } from './types'
import type { ChatMessage, TurnResult } from '../engine/types'
import { chatOpenAI, chatAnthropic, chatGemini, type OnDelta } from './adapters'
import { parseTurnResult } from './turn'

export type ChatFn = (
  cfg: AIConfig,
  messages: ChatMessage[],
  onDelta?: OnDelta,
  signal?: AbortSignal,
) => Promise<string>

export const chat: ChatFn = (cfg, messages, onDelta, signal) => {
  switch (cfg.provider) {
    case 'openai':
      return chatOpenAI(cfg, messages, onDelta, signal)
    case 'anthropic':
      return chatAnthropic(cfg, messages, onDelta, signal)
    case 'gemini':
      return chatGemini(cfg, messages, onDelta, signal)
  }
}

// fetch 被 abort 时抛出 name === 'AbortError' 的 DOMException
export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export async function requestTurn(
  cfg: AIConfig,
  messages: ChatMessage[],
  chatFn: ChatFn = chat,
  onDelta?: OnDelta,
  signal?: AbortSignal,
): Promise<TurnResult> {
  const first = await chatFn(cfg, messages, onDelta, signal)
  try {
    return parseTurnResult(first)
  } catch (e) {
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant', content: first },
      {
        role: 'user',
        content: `你上一条输出格式不对（${e instanceof Error ? e.message : String(e)}）。请重新输出：先直接给出纯文本剧情正文，然后另起一行输出仅含 choices 与 summary 的 JSON 对象，JSON 前后不要围栏或其他文字。`,
      },
    ]
    return parseTurnResult(await chatFn(cfg, retryMessages, onDelta, signal))
  }
}

export function friendlyError(e: unknown): string {
  if (e instanceof AIError) {
    if (e.status === 401 || e.status === 403) return 'API Key 无效或无权限（401/403），请检查配置'
    if (e.status === 429) return '请求过于频繁或额度不足（429），请稍候重试'
    if (e.status >= 500) return `AI 服务端错误（${e.status}），请稍候重试`
    return `请求失败（${e.status}）：${e.message.slice(0, 200)}`
  }
  if (e instanceof TypeError) {
    return '网络错误，或该服务不支持浏览器直连（CORS）。可改用 OpenRouter 等支持浏览器调用的服务。'
  }
  if (e instanceof ZodError) {
    // AI 产出不符合契约（如生成的剧本字段非法）：给可读字段提示，而非原始多行 JSON
    const issue = e.issues[0]
    return issue ? `AI 返回的数据格式不对 · ${issue.path.join('.') || '(根)'}：${issue.message}` : 'AI 返回的数据格式不对'
  }
  return `发生错误：${e instanceof Error ? e.message : String(e)}`
}

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

/** 不重试的一次调用。连接测试用它 —— 那里的意义就是把失败原样报出来。 */
export const chatOnce: ChatFn = (cfg, messages, onDelta, signal) => {
  switch (cfg.provider) {
    case 'openai':
      return chatOpenAI(cfg, messages, onDelta, signal)
    case 'anthropic':
      return chatAnthropic(cfg, messages, onDelta, signal)
    case 'gemini':
      return chatGemini(cfg, messages, onDelta, signal)
  }
}

/**
 * 值得重试的失败：限流、服务端错误、连不上。
 * 判据抄自上游（408/425 是代理与负载均衡会吐的两个「可重试 4xx」）。
 *
 * 明确【不】重试的：
 *   · 401/403 —— key 不对，再试一次还是不对，只是让用户多等
 *   · abort —— 用户自己取消的
 *   · 其余 4xx —— 请求本身有问题（模型名错、参数不收），重试必然同样失败
 */
function worthRetrying(e: unknown): boolean {
  if (isAbortError(e)) return false
  if (!(e instanceof AIError)) return e instanceof TypeError // 网络层失败（含 CORS）
  const { status } = e
  return !status || status >= 500 || status === 429 || status === 408 || status === 425
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })

/**
 * 游戏路径的默认入口：瞬时故障自动重试【一次】。
 *
 * 只重试一次而不是三次：用户正盯着进度条等，多等一轮已是上限；限流真的持续时，
 * 重试再多也只是把等待拉长，不如把错误交给用户（friendlyError 已有 429 的专门文案）。
 *
 * ⚠ 已经吐出过内容就不重试：onDelta 传的是【累计文本】，重试会从空串重新开始，
 * 界面上表现为写了一半的段落突然倒回去重写。宁可把这次的失败交给用户。
 */
export const chat: ChatFn = async (cfg, messages, onDelta, signal) => {
  let emitted = false
  const track: OnDelta | undefined = onDelta && ((text) => {
    emitted = true
    onDelta(text)
  })
  try {
    return await chatOnce(cfg, messages, track, signal)
  } catch (e) {
    if (emitted || !worthRetrying(e)) throw e
    // 限流多等一会儿；其余的等一下就够，故障多半是瞬时的
    await sleep(e instanceof AIError && e.status === 429 ? 2000 : 800, signal)
    return chatOnce(cfg, messages, onDelta, signal)
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
    if (e.status === 401) return 'API Key 无效或无权限（401），请检查配置'
    // 403 不一定是 key 的事：开着 CORS 中转时，那台按 host 白名单转发，自建 /
    // 局域网地址不在名单里回的就是 403 —— 只说「检查 Key」会把人支到错的方向。
    if (e.status === 403) return 'API Key 无效或无权限（403）；若开着 CORS 中转，也可能是它不转发这个地址'
    if (e.status === 429) return '请求过于频繁或额度不足（429），请稍候重试'
    if (e.status >= 500) return `AI 服务端错误（${e.status}），请稍候重试`
    return `请求失败（${e.status}）：${e.message.slice(0, 200)}`
  }
  if (e instanceof TypeError) {
    // 修法就在同一个面板里：打开「CORS 中转」。原来这句让人改用别家服务 —— 那是
    // 还没有中转时的建议，留着等于把用户从一个勾选框支去换服务商。
    return '网络错误，或该服务不支持浏览器直连（CORS）。可在配置里打开「CORS 中转」再试一次。'
  }
  if (e instanceof ZodError) {
    // AI 产出不符合契约（如生成的剧本字段非法）：给可读字段提示，而非原始多行 JSON
    const issue = e.issues[0]
    return issue ? `AI 返回的数据格式不对 · ${issue.path.join('.') || '(根)'}：${issue.message}` : 'AI 返回的数据格式不对'
  }
  return `发生错误：${e instanceof Error ? e.message : String(e)}`
}

import { AIError, type AIConfig } from './types'
import type { ChatMessage } from '../engine/types'
import { canDisableThinking, thinkingWireFor } from './presets'
import { isHttpUrl } from '../utils/url'

/**
 * 开思考时 Claude 的输出上限。thinking.budget_tokens 必须【小于】max_tokens，
 * 而目录给的预算是按上游同样的 16384 反推的 —— 这两个数是配套的，改一个就要
 * 核另一个（presets.test.ts 里有条不变量钉着）。不开思考时用 2048 就够。
 */
export const THINKING_MAX_TOKENS = 16384

/**
 * 这一轮是否真的开着思考 —— 用来决定要不要抬高 Claude 的 max_tokens。
 *
 * 「选了关」不等于「真关了」：有的型号根本关不掉（官方逐模型表标 Always on，
 * 发关闭值直接 400）。这种情况下服务端照样思考，思考 token 计入 max_tokens ——
 * 按不思考的额度发会被 stop_reason:"max_tokens" 截断。
 *
 * ⚠ 判据与界面上那句「仍会推理、仍会计费」共用同一个 canDisableThinking：传输层
 * 与界面必须是同一个事实，否则会出现「界面说关了、请求却按思考的额度发」。
 */
function thinkingOn(cfg: AIConfig): boolean {
  const level = cfg.thinkingLevel ?? 'off'
  if (level !== 'off') return Boolean(thinkingWireFor(cfg.presetId, cfg.model, level))
  return !canDisableThinking(cfg.presetId, cfg.model)
}

export type OnDelta = (textSoFar: string) => void

// 以 SSE 流式发起请求，把每个 data 行交给 onData；非 2xx 时抛 AIError
/**
 * 套上中转前缀。契约与 legend-talk 的那台 worker 一致：路径就是完整目标 URL，
 * worker 侧按 host 白名单校验后转发（目标由部署方声明，不由调用方自带）。
 * 没配中转就原样返回。
 */
function viaProxy(url: string, proxy?: string): string {
  const p = proxy?.trim().replace(/\/+$/, '')
  if (!p) return url
  // ⚠ 漏写 https:// 时拼出来的是【相对地址】：浏览器按本站域名解析，于是 API Key
  // 与整段 prompt 被 POST 到自己站上（同源，连预检都不会拦），只留下一个 404 和
  // 一行带 Key 的访问日志。界面已经把它标红，但标红只是提示 —— 真正不让它发出去
  // 得在这里挡。
  // 用 400 而不是 0：这是配置错，重试一次还是同样的错（0 会被判成可重试）
  if (!isHttpUrl(p)) throw new AIError(400, `中转地址不是完整的网址（要带 https://）：${p}`)
  return `${p}/${url}`
}

/**
 * 挂住超时：连接卡死时抛错，而不是让进度条永远转。分两段，因为两段的正常
 * 等待时间差一个数量级 ——
 *   · 出字之前：连上、排队、思考模型想很久（高档思考跑到一两分钟是正常的），给足；
 *     这一段【连 fetch 本身也算】—— 握手完成但响应头永不到达时浏览器不会自己超时，
 *     没有这道闸就是最典型的「转圈到天荒地老」。
 *   · 出字之后：token 间隔只有几秒，超过一分钟基本就是流断了而 TCP 还没察觉。
 * 不设【总时长】上限：长回复本来就该跑很久，按总时长砍会砍掉正常输出。
 */
const FIRST_BYTE_TIMEOUT_MS = 180_000
const IDLE_TIMEOUT_MS = 60_000
const STALL_FIRST = `连接卡住了：${FIRST_BYTE_TIMEOUT_MS / 1000} 秒没有开始出内容`
const STALL_IDLE = `连接卡住了：${IDLE_TIMEOUT_MS / 1000} 秒没有收到新内容`

/**
 * 与一个计时器赛跑。超时抛 AIError(0) → friendlyError 归到「发生错误」，而 chat
 * 的重试判据认它可重试（无 status）。计时器无论哪条路径都清掉。
 */
async function raceDeadline<T>(work: Promise<T>, ms: number, msg: string, onTimeout?: () => void): Promise<T> {
  work.catch(() => {}) // 计时器先赢时它可能稍后带错拒绝，别变成 unhandled rejection
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout?.()
          reject(new AIError(0, msg))
        }, ms)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

async function postStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  // 返回值 = 这一行有没有带来【真正的内容】。心跳、[DONE]、Claude 的 message_start
  // 也会走到这里，但它们不算「开始出字」——见下面两段窗口的分界。
  onData: (data: string) => boolean,
  signal?: AbortSignal,
): Promise<void> {
  // 自己这条 AbortController：超时后要真的把请求掐掉。只抛错不掐的话，服务端会
  // 继续生成、继续计费，而 chat 已经按「可重试」开了第二条 —— 两条一起烧额度。
  const ac = new AbortController()
  if (signal) {
    if (signal.aborted) ac.abort(signal.reason)
    else signal.addEventListener('abort', () => ac.abort(signal.reason), { once: true })
  }
  // ⚠ 一个【时刻】而不是每次 await 重新给一份预算：fetch 等 179 秒拿到响应头、
  // 读循环再给一份 180 秒，用户就要盯着进度条转 6 分钟，而注释写的是 3 分钟。
  const firstContentBy = Date.now() + FIRST_BYTE_TIMEOUT_MS
  const req = fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...headers },
    body: JSON.stringify(body),
    signal: ac.signal,
  })
  const res = await raceDeadline(req, FIRST_BYTE_TIMEOUT_MS, STALL_FIRST, () => ac.abort())
  if (!res.ok) {
    throw new AIError(res.status, await res.text().catch(() => `HTTP ${res.status}`))
  }
  if (!res.body) throw new AIError(0, '响应没有内容')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  // ⚠ 是「出过内容」而不是「收到过字节」：中转/服务商往往先刷一个心跳或
  // message_start，收到它就切到 60 秒窗口的话，一个想 90 秒的高档思考会被判成
  // 卡住 —— 而那 3 分钟宽限本来就是为这段等待留的。
  let gotContent = false

  try {
    for (;;) {
      const ms = gotContent ? IDLE_TIMEOUT_MS : Math.max(0, firstContentBy - Date.now())
      const { done, value } = await raceDeadline(reader.read(), ms, gotContent ? STALL_IDLE : STALL_FIRST)
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).replace(/\r$/, '')
        buf = buf.slice(nl + 1)
        if (line.startsWith('data:')) gotContent = onData(line.slice(5).trim()) || gotContent
      }
    }
  } finally {
    // 抛出时（超时 / 上层取消）必须掐断这条流：响应体还开着就等于服务端还在生成、
    // 还在计费。正常读完时 cancel 是空操作。
    reader.cancel().catch(() => {})
  }
  const last = buf.replace(/\r$/, '')
  if (last.startsWith('data:')) onData(last.slice(5).trim())
}

function parseData(data: string): unknown | null {
  try {
    return JSON.parse(data)
  } catch {
    return null // [DONE]、心跳等非 JSON 行
  }
}

function splitSystem(messages: ChatMessage[]) {
  return {
    system: messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n'),
    rest: messages.filter((m) => m.role !== 'system'),
  }
}

export async function chatOpenAI(
  cfg: AIConfig,
  messages: ChatMessage[],
  onDelta?: OnDelta,
  signal?: AbortSignal,
): Promise<string> {
  const base = (cfg.baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '')
  let text = ''
  await postStream(
    viaProxy(`${base}/chat/completions`, cfg.proxy),
    { authorization: `Bearer ${cfg.apiKey}` },
    // 不发送 temperature：前端无温度设置项，且部分新推理模型（GPT-5.x 等）
    // 只接受默认采样值，显式发送会 400；交由各家服务端默认
    // 思考参数逐 SKU 从 provider 目录取；没有条目就一个字段都不发
    // （已知不思考，或这家没有已知形态 —— 两种都不该乱猜）。
    { model: cfg.model, messages, stream: true, ...(thinkingWireFor(cfg.presetId, cfg.model, cfg.thinkingLevel ?? 'off') ?? {}) },
    (data) => {
      const obj = parseData(data) as {
        choices?: { delta?: { content?: string } }[]
      } | null
      const delta = obj?.choices?.[0]?.delta?.content
      if (typeof delta !== 'string' || !delta) return false
      text += delta
      onDelta?.(text)
      return true
    },
    signal,
  )
  if (!text) throw new AIError(0, '响应中没有文本内容')
  return text
}

export async function chatAnthropic(
  cfg: AIConfig,
  messages: ChatMessage[],
  onDelta?: OnDelta,
  signal?: AbortSignal,
): Promise<string> {
  const base = (cfg.baseURL || 'https://api.anthropic.com').replace(/\/+$/, '')
  const { system, rest } = splitSystem(messages)
  let text = ''
  await postStream(
    viaProxy(`${base}/v1/messages`, cfg.proxy),
    {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    // 不发送 temperature：Claude Opus 4.7+ / Fable 5 已移除采样参数，发送会直接 400
    // system 与 Gemini 同理：无 system 消息时（如连接测试）省略字段，避免空字符串被拒
    {
      model: cfg.model,
      // 开思考时必须抬高上限：thinking.budget_tokens 要【小于】max_tokens，
      // 而目录给的预算最高 12000 —— 维持 2048 会直接 400。
      max_tokens: thinkingOn(cfg) ? THINKING_MAX_TOKENS : 2048,
      ...(system ? { system } : {}),
      messages: rest,
      stream: true,
      ...(thinkingWireFor(cfg.presetId, cfg.model, cfg.thinkingLevel ?? 'off') ?? {}),
    },
    (data) => {
      const obj = parseData(data) as { delta?: { text?: string } } | null
      const delta = obj?.delta?.text
      if (typeof delta !== 'string' || !delta) return false
      text += delta
      onDelta?.(text)
      return true
    },
    signal,
  )
  if (!text) throw new AIError(0, '响应中没有文本内容')
  return text
}

export async function chatGemini(
  cfg: AIConfig,
  messages: ChatMessage[],
  onDelta?: OnDelta,
  signal?: AbortSignal,
): Promise<string> {
  const base = (cfg.baseURL || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '')
  const { system, rest } = splitSystem(messages)
  let text = ''
  await postStream(
    viaProxy(`${base}/v1beta/models/${cfg.model}:streamGenerateContent?alt=sse`, cfg.proxy),
    { 'x-goog-api-key': cfg.apiKey },
    {
      // Gemini 对空 text 参数返回 400，无 system 消息时（如连接测试）必须整个省略
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: rest.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      // 不发送 temperature：Gemini 3.x 官方建议用默认值（调低有回环/降智风险）。
      // 思考档位由目录逐 SKU 给，形态本身就带 generationConfig 这一层。
      ...(thinkingWireFor(cfg.presetId, cfg.model, cfg.thinkingLevel ?? 'off') ?? {}),
    },
    (data) => {
      const obj = parseData(data) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      } | null
      const delta = obj?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
      if (!delta) return false
      text += delta
      onDelta?.(text)
      return true
    },
    signal,
  )
  if (!text) throw new AIError(0, '响应中没有文本内容')
  return text
}

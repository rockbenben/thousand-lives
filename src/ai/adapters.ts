import { AIError, type AIConfig } from './types'
import type { ChatMessage } from '../engine/types'

export type OnDelta = (textSoFar: string) => void

// 以 SSE 流式发起请求，把每个 data 行交给 onData；非 2xx 时抛 AIError
async function postStream(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  onData: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...headers },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    throw new AIError(res.status, await res.text().catch(() => `HTTP ${res.status}`))
  }
  if (!res.body) throw new AIError(0, '响应没有内容')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, '')
      buf = buf.slice(nl + 1)
      if (line.startsWith('data:')) onData(line.slice(5).trim())
    }
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
    `${base}/chat/completions`,
    { authorization: `Bearer ${cfg.apiKey}` },
    { model: cfg.model, messages, temperature: 0.9, stream: true },
    (data) => {
      const obj = parseData(data) as {
        choices?: { delta?: { content?: string } }[]
      } | null
      const delta = obj?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) {
        text += delta
        onDelta?.(text)
      }
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
    `${base}/v1/messages`,
    {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    // 不发送 temperature：Claude Opus 4.7+ / Fable 5 已移除采样参数，发送会直接 400
    // system 与 Gemini 同理：无 system 消息时（如连接测试）省略字段，避免空字符串被拒
    {
      model: cfg.model,
      max_tokens: 2048,
      ...(system ? { system } : {}),
      messages: rest,
      stream: true,
    },
    (data) => {
      const obj = parseData(data) as { delta?: { text?: string } } | null
      const delta = obj?.delta?.text
      if (typeof delta === 'string' && delta) {
        text += delta
        onDelta?.(text)
      }
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
    `${base}/v1beta/models/${cfg.model}:streamGenerateContent?alt=sse`,
    { 'x-goog-api-key': cfg.apiKey },
    {
      // Gemini 对空 text 参数返回 400，无 system 消息时（如连接测试）必须整个省略
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: rest.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.9 },
    },
    (data) => {
      const obj = parseData(data) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      } | null
      const delta = obj?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
      if (delta) {
        text += delta
        onDelta?.(text)
      }
    },
    signal,
  )
  if (!text) throw new AIError(0, '响应中没有文本内容')
  return text
}

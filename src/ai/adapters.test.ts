import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatOpenAI, chatAnthropic, chatGemini } from './adapters'
import { AIError, type AIConfig } from './types'
import type { ChatMessage } from '../engine/types'

const messages: ChatMessage[] = [
  { role: 'system', content: 'SYS' },
  { role: 'user', content: 'HI' },
]

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

// 构造 SSE 流式响应；chunks 故意在任意字节处切开以覆盖跨块拼接
const sse = (events: string[]) => {
  const raw = events.map((e) => `data: ${e}\n\n`).join('')
  const bytes = new TextEncoder().encode(raw)
  const mid = Math.floor(bytes.length / 2)
  return fetchMock.mockResolvedValue({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, mid))
        c.enqueue(bytes.slice(mid))
        c.close()
      },
    }),
  })
}

const openaiChunk = (s: string) => JSON.stringify({ choices: [{ delta: { content: s } }] })
const anthropicChunk = (s: string) =>
  JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: s } })
const geminiChunk = (s: string) =>
  JSON.stringify({ candidates: [{ content: { parts: [{ text: s }] } }] })

describe('chatOpenAI', () => {
  it('流式拼接增量，onDelta 收到累计文本，请求体带 stream', async () => {
    sse([openaiChunk('hel'), openaiChunk('lo'), '[DONE]'])
    const seen: string[] = []
    const cfg: AIConfig = { provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o-mini' }
    const text = await chatOpenAI(cfg, messages, (t) => seen.push(t))
    expect(text).toBe('hello')
    expect(seen).toEqual(['hel', 'hello'])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers.authorization).toBe('Bearer sk-1')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.stream).toBe(true)
    expect(body.messages).toHaveLength(2)
  })

  it('自定义 baseURL 去除尾部斜杠', async () => {
    sse([openaiChunk('x'), '[DONE]'])
    await chatOpenAI(
      { provider: 'openai', baseURL: 'https://api.deepseek.com/v1/', apiKey: 'k', model: 'm' },
      messages,
    )
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('非 2xx 抛 AIError 并带状态码', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => 'bad key' })
    await expect(
      chatOpenAI({ provider: 'openai', apiKey: 'k', model: 'm' }, messages),
    ).rejects.toThrowError(AIError)
  })

  it('流中没有任何文本时抛错', async () => {
    sse(['[DONE]'])
    await expect(
      chatOpenAI({ provider: 'openai', apiKey: 'k', model: 'm' }, messages),
    ).rejects.toThrow('没有文本内容')
  })
})

describe('chatAnthropic', () => {
  it('system 单独提取，流式拼接，带浏览器直连头', async () => {
    sse([
      JSON.stringify({ type: 'message_start' }),
      anthropicChunk('claude'),
      anthropicChunk(' says'),
      JSON.stringify({ type: 'message_stop' }),
    ])
    const text = await chatAnthropic(
      { provider: 'anthropic', apiKey: 'sk-ant', model: 'claude-sonnet-4-6' },
      messages,
    )
    expect(text).toBe('claude says')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe('sk-ant')
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true')
    const body = JSON.parse(init.body)
    expect(body.system).toBe('SYS')
    expect(body.stream).toBe(true)
    expect(body.messages).toEqual([{ role: 'user', content: 'HI' }])
    expect(body.max_tokens).toBeGreaterThan(0)
    // Opus 4.7+ / Fable 5 已移除采样参数，发送 temperature 会 400
    expect(body.temperature).toBeUndefined()
  })

  it('无 system 消息时省略 system 字段（与 Gemini 修复对称）', async () => {
    sse([anthropicChunk('ok')])
    await chatAnthropic({ provider: 'anthropic', apiKey: 'k', model: 'm' }, [
      { role: 'user', content: 'HI' },
    ])
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.system).toBeUndefined()
  })
})

describe('chatGemini', () => {
  it('role 映射与 systemInstruction 正确，走 streamGenerateContent', async () => {
    sse([geminiChunk('ge'), geminiChunk('m')])
    const text = await chatGemini(
      { provider: 'gemini', apiKey: 'g-key', model: 'gemini-2.0-flash' },
      [...messages, { role: 'assistant', content: 'PREV' }],
    )
    expect(text).toBe('gem')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse',
    )
    expect(init.headers['x-goog-api-key']).toBe('g-key')
    const body = JSON.parse(init.body)
    expect(body.systemInstruction.parts[0].text).toBe('SYS')
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'HI' }] },
      { role: 'model', parts: [{ text: 'PREV' }] },
    ])
  })

  it('无 system 消息时省略 systemInstruction（Gemini 对空 text 报 400）', async () => {
    sse([geminiChunk('ok')])
    await chatGemini({ provider: 'gemini', apiKey: 'g', model: 'm' }, [
      { role: 'user', content: 'HI' },
    ])
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.systemInstruction).toBeUndefined()
  })
})

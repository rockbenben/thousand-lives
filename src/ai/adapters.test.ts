import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { chatOpenAI, chatAnthropic, chatGemini, THINKING_MAX_TOKENS } from './adapters'
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
    // 前端无温度设置项；部分新推理模型（GPT-5.x 等）拒绝非默认采样值，不发送
    expect(body.temperature).toBeUndefined()
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

  // 「选了关」不等于「真关了」：关不掉思考的型号（官方逐模型表标 Always on）
  // 照样思考，而思考 token 计入 max_tokens —— 按不思考的额度发会被截断。
  it('关不掉思考的型号即使选了关，也要按开思考的额度留 max_tokens', async () => {
    sse([anthropicChunk('ok')])
    await chatAnthropic(
      { provider: 'anthropic', apiKey: 'k', model: 'claude-fable-5', presetId: 'claude', thinkingLevel: 'off' },
      messages,
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.thinking, 'Fable 5 收到关闭值会 400').toBeUndefined()
    expect(body.max_tokens).toBe(THINKING_MAX_TOKENS)
  })

  it('真关得掉的型号选了关就按不思考的额度发', async () => {
    sse([anthropicChunk('ok')])
    await chatAnthropic(
      { provider: 'anthropic', apiKey: 'k', model: 'claude-opus-5', presetId: 'claude', thinkingLevel: 'off' },
      messages,
    )
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.max_tokens).toBeLessThan(THINKING_MAX_TOKENS)
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
    // 前端无温度设置项，不发送 generationConfig，交由服务端默认
    expect(body.generationConfig).toBeUndefined()
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

describe('CORS 中转', () => {
  const capture = () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url)
      return new Response('data: [DONE]\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
    }))
    return calls
  }
  afterEach(() => vi.unstubAllGlobals())

  it('配了中转就把完整目标 URL 接在它后面（与 worker 的契约一致）', async () => {
    const calls = capture()
    await chatOpenAI(
      { provider: 'openai', apiKey: 'k', model: 'm', baseURL: 'https://api.deepseek.com', proxy: 'https://proxy.example' },
      [{ role: 'user', content: 'hi' }],
    ).catch(() => {})
    expect(calls[0]).toBe('https://proxy.example/https://api.deepseek.com/chat/completions')
  })

  it('中转地址的尾斜杠会被去掉 —— proxy.com//https://… 会被 worker 判成畸形目标', async () => {
    const calls = capture()
    await chatOpenAI(
      { provider: 'openai', apiKey: 'k', model: 'm', baseURL: 'https://api.deepseek.com', proxy: 'https://proxy.example///' },
      [{ role: 'user', content: 'hi' }],
    ).catch(() => {})
    expect(calls[0]).toBe('https://proxy.example/https://api.deepseek.com/chat/completions')
  })

  it('地址漏写 https:// 就拒发 —— 否则 Key 与 prompt 会被 POST 到本站', async () => {
    const calls = capture()
    const e = await chatOpenAI(
      { provider: 'openai', apiKey: 'k', model: 'm', baseURL: 'https://api.deepseek.com', proxy: 'cors.example.dev' },
      [{ role: 'user', content: 'hi' }],
    ).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(AIError)
    expect(calls, '一个请求都不该发出去').toHaveLength(0)
  })

  it('没配中转就直连', async () => {
    const calls = capture()
    await chatOpenAI(
      { provider: 'openai', apiKey: 'k', model: 'm', baseURL: 'https://api.deepseek.com' },
      [{ role: 'user', content: 'hi' }],
    ).catch(() => {})
    expect(calls[0]).toBe('https://api.deepseek.com/chat/completions')
  })
})

describe('空闲超时', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** 一个只建连接、不吐字节的流。 */
  function stalling() {
    let push!: (s: string) => void
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        push = (s) => c.enqueue(new TextEncoder().encode(s))
      },
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    return { push }
  }

  const run = () =>
    chatOpenAI({ provider: 'openai', apiKey: 'k', model: 'm' }, [{ role: 'user', content: 'hi' }])

  it('首字节前给足 3 分钟 —— 思考模型想一两分钟是正常的', async () => {
    const { push } = stalling()
    const p = run().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(120_000) // 两分钟没吐字：不该报错
    push('data: {"choices":[{"delta":{"content":"好"}}]}\n\n')
    push('data: [DONE]\n\n')
    // 让读循环推进后正常结束（stream 不 close，靠 [DONE] 之后的空闲超时收尾不合适，
    // 这里只验证两分钟时还没抛错）
    await vi.advanceTimersByTimeAsync(0)
    expect(await Promise.race([p, Promise.resolve('still-running')])).toBe('still-running')
  })

  it('首字节迟迟不来则抛错 —— 而不是让进度条永远转', async () => {
    stalling()
    const p = run().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(180_001)
    const e = await p
    expect(e).toBeInstanceOf(AIError)
    expect((e as AIError).message).toMatch(/连接卡住/)
  })

  it('卡住抛的错要能被自动重试认出来 —— status 为 0 即「值得重试」', async () => {
    stalling()
    const p = run().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(180_001)
    expect((await p as AIError).status).toBe(0)
  })

  it('首字内容的预算只有一份 —— 响应头拖到最后一刻，不会再送一个 3 分钟', async () => {
    // fetch 在 170 秒才给出响应头，之后一直不出内容：该在 180 秒线上抛，而不是 350 秒
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    const body = new ReadableStream<Uint8Array>({ start() {} })
    vi.stubGlobal('fetch', vi.fn(async () => { await gate; return new Response(body, { status: 200 }) }))
    const p = run().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(170_000)
    release()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(10_001)
    const e = await p
    expect(e, '预算被重新发了一份 —— 用户要多转 3 分钟').toBeInstanceOf(AIError)
  })

  it('心跳与空 delta 不算「开始出字」—— 否则高档思考会在 60 秒被误杀', async () => {
    const { push } = stalling()
    const p = run().catch((e: Error) => e)
    push(': ping\n\n') // SSE 注释行
    push('data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n') // 有 data，但没内容
    await vi.advanceTimersByTimeAsync(90_000) // 超过 60 秒空闲窗口，仍在 3 分钟首字窗口内
    expect(await Promise.race([p, Promise.resolve('still-running')])).toBe('still-running')
  })

  it('卡住时把原来那条流掐断 —— 不掐的话它继续生成继续计费，而重试已开了第二条', async () => {
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({ start() {}, cancel() { cancelled = true } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    const p = run().catch((e: Error) => e)
    await vi.advanceTimersByTimeAsync(180_001)
    await p
    expect(cancelled).toBe(true)
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z, ZodError } from 'zod'
import { requestTurn, friendlyError, chat, type ChatFn } from './client'
import * as adapters from './adapters'
import { AIError, type AIConfig } from './types'
import type { ChatMessage } from '../engine/types'

const cfg: AIConfig = { provider: 'openai', apiKey: 'k', model: 'm' }
const messages: ChatMessage[] = [{ role: 'user', content: 'go' }]
const goodJson = JSON.stringify({
  narrative: 'n',
  choices: [{ text: 'a', effects: {} }, { text: 'b', effects: {} }],
  summary: 's',
})

describe('requestTurn', () => {
  it('首次合法则只调用一次', async () => {
    const chatFn: ChatFn = vi.fn().mockResolvedValue(goodJson)
    const t = await requestTurn(cfg, messages, chatFn)
    expect(t.narrative).toBe('n')
    expect(chatFn).toHaveBeenCalledTimes(1)
  })

  it('首次非法则带纠错上下文重试一次', async () => {
    const chatFn = vi
      .fn()
      .mockResolvedValueOnce('我觉得剧情应该是……（没有JSON）')
      .mockResolvedValueOnce(goodJson)
    const t = await requestTurn(cfg, messages, chatFn as ChatFn)
    expect(t.summary).toBe('s')
    expect(chatFn).toHaveBeenCalledTimes(2)
    const retryMessages = (chatFn as ReturnType<typeof vi.fn>).mock.calls[1][1] as ChatMessage[]
    expect(retryMessages.at(-2)?.role).toBe('assistant')
    expect(retryMessages.at(-1)?.content).toContain('JSON')
  })

  it('两次都非法则抛错', async () => {
    const chatFn: ChatFn = vi.fn().mockResolvedValue('still bad')
    await expect(requestTurn(cfg, messages, chatFn)).rejects.toThrow()
  })
})

describe('friendlyError', () => {
  it('401/429/5xx/网络错误各有中文提示', () => {
    expect(friendlyError(new AIError(401, 'x'))).toContain('Key')
    expect(friendlyError(new AIError(403, 'x'))).toContain('Key')
    expect(friendlyError(new AIError(429, 'x'))).toContain('429')
    expect(friendlyError(new AIError(500, 'x'))).toContain('500')
    expect(friendlyError(new TypeError('failed to fetch'))).toContain('CORS')
  })
  it('ZodError 显示可读的字段提示，而非原始多行 JSON', () => {
    let err: ZodError
    try {
      z.object({ name: z.string() }).parse({ name: 123 })
      throw new Error('应抛错')
    } catch (e) {
      err = e as ZodError
    }
    const msg = friendlyError(err)
    expect(msg).not.toContain('[') // 不把 issues 数组的原始 JSON 直接塞给用户
    expect(msg).toContain('name') // 指明出问题的字段
  })
})

describe('chat 的自动重试', () => {
  const cfg = { provider: 'openai', apiKey: 'k', model: 'm' } as const

  // 重试之间真的会 sleep（限流 2s、其余 0.8s）。用假定时器跑完，否则这一组
  // 测试要空等 4 秒多 —— 每次跑套件都付一遍。
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  /** 起跑 → 推完所有定时器 → 拿结果。 */
  const run = async (p: Promise<unknown>) => {
    const settled = p.catch((e) => ({ __err: e }))
    await vi.runAllTimersAsync()
    return settled
  }
  const okOnSecond = (err: unknown) => {
    let n = 0
    return vi.fn(async () => {
      if (++n === 1) throw err
      return '好'
    })
  }

  it('限流 / 服务端错误 / 网络失败：重试一次并成功', async () => {
    for (const err of [new AIError(429, 'rate'), new AIError(503, 'oops'), new AIError(408, 'slow'), new TypeError('Failed to fetch')]) {
      const fn = okOnSecond(err)
      vi.spyOn(adapters, 'chatOpenAI').mockImplementation(fn as never)
      expect(await run(chat(cfg, [])), String(err)).toBe('好')
      expect(fn, String(err)).toHaveBeenCalledTimes(2)
    }
  })

  it('key 不对 / 请求本身有问题：不重试 —— 再试一次还是同样的错，只是让用户多等', async () => {
    for (const err of [new AIError(401, 'bad key'), new AIError(403, 'forbidden'), new AIError(400, 'bad model')]) {
      const fn = okOnSecond(err)
      vi.spyOn(adapters, 'chatOpenAI').mockImplementation(fn as never)
      expect(await run(chat(cfg, [])), String(err)).toHaveProperty('__err')
      expect(fn, String(err)).toHaveBeenCalledTimes(1)
    }
  })

  it('已经吐出过内容就不重试 —— 否则界面会把写了一半的段落倒回去重写', async () => {
    const fn = vi.fn(async (_c: unknown, _m: unknown, onDelta?: (t: string) => void) => {
      onDelta?.('写了一半')
      throw new AIError(503, 'mid-stream')
    })
    vi.spyOn(adapters, 'chatOpenAI').mockImplementation(fn as never)
    expect(await run(chat(cfg, [], () => {}))).toHaveProperty('__err')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('用户取消时不重试', async () => {
    const fn = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })
    vi.spyOn(adapters, 'chatOpenAI').mockImplementation(fn as never)
    expect(await run(chat(cfg, []))).toHaveProperty('__err')
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

import { describe, it, expect, vi } from 'vitest'
import { z, ZodError } from 'zod'
import { requestTurn, friendlyError, type ChatFn } from './client'
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

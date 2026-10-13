import { describe, it, expect, vi, beforeEach } from 'vitest'
import { chatOpenAI, chatAnthropic, chatGemini } from './adapters'
import { DEFAULT_PROXY, PRESETS, findPreset, keyOptional } from './presets'
import type { AIConfig } from './types'
import type { ChatMessage } from '../engine/types'

// ── 中转前缀到底挂没挂：判据必须在【传输层】生效，而不只是界面少画一个开关 ────────
//
// 为什么三条 chat* 都要各跑一遍：viaProxy 的调用点有三条（openai / anthropic /
// gemini），漏掉任何一条，那条路上的自建网关地址就照样带着 ?token= 出门。
// 断言看的是【实际递给 fetch 的那个 URL】，不去戳内部的 effectiveProxy —— 否则
// 换个实现位置（比如把守卫挪进 viaProxy）会把整批一起弄红，而规则本身没错。

const msgs: ChatMessage[] = [{ role: 'user', content: 'HI' }]
const OWN = 'https://my-relay.example.workers.dev'
const GATEWAY = 'https://my-gateway.example.com/v1'

describe('内置中转只在官方地址上生效（三条传输路径逐一）', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  // 各家解析的形状不同，给一条能解析出正文的流（空流会被"没有文本内容"挡掉，
  // 那是适配器自己的守卫，与这里要量的 URL 无关）
  const stubStream = (data: string) => {
    const bytes = new TextEncoder().encode(`data: ${data}\n\n`)
    fetchMock.mockResolvedValue({
      ok: true,
      body: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close() } }),
    })
  }
  const sentUrl = (): string => fetchMock.mock.calls[0]?.[0] as string

  const cases = [
    {
      name: 'chatOpenAI',
      run: (cfg: AIConfig) => chatOpenAI(cfg, msgs),
      presetId: 'openai',
      path: '/chat/completions',
      data: JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }),
    },
    {
      name: 'chatAnthropic',
      run: (cfg: AIConfig) => chatAnthropic(cfg, msgs),
      presetId: 'claude',
      path: '/v1/messages',
      data: JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'ok' } }),
    },
    {
      name: 'chatGemini',
      run: (cfg: AIConfig) => chatGemini(cfg, msgs),
      presetId: 'gemini',
      path: '/v1beta/models/x:streamGenerateContent?alt=sse',
      data: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    },
  ]

  for (const c of cases) {
    const preset = findPreset(c.presetId)
    it(`${c.name}: 官方地址 + 内置中转 → 前缀挂上`, async () => {
      expect(preset, `预设 ${c.presetId} 不在了 —— 本 app 收了它，目录里却没有`).toBeTruthy()
      expect(keyOptional(c.presetId), `${c.presetId} 若已改成「地址才是凭据」，这条用例要重挑样本`).toBe(false)
      stubStream(c.data)
      await c.run({ provider: preset!.provider, presetId: preset!.id, baseURL: preset!.baseURL, apiKey: 'k', model: 'x', proxy: DEFAULT_PROXY } as AIConfig)
      expect(sentUrl()).toBe(`${DEFAULT_PROXY}/${preset!.baseURL.replace(/\/+$/, '')}${c.path}`)
    })

    it(`${c.name}: 自建网关 + 内置中转 → 不挂前缀，直连发出`, async () => {
      stubStream(c.data)
      await c.run({ provider: preset!.provider, presetId: preset!.id, baseURL: GATEWAY, apiKey: 'k', model: 'x', proxy: DEFAULT_PROXY } as AIConfig)
      expect(sentUrl()).not.toContain(DEFAULT_PROXY)
      expect(sentUrl().startsWith(`${GATEWAY}${c.path}`), `中转没被跳过（实际 URL: ${sentUrl()}）`).toBe(true)
    })

    it(`${c.name}: 自建网关 + 用户自己的中转 → 照发（那台归他所有）`, async () => {
      stubStream(c.data)
      await c.run({ provider: preset!.provider, presetId: preset!.id, baseURL: GATEWAY, apiKey: 'k', model: 'x', proxy: OWN } as AIConfig)
      expect(sentUrl()).toBe(`${OWN}/${GATEWAY}${c.path}`)
    })

    it(`${c.name}: 被挡下时不改写 cfg.proxy —— 那是用户的意图，不是这一跳的事实`, async () => {
      stubStream(c.data)
      const cfg = { provider: preset!.provider, presetId: preset!.id, baseURL: GATEWAY, apiKey: 'k', model: 'x', proxy: DEFAULT_PROXY } as AIConfig
      await c.run(cfg)
      expect(cfg.proxy, '静默改写存档等于把用户没做的事替他做了').toBe(DEFAULT_PROXY)
    })
  }

  it('「地址才是凭据」那一家：它的任何地址都不发给内置中转', async () => {
    const id = PRESETS.map((p) => p.id).find(keyOptional)
    expect(id, '目录里没有 keyOptional 的预设 —— 这条在空转').toBeTruthy()
    const preset = findPreset(id)!
    const bases = [preset.baseURL, ...(preset.endpoints ?? []).map((e) => e.url)].filter(Boolean)
    expect(bases.length, `${id} 一个地址样本都没有 —— 这条在空转`).toBeGreaterThan(0)
    for (const base of bases) {
      stubStream(JSON.stringify({ choices: [{ delta: { content: 'ok' } }] }))
      await chatOpenAI({ provider: preset.provider, presetId: preset.id, baseURL: base, apiKey: 'k', model: 'x', proxy: DEFAULT_PROXY } as AIConfig, msgs)
      expect(sentUrl(), `${id} 的 ${base} 不该经内置中转`).not.toContain(DEFAULT_PROXY)
    }
  })
})

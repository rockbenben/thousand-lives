import { describe, it, expect } from 'vitest'
import { PRESETS, matchPreset, findPreset } from './presets'

describe('PRESETS', () => {
  it('id 唯一', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('baseURL 与备用端点不带尾斜杠、不含 /chat/completions（adapter 会自行拼接）', () => {
    for (const p of PRESETS) {
      const urls = [p.baseURL, ...(p.endpoints ?? []).map((e) => e.url)]
      for (const u of urls) {
        expect(u, p.id).not.toMatch(/\/$/)
        expect(u, p.id).not.toContain('/chat/completions')
      }
    }
  })

  it('docs / apiKeyUrl 若存在必须是合法 http(s) 链接；云服务商必须双链接齐全', () => {
    const local = new Set(['ollama', 'lmstudio', 'llamacpp', 'litellm', 'custom'])
    for (const p of PRESETS) {
      for (const u of [p.docs, p.apiKeyUrl]) {
        if (u !== undefined) expect(() => new URL(u), p.id).not.toThrow()
      }
      if (!local.has(p.id)) {
        expect(p.docs, p.id).toBeTruthy()
        expect(p.apiKeyUrl, p.id).toBeTruthy()
      }
    }
  })

  it('仅自定义项允许空 baseURL', () => {
    for (const p of PRESETS) {
      if (p.id !== 'custom') expect(p.baseURL, p.id).not.toBe('')
    }
  })

  it('有备用端点的预设，默认 baseURL 必在端点列表中', () => {
    for (const p of PRESETS) {
      if (p.endpoints) {
        expect(p.endpoints.map((e) => e.url), p.id).toContain(p.baseURL)
      }
    }
  })

  it('matchPreset 优先按 presetId 恢复', () => {
    expect(matchPreset('openai', 'https://api.deepseek.com', 'mimo').id).toBe('mimo')
  })

  it('matchPreset 无 presetId 时按 provider+baseURL 精确匹配（要求各预设 baseURL 互不相同）', () => {
    for (const p of PRESETS) {
      expect(matchPreset(p.provider, p.baseURL).id, p.id).toBe(p.id)
    }
  })

  it('matchPreset 未知 openai 兼容地址回退到自定义项', () => {
    expect(matchPreset('openai', 'https://example.com/v1').id).toBe('custom')
  })

  it('matchPreset 未知 anthropic/gemini 代理地址回退到同协议官方项', () => {
    expect(matchPreset('anthropic', 'https://my-proxy.example.com').provider).toBe('anthropic')
    expect(matchPreset('gemini', 'https://my-proxy.example.com').provider).toBe('gemini')
  })

  it('findPreset 容忍 undefined 与未知 id', () => {
    expect(findPreset(undefined)).toBeUndefined()
    expect(findPreset('nope')).toBeUndefined()
    expect(findPreset('deepseek')?.label).toBe('DeepSeek')
  })
})

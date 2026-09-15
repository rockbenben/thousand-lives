import { describe, it, expect } from 'vitest'
import { PRESETS, PRESET_GROUPS, providerOptions, visibleProviderOptions, isHiddenPreset, matchPreset, findPreset, thinkingWireFor, supportsThinking, needsProxy, keyOptional, canDisableThinking } from './presets'
import { THINKING_MAX_TOKENS } from './adapters'
import { PROVIDER_CATALOG } from './providerCatalog.generated'

describe('PRESETS', () => {
  it('id 唯一', () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个预设都落在已声明的分组里，且没有空分组', () => {
    const declared = new Set(PRESET_GROUPS.map((g) => g.id))
    for (const p of PRESETS) expect(declared.has(p.group), `${p.id} 的分组 ${p.group} 未声明`).toBe(true)
    for (const g of PRESET_GROUPS) {
      expect(
        PRESETS.some((p) => p.group === g.id),
        `分组 ${g.id} 没有任何预设`,
      ).toBe(true)
    }
  })

  it('providerOptions 里同组的选项连续 —— SearchSelect 的组标题靠这个前提', () => {
    // 组标题是「遍历中组名一变就插一行」生成的；同组不连续会渲染出重复标题。
    const seen = new Set<string>()
    let prev: string | undefined
    for (const o of providerOptions) {
      if (o.group !== prev) {
        expect(seen.has(o.group), `分组 ${o.group} 出现了不连续的第二段`).toBe(false)
        seen.add(o.group)
        prev = o.group
      }
    }
    expect(providerOptions.length).toBe(PRESETS.length)
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
    const local = new Set(['llm']) // 自定义项没有服务商级的文档/控制台链接
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
      if (p.id !== 'llm') expect(p.baseURL, p.id).not.toBe('')
    }
  })

  it('有备用端点的预设，默认 baseURL 必在端点列表中', () => {
    for (const p of PRESETS) {
      // llm 豁免：它的 endpoints 是「起步地址建议」，不是同一服务的区域变体，
      // 默认 baseURL 留空由用户自己填（见 presets.ts 的 CUSTOM_PRESET）。
      if (p.endpoints && p.id !== 'llm') {
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
    expect(matchPreset('openai', 'https://example.com/v1').id).toBe('llm')
  })

  // 上游把某家并进自定义项之后，老存档里的 presetId 会指向一个不存在的预设。
  // 这条回退链是它唯一的保险：落到自定义项、地址原样保留，用户开局即可继续用。
  // 没有它，界面会停在一个解析不出的预设上 —— 表现为服务商那一栏凭空消失。
  it('已被并走的 presetId 回退到自定义项，地址原样保留', () => {
    const p = matchPreset('openai', 'http://127.0.0.1:4000/v1', 'litellm')
    expect(p.id, '停在解析不出的预设上会让服务商那一栏消失').toBe('llm')
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

describe('默认隐藏的订阅套餐（Coding Plan / Token Plan）', () => {
  it('只有 volcengine / alibaba 两个隐藏项，其余预设都不隐藏', () => {
    expect(PRESETS.filter((p) => p.hidden).map((p) => p.id).sort()).toEqual(['alibaba', 'volcengine'])
    expect(isHiddenPreset('volcengine')).toBe(true)
    expect(isHiddenPreset('alibaba')).toBe(true)
    expect(isHiddenPreset('deepseek')).toBe(false)
    expect(isHiddenPreset(undefined)).toBe(false)
  })

  it('默认列表不含隐藏项；开关打开后全部出现', () => {
    const ids = (opts: typeof providerOptions) => opts.map((o) => o.value)
    expect(ids(visibleProviderOptions(false))).not.toContain('volcengine')
    expect(ids(visibleProviderOptions(false))).not.toContain('alibaba')
    expect(ids(visibleProviderOptions(true))).toEqual(ids(providerOptions))
  })

  it('当前已选中隐藏项时把它留住，另一个隐藏项仍藏着 —— 老存档不能被藏没', () => {
    const visible = visibleProviderOptions(false, 'volcengine')
    expect(visible.map((o) => o.value)).toContain('volcengine')
    expect(visible.map((o) => o.value)).not.toContain('alibaba')
  })

  it('隐藏只是 UI 过滤：matchPreset 仍按 presetId 解析出隐藏预设', () => {
    const p = matchPreset('openai', 'https://ark.cn-beijing.volces.com/api/coding/v3', 'volcengine')
    expect(p.id).toBe('volcengine')
    expect(needsProxy('volcengine')).toBe(true)
  })
})

describe('思考参数', () => {
  it('逐 SKU 取形态 —— 同一家可以不同（Kimi K3 vs K2.x）', () => {
    expect(thinkingWireFor('moonshot', 'kimi-k3', 'off')).toEqual({ reasoning_effort: 'low' })
    expect(thinkingWireFor('moonshot', 'kimi-k2.6', 'off')).toEqual({ thinking: { type: 'disabled' } })
  })

  it('关闭态发显式 disable —— 服务端默认开着思考时，省略等于按推理静默计费', () => {
    expect(thinkingWireFor('qwen', 'qwen3.8-max', 'off')).toEqual({ enable_thinking: false })
    expect(thinkingWireFor('cohere', 'command-a-reasoning-08-2025', 'off')).toEqual({ reasoning_effort: 'none' })
  })

  it('厂商没有关闭值时，off 就是最低档（仍在推理、仍在计费）', () => {
    expect(thinkingWireFor('grok', 'grok-4.6', 'off')).toEqual({ reasoning_effort: 'low' })
    expect(thinkingWireFor('grok', 'grok-4.6', 'medium')).toEqual({ reasoning_effort: 'medium' })
  })

  it('目录没给形态的 SKU 一个参数都不发，控件也不显示', () => {
    // tokenhub：上游没有已知的思考线格式
    expect(thinkingWireFor('tokenhub', 'hy3', 'high')).toBeUndefined()
    expect(supportsThinking('tokenhub', 'hy3')).toBe(false)
    // 已知不思考的 SKU
    expect(thinkingWireFor('minimax', 'MiniMax-M2.7', 'high')).toBeUndefined()
  })

  it('Claude / Gemini 走原生协议，目录按原生形态给 —— 与兼容层的形状不同', () => {
    // Claude 分两代：adaptive 世代用 output_config，旧世代用 budget_tokens
    expect(thinkingWireFor('claude', 'claude-opus-5', 'high')).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    })
    expect(thinkingWireFor('claude', 'claude-haiku-4-5', 'high')).toEqual({
      thinking: { type: 'enabled', budget_tokens: 12000 },
    })
    // Haiku 服务端默认就是关的 → 关闭态什么都不发才对
    expect(thinkingWireFor('claude', 'claude-haiku-4-5', 'off')).toBeUndefined()
    // adaptive 世代服务端可能默认开 → 关闭态必须显式关
    expect(thinkingWireFor('claude', 'claude-opus-5', 'off')).toEqual({ thinking: { type: 'disabled' } })
    // ……但同代里还有【关不掉】的一支（官方逐模型表标 Always on，连关闭值都回 400），
    // 它们的关闭档就该是空的 —— 一律按「同代同形态」发会每请求 400。
    expect(thinkingWireFor('claude', 'claude-fable-5', 'off')).toBeUndefined()
    expect(thinkingWireFor('claude', 'claude-fable-5', 'high')).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    })
    // Gemini 的形态自带 generationConfig 这一层，逐 SKU 档位不同（3.5 系有 minimal）
    expect(thinkingWireFor('gemini', 'gemini-3.5-flash', 'off')).toEqual({
      generationConfig: { thinkingConfig: { thinkingLevel: 'minimal' } },
    })
    expect(thinkingWireFor('gemini', 'gemini-3.7-flash', 'off')).toEqual({
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
    })
    expect(supportsThinking('claude', 'claude-opus-5')).toBe(true)
    expect(supportsThinking('gemini', 'gemini-3.7-flash')).toBe(true)
  })

  it('用户手填的未列出 SKU 退到 provider 级形态', () => {
    expect(thinkingWireFor('deepseek', 'my-self-hosted', 'off')).toEqual({ thinking: { type: 'disabled' } })
    expect(supportsThinking('deepseek', 'my-self-hosted')).toBe(true)
  })
})

describe('预填模型', () => {
  it('目录指定的 defaultModel 排首位 —— models[0] 就是界面填进去的那个', () => {
    for (const p of PROVIDER_CATALOG) {
      const preset = findPreset(p.key)
      if (!preset || !p.defaultModel) continue
      expect(preset.models[0], `${p.key} 的预填模型`).toBe(p.defaultModel)
    }
  })
})

describe('未列出 SKU 的思考形态', () => {
  // 各 app 自己写一份 Claude 判代必然漂（上游注释记着已经漂过一次：某次精简把
  // 4.7/4.8 删了，手填 opus-4-8 就 400）。目录给了 thinkingWireIf，就别再自己猜。
  it('命中目录判代 pattern 的手填型号照样拿到形态', () => {
    expect(supportsThinking('claude', 'claude-opus-4-8')).toBe(true)
    expect(thinkingWireFor('claude', 'claude-opus-4-8', 'high')).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    })
  })

  it('官方标 Always on 的手填变体不发关闭值 —— 发 disabled 是每请求 400', () => {
    // 在册的 claude-fable-5 走 models[] 早就对了；坏的是【带日期的手填变体】：
    // 它同时命中两条规则（always-on 的正则是 adaptive 那条的子集），取错一条就把
    // 被官方拒收的关闭值发出去。目录按窄的在前排序，这里取首个匹配。
    expect(thinkingWireFor('claude', 'claude-fable-5-20260609', 'off')).toBeUndefined()
    expect(thinkingWireFor('claude', 'claude-fable-5-20260609', 'high')).toEqual({
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    })
    // 同代但关得掉的那半照常发显式关闭
    expect(thinkingWireFor('claude', 'claude-opus-5-20260101', 'off')).toEqual({ thinking: { type: 'disabled' } })
  })

  // 取首个匹配 ⇒ 没有「向宽规则继承」这回事：少一个档位就是那一档什么都不发。
  // 上游在生成时断言了这条，但这边拿到的只是产物 —— 坏的同步该在 CI 炸，而不是
  // 等到用户选了「中」却发现模型压根没想。
  it('thinkingWireIf 各条规则的非 off 档位集合必须恒等', () => {
    const withRules = PROVIDER_CATALOG.filter((p) => p.thinkingWireIf?.length)
    expect(withRules.length, '目录里一条条件规则都没有，这条测试在空转').toBeGreaterThan(0)
    for (const p of withRules) {
      const levels = p.thinkingWireIf!.map((r) =>
        Object.keys(r.wire ?? {}).filter((k) => k !== 'off').sort().join(','),
      )
      expect(new Set(levels).size, `${p.key} 的规则档位不一致：${levels.join(' | ')}`).toBe(1)
    }
  })

  it('判不出代的才不猜：provider 级回退是旧世代形状，猜错是每请求 400', () => {
    expect(thinkingWireFor('claude', 'claude-my-self-hosted', 'high')).toBeUndefined()
    expect(supportsThinking('claude', 'claude-my-self-hosted')).toBe(false)
    // 在册的照常
    expect(supportsThinking('claude', 'claude-opus-5')).toBe(true)
  })

  it('其余协议照常退到 provider 级形态', () => {
    expect(thinkingWireFor('deepseek', 'my-self-hosted', 'off')).toEqual({ thinking: { type: 'disabled' } })
    expect(thinkingWireFor('gemini', 'gemini-whatever', 'off')).toEqual({
      generationConfig: { thinkingConfig: { thinkingLevel: 'low' } },
    })
  })
})

describe('Claude 的 budget_tokens 与输出上限配套', () => {
  it('每一档预算都低于开思考时的 max_tokens，且留足可见回复的余量', () => {
    // budget_tokens 是绝对整数、必须小于 max_tokens —— 目录里的数值是按上游
    // max_tokens=16384 反推的，本 app 用同一个值所以能直接照搬。哪天任一边改了
    // 而另一边没跟，这条会先炸，而不是等到线上 400。
    const claude = PROVIDER_CATALOG.find((p) => p.key === 'claude')!
    const budgets = [...claude.models, { thinkingWire: claude.thinkingWire }]
      .flatMap((m) => Object.values(m.thinkingWire ?? {}))
      .map((slot) => (slot as { thinking?: { budget_tokens?: number } }).thinking?.budget_tokens)
      .filter((b): b is number => typeof b === 'number')
    expect(budgets.length).toBeGreaterThan(0)
    for (const b of budgets) {
      expect(b, `budget ${b}`).toBeLessThan(THINKING_MAX_TOKENS)
      expect(THINKING_MAX_TOKENS - b, `budget ${b} 的余量`).toBeGreaterThanOrEqual(4000)
    }
  })
})

describe('直连已坏的 provider', () => {
  it('照常收录，但默认开着中转 —— 不开就发不出请求', () => {
    const blocked = PROVIDER_CATALOG.filter((p) => p.directBlocked).map((p) => p.key)
    expect(blocked.length).toBeGreaterThan(0) // 目录里确实有这类，否则本测试空转
    for (const key of blocked) {
      if (!findPreset(key)) continue // 本 app 没收录的跳过
      expect(needsProxy(key), `${key} 直连已坏，应标记为必须走中转`).toBe(true)
    }
  })

  it('能直连的不强制中转', () => {
    for (const p of PRESETS) {
      const c = PROVIDER_CATALOG.find((x) => x.key === p.id)
      if (c && !c.directBlocked) expect(needsProxy(p.id), p.id).toBe(false)
    }
  })
})

describe('地址即凭据的服务商', () => {
  // 自建网关与局域网里的本地推理没有 key 这个概念，拿「没填 key」拦住开局
  // 等于让本地模型完全用不了，用户只能随便编一个字符串糊弄过去。
  it('自建网关 / 本地推理不要求 key，厂商服务照旧要求', () => {
    const optional = PROVIDER_CATALOG.filter((p) => p.keyOptional).map((p) => p.key)
    expect(optional.length, '目录里确实有这类，否则本测试空转').toBeGreaterThan(0)
    for (const key of optional) {
      if (!findPreset(key)) continue
      expect(keyOptional(key), `${key} 的地址才是凭据，不该拿 key 拦`).toBe(true)
    }
    // 反方向：真要 key 的厂商不能被顺手放行
    expect(keyOptional('openai')).toBe(false)
    expect(keyOptional('claude')).toBe(false)
    expect(keyOptional(undefined)).toBe(false)
  })
})

/** 手写的「这就是真关闭」形态表 —— 新形态出现时这条会先红，提醒去核 isRealOff。 */
const KNOWN_DISABLE_SHAPES = [
  '{"reasoning_effort":"none"}',
  '{"thinking":{"type":"disabled"}}',
  '{"enable_thinking":false}',
  '{"reasoning":{"enabled":false}}',
]

describe('没有「关闭」这一档的服务商', () => {
  // 选「关」时它们发的是自己的最低档 —— 模型仍在推理、仍在计费。界面若照旧写
  // 「关闭（更快更省）」就是在撒谎：用户以为省下了推理的钱，账单上并没有。
  // 这条把「目录说关不掉」与「关闭档确实不是真关闭」钉在一起，两边不一致就红。
  it('目录标了关不掉的，其关闭档确实仍在思考', () => {
    const noOff = PROVIDER_CATALOG.filter((p) => !p.canDisableThinking)
    expect(noOff.length, '目录里一个都没有，这条测试在空转').toBeGreaterThan(0)
    for (const p of noOff) {
      if (!findPreset(p.key)) continue
      expect(canDisableThinking(p.key), `${p.key} 应被判为不能关闭`).toBe(false)
      // 至少有一个 SKU 的关闭档发的是「仍在思考」的值（而不是缺省或真关闭）。
      // ⚠ 这里必须【独立于】production 的 isRealOff 判断 —— 上一版把同一段字符串
      // 嗅探抄了过来，于是 {enable_thinking:false} 这种布尔关法两边一起漏，测试全绿。
      const stillThinks = p.models.some((m) => {
        const off = m.thinkingWire?.off
        return Boolean(off) && !KNOWN_DISABLE_SHAPES.includes(JSON.stringify(off))
      })
      expect(stillThinks, `${p.key} 被标成关不掉，但没有任何 SKU 的关闭档在思考 —— 标记或形态有一个是错的`).toBe(true)
    }
  })

  it('逐 SKU 判：同一家里「真关得掉」与「关不掉」并存', () => {
    // 目录把 moonshot 整体标成关不掉，但那只对 k3 成立：k2.6 的关闭档是真关闭
    expect(canDisableThinking('moonshot', 'kimi-k3')).toBe(false)
    expect(canDisableThinking('moonshot', 'kimi-k2.6')).toBe(true)
    // 反过来：claude 整体能关，但 Fable 5 是 Always on（关闭档没有形态）
    expect(canDisableThinking('claude', 'claude-opus-5')).toBe(true)
    expect(canDisableThinking('claude', 'claude-fable-5')).toBe(false)
    // 压根不思考的 SKU 无所谓关不关
    expect(canDisableThinking('minimax', 'MiniMax-M2.7')).toBe(true)
  })

  it('布尔关法也算真关 —— 只认字符串会对着真能关的服务商喊「仍会计费」', () => {
    // 用未列出的型号，走 provider 级形态：形状固定，不随目录改型号清单而漂
    expect(canDisableThinking('qwen', 'my-self-hosted')).toBe(true) // {enable_thinking:false}
    expect(canDisableThinking('qianfan', 'my-self-hosted')).toBe(true) // 同上
    expect(canDisableThinking('openrouter', 'my-self-hosted')).toBe(true) // {reasoning:{enabled:false}}
    expect(canDisableThinking('grok', 'my-self-hosted')).toBe(false) // reasoning_effort:'low'，还在想
  })

  it('能关闭的照旧判为 true，未知的按能关处理', () => {
    expect(canDisableThinking('deepseek')).toBe(true)
    expect(canDisableThinking('claude')).toBe(true)
    expect(canDisableThinking(undefined)).toBe(true)
    expect(canDisableThinking('不存在的服务商')).toBe(true)
  })
})

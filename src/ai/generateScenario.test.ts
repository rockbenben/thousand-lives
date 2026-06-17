import { describe, it, expect } from 'vitest'
import { generateScenario } from './generateScenario'
import type { ChatFn } from './client'
import { importScenarioSchema } from '../scenarios/schema'
import type { AIConfig } from './types'

const cfg: AIConfig = { provider: 'openai', apiKey: 'k', model: 'm' }

const SKELETON = JSON.stringify({
  title: '测试人生',
  emoji: '🎲',
  intro: '一段用于测试的人生。',
  attributes: [
    {
      key: 'hp',
      name: '生命',
      initial: 80,
      max: 100,
      deathBelow: 0,
      bands: [
        { upTo: 20, label: '濒死', severity: 'critical' },
        { upTo: 100, label: '康健', severity: 'normal' },
      ],
    },
    {
      key: 'gold',
      name: '财富',
      initial: 10,
      max: 100,
      bands: [
        { upTo: 50, label: '清贫', severity: 'low' },
        { upTo: 100, label: '富足', severity: 'high' },
      ],
    },
  ],
  openings: [{ name: '平民', prompt: '普通出身' }],
  ambitions: ['发财致富'],
  turnUnit: '年',
  maxTurns: 20,
  systemPrompt: '测试主持规则：hp 归零即死，gold 越高越富。',
  endings: [
    { condition: 'hp<=0', tone: '英年早逝' },
    { condition: 'maxTurns & gold>=80', tone: '富甲一方' },
    { condition: 'maxTurns', tone: '平凡一生' },
  ],
})

// 每次调用产出一批 summary 唯一的事件；首批掺入「全非法 effects」与「部分非法 effects」各一条以验证清洗
function makeMockChat(): ChatFn {
  let call = 0
  return async (_cfg, messages) => {
    const sys = messages[0]?.content ?? ''
    if (sys.includes('剧本「骨架」')) return SKELETON
    const c = call++
    const base = c * 5
    type Ev = { narrative: string; choices: { text: string; effects: Record<string, number> }[]; summary: string }
    const events: Ev[] = Array.from({ length: 5 }, (_, i) => ({
      narrative: `第 ${base + i} 个测试情境，颇有张力。`,
      choices: [
        { text: '稳妥应对', effects: { hp: -3, gold: 5 } },
        { text: '冒险一搏', effects: { hp: -8, gold: 12 } },
      ],
      summary: `事件${base + i}`,
    }))
    if (c === 0) {
      events.push({
        narrative: '全是非法属性键，应被丢弃。',
        choices: [
          { text: 'A', effects: { bogus: 5 } },
          { text: 'B', effects: { junk: 1 } },
        ],
        summary: '应丢弃',
      })
      events.push({
        narrative: '混入非法键，应被清洗后保留。',
        choices: [
          { text: 'A', effects: { bogus: 5, hp: -2 } },
          { text: 'B', effects: { gold: 4 } },
        ],
        summary: '部分非法',
      })
    }
    return JSON.stringify({ events })
  }
}

describe('generateScenario', () => {
  it('两阶段生成并通过 importScenarioSchema 校验', async () => {
    const sc = await generateScenario(cfg, '武侠江湖', { target: 12, batchSize: 5, chatFn: makeMockChat() })
    expect(() => importScenarioSchema.parse(sc)).not.toThrow()
    expect(sc.id.startsWith('gen-')).toBe(true)
    expect(sc.title).toBe('测试人生')
    expect(sc.localEvents!.length).toBe(12)
    // summary 全唯一
    const sums = sc.localEvents!.map((e) => e.summary)
    expect(new Set(sums).size).toBe(sums.length)
    // 全非法 effects 的事件被丢弃
    expect(sums).not.toContain('应丢弃')
  })

  it('清洗非法 effects 键，保留合法键', async () => {
    const sc = await generateScenario(cfg, 't', { target: 12, batchSize: 5, chatFn: makeMockChat() })
    const partial = sc.localEvents!.find((e) => e.summary === '部分非法')
    expect(partial).toBeDefined()
    // bogus 被剔除，hp 保留
    expect(partial!.choices[0].effects).toEqual({ hp: -2 })
  })

  it('events 阶段被取消（signal abort）应中止并向上抛出，不静默吞掉后产出残缺剧本', async () => {
    const ac = new AbortController()
    const chatFn: ChatFn = async (_cfg, messages) => {
      const sys = messages[0]?.content ?? ''
      if (sys.includes('剧本「骨架」')) return SKELETON
      // 进入 events 阶段即模拟用户点「取消生成」：abort 后请求抛错
      ac.abort()
      throw new Error('aborted')
    }
    // 修复前：catch{continue} 吞掉 abort → 空转后带 0 事件 resolve（onCreated 会提交残缺剧本）
    // 修复后：检测 signal.aborted → 向上抛出 → 调用方按 abort 忽略，不提交
    await expect(
      generateScenario(cfg, '武侠', { target: 40, batchSize: 5, chatFn, signal: ac.signal }),
    ).rejects.toThrow()
  })

  it('所有批次都产不出有效事件时应抛错，而非静默提交 0 支线（无本地模式）的残缺剧本', async () => {
    const chatFn: ChatFn = async (_cfg, messages) => {
      const sys = messages[0]?.content ?? ''
      if (sys.includes('剧本「骨架」')) return SKELETON
      return JSON.stringify({ events: [] }) // 每轮都产不出有效事件
    }
    await expect(generateScenario(cfg, 't', { target: 12, batchSize: 5, chatFn })).rejects.toThrow()
  })

  it('id 避开已占用 id', async () => {
    const sc = await generateScenario(cfg, 'wuxia', {
      target: 5,
      batchSize: 5,
      existingIds: ['gen-wuxia'],
      chatFn: makeMockChat(),
    })
    expect(sc.id).toBe('gen-wuxia-2')
  })
})

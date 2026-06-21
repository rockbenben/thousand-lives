import { describe, it, expect, vi } from 'vitest'
import { scenarioSchema, type Scenario } from '../scenarios/schema'
import { initState } from '../engine/state'
import { visibleNarrative } from './turn'
import { localSource, aiSource } from './turnSource'
import type { AIConfig } from './types'

vi.mock('./client', () => ({ requestTurn: vi.fn() }))
import { requestTurn } from './client'

const sc: Scenario = scenarioSchema.parse({
  id: 'ts', title: '测试', emoji: '🎲', intro: '开局',
  attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 }],
  maxTurns: 10, systemPrompt: 'GM',
  endings: [{ condition: 'maxTurns', tone: '终' }],
  localEvents: [
    { narrative: '事件A', choices: [{ text: 'a1', effects: { hp: -5 } }, { text: 'a2', effects: {} }], summary: 'A' },
    { narrative: '事件B', choices: [{ text: 'b1', effects: {} }, { text: 'b2', effects: {} }], summary: 'B' },
  ],
})

describe('TurnSource', () => {
  it('localSource：非流式 / 无自由行动 / 注入随机 / 同步从事件池产出回合', async () => {
    const s = localSource()
    expect(s.mode).toBe('local')
    expect(s.streaming).toBe(false)
    expect(s.supportsCustomAction).toBe(false)
    expect(typeof s.choiceRng).toBe('function')
    const turn = await s.generate({ scenario: sc, state: initState(sc) })
    expect(turn.choices.length).toBeGreaterThan(0)
    expect(typeof turn.narrative).toBe('string')
  })

  it('aiSource：流式 / 支持自由行动 / 不注入随机（模型自带变数）', () => {
    const s = aiSource(() => ({}) as AIConfig)
    expect(s.mode).toBe('ai')
    expect(s.streaming).toBe(true)
    expect(s.supportsCustomAction).toBe(true)
    expect(s.choiceRng).toBeUndefined()
  })

  it('aiSource.generate：取最新配置、构造消息、流式回调包裹 visibleNarrative', async () => {
    const cfg = { model: 'x' } as unknown as AIConfig
    const mockTurn = { narrative: 'n', choices: [], summary: 's' }
    const raw = '正文前<think>隐藏推理</think>正文后'
    vi.mocked(requestTurn).mockImplementation(async (_cfg, _msgs, _chatFn, onDelta) => {
      onDelta?.(raw)
      return mockTurn as never
    })
    const seen: string[] = []
    const s = aiSource(() => cfg)
    const turn = await s.generate({
      scenario: sc,
      state: initState(sc),
      onStream: (v) => seen.push(v),
      signal: new AbortController().signal,
    })
    expect(turn).toBe(mockTurn)
    // 用的是 getConfig 返回的「最新」配置
    expect(vi.mocked(requestTurn).mock.calls[0][0]).toBe(cfg)
    // onStream 收到的是 visibleNarrative 处理后的可见正文，而非原始流
    expect(seen).toEqual([visibleNarrative(raw)])
  })

  it('aiSource.generate：配置缺失时 getConfig 抛错透传', async () => {
    const s = aiSource(() => {
      throw new Error('未找到 API 配置')
    })
    await expect(s.generate({ scenario: sc, state: initState(sc) })).rejects.toThrow('未找到 API 配置')
  })
})

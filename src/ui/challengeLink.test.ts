import { describe, it, expect } from 'vitest'
import { buildShareUrl, parseChallenge } from './challengeLink'
import { builtinScenarios } from '../scenarios'
import type { Scenario } from '../scenarios/schema'

const sc = builtinScenarios.find((b) => b.id === 'xian')!
const hasOpenings = (sc.openings?.length ?? 0) > 0

describe('challengeLink', () => {
  it('buildShareUrl：内置指向 /s/ 入口页、自定义回退首页', () => {
    expect(buildShareUrl(sc, 1, 'https://x.io/')).toBe('https://x.io/s/xian-1/')
    expect(buildShareUrl(sc, undefined, 'https://x.io/')).toBe('https://x.io/s/xian/')
    expect(buildShareUrl(sc, 1, 'https://x.io/index.html')).toBe('https://x.io/s/xian-1/')
    const custom = { ...sc, id: 'c1' } as Scenario
    expect(buildShareUrl(custom, 1, 'https://x.io/')).toBe('https://x.io/')
  })
  it('parseChallenge 往返', () => {
    if (hasOpenings) expect(parseChallenge('?s=xian&o=0')).toEqual({ scenarioId: 'xian', opening: 0 })
    expect(parseChallenge('s=xian')).toEqual({ scenarioId: 'xian', opening: undefined })
  })
  it('未知剧本 / 缺 s → null', () => {
    expect(parseChallenge('?s=nope')).toBeNull()
    expect(parseChallenge('?x=1')).toBeNull()
  })
  it('opening 越界 / 负数 → 丢弃', () => {
    const n = sc.openings?.length ?? 0
    expect(parseChallenge(`?s=xian&o=${n + 99}`)?.opening).toBeUndefined()
    expect(parseChallenge('?s=xian&o=-1')?.opening).toBeUndefined()
  })
})

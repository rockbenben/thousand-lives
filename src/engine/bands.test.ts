import { describe, it, expect } from 'vitest'
import { bandOf } from './bands'
import type { Attribute } from '../scenarios/schema'

const withBands: Attribute = {
  key: 'sanity', name: '理智', initial: 80, max: 100,
  bands: [
    { upTo: 20, label: '崩溃', severity: 'critical' },
    { upTo: 50, label: '动摇', severity: 'low' },
    { upTo: 100, label: '清醒', severity: 'normal' },
  ],
}

const noBands: Attribute = { key: 'gold', name: '金币', initial: 50, max: 100 }

describe('bandOf', () => {
  it('命中第一个 value <= upTo 的段（边界含上界）', () => {
    expect(bandOf(withBands, 0).label).toBe('崩溃')
    expect(bandOf(withBands, 20).label).toBe('崩溃')
    expect(bandOf(withBands, 21).label).toBe('动摇')
    expect(bandOf(withBands, 50).label).toBe('动摇')
    expect(bandOf(withBands, 51).label).toBe('清醒')
    expect(bandOf(withBands, 100).label).toBe('清醒')
  })

  it('超出最后一段上界归入最后一段', () => {
    expect(bandOf(withBands, 999).label).toBe('清醒')
  })

  it('未定义 bands 时按占比派生通用分段', () => {
    expect(bandOf(noBands, 10).severity).toBe('critical') // 10%
    expect(bandOf(noBands, 30).severity).toBe('low') // 30%
    expect(bandOf(noBands, 60).severity).toBe('normal') // 60%
    expect(bandOf(noBands, 95).severity).toBe('high') // 95%
  })
})

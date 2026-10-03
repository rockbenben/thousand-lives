import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { achievementConfig } from './achievementConfig'

// 旧存档按 tone 字符串记账（storage.ts tl.endings）、成就按 legend.tone 精确匹配，
// 且零测试交叉校验过——tone 改名会静默回退通关进度、让传说成就可重复解锁。本测试补这条红线。
describe('成就配置 ↔ 剧本交叉校验', () => {
  for (const sc of builtinScenarios) {
    const cfg = achievementConfig[sc.id as keyof typeof achievementConfig]
    it(`${sc.id}: 有对应成就配置`, () => {
      expect(cfg, `剧本 ${sc.id} 缺成就配置（legend/clear/complete）`).toBeTruthy()
    })
    if (!cfg) continue
    it(`${sc.id}: legend.tone 存在于结局集`, () => {
      // legend 在配置类型里是可选的（achievements.ts:41），先断言存在再读 tone，报错意图不变。
      expect(cfg.legend, `剧本 ${sc.id} 的成就配置缺 legend`).toBeTruthy()
      const tones = new Set(sc.endings.map((e) => e.tone))
      expect(tones.has(cfg.legend!.tone), `legend.tone「${cfg.legend!.tone}」不在 ${sc.id} 的结局 tone 里`).toBe(true)
    })
  }
  it('成就配置没有孤儿剧本键', () => {
    const ids = new Set(builtinScenarios.map((s) => s.id))
    const extra = Object.keys(achievementConfig).filter((k) => !ids.has(k))
    expect(extra, `配置里有剧本不存在的键: ${extra.join('、')}`).toEqual([])
  })
})

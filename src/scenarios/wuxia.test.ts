import { describe, it, expect } from 'vitest'
import { wuxia } from './wuxia'
import { clampEffects } from '../engine/state'

describe('wuxia 武功境界封顶', () => {
  it('无境界印记时武功封顶 30', () => {
    expect(clampEffects(wuxia, { gongfu: 28 }, { gongfu: 50 }, []).gongfu).toBe(30)
  })
  it('入流印记解锁封顶 50', () => {
    expect(clampEffects(wuxia, { gongfu: 45 }, { gongfu: 50 }, ['入流']).gongfu).toBe(50)
  })
  it('一流印记解锁封顶 70', () => {
    expect(clampEffects(wuxia, { gongfu: 60 }, { gongfu: 50 }, ['入流', '一流']).gongfu).toBe(70)
  })
  it('绝顶印记解锁封顶 88', () => {
    expect(clampEffects(wuxia, { gongfu: 80 }, { gongfu: 50 }, ['入流', '一流', '绝顶']).gongfu).toBe(88)
  })
  it('宗师印记解锁封顶 100', () => {
    expect(clampEffects(wuxia, { gongfu: 95 }, { gongfu: 50 }, ['入流', '一流', '绝顶', '宗师']).gongfu).toBe(100)
  })
  it('性命与侠名不设境界封顶（高于任何印记仍可到 max）', () => {
    expect(clampEffects(wuxia, { life: 95 }, { life: 50 }, []).life).toBe(100)
    expect(clampEffects(wuxia, { fame: 95 }, { fame: 50 }, []).fame).toBe(100)
  })
})

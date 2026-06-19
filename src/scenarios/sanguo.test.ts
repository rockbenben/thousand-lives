import { describe, it, expect } from 'vitest'
import { sanguo } from './sanguo'
import { clampEffects } from '../engine/state'

describe('sanguo 谋略势力封顶', () => {
  it('无势力印记时谋略封顶 30（= initial，不被削）', () => {
    expect(clampEffects(sanguo, { wit: 30 }, { wit: 20 }, []).wit).toBe(30)
  })
  it('据州印记解锁封顶 45', () => {
    expect(clampEffects(sanguo, { wit: 40 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('称雄印记解锁封顶 70', () => {
    expect(clampEffects(sanguo, { wit: 60 }, { wit: 20 }, ['据州', '称雄']).wit).toBe(70)
  })
  it('鼎足印记解锁封顶 88', () => {
    expect(clampEffects(sanguo, { wit: 80 }, { wit: 20 }, ['据州', '称雄', '鼎足']).wit).toBe(88)
  })
  it('霸业印记解锁封顶 100', () => {
    expect(clampEffects(sanguo, { wit: 95 }, { wit: 20 }, ['据州', '称雄', '鼎足', '霸业']).wit).toBe(100)
  })
  it('失势降阶：有据州称雄、失称雄后谋略上限回落 45', () => {
    // flagsClear 把 称雄 去掉，只剩 据州 → ceiling 45
    expect(clampEffects(sanguo, { wit: 45 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('声望与信任不设封顶；信任带每年衰减', () => {
    expect(clampEffects(sanguo, { repute: 95 }, { repute: 20 }, []).repute).toBe(100)
    expect(sanguo.attributes.find((a) => a.key === 'trust')!.decayPerTurn).toBe(1)
  })
})

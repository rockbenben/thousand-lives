import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { clampEffects, initState, checkEnding } from '../engine/state'

const xian = builtinScenarios.find((s) => s.id === 'xian')!

describe('xian 境界封顶', () => {
  it('无印记时修为封顶 20（炼气）', () => {
    expect(clampEffects(xian, { cultivation: 19 }, { cultivation: 50 }, []).cultivation).toBe(20)
  })
  it('持金丹印记修为可达 70', () => {
    expect(clampEffects(xian, { cultivation: 60 }, { cultivation: 50 }, ['筑基', '金丹']).cultivation).toBe(70)
  })
  it('持化神印记修为可达满 100', () => {
    expect(clampEffects(xian, { cultivation: 90 }, { cultivation: 50 }, ['筑基', '金丹', '元婴', '化神']).cultivation).toBe(100)
  })
  it('寿元上限随境界印记抬高', () => {
    // 无印记寿元封顶 60；持元婴印记封顶 96
    expect(clampEffects(xian, { lifespan: 55 }, { lifespan: 50 }, []).lifespan).toBe(60)
    expect(clampEffects(xian, { lifespan: 90 }, { lifespan: 50 }, ['筑基', '金丹', '元婴']).lifespan).toBe(96)
  })
})

describe('xian 身份印记', () => {
  it('每个开局写入对应身份印记', () => {
    const byName = (n: string) => xian.openings!.find((o) => o.name === n)!
    expect(initState(xian, byName('草根散修')).flags).toEqual(['散修'])
    expect(initState(xian, byName('仙门弟子')).flags).toEqual(['仙门'])
    expect(initState(xian, byName('魔道余孽')).flags).toEqual(['魔道'])
  })
})

describe('xian 结局重挂', () => {
  it('无 maxTurns：第 30 回合不自动收场', () => {
    expect(checkEnding(xian, { cultivation: 40, daoHeart: 50, lifespan: 40 }, 30, ['筑基'])).toBeNull()
  })
  it('寿元将尽按境界分流', () => {
    expect(checkEnding(xian, { cultivation: 70, daoHeart: 60, lifespan: 8 }, 40, ['筑基', '金丹'])?.tone).toBe('金丹寿尽·享寿千载')
    expect(checkEnding(xian, { cultivation: 15, daoHeart: 50, lifespan: 8 }, 40, [])?.tone).toBe('炼气蹉跎·泯然众生')
  })
  it('飞升不受寿元门控，到点即触', () => {
    expect(checkEnding(xian, { cultivation: 96, daoHeart: 75, lifespan: 50 }, 20, ['筑基','金丹','元婴','化神'])?.tone).toBe('渡劫飞升·得道成仙')
  })
})

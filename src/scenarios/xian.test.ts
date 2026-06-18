import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { clampEffects, initState, checkEnding, applyChoice } from '../engine/state'
import { parseCondition } from '../engine/condition'

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

describe('xian 守护', () => {
  it('结局条件全部可解析（含 has()）', () => {
    for (const e of xian.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
})

describe('xian 突破机缘', () => {
  it('四个核心突破机缘事件均存在（筑基/金丹/元婴/化神）', () => {
    const count = (xian.localEvents ?? []).filter(
      (e) => /筑基机缘|金丹机缘|元婴机缘|化神机缘/.test(e.summary),
    ).length
    expect(count).toBeGreaterThanOrEqual(4)
  })

  it('筑基机缘成功授「筑基」印记并解锁更高修为', () => {
    // 构造：修为 19（炼气顶）、第 5 回合、散修开局
    let st = initState(xian, xian.openings!.find((o) => o.name === '草根散修'))
    st = {
      ...st,
      attributes: { cultivation: 19, daoHeart: 60, lifespan: 55 },
      history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }),
    }
    // 直接构造一个筑基突破 TurnResult（取自事件池中 summary 含「筑基机缘」的事件）
    const ev = (xian.localEvents ?? []).find((e) => e.summary.includes('筑基机缘'))
    expect(ev).toBeTruthy()
    // 取其「稳妥成功」选项（带 outcomes，成功分支 flagsSet 含 筑基）
    const tr = {
      narrative: ev!.narrative,
      summary: ev!.summary,
      choices: ev!.choices.map((c) => ({
        text: c.text,
        effects: c.effects,
        outcomes: c.outcomes,
        flagsSet: c.flagsSet,
        flagsClear: c.flagsClear,
        endTone: c.endTone,
      })),
    }
    const idx = tr.choices.findIndex(
      (c) =>
        (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('筑基')) ||
        (c.flagsSet ?? []).includes('筑基'),
    )
    expect(idx).toBeGreaterThanOrEqual(0)
    // rng=0 取首个 outcome（事件作者把成功分支放第一、权重最高）
    const next = applyChoice(xian, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('筑基')
    // 现在修为可超过 20（封顶已抬到 45）
    expect(clampEffects(xian, next.attributes, { cultivation: 30 }, next.flags!).cultivation).toBeGreaterThan(20)
  })
})

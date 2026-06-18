import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { clampEffects, initState, checkEnding, applyChoice } from '../engine/state'
import { parseCondition } from '../engine/condition'
import { localTurn } from '../engine/local'

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
    expect(checkEnding(xian, { cultivation: 96, daoHeart: 92, lifespan: 50 }, 20, ['筑基','金丹','元婴','化神'])?.tone).toBe('渡劫飞升·得道成仙')
  })
  it('飞升需修为>=96 且道心>=90，仅到化神+中低道心不触发', () => {
    // 有化神印记、道心 85（不足90）、修为 96 → 不应飞升
    const r = checkEnding(xian, { cultivation: 96, daoHeart: 85, lifespan: 50 }, 40, ['筑基','金丹','元婴','化神'])
    expect(r?.tone === '渡劫飞升·得道成仙').toBe(false)
  })
})

describe('xian 守护', () => {
  it('结局条件全部可解析（含 has()）', () => {
    for (const e of xian.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
})

describe('xian 跳出三界门控', () => {
  it('has(化神) & daoHeart>=100 → 跳出三界·不在五行', () => {
    // cult 92, dao 100（满值）, 持化神印记 → 触发跳出三界
    const r = checkEnding(xian, { cultivation: 92, daoHeart: 100, lifespan: 50 }, 40, ['筑基', '金丹', '元婴', '化神'])
    expect(r?.tone).toBe('跳出三界·不在五行')
  })
  it('无化神印记时不触发跳出三界', () => {
    // cult 92, dao 100，但无化神印记 → 不触发跳出三界
    const r = checkEnding(xian, { cultivation: 92, daoHeart: 100, lifespan: 50 }, 40, ['筑基', '金丹', '元婴'])
    expect(r?.tone === '跳出三界·不在五行').toBe(false)
  })
})

describe('xian 身份起点分化', () => {
  // 第 1 回合（history 为空）抽中各身份起点事件的概率（高权重应≈必中）
  const startHitRate = (flag: string) => {
    const base = initState(xian, undefined, undefined, 'local')
    const st = { ...base, flags: [flag], history: [] as typeof base.history }
    let hit = 0
    for (let i = 0; i < 300; i++) {
      const tr = localTurn(xian, st, () => Math.random())
      if (tr.summary.includes(`${flag}起点`)) hit++
    }
    return hit / 300
  }
  it('三身份第1回合高概率命中各自起点事件', () => {
    expect(startHitRate('魔道')).toBeGreaterThan(0.9)
    expect(startHitRate('仙门')).toBeGreaterThan(0.9)
    expect(startHitRate('散修')).toBeGreaterThan(0.9)
  })
})

describe('xian 突破机缘', () => {
  it('四个核心突破机缘事件均存在（筑基/金丹/元婴/化神）', () => {
    const count = (xian.localEvents ?? []).filter(
      (e) => /筑基机缘|金丹机缘|元婴机缘|化神机缘/.test(e.summary),
    ).length
    expect(count).toBeGreaterThanOrEqual(4)
  })

  it('四突破机缘标为 keyMoment（剧情大卡/留影）', () => {
    const km = (xian.localEvents ?? []).filter(
      (e) => e.keyMoment && /筑基机缘|金丹机缘|元婴机缘|化神机缘/.test(e.summary),
    )
    expect(km.length).toBe(4)
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

describe('xian 魔道弧 + 正道追缉', () => {
  it('存在魔道屠戮事件可埋下正道追缉印记', () => {
    const seedEv = (xian.localEvents ?? []).find((e) =>
      e.requires?.includes('魔道') &&
      e.choices.some((c) => (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('正道追缉'))))
    expect(seedEv).toBeTruthy()
  })
  it('存在 requires has(正道追缉) 的追杀回收事件', () => {
    const payoff = (xian.localEvents ?? []).find((e) => e.requires?.includes('正道追缉'))
    expect(payoff).toBeTruthy()
    expect(payoff!.choices.some((c) => (c.flagsClear ?? []).includes('正道追缉') ||
      (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('正道追缉')))).toBe(true)
  })
})

describe('xian 仙门弧', () => {
  it('存在 requires has(仙门) 的支线事件（≥3）', () => {
    const evs = (xian.localEvents ?? []).filter((e) => e.requires?.includes('仙门'))
    expect(evs.length).toBeGreaterThanOrEqual(3)
  })
})

describe('xian 散修弧', () => {
  it('存在 requires has(散修) 的支线事件（≥3）', () => {
    const evs = (xian.localEvents ?? []).filter((e) => e.requires?.includes('散修'))
    expect(evs.length).toBeGreaterThanOrEqual(3)
  })
})

describe('xian 因果种子', () => {
  const seeds = ['善缘老者', '宿怨仇敌', '传艺之徒', '受恩散修']
  it('每组种子都有埋种与回收事件', () => {
    for (const s of seeds) {
      const plant = (xian.localEvents ?? []).find((e) =>
        e.choices.some((c) => (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(s))))
      const reap = (xian.localEvents ?? []).find((e) => e.requires?.includes(s))
      expect(plant, `${s} 埋种`).toBeTruthy()
      expect(reap, `${s} 回收`).toBeTruthy()
      const clears = reap!.choices.some((c) => (c.flagsClear ?? []).includes(s)) ||
        reap!.choices.some((c) => (c.outcomes ?? []).length > 0 && (c.outcomes ?? []).every((o) => (o.flagsClear ?? []).includes(s)))
      expect(clears, `${s} 回收清除印记`).toBe(true)
    }
  })
})

describe('xian 隐藏天堂地狱', () => {
  it('三个隐藏结局基调存在且 condition 永不自然成立', () => {
    const tones = ['误入杀阵·横死当场', '凶煞缠身·暴毙荒野', '仙缘垂青·一步登天']
    for (const t of tones) {
      const e = xian.endings.find((x) => x.tone === t)
      expect(e, t).toBeTruthy()
      expect(e!.condition).toBe('lifespan<=-1')
    }
    // 满血也不会自然触发任何隐藏结局
    const r = checkEnding(xian, { cultivation: 50, daoHeart: 80, lifespan: 80 }, 20, ['筑基'])
    expect(tones.includes(r?.tone ?? '')).toBe(false)
  })
  it('存在带 endTone 的隐藏地狱事件（minTurn>=10）', () => {
    const hell = (xian.localEvents ?? []).find((e) =>
      (e.minTurn ?? 0) >= 10 &&
      e.choices.some((c) => c.endTone || (c.outcomes ?? []).some((o) => o.endTone)))
    expect(hell).toBeTruthy()
  })
})

describe('xian systemPrompt 末法世界观', () => {
  it('含末法/机缘稀缺/境界突破/隐藏结局极稀有的指导', () => {
    const sp = xian.systemPrompt
    expect(sp).toMatch(/末法|灵气衰微/)
    expect(sp).toMatch(/机缘|突破/)
    expect(sp).toMatch(/极稀有|天威难测/) // 约束 endTone 不滥用
  })
})

describe('xian L2b 守护', () => {
  it('所有结局条件可解析', () => {
    for (const e of xian.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
  it('所有致死/暴毙类隐藏事件 minTurn>=10', () => {
    const lethal = (xian.localEvents ?? []).filter((e) =>
      e.choices.some((c) => c.endTone?.match(/横死|暴毙|身死|形神/) ||
        (c.outcomes ?? []).some((o) => o.endTone?.match(/横死|暴毙|身死|形神/))))
    for (const e of lethal) expect(e.minTurn ?? 0).toBeGreaterThanOrEqual(10)
  })
})

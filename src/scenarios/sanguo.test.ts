import { describe, it, expect } from 'vitest'
import { sanguo } from './sanguo'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

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
    expect(sanguo.attributes.find((a) => a.key === 'trust')!.decayPerTurn).toBe(3) // sim 校准：原 4 过陡，用心辅佐也常被迫君臣离心；下调至 3 后 careful 玩法坏结局 41%→32%
  })
})

describe('sanguo 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门游学士子', '世家子弟', '降将谋臣']) {
      const op = sanguo.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(sanguo, op).flags).toContain(n)
    }
  })
  it('身份专属事件带 has() 门控（至少各一）', () => {
    const evs = sanguo.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('降将谋臣')).toBeGreaterThanOrEqual(1)
    expect(byFlag('世家子弟')).toBeGreaterThanOrEqual(1)
    expect(byFlag('寒门游学士子')).toBeGreaterThanOrEqual(1)
  })
  it('降将密告 身份门控与既有数值条件合并（不覆盖原 wit>=50）', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '降将密告')
    expect(ev?.requires).toContain('has(降将谋臣)')
    expect(ev?.requires).toContain('wit>=50')
  })
})

describe('sanguo 升势闸门', () => {
  it('四道升势机缘均为 keyMoment 且授对应势力印记、按序串链', () => {
    const want = [
      { summary: '助主据州', flag: '据州', prev: undefined },
      { summary: '助主称雄', flag: '称雄', prev: '据州' },
      { summary: '三分定策', flag: '鼎足', prev: '称雄' },
      { summary: '一统在望', flag: '霸业', prev: '鼎足' },
    ]
    for (const w of want) {
      const ev = (sanguo.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      expect(ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag)), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('助主据州后同回合谋略可破 30 上限', () => {
    let st = initState(sanguo, sanguo.openings!.find((o) => o.name === '寒门游学士子'))
    st = { ...st, attributes: { wit: 30, repute: 40, trust: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '助主据州')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据州'))
    const next = applyChoice(sanguo, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('据州')
    expect(next.attributes.wit).toBeGreaterThan(30)
  })
})

describe('sanguo 势力 volatility（升降可逆 + 改投）', () => {
  it('择主投效 设主公印记', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '择主投效')!
    expect(ev.keyMoment).toBe(true)
    // 三选项各授一个不同的主公印记（强主/明主/汉室），不是只有一个有 flag
    const lordFlags = ev.choices.map((c) => (c.flagsSet ?? [])[0])
    expect(new Set(lordFlags)).toEqual(new Set(['强主', '明主', '汉室']))
  })
  it('主公丧师失地：有鼎足者失势 flagsClear 掉鼎足', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '主公丧师失地')!
    expect(ev.requires).toContain('has(鼎足)')
    const drops = ev.choices.some((c) => (c.flagsClear ?? []).includes('鼎足') || (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('鼎足')))
    expect(drops).toBe(true)
  })
  it('失势后谋略上限回落（鼎足→称雄，clampEffects 用清后印记）', () => {
    // 构造 has(据州,称雄,鼎足) state、取失势选项 → 清掉鼎足 → flags 不含鼎足 → 上限回 70
    let st = initState(sanguo, sanguo.openings![0])
    st = { ...st, attributes: { wit: 88, repute: 50, trust: 50 }, flags: ['据州', '称雄', '鼎足'], history: Array(20).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '主公丧师失地')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsClear ?? []).includes('鼎足') || (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('鼎足')))
    const next = applyChoice(sanguo, st, tr as any, idx, () => 0.999)
    expect(next.flags).not.toContain('鼎足')
    // 上限回 70：再给 wit+20 应被压在 70
    expect(clampEffects(sanguo, next.attributes, { wit: 20 }, next.flags!).wit).toBe(70)
  })
  it('敌国招揽 改投选项清空全部势力印记', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '敌国招揽')!
    expect(ev.requires).toContain('has(据州)')
    const reinvest = ev.choices.find((c) => (c.flagsClear ?? []).includes('据州'))
    expect(reinvest).toBeTruthy()
    for (const f of ['据州', '称雄', '鼎足', '霸业']) expect(reinvest!.flagsClear).toContain(f)
  })
  it('站错主公·身死族灭 结局存在且为哨兵（主公丧师失地的 endTone 落点，本任务自洽）', () => {
    const e = sanguo.endings.find((x) => x.tone === '站错主公·身死族灭')
    expect(e?.condition).toBe('trust<=-1')
  })
})

describe('sanguo 隐藏 endTone', () => {
  it('新增三哨兵隐藏结局 trust<=-1', () => {
    for (const t of ['站错主公·身死族灭', '功高震主·赐死狱中', '一言定鼎·名动天下']) {
      const e = sanguo.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('trust<=-1')
    }
  })
  it('功高震主 含低权赐死 endTone 分支', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '功高震主')!
    const has = ev.choices.some((c) => (c.outcomes ?? []).some((o) => o.endTone === '功高震主·赐死狱中'))
    expect(has).toBe(true)
  })
  it('每个哨兵基调都被某事件 endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of sanguo.localEvents ?? []) for (const c of ev.choices) for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
    for (const t of ['站错主公·身死族灭', '功高震主·赐死狱中', '一言定鼎·名动天下']) expect(used.has(t), t).toBe(true)
  })
})

describe('sanguo 巅峰结局须 maxTurns + 经天纬地须霸业', () => {
  it('满血高谋略在非落幕年不触发巅峰', () => {
    const r = checkEnding(sanguo, { wit: 98, repute: 98, trust: 98 }, 18, ['据州', '称雄', '鼎足', '霸业'])
    for (const t of ['经天纬地·名相千古', '算无遗策·智极而孤', '海内名士·万世景仰']) {
      expect(r?.tone === t, t).toBe(false)
    }
  })
  it('落幕年有霸业+高信任 → 经天纬地', () => {
    const r = checkEnding(sanguo, { wit: 98, trust: 90, repute: 60 }, 30, ['据州', '称雄', '鼎足', '霸业'])
    expect(r?.tone).toBe('经天纬地·名相千古')
  })
  it('落幕年高谋略但无霸业（失势/改投后）→ 落算无遗策而非经天纬地', () => {
    // wit 96 但 flags 无霸业（曾有后被清）
    const r = checkEnding(sanguo, { wit: 98, trust: 90, repute: 60 }, 30, ['据州', '称雄', '鼎足'])
    expect(r?.tone).toBe('算无遗策·智极而孤')
  })
})

describe('sanguo AI 模式', () => {
  it('tierLabel=势力，晋阶之序用本剧术语「势力」+ 势力印记序', () => {
    const st = initState(sanguo, sanguo.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(sanguo, st).map((m) => m.content).join('\n')
    expect(sanguo.tierLabel).toBe('势力')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('势力')
    expect(all).toContain('据州→称雄→鼎足→霸业')
    expect(all).not.toContain('封顶')
    expect(all).toContain('一言定鼎') // 隐藏天堂 tone 经词表注入
  })
  it('systemPrompt 含势力沉浮/改投规则与横祸极稀指导', () => {
    expect(sanguo.systemPrompt).toContain('势力')
    expect(sanguo.systemPrompt).toContain('改换门庭')
  })
  it('提示不含「共 undefined」', () => {
    const st = initState(sanguo, sanguo.openings![0], undefined, 'ai')
    expect(buildTurnMessages(sanguo, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

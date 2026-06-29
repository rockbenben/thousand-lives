import { describe, it, expect } from 'vitest'
import { scifi } from './scifi'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('scifi 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      殖民舰长: '殖民舰长',
      首席科学家: '首席科学家',
      临危受命的代理舰长: '代理舰长',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = scifi.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(scifi, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = scifi.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('殖民舰长')).toBeGreaterThanOrEqual(1)
    expect(byFlag('首席科学家')).toBeGreaterThanOrEqual(1)
    expect(byFlag('代理舰长')).toBeGreaterThanOrEqual(1)
  })
})

describe('scifi 科技航程封顶', () => {
  it('无航程印记时科技封顶 25（= base，≥ initial 不被削）', () => {
    expect(clampEffects(scifi, { tech: 25 }, { tech: 20 }, []).tech).toBe(25)
  })
  it('开局科技 15 不被 base ceiling 削', () => {
    expect(clampEffects(scifi, { tech: 15 }, {}, []).tech).toBe(15)
  })
  it('深空→45 越障→70 抵近→90 扎根→100 逐级解锁', () => {
    expect(clampEffects(scifi, { tech: 40 }, { tech: 30 }, ['深空']).tech).toBe(45)
    expect(clampEffects(scifi, { tech: 60 }, { tech: 30 }, ['深空', '越障']).tech).toBe(70)
    expect(clampEffects(scifi, { tech: 85 }, { tech: 30 }, ['深空', '越障', '抵近']).tech).toBe(90)
    expect(clampEffects(scifi, { tech: 95 }, { tech: 30 }, ['深空', '越障', '抵近', '扎根']).tech).toBe(100)
  })
  it('船体与文明不设航程封顶', () => {
    expect(clampEffects(scifi, { integrity: 95 }, { integrity: 20 }, []).integrity).toBe(100)
    expect(clampEffects(scifi, { colony: 95 }, { colony: 20 }, []).colony).toBe(100)
  })
})

describe('scifi 升程闸门', () => {
  it('四道升程机缘均为 keyMoment、授对应航程印记、按序串链', () => {
    const want = [
      { summary: '水源告急', flag: '深空', prev: undefined, pick: '研发新型水循环装置' },
      { summary: '陨石带', flag: '越障', prev: '深空', pick: '研发临时护盾再穿越' },
      { summary: '候选行星', flag: '抵近', prev: '越障', pick: '改道详查，或是新家园' },
      { summary: '第一座城', flag: '扎根', prev: '抵近', pick: '开放包容，广纳人心' },
    ]
    for (const w of want) {
      const ev = (scifi.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扎根闸门保留 colony>=50 数值门控（不被 has 覆盖）', () => {
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '第一座城')!
    expect(ev.requires).toContain('has(抵近)')
    expect(ev.requires).toContain('colony>=50')
  })
  it('助渡深空当回合科技可破 25 上限', () => {
    let st = initState(scifi, scifi.openings![0])
    st = { ...st, attributes: { tech: 25, integrity: 60, colony: 50 }, history: Array(3).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '水源告急')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('深空'))
    const next = applyChoice(scifi, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('深空')
    expect(next.attributes.tech).toBeGreaterThan(25)
  })
})

describe('scifi 隐藏 endTone 哨兵', () => {
  const tones = ['清洗续命·血债驶向虚空', '屠灭原民·新世罪基', '星海共生·文明永续']
  it('三哨兵结局存在且 condition 为 colony<=-1', () => {
    for (const t of tones) {
      const e = scifi.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('colony<=-1')
    }
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of scifi.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('默许清洗的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(scifi, scifi.openings![0])
    st = { ...st, attributes: { tech: 50, integrity: 60, colony: 40 }, history: Array(18).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '加密屏前的减员名单')!
    const idx = ev.choices.findIndex((c) => c.text === '默许 AI 的冷酷算计')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    // rng=0.999 → rollOutcome 取末位（endTone 分支）
    const next = applyChoice(scifi, st, tr as any, idx, () => 0.999)
    expect(next.ended?.tone).toBe('清洗续命·血债驶向虚空')
  })
})

describe('scifi AI 模式', () => {
  it('tierLabel=航程，晋阶之序用本剧术语「航程」+ 航程印记序', () => {
    const st = initState(scifi, scifi.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(scifi, st).map((m) => m.content).join('\n')
    expect(scifi.tierLabel).toBe('航程')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('航程')
    expect(all).toContain('深空→越障→抵近→扎根')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含航程晋阶指引', () => {
    expect(scifi.systemPrompt).toContain('航程')
    expect(scifi.systemPrompt).toContain('深空')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(scifi, scifi.openings![0], undefined, 'ai')
    expect(buildTurnMessages(scifi, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

describe('scifi 衰减与 sim 健壮性', () => {
  it('文明火种 decay 经 sim 校准（治文明断绝过低，成活的第二死亡线）', () => {
    const colony = scifi.attributes.find((a) => a.key === 'colony')!
    expect(colony.decayPerTurn).toBe(1) // sim-tuned：decay0 时文明断绝≈0；decay1 后 random 人心尽丧 9.8%
  })
  it('船体每年衰减 2（45 回合重校，原 3）', () => {
    expect(scifi.attributes.find((a) => a.key === 'integrity')!.decayPerTurn).toBe(2)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    // local.ts magOf 直接读 c.effects；带 outcomes 的选项也须有 effects（约定 effects:{}），否则 Object.values 崩。
    for (const ev of scifi.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})

import { describe, it, expect } from 'vitest'
import { spy } from './spy'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('spy 情报功勋封顶', () => {
  it('无功勋印记时情报封顶 15（= base，≥ initial 不被削）', () => {
    expect(clampEffects(spy, { intel: 15 }, { intel: 20 }, []).intel).toBe(15)
  })
  it('立功→50 建功→75 奇功→90 殊勋→100 逐级解锁', () => {
    expect(clampEffects(spy, { intel: 45 }, { intel: 20 }, ['立功']).intel).toBe(50)
    expect(clampEffects(spy, { intel: 70 }, { intel: 20 }, ['立功', '建功']).intel).toBe(75)
    expect(clampEffects(spy, { intel: 85 }, { intel: 20 }, ['立功', '建功', '奇功']).intel).toBe(90)
    expect(clampEffects(spy, { intel: 95 }, { intel: 20 }, ['立功', '建功', '奇功', '殊勋']).intel).toBe(100)
  })
  it('掩护与信任不设功勋封顶', () => {
    expect(clampEffects(spy, { cover: 95 }, { cover: 20 }, []).cover).toBe(100)
    expect(clampEffects(spy, { trust: 95 }, { trust: 20 }, []).trust).toBe(100)
  })
})

describe('spy 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 潜伏特工: '潜伏特工', 双面间谍: '双面间谍', 觉醒的伪职: '觉醒伪职' }
    for (const [name, flag] of Object.entries(want)) {
      const op = spy.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(spy, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = spy.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('潜伏特工')).toBeGreaterThanOrEqual(1)
    expect(byFlag('双面间谍')).toBeGreaterThanOrEqual(1)
    expect(byFlag('觉醒伪职')).toBeGreaterThanOrEqual(1)
  })
})

describe('spy 升功勋闸门', () => {
  it('四道升功勋机缘均为 keyMoment、授对应功勋印记、按序串链', () => {
    const want = [
      { summary: '舞厅套话', flag: '立功', need: undefined as string | undefined, pick: '步步引话，套取布防' },
      { summary: '策反译电员', flag: '建功', need: 'has(立功) & cover>=50', pick: '动之以情、济其困厄，徐图策反' },
      { summary: '日侨名册', flag: '奇功', need: 'has(建功)', pick: '通宵比对，挖出潜藏暗桩' },
      { summary: '密电草稿', flag: '殊勋', need: 'has(奇功)', pick: '冒险去敌机要室盗取密码本' },
    ]
    for (const w of want) {
      const ev = (spy.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.need) expect(ev!.requires, w.summary).toBe(w.need)
    }
  })
  it('套取布防当回合情报可破 15 上限', () => {
    let st = initState(spy, spy.openings![0])
    st = { ...st, attributes: { cover: 60, intel: 15, trust: 45 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (spy.localEvents ?? []).find((e) => e.summary === '舞厅套话')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('立功'))
    const next = applyChoice(spy, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('立功')
    expect(next.attributes.intel).toBeGreaterThan(15) // 该支 intel+12，破上限 15（立功上限 50）
  })
})

describe('spy 隐藏 endTone 哨兵', () => {
  // 注：策反成功·扭转乾坤 已从「隐藏天堂结局」改为人生里程碑(置 has(策反成功) 续潜伏，
  // 满期 intel>=40 才盖棺)，故移出哨兵列表。详见 spy.ts。
  const tones = ['卖国求荣·遗臭万年', '卖友求生·血债难偿']
  it('三哨兵结局存在且 condition 为 trust<=-1', () => {
    for (const t of tones) expect(spy.endings.find((x) => x.tone === t)?.condition, t).toBe('trust<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of spy.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('投靠敌营的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(spy, spy.openings![0])
    st = { ...st, attributes: { cover: 40, intel: 30, trust: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (spy.localEvents ?? []).find((e) => e.summary === '七十六号传唤')!
    const idx = ev.choices.findIndex((c) => c.text === '献情报投靠七十六号')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(spy, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('卖国求荣·遗臭万年')
  })
})

describe('spy AI 模式', () => {
  it('tierLabel=功勋，晋阶之序用本剧术语「功勋」+ 功勋印记序', () => {
    const st = initState(spy, spy.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(spy, st).map((m) => m.content).join('\n')
    expect(spy.tierLabel).toBe('功勋')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('功勋')
    expect(all).toContain('立功→建功→奇功→殊勋')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含功勋晋阶与双面权衡指引', () => {
    expect(spy.systemPrompt).toContain('功勋')
    expect(spy.systemPrompt).toContain('立功')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(spy, spy.openings![0], undefined, 'ai')
    expect(buildTurnMessages(spy, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

describe('spy 衰减与 sim 健壮性', () => {
  it('组织信任 decay 经史实校准（被自己人清除为第二死亡线，压力上调至 2/月）', () => {
    const trust = spy.attributes.find((a) => a.key === 'trust')!
    expect(trust.decayPerTurn).toBe(2) // 史实校准：肃反/内鬼互咬下信任消蚀更快，与暴露并立为活死亡线
  })
  it('潜伏掩护按史实校准：起手 52、每月衰减 4（悬顶最锋利的一刃）', () => {
    const cover = spy.attributes.find((a) => a.key === 'cover')!
    // 孤岛 1940-41 军统上海区损失约九成，掩护起手薄(52)、衰减快(4)，呼应史实高暴露率
    expect(cover.initial).toBe(52)
    expect(cover.decayPerTurn).toBe(4)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of spy.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})

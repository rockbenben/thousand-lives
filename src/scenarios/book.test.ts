import { describe, it, expect } from 'vitest'
import { bookTransmigration } from './book'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

const book = bookTransmigration

describe('book 剧情偏离封顶', () => {
  it('无偏离印记时偏离封顶 10（= base，≥ initial 不被削）', () => {
    expect(clampEffects(book, { plot: 10 }, { plot: 20 }, []).plot).toBe(10)
  })
  it('撬动→30 生变→60 颠覆→85 改天→100 逐级解锁', () => {
    expect(clampEffects(book, { plot: 25 }, { plot: 20 }, ['撬动']).plot).toBe(30)
    expect(clampEffects(book, { plot: 50 }, { plot: 20 }, ['撬动', '生变']).plot).toBe(60)
    expect(clampEffects(book, { plot: 80 }, { plot: 20 }, ['撬动', '生变', '颠覆']).plot).toBe(85)
    expect(clampEffects(book, { plot: 95 }, { plot: 20 }, ['撬动', '生变', '颠覆', '改天']).plot).toBe(100)
  })
  it('主角好感与安全值不设偏离封顶', () => {
    expect(clampEffects(book, { favor: 95 }, { favor: 20 }, []).favor).toBe(100)
    expect(clampEffects(book, { safety: 95 }, { safety: 20 }, []).safety).toBe(100)
  })
})

describe('book 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 恶毒女配: '恶毒女配', 反派之女: '反派之女', 陪嫁婢女: '陪嫁婢女' }
    for (const [name, flag] of Object.entries(want)) {
      const op = book.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(book, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = book.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('恶毒女配')).toBeGreaterThanOrEqual(1)
    expect(byFlag('反派之女')).toBeGreaterThanOrEqual(1)
    expect(byFlag('陪嫁婢女')).toBeGreaterThanOrEqual(1)
  })
})

describe('book 升偏离闸门', () => {
  it('四道升偏离机缘均为 keyMoment、授对应偏离印记、按序串链', () => {
    const want = [
      { summary: '宫宴落水', flag: '撬动', prev: undefined as string | undefined, pick: '反其道行之，当众救下女主' },
      { summary: '反派密谈', flag: '生变', prev: '撬动', pick: '阳奉阴违，暗中给反派使绊' },
      { summary: '储位之争', flag: '颠覆', prev: '生变', pick: '押注太子，倾力相助' },
      { summary: '宫变前夜', flag: '改天', prev: '颠覆', pick: '先发制人，连夜布局逼宫' },
    ]
    for (const w of want) {
      const ev = (book.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('救女主当回合偏离可破 10 上限', () => {
    let st = initState(book, book.openings![0])
    st = { ...st, attributes: { plot: 10, favor: 20, safety: 60 }, history: [] }
    const ev = (book.localEvents ?? []).find((e) => e.summary === '宫宴落水')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('撬动'))
    const next = applyChoice(book, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('撬动')
    expect(next.attributes.plot).toBeGreaterThan(10) // 该支 plot+12，破上限 10（撬动上限 30）
  })
})

describe('book 隐藏 endTone 哨兵', () => {
  const tones = ['窥破天机·归返现世', '夺运噬主·堕为新煞', '鸠占凤巢·反噬其身']
  it('三哨兵结局存在且 condition 为 safety<=-1', () => {
    for (const t of tones) expect(book.endings.find((x) => x.tone === t)?.condition, t).toBe('safety<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of book.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('掀翻原著的 endTone 分支被掷中即强制天堂结局', () => {
    let st = initState(book, book.openings![0])
    st = { ...st, attributes: { plot: 80, favor: 30, safety: 40 }, history: Array(20).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (book.localEvents ?? []).find((e) => e.summary === '世界濒临崩解')!
    const idx = ev.choices.findIndex((c) => c.text === '顺势而为，将原著彻底掀翻')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(book, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('窥破天机·归返现世')
  })
})

describe('book AI 模式', () => {
  it('tierLabel=偏离，晋阶之序用本剧术语「偏离」+ 偏离印记序', () => {
    const st = initState(book, book.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(book, st).map((m) => m.content).join('\n')
    expect(book.tierLabel).toBe('偏离')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('偏离')
    expect(all).toContain('撬动→生变→颠覆→改天')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含偏离晋阶与改写损安全的权衡指引', () => {
    expect(book.systemPrompt).toContain('偏离')
    expect(book.systemPrompt).toContain('撬动')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(book, book.openings![0], undefined, 'ai')
    expect(buildTurnMessages(book, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

describe('book 衰减与 sim 健壮性', () => {
  it('主角好感 decay 经 sim 校准（保持 0：random 追杀死 19% 已是健康第二死亡线，加 decay 会与 safety decay2 双重过罚）', () => {
    const favor = book.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn ?? 0).toBe(0) // sim-tuned：random 真死 57%（抹杀38%+追杀19%），favor 死已健康；survive 跑满期无早收束短路
  })
  it('安全值保持每章衰减 2（被剧情修正力抹杀的悬顶之危）', () => {
    expect(book.attributes.find((a) => a.key === 'safety')!.decayPerTurn).toBe(2)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of book.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})

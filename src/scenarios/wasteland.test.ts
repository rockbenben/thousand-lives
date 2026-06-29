import { describe, it, expect } from 'vitest'
import { wasteland } from './wasteland'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('wasteland 尺度与前提', () => {
  it('turnUnit=月、maxTurns=44（末世加长后期）', () => {
    expect(wasteland.turnUnit).toBe('月')
    expect(wasteland.maxTurns).toBe(44)
  })
  it('intro 与 systemPrompt 改为「救援无望·长期重建」框架（去掉「撑过三十天」「等待...军方救援」）', () => {
    expect(wasteland.intro).not.toContain('三十天')
    expect(wasteland.systemPrompt).toContain('每回合代表一个月')
    expect(wasteland.systemPrompt).toContain('据点')
    expect(wasteland.systemPrompt).not.toContain('每回合代表一天')
  })
})

describe('wasteland 物资据点封顶', () => {
  it('无据点印记时物资封顶 50（= base，≥ initial 不被削）', () => {
    expect(clampEffects(wasteland, { supplies: 50 }, { supplies: 20 }, []).supplies).toBe(50)
  })
  it('落脚点→65 据点→80 堡垒→92 营地→100 逐级解锁', () => {
    expect(clampEffects(wasteland, { supplies: 60 }, { supplies: 20 }, ['落脚点']).supplies).toBe(65)
    expect(clampEffects(wasteland, { supplies: 75 }, { supplies: 20 }, ['落脚点', '据点']).supplies).toBe(80)
    expect(clampEffects(wasteland, { supplies: 90 }, { supplies: 20 }, ['落脚点', '据点', '堡垒']).supplies).toBe(92)
    expect(clampEffects(wasteland, { supplies: 95 }, { supplies: 20 }, ['落脚点', '据点', '堡垒', '营地']).supplies).toBe(100)
  })
  it('生命与理智不设据点封顶', () => {
    expect(clampEffects(wasteland, { hp: 95 }, { hp: 20 }, []).hp).toBe(100)
    expect(clampEffects(wasteland, { sanity: 95 }, { sanity: 20 }, []).sanity).toBe(100)
  })
})

describe('wasteland 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 便利店店员: '店员', 退役军医: '军医', 高中生: '高中生' }
    for (const [name, flag] of Object.entries(want)) {
      const op = wasteland.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(wasteland, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = wasteland.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('店员')).toBeGreaterThanOrEqual(1)
    expect(byFlag('军医')).toBeGreaterThanOrEqual(1)
    expect(byFlag('高中生')).toBeGreaterThanOrEqual(1)
  })
})

describe('wasteland 建据点闸门', () => {
  it('四道建据点机缘均为 keyMoment、授对应据点印记、按序串链', () => {
    const want = [
      { summary: '觅一处栖身', flag: '落脚点', prev: undefined as string | undefined, pick: '清场加固，据为巢穴' },
      { summary: '加固扩建', flag: '据点', prev: '落脚点', pick: '扩建据点，囤粮储水' },
      { summary: '筑墙设防', flag: '堡垒', prev: '据点', pick: '筑墙设防，严阵以待' },
      { summary: '聚拢幸存者', flag: '营地', prev: '堡垒', pick: '接纳幸存者，立规矩号令一方' },
    ]
    for (const w of want) {
      const ev = (wasteland.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扩建据点当回合物资可破落脚点上限 65', () => {
    let st = initState(wasteland, wasteland.openings![0])
    st = { ...st, attributes: { hp: 70, sanity: 60, supplies: 65 }, flags: ['落脚点'], history: Array(8).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wasteland.localEvents ?? []).find((e) => e.summary === '加固扩建')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据点'))
    const next = applyChoice(wasteland, st, tr as any, idx, () => 0.5) // 0.5>=0.18 不触发命运无常
    expect(next.flags).toContain('据点')
    expect(next.attributes.supplies).toBeGreaterThan(65) // 该支 supplies+10，破落脚点上限65（据点上限80）
  })
})

describe('wasteland 结局重构为三年末世归宿', () => {
  it('结局总数为 36（27 基础 + 3 哨兵 + 6 新增死法），多种随机死法保留', () => {
    expect(wasteland.endings.length).toBe(36)
    expect(wasteland.endings.find((e) => e.tone === '力竭身亡')?.condition).toBe('hp<=0')
    expect(wasteland.endings.find((e) => e.tone === '疯癫失智·消失在废墟')?.condition).toBe('sanity<=0')
    // hp<=0 随机死法池：≥5 个同条件死法供引擎随机取一，使数值相同也死得不同
    const pool = wasteland.endings.filter((e) => e.condition === 'hp<=0')
    expect(pool.length).toBeGreaterThanOrEqual(5)
    for (const t of ['饿毙街头', '渴死荒途', '病亡无医', '中毒暴毙', '失血而亡'])
      expect(pool.some((e) => e.tone === t), t).toBe(true)
  })
  it('8 个救援 tone 已改名为长期重建框架', () => {
    const renamed = ['从容立足·重建有望', '安稳扎根的幸存者', '苟活·却已精神崩坏', '油尽灯枯·勉力撑住', '饿殍边缘·勉强熬过', '体魄尚健·安然立足', '伤痕累累·熬到今日', '熬过末世']
    for (const t of renamed) expect(wasteland.endings.some((e) => e.tone === t), t).toBe(true)
    const oldTones = ['从容获救·重建希望', '安稳撤离的幸存者', '油尽灯枯地获救', '获救']
    for (const t of oldTones) expect(wasteland.endings.some((e) => e.tone === t), `旧tone ${t} 应已改名`).toBe(false)
  })
  it('所有 epilogue 不再含「军方救援/救援者/救援点/担架/军旗」等抵达-获救字样', () => {
    const banned = ['军方', '军队', '救援者', '救援点', '救援的', '担架', '军旗', '救援车', '撤离']
    for (const e of wasteland.endings) {
      for (const b of banned) expect(e.epilogue?.includes(b), `${e.tone} 含「${b}」`).not.toBe(true)
    }
  })
  it('据点/重建类高物资结局仍以 supplies 为门（apex 靠 ceiling 自动门控）', () => {
    const rebuild = wasteland.endings.find((e) => e.tone === '重建据点·重燃文明')
    // 仍以「高物资」为门即可（具体阈值随平衡微调，不写死数字）
    expect(rebuild?.condition).toMatch(/supplies>=\d+/)
  })
})

describe('wasteland 隐藏 endTone 哨兵', () => {
  const tones = ['同流合污·食人自保', '弃众独生·孤鬼游荡', '以命护苗·废土微光']
  it('三哨兵结局存在且 condition 为 sanity<=-1', () => {
    for (const t of tones) expect(wasteland.endings.find((x) => x.tone === t)?.condition, t).toBe('sanity<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of wasteland.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('食人自保的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(wasteland, wasteland.openings![0])
    st = { ...st, attributes: { hp: 50, sanity: 30, supplies: 20 }, history: Array(6).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wasteland.localEvents ?? []).find((e) => e.summary === '末日食人')!
    const idx = ev.choices.findIndex((c) => c.text === '装作不知，蹭一顿饱饭再走')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(wasteland, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('同流合污·食人自保')
  })
})

describe('wasteland AI 模式', () => {
  it('tierLabel=据点，晋阶之序用本剧术语「据点」+ 据点印记序', () => {
    const st = initState(wasteland, wasteland.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(wasteland, st).map((m) => m.content).join('\n')
    expect(wasteland.tierLabel).toBe('据点')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('据点')
    expect(all).toContain('落脚点→据点→堡垒→营地')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含据点经营与隐藏结局指引', () => {
    expect(wasteland.systemPrompt).toContain('落脚点')
    expect(wasteland.systemPrompt).toContain('据点')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(wasteland, wasteland.openings![0], undefined, 'ai')
    expect(buildTurnMessages(wasteland, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

describe('wasteland 衰减与 sim 健壮性', () => {
  it('理智 decay 经 sim 校准为 0（末世已极致命，理智作哨兵触发+低理智结局的活轴，不再叠死亡压力）', () => {
    const sanity = wasteland.attributes.find((a) => a.key === 'sanity')!
    expect(sanity.decayPerTurn ?? 0).toBe(0) // sim-tuned：hp死亡线已主导(random力竭82%)，理智另加decay会过罚
  })
  it('生命保持每回合衰减 1（末世侵蚀）', () => {
    expect(wasteland.attributes.find((a) => a.key === 'hp')!.decayPerTurn).toBe(1)
  })
  it('两地狱哨兵宿主 once 且 endTone 分支为稀有支（治哨兵喧宾夺主）', () => {
    for (const s of ['尸潮围城', '末日食人']) {
      const ev = (wasteland.localEvents ?? []).find((e) => e.summary === s)!
      expect(ev.once, s).toBe(true)
      const darkChoice = ev.choices.find((c) => (c.outcomes ?? []).some((o) => o.endTone))!
      const survive = darkChoice.outcomes!.find((o) => !o.endTone)!
      const hell = darkChoice.outcomes!.find((o) => o.endTone)!
      expect((survive.weight ?? 1) > (hell.weight ?? 1), s).toBe(true) // 存活支权重 > 哨兵支（稀有）
    }
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of wasteland.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})

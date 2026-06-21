import { describe, it, expect } from 'vitest'
import { voyage } from './voyage'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('voyage 船力势力封顶', () => {
  it('无势力印记时船力封顶 35（= base，≥ initial 不被削）', () => {
    expect(clampEffects(voyage, { ship: 35 }, { ship: 20 }, []).ship).toBe(35)
  })
  it('私掠→50 船队→70 海枭→88 霸主→100 逐级解锁', () => {
    expect(clampEffects(voyage, { ship: 45 }, { ship: 20 }, ['私掠']).ship).toBe(50)
    expect(clampEffects(voyage, { ship: 65 }, { ship: 20 }, ['私掠', '船队']).ship).toBe(70)
    expect(clampEffects(voyage, { ship: 85 }, { ship: 20 }, ['私掠', '船队', '海枭']).ship).toBe(88)
    expect(clampEffects(voyage, { ship: 95 }, { ship: 20 }, ['私掠', '船队', '海枭', '霸主']).ship).toBe(100)
  })
  it('财富与人心不设势力封顶', () => {
    expect(clampEffects(voyage, { wealth: 95 }, { wealth: 20 }, []).wealth).toBe(100)
    expect(clampEffects(voyage, { crew: 95 }, { crew: 20 }, []).crew).toBe(100)
  })
})

describe('voyage 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      破产商人之子: '商人之子',
      哗变水手: '哗变水手',
      落魄贵族航海家: '贵族航海家',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = voyage.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(voyage, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = voyage.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('商人之子')).toBeGreaterThanOrEqual(1)
    expect(byFlag('哗变水手')).toBeGreaterThanOrEqual(1)
    expect(byFlag('贵族航海家')).toBeGreaterThanOrEqual(1)
  })
})

describe('voyage 升势力闸门', () => {
  it('四道升势力机缘均为 keyMoment、授对应势力印记、按序串链+财富门槛', () => {
    const want = [
      { summary: '海上肥羊', flag: '私掠', need: undefined as string | undefined, pick: '升起黑旗，登船劫掠' },
      { summary: '海盗结盟', flag: '船队', need: 'has(私掠) & wealth>=40', pick: '歃血结盟，借势纵横怒海' },
      { summary: '老提督甲板献策', flag: '海枭', need: 'has(船队) & wealth>=55', pick: '主动挑战列强舰队，破而后立' },
      { summary: '决战在即', flag: '霸主', need: 'has(海枭) & wealth>=68 & crew>=40', pick: '设伏火攻，险中求一场大胜' },
    ]
    for (const w of want) {
      const ev = (voyage.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.need) expect(ev!.requires, w.summary).toBe(w.need)
    }
  })
  it('海上肥羊「升起黑旗」授私掠印记并把船力上限抬到 50', () => {
    // 该支 effects 含 ship:-3（劫掠损船），故不验「船力上涨」，而验印记 + 上限抬升
    let st = initState(voyage, voyage.openings![0])
    st = { ...st, attributes: { ship: 35, wealth: 30, crew: 60 }, history: Array(2).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (voyage.localEvents ?? []).find((e) => e.summary === '海上肥羊')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('私掠'))
    const next = applyChoice(voyage, st, tr as any, idx, () => 0.5) // 0.5>=0.18 不触发命运无常，确定
    expect(next.flags).toContain('私掠')
    // 私掠 把船力上限 35→50：再给一记 +30 应被压在 50（而非旧上限 35），证明上限已抬升
    expect(clampEffects(voyage, next.attributes, { ship: 30 }, next.flags!).ship).toBe(50)
  })
  it('海盗结盟「歃血结盟」同回合授船队印记且船力可破私掠上限 50', () => {
    let st = initState(voyage, voyage.openings![0])
    st = { ...st, attributes: { ship: 50, wealth: 50, crew: 60 }, flags: ['私掠'], history: Array(8).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (voyage.localEvents ?? []).find((e) => e.summary === '海盗结盟')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('船队'))
    const next = applyChoice(voyage, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('船队')
    expect(next.attributes.ship).toBeGreaterThan(50) // 破私掠上限 50（船队上限 70）
  })
})

describe('voyage AI 模式', () => {
  it('tierLabel=势力，晋阶之序用本剧术语「势力」+ 势力印记序', () => {
    const st = initState(voyage, voyage.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(voyage, st).map((m) => m.content).join('\n')
    expect(voyage.tierLabel).toBe('势力')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('势力')
    expect(all).toContain('私掠→船队→海枭→霸主')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含势力晋阶与财富引擎指引', () => {
    expect(voyage.systemPrompt).toContain('势力')
    expect(voyage.systemPrompt).toContain('私掠')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(voyage, voyage.openings![0], undefined, 'ai')
    expect(buildTurnMessages(voyage, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})

describe('voyage 隐藏 endTone 哨兵', () => {
  const tones = ['屠岛劫财·恶贯满盈', '见利忘义·众叛弃尸', '逍遥怒海·自由之王']
  it('三哨兵结局存在且 condition 为 crew<=-1', () => {
    for (const t of tones) {
      const e = voyage.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('crew<=-1')
    }
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of voyage.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('屠掠土人的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(voyage, voyage.openings![0])
    st = { ...st, attributes: { ship: 60, wealth: 50, crew: 40 }, history: Array(10).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (voyage.localEvents ?? []).find((e) => e.summary === '孤岛通商')!
    const idx = ev.choices.findIndex((c) => c.text === '恃强凌弱，巧取豪夺一番')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(voyage, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('屠岛劫财·恶贯满盈')
  })
})

describe('voyage 衰减与 sim 健壮性', () => {
  it('人心 decay 经 sim 校准（治人心 trivially 高，成须经营的第二维）', () => {
    const crew = voyage.attributes.find((a) => a.key === 'crew')!
    expect(crew.decayPerTurn).toBe(1) // sim-tuned：decay0 时同舟共济独大55%；decay1 后人心须经营、结局多样；decay2 过罚
  })
  it('船力 sim 校准：起手 50、每年衰减 2（怒海之凶·船蛀）', () => {
    const ship = voyage.attributes.find((a) => a.key === 'ship')!
    // 原 init35/decay1 使避险者 100% 满期、几无怒海之险；上调至 init50/decay2，
    // careful 坏结局 2.6%→30%、随性玩法贴大航海史实地凶（≈麦哲伦船队九成损耗），高船力结局仍可达
    expect(ship.initial).toBe(50)
    expect(ship.decayPerTurn).toBe(2)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of voyage.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})

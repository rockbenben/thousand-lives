import { describe, it, expect } from 'vitest'
import { officialdom } from './officialdom'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('officialdom 长度与圣眷衰减（70岁荣休）', () => {
  it('maxTurns 扩到 44（进士→70岁荣休）', () => {
    expect(officialdom.maxTurns).toBe(44)
  })
  it('圣眷 decay 降为 1（44年长跑可活）', () => {
    const favor = officialdom.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn).toBe(1)
  })
  it('systemPrompt 不再硬编「第 24 年」', () => {
    expect(officialdom.systemPrompt).not.toContain('第 24 年')
  })
})

describe('officialdom 权势官阶封顶', () => {
  it('无官阶印记时权势封顶 30', () => {
    expect(clampEffects(officialdom, { power: 28 }, { power: 50 }, []).power).toBe(30)
  })
  it('知府印记解锁封顶 50', () => {
    expect(clampEffects(officialdom, { power: 45 }, { power: 50 }, ['知府']).power).toBe(50)
  })
  it('封疆印记解锁封顶 70', () => {
    expect(clampEffects(officialdom, { power: 60 }, { power: 50 }, ['知府', '封疆']).power).toBe(70)
  })
  it('九卿印记解锁封顶 85', () => {
    expect(clampEffects(officialdom, { power: 80 }, { power: 50 }, ['知府', '封疆', '九卿']).power).toBe(85)
  })
  it('阁老印记解锁封顶 100', () => {
    expect(clampEffects(officialdom, { power: 95 }, { power: 50 }, ['知府', '封疆', '九卿', '阁老']).power).toBe(100)
  })
  it('圣眷与官声不设官阶封顶', () => {
    expect(clampEffects(officialdom, { favor: 95 }, { favor: 50 }, []).favor).toBe(100)
    expect(clampEffects(officialdom, { name: 95 }, { name: 50 }, []).name).toBe(100)
  })
})

describe('officialdom 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门进士', '世家子弟', '内廷养子']) {
      const op = officialdom.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(officialdom, op).flags).toContain(n)
    }
  })
  it('内廷养子专属事件带 has(内廷养子) 门控', () => {
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '内廷阴影')
    expect(ev?.requires).toContain('has(内廷养子)')
  })
  it('身份门控与既有数值条件合并（不覆盖原 requires）', () => {
    // 孤立被构陷/孤臣罗网 原带 power/name 阈值，加身份门控须 & 合并、两者并存
    const gou = (officialdom.localEvents ?? []).find((e) => e.summary === '孤立被构陷')
    expect(gou?.requires).toContain('has(寒门进士)')
    expect(gou?.requires).toContain('power<=18')
    const gch = (officialdom.localEvents ?? []).find((e) => e.summary === '孤臣罗网')
    expect(gch?.requires).toContain('has(寒门进士)')
    expect(gch?.requires).toContain('power<=30')
    expect(gch?.requires).toContain('name>=50')
  })
})

describe('officialdom 升迁闸门', () => {
  it('四道升迁机缘均为 keyMoment 且授对应官阶印记、按序串链', () => {
    const want = [
      { summary: '擢升知府', flag: '知府', prev: undefined },
      { summary: '晋升封疆', flag: '封疆', prev: '知府' },
      { summary: '晋位九卿', flag: '九卿', prev: '封疆' },
      { summary: '入阁拜相', flag: '阁老', prev: '九卿' },
    ]
    for (const w of want) {
      const ev = (officialdom.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const grants = ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag))
      expect(grants, w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('擢升知府后同回合权势可破 30 上限', () => {
    let st = initState(officialdom, officialdom.openings!.find((o) => o.name === '寒门进士'))
    st = { ...st, attributes: { power: 28, name: 50, favor: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '擢升知府')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('知府'))
    const next = applyChoice(officialdom, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('知府')
    expect(next.attributes.power).toBeGreaterThan(30)
  })
})

describe('officialdom 巅峰结局须 maxTurns（不中途白嫖）', () => {
  it('满血高位在非荣休年不触发巅峰结局', () => {
    // 高 name/power/favor，但回合数 < maxTurns（第 20 年）：巅峰结局不应触发
    const r = checkEnding(officialdom, { name: 98, power: 98, favor: 98 }, 20, ['知府', '封疆', '九卿', '阁老'])
    for (const t of ['出将入相·名垂青史', '权倾朝野·一手遮天', '万民称颂·青天再世', '简在帝心·恩宠无两']) {
      expect(r?.tone === t, t).toBe(false)
    }
  })
  it('荣休年（满期）高位触发巅峰结局', () => {
    const r = checkEnding(officialdom, { name: 98, power: 98, favor: 98 }, 44, ['知府', '封疆', '九卿', '阁老'])
    expect(r?.tone).toBeTruthy()
    // 满期高 name&power → 出将入相（最具体在前）
    expect(['出将入相·名垂青史', '权倾朝野·一手遮天', '万民称颂·青天再世', '简在帝心·恩宠无两', '名相贤臣·配享太庙']).toContain(r!.tone)
  })
})

describe('officialdom 隐藏 endTone', () => {
  it('新增致死与天堂隐藏结局存在且为哨兵 favor<=-1', () => {
    for (const t of ['文字狱·瘐死诏狱', '站队倾覆·满门抄斩', '简在帝心·骤擢入阁']) {
      const e = officialdom.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('favor<=-1')
    }
  })
  it('夺嫡选边含低权站队倾覆 endTone 分支', () => {
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '夺嫡选边')!
    const has = ev.choices.some((c) => (c.outcomes ?? []).some((o) => o.endTone === '站队倾覆·满门抄斩'))
    expect(has).toBe(true)
  })
  it('endTone 强制即终局', () => {
    let st = initState(officialdom, officialdom.openings!.find((o) => o.name === '世家子弟'))
    st = { ...st, attributes: { name: 50, power: 50, favor: 50 }, history: Array(12).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '夺嫡选边')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '站队倾覆·满门抄斩'))
    const next = applyChoice(officialdom, st, tr as any, idx, () => 0.999)
    expect(next.ended?.reason).toBe('forced')
  })
})

describe('officialdom AI 模式', () => {
  it('加 ceilingUnlocks+flag 后提示注入官阶印记/晋阶约束/词表', () => {
    const st = initState(officialdom, officialdom.openings!.find((o) => o.name === '世家子弟'), undefined, 'ai')
    const sys = buildTurnMessages(officialdom, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('印记')
    expect(sys).toContain('不得越级')
    for (const f of ['知府', '封疆', '九卿', '阁老']) expect(sys).toContain(f)
    // 隐藏 tone 经词表注入（骤擢入阁 不在 systemPrompt 文本，证明 hiddenTones 注入生效）
    expect(sys).toContain('骤擢入阁')
  })
  it('systemPrompt 含官阶封顶规则与文字狱极稀指导', () => {
    expect(officialdom.systemPrompt).toContain('官阶')
    expect(officialdom.systemPrompt).toContain('文字狱')
  })
  it('提示不含「共 undefined」与「第 24 年」', () => {
    const st = initState(officialdom, officialdom.openings![0], undefined, 'ai')
    const msgs = buildTurnMessages(officialdom, st).map((m) => m.content).join('\n')
    expect(msgs).not.toContain('undefined')
    expect(msgs).not.toContain('第 24 年')
  })
})

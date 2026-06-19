import { describe, it, expect } from 'vitest'
import { wuxia } from './wuxia'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('wuxia AI 模式', () => {
  it('加 ceilingUnlocks+flag 后 scenarioUsesFlags 生效，提示注入印记/晋阶约束/词表', () => {
    const st = initState(wuxia, wuxia.openings!.find((o) => o.name === '名门弟子'), undefined, 'ai')
    const sys = buildTurnMessages(wuxia, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('印记')
    expect(sys).toContain('不得越级')
    // 4 境界词表入提示
    for (const f of ['入流', '一流', '绝顶', '宗师']) expect(sys).toContain(f)
    // 走火入魔 由 systemPrompt 文本命中（hiddenTones 词表注入另由 prompt.test.ts 覆盖）
    expect(sys).toContain('走火入魔')
  })
  it('systemPrompt 含江湖境界封顶规则与走火入魔极稀指导', () => {
    expect(wuxia.systemPrompt).toContain('境界')
    expect(wuxia.systemPrompt).toContain('走火入魔')
  })
  it('有 maxTurns，提示用「共 30 载/年」而非「共 undefined」', () => {
    const st = initState(wuxia, wuxia.openings![0], undefined, 'ai')
    const msgs = buildTurnMessages(wuxia, st).map((m) => m.content).join('\n')
    expect(msgs).not.toContain('undefined')
  })
})

describe('wuxia 武功境界封顶', () => {
  it('无境界印记时武功封顶 30', () => {
    expect(clampEffects(wuxia, { gongfu: 28 }, { gongfu: 50 }, []).gongfu).toBe(30)
  })
  it('入流印记解锁封顶 50', () => {
    expect(clampEffects(wuxia, { gongfu: 45 }, { gongfu: 50 }, ['入流']).gongfu).toBe(50)
  })
  it('一流印记解锁封顶 70', () => {
    expect(clampEffects(wuxia, { gongfu: 60 }, { gongfu: 50 }, ['入流', '一流']).gongfu).toBe(70)
  })
  it('绝顶印记解锁封顶 88', () => {
    expect(clampEffects(wuxia, { gongfu: 80 }, { gongfu: 50 }, ['入流', '一流', '绝顶']).gongfu).toBe(88)
  })
  it('宗师印记解锁封顶 100', () => {
    expect(clampEffects(wuxia, { gongfu: 95 }, { gongfu: 50 }, ['入流', '一流', '绝顶', '宗师']).gongfu).toBe(100)
  })
  it('性命与侠名不设境界封顶（高于任何印记仍可到 max）', () => {
    expect(clampEffects(wuxia, { life: 95 }, { life: 50 }, []).life).toBe(100)
    expect(clampEffects(wuxia, { fame: 95 }, { fame: 50 }, []).fame).toBe(100)
  })
})

describe('wuxia 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const names = ['市井孤儿', '名门弟子', '灭门遗孤']
    for (const n of names) {
      const op = wuxia.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(wuxia, op).flags).toContain(n)
    }
  })
  it('名门专属事件带 has(名门弟子) 门控', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '师兄刁难')
    expect(ev?.requires).toContain('has(名门弟子)')
  })
  it('灭门遗孤专属事件带 has(灭门遗孤) 门控', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '残谱现世')
    expect(ev?.requires).toContain('has(灭门遗孤)')
  })
  it('身份门控与既有数值条件合并（不覆盖原 requires）', () => {
    // 残谱补全/血仇真相 原带 gongfu 阈值，加身份门控须 & 合并、两者并存
    const buquan = (wuxia.localEvents ?? []).find((e) => e.summary === '残谱补全')
    expect(buquan?.requires).toContain('has(灭门遗孤)')
    expect(buquan?.requires).toContain('gongfu>=60')
    const xuechou = (wuxia.localEvents ?? []).find((e) => e.summary === '血仇真相')
    expect(xuechou?.requires).toContain('has(灭门遗孤)')
    expect(xuechou?.requires).toContain('gongfu>=65')
  })
})

describe('wuxia 突破闸门', () => {
  it('三道突破机缘均为 keyMoment 且授对应境界印记', () => {
    const want = [
      { summary: '秘籍到手', flag: '入流' },
      { summary: '闭关参悟', flag: '一流' },
      { summary: '内功突破', flag: '绝顶' },
    ]
    for (const w of want) {
      const ev = (wuxia.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const grants = ev!.choices.some(
        (c) => (c.flagsSet ?? []).includes(w.flag) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(w.flag)),
      )
      expect(grants, w.summary).toBe(true)
    }
  })
  it('入流突破后同回合武功可破 30 上限', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '市井孤儿'))
    st = { ...st, attributes: { gongfu: 28, fame: 40, life: 70 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '秘籍到手')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('入流') || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('入流')))
    expect(idx).toBeGreaterThanOrEqual(0)
    const next = applyChoice(wuxia, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('入流')
    expect(next.attributes.gongfu).toBeGreaterThan(30) // 封顶已抬到 50
  })
  it('一流闸门需先有入流印记（requires 串链）', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '闭关参悟')!
    expect(ev.requires).toContain('has(入流)')
    const ev3 = (wuxia.localEvents ?? []).find((e) => e.summary === '内功突破')!
    expect(ev3.requires).toContain('has(一流)')
  })
})

describe('wuxia C 式 apex 渡劫', () => {
  it('两 apex 结局改哨兵，高武功高侠名也不被动触发', () => {
    // 满血绝顶高武高侠名，回合 28：被动 apex 不应触发
    const r = checkEnding(wuxia, { gongfu: 96, fame: 80, life: 70 }, 28, ['入流', '一流', '绝顶'])
    expect(r?.tone === '武林至尊·一代宗师').toBe(false)
    expect(r?.tone === '武功盖世·终成独夫').toBe(false)
  })
  it('apex 闸门事件结构：keyMoment+once、requires 绝顶、三选项含 endTone', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '泰山论剑')!
    expect(ev.keyMoment).toBe(true)
    expect(ev.once).toBe(true)
    expect(ev.requires).toContain('has(绝顶)')
    // 全力一搏选项含三态 endTone（至尊/独夫/走火入魔）
    const bold = ev.choices.find((c) => (c.outcomes ?? []).some((o) => o.endTone === '武林至尊·一代宗师'))!
    const tones = (bold.outcomes ?? []).map((o) => o.endTone)
    expect(tones).toContain('武林至尊·一代宗师')
    expect(tones).toContain('走火入魔·经脉俱断')
    // 避险选项不带 endTone
    const safe = ev.choices.find((c) => !(c.outcomes ?? []).length && !c.endTone)
    expect(safe).toBeTruthy()
  })
  it('迎劫成功分支 → 武林至尊；失败分支 → 走火入魔', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '名门弟子'))
    st = { ...st, attributes: { gongfu: 88, fame: 70, life: 60 }, flags: ['入流', '一流', '绝顶'], history: Array(24).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '泰山论剑')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const boldIdx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '武林至尊·一代宗师'))
    // rng=0 取首个 outcome（成功·至尊放第一）
    const win = applyChoice(wuxia, st, tr as any, boldIdx, () => 0)
    expect(win.ended?.tone).toBe('武林至尊·一代宗师')
    // rng=0.99 取末个 outcome（走火入魔放最后）
    const lose = applyChoice(wuxia, st, tr as any, boldIdx, () => 0.99)
    expect(lose.ended?.tone).toBe('走火入魔·经脉俱断')
  })
})

describe('wuxia 隐藏 endTone', () => {
  it('凶险事件的逞强选项含低权致死 endTone', () => {
    const summaries = ['运功撞墙吐血', '险些走火', '中毒暗算']
    let found = 0
    for (const s of summaries) {
      const ev = (wuxia.localEvents ?? []).find((e) => e.summary === s)
      if (ev?.choices.some((c) => (c.outcomes ?? []).some((o) => /走火入魔|暴毙/.test(o.endTone ?? '')))) found++
    }
    expect(found).toBeGreaterThanOrEqual(2)
  })
  it('新增致死与奇缘隐藏结局存在且为哨兵 condition', () => {
    const die = wuxia.endings.find((e) => e.tone === '暗伤迸发·暴毙荒途')
    const heaven = wuxia.endings.find((e) => e.tone === '奇缘证道·剑道通玄')
    expect(die?.condition).toBe('life<=-1')
    expect(heaven?.condition).toBe('life<=-1')
  })
  it('暴毙 endTone 即终局', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '市井孤儿'))
    st = { ...st, attributes: { gongfu: 50, fame: 40, life: 60 }, history: Array(12).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '运功撞墙吐血')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => /走火入魔|暴毙/.test(o.endTone ?? '')))
    const next = applyChoice(wuxia, st, tr as any, idx, () => 0.999) // 末个 outcome = 致死
    expect(next.ended?.reason).toBe('forced')
  })
})

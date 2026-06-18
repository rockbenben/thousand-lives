import { describe, it, expect } from 'vitest'
import { wuxia } from './wuxia'
import { clampEffects, initState, applyChoice } from '../engine/state'

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

import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { parseCondition, conditionAttrs } from '../engine/condition'

// 内置剧本内容完整性：覆盖 scenarioSchema 之外的语义不变量，
// 防止新增/编辑剧本时引入「死效果 / 不可达门控 / 重复剧情」等隐患。
describe('内置剧本内容完整性', () => {
  for (const sc of builtinScenarios) {
    describe(sc.id, () => {
      const attrKeys = new Set(sc.attributes.map((a) => a.key))
      const events = sc.localEvents ?? []
      const granted = new Set<string>()
      // 道具可在「事件级」或「选项 outcomes 分支级」发放（引擎 applyChoice 两处都认，见 state.ts）；两处都采集，否则移入 outcomes 的发放会被误判为不可达
      for (const e of events) {
        ;(e.itemsGained ?? []).forEach((i) => granted.add(i))
        for (const c of e.choices) for (const o of c.outcomes ?? []) (o.itemsGained ?? []).forEach((i) => granted.add(i))
      }

      it('结局条件只引用已定义属性', () => {
        const bad: string[] = []
        sc.endings.forEach((e, i) => {
          conditionAttrs(parseCondition(e.condition))
            .filter((a) => !attrKeys.has(a))
            .forEach((a) => bad.push(`ending#${i}「${e.condition}」未定义属性 ${a}`))
        })
        expect(bad).toEqual([])
      })

      it('事件 requires 只引用已定义属性', () => {
        const bad: string[] = []
        events.forEach((e, i) => {
          if (!e.requires) return
          conditionAttrs(parseCondition(e.requires))
            .filter((a) => !attrKeys.has(a))
            .forEach((a) => bad.push(`event#${i}「${e.requires}」未定义属性 ${a}`))
        })
        expect(bad).toEqual([])
      })

      it('choice.effects 只作用于已定义属性（无死效果）', () => {
        const bad: string[] = []
        events.forEach((e, i) =>
          e.choices.forEach((c, ci) =>
            Object.keys(c.effects ?? {})
              .filter((k) => !attrKeys.has(k))
              .forEach((k) => bad.push(`event#${i} choice#${ci} 死效果 ${k}`)),
          ),
        )
        expect(bad).toEqual([])
      })

      it('requiresItem 的物品本地可获得（无不可达门控）', () => {
        const bad: string[] = []
        events.forEach((e, i) => {
          if (e.requiresItem && !granted.has(e.requiresItem))
            bad.push(`event#${i} requiresItem「${e.requiresItem}」从未被授予`)
        })
        expect(bad).toEqual([])
      })

      // 身份/剧情线门控（如 has(仙门)、has(开宗)）拼错或忘了发印记 → 该事件永不触发，静默从池里消失
      it('requires 里的印记本地可获得（无不可达门控）', () => {
        const flags = new Set<string>(sc.openings?.map((o) => o.flag).filter((f): f is string => !!f))
        for (const a of sc.attributes) for (const u of a.ceilingUnlocks ?? []) flags.add(u.flag)
        for (const e of events)
          for (const c of e.choices) {
            ;(c.flagsSet ?? []).forEach((f) => flags.add(f))
            for (const o of c.outcomes ?? []) (o.flagsSet ?? []).forEach((f) => flags.add(f))
          }
        const bad: string[] = []
        events.forEach((e, i) => {
          if (!e.requires) return
          const cond = parseCondition(e.requires)
          for (const p of cond.kind === 'and' ? cond.parts : [cond])
            if (p.kind === 'has' && !p.neg && !flags.has(p.flag))
              bad.push(`event#${i}「${e.requires}」印记「${p.flag}」从未被授予`)
        })
        expect(bad).toEqual([])
      })

      it('无完全重复的 narrative', () => {
        const seen = new Set<string>()
        const dup: string[] = []
        events.forEach((e, i) => {
          if (seen.has(e.narrative)) dup.push(`event#${i} 重复: ${e.narrative.slice(0, 16)}…`)
          seen.add(e.narrative)
        })
        expect(dup).toEqual([])
      })
    })
  }
})

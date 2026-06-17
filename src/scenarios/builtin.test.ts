import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { scenarioSchema } from './schema'
import { parseCondition } from '../engine/condition'

describe('内置剧本', () => {
  it('至少有 2 个剧本且 id 唯一', () => {
    expect(builtinScenarios.length).toBeGreaterThanOrEqual(2)
    const ids = builtinScenarios.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(builtinScenarios.map((s) => [s.id, s] as const))(
    '%s 通过 schema 校验',
    (_, sc) => {
      expect(() => scenarioSchema.parse(sc)).not.toThrow()
    },
  )

  it.each(builtinScenarios.map((s) => [s.id, s] as const))(
    '%s 所有结局条件可解析',
    (_, sc) => {
      for (const e of sc.endings) expect(() => parseCondition(e.condition)).not.toThrow()
    },
  )
})

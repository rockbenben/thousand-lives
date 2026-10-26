import { describe, it, expect } from 'vitest'
import { importErrorMessage } from './importError'
import { importScenarioSchema } from '../scenarios/schema'
import { msg } from './messages'

const valid = {
  id: 'test',
  title: '测试剧本',
  intro: '这是开局描述',
  attributes: [{ key: 'hp', name: '生命', initial: 80, max: 100, deathBelow: 0 }],
  maxTurns: 10,
  systemPrompt: '你是游戏主持人',
  endings: [{ condition: 'maxTurns', tone: '幸存' }],
}

function zodErrorFrom(value: unknown) {
  const result = importScenarioSchema.safeParse(value)
  if (result.success) throw new Error('fixture should be invalid')
  return result.error
}

describe('importErrorMessage', () => {
  it('把 JSON 语法错误说成人话，不暴露英文解析器原文', () => {
    const text = importErrorMessage(new SyntaxError('Unexpected token } in JSON at position 2'))
    expect(text).toContain('不是合法的 JSON')
    expect(text).not.toContain('Unexpected token')
  })

  it('指出出错字段，且不展示 Zod 的英文内置提示', () => {
    const text = importErrorMessage(zodErrorFrom({ ...valid, attributes: 'oops' }))
    expect(text).toContain('「attributes」这一项格式不对')
    expect(text).not.toContain('Invalid input')
  })

  it('保留 Zod 的中文自定义提示（如条件语法）', () => {
    const text = importErrorMessage(
      zodErrorFrom({ ...valid, endings: [{ condition: 'hp == 0', tone: '死亡' }] }),
    )
    expect(text).toContain('详情：')
    expect(text).toContain('无法解析')
  })

  it('剧本导入提示不再指引去命书阁找模板', () => {
    expect(msg.importFailed).not.toContain('命书阁')
    expect(msg.importFailed).toContain('剧本格式')
  })
})

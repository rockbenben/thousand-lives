import { describe, it, expect } from 'vitest'
import { parseTurnResult, visibleNarrative, stripChoiceList } from './turn'

const good = JSON.stringify({
  narrative: '你推开了门。',
  choices: [
    { text: '进去', effects: { hp: -5 } },
    { text: '离开', effects: {} },
  ],
  summary: '推门',
})

describe('parseTurnResult', () => {
  it('解析合法回合（含围栏）', () => {
    const t = parseTurnResult('```json\n' + good + '\n```')
    expect(t.choices).toHaveLength(2)
    expect(t.choices[0].effects.hp).toBe(-5)
  })
  it('effects 缺省时补空对象', () => {
    const t = parseTurnResult(JSON.stringify({
      narrative: 'n',
      choices: [{ text: 'a' }, { text: 'b' }],
      summary: 's',
    }))
    expect(t.choices[0].effects).toEqual({})
  })
  it('缺 narrative 抛错', () => {
    expect(() => parseTurnResult(JSON.stringify({ choices: [], summary: 's' }))).toThrow()
  })
  it('choices 少于 2 个抛错', () => {
    expect(() => parseTurnResult(JSON.stringify({
      narrative: 'n', choices: [{ text: 'a' }], summary: 's',
    }))).toThrow()
  })
  it('完整 JSON 的 narrative 全是选项清单、剥离后为空时抛错（与两段式一致，触发重试而非静默空白）', () => {
    const allChoiceList = JSON.stringify({
      narrative: '请选择：\n1. 推门进去\n2. 转身离开',
      choices: [{ text: '推门进去', effects: {} }, { text: '转身离开', effects: {} }],
      summary: '抉择',
    })
    expect(() => parseTurnResult(allChoiceList)).toThrow()
  })

  it('两段式：正文 + 尾部 JSON', () => {
    const tail = JSON.stringify({
      choices: [{ text: '进去', effects: { hp: -5 } }, { text: '离开' }],
      summary: '推门',
    })
    const t = parseTurnResult(`你推开了门。门后一片漆黑。\n${tail}`)
    expect(t.narrative).toBe('你推开了门。门后一片漆黑。')
    expect(t.choices).toHaveLength(2)
    expect(t.summary).toBe('推门')
  })

  it('两段式：正文与 JSON 之间的围栏被剥掉', () => {
    const tail = JSON.stringify({ choices: [{ text: 'a' }, { text: 'b' }], summary: 's' })
    const t = parseTurnResult(`正文内容。\n\`\`\`json\n${tail}\n\`\`\``)
    expect(t.narrative).toBe('正文内容。')
  })

  it('两段式：正文为空抛错（触发纠错重试）', () => {
    const tail = JSON.stringify({ choices: [{ text: 'a' }, { text: 'b' }], summary: 's' })
    expect(() => parseTurnResult(tail)).toThrow('正文为空')
  })

  it('解析可选的 itemsGained / itemsLost', () => {
    const tail = JSON.stringify({
      choices: [{ text: 'a' }, { text: 'b' }],
      summary: 's',
      itemsGained: ['绳索'],
      itemsLost: ['火把'],
    })
    const t = parseTurnResult(`正文。\n${tail}`)
    expect(t.itemsGained).toEqual(['绳索'])
    expect(t.itemsLost).toEqual(['火把'])
  })

  it('物品字段缺省时为 undefined（不报错）', () => {
    expect(parseTurnResult(good).itemsGained).toBeUndefined()
  })

  it('解析 AI 托管推荐 recommend', () => {
    const tail = JSON.stringify({ choices: [{ text: 'a' }, { text: 'b' }], summary: 's', recommend: 1 })
    expect(parseTurnResult(`正文。\n${tail}`).recommend).toBe(1)
  })

  it('recommend 为非法类型时忽略而非令整回合失败', () => {
    const mk = (rec: unknown) =>
      `正文。\n${JSON.stringify({ choices: [{ text: 'a' }, { text: 'b' }], summary: 's', recommend: rec })}`
    // 字符串、小数都不应抛错，recommend 退化为 undefined，回合照常可用
    expect(parseTurnResult(mk('0')).recommend).toBeUndefined()
    expect(parseTurnResult(mk(1.5)).recommend).toBeUndefined()
    expect(parseTurnResult(mk('0')).choices).toHaveLength(2)
  })

  it('解析自定义行动结算回合的 actionEffects', () => {
    const tail = JSON.stringify({
      choices: [{ text: 'a' }, { text: 'b' }],
      summary: 's',
      actionEffects: { hp: -8, gold: 12 },
    })
    const t = parseTurnResult(`你撬开了锁，但割伤了手。\n${tail}`)
    expect(t.actionEffects).toEqual({ hp: -8, gold: 12 })
  })

  it('模型把选项也写进正文时，正文里的清单被剥掉（端到端）', () => {
    const tail = JSON.stringify({
      choices: [{ text: '推门而入' }, { text: '转身离开' }],
      summary: '门前',
    })
    const t = parseTurnResult(`夜色深沉，你站在门前。\n\n1. 推门而入\n2. 转身离开\n${tail}`)
    expect(t.narrative).toBe('夜色深沉，你站在门前。')
    expect(t.choices).toHaveLength(2)
  })
})

describe('stripChoiceList', () => {
  it('剥掉正文末尾的编号选项清单', () => {
    const t = '夜色深沉，你站在门前。\n\n1. 推门而入\n2. 转身离开\n3. 敲门'
    expect(stripChoiceList(t)).toBe('夜色深沉，你站在门前。')
  })
  it('连同引导语一起去掉', () => {
    const t = '局势危急。\n请选择：\n1、逃跑\n2、迎战'
    expect(stripChoiceList(t)).toBe('局势危急。')
  })
  it('支持中文顿号 / 括号 / 圈号 / 项目符号', () => {
    expect(stripChoiceList('正文。\n（1）甲\n（2）乙')).toBe('正文。')
    expect(stripChoiceList('正文。\n① 甲\n② 乙')).toBe('正文。')
    expect(stripChoiceList('正文。\n- 甲\n- 乙')).toBe('正文。')
  })
  it('不误伤正文中段的编号（只剥结尾连续清单）', () => {
    const t = '他定下三条规矩：\n1. 不杀人\n2. 不放火\n然后他转身走入雨幕，背影消失在巷口。'
    expect(stripChoiceList(t)).toBe(t.trimEnd())
  })
  it('无清单时原样返回', () => {
    expect(stripChoiceList('一段干净的剧情正文。')).toBe('一段干净的剧情正文。')
  })
})

describe('AI 回合含印记/强制结局字段', () => {
  const wrap = (choice: object) => JSON.stringify({
    narrative: '你立于山门之前，灵气稀薄。',
    choices: [choice, { text: '另寻他途', effects: {} }],
    summary: '山门前',
  })
  it('flagsSet/flagsClear/endTone 被保留', () => {
    const r = parseTurnResult(wrap({ text: '凝结金丹', effects: { cultivation: 6 }, flagsSet: ['金丹'], endTone: '仙缘垂青·一步登天' }))
    expect(r.choices[0].flagsSet).toEqual(['金丹'])
    expect(r.choices[0].endTone).toBe('仙缘垂青·一步登天')
  })
  it('非法 flagsSet（字符串）被容错为 undefined，整回合仍解析', () => {
    const r = parseTurnResult(wrap({ text: 'x', effects: {}, flagsSet: '金丹' }))
    expect(r.choices[0].flagsSet).toBeUndefined()
    expect(r.choices.length).toBe(2)
  })
})

describe('visibleNarrative', () => {
  it('截掉已开始输出的 JSON', () => {
    expect(visibleNarrative('正文写到一半{"choices":[{"te')).toBe('正文写到一半')
  })
  it('截掉围栏开头（并去尾部空白）', () => {
    expect(visibleNarrative('正文。\n```json\n{"cho')).toBe('正文。')
  })
  it('纯正文原样返回（去掉行首空白）', () => {
    expect(visibleNarrative('\n正文流式中')).toBe('正文流式中')
  })
})

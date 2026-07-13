import { describe, it, expect } from 'vitest'
import { extractJson } from './json'

describe('extractJson', () => {
  it('解析裸 JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
  })
  it('剥掉 markdown 围栏', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })
  it('忽略 JSON 前后的废话', () => {
    expect(extractJson('好的，结果如下：{"a":1}希望你满意')).toEqual({ a: 1 })
  })
  it('字符串里的花括号与转义引号不干扰配对', () => {
    expect(extractJson('{"t":"a{b}\\"c"}')).toEqual({ t: 'a{b}"c' })
  })
  it('嵌套对象取最外层', () => {
    expect(extractJson('x{"a":{"b":2}}y')).toEqual({ a: { b: 2 } })
  })
  it('JSON 字符串值里含三反引号不被破坏', () => {
    expect(extractJson('```json\n{"t":"代码块 ```bash``` 示例"}\n```')).toEqual({
      t: '代码块 ```bash``` 示例',
    })
  })
  it('真 JSON 之前 prose 里出现的花括号不干扰', () => {
    expect(extractJson('格式形如 {"字段": 值} 这样，结果：{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('开始符号是 "{" 哦。{"a":1}')).toEqual({ a: 1 })
  })
  it('没有 JSON 时抛错', () => {
    expect(() => extractJson('完全没有结构化输出')).toThrow()
  })
  it('JSON 不完整时抛错', () => {
    expect(() => extractJson('{"a":1')).toThrow()
  })
  it('大量未闭合花括号（模型复读/截断）快速抛错而非 O(n²) 卡死', () => {
    // 无扫描预算时 20 万个 '{' 会冻结数十秒；有预算则毫秒级抛错。测试能在超时内完成即证明未退化
    const t0 = performance.now()
    expect(() => extractJson('{'.repeat(200000))).toThrow()
    expect(performance.now() - t0).toBeLessThan(1000)
  })
  it('大量前置废话后的合法 JSON 仍能解析（预算不误伤正常输入）', () => {
    expect(extractJson('废话'.repeat(20000) + '{"a":1}')).toEqual({ a: 1 })
  })
})

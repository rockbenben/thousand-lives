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
})

import { describe, it, expect } from 'vitest'
import { isHttpUrl } from './url'

describe('isHttpUrl', () => {
  // 这一条就是它存在的理由：漏协议头的地址拼出来是相对地址，静默 404 在本站上
  it('漏写协议头的地址不合格', () => {
    expect(isHttpUrl('cors.api2026.workers.dev')).toBe(false)
    expect(isHttpUrl('/api/relay')).toBe(false)
  })

  it('合法的 http(s) 地址通过（本地服务常用明文 http）', () => {
    expect(isHttpUrl('https://cors.api2026.workers.dev')).toBe(true)
    expect(isHttpUrl('http://127.0.0.1:8787')).toBe(true)
    expect(isHttpUrl('  https://x.example/relay  ')).toBe(true)
  })

  it('别的协议一律不合格 —— 它要拼成 fetch 的目标', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('ftp://x.example')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
  })
})

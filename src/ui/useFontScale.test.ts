import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFontScale, writeFontScale, DEFAULT_SCALE, FONT_SCALES } from './useFontScale'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})

beforeEach(() => store.clear())

describe('font scale persistence', () => {
  it('无存值时回落到默认（中=1.0）', () => {
    expect(readFontScale()).toBe(DEFAULT_SCALE)
    expect(DEFAULT_SCALE).toBe(1)
  })

  it('读取已存的合法档位', () => {
    writeFontScale(1.15)
    expect(readFontScale()).toBe(1.15)
  })

  it('非法/越界存值回落默认', () => {
    localStorage.setItem('qs.fontScale', '0.5') // 不在档位集合
    expect(readFontScale()).toBe(DEFAULT_SCALE)
    localStorage.setItem('qs.fontScale', 'abc')
    expect(readFontScale()).toBe(DEFAULT_SCALE)
  })

  it('四档齐全且含默认中档', () => {
    const scales = FONT_SCALES.map((s) => s.scale)
    expect(scales).toEqual([0.9, 1.0, 1.15, 1.3])
    expect(scales).toContain(DEFAULT_SCALE)
  })

  it('writeFontScale 写入 localStorage', () => {
    writeFontScale(1.3)
    expect(localStorage.getItem('qs.fontScale')).toBe('1.3')
  })
})

import { useCallback, useEffect, useState } from 'react'

// 正文字号档位：只缩放阅读类文字（叙事/选项/反馈），不动布局。
// 通过根元素的 CSS 变量 --font-scale 驱动，全站正文 calc() 跟随。
export const FONT_SCALES = [
  { id: 'sm', label: '小', scale: 0.9 },
  { id: 'md', label: '中', scale: 1.0 },
  { id: 'lg', label: '大', scale: 1.15 },
  { id: 'xl', label: '特大', scale: 1.3 },
] as const

export const DEFAULT_SCALE = 1.0
const KEY = 'qs.fontScale'
const VALID = new Set<number>(FONT_SCALES.map((s) => s.scale))

// 读取已存档位；无值/非法/越界一律回落默认（中）
export function readFontScale(): number {
  try {
    const n = Number(localStorage.getItem(KEY))
    return VALID.has(n) ? n : DEFAULT_SCALE
  } catch {
    return DEFAULT_SCALE
  }
}

export function writeFontScale(scale: number): void {
  try {
    localStorage.setItem(KEY, String(scale))
  } catch {
    // 配额满等写入失败不影响当次生效，仅刷新后不保留
  }
}

// 应用到根元素（只在浏览器端）
export function applyFontScale(scale: number): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--font-scale', String(scale))
  }
}

// 设置页与对局头部共用：各自实例读同一 localStorage，切档即写入 + 应用到根变量（全局生效）。
// 默认值起步，挂载后再读真值，避免 SSR/hydration 不一致。
export function useFontScale() {
  const [scale, setScale] = useState<number>(DEFAULT_SCALE)
  useEffect(() => {
    const s = readFontScale()
    setScale(s)
    applyFontScale(s)
  }, [])
  const set = useCallback((s: number) => {
    setScale(s)
    applyFontScale(s)
    writeFontScale(s)
  }, [])
  return { scale, set }
}

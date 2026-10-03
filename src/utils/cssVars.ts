import type { CSSProperties } from 'react'

// CSS 自定义属性注入（style 对象只放 --token，规则本体留在 styles.css）
export const cssVars = (vars: Record<string, string>): CSSProperties => vars as CSSProperties

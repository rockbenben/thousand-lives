import type { Attribute, Band } from '../scenarios/schema'

export type Severity = 'critical' | 'low' | 'normal' | 'high'

export interface ResolvedBand {
  label: string
  severity: Severity
  directive?: string
}

// 未定义 bands 的属性按占比派生通用分段，保证每个属性都有可显示的状态与告警
function derivedBand(attr: Attribute, value: number): ResolvedBand {
  const ratio = value / attr.max
  if (ratio <= 0.2) return { label: '告急', severity: 'critical' }
  if (ratio <= 0.45) return { label: '偏低', severity: 'low' }
  if (ratio <= 0.85) return { label: '尚可', severity: 'normal' }
  return { label: '充裕', severity: 'high' }
}

// 取值落入的状态段：bands 升序，命中第一个 value <= upTo 的段；超出最后一段则归入最后一段
export function bandOf(attr: Attribute, value: number): ResolvedBand {
  if (!attr.bands || attr.bands.length === 0) return derivedBand(attr, value)
  const hit: Band = attr.bands.find((b) => value <= b.upTo) ?? attr.bands[attr.bands.length - 1]
  return { label: hit.label, severity: hit.severity, directive: hit.directive }
}

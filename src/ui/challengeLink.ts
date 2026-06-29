import { builtinScenarios } from '../scenarios'
import { openingLabel } from '../engine/state'
import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'

// 挑战链接：把「题材 + 开局」编码进 URL（?s=&o=），别人点开直接进同款开局，形成裂变。
// 仅内置剧本可编码；自定义/生成局退回纯首页链。
export interface Challenge {
  scenarioId: string
  opening?: number
}

export function encodeChallenge(sc: Scenario, openingIndex?: number): string | null {
  if (!builtinScenarios.some((b) => b.id === sc.id)) return null
  const p = new URLSearchParams()
  p.set('s', sc.id)
  if (openingIndex !== undefined && openingIndex >= 0) p.set('o', String(openingIndex))
  return p.toString()
}

// 从局内状态反查开局下标（state.opening 存 `${name}——${prompt}`），供分享链编码。
export function openingIndexOf(sc: Scenario, st: GameState): number | undefined {
  if (!st.opening || !sc.openings) return undefined
  const i = sc.openings.findIndex((o) => openingLabel(o) === st.opening)
  return i >= 0 ? i : undefined
}

// 完整分享 URL（基于站点 origin+path）；无 challenge（自定义局）时回退纯首页链。
export function buildShareUrl(sc: Scenario, openingIndex?: number, base?: string): string {
  const root =
    base ?? (typeof location !== 'undefined' ? location.origin + location.pathname : '')
  const q = encodeChallenge(sc, openingIndex)
  return q ? `${root}?${q}` : root
}

// 解析 query 串 → Challenge。剧本须在内置表中；opening 越界/非法则丢弃（回退默认开局）。
export function parseChallenge(search: string): Challenge | null {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const s = p.get('s')
  if (!s) return null
  const sc = builtinScenarios.find((b) => b.id === s)
  if (!sc) return null
  const oRaw = p.get('o')
  const o = oRaw != null ? Number(oRaw) : undefined
  const openingCount = sc.openings?.length ?? 0
  const opening =
    o !== undefined && Number.isInteger(o) && o >= 0 && o < openingCount ? o : undefined
  return { scenarioId: s, opening }
}

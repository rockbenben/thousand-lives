import type { AIConfig } from './ai/types'
import { keyOptional } from './ai/presets'
import type { GameState, TurnResult } from './engine/types'
import { turnResultSchema } from './ai/turn'
import { scenarioSchema, type Scenario } from './scenarios/schema'
import { builtinScenarios } from './scenarios'

// 内置剧本的存档快照可能是旧版本（无 bands/directive 等）；加载时用当前定义刷新，
// 让已存的内置剧本游戏立刻享受到引擎/内容更新。属性 key 不变，结算不受影响。
// maxTurns 从存档保留、不取基准：早期版本曾让玩家在开局选「人生长度」并把非基准值写进存档，
// 保留它可避免这类旧存档续玩时寿命被悄悄还原成基准值。
//（当前 Setup 已不提供长度选择，新存档此值即基准，保留为无害的向后兼容兜底。）
function refreshBuiltin(sc: Scenario): Scenario {
  const base = builtinScenarios.find((b) => b.id === sc.id)
  if (!base) return sc
  return typeof sc.maxTurns === 'number' ? { ...base, maxTurns: sc.maxTurns } : base
}

const CONFIG_KEY = 'tl.config'
const SAVE_KEY = 'tl.save'
const CUSTOM_KEY = 'tl.customScenarios'
const SLOTS_KEY = 'tl.slots'
const ENDINGS_KEY = 'tl.endings'
const STATS_KEY = 'tl.stats'

export const SAVE_VERSION = 2

export interface SaveGame {
  v?: number
  scenario: Scenario
  state: GameState
  pendingTurn: TurnResult | null
  // 玩家已提交、等待 AI 结算的自定义行动（结算后清空）
  pendingAction?: string
}

// 命名存档位
export interface SaveSlot {
  id: string
  name: string
  savedAt: number
  game: SaveGame
}

// 校验并规整一个 SaveGame：剧本过 schema、history 为数组、损坏的 pendingTurn 丢弃、内置剧本刷新到最新。
// 不合法返回 null。导入/读取/存档位共用同一套校验。
export function validateSaveGame(data: unknown): SaveGame | null {
  try {
    const d = data as SaveGame
    if (!d || typeof d !== 'object') return null
    if (d.v !== SAVE_VERSION) return null
    scenarioSchema.parse(d.scenario)
    if (!d.state || typeof d.state !== 'object' || !Array.isArray(d.state.history)) return null
    // attributes 必须是普通对象（非 null / 数组）——否则 Play 里 state.attributes[key] 在 null 上属性访问会抛错崩溃(白屏)。
    // 注：此处不校验键是否齐全或值为数字（缺键 / 非数值只会渲染成 NaN，不会崩溃）
    const attrs = d.state.attributes
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) return null
    const scenario = refreshBuiltin(d.scenario)
    const pendingTurn =
      d.pendingTurn != null && !turnResultSchema.safeParse(d.pendingTurn).success
        ? null
        : (d.pendingTurn ?? null)
    return { ...d, scenario, pendingTurn }
  } catch {
    return null
  }
}

// AI 配置按服务商预设分别存储：每个预设各记自己的 key/baseURL/model（key 跟服务商走，
// 切换服务商不会串用别家的 key），activePresetId 标记当前在用的一个。
interface AIConfigStore {
  activePresetId?: string
  presets: Record<string, AIConfig>
}

// 读并规整配置存储：兼容旧的「单个扁平 AIConfig」格式（迁移为单预设 map）。
function readAIConfigStore(): AIConfigStore {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { presets: {} }
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return { presets: {} }
    // 新格式：{ activePresetId, presets }
    if (obj.presets && typeof obj.presets === 'object' && !Array.isArray(obj.presets)) {
      return {
        activePresetId: typeof obj.activePresetId === 'string' ? obj.activePresetId : undefined,
        presets: obj.presets as Record<string, AIConfig>,
      }
    }
    // 旧格式：扁平 AIConfig —— 以其 presetId/provider 为键迁移为单预设 map
    if (typeof obj.provider === 'string') {
      const c = obj as unknown as AIConfig
      const id = c.presetId || c.provider
      return { activePresetId: id, presets: { [id]: c } }
    }
    return { presets: {} }
  } catch {
    return { presets: {} }
  }
}

/**
 * 一份配置算不算「配好了」——落盘与读取共用同一条判据，两处分开写必然漂。
 *
 * ⚠ key 不是人人都要：自建网关与局域网里的本地推理（LM Studio / Ollama /
 * llama.cpp / LiteLLM）没有 key 这个概念，它们的【地址】才是凭据。判据取自目录
 * 的 keyOptional，不在这里按 id 列名单。
 *
 * 漏掉这条的后果是静默的：界面允许不填 key 就开局，配置却一次都存不下来 ——
 * saveConfig 走 else 分支把它删掉，刷新后归零，而全程没有任何报错。
 */
export function isComplete(c: AIConfig | undefined): c is AIConfig {
  if (!c || !c.provider || !c.model) return false
  return Boolean(c.apiKey) || (keyOptional(c.presetId) && Boolean(c.baseURL))
}

// 当前活跃服务商的完整配置；未配置完整返回 null。
export function loadConfig(): AIConfig | null {
  const store = readAIConfigStore()
  const c = store.activePresetId ? store.presets[store.activePresetId] : undefined
  return isComplete(c) ? c : null
}

// 取某服务商预设已存的配置（切换服务商时恢复其专属 key/baseURL/model）；未配置过返回 undefined。
export function loadPresetConfig(presetId: string): AIConfig | undefined {
  return readAIConfigStore().presets[presetId]
}

// 保存某服务商配置并置为当前活跃（配置一经修改即调用，不必等到开局）。按 presetId（无则 provider）归档。
// 仅落盘「完整可用」的配置（判据见 isComplete）：空 / 仅默认的不存，并清掉该服务商
// 可能残留的空条目、不改动当前活跃项——避免只是切过去看一眼就留下噪声条目。
export function saveConfig(c: AIConfig): void {
  const store = readAIConfigStore()
  const id = c.presetId || c.provider
  if (isComplete(c)) {
    store.presets[id] = c
    store.activePresetId = id
  } else {
    delete store.presets[id]
  }
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(store))
  } catch {
    // 配额满等写入失败不打断配置流程（内存态 UI 仍可用）
  }
}

export function loadSave(): SaveGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return validateSaveGame(JSON.parse(raw))
  } catch {
    return null
  }
}

export function saveSave(s: SaveGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, v: SAVE_VERSION }))
  } catch (e) {
    // 配额满等存储失败不应打断游戏：内存中的状态仍然有效，只是刷新后无法恢复
    console.warn('存档写入失败', e)
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY)
}

export function loadCustomScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as unknown[]
    return list.flatMap((s) => {
      try {
        return [scenarioSchema.parse(s)]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function addCustomScenario(sc: Scenario): void {
  // 在原始列表上替换/追加，不经 loadCustomScenarios 回写：
  // 未通过当前校验的旧剧本只是不展示，其数据不应被覆写抹除
  let raw: unknown[] = []
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as unknown
    if (Array.isArray(parsed)) raw = parsed
  } catch {
    // 整个列表损坏到无法解析时才放弃旧数据
  }
  const rest = raw.filter(
    (s) => !(typeof s === 'object' && s !== null && (s as { id?: unknown }).id === sc.id),
  )
  localStorage.setItem(CUSTOM_KEY, JSON.stringify([...rest, sc]))
}

// ── 命名存档位 ──

export function listSlots(): SaveSlot[] {
  try {
    const raw = localStorage.getItem(SLOTS_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as unknown[]
    if (!Array.isArray(list)) return []
    return list
      .flatMap((s) => {
        const o = s as Partial<SaveSlot>
        const game = validateSaveGame(o?.game)
        if (!game || typeof o.id !== 'string') return []
        return [{ id: o.id, name: o.name || '未命名', savedAt: o.savedAt || 0, game }]
      })
      .sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

// 原始列表读取：写回时不经校验，避免把当前校验不过的旧存档位抹除
function rawSlots(): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SLOTS_KEY) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveToSlot(name: string, game: SaveGame, now: number): SaveSlot | null {
  const slot: SaveSlot = { id: `slot_${now}`, name: name.trim() || '未命名', savedAt: now, game: { ...game, v: SAVE_VERSION } }
  try {
    localStorage.setItem(SLOTS_KEY, JSON.stringify([...rawSlots(), slot]))
  } catch (e) {
    // 配额满等写入失败：返回 null 让调用方提示用户。不能静默吞掉——否则界面会假报「已存 ✓」而存档实际未落盘
    console.warn('存档位写入失败', e)
    return null
  }
  return slot
}

export function deleteSlot(id: string): void {
  const rest = rawSlots().filter(
    (s) => !(typeof s === 'object' && s !== null && (s as { id?: unknown }).id === id),
  )
  localStorage.setItem(SLOTS_KEY, JSON.stringify(rest))
}

// ── 结局图鉴：记录每个剧本见过的结局基调 ──

type EndingLog = Record<string, string[]>

function readEndingLog(): EndingLog {
  try {
    const raw = localStorage.getItem(ENDINGS_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as EndingLog
    return o && typeof o === 'object' ? o : {}
  } catch {
    return {}
  }
}

export function recordEnding(
  scenarioId: string,
  tone: string,
  meta?: {
    rating?: string
    local?: boolean
    isDeath?: boolean
    turns?: number
    goal?: number
    custom?: boolean
  },
): void {
  const t = tone.trim()
  if (!scenarioId || !t) return
  const log = readEndingLog()
  const seen = Array.isArray(log[scenarioId]) ? log[scenarioId] : []
  if (!seen.includes(t)) {
    log[scenarioId] = [...seen, t]
    try {
      localStorage.setItem(ENDINGS_KEY, JSON.stringify(log))
    } catch {
      // 配额满等写入失败不应抛出：此函数在 Ending 的 useEffect 内被裸调用，
      // 抛出会中断后续全局统计累积，并让结局界面的 effect 报错
    }
  }
  // 累积全局统计（成就用）：每次收束都计一局，评级去重，本地/AI 通关与死亡置位
  const s = loadStats()
  s.runs += 1
  if (meta?.rating && !s.ratings.includes(meta.rating)) s.ratings.push(meta.rating)
  if (meta?.rating === 'S') {
    s.sRanks += 1
    if (!s.sRankScenarios.includes(scenarioId)) s.sRankScenarios.push(scenarioId)
  }
  if (meta?.local) s.anyLocal = true
  else s.anyAi = true
  if (meta?.isDeath) s.deaths += 1
  else s.aliveClear = true
  if (typeof meta?.turns === 'number') s.maxTurns = Math.max(s.maxTurns, meta.turns)
  if (typeof meta?.goal === 'number') s.maxGoal = Math.max(s.maxGoal, meta.goal)
  if (meta?.custom) s.customCleared = true
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s))
  } catch {
    // 忽略写入失败（配额满等）
  }
}

export function seenEndings(scenarioId: string): string[] {
  const log = readEndingLog()
  return Array.isArray(log[scenarioId]) ? log[scenarioId] : []
}

export interface RunStats {
  runs: number
  ratings: string[]
  anyLocal: boolean
  anyAi: boolean
  deaths: number
  // 扩充统计（成就用）：S 级次数、单局最长寿命、最高目标完成度、是否通关过自创/导入剧本、是否有过不死通关
  sRanks: number
  maxTurns: number
  maxGoal: number
  customCleared: boolean
  aliveClear: boolean
  // 取得过 S 级评价的不同剧本 id（跨题材精通成就用）
  sRankScenarios: string[]
}

export function loadStats(): RunStats {
  try {
    const o = JSON.parse(localStorage.getItem(STATS_KEY) ?? '') as Partial<RunStats>
    return {
      runs: typeof o.runs === 'number' ? o.runs : 0,
      ratings: Array.isArray(o.ratings) ? o.ratings.filter((r) => typeof r === 'string') : [],
      anyLocal: o.anyLocal === true,
      anyAi: o.anyAi === true,
      deaths: typeof o.deaths === 'number' ? o.deaths : 0,
      sRanks: typeof o.sRanks === 'number' ? o.sRanks : 0,
      maxTurns: typeof o.maxTurns === 'number' ? o.maxTurns : 0,
      maxGoal: typeof o.maxGoal === 'number' ? o.maxGoal : 0,
      customCleared: o.customCleared === true,
      aliveClear: o.aliveClear === true,
      sRankScenarios: Array.isArray(o.sRankScenarios)
        ? o.sRankScenarios.filter((x) => typeof x === 'string')
        : [],
    }
  } catch {
    return emptyStats()
  }
}

function emptyStats(): RunStats {
  return {
    runs: 0, ratings: [], anyLocal: false, anyAi: false, deaths: 0,
    sRanks: 0, maxTurns: 0, maxGoal: 0, customCleared: false, aliveClear: false,
    sRankScenarios: [],
  }
}

// ── 导出 / 导入（文件） ──

// 导出为带元信息的封装，便于校验与未来兼容
export function exportSaveString(game: SaveGame): string {
  // 内存态 session（App.startGame/updateSession 持有）不带 v——与 saveSave/saveToSlot 一致地在导出时补上，
  // 否则导出的文件 game.v 为 undefined，被 validateSaveGame 当作旧版本拒绝，导致导出物无法再导入。
  return JSON.stringify({ kind: 'thousand-lives-save', version: 1, game: { ...game, v: SAVE_VERSION } }, null, 2)
}

// 解析导出文件；兼容直接是 SaveGame 的裸 JSON。不合法抛错（含中文提示）
export function parseSaveFile(text: string): SaveGame {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('不是合法的 JSON 文件')
  }
  const wrapped = data as { kind?: string; game?: unknown }
  const candidate = wrapped && wrapped.kind === 'thousand-lives-save' ? wrapped.game : data
  const game = validateSaveGame(candidate)
  if (!game) throw new Error('存档格式无效或已损坏')
  return game
}

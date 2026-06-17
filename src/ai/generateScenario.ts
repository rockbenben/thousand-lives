import { z } from 'zod'
import type { AIConfig } from './types'
import type { ChatMessage } from '../engine/types'
import { chat, type ChatFn } from './client'
import { extractJson } from './json'
import { parseCondition, conditionAttrs } from '../engine/condition'
import {
  attributeSchema,
  openingSchema,
  endingSchema,
  localEventSchema,
  importScenarioSchema,
  type Scenario,
  type LocalEvent,
} from '../scenarios/schema'

// 「主题 → 完整剧本」生成管线：借鉴 MiroFish「种子 + LLM → 严格结构化产出」的思路，
// 但产出的是单主角分支叙事剧本（属性/结局/本地事件池），并以 importScenarioSchema 作为硬契约。
// 分两阶段、事件分批，避免单次输出过长被截断；每段都过 schema 校验，无效项丢弃而非整体失败。

export interface GenProgress {
  phase: 'skeleton' | 'events' | 'done'
  events: number
  target: number
  message?: string
}

export interface GenerateOptions {
  target?: number
  batchSize?: number
  existingIds?: string[]
  chatFn?: ChatFn
  signal?: AbortSignal
  onProgress?: (p: GenProgress) => void
}

const CONDITION_GRAMMAR = `条件语法（严格）：只能用 "属性key<=数字"、"属性key>=数字"、或字面量 "maxTurns"；多个子句用 " & " 连接表示「同时满足」。属性 key 必须是本剧本已定义的。例：'favor<=0'、'maxTurns & hp>=70 & sanity>=70'。不支持 < > == 或任何其它写法。`

// 骨架：除 localEvents 外的全部字段。
const skeletonSchema = z.object({
  title: z.string().min(1),
  emoji: z.string().min(1),
  intro: z.string().min(1),
  attributes: z.array(attributeSchema).min(1),
  openings: z.array(openingSchema).min(1),
  ambitions: z.array(z.string().min(1)).min(1),
  turnUnit: z.string().min(1),
  maxTurns: z.number().int().positive(),
  systemPrompt: z.string().min(1),
  endings: z.array(endingSchema).min(1),
})
type Skeleton = z.infer<typeof skeletonSchema>

function uniqueId(theme: string, taken: Set<string>): string {
  const ascii = theme.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const base = `gen-${ascii || 'scenario'}`.slice(0, 32)
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}-${n++}`
  return id
}

function skeletonPrompt(theme: string): ChatMessage[] {
  return [
    {
      role: 'system',
      content: `你是文字人生模拟游戏的资深剧本设计师。根据用户给的主题，设计一个剧本「骨架」，只输出一个 JSON 对象，不要任何解释或代码围栏。

字段要求：
- title：中文剧本名（4-6字）。emoji：单个最贴切的 emoji。intro：2-3句开场背景，有代入感。
- attributes：恰好 3 个核心属性。每个 { key（小写英文标识符，如 hp/favor）, name（中文名）, initial, max（统一为 100）, deathBelow（可选，归零即死的属性设为 0，且必须小于 initial）, bands（3-4 段命名分段，按 upTo 严格升序，每段 { upTo, label（2-4字中文）, severity（critical|low|normal|high）, directive（可选：落入该段时给主持AI的硬指令，如低值出危机） }） }。其中 1-2 个设为「死亡属性」(deathBelow:0)，其余作为成长/进度属性（无 deathBelow，初值偏低）。
- openings：3 个开局身份 { name, prompt（一句话身份设定） }。
- ambitions：5 条玩家可选的目标（短句）。
- turnUnit：单字回合单位（如 天/年/月/载/章）。maxTurns：20-30 的整数。
- systemPrompt：给主持AI的世界观与规则（说明各属性含义、死亡条件、文风），简洁有力。
- endings：18-20 个结局 { condition, tone（中文结局基调名，如 "功成名就·..."） }。${CONDITION_GRAMMAR}
  结局排序：死亡属性的 "key<=0" 放最前；其后是若干即时极端结局；再后是 "maxTurns & ..." 满任结局，子句多（具体）的在前、少的在后，最后一条用纯 "maxTurns" 兜底。条件引用的属性必须都在 attributes 里。

不要输出 localEvents 字段。只输出 JSON 对象。`,
    },
    { role: 'user', content: `主题：${theme}` },
  ]
}

function eventsPrompt(theme: string, sk: Skeleton, usedSummaries: string[], n: number): ChatMessage[] {
  const attrLines = sk.attributes
    .map((a) => `  ${a.key}（${a.name}${a.deathBelow !== undefined ? '，死亡属性，归零即死' : '，成长属性'}）`)
    .join('\n')
  return [
    {
      role: 'system',
      content: `你在为一个文字人生模拟剧本撰写「本地事件池」（无需 AI 即可游玩的分支剧情单元）。只输出一个 JSON 对象 { "events": [ ... ] }，不要任何解释或围栏。

剧本：《${sk.title}》——${sk.intro}
回合单位：${sk.turnUnit}，全局共 ${sk.maxTurns} 回合。
属性（effects 与 requires 只能用这些 key）：
${attrLines}

每个事件对象字段：
- narrative：1-3 句有张力的情境描写。
- choices：2-4 个选项，每个 { text（选项文案）, effects（对象，键为上面的属性 key，值为正负整数） }。同一事件各选项要形成真实取舍：成长属性小步变化（约 ±4~±12），死亡属性在危机时可较大波动但单个选项不应一击必死；至少一个选项带明显代价。谨慎/稳妥的选项不可严格劣于冒险选项。
- summary：≤6 字的事件名，必须唯一、且不得与下列已用名重复。
- 可选：minTurn / maxTurn（1~${sk.maxTurns} 的整数）、once（true 表示一局最多触发一次）、weight（加权随机权重，默认1）、requires（${CONDITION_GRAMMAR}）、requiresItem（需持有的物品名）、itemsGained / itemsLost（物品名数组）。用这些做出「随状态/进度解锁的分支」与物品线。

已用事件名（务必避开）：${usedSummaries.length ? usedSummaries.join('、') : '（无）'}

本次产出 ${n} 个**风格各异、互不雷同**的事件。只输出 { "events": [...] }。`,
    },
    { role: 'user', content: `主题：${theme}。请产出 ${n} 个新事件。` },
  ]
}

// 校验单个事件：结构 + requires 条件可解析且只引用已定义属性 + effects 只保留已定义属性键。
function sanitizeEvent(raw: unknown, attrKeys: Set<string>): LocalEvent | null {
  const parsed = localEventSchema.safeParse(raw)
  if (!parsed.success) return null
  const ev = parsed.data
  // effects 仅保留合法属性键
  ev.choices = ev.choices.map((c) => ({
    ...c,
    effects: Object.fromEntries(Object.entries(c.effects).filter(([k]) => attrKeys.has(k))),
  }))
  if (ev.choices.some((c) => Object.keys(c.effects).length === 0)) return null
  if (ev.requires) {
    try {
      if (conditionAttrs(parseCondition(ev.requires)).some((a) => !attrKeys.has(a))) return null
    } catch {
      return null
    }
  }
  return ev
}

async function genJson(cfg: AIConfig, messages: ChatMessage[], chatFn: ChatFn, signal?: AbortSignal): Promise<unknown> {
  const text = await chatFn(cfg, messages, undefined, signal)
  return extractJson(text)
}

export async function generateScenario(
  cfg: AIConfig,
  theme: string,
  opts: GenerateOptions = {},
): Promise<Scenario> {
  const target = opts.target ?? 40
  const batchSize = opts.batchSize ?? 10
  const chatFn = opts.chatFn ?? chat
  const report = (p: GenProgress) => opts.onProgress?.(p)

  report({ phase: 'skeleton', events: 0, target })
  const sk = skeletonSchema.parse(await genJson(cfg, skeletonPrompt(theme), chatFn, opts.signal))
  const attrKeys = new Set(sk.attributes.map((a) => a.key))

  const events: LocalEvent[] = []
  const used = new Set<string>()
  const maxRounds = Math.ceil(target / batchSize) + 3
  for (let round = 0; round < maxRounds && events.length < target; round++) {
    report({ phase: 'events', events: events.length, target })
    const want = Math.min(batchSize, target - events.length)
    let batch: unknown
    try {
      batch = await genJson(cfg, eventsPrompt(theme, sk, [...used], want), chatFn, opts.signal)
    } catch (e) {
      // 用户取消时向上传播（与骨架阶段一致），否则会空转剩余轮次并把残缺剧本当成功提交
      if (opts.signal?.aborted) throw e
      continue // 本批解析失败，重试下一轮
    }
    const arr = Array.isArray(batch) ? batch : Array.isArray((batch as { events?: unknown }).events) ? (batch as { events: unknown[] }).events : []
    for (const raw of arr) {
      if (events.length >= target) break
      const ev = sanitizeEvent(raw, attrKeys)
      if (ev && !used.has(ev.summary)) {
        used.add(ev.summary)
        events.push(ev)
      }
    }
  }

  // 一个支线都没产出意味着该剧本没有可玩的本地模式（hasLocalMode 为 false）——
  // 这是失败而非成功，不能静默提交：抛错让上层提示用户重试/换模型。
  if (events.length === 0) throw new Error('未能生成任何有效支线事件，请重试或更换模型')

  const id = uniqueId(theme, new Set(opts.existingIds ?? []))
  const scenario = { ...sk, id, localEvents: events }
  report({ phase: 'done', events: events.length, target })
  return importScenarioSchema.parse(scenario) as Scenario
}

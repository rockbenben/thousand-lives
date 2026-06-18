import { z } from 'zod'
import { parseCondition, conditionAttrs } from '../engine/condition'

// 命名状态分段：当属性值 <= upTo 时落入该段。severity 决定 UI 配色与告警；
// directive 是落入该段时注入给 AI 的硬指令，让剧情据数值改写（低理智出幻觉等）。
export const bandSchema = z.object({
  upTo: z.number(),
  label: z.string().min(1),
  severity: z.enum(['critical', 'low', 'normal', 'high']).default('normal'),
  directive: z.string().optional(),
})

export const attributeSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-zA-Z0-9_]*$/, '属性 key 必须是小写字母开头的 ASCII 标识符'),
    name: z.string().min(1),
    initial: z.number(),
    max: z.number().positive(),
    deathBelow: z.number().optional(),
    // 每回合自动衰减量（>=0）：回合推进时该属性自动 -decayPerTurn，再叠加本回合 effect。
    // 用于「逆水行舟」式张力——如修仙的寿元随岁月流逝，须主动续命方能久持。不填即不衰减。
    decayPerTurn: z.number().nonnegative().optional(),
    // 有效上限：初始 ceiling（缺省=max），持有 ceilingUnlocks 中的印记后逐级抬高。
    // 用于「机缘封顶」——无突破印记则修为/寿元卡在低位。
    ceiling: z.number().optional(),
    ceilingUnlocks: z.array(z.object({ flag: z.string(), max: z.number() })).optional(),
    bands: z.array(bandSchema).min(1).optional(),
  })
  .refine((a) => a.initial >= 0 && a.initial <= a.max, {
    message: 'initial 必须在 [0, max] 范围内',
  })
  .refine((a) => a.deathBelow === undefined || a.deathBelow < a.initial, {
    message: 'deathBelow 必须小于 initial，否则开局即死',
  })
  .refine(
    (a) => !a.bands || a.bands.every((b, i) => i === 0 || b.upTo > a.bands![i - 1].upTo),
    { message: 'bands 的 upTo 必须严格升序' },
  )

export const openingSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  // 开局即写入的身份印记（如 '魔道'），用于身份门控事件
  flag: z.string().optional(),
})

// 加权分支：选择可以有多个结果，每个结果带权重、effects、标记等
export const outcomeSchema = z.object({
  weight: z.number().positive().default(1),
  effects: z.record(z.string(), z.number()).default({}),
  reaction: z.string().optional(),
  narrative: z.string().optional(),
  flagsSet: z.array(z.string()).optional(),
  flagsClear: z.array(z.string()).optional(),
  itemsGained: z.array(z.string().min(1)).optional(),
  itemsLost: z.array(z.string().min(1)).optional(),
  endTone: z.string().optional(),
})

// 本地事件：无需 AI 即可游玩的预置剧情单元。本地模式下引擎从事件池加权随机抽取组合成一局。
export const localChoiceSchema = z.object({
  text: z.string().min(1),
  effects: z.record(z.string(), z.number()).default({}),
  // 选择后他人的即时反馈（本地模式展示，营造代入与「爽感」）
  reaction: z.string().optional(),
  // 加权分支：存在则引擎掷骰取一，每分支自带 effects/印记/可选强制结局
  outcomes: z.array(outcomeSchema).min(1).optional(),
  flagsSet: z.array(z.string()).optional(),
  flagsClear: z.array(z.string()).optional(),
  endTone: z.string().optional(),
})
export const localEventSchema = z.object({
  narrative: z.string().min(1),
  choices: z.array(localChoiceSchema).min(2).max(6),
  summary: z.string().min(1),
  // 回合区间限制（含端点）；only 仅触发一次；weight 加权随机权重（默认 1）
  minTurn: z.number().int().positive().optional(),
  maxTurn: z.number().int().positive().optional(),
  once: z.boolean().optional(),
  weight: z.number().positive().optional(),
  // 触发门控：requires 是结局条件语法（如 "sanity<=20"），满足才可能抽到；requiresItem 需持有该物品。
  // 由此实现「选择→状态→解锁不同事件」的涌现式分支。
  requires: z.string().optional(),
  requiresItem: z.string().optional(),
  // 本回合获得/失去的物品（回合级，任选其一都生效）
  itemsGained: z.array(z.string().min(1)).optional(),
  itemsLost: z.array(z.string().min(1)).optional(),
  // 里程碑事件：仅在「命运抉择」关键回合出现，呈现为剧情大卡 + 专属配图（按 summary 取图）。
  keyMoment: z.boolean().optional(),
  // 野事件：意外/奇遇，任何回合可低概率乱入（pickLocalEvent 给保底权重）
  wildcard: z.boolean().optional(),
})

export const endingSchema = z.object({
  condition: z.string().min(1),
  tone: z.string().min(1),
  // 本地模式的专属结局尾声（一段沉浸式收束文案）；缺省时回退到通用模板
  epilogue: z.string().optional(),
})

export const scenarioSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    emoji: z.string().min(1),
    intro: z.string().min(1),
    attributes: z.array(attributeSchema).min(1),
    openings: z.array(openingSchema).optional(),
    turnUnit: z.string().default('回合'),
    maxTurns: z.number().int().positive().optional(),
    systemPrompt: z.string().min(1),
    endings: z.array(endingSchema).min(1),
    // 可选的建议「野心/目标」，玩家可选其一或自定义；不填则只提供自定义
    ambitions: z.array(z.string().min(1)).optional(),
    // 本地事件池：存在且非空时，该剧本支持「无需 AI · 本地试玩」模式
    localEvents: z.array(localEventSchema).optional(),
  })
  // 这里只校验运行期必需的不变量（重复 key 会双重结算 effects；语法非法的条件会让 checkEnding 抛错）。
  // 作者契约级检查放在 importScenarioSchema，避免已持久化的旧数据被追溯性作废。
  .superRefine((sc, ctx) => {
    const keys = new Set<string>()
    sc.attributes.forEach((a, i) => {
      if (keys.has(a.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['attributes', i, 'key'],
          message: `属性 key "${a.key}" 重复`,
        })
      }
      keys.add(a.key)
    })
    sc.endings.forEach((e, i) => {
      try {
        parseCondition(e.condition)
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endings', i, 'condition'],
          message: err instanceof Error ? err.message : String(err),
        })
      }
    })
  })

// 导入边界的额外检查：结局条件引用未定义属性在运行期无害（evalCondition 返回 false），
// 但几乎必是作者笔误，新导入时应拒绝并提示；已存的存档/剧本仍按 scenarioSchema 宽松加载。
export const importScenarioSchema = scenarioSchema.superRefine((sc, ctx) => {
  const keys = new Set(sc.attributes.map((a) => a.key))
  sc.endings.forEach((e, i) => {
    try {
      const missing = conditionAttrs(parseCondition(e.condition)).find((a) => !keys.has(a))
      if (missing) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endings', i, 'condition'],
          message: `结局条件引用了未定义的属性 "${missing}"`,
        })
      }
    } catch {
      // 语法错误已由 scenarioSchema 报告
    }
  })
})

export type Band = z.infer<typeof bandSchema>
export type Attribute = z.infer<typeof attributeSchema>
export type Opening = z.infer<typeof openingSchema>
export type LocalEvent = z.infer<typeof localEventSchema>
export type Scenario = z.infer<typeof scenarioSchema>

import { z } from 'zod'
import { extractJsonWithStart } from './json'
import type { TurnResult } from '../engine/types'

const choiceSchema = z.object({
  text: z.string().min(1),
  effects: z.record(z.string(), z.number()).default({}),
  // AI 可授印记 / 触发隐藏结局；非必要字段，非法值容错为 undefined，不拖垮整回合解析
  flagsSet: z.array(z.string().min(1)).optional().catch(undefined),
  flagsClear: z.array(z.string().min(1)).optional().catch(undefined),
  endTone: z.string().min(1).optional().catch(undefined),
})

// prompt 契约要求 3~4 个选项，这里刻意放宽到 2~6：
// 模型偶尔多给/少给一个选项时，接受这局结果比触发一次纠错重试更划算
const choicesField = z.array(choiceSchema).min(2).max(6)

// 物品名列表：宽松接受，去掉空串，整体可缺省
const itemsField = z.array(z.string().min(1)).optional()
// 自定义行动的属性结算：可缺省
const actionEffectsField = z.record(z.string(), z.number()).optional()
// AI 托管推荐：该角色最可能选的选项下标。非必要提示字段——模型若把它写成字符串/小数等
// 非法值，不应拖垮整回合解析，故用 .catch 兜底为 undefined（该回合托管退化为随机选择）。
const recommendField = z.number().int().optional().catch(undefined)
// 记忆补充：关键事实列表。非必要提示字段，模型若给非法值不应拖垮整回合解析，故 .catch 兜底。
const memoryAddField = z.array(z.string().min(1)).optional().catch(undefined)
// 目标进度 0~100：非必要提示字段，非法值兜底为 undefined，clamp 交由 state 处理。
const goalProgressField = z.number().optional().catch(undefined)

// 完整单 JSON 格式（兼容把正文也塞进 JSON 的模型；也是存档里 pendingTurn 的形状）
export const turnResultSchema = z.object({
  narrative: z.string().min(1),
  choices: choicesField,
  summary: z.string().min(1),
  itemsGained: itemsField,
  itemsLost: itemsField,
  actionEffects: actionEffectsField,
  recommend: recommendField,
  memoryAdd: memoryAddField,
  goalProgress: goalProgressField,
})

// 流式两段格式的第二段：正文之后的收尾 JSON
const tailSchema = z.object({
  choices: choicesField,
  summary: z.string().min(1),
  itemsGained: itemsField,
  itemsLost: itemsField,
  actionEffects: actionEffectsField,
  recommend: recommendField,
  memoryAdd: memoryAddField,
  goalProgress: goalProgressField,
})

export function parseTurnResult(text: string): TurnResult {
  const { value, start } = extractJsonWithStart(text)
  const full = turnResultSchema.safeParse(value)
  if (full.success) {
    // 模型把选项清单当正文塞进 narrative 时，剥离后会变空——与两段式路径一致地抛错触发重试，
    // 而非静默返回空正文（会渲染空白并写入存档/留影）
    const narrative = stripChoiceList(full.data.narrative)
    if (!narrative) throw new Error('剧情正文为空')
    return { ...full.data, narrative }
  }
  const tail = tailSchema.parse(value)
  const narrative = stripChoiceList(
    text
      .slice(0, start)
      .replace(/```(json)?\s*$/i, '') // 正文与 JSON 之间的围栏开头
      .trim(),
  )
  if (!narrative) throw new Error('剧情正文为空')
  return { narrative, ...tail }
}

// 单行是否像选项清单项：编号（1. 1、 1) （1） ① 一、）或项目符号（- • · *）
function isChoiceLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^[①-⑩]/.test(t)) return true // 圈号通常无分隔符（①选项）
  if (/^[-•·*]\s+/.test(t)) return true // 项目符号
  if (/^[(（]\s*[0-9０-９]{1,2}\s*[)）]/.test(t)) return true // （1） (1)
  if (/^[0-9０-９]{1,2}\s*[.、:：)）]/.test(t)) return true // 1. 1、 1) 1：
  if (/^[一二三四五六七八九十]{1,2}\s*[.、:：)）]/.test(t)) return true // 一、
  return false
}

// 剥掉正文末尾的选项清单：模型常把选项既写进正文又放进 JSON，导致与按钮重复。
// 只移除“结尾连续的”清单行，避免误伤正文中段合法的编号列表。
export function stripChoiceList(text: string): string {
  const lines = text.split('\n')
  let end = lines.length
  let removed = 0
  while (end > 0 && (lines[end - 1].trim() === '' || isChoiceLine(lines[end - 1]))) {
    if (lines[end - 1].trim() !== '') removed++
    end--
  }
  if (removed === 0) return text.trimEnd()
  // 去掉清单前那句残留的引导语（如“你可以：”“请选择：”“接下来该如何？”）
  const lead = (lines[end - 1] ?? '').trim()
  if (end > 0 && lead.length <= 24 && /[:：?？]$/.test(lead)) end--
  return lines.slice(0, end).join('\n').trimEnd()
}

// 流式过程中可安全展示给玩家的正文部分：截掉已开始输出的 JSON/围栏，以及末尾的选项清单
export function visibleNarrative(s: string): string {
  const m = s.search(/```|\{\s*"/)
  const head = (m >= 0 ? s.slice(0, m) : s).replace(/^\s+/, '')
  return stripChoiceList(head)
}

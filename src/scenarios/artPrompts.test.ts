import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import promptsJson from '../../design/art-prompts.json'

// art-prompts.json 的键是 `scenarioId|中文标签`（标签 = 结局 tone / 事件 summary / `${title} · 封面` / 主题）。
// 身份字段被改写 → 键查不中 → 该槽位静默失去现成提示词（withPrompt 掉数、无人发现）。此测试把静默变响亮。
const prompts: Record<string, unknown> = promptsJson

describe('配图提示词缓存键 ↔ 剧本身份字段', () => {
  it('提示词缓存没有孤儿键（身份字段改名的信号）', () => {
    const alive = new Set<string>()
    // 不 import nodeArt 的 NODE_THEMES：nodeArt.ts 会 import.meta.glob 急切匹配约 2000 张 webp，
    // 把整堆素材拖进测试模块图。改为按前缀判活：`${title} · ` 开头的键一律视为活键，
    // 覆盖 ` · 封面` 与全部 ` · <主题>` 键，主题清单增删不需要动本测试。
    const titlePrefixes: string[] = []
    for (const sc of builtinScenarios) {
      titlePrefixes.push(`${sc.id}|${sc.title} · `)
      for (const e of sc.endings) alive.add(`${sc.id}|${e.tone}`)
      for (const ev of sc.localEvents ?? []) alive.add(`${sc.id}|${ev.summary}`)
    }
    const isAlive = (k: string) => alive.has(k) || titlePrefixes.some((p) => k.startsWith(p))
    // 成就徽章键（`-|…`）不在本判据内：其标签源自 achievements.ts 磁盘反查，噪音大于信号。
    // 历史遗留孤儿键豁免清单。Phase 2 迁移批（MG-1/MG-2，见 docs/superpowers/audit/2026-10-02-report.md §4）已兑现已归零：
    // `officialdom|文字风狱`——旧标签改名遗留的同一场景废稿，现事件「文字狱」自有活键 `officialdom|文字狱`，孤儿键退役删除；
    // `xian|极西求道`——同理，事件「云游访仙」自有活键，孤儿键退役删除。新增豁免须先入迁移清单定夺。
    const LEGACY_ORPHAN_KEYS: string[] = []
    const orphans = Object.keys(prompts).filter((k) => !k.startsWith('-|') && !isAlive(k) && !LEGACY_ORPHAN_KEYS.includes(k))
    expect(orphans, `孤儿提示词键（tone/summary/标题被改名？）：${orphans.slice(0, 20).join(' , ')}${orphans.length > 20 ? ` …共${orphans.length}条` : ''}`).toEqual([])
  })
})

// 出图清单：把「每一个该有图的槽位」从剧本源码里枚举出来（不是从磁盘扫），
// 这样新结局 / 新事件即使还没图也会出现在清单里，而不是静默回退到主题图 / 封面。
// 运行：npx vite-node scripts/art-inventory.ts
// 产物：design/art-inventory.json —— 缺图 / 尺寸不合 / 孤儿图的对账依据。
// 提示词：design/art-prompts.json（键 `scenario|中文标题`）里有就带上，补图时直接拿去生成。
import fs from 'node:fs'
import path from 'node:path'
import { builtinScenarios } from '../src/scenarios'
import { NODE_THEMES } from '../src/ui/nodeArt'
import { djb2 } from '../src/ui/djb2'
import { planFor } from './art-surfaces.mjs'
import { webpDimsOf } from './webp-dims.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const ASSETS = `${ROOT}/src/assets`
// 各类槽位的成品规格：宽高比 + 下限尺寸。
// 规格不再手写：scripts/art-surfaces.mjs 登记了每一类配图会出现在哪些面
// （真实盒子的尺寸、object-fit、位置上压了多少文字），由它推出画幅与像素。
// 下限而非精确值 —— 后端直出可能略大于规格，更大的旧文件也判为合格；
// 反过来，把小图放大凑数不增加细节（节点 / 主题图此前是 720×480 被 Real-ESRGAN
// 放大到 1920×1280，尺寸够但细节是假的），所以下限要卡在「原生重绘的尺寸」上。
const SIZE: Record<string, [number, number]> = Object.fromEntries(
  (['cover', 'ending', 'node', 'theme', 'achievement'] as const).map((kind) => [
    kind,
    planFor(kind).pixels as [number, number],
  ]),
)
// 不合格 = 比例不对，或任一维小于下限
function offSpec(i: { w: number; h: number; actual: string }): string | null {
  const m = /^(\d+)x(\d+)$/.exec(i.actual)
  if (!m) return i.actual
  const [aw, ah] = [+m[1], +m[2]]
  if (Math.abs(aw / ah - i.w / i.h) > 0.01) return `${i.actual} 比例非 ${i.w}:${i.h}`
  if (aw < i.w || ah < i.h) return `${i.actual} 小于下限 ${i.w}x${i.h}`
  return null
}
// webp 头里读实际宽高（VP8 有损 / VP8X 扩展 / VP8L 无损三种布局）——
// 解析在 scripts/webp-dims.mjs，与 scripts/verify-art.mjs 共用同一份实现。
// 这里以前自己抄了一份，无损（VP8L）那一支的位偏移抄错了五位：640×480 的
// 无损文件被读成 1×14713，槽位于是被当成「缺图」。两份拷贝迟早漂，所以只留一份。
function realDims(file: string): [number, number] | null {
  return webpDimsOf(file)
}
// 源码里 art 字段登记（`art: 'x', gen: 'gemini'`），用于回填 gen 与「改名不丢图」的稳定 id
function ledger(file: string) {
  const txt = fs.readFileSync(file, 'utf8')
  const map = new Map<string, { art: string; gen: string }>()
  for (const m of txt.matchAll(/(?:tone|summary): '([^']+)'[\s\S]{0,200}?art: '([^']+)', gen: '([^']+)'/g))
    if (!map.has(m[1])) map.set(m[1], { art: m[2], gen: m[3] })
  return map
}
// 成就徽章：id 是源码里算出来的（含按剧本展开的模板 id），这里只做「磁盘已有 → 中文名反查」
function achievementNames() {
  const txt = fs.readFileSync(`${ROOT}/src/engine/achievements.ts`, 'utf8')
  const map = new Map<string, string>()
  for (const m of txt.matchAll(/id: '([^']+)'[^}]*?name: '([^']+)'/g)) if (!map.has(m[1])) map.set(m[1], m[2])
  return map
}

const promptsFile = `${ROOT}/design/art-prompts.json`
const prompts: Record<string, string> = fs.existsSync(promptsFile) ? JSON.parse(fs.readFileSync(promptsFile, 'utf8')) : {}

type Item = {
  kind: string
  scenario: string
  label: string
  slot: string
  file: string
  path: string
  w: number
  h: number
  hasFile: boolean
  actual: string
  gen: string
  prompt?: string
}
const items: Item[] = []
const push = (kind: string, scenario: string, label: string, slot: string, dir: string, prefix = '', gen = '') => {
  const file = `${prefix}${slot}.webp`
  const rel = dir === '.' ? `src/assets/${file}` : `src/assets/${dir}/${file}`
  const abs = path.join(ASSETS, ...(dir === '.' ? [] : [dir]), file)
  const [w, h] = SIZE[kind]
  const d = realDims(abs)
  items.push({
    kind, scenario, label, slot, file, path: rel, w, h, hasFile: !!d,
    actual: d ? `${d[0]}x${d[1]}` : '缺图', gen,
    ...(prompts[kind === 'achievement' ? `-|${slot}` : `${scenario}|${label}`] ? { prompt: prompts[kind === 'achievement' ? `-|${slot}` : `${scenario}|${label}`] } : {}),
  })
}

for (const sc of builtinScenarios) {
  const scFile = `${ROOT}/src/scenarios/${sc.id}.ts`
  const led = fs.existsSync(scFile) ? ledger(scFile) : new Map()
  push('cover', sc.id, `${sc.title} · 封面`, `cover-${sc.id}`, '.', '', led.size ? 'gemini' : '')
  for (const e of sc.endings) {
    const l = led.get(e.tone)
    push('ending', sc.id, e.tone, l?.art ?? djb2(e.tone), 'endings', `${sc.id}-`, l?.gen ?? '')
  }
  for (const ev of sc.localEvents ?? []) {
    const l = led.get(ev.summary)
    push('node', sc.id, ev.summary, l?.art ?? djb2(ev.summary), 'nodes', `${sc.id}-`, l?.gen ?? '')
  }
  for (const t of NODE_THEMES) push('theme', sc.id, `${sc.title} · ${t}`, `${sc.id}-${t}`, 'node-themes')
}
const achNames = achievementNames()
for (const f of fs.readdirSync(`${ASSETS}/achievements`)) {
  const id = f.replace(/\.webp$/, '')
  push('achievement', '-', achNames.get(id) ?? id, id, 'achievements')
}

const out = {
  generatedFrom: 'src/scenarios/*.ts + src/ui/nodeArt.ts (NODE_THEMES) + src/assets/achievements/',
  counts: items.reduce<Record<string, number>>((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {}),
  missing: items.filter((i) => !i.hasFile).length,
  withPrompt: items.filter((i) => i.prompt).length,
  items,
}
fs.writeFileSync(`${ROOT}/design/art-inventory.json`, JSON.stringify(out, null, 1))
console.log(`槽位合计 ${items.length} · ${JSON.stringify(out.counts)}`)
console.log(`缺图 ${out.missing} · 带现成英文提示词 ${out.withPrompt}`)
const offsize = items.filter((i) => i.hasFile && offSpec(i))
console.log(`尺寸不合规格的 ${offsize.length} 张${offsize.length ? `：${offsize.slice(0, 5).map((i) => i.path + '=' + offSpec(i)).join(' ')}` : ''}`)
console.log(`→ design/art-inventory.json`)

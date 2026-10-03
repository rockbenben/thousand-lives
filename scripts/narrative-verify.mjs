// 叙事润色候选的一手复验：把 docs/superpowers/audit/text/*.md 里每条候选的 before 串
// 逐字对回当前剧本源码（防转述失真）。md 约定：候选标题行 `### TX-<id>-<n> …`，
// 其后第一个 `> ` 引用行即 before 原文（去掉行首 `> ` 与可选行尾 `↵`，不含其它加工）。
// 用法: node scripts/narrative-verify.mjs [xian ...]   （缺省全部文件）
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const AUDIT = path.join(ROOT, 'docs', 'superpowers', 'audit', 'text')
const only = process.argv.slice(2)
const files = fs.readdirSync(AUDIT).filter((f) => f.endsWith('.md') && (!only.length || only.includes(f.replace(/\.md$/, ''))))

let total = 0
const misses = []
for (const f of files) {
  const id = f.replace(/\.md$/, '')
  const srcFile = path.join(ROOT, 'src', 'scenarios', `${id}.ts`)
  if (!fs.existsSync(srcFile)) { misses.push(`[${id}] 剧本源码不存在: src/scenarios/${id}.ts`); continue }
  const src = fs.readFileSync(srcFile, 'utf8')
  const md = fs.readFileSync(path.join(AUDIT, f), 'utf8')
  // 逐候选块：标题 → 到下一个标题前
  const blocks = md.split(/^### /m).slice(1)
  let n = 0
  for (const b of blocks) {
    const head = b.split('\n', 1)[0]
    const m = /^TX-[a-z]+-(\d+)/.exec(head)
    if (!m) continue
    const line = b.split('\n').find((l) => l.startsWith('> '))
    if (!line) { misses.push(`[${id}] ${head.split(' ')[0]} 无 > before 行`); continue }
    const before = line.slice(2).replace(/↵\s*$/, '')
    if (!before) continue
    n++
    if (!src.includes(before)) misses.push(`[${id}] ${head.split(' ')[0]} before 未逐字命中: ${before.slice(0, 42)}…`)
  }
  total += n
  console.log(`${id}: ${n} 条已验`)
}
console.log(`合计 ${total} 条 · 未命中 ${misses.length}`)
for (const x of misses) console.log('MISS ' + x)
process.exit(misses.length ? 1 : 0)

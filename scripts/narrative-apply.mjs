#!/usr/bin/env node
// 叙事润色候选施加器：把 docs/superpowers/audit/text/<id>.md 里已批准的候选确定性地施加到
// src/scenarios/<id>.ts。候选块格式与 scripts/narrative-verify.mjs 同一套约定：
//   `### TX-<id>-NN <标题>` 开块；`- 源码: <id>.ts:<行号>` 报行号；其后第一个 `> ` 行 = before
//   （源码原文逐字子串，反斜杠转义按源码原样）；`> 改后: ` 行 = after 展示形态。
// 定位规则（行号+逐字双锁）：先试声称行号 ±2 行窗口内逐字包含 before；不中则回退全文查找——
//   恰 1 处 → 用之并报「行号漂移」；0 处 → skipped:before缺失；≥2 处 → skipped:歧义
//   （绝不止首匹配硬吃）。
// 替换规则：只把 before 子串换为 after（`'` → `\'`）；after 自身含反斜杠 → skipped:needs-escape-review
//   且不动文件。无 `> 改后:` 行 → skipped:no-after；编号断档（如 TX-wuxia-38 空号）同样报 no-after。
// 幂等护栏：声称行 ±2 窗内找不到 before 时，先查该窗是否已含 after（转义形态）→ 是则
//   skipped:already-applied（良性，二次运行不复发）；全文回退被挡在此护栏之后，杜绝回退
//   吞掉窗口外另一副本 before（纯删减类 after 本就含于未施加的 before，故窗内见 before 仍照常施加）。
// `--exclude TX-a-b,TX-c-d` 的条目 → skipped:excluded。
// 每条 applied 即时增量落盘（可中断，不留半行）；清单写 .design-qa/apply-<id>.json
//   （--dry 时 .design-qa/apply-<id>.dry.json），条目 {tx,line,before,after,status}。
// 退出码：skipped 含 no-after/excluded/already-applied 以外的原因 → 非零；否则 0。
// 用法:
//   node scripts/narrative-apply.mjs <id> [--dry] [--exclude TX-<id>-n,...] [--md <path>] [--src <path>]
//   node scripts/narrative-apply.mjs --selftest
// --md/--src 为测试用路径覆盖（id 仍决定默认输出与 TX 前缀）；--selftest 在 .design-qa/apply-selftest/
// 建微型夹具跑通各类分类（行号漂移全文唯一/全文两次→歧义/after 含单引号→转义落盘/无改后行/二次运行幂等）并证伪。
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '..')
const AUDIT = path.join(ROOT, 'docs', 'superpowers', 'audit', 'text')
const QA = path.join(ROOT, '.design-qa')

const OK_SKIPS = new Set(['no-after', 'excluded', 'already-applied']) // 不致命的跳过原因

// ---------- 候选解析（与 narrative-verify 同约定） ----------
function parseCandidates(md) {
  const items = []
  for (const b of md.split(/^### /m).slice(1)) {
    const head = b.split('\n', 1)[0]
    const m = /^TX-[a-z]+-\d+/.exec(head)
    if (!m) continue
    const tx = m[0]
    const lines = b.split('\n')
    const srcLine = lines.find((l) => l.startsWith('- 源码:'))
    const lm = srcLine && /:(\d+)/.exec(srcLine)
    const claimed = lm ? Number(lm[1]) : null
    const bl = lines.find((l) => l.startsWith('> ') && !l.startsWith('> 改后:'))
    const before = bl ? bl.slice(2).replace(/↵\s*$/, '') : null
    const al = lines.find((l) => l.startsWith('> 改后:'))
    const after = al ? al.slice('> 改后:'.length).replace(/^ /, '').replace(/↵\s*$/, '') : null
    items.push({ tx, num: Number(/-(\d+)$/.exec(tx)[1]), claimed, before, after })
  }
  // 空号补报：编号 1..max 中断档（候选被自审撤下、编号留空不复用）→ 视作 no-after，按编号归位
  const present = new Set(items.map((i) => i.num))
  const out = []
  let expect = 1
  for (const it of items) {
    while (expect < it.num) {
      if (!present.has(expect)) out.push({ tx: `${txIdPrefix(it.tx)}-${String(expect).padStart(2, '0')}`, num: expect, claimed: null, before: null, after: null, gap: true })
      expect++
    }
    out.push(it)
    expect = it.num + 1
  }
  return out.sort((a, b) => a.num - b.num)
}
function txIdPrefix(tx) { const m = /^(TX-[a-z]+)-/.exec(tx); return m ? m[1] : tx }

// ---------- 定位：±2 行窗口 → 窗内 after 幂等护栏 → 全文回退 ----------
function locate(src, before, claimed, esc) {
  const lines = src.split('\n')
  const starts = []
  let off = 0
  for (const l of lines) { starts.push(off); off += l.length + 1 }
  let win = ''
  if (claimed != null) {
    const lo = Math.max(1, claimed - 2)
    const hi = Math.min(lines.length, claimed + 2)
    win = lines.slice(lo - 1, hi).join('\n')
    for (let L = lo; L <= hi; L++) {
      const col = lines[L - 1].indexOf(before)
      if (col >= 0) return { index: starts[L - 1] + col, line: L, via: 'window' }
    }
    // 幂等护栏：声称行 ±2 窗内已见 after 且 before 已不在窗内 → 视作此前已施加（二次运行）。
    // before 仍在窗内时不适用（纯删减类 after 是 before 子串，未施加的窗天然含 after）。
    // 全文回退必须先过此护栏，杜绝回退路径吞掉远处另一副本 before（Wave-1 TX-xian-51 事故）。
    if (esc && win.includes(esc)) return { miss: 'already-applied' }
  }
  let count = 0, first = -1
  for (let from = 0; ; ) {
    const i = src.indexOf(before, from)
    if (i < 0) break
    count++
    if (first < 0) first = i
    from = i + before.length
  }
  if (count === 0) return { miss: 'before缺失' }
  if (count > 1) return { miss: '歧义', count }
  let line = 1
  for (let L = starts.length; L >= 1; L--) if (first >= starts[L - 1]) { line = L; break }
  return { index: first, line, via: 'file' }
}

// ---------- 施加主流程 ----------
function runApply({ id, mdPath, srcPath, dry, exclude }) {
  const md = fs.readFileSync(mdPath, 'utf8')
  let src = fs.readFileSync(srcPath, 'utf8')
  const candidates = parseCandidates(md)
  const entries = []
  const skipped = []
  let applied = 0
  const notices = []

  const skip = (c, reason) => {
    skipped.push({ tx: c.tx, reason })
    entries.push({ tx: c.tx, line: c.claimed, before: c.before, after: c.after, status: `skipped:${reason}` })
  }

  for (const c of candidates) {
    if (exclude.has(c.tx)) { skip(c, 'excluded'); continue }
    if (c.after == null || c.after === '') { skip(c, 'no-after'); continue }
    if (!c.before) { skip(c, 'before缺失'); continue }
    const esc = c.after.replace(/'/g, "\\'")
    const loc = locate(src, c.before, c.claimed, esc)
    if (loc.miss) { skip(c, loc.miss); continue }
    if (loc.via === 'file') notices.push(`[漂移] ${c.tx} 声称行 ${c.claimed} → 实际行 ${loc.line}（全文唯一命中，已采用）`)
    if (c.after.includes('\\')) { skip(c, 'needs-escape-review'); continue }
    const next = src.slice(0, loc.index) + esc + src.slice(loc.index + c.before.length)
    if (!dry) fs.writeFileSync(srcPath, next, 'utf8') // 每条即时增量落盘
    src = next
    applied++
    entries.push({ tx: c.tx, line: loc.line, before: c.before, after: c.after, status: 'applied' })
  }

  const outPath = path.join(QA, `apply-${id}${dry ? '.dry' : ''}.json`)
  fs.mkdirSync(QA, { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(entries, null, 2) + '\n', 'utf8')

  for (const n of notices) console.log(n)
  const fatal = skipped.filter((s) => !OK_SKIPS.has(s.reason))
  const summary = { id, applied, skipped }
  console.log(JSON.stringify(summary))
  console.log(`清单: ${path.relative(ROOT, outPath)}`)
  return { exitCode: fatal.length ? 1 : 0, entries, summary }
}

// ---------- CLI ----------
function mainCli(argv) {
  let id = null
  let dry = false
  let mdPath = null
  let srcPath = null
  const exclude = new Set()
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry') dry = true
    else if (a === '--md') mdPath = argv[++i]
    else if (a === '--src') srcPath = argv[++i]
    else if (a === '--exclude') String(argv[++i] || '').split(/[,\s]+/).filter(Boolean).forEach((t) => exclude.add(t))
    else if (!a.startsWith('--') && !id) id = a
    else { console.error(`未知参数: ${a}`); process.exit(2) }
  }
  if (!id) { console.error('用法: node scripts/narrative-apply.mjs <id> [--dry] [--exclude TX-...] [--md <path>] [--src <path>]'); process.exit(2) }
  mdPath = mdPath ? path.resolve(ROOT, mdPath) : path.join(AUDIT, `${id}.md`)
  srcPath = srcPath ? path.resolve(ROOT, srcPath) : path.join(ROOT, 'src', 'scenarios', `${id}.ts`)
  if (!fs.existsSync(mdPath)) { console.error(`候选清单不存在: ${mdPath}`); process.exit(2) }
  if (!fs.existsSync(srcPath)) { console.error(`剧本源码不存在: ${srcPath}`); process.exit(2) }
  const r = runApply({ id, mdPath, srcPath, dry, exclude })
  process.exit(r.exitCode)
}

// ---------- 自检 ----------
const FIX_MD = [
  '# selftest 夹具',
  '',
  '### TX-selftest-01 行号漂移+全文唯一',
  '- 源码: selftest.ts:2',
  '> 旧日的誓',
  '> 改后: 昔日的誓',
  '',
  '### TX-selftest-02 全文两次出现→歧义',
  '- 源码: selftest.ts:20',
  '> 重复句',
  '> 改后: 不该落地',
  '',
  '### TX-selftest-03 after 含单引号→正确转义落盘',
  '- 源码: selftest.ts:3',
  '> 收势而定',
  "> 改后: 他道'且慢'",
  '',
  '### TX-selftest-04 无改后行→no-after',
  '- 源码: selftest.ts:6',
  '> 空号句',
  '',
].join('\n')
const FIX_SRC = [
  '// fixture scenario (narrative-apply selftest)',
  'export const fixture = {',
  "  line3: '收势而定',",
  "  dup1: '重复句',",
  "  dup2: '重复句',",
  "  drift: '旧日的誓',",
  "  gone: '空号句',",
  '}',
  '',
].join('\n')
// 夹具 5：before 全文双见（声称行 + 远处另一处），复现"二次运行全文回退吞掉另一副本"事故路径；
// 另带纯删减条目（after 是 before 的子串）——未施加时窗内天然已含 after，护栏不得误跳（TX-book-06 教训）
const FIX5_MD = [
  '# selftest 夹具 5',
  '',
  '### TX-selftest-05 重复 before 双锁锚定 + 二次运行幂等',
  '- 源码: selftest5.ts:3',
  '> 双生咒',
  '> 改后: 已改咒',
  '',
  '### TX-selftest-06 纯删减（after 含于 before）不得被护栏误跳',
  '- 源码: selftest5.ts:8',
  '> 长句前半，长句后半',
  '> 改后: 长句后半',
  '',
].join('\n')
const FIX5_SRC = [
  '// fixture dup (narrative-apply selftest case 5)',
  'export const fixture5 = {',
  "  locked: '双生咒',",
  "  gap1: '垫句一',",
  "  gap2: '垫句二',",
  "  gap3: '垫句三',",
  "  epilogue: '双生咒',",
  "  cut: '长句前半，长句后半',",
  '}',
  '',
].join('\n')

function statusOf(entries, tx) { const e = entries.find((x) => x.tx === tx); return e ? e.status : '(缺失)' }
function sha256(file) { return createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
function selftestCli(args) {
  const script = path.join(import.meta.dirname, 'narrative-apply.mjs')
  try {
    const out = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8', cwd: ROOT })
    return { code: 0, out }
  } catch (e) {
    return { code: e.status == null ? 1 : e.status, out: String(e.stdout || '') + String(e.stderr || '') }
  }
}
function selftest() {
  const dir = path.join(QA, 'apply-selftest')
  fs.mkdirSync(dir, { recursive: true })
  const mdPath = path.join(dir, 'selftest.md')
  const srcPath = path.join(dir, 'selftest.ts')
  const jsonPath = path.join(QA, 'apply-selftest.json')
  const fail = (msg) => { console.error('SELFTEST FAIL: ' + msg); process.exit(1) }
  const readEntries = () => JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

  fs.writeFileSync(mdPath, FIX_MD, 'utf8')
  fs.writeFileSync(srcPath, FIX_SRC, 'utf8')

  // run1: 四类分类全验（歧义致命 → 非零退出本身也是断言之一）
  const r1 = selftestCli(['selftest', '--md', mdPath, '--src', srcPath])
  const e1 = readEntries()
  if (statusOf(e1, 'TX-selftest-01') !== 'applied') fail(`TX-01 应为 applied（行号漂移全文唯一），实际 ${statusOf(e1, 'TX-selftest-01')}`)
  const l1 = e1.find((x) => x.tx === 'TX-selftest-01')
  if (l1.line !== 6) fail(`TX-01 漂移后行号应为 6，实际 ${l1.line}`)
  if (statusOf(e1, 'TX-selftest-02') !== 'skipped:歧义') fail(`TX-02 应为 skipped:歧义，实际 ${statusOf(e1, 'TX-selftest-02')}`)
  if (statusOf(e1, 'TX-selftest-03') !== 'applied') fail(`TX-03 应为 applied，实际 ${statusOf(e1, 'TX-selftest-03')}`)
  if (statusOf(e1, 'TX-selftest-04') !== 'skipped:no-after') fail(`TX-04 应为 skipped:no-after，实际 ${statusOf(e1, 'TX-selftest-04')}`)
  if (r1.code === 0) fail('run1 含歧义跳过，退出码应非零')
  const out1 = fs.readFileSync(srcPath, 'utf8')
  // 转义落盘逐字节：after 他道'且慢' → 源码 '他道\'且慢'
  if (!out1.includes(String.raw`line3: '他道\'且慢\'',`)) fail('TX-03 转义落盘内容不符（期望 line3: \'他道\\\'且慢\\\',）')
  if (!out1.includes("drift: '昔日的誓',")) fail('TX-01 漂移替换未落盘')
  if (!out1.includes("dup1: '重复句',") || !out1.includes("dup2: '重复句',")) fail('TX-02 歧义却动了文件')
  if (!out1.includes("gone: '空号句',")) fail('TX-04 no-after 却动了文件')

  // run2: 排除歧义条目后应干净退出 0（--exclude 生效）
  fs.writeFileSync(srcPath, FIX_SRC, 'utf8')
  const r2 = selftestCli(['selftest', '--md', mdPath, '--src', srcPath, '--exclude', 'TX-selftest-02'])
  const e2 = readEntries()
  if (r2.code !== 0) fail(`run2（--exclude 歧义）应退出 0，实际 ${r2.code}\n${r2.out}`)
  if (statusOf(e2, 'TX-selftest-02') !== 'skipped:excluded') fail(`TX-02 应为 skipped:excluded，实际 ${statusOf(e2, 'TX-selftest-02')}`)

  // run3（反证）: 故意喂错——把 TX-01 的 before 在源码里改掉 → before缺失 + 非零退出
  fs.writeFileSync(srcPath, FIX_SRC.replace('旧日的誓', '旧日的誉'), 'utf8')
  const r3 = selftestCli(['selftest', '--md', mdPath, '--src', srcPath])
  const e3 = readEntries()
  if (r3.code === 0) fail('run3（before 被改掉）应非零退出')
  if (statusOf(e3, 'TX-selftest-01') !== 'skipped:before缺失') fail(`TX-01 应为 skipped:before缺失，实际 ${statusOf(e3, 'TX-selftest-01')}`)

  // run5: 幂等护栏夹具——before 全文双见，首运行按声称行 ±2 锁定 applied；
  // 二次运行窗内已见 after → skipped:already-applied（良性 0），且文件逐字节不变。
  // （若无护栏：首运行后声称窗内 before 消失，全文回退只剩远处另一副本 count==1 → 被二次吞掉）
  const md5Path = path.join(dir, 'selftest5.md')
  const src5Path = path.join(dir, 'selftest5.ts')
  const json5Path = path.join(QA, 'apply-selftest5.json')
  const read5 = () => JSON.parse(fs.readFileSync(json5Path, 'utf8'))
  fs.writeFileSync(md5Path, FIX5_MD, 'utf8')
  fs.writeFileSync(src5Path, FIX5_SRC, 'utf8')
  const r5a = selftestCli(['selftest5', '--md', md5Path, '--src', src5Path])
  const e5a = read5()
  if (r5a.code !== 0) fail(`run5 首次施加应退出 0，实际 ${r5a.code}\n${r5a.out}`)
  const s5a = statusOf(e5a, 'TX-selftest-05')
  if (s5a !== 'applied') fail(`run5 首次应为 applied（行锁定），实际 ${s5a}`)
  const l5a = e5a.find((x) => x.tx === 'TX-selftest-05')
  if (l5a.line !== 3) fail(`run5 首次应锁定声称行 3，实际 ${l5a.line}`)
  const s6a = statusOf(e5a, 'TX-selftest-06')
  if (s6a !== 'applied') fail(`run5 纯删减条目首次应为 applied（after 含于 before 不得触发护栏），实际 ${s6a}`)
  const hash5a = sha256(src5Path)
  const r5b = selftestCli(['selftest5', '--md', md5Path, '--src', src5Path])
  const e5b = read5()
  const s5b = statusOf(e5b, 'TX-selftest-05')
  if (s5b !== 'skipped:already-applied') fail(`run5 二次应为 skipped:already-applied，实际 ${s5b}`)
  const s6b = statusOf(e5b, 'TX-selftest-06')
  if (s6b !== 'skipped:already-applied') fail(`run5 纯删减条目二次应为 skipped:already-applied，实际 ${s6b}`)
  if (r5b.code !== 0) fail(`run5 二次（already-applied 属良性）应退出 0，实际 ${r5b.code}\n${r5b.out}`)
  if (sha256(src5Path) !== hash5a) fail('run5 二次运行动了文件（幂等护栏失效）')

  console.log('SELFTEST PASS')
  console.log(`夹具: ${path.relative(ROOT, dir)}/`)
  process.exit(0)
}

const argv = process.argv.slice(2)
if (argv.includes('--selftest')) selftest()
else mainCli(argv.filter((a) => a !== '--selftest'))

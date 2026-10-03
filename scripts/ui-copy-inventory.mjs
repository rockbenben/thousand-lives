// scripts/ui-copy-inventory.mjs
// UI 文案提取器：扫 src/ui/*.tsx、src/App.tsx、src/ui/messages.ts，
// 在源文件原文上（不做任何严格解码/规范化预处理）收集所有含 CJK（汉字）的字面量候选。
// 产物：.design-qa/ui-copy.json（gitignored），条目 {file, line, quote, kind, text, comment?}。
//
// 原则（硬性）：
// - 宁可多收不误漏：注释里的中文、aria-label、console.log、正则内中文都算候选；
//   疑似注释行用 kind 'comment' / 字段 comment:true 标出，方便下游过滤。
// - kind 取值：'single' | 'double' | 'backtick'（字符串字面量）、'jsx-text'（JSX 文本子节点）、
//   'comment'（注释内中文）、'other'（以上未覆盖但行内含汉字的兜底行）。
// - 模板字符串：`${…}` 表达式段跳过其内容当作代码继续解析（嵌套引号照收），
//   字面片段（segment）逐段照收；多行模板按段落在各自起始行。
// - 逐行判重用 Set（历史踩坑：逐行 includes O(n^2) 且易漏）。
// - Windows：写文件显式 utf8。
// - stdout 只输出计数（本机 Bash 回显会丢含中文的行），内容一律看 json。

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.design-qa', 'ui-copy.json')
const HAN = /\p{Script=Han}/u

function collectFiles() {
  const files = []
  const uiDir = join(ROOT, 'src', 'ui')
  for (const name of readdirSync(uiDir).sort()) {
    if (name.endsWith('.tsx')) files.push(join(uiDir, name))
  }
  files.push(join(ROOT, 'src', 'App.tsx'))
  files.push(join(uiDir, 'messages.ts'))
  return files
}

const rel = (abs) => abs.slice(ROOT.length + 1).split('\\').join('/')

function makeLineIndexer(src) {
  const starts = [0]
  for (let k = 0; k < src.length; k++) if (src[k] === '\n') starts.push(k + 1)
  return function lineOf(pos) {
    let lo = 0, hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid] <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1 // 1-based
  }
}

// 状态机扫描：字符串字面量 + 注释（字面量/注释区间同时记录，供 jsx-text 过滤）。
function scanLiteralsAndComments(src, lineOf) {
  const entries = []
  const ranges = [] // [start,end) 已归属字面量/注释的源码区间
  const len = src.length
  // 栈帧：code / expr（`${}` 内部，按代码处理）/ template（模板字面段）
  const stack = [{ type: 'code' }]
  let i = 0

  const pushEntry = (line, kind, quote, text) => {
    entries.push({ line, quote, kind, text })
  }

  while (i < len) {
    const ch = src[i]
    const top = stack[stack.length - 1]

    if (top.type === 'template') {
      if (ch === '\\') { top.segStart ??= i; top.seg += ch + (src[i + 1] ?? ''); i += 2; continue }
      if (ch === '`') {
        if (top.segStart != null && HAN.test(top.seg)) pushEntry(lineOf(top.segStart), 'backtick', '`', top.seg)
        ranges.push([top.start, i + 1])
        stack.pop(); i++; continue
      }
      if (ch === '$' && src[i + 1] === '{') {
        if (top.segStart != null && HAN.test(top.seg)) pushEntry(lineOf(top.segStart), 'backtick', '`', top.seg)
        top.seg = ''; top.segStart = null
        stack.push({ type: 'expr', depth: 0 })
        i += 2; continue
      }
      if (top.segStart == null) top.segStart = i
      top.seg += ch; i++; continue
    }

    // code / expr 层的公共处理
    if (top.type === 'expr') {
      if (ch === '{') { top.depth++; i++; continue }
      if (ch === '}') {
        if (top.depth === 0) { stack.pop(); i++; continue }
        top.depth--; i++; continue
      }
    }

    if (ch === '/' && src[i + 1] === '/') {
      let j = src.indexOf('\n', i)
      if (j === -1) j = len
      const body = src.slice(i + 2, j)
      if (HAN.test(body)) pushEntry(lineOf(i), 'comment', null, body.trim())
      ranges.push([i, j])
      i = j; continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      let j = src.indexOf('*/', i + 2)
      const end = j === -1 ? len : j + 2
      // 多行块注释逐行收集（整块收一条会让后续行漏覆盖）
      let k = i + 2
      const stop = j === -1 ? len : j
      let curLineStart = k
      let curLineBegin = k
      while (k <= stop) {
        if (k === stop || src[k] === '\n') {
          const body = src.slice(curLineBegin, k).replace(/^\s*\*?\s?/, '').trim()
          if (HAN.test(body)) pushEntry(lineOf(curLineStart), 'comment', null, body)
          curLineStart = k + 1; curLineBegin = k + 1
        }
        k++
      }
      ranges.push([i, end])
      i = end; continue
    }
    if (ch === "'" || ch === '"') {
      const start = i
      let j = i + 1
      let closed = false
      let buf = ''
      while (j < len) {
        const c = src[j]
        if (c === '\\') { buf += c + (src[j + 1] ?? ''); j += 2; continue }
        if (c === '\n') break // 未闭合：不是字符串，退回逐字符继续
        if (c === ch) { closed = true; break }
        buf += c; j++
      }
      if (closed) {
        if (HAN.test(buf)) pushEntry(lineOf(start), ch === "'" ? 'single' : 'double', ch, buf)
        ranges.push([start, j + 1])
        i = j + 1; continue
      }
      i++; continue // 孤立引号：跳过该字符
    }
    if (ch === '`') {
      stack.push({ type: 'template', seg: '', segStart: null, start: i })
      i++; continue
    }
    i++
  }
  return { entries, ranges }
}

// JSX 文本子节点：`>…<` 之间、剔除 `{…}` 表达式后仍含汉字的内容（可跨行）。
// 完全落在字面量/注释区间内的匹配跳过。
function scanJsxText(src, lineOf, ranges) {
  const out = []
  const inRange = (pos) => ranges.some(([a, b]) => pos >= a && pos < b)
  const re = />([^<>]*)</g
  let m
  while ((m = re.exec(src)) !== null) {
    const segStart = m.index + 1
    if (inRange(segStart)) continue
    // 逐字符：维护花括号深度，depth 0 的连续片段才是 JSX 文本
    let depth = 0
    let buf = ''
    let bufIdx = -1
    const flush = () => {
      if (bufIdx !== -1 && HAN.test(buf)) out.push({ line: lineOf(bufIdx), quote: null, kind: 'jsx-text', text: buf.trim() })
      buf = ''; bufIdx = -1
    }
    for (let k = 0; k < m[1].length; k++) {
      const c = m[1][k]
      if (c === '{') { if (depth === 0) flush(); depth++; continue }
      if (c === '}') { if (depth > 0) depth--; if (depth === 0) { buf = ''; bufIdx = -1 } continue }
      if (depth === 0) {
        // bufIdx 锚定到首个非空白字符：跨行 JSX 文本条目应落在文本所在行
        if (bufIdx === -1 && !/\s/.test(c)) bufIdx = segStart + k
        if (bufIdx !== -1) buf += c
      }
    }
    flush()
  }
  return out
}

function main() {
  const all = []
  const perFile = []
  for (const abs of collectFiles()) {
    const src = readFileSync(abs, 'utf8')
    const lineOf = makeLineIndexer(src)
    const { entries, ranges } = scanLiteralsAndComments(src, lineOf)
    const jsx = scanJsxText(src, lineOf, ranges)
    const fileEntries = [...entries, ...jsx]
    // 兜底：宁可多收不误漏——凡含汉字却没有任何条目覆盖的行，整行收进来。
    const covered = new Set(fileEntries.map((e) => e.line))
    const srcLines = src.split('\n')
    for (let li = 0; li < srcLines.length; li++) {
      const lineNo = li + 1
      const raw = srcLines[li]
      if (!HAN.test(raw) || covered.has(lineNo)) continue
      const trimmed = raw.trim()
      const looksComment = /^(\/\/|\*|\/\*|\{\/\*)/.test(trimmed)
      fileEntries.push({ line: lineNo, quote: null, kind: looksComment ? 'comment' : 'other', text: trimmed })
    }
    // 逐行判重用 Set：file:line:kind:text 组合键去重
    const seen = new Set()
    const deduped = []
    for (const e of fileEntries.sort((a, b) => a.line - b.line)) {
      const key = `${rel(abs)}:${e.line}:${e.kind}:${e.text}`
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push({ file: rel(abs), ...e, ...(e.kind === 'comment' ? { comment: true } : {}) })
    }
    perFile.push({ file: rel(abs), hanLines: src.split('\n').filter((l) => HAN.test(l)).length, count: deduped.length })
    all.push(...deduped)
  }

  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(all, null, 2) + '\n', 'utf8')

  const byKind = {}
  for (const e of all) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1
  console.log(`ui-copy-inventory: ${all.length} entries -> ${rel(OUT)}`)
  for (const p of perFile) console.log(`  ${p.file}\than_lines=${p.hanLines}\tentries=${p.count}`)
  console.log('  by kind:', Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(' '))
}

main()

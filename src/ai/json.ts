export function extractJson(text: string): unknown {
  return extractJsonWithStart(text).value
}

// 返回 JSON 值及其在原文中的起始下标，便于把 JSON 之前的部分当正文使用
export function extractJsonWithStart(text: string): { value: unknown; start: number } {
  let start = text.indexOf('{')
  while (start >= 0) {
    const end = scanBalanced(text, start)
    if (end >= 0) {
      try {
        return { value: JSON.parse(text.slice(start, end + 1)), start }
      } catch {
        // 该起点的平衡片段不是合法 JSON（如起点位于 prose 中），尝试下一个 '{'
      }
    }
    start = text.indexOf('{', start + 1)
  }
  throw new Error('输出中没有完整的 JSON 对象')
}

// 从 start（必须是 '{'）起做字符串感知的花括号配对，返回最外层闭合 '}' 的下标，找不到返回 -1。
// 不预先剥离 markdown 围栏：围栏字符位于对象之外会被自然跳过，位于 JSON 字符串值之内则受 inStr 保护。
function scanBalanced(text: string, start: number): number {
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (esc) {
      esc = false
      continue
    }
    if (inStr) {
      if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

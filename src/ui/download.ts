// 触发浏览器下载一段文本为文件
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// 文件名安全化：去掉路径/非法字符
export function safeFilename(s: string): string {
  return (s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'save').slice(0, 40)
}

// 触发浏览器下载一个 Blob 为文件（创建临时对象 URL + 锚点点击 + 回收）
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// 触发浏览器下载一段文本为文件
export function downloadText(filename: string, text: string): void {
  downloadBlob(new Blob([text], { type: 'application/json' }), filename)
}

// 文件名安全化：去掉路径/非法字符
export function safeFilename(s: string): string {
  return (s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'save').slice(0, 40)
}

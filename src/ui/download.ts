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

// execCommand 兜底复制：非 HTTPS / 旧浏览器 / 异步剪贴板被拒时用临时 textarea + execCommand。
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

// 健壮文本复制：优先异步 Clipboard API，失败回退 execCommand。返回是否成功。
// ★务必在用户手势「同步起点」调用（任何 await 之后用户激活会过期，writeText 会被浏览器拒绝而静默失败）。
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到 execCommand 兜底
  }
  return legacyCopy(text)
}

// 把图片 Blob 写入剪贴板（ClipboardItem），让玩家直接粘进微信/聊天框发出去。
// 桌面 Chrome/Edge/Safari 支持；不支持(部分 Firefox)或被拒时返回 false，由调用方退回下载。
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    const w = navigator.clipboard as Clipboard & {
      write?: (items: ClipboardItem[]) => Promise<void>
    }
    if (typeof ClipboardItem === 'undefined' || !w?.write) return false
    await w.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
    return true
  } catch {
    return false
  }
}

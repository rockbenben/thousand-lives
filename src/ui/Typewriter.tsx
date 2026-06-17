import { useEffect, useState } from 'react'

export function Typewriter({
  text,
  speed = 18,
  onType,
}: {
  text: string
  speed?: number
  onType?: () => void
}) {
  const [len, setLen] = useState(0)

  useEffect(() => setLen(0), [text])

  useEffect(() => {
    if (len >= text.length) return
    const t = setTimeout(() => setLen((l) => Math.min(l + 2, text.length)), speed)
    return () => clearTimeout(t)
  }, [len, text, speed])

  // 每次显现更多字时通知父组件（用于跟随滚动到底部）
  useEffect(() => {
    onType?.()
  }, [len, onType])

  return (
    <p className="narrative typewriter" onClick={() => setLen(text.length)} title="点击跳过">
      {text.slice(0, len)}
      {len < text.length && <span className="caret">▌</span>}
    </p>
  )
}

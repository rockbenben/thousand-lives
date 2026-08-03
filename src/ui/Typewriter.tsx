import { useEffect, useState } from 'react'

export function Typewriter({
  text,
  speed = 18,
  onType,
  onDone,
}: {
  text: string
  speed?: number
  onType?: () => void
  onDone?: () => void
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

  // 正文落定后通知父组件（用于「选项在正文写完后再淡入」的呼吸节奏）
  useEffect(() => {
    if (text.length > 0 && len >= text.length) onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [len, text])

  // 写完之后这段就是普通正文：撤掉「点击跳过」的提示与手型，否则悬停总在承诺一个已经无事可做的点击
  const typing = len < text.length
  return (
    <p
      className={`narrative ${typing ? 'typewriter' : ''}`}
      onClick={typing ? () => setLen(text.length) : undefined}
      title={typing ? '点击跳过' : undefined}
    >
      {text.slice(0, len)}
      {typing && <span className="caret">▌</span>}
    </p>
  )
}

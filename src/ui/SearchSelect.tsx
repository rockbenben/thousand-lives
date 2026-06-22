import { useEffect, useRef, useState } from 'react'

export interface SearchOption {
  value: string
  label?: string
  hint?: string
}

// 无依赖的可搜索下拉：
// - allowCustom=false（选择模式）：输入只用于过滤，必须从列表中选中才改值，失焦还原显示
// - allowCustom=true（自动完成模式）：输入即值，列表仅做建议
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  allowCustom = false,
}: {
  options: SearchOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  allowCustom?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)
  const display = query ?? (allowCustom ? value : (selected?.label ?? value))
  const q = (query ?? '').trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => `${o.label ?? ''} ${o.value} ${o.hint ?? ''}`.toLowerCase().includes(q))
    : options

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  const pick = (v: string) => {
    onChange(v)
    setQuery(null)
    setOpen(false)
  }

  return (
    <div className="combo" ref={rootRef}>
      <input
        value={display}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (allowCustom) onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            // 仅在有搜索词时回车选中首个匹配；无输入时回车不应把已选值悄悄改成第一项
            if (!allowCustom && q && filtered.length > 0) pick(filtered[0].value)
            else {
              setOpen(false)
              setQuery(null)
            }
          } else if (e.key === 'Escape') {
            // 下拉展开时先收起自身，并吞掉 Esc，避免连带关闭外层弹窗（useModalA11y 会跳过 defaultPrevented）
            if (open) e.preventDefault()
            setOpen(false)
            setQuery(null)
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combo-list" role="listbox">
          {filtered.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`combo-item ${o.value === value ? 'selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o.value)
              }}
            >
              <span>{o.label ?? o.value}</span>
              {o.hint && <span className="combo-hint">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

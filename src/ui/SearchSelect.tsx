import { Fragment, useEffect, useId, useRef, useState } from 'react'

export interface SearchOption {
  value: string
  label?: string
  hint?: string
  /**
   * 分组名。调用方要保证同组的选项【连续】—— 组标题是在遍历中「组名一变就插一行」
   * 生成的，不是先分桶再渲染。这样过滤后不会留下没有条目的空标题。
   */
  group?: string
}

// 无依赖的可搜索下拉：
// - allowCustom=false（选择模式）：输入只用于过滤，必须从列表中选中才改值，失焦还原显示
// - allowCustom=true（自动完成模式）：输入即值，列表仅做建议
//
// 键盘与「打开时停在哪」对齐成熟组件库的行为，因为不这么做的代价是实打实的：
// 列表有 260px 的高度上限、服务商有二十多个，而它永远从第一项开始渲染 ——
// 选着靠后的一家（比如 TokenHub）再打开，看到的是列表顶部，每次都要滚一遍才知道
// 自己在哪。方向键同理：以前压根没有，回车只能选中第一个匹配。
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  allowCustom = false,
}: {
  options: readonly SearchOption[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
  allowCustom?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState<string | null>(null)
  // 当前高亮项在 filtered 里的下标；-1 = 没有高亮（自动完成模式下打字时的常态）
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const listId = useId()

  const selected = options.find((o) => o.value === value)
  const display = query ?? (allowCustom ? value : (selected?.label ?? value))
  const q = (query ?? '').trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => `${o.label ?? ''} ${o.value} ${o.hint ?? ''}`.toLowerCase().includes(q))
    : options

  /**
   * 打开时该停在哪。
   *
   * 选择模式：停在【已选中的那一项】—— 打开下拉是为了「看看还有什么」，起点当然
   * 是当前所在的位置。没选中过才落到第一项。
   * 自动完成模式：值在列表里就停在它，否则【不高亮】（-1）—— 那里输入框里的文字
   * 就是值，凭空高亮一项会让回车把用户手打的型号名换掉。
   */
  const openList = () => {
    const i = filtered.findIndex((o) => o.value === value)
    setActive(i >= 0 ? i : allowCustom ? -1 : 0)
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    setQuery(null)
    setActive(-1)
  }

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  // 高亮项滚进可视区。block:'nearest' 只在它真的看不见时才滚，鼠标在列表里
  // 上下移动时不会把列表拽来拽去。
  useEffect(() => {
    if (!open || active < 0) return
    itemRefs.current.get(filtered[active]?.value ?? '')?.scrollIntoView({ block: 'nearest' })
  }, [open, active, filtered])

  const pick = (v: string) => {
    onChange(v)
    setQuery(null)
    setOpen(false)
    setActive(-1)
  }

  const move = (delta: number) => {
    if (!filtered.length) return
    if (!open) return openList()
    // 环形：到底再按一次回到顶部 —— 长列表里比撞死在末尾更省事
    setActive((cur) => (cur < 0 ? (delta > 0 ? 0 : filtered.length - 1) : (cur + delta + filtered.length) % filtered.length))
  }

  return (
    <div className="combo" ref={rootRef}>
      <input
        value={display}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onFocus={openList}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          // 打字后高亮首个匹配（选择模式），自动完成模式不抢：那里输入即值，
          // 高亮一项会让回车把手打的内容替换掉。要选建议就按方向键。
          setActive(allowCustom ? -1 : 0)
          if (allowCustom) onChange(e.target.value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            move(1)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            move(-1)
          } else if (e.key === 'Enter') {
            e.preventDefault()
            // 有高亮就选它；没有则收起（自动完成模式下＝确认自己打的内容）
            if (open && active >= 0 && filtered[active]) pick(filtered[active].value)
            else close()
          } else if (e.key === 'Escape') {
            // 下拉展开时先收起自身，并吞掉 Esc，避免连带关闭外层弹窗（useModalA11y 会跳过 defaultPrevented）
            if (open) e.preventDefault()
            close()
          }
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combo-list" role="listbox" id={listId}>
          {filtered.map((o, i) => (
            <Fragment key={o.value}>
              {o.group && o.group !== filtered[i - 1]?.group && (
                <li className="combo-group" role="presentation">
                  {o.group}
                </li>
              )}
              <li
                role="option"
                id={`${listId}-${i}`}
                ref={(el) => {
                  if (el) itemRefs.current.set(o.value, el)
                  else itemRefs.current.delete(o.value)
                }}
                aria-selected={o.value === value}
                className={`combo-item ${o.value === value ? 'selected' : ''} ${i === active ? 'active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(o.value)
                }}
              >
                <span>{o.label ?? o.value}</span>
                {o.hint && <span className="combo-hint">{o.hint}</span>}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'

// 当前打开的弹窗栈：只有最上层弹窗响应 Esc / Tab，避免一次 Esc 连关叠放的多层弹窗
// （如「命途留影」上再开「看全图」灯箱）。
const modalStack: symbol[] = []

// 弹窗通用可访问性：Esc 关闭 + 焦点陷阱（Tab 循环锁在弹窗内）+ 打开时移入焦点、关闭时还原焦点。
// 返回挂到弹窗容器的 ref；调用方自行标注 role="dialog" aria-modal 与 tabIndex={-1}（容器无可聚焦子元素时的兜底落点）。
// onClose / closeOnEsc 通过 ref 读取最新值，effect 只在挂载时运行一次，避免 busy 等状态变化时反复抢焦点。
// 监听用冒泡阶段并尊重 e.defaultPrevented：内部控件（如 SearchSelect 下拉）可先 preventDefault 吞掉 Esc，
// 收起自身而不连带关闭外层弹窗。
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  closeOnEsc = true,
) {
  const ref = useRef<T>(null)
  const onCloseRef = useRef(onClose)
  const escRef = useRef(closeOnEsc)
  onCloseRef.current = onClose
  escRef.current = closeOnEsc

  useEffect(() => {
    const token = Symbol('modal')
    modalStack.push(token)
    const isTop = () => modalStack[modalStack.length - 1] === token

    const prevFocus = document.activeElement as HTMLElement | null
    const el = ref.current
    // getClientRects 判可见，对 position:fixed 容器也成立（offsetParent 会返回 null）
    const focusables = () =>
      el
        ? Array.from(
            el.querySelectorAll<HTMLElement>(
              'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((n) => n.getClientRects().length > 0)
        : []

    ;(focusables()[0] ?? el)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return
      if (e.key === 'Escape') {
        // 已被内部控件处理（如下拉收起）则不再关闭外层弹窗
        if (e.defaultPrevented || !escRef.current) return
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) {
          e.preventDefault()
          return
        }
        const idx = items.indexOf(document.activeElement as HTMLElement)
        if (e.shiftKey && idx <= 0) {
          e.preventDefault()
          items[items.length - 1].focus()
        } else if (!e.shiftKey && idx === items.length - 1) {
          e.preventDefault()
          items[0].focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = modalStack.indexOf(token)
      if (i >= 0) modalStack.splice(i, 1)
      prevFocus?.focus?.()
    }
  }, [])

  return ref
}

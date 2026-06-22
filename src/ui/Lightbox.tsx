import { useModalA11y } from './useModalA11y'

// 全屏灯箱：完整清晰地看一张图，轻触任意处 / Esc 关闭。
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const ref = useModalA11y(onClose)
  return (
    <div
      className="lightbox"
      onClick={onClose}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="查看配图大图"
      tabIndex={-1}
    >
      <img className="lightbox-img" src={src} alt="" />
      <span className="lightbox-hint" aria-hidden="true">轻触关闭</span>
    </div>
  )
}

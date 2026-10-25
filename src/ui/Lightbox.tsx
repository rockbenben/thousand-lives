import { useModalA11y } from './useModalA11y'
import { msg } from './messages'

// 全屏灯箱：完整清晰地看一张图，轻触任意处 / Esc 关闭。
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const ref = useModalA11y(onClose)
  // 不放大到超过原图像素：结局图 2528×1696、成就徽章 1024×1024，
  // 铺满 94vw 就是一到七倍的插值放大——点开想看清，结果更糊。
  // 封顶到自然尺寸，超过视口的仍按视口收。
  const capToNative = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    if (img.naturalWidth) img.style.maxWidth = `min(94vw, ${img.naturalWidth}px)`
  }
  return (
    <div
      className="lightbox"
      onClick={onClose}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={msg.viewLargeImage}
      tabIndex={-1}
    >
      <img className="lightbox-img" src={src} alt="" onLoad={capToNative} />
      <span className="lightbox-hint" aria-hidden="true">轻触关闭</span>
    </div>
  )
}

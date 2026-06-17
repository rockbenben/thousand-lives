// 全屏灯箱：完整清晰地看一张图，轻触任意处关闭。
export function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="lightbox" onClick={onClose}>
      <img className="lightbox-img" src={src} alt="" />
      <span className="lightbox-hint" aria-hidden="true">轻触关闭</span>
    </div>
  )
}

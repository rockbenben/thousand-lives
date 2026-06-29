import { useModalA11y } from './useModalA11y'
import { msg } from './messages'

// 命运抉择独立大卡：走到关键节点时弹出，完整清晰呈现节点配图 + 命运抉择标题，
// 轻触图可看全图，点「继续」收起进入抉择。
export function StoryCard({
  art,
  label,
  onViewArt,
  onContinue,
}: {
  art?: string
  label: string
  onViewArt: () => void
  onContinue: () => void
}) {
  // 与 Memoir/Lightbox 同为弹层：Esc 关闭（即「继续」）、焦点陷阱、关闭后还原焦点
  const ref = useModalA11y(onContinue)
  return (
    <div className="storycard-overlay" onClick={onContinue}>
      <div
        className="storycard"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="命运抉择"
        tabIndex={-1}
      >
        {art && (
          <button
            className="storycard-art"
            style={{ backgroundImage: `url(${art})` }}
            onClick={onViewArt}
            title={msg.clickToEnlarge}
            aria-label={msg.viewLargeImage}
          >
            <span className="storycard-zoom" aria-hidden="true">⤢</span>
          </button>
        )}
        <div className="storycard-face">
          <span className="storycard-label">{label}</span>
          <button className="primary storycard-go" onClick={onContinue}>
            继续 →
          </button>
        </div>
      </div>
    </div>
  )
}

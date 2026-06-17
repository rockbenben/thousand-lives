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
  return (
    <div className="storycard-overlay" onClick={onContinue}>
      <div className="storycard" onClick={(e) => e.stopPropagation()}>
        {art && (
          <button
            className="storycard-art"
            style={{ backgroundImage: `url(${art})` }}
            onClick={onViewArt}
            title="点击看全图"
            aria-label="查看大图"
          >
            <span className="storycard-zoom" aria-hidden="true">⤢</span>
          </button>
        )}
        <div className="storycard-face">
          <span className="storycard-label">{label}</span>
          <button className="primary storycard-go" onClick={onContinue}>
            临此一抉 →
          </button>
        </div>
      </div>
    </div>
  )
}

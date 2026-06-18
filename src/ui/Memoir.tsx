import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'
import { keyMomentIndex } from '../engine/keymoment'
import { nodeImage } from './nodeArt'

// 命途留影：把本局走过的「命运抉择」节点汇成可回溯的剧情卡相册（由 history 推导）。
export function Memoir({
  scenario,
  state,
  onClose,
  onViewArt,
}: {
  scenario: Scenario
  state: GameState
  onClose: () => void
  onViewArt?: (src: string) => void
}) {
  const cards = state.history
    .map((t, i) => ({ t, turnNo: i + 1, ki: keyMomentIndex(i + 1, scenario.maxTurns) }))
    .filter((x) => x.ki >= 0)

  return (
    <div className="memoir-overlay" onClick={onClose}>
      <div className="memoir" onClick={(e) => e.stopPropagation()}>
        <div className="memoir-head">
          <span className="memoir-title">命途留影</span>
          <span className="memoir-count">{cards.length} 帧</span>
          <button className="ghost memoir-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {cards.length === 0 ? (
          <p className="memoir-empty">尚未行至命运抉择，留影待续……</p>
        ) : (
          <div className="memoir-grid">
            {cards.map(({ t, turnNo }) => {
              const cardArt = nodeImage(scenario.id, t.summary)
              return (
              <div className="memoir-card" key={turnNo}>
                {cardArt && (
                  <div
                    className="memoir-card-art"
                    style={{ backgroundImage: `url(${cardArt})` }}
                    onClick={() => onViewArt?.(cardArt)}
                    title={onViewArt ? '点击看全图' : undefined}
                  />
                )}
                <div className="memoir-card-body">
                  <span className="memoir-card-no">
                    ☰ 第 {turnNo} {scenario.turnUnit}{t.summary ? ` · ${t.summary}` : ''}
                  </span>
                  <p className="memoir-card-narr">{t.narrative}</p>
                  <p className="memoir-card-pick">▸ {t.choiceText}</p>
                  {t.reaction && <p className="memoir-card-react">{t.reaction}</p>}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

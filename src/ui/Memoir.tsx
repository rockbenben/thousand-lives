import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'
import { isKeyMoment } from '../engine/keymoment'
import { nodeImage } from './nodeArt'
import { useModalA11y } from './useModalA11y'
import { msg } from './messages'

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
  // 回顾这一生走过的每一步：全程回合皆成卡（场景配图 + 正文 + 你的抉择 + 他人回响），关键节点高亮。
  // VN 去掉了竖向历史，这里是唯一能通览全程的地方，故收录全部回合而非仅关键节点。
  const cards = state.history.map((t, i) => ({
    t,
    turnNo: i + 1,
    key: isKeyMoment(i + 1, scenario.maxTurns),
  }))

  const ref = useModalA11y(onClose)

  return (
    <div className="memoir-overlay" onClick={onClose}>
      <div
        className="memoir"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="命途留影"
        tabIndex={-1}
      >
        <div className="memoir-head">
          <span className="memoir-title">命途留影</span>
          <span className="memoir-count">{cards.length} 帧</span>
          <button className="ghost memoir-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {cards.length === 0 ? (
          <p className="memoir-empty">这一生尚未落笔，留影待续……</p>
        ) : (
          <div className="memoir-grid">
            {cards.map(({ t, turnNo, key }) => {
              const cardArt = nodeImage(scenario.id, t.summary)
              return (
              <div className={`memoir-card ${key ? 'key' : ''}`} key={turnNo}>
                {cardArt && (
                  <div
                    className="memoir-card-art"
                    style={{ backgroundImage: `url(${cardArt})` }}
                    onClick={() => onViewArt?.(cardArt)}
                    title={onViewArt ? msg.clickToEnlarge : undefined}
                  />
                )}
                <div className="memoir-card-body">
                  {key && <span className="memoir-card-key">✦ 命运抉择</span>}
                  <span className="memoir-card-no">
                    第 {turnNo} {scenario.turnUnit}{t.summary ? ` · ${t.summary}` : ''}
                  </span>
                  <p className="memoir-card-narr">{t.narrative}</p>
                  <p className="memoir-card-pick">▸ {t.choiceText}</p>
                  {t.reaction && <p className="memoir-card-react">{t.reaction}</p>}
                  {t.twist && <p className="memoir-card-twist">{t.twist}</p>}
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

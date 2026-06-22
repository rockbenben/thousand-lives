import { useRef, useState } from 'react'
import { builtinScenarios } from '../scenarios'
import {
  listSlots,
  deleteSlot,
  parseSaveFile,
  exportSaveString,
  seenEndings,
  loadStats,
  type SaveGame,
  type SaveSlot,
} from '../storage'
import {
  computeAchievements,
  ACH_GROUP_LABELS,
  ACH_GROUP_ORDER,
  type Achievement,
} from '../engine/achievements'
import { achievementConfig } from '../scenarios/achievementConfig'
import { reachableEndingTones } from '../engine/state'
import { hasEndingArt } from './endingArt'
import { downloadText, safeFilename } from './download'
import { endingImage } from './endingArt'
import { achievementImage } from './achievementArt'
import { Lightbox } from './Lightbox'
import { useModalA11y } from './useModalA11y'

interface EndingDetail {
  scId: string
  title: string
  emoji: string
  tone: string
  turnUnit: string
  epilogue?: string
}


type Tab = 'saves' | 'achievements' | 'gallery'

export function Archive({
  onBack,
  onLoadGame,
}: {
  onBack: () => void
  onLoadGame: (g: SaveGame) => void
}) {
  const [tab, setTab] = useState<Tab>('saves')
  const [slots, setSlots] = useState<SaveSlot[]>(listSlots)
  const [saveError, setSaveError] = useState('')
  const [detail, setDetail] = useState<EndingDetail | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [badge, setBadge] = useState<{ img: string; name: string; desc: string } | null>(null)
  const saveFileRef = useRef<HTMLInputElement>(null)

  const onImportSave = async (file: File) => {
    try {
      const game = parseSaveFile(await file.text())
      setSaveError('')
      onLoadGame(game)
    } catch (e) {
      setSaveError(`存档导入失败：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const exportSlot = (slot: SaveSlot) =>
    downloadText(
      `千世书-${safeFilename(slot.game.scenario.title)}-${safeFilename(slot.name)}.json`,
      exportSaveString(slot.game),
    )
  const removeSlot = (id: string) => {
    deleteSlot(id)
    setSlots(listSlots())
  }

  const achievements = computeAchievements({
    scenarios: builtinScenarios.map((sc) => ({
      id: sc.id,
      seen: new Set(seenEndings(sc.id)).size,
      total: reachableEndingTones(sc).length,
    })),
    stats: loadStats(),
    seenTones: Object.fromEntries(builtinScenarios.map((sc) => [sc.id, seenEndings(sc.id)])),
    achConfig: achievementConfig,
  })
  const unlocked = achievements.filter((a) => a.done).length
  const galleryDone = builtinScenarios.reduce(
    (s, sc) => s + new Set(seenEndings(sc.id)).size,
    0,
  )
  const galleryTotal = builtinScenarios.reduce((s, sc) => s + reachableEndingTones(sc).length, 0)

  // 单枚勋章：已得→鎏金徽章（可放大）；未得有图→朱砂封印下的剪影；进度类附鎏金进度条
  const renderAch = (a: Achievement) => {
    const img = achievementImage(a.id)
    const pct = a.progress && a.progress.total > 0 ? Math.round((a.progress.cur / a.progress.total) * 100) : 0
    const inner = (
      <>
        {img ? (
          <span
            className={`ach-img${a.done ? '' : ' sealed'}`}
            style={{ backgroundImage: `url(${img})` }}
            aria-hidden="true"
          />
        ) : (
          <span className="ach-icon">{a.done ? a.icon : '🔒'}</span>
        )}
        <span className="ach-text">
          <span className="ach-name">{a.name}</span>
          <span className="ach-desc">{a.desc}</span>
          {!a.done && a.progress && a.progress.cur > 0 && a.progress.total > 1 && (
            <span className="ach-prog">
              <span className="ach-bar" aria-hidden="true">
                <span className="ach-bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="ach-bar-num">{a.progress.cur}/{a.progress.total}</span>
            </span>
          )}
        </span>
      </>
    )
    return a.done && img ? (
      <button
        key={a.id}
        className="ach done ach-clickable"
        onClick={() => setBadge({ img, name: a.name, desc: a.desc })}
        title="点击放大徽章"
        aria-label={`查看徽章「${a.name}」`}
      >
        {inner}
      </button>
    ) : (
      <div key={a.id} className={`ach ${a.done ? 'done' : 'locked'}`} title={a.desc}>
        {inner}
      </div>
    )
  }

  return (
    <div className="archive">
      <button className="ghost archive-back" onClick={onBack}>
        ← 返回卷首
      </button>
      <h2 className="archive-title">命书阁</h2>
      <p className="archive-sub">存档 · 成就 · 结局图鉴</p>

      <div className="archive-tabs">
        <button className={tab === 'saves' ? 'active' : ''} onClick={() => setTab('saves')}>
          存档<span className="tab-num">{slots.length}</span>
        </button>
        <button
          className={tab === 'achievements' ? 'active' : ''}
          onClick={() => setTab('achievements')}
        >
          成就<span className="tab-num">{unlocked}/{achievements.length}</span>
        </button>
        <button className={tab === 'gallery' ? 'active' : ''} onClick={() => setTab('gallery')}>
          结局图鉴<span className="tab-num">{galleryDone}/{galleryTotal}</span>
        </button>
      </div>

      {tab === 'saves' && (
        <section className="saves">
          <div className="saves-head">
            <span className="saves-title">命途存档</span>
            <button className="ghost" onClick={() => saveFileRef.current?.click()}>
              导入存档文件
            </button>
          </div>
          {saveError && <p className="error">{saveError}</p>}
          {slots.length === 0 ? (
            <p className="saves-empty">还没有任何存档。游戏中点「存档」可保存进度，或导入存档文件。</p>
          ) : (
            <ul className="slot-list">
              {slots.map((slot) => (
                <li key={slot.id} className="slot">
                  <button className="slot-load" onClick={() => onLoadGame(slot.game)}>
                    <span className="slot-name">{slot.name}</span>
                    <span className="slot-meta">
                      {slot.game.scenario.emoji} {slot.game.scenario.title} · 第{' '}
                      {slot.game.state.history.length + (slot.game.state.ended ? 0 : 1)}{' '}
                      {slot.game.scenario.turnUnit}
                      {slot.game.state.ended ? '（已结束）' : ''} ·{' '}
                      {new Date(slot.savedAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </button>
                  <button className="ghost slot-act" onClick={() => exportSlot(slot)}>
                    导出
                  </button>
                  <button
                    className="ghost slot-act"
                    onClick={() => {
                      if (window.confirm(`删除存档「${slot.name}」？`)) removeSlot(slot.id)
                    }}
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'achievements' && (
        <section className="achievements">
          {ACH_GROUP_ORDER.map((g) => {
            const items = achievements.filter((a) => a.group === g)
            if (!items.length) return null
            const got = items.filter((a) => a.done).length
            return (
              <div key={g} className={`ach-group ach-group-${g}`}>
                <div className="ach-group-head">
                  <span className="ach-group-label">{ACH_GROUP_LABELS[g]}</span>
                  <span className="ach-group-rule" aria-hidden="true" />
                  <span className="ach-group-count">
                    {got}<i>/{items.length}</i>
                  </span>
                </div>
                <div className={`ach-grid${g === 'legend' ? ' ach-grid-legend' : ''}`}>
                  {items.map(renderAch)}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {tab === 'gallery' && (
        <section className="gallery">
          {builtinScenarios.map((sc) => {
            const tones = reachableEndingTones(sc)
            const seen = new Set(seenEndings(sc.id))
            const got = tones.filter((t) => seen.has(t)).length
            const pct = tones.length ? Math.round((got / tones.length) * 100) : 0
            const complete = got >= tones.length && tones.length > 0
            return (
              <div key={sc.id} className={`gal-scene${complete ? ' complete' : ''}`}>
                <div className="gal-scene-head">
                  <span className="gal-scene-name">
                    <b className="gal-scene-emoji">{sc.emoji}</b>
                    {sc.title}
                  </span>
                  <span className="gal-bar" aria-hidden="true">
                    {pct > 0 && <span className="gal-bar-fill" style={{ width: `${pct}%` }} />}
                  </span>
                  <span className="gal-scene-count">
                    {complete && <span className="gal-seal-done" aria-hidden="true">圆满</span>}
                    {got}<i>/{tones.length}</i>
                  </span>
                </div>
                <div className="gal-grid">
                  {tones.map((t, i) => {
                    if (!seen.has(t)) {
                      return (
                        <div key={i} className="gal-tile locked" aria-label="尚未解锁的结局">
                          <span className="gal-tile-seal-mark" aria-hidden="true">封</span>
                        </div>
                      )
                    }
                    const art = endingImage(sc.id, t)
                    const own = hasEndingArt(sc.id, t)
                    return (
                      <button
                        key={i}
                        className={`gal-tile seen${own ? '' : ' nocover'}`}
                        style={art ? { backgroundImage: `url(${art})` } : undefined}
                        onClick={() =>
                          setDetail({
                            scId: sc.id,
                            title: sc.title,
                            emoji: sc.emoji,
                            tone: t,
                            turnUnit: sc.turnUnit,
                            epilogue: sc.endings.find((e) => e.tone === t)?.epilogue,
                          })
                        }
                        title={t}
                      >
                        <span className="gal-tile-veil" aria-hidden="true" />
                        <span className="gal-tile-tone">{t}</span>
                        <span className="gal-tile-seal" aria-hidden="true">終</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </section>
      )}

      {detail && (
        <EndingDetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onViewArt={setLightbox}
        />
      )}
      {badge && <BadgeModal badge={badge} onClose={() => setBadge(null)} />}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      <input
        ref={saveFileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImportSave(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

// 结局详情弹层：与 Memoir/Lightbox 一致地接入 useModalA11y（Esc 关闭 + 焦点陷阱 + 还原焦点）。
// 拆成独立组件而非内联，是因为弹层条件渲染，钩子不能放在条件分支里调用。
function EndingDetailModal({
  detail,
  onClose,
  onViewArt,
}: {
  detail: EndingDetail
  onClose: () => void
  onViewArt: (src: string) => void
}) {
  const ref = useModalA11y(onClose)
  const art = endingImage(detail.scId, detail.tone)
  return (
    <div className="ending-detail-overlay" onClick={onClose}>
      <div
        className="ending-detail"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`结局 · ${detail.tone}`}
        tabIndex={-1}
      >
        <button className="ghost ed-close" onClick={onClose}>✕</button>
        {art ? (
          <button
            className="ed-art"
            style={{ backgroundImage: `url(${art})` }}
            onClick={() => onViewArt(art)}
            title="点击看全图"
            aria-label="查看大图"
          >
            <span className="storycard-zoom" aria-hidden="true">⤢</span>
          </button>
        ) : null}
        <div className="ed-body">
          <span className="ed-scene">{detail.emoji} {detail.title}</span>
          <h3 className="ed-tone">{detail.tone}</h3>
          {detail.epilogue ? (
            <p className="ed-epilogue">{detail.epilogue}</p>
          ) : (
            <p className="ed-epilogue muted">此结局的尾声唯有亲历方知，再走一遭吧。</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 徽章放大弹层：原本只能点背景关闭、无任何键盘退出路径；接入 useModalA11y 后 Esc 可关闭、焦点不外逃。
function BadgeModal({
  badge,
  onClose,
}: {
  badge: { img: string; name: string; desc: string }
  onClose: () => void
}) {
  const ref = useModalA11y(onClose)
  return (
    <div className="badge-overlay" onClick={onClose}>
      <div
        className="badge-show"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`徽章 · ${badge.name}`}
        tabIndex={-1}
      >
        <span
          className="badge-show-img"
          style={{ backgroundImage: `url(${badge.img})` }}
          aria-hidden="true"
        />
        <h3 className="badge-show-name">{badge.name}</h3>
        <p className="badge-show-desc">{badge.desc}</p>
      </div>
    </div>
  )
}

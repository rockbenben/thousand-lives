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
import { computeAchievements } from '../engine/achievements'
import { reachableEndingTones } from '../engine/state'
import { downloadText, safeFilename } from './download'
import { endingImage } from './endingArt'
import { achievementImage } from './achievementArt'
import { Lightbox } from './Lightbox'

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
  })
  const unlocked = achievements.filter((a) => a.done).length
  const galleryDone = builtinScenarios.reduce(
    (s, sc) => s + new Set(seenEndings(sc.id)).size,
    0,
  )
  const galleryTotal = builtinScenarios.reduce((s, sc) => s + reachableEndingTones(sc).length, 0)

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
                      {slot.game.state.history.length + 1} {slot.game.scenario.turnUnit}
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
          <div className="ach-grid">
            {achievements.map((a) => {
              const img = a.done ? achievementImage(a.id) : undefined
              const inner = (
                <>
                  {img ? (
                    <span
                      className="ach-img"
                      style={{ backgroundImage: `url(${img})` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="ach-icon">{a.done ? a.icon : '🔒'}</span>
                  )}
                  <span className="ach-text">
                    <span className="ach-name">{a.name}</span>
                    <span className="ach-desc">
                      {a.desc}
                      {!a.done && a.progress ? `（${a.progress.cur}/${a.progress.total}）` : ''}
                    </span>
                  </span>
                </>
              )
              return img ? (
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
            })}
          </div>
        </section>
      )}

      {tab === 'gallery' && (
        <section className="gallery">
          {builtinScenarios.map((sc) => {
            const tones = reachableEndingTones(sc)
            const seen = new Set(seenEndings(sc.id))
            return (
              <div key={sc.id} className="gallery-row">
                <span className="gallery-name">
                  {sc.emoji} {sc.title}
                  <span className="gallery-count">
                    {tones.filter((t) => seen.has(t)).length}/{tones.length}
                  </span>
                </span>
                <span className="gallery-tones">
                  {tones.map((t, i) =>
                    seen.has(t) ? (
                      <button
                        key={i}
                        className="ending-chip seen"
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
                        title="查看此结局"
                      >
                        {t}
                      </button>
                    ) : (
                      <span key={i} className="ending-chip locked">？？？</span>
                    ),
                  )}
                </span>
              </div>
            )
          })}
        </section>
      )}

      {detail && (
        <div className="ending-detail-overlay" onClick={() => setDetail(null)}>
          <div className="ending-detail" onClick={(e) => e.stopPropagation()}>
            <button className="ghost ed-close" onClick={() => setDetail(null)}>✕</button>
            {(() => {
              const art = endingImage(detail.scId, detail.tone)
              return art ? (
                <button
                  className="ed-art"
                  style={{ backgroundImage: `url(${art})` }}
                  onClick={() => setLightbox(art)}
                  title="点击看全图"
                  aria-label="查看大图"
                >
                  <span className="storycard-zoom" aria-hidden="true">⤢</span>
                </button>
              ) : null
            })()}
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
      )}
      {badge && (
        <div className="badge-overlay" onClick={() => setBadge(null)}>
          <div className="badge-show" onClick={(e) => e.stopPropagation()}>
            <span
              className="badge-show-img"
              style={{ backgroundImage: `url(${badge.img})` }}
              aria-hidden="true"
            />
            <h3 className="badge-show-name">{badge.name}</h3>
            <p className="badge-show-desc">{badge.desc}</p>
          </div>
        </div>
      )}
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

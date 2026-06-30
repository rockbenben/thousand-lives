import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyChoice, resolveCustomAction } from '../engine/state'
import { bandOf } from '../engine/bands'
import { isKeyMoment } from '../engine/keymoment'
import { friendlyError, isAbortError } from '../ai/client'
import { localSource, aiSource } from '../ai/turnSource'
import { loadConfig, saveToSlot, exportSaveString, type SaveGame } from '../storage'
import { downloadText, safeFilename } from './download'
import { msg } from './messages'
import { nodeImage, hasNodeArt } from './nodeArt'
import { covers } from './covers'
import { ShareCardModal } from './ShareCardModal'
import { FontScaleControl } from './FontScaleControl'
import { Memoir } from './Memoir'
import { Lightbox } from './Lightbox'
import { StoryCard } from './StoryCard'
import { Typewriter } from './Typewriter'

// 自定义行动字数上限：防止超长输入撑爆 AI 上下文 / 浪费 token
const CUSTOM_ACTION_MAX = 200

export function Play({
  session,
  onUpdate,
  onQuit,
}: {
  session: SaveGame
  onUpdate: (s: SaveGame) => void
  onQuit: () => void
}) {
  const { scenario, state, pendingTurn, pendingAction } = session
  // 回合来源：本地事件池或 AI 在线生成。Play 只依赖来源的能力声明（流式 / 自由行动 / 随机），
  // 不再到处判断 mode === 'local'。换一种来源只需实现新的 TurnSource。
  const source = useMemo(
    () =>
      state.mode === 'local'
        ? localSource()
        : aiSource(() => {
            const c = loadConfig()
            if (!c) throw new Error(msg.noApiConfig)
            return c
          }),
    [state.mode],
  )
  const [loading, setLoading] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [error, setError] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customText, setCustomText] = useState('')
  const [auto, setAuto] = useState(false)
  const [showMemoir, setShowMemoir] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // 看全图：轻触隐去卷文、看清整张场景画；再触恢复
  const [peek, setPeek] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  // 正文是否已落定：决定「画卷书页」节奏中选项何时淡入（打字机写完 / 流式收尾后才现）
  const [proseDone, setProseDone] = useState(false)
  const busyRef = useRef(false)
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 玩家退出后组件卸载，迟到的 AI 响应不能再写回 session，否则会复活已清除的存档
  const aliveRef = useRef(true)
  // 卸载时真正中断在途请求，停止消耗额度（而非仅丢弃响应）
  const abortRef = useRef<AbortController | null>(null)
  // 本回合正文是否已通过流式过程展示过：是则不再走打字机动画（仅存档恢复时用打字机）
  const streamedRef = useRef(false)
  // 按 attributes 对象身份追踪上一回合的增减，浮标在整个回合内保持可见
  const attrTrack = useRef({ attrs: state.attributes, deltas: {} as Record<string, number> })
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
      // 复位 busy，使（StrictMode 的）重挂载或退出后重进能重新发起请求，不被上一次的在途标志卡死
      busyRef.current = false
    }
  }, [])

  if (attrTrack.current.attrs !== state.attributes) {
    const deltas: Record<string, number> = {}
    for (const a of scenario.attributes) {
      const d = state.attributes[a.key] - (attrTrack.current.attrs[a.key] ?? state.attributes[a.key])
      if (d !== 0) deltas[a.key] = d
    }
    attrTrack.current = { attrs: state.attributes, deltas }
  }
  const deltas = attrTrack.current.deltas

  // 生成下一回合；resolving=自定义行动结算（此时 pendingTurn 仍是行动发生的场景）。
  // 流式来源（AI）显示「落笔中」并接收逐字回调、可中断；非流式来源（本地）即时产出、不显示加载态，
  // 交由打字机动画呈现。两者统一走同一套在途/中断/落盘逻辑。
  const runTurn = async () => {
    if (busyRef.current) return
    busyRef.current = true
    const ac = new AbortController()
    abortRef.current = ac
    const resolvingAction = pendingAction
    const scene = pendingTurn
    if (source.streaming) {
      setLoading(true)
      setError('')
      setStreamText('')
    }
    try {
      const turn = await source.generate({
        scenario,
        state,
        resolvingAction,
        sceneNarrative: scene?.narrative,
        onStream: source.streaming
          ? (v) => {
              if (aliveRef.current) setStreamText(v)
            }
          : undefined,
        signal: ac.signal,
      })
      // 仅当本请求仍是当前请求时才落盘（被中断/被新请求取代的旧请求不写入）
      if (abortRef.current !== ac) return
      // 流式来源已实时展示过正文 → 落盘后跳过打字机；非流式则让打字机动画呈现
      streamedRef.current = source.streaming
      if (resolvingAction && scene) {
        const next = resolveCustomAction(scenario, state, scene, resolvingAction, turn)
        onUpdate({ scenario, state: next, pendingTurn: turn, pendingAction: undefined })
      } else {
        onUpdate({ ...session, pendingTurn: turn })
      }
    } catch (e) {
      // 主动中断（退出/卸载）不是错误，不提示
      if (aliveRef.current && abortRef.current === ac && !isAbortError(e)) {
        setError(friendlyError(e))
      }
    } finally {
      // 只有"当前请求"管理共享标志，避免被取代的旧请求误清正在进行的新请求状态
      if (abortRef.current === ac) {
        busyRef.current = false
        if (aliveRef.current && source.streaming) {
          setLoading(false)
          setStreamText('')
        }
      }
    }
  }

  useEffect(() => {
    // 自定义行动结算（仅支持自由行动的来源会产生 pendingAction），或缺回合时，生成下一回合
    if (pendingAction || (!pendingTurn && !state.ended)) void runTurn()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTurn, pendingAction, state.history.length])

  // 滚动日志到底部；打字机/流式逐字增高时持续跟随
  const scrollLogBottom = useCallback((smooth = false) => {
    const el = logRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    scrollLogBottom(true)
  })

  // 新回合开始即收起选项；正文（流式/打字机）落定后再让它们淡入，营造「写完→你接话」的呼吸
  useEffect(() => {
    setProseDone(false)
  }, [pendingTurn])

  // AI 托管：本回合呈现后，隔一会自动替角色做选择（用 AI 推荐，否则随机），形成自动演进
  useEffect(() => {
    if (autoTimer.current) {
      clearTimeout(autoTimer.current)
      autoTimer.current = null
    }
    // 托管自动落子；任一浮层（留影/看图）打开时暂停，避免回合在玩家阅读时被悄然推进
    if (!auto || !pendingTurn || loading || pendingAction || state.ended || showMemoir || lightbox) return
    const n = pendingTurn.choices.length
    const rec = pendingTurn.recommend
    const idx = typeof rec === 'number' && rec >= 0 && rec < n ? rec : Math.floor(Math.random() * n)
    autoTimer.current = setTimeout(() => {
      autoTimer.current = null
      pick(idx)
    }, 2600)
    return () => {
      if (autoTimer.current) {
        clearTimeout(autoTimer.current)
        autoTimer.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, pendingTurn, loading, pendingAction, state.ended, showMemoir, lightbox])

  const pick = (idx: number) => {
    if (!pendingTurn || loading || pendingAction) return
    streamedRef.current = false
    // 来源决定随机源:本地注入「命运无常」偶然性(同一选择可能走向不同);AI 由模型自带变数
    const next = applyChoice(scenario, state, pendingTurn, idx, source.choiceRng)
    onUpdate({ scenario, state: next, pendingTurn: null })
  }

  const submitCustom = () => {
    const act = customText.trim()
    if (!act || !pendingTurn || loading || pendingAction) return
    streamedRef.current = false
    setCustomOpen(false)
    setCustomText('')
    // 保留 pendingTurn 作为行动发生的场景，标记待结算（effect 会触发结算请求）
    onUpdate({ ...session, pendingAction: act })
  }

  const turnNo = state.history.length + 1
  const keyMoment = isKeyMoment(turnNo, scenario.maxTurns)
  const curArt = hasNodeArt(scenario.id, pendingTurn?.summary)
    ? nodeImage(scenario.id, pendingTurn?.summary)
    : undefined
  const keyArt = keyMoment ? curArt : undefined
  // 命途长卷 VN：整屏场景画始终解析出一张图（专属→主题→封面），随当前节点流转作世界背景
  const sceneArt = nodeImage(scenario.id, pendingTurn?.summary)
  // 上一回合：把你刚才的抉择与他人即时反馈作为新场景的承接引子（VN 里不再有竖向历史可回看）
  const lastTurn = state.history[state.history.length - 1]
  // 氛围底图：该剧本封面，压暗+模糊作远景视差层（自定义剧本无封面则不铺）
  const ambientBg = covers[scenario.id]
  const [cardSeen, setCardSeen] = useState(0) // 已看过弹卡的最高关键回合号
  // 命运抉择独立大卡:本回合是关键节点、剧情已就绪、非托管/结算/加载时弹出一次
  const showStoryCard =
    keyMoment && !!pendingTurn && !loading && !pendingAction && !auto && cardSeen < turnNo
  const [saved, setSaved] = useState(false)

  const saveSlot = () => {
    const name = window.prompt('存档名称：', `${scenario.title} 第${turnNo}${scenario.turnUnit}`)
    if (name === null) return
    if (!saveToSlot(name, session, Date.now())) {
      window.alert(msg.saveSlotFailed)
      return
    }
    setSaved(true)
    setTimeout(() => aliveRef.current && setSaved(false), 2000)
  }

  const exportSave = () => {
    downloadText(`千世书-${safeFilename(scenario.title)}-第${turnNo}${scenario.turnUnit}.json`, exportSaveString(session))
  }

  // 分享当下：打开预览弹窗，所见即所得地复制/保存/分享此刻的命运卡
  const [showShare, setShowShare] = useState(false)

  return (
    <div className={`play vn ${peek ? 'peek' : ''}`}>
      {ambientBg && (
        <div
          className="play-ambient"
          style={{ backgroundImage: `url(${ambientBg})` }}
          aria-hidden="true"
        />
      )}
      <div className="vn-stage" onClick={() => peek && setPeek(false)}>
      {sceneArt && (
        <div
          className="vn-scene"
          key={sceneArt}
          style={{ backgroundImage: `url(${sceneArt})` }}
          aria-hidden="true"
        />
      )}
      <div className="vn-scrim" aria-hidden="true" />

      <header className="vn-hud">
        <div className="vn-hud-row">
          <span className="vn-title">{scenario.emoji} {scenario.title}</span>
          {auto && <span className="play-auto-flag" title="托管中：AI 正替你的角色演进">托管中</span>}
          <button
            className="vn-eye"
            onClick={() => setPeek((v) => !v)}
            title={peek ? '显示卷文' : '看全图（轻触画面恢复）'}
            aria-label={peek ? '显示卷文' : '看全图'}
          >
            {peek ? '文' : '图'}
          </button>
          <div className="play-menu">
          <button
            className={`play-menu-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-label="卷宗 · 更多"
            title="卷宗"
          >
            卷
          </button>
          {menuOpen && (
            <>
              <div className="play-menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="play-menu-panel" role="menu">
                <button
                  className={`play-menu-item ${auto ? 'on' : ''}`}
                  role="menuitem"
                  onClick={() => setAuto((v) => !v)}
                  title="开启后由 AI 替你的角色自动抉择、自动演进"
                >
                  <span>{auto ? '停止托管' : '交由 AI 托管'}</span>
                  <span className="play-menu-glyph">{auto ? '⏸' : '▶'}</span>
                </button>
                <button className="play-menu-item" role="menuitem" onClick={() => { setShowMemoir(true); setMenuOpen(false) }}>
                  <span>命途留影</span><span className="play-menu-glyph">☰</span>
                </button>
                <button className="play-menu-item" role="menuitem" onClick={() => { setShowShare(true); setMenuOpen(false) }}>
                  <span>分享此刻</span><span className="play-menu-glyph">⤴</span>
                </button>
                <div className="play-menu-sep" />
                <button className="play-menu-item" role="menuitem" onClick={saveSlot}>
                  <span>{saved ? '已存入卷宗' : '存档'}</span><span className="play-menu-glyph">{saved ? '✓' : '⌑'}</span>
                </button>
                <button className="play-menu-item" role="menuitem" onClick={() => { exportSave(); setMenuOpen(false) }}>
                  <span>导出存档</span><span className="play-menu-glyph">↧</span>
                </button>
                <div className="play-menu-sep" />
                <div className="play-menu-fontrow">
                  <span className="play-menu-fontlabel">字号</span>
                  <FontScaleControl compact />
                </div>
                <div className="play-menu-sep" />
                <button
                  className="play-menu-item danger"
                  role="menuitem"
                  onClick={() => {
                    if (window.confirm('搁笔离场会舍弃这段未写完的人生（已存档的不受影响），确定？')) onQuit()
                  }}
                  title="回到卷首，未存档的进度将舍弃"
                >
                  <span>搁笔离场</span><span className="play-menu-glyph">↩</span>
                </button>
              </div>
            </>
          )}
          </div>
        </div>
        <div className="vn-vitals">
          {scenario.attributes.map((a) => {
            const value = state.attributes[a.key]
            const delta = deltas[a.key] ?? 0
            const band = bandOf(a, value)
            return (
              <span key={a.key} className="vn-vital" title={`${a.name} ${value}/${a.max} · ${band.label}`}>
                <span className="vn-vital-name">{a.name}</span>
                <span className={`vn-vital-band sev-${band.severity}`}>{band.label}</span>
                <span className="vn-vital-val">
                  {value}
                  {delta !== 0 && (
                    <span key={state.history.length} className={`attr-delta ${delta > 0 ? 'up' : 'down'}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </span>
              </span>
            )
          })}
        </div>
      </header>
      </div>

      <section className="vn-panel">
        {scenario.maxTurns ? (
          <div className="vn-path" aria-hidden="true">
            <span className="vn-path-track">
              <span
                className="vn-path-fill"
                style={{ width: `${Math.min(100, (turnNo / scenario.maxTurns) * 100)}%` }}
              />
            </span>
            <span className="vn-path-label">命途 {turnNo} / {scenario.maxTurns} {scenario.turnUnit}</span>
          </div>
        ) : null}
        <div className="vn-panel-head">
          <span className="vn-scene-label">
            {keyMoment ? '☰ ' : ''}第 {turnNo} {scenario.turnUnit}
            {pendingTurn?.summary ? ` · ${pendingTurn.summary}` : ''}
          </span>
          {sceneArt && (
            <button
              className="vn-zoom"
              onClick={() => setLightbox(sceneArt)}
              title={msg.clickToEnlarge}
              aria-label={msg.viewNodeArt}
            >
              ⛶
            </button>
          )}
        </div>

        {state.ambition && (
          <div className="ambition-bar vn-ambition">
            <span className="ambition-label">目标</span>
            <span className="ambition-text">{state.ambition}</span>
            {typeof state.goalProgress === 'number' && (
              <span className="goal-progress" title={`目标完成度 ${state.goalProgress}%`}>
                <span className="goal-progress-track">
                  <span
                    className="goal-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, state.goalProgress))}%` }}
                  />
                </span>
                <span className="goal-progress-pct">{state.goalProgress}%</span>
              </span>
            )}
          </div>
        )}

        <div className="vn-body" ref={logRef}>
          {lastTurn && (lastTurn.reaction || lastTurn.twist) && (
            <div className="vn-recap">
              {lastTurn.choiceText && <p className="picked">{lastTurn.choiceText}</p>}
              {lastTurn.reaction && <p className="reaction">{lastTurn.reaction}</p>}
              {lastTurn.twist && <p className="twist">{lastTurn.twist}</p>}
            </div>
          )}
          <div className="vn-prose">
            {state.history.length === 0 && !pendingTurn && !streamText && !loading && (
              <p className="intro">{scenario.intro}</p>
            )}
            {loading && streamText ? (
              // 正在流式生成（含自定义行动结算：此时 pendingTurn 仍是旧场景，须优先显示流式新内容）
              <p className="narrative">
                {streamText}
                <span className="caret">▍</span>
              </p>
            ) : pendingTurn ? (
              streamedRef.current ? (
                <p className="narrative">{pendingTurn.narrative}</p>
              ) : (
                <Typewriter
                  key={state.history.length}
                  text={pendingTurn.narrative}
                  onType={scrollLogBottom}
                  onDone={() => setProseDone(true)}
                />
              )
            ) : streamText ? (
              <p className="narrative">
                {streamText}
                <span className="caret">▍</span>
              </p>
            ) : null}
            {loading && !streamText && <p className="loading">命运正在落笔…</p>}
            {error && (
              <div className="error-box">
                <p>{error}</p>
                <button onClick={runTurn}>重试本回合</button>
              </div>
            )}
          </div>

      {pendingTurn && !loading && !pendingAction && (streamedRef.current || proseDone) && (
        <div className={`choices ${keyMoment ? 'key-moment' : ''}`}>
          {auto && <p className="auto-hint">托管中 · AI 正替你的角色做出抉择，点任意选项或「托管 ⏸」可随时接管</p>}
          {pendingTurn.choices.map((c, i) => {
            const fx = scenario.attributes
              .map((a) => ({ name: a.name, v: c.effects[a.key] ?? 0 }))
              .filter((f) => f.v !== 0)
            const isRec = auto && pendingTurn.recommend === i
            return (
              <button key={i} className={`choice ${isRec ? 'recommended' : ''}`} onClick={() => pick(i)}>
                <span className="choice-text">{isRec ? '➤ ' : ''}{c.text}</span>
                {fx.length > 0 && (
                  <span className="choice-fx">
                    {fx.map((f) => (
                      <span
                        key={f.name}
                        className={`fx ${f.v > 0 ? 'up' : 'down'}`}
                        aria-label={`${f.name}${f.v > 0 ? '提升' : '降低'}${Math.abs(f.v)}`}
                      >
                        {f.name} {f.v > 0 ? `+${f.v}` : f.v}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            )
          })}

          {source.supportsCustomAction &&
            (customOpen ? (
              <div className="custom-action">
                <textarea
                  className="custom-input"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value.slice(0, CUSTOM_ACTION_MAX))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitCustom()
                  }}
                  placeholder="写下你想做的事，由 AI 裁定结果（Ctrl+Enter 提交）"
                  rows={2}
                  maxLength={CUSTOM_ACTION_MAX}
                  autoFocus
                />
                <div className="custom-row">
                  <button className="ghost" onClick={() => { setCustomOpen(false); setCustomText('') }}>
                    取消
                  </button>
                  <span className="custom-count">{customText.length}/{CUSTOM_ACTION_MAX}</span>
                  <button className="primary" disabled={!customText.trim()} onClick={submitCustom}>
                    照此行事
                  </button>
                </div>
              </div>
            ) : (
              <button className="choice custom-trigger" onClick={() => setCustomOpen(true)}>
                <span className="choice-text">✎ 自己写一个行动…</span>
              </button>
            ))}
        </div>
      )}
        </div>
        {((state.inventory ?? []).length > 0 || (state.memory ?? []).length > 0) && (
          <div className="vn-meta">
            {(state.inventory ?? []).length > 0 && (
              <div className="inventory">
                <span className="inventory-label">行囊</span>
                {(state.inventory ?? []).map((it) => (
                  <span key={it} className="item-chip">{it}</span>
                ))}
              </div>
            )}
            {(state.memory ?? []).length > 0 && (
              <details className="memory">
                <summary>
                  <span className="memory-label">记忆</span>
                  <span className="memory-count">{(state.memory ?? []).length}</span>
                </summary>
                <ul className="memory-list">
                  {(state.memory ?? []).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {showStoryCard && (
        <StoryCard
          art={keyArt}
          label={`☰ 第 ${turnNo} ${scenario.turnUnit}${pendingTurn?.summary ? ` · ${pendingTurn.summary}` : ''}`}
          onViewArt={() => keyArt && setLightbox(keyArt)}
          onContinue={() => setCardSeen(turnNo)}
        />
      )}
      {showMemoir && (
        <Memoir
          scenario={scenario}
          state={state}
          onClose={() => setShowMemoir(false)}
          onViewArt={setLightbox}
        />
      )}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {showShare && (
        <ShareCardModal
          sc={scenario}
          st={state}
          coverUrl={nodeImage(scenario.id, pendingTurn?.summary)}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}

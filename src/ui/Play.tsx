import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyChoice, resolveCustomAction } from '../engine/state'
import { bandOf } from '../engine/bands'
import { isKeyMoment } from '../engine/keymoment'
import { friendlyError, isAbortError } from '../ai/client'
import { localSource, aiSource } from '../ai/turnSource'
import { loadConfig, saveToSlot, exportSaveString, type SaveGame } from '../storage'
import { downloadText, safeFilename } from './download'
import { nodeImage, hasNodeArt } from './nodeArt'
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
            if (!c) throw new Error('未找到 API 配置，请回到卷首重新设置')
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
  const [lightbox, setLightbox] = useState<string | null>(null)
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
  const [cardSeen, setCardSeen] = useState(0) // 已看过弹卡的最高关键回合号
  // 命运抉择独立大卡:本回合是关键节点、剧情已就绪、非托管/结算/加载时弹出一次
  const showStoryCard =
    keyMoment && !!pendingTurn && !loading && !pendingAction && !auto && cardSeen < turnNo
  const [saved, setSaved] = useState(false)

  const saveSlot = () => {
    const name = window.prompt('存档名称：', `${scenario.title} 第${turnNo}${scenario.turnUnit}`)
    if (name === null) return
    saveToSlot(name, session, Date.now())
    setSaved(true)
    setTimeout(() => aliveRef.current && setSaved(false), 2000)
  }

  const exportSave = () => {
    downloadText(`千世书-${safeFilename(scenario.title)}-第${turnNo}${scenario.turnUnit}.json`, exportSaveString(session))
  }

  return (
    <div className="play">
      <header className="play-header">
        <span className="play-title">{scenario.emoji} {scenario.title}</span>
        <span className="play-turn">
          第 {turnNo} / {scenario.maxTurns} {scenario.turnUnit}
        </span>
        <button
          className={`play-act auto-toggle ${auto ? 'on' : 'ghost'}`}
          onClick={() => setAuto((v) => !v)}
          title="开启后由 AI 替你的角色自动抉择、自动演进"
        >
          {auto ? '托管中 ⏸' : '托管 ▶'}
        </button>
        <button className="ghost play-act" onClick={() => setShowMemoir(true)} title="回看本局走过的命运抉择">
          留影
        </button>
        <button className="ghost play-act" onClick={saveSlot}>{saved ? '已存 ✓' : '存档'}</button>
        <button className="ghost play-act" onClick={exportSave}>导出</button>
        <button
          className="ghost play-act"
          onClick={() => {
            if (window.confirm('搁笔离场会舍弃这段未写完的人生（已存档的不受影响），确定？')) onQuit()
          }}
          title="回到卷首，未存档的进度将舍弃"
        >
          搁笔
        </button>
      </header>

      <div className="attr-panel">
        {scenario.attributes.map((a) => {
          const value = state.attributes[a.key]
          const ratio = value / a.max
          const delta = deltas[a.key] ?? 0
          const band = bandOf(a, value)
          return (
            <div key={a.key} className="attr">
              <span className="attr-name">{a.name}</span>
              <div className="attr-bar">
                <div
                  className={`attr-fill sev-${band.severity}`}
                  style={{ width: `${ratio * 100}%` }}
                />
              </div>
              <span className={`attr-band sev-${band.severity}`}>{band.label}</span>
              <span className="attr-value">
                {value}
                {delta !== 0 && (
                  <span
                    key={state.history.length}
                    className={`attr-delta ${delta > 0 ? 'up' : 'down'}`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {state.ambition && (
        <div className="ambition-bar">
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

      <div className="log" ref={logRef}>
        {state.history.length === 0 && <p className="intro">{scenario.intro}</p>}
        {state.history.map((t, i) => {
          const km = isKeyMoment(i + 1, scenario.maxTurns)
          const art = hasNodeArt(scenario.id, t.summary) ? nodeImage(scenario.id, t.summary) : undefined
          return (
            <div key={i} className={`turn ${km ? 'key-moment' : ''} ${art && !km ? 'has-thumb' : ''}`}>
              {art && km && (
                <div
                  className="turn-art"
                  style={{ backgroundImage: `url(${art})` }}
                  onClick={() => setLightbox(art)}
                  title="点击看全图"
                />
              )}
              <div className="turn-no">
                <span>{km ? '☰ ' : ''}第 {i + 1} {scenario.turnUnit}{t.summary ? ` · ${t.summary}` : ''}</span>
              </div>
              {art && !km && (
                <button
                  className="turn-art thumb"
                  style={{ backgroundImage: `url(${art})` }}
                  onClick={() => setLightbox(art)}
                  title="点击看全图"
                  aria-label="查看此节点配图"
                />
              )}
              <p className="narrative">{t.narrative}</p>
              <p className="picked">{t.choiceText}</p>
              {t.reaction && <p className="reaction">{t.reaction}</p>}
              {t.twist && <p className="twist">{t.twist}</p>}
            </div>
          )
        })}

        {(pendingTurn || streamText) && (
          <div className={`turn current ${keyMoment ? 'key-moment' : ''} ${curArt && !keyMoment ? 'has-thumb' : ''}`}>
            {keyMoment && keyArt && (
              <div
                className="turn-art"
                style={{ backgroundImage: `url(${keyArt})` }}
                onClick={() => setLightbox(keyArt)}
                title="点击看全图"
              />
            )}
            <div className="turn-no">
              <span>{keyMoment ? '☰ ' : ''}第 {turnNo} {scenario.turnUnit}{pendingTurn?.summary ? ` · ${pendingTurn.summary}` : ''}</span>
            </div>
            {curArt && !keyMoment && (
              <button
                className="turn-art thumb"
                style={{ backgroundImage: `url(${curArt})` }}
                onClick={() => setLightbox(curArt)}
                title="点击看全图"
                aria-label="查看此节点配图"
              />
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
                />
              )
            ) : (
              <p className="narrative">
                {streamText}
                <span className="caret">▍</span>
              </p>
            )}
          </div>
        )}

        {loading && !streamText && <p className="loading">命运正在落笔…</p>}
        {error && (
          <div className="error-box">
            <p>{error}</p>
            <button onClick={runTurn}>重试本回合</button>
          </div>
        )}
      </div>

      {pendingTurn && !loading && !pendingAction && (
        <div className={`choices ${keyMoment ? 'key-moment' : ''}`}>
          {auto && <p className="auto-hint">托管中 · AI 正替你的角色抉择，点任意选项或「托管 ⏸」可随时接管</p>}
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
                      <span key={f.name} className={`fx ${f.v > 0 ? 'up' : 'down'}`}>
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
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { buildEndingMessages } from '../engine/prompt'
import { buildSummaryCard } from '../engine/summary'
import { localEnding } from '../engine/local'
import { gradeRun } from '../engine/grade'
import { drawShareCard, canvasToBlob } from './shareCard'
import { endingImage } from './endingArt'
import { Memoir } from './Memoir'
import { Lightbox } from './Lightbox'
import { safeFilename } from './download'
import { chat, friendlyError, isAbortError } from '../ai/client'
import { loadConfig, recordEnding, seenEndings, loadStats, type SaveGame } from '../storage'
import type { Scenario } from '../scenarios/schema'
import { builtinScenarios } from '../scenarios'
import { computeAchievements } from '../engine/achievements'
import { achievementConfig } from '../scenarios/achievementConfig'
import { reachableEndingTones } from '../engine/state'

// 剪贴板兜底：navigator.clipboard 在非 HTTPS / 旧浏览器下不可用时，用临时 textarea + execCommand
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// 当前已解锁成就（用于分享卡），需在 recordEnding 之后调用以包含本局
function unlockedAchievements() {
  return computeAchievements({
    scenarios: builtinScenarios.map((sc) => ({
      id: sc.id,
      seen: new Set(seenEndings(sc.id)).size,
      total: reachableEndingTones(sc).length,
    })),
    stats: loadStats(),
    seenTones: Object.fromEntries(builtinScenarios.map((sc) => [sc.id, seenEndings(sc.id)])),
    achConfig: achievementConfig,
  }).filter((a) => a.done)
}

export function EndingScreen({
  session,
  onRestart,
  onReplay,
}: {
  session: SaveGame
  onRestart: () => void
  onReplay: (sc: Scenario) => void
}) {
  const { scenario, state } = session
  const ending = state.ended ?? { tone: '未知', reason: '' }
  const grade = gradeRun(scenario, state)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [showMemoir, setShowMemoir] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const busyRef = useRef(false)
  const aliveRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      abortRef.current?.abort()
      // 与 Play 同理：复位 busy，使 StrictMode 的卸载→重挂载能重新发起尾声请求，
      // 否则 busyRef 卡在 true 会让重挂载的 fetchEnding 直接 return，尾声永不生成
      busyRef.current = false
    }
  }, [])

  // 记入结局图鉴（按剧本累计见过的结局基调）+ 全局统计（成就用）
  useEffect(() => {
    if (state.ended) {
      const isDeath = scenario.attributes.some(
        (a) => a.deathBelow !== undefined && state.attributes[a.key] <= a.deathBelow,
      )
      recordEnding(scenario.id, state.ended.tone, {
        rating: grade.rating,
        local: state.mode === 'local',
        isDeath,
        turns: state.history.length,
        goal: state.goalProgress,
        custom: !builtinScenarios.some((b) => b.id === scenario.id),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, state.ended])

  const fetchEnding = async () => {
    if (busyRef.current) return
    busyRef.current = true
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    setError('')
    try {
      const config = loadConfig()
      if (!config) throw new Error('未找到 API 配置，请回到卷首重新设置')
      const t = await chat(
        config,
        buildEndingMessages(scenario, state, ending),
        (partial) => {
          if (aliveRef.current) setText(partial)
        },
        ac.signal,
      )
      if (aliveRef.current) setText(t)
    } catch (e) {
      if (aliveRef.current && !isAbortError(e)) setError(friendlyError(e))
    } finally {
      busyRef.current = false
      if (aliveRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (text) return
    // 本地模式无需调用 AI：直接用本地拼写的尾声
    if (state.mode === 'local') setText(localEnding(scenario, state))
    else void fetchEnding()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const card = buildSummaryCard(scenario, state, text)

  const copy = async () => {
    // 优先用异步剪贴板 API；非 HTTPS / 旧浏览器下回退到 execCommand，再不行才提示手动复制
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(card)
      } else if (!legacyCopy(card)) {
        throw new Error('execCommand copy failed')
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (legacyCopy(card)) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        setError('复制失败：浏览器拒绝了剪贴板访问，请手动选择文本复制')
      }
    }
  }

  const saveImage = async () => {
    try {
      const canvas = await drawShareCard(
        scenario,
        state,
        unlockedAchievements().map((a) => ({ icon: a.icon, name: a.name })),
        endingImage(scenario.id, ending.tone),
      )
      const blob = await canvasToBlob(canvas)
      if (!blob) throw new Error('生成失败')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `千世书-${safeFilename(scenario.title)}-${safeFilename(grade.title)}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError('结局卡生成失败，可改用「复制文字版」分享')
    }
  }

  const art = endingImage(scenario.id, ending.tone)

  // 揭晓前先以一张「命运之卡」呈现，轻触翻开方见此生结局——仪式感与绚丽收束
  if (!revealed) {
    return (
      <div className="ending-gate" onClick={() => setRevealed(true)}>
        <div
          className="fate-card"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setRevealed(true)
            }
          }}
        >
          <div className="fate-card-inner">
            {art && (
              <div
                className="fate-card-art"
                style={{ backgroundImage: `url(${art})` }}
                aria-hidden="true"
              />
            )}
            <div className="fate-card-veil" aria-hidden="true" />
            <span className="fate-card-corner tl" aria-hidden="true">✦</span>
            <span className="fate-card-corner br" aria-hidden="true">✦</span>
            <div className="fate-card-face">
              <span className="fate-seal" aria-hidden="true">終</span>
              <h2 className="fate-tone">{ending.tone}</h2>
              <p className="fate-sub">第 {state.history.length} {scenario.turnUnit} · {scenario.title}</p>
            </div>
          </div>
        </div>
        <p className="fate-hint">轻触，揭晓此生结局</p>
      </div>
    )
  }

  return (
    <div className="ending revealed">
      {art && (
        <div
          className="ending-art"
          style={{ backgroundImage: `url(${art})` }}
          aria-hidden="true"
        />
      )}
      <h2 className="ending-tone">
        {ending.tone}
        <span className="seal-mark" aria-hidden="true">終</span>
      </h2>
      <p className="ending-grade">
        <span className={`grade-badge grade-${grade.rating}`}>{grade.rating} 级</span>
      </p>
      <p className="ending-meta">
        历经 {state.history.length} {scenario.turnUnit} · {scenario.title}
      </p>
      {(() => {
        const r = ending.reason ?? ''
        const cause =
          ending.tone === '死亡' || r.endsWith('耗尽')
            ? `${r || '气数已尽'}，你的人生就此画上句点`
            : r === 'maxTurns' || ending.tone === '落幕'
              ? `${scenario.maxTurns} ${scenario.turnUnit}大限已至，命途就此落幕`
              : ''
        return cause ? <p className="ending-cause">{cause}</p> : null
      })()}
      {loading && !text && <p className="loading">正在书写你的结局…</p>}
      {error && (
        <div className="error-box">
          <p>{error}</p>
          <button onClick={fetchEnding}>重试</button>
        </div>
      )}
      {text && <p className="ending-text">{text}</p>}
      {state.mode === 'local' && (
        <p className="local-ending-note">
          本局为本地模式生成；填入 AI Key 可获得由大模型实时编织的独特剧情与结局。
        </p>
      )}
      <details className="summary-card-fold">
        <summary>文字版分享卡 · 点开预览</summary>
        <pre className="summary-card">{card}</pre>
      </details>
      <div className="ending-actions">
        <div className="ending-actions-row">
          <button className="primary" onClick={saveImage}>保存结局卡 🖼</button>
          <button onClick={copy}>{copied ? '已复制 ✓' : '复制文字版 ⎘'}</button>
          <button onClick={() => setShowMemoir(true)} title="回看这一生的命运抉择">命途留影 ◷</button>
        </div>
        <div className="ending-actions-row nav">
          <button
            className="ghost-line"
            onClick={() => onReplay(scenario)}
            title="以同一段命途，从头再走一遍"
          >
            ↻ 再活一世
          </button>
          <button
            className="ghost-line"
            onClick={onRestart}
            title="回到卷首，另择一段人生"
          >
            ❖ 换个人生
          </button>
        </div>
      </div>
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

import { useRef, useState } from 'react'
import { ZodError } from 'zod'
import { importScenarioSchema, type Scenario } from '../scenarios/schema'
import { builtinScenarios } from '../scenarios'
import { hasLocalMode } from '../engine/local'
import {
  loadCustomScenarios,
  addCustomScenario,
  loadSave,
  seenEndings,
  loadStats,
} from '../storage'
import { computeAchievements } from '../engine/achievements'
import type { Scenario as ScenarioType } from '../scenarios/schema'
import { covers } from './covers'
import { GenerateModal } from './GenerateModal'

// 八卦：作为剧本卡角落的星盘点缀，按序轮替
const TRIGRAMS = ['☰', '☱', '☲', '☳', '☴', '☵', '☶', '☷']

// 某剧本可达结局基调集合（声明结局 + 有致死属性则加通用「死亡」）
function endingTones(sc: ScenarioType): string[] {
  const tones = sc.endings.map((e) => e.tone)
  if (sc.attributes.some((a) => a.deathBelow !== undefined)) tones.push('死亡')
  return [...new Set(tones)]
}

function importErrorMessage(e: unknown): string {
  if (e instanceof ZodError) {
    const issue = e.issues[0]
    return issue ? `字段 ${issue.path.join('.') || '(根)'}: ${issue.message}` : e.message
  }
  return e instanceof Error ? e.message.slice(0, 200) : String(e)
}

export function Home({
  onSelect,
  onContinue,
  onOpenArchive,
}: {
  onSelect: (sc: Scenario) => void
  onContinue: () => void
  onOpenArchive: () => void
}) {
  const [custom, setCustom] = useState<Scenario[]>(loadCustomScenarios)
  const [importError, setImportError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [save] = useState(loadSave)
  const [showGen, setShowGen] = useState(false)

  // 收集进度（首页露出留存钩子）：累计解锁结局数 / 总数、已得成就数 / 总数
  const endingsTotal = builtinScenarios.reduce((s, sc) => s + endingTones(sc).length, 0)
  const endingsSeen = builtinScenarios.reduce(
    (s, sc) => s + new Set(seenEndings(sc.id)).size,
    0,
  )
  const achievements = computeAchievements({
    scenarios: builtinScenarios.map((sc) => ({
      id: sc.id,
      seen: new Set(seenEndings(sc.id)).size,
      total: endingTones(sc).length,
    })),
    stats: loadStats(),
    seenTones: Object.fromEntries(builtinScenarios.map((sc) => [sc.id, seenEndings(sc.id)])),
  })
  const achDone = achievements.filter((a) => a.done).length

  const onImport = async (file: File) => {
    try {
      const sc = importScenarioSchema.parse(JSON.parse(await file.text()))
      if (builtinScenarios.some((b) => b.id === sc.id)) {
        throw new Error(`剧本 id "${sc.id}" 与内置剧本冲突，请改用其他 id`)
      }
      addCustomScenario(sc)
      setCustom(loadCustomScenarios())
      setImportError('')
    } catch (e) {
      setImportError(`剧本导入失败：${importErrorMessage(e)}`)
    }
  }

  return (
    <div className="home">
      <div className="hero">
        <div className="home-banner" aria-hidden="true">
          <span className="ring"></span>
          <span className="ticks"></span>
          <span className="ticks fine"></span>
          <span className="inner"></span>
          <span className="orbit"><span className="g">命</span><span className="g o2">缘</span></span>
          <span className="orbit orbit2"><span className="g">劫</span><span className="g o2">道</span></span>
        </div>
        <div className="hero-title">
          <h1 className="logo">千世书<span className="seal" aria-hidden="true">千世</span></h1>
          <span className="hero-div" aria-hidden="true"></span>
          <p className="roman" aria-hidden="true">THOUSAND&nbsp;LIVES</p>
          <p className="tagline">一卷千世，活过千种人生</p>
          <p className="home-hook">落子无悔，步步皆命运——{endingsTotal} 种结局，等你一一抵达</p>
          <p className="home-hint">无需 API Key · 点开即玩</p>
        </div>
      </div>

      <button className="collection-strip" onClick={onOpenArchive}>
        <span className="cs-item">📖 已历结局 <b>{endingsSeen}</b>/{endingsTotal}</span>
        <span className="cs-sep" aria-hidden="true">·</span>
        <span className="cs-item">🏅 成就 <b>{achDone}</b>/{achievements.length}</span>
        <span className="cs-go" aria-hidden="true">命书阁 →</span>
      </button>

      {save && !save.state.ended && (
        <button className="continue-card" onClick={onContinue}>
          ▶ 继续上次：{save.scenario.title} · 第 {save.state.history.length + 1}{' '}
          {save.scenario.turnUnit}
        </button>
      )}

      <div className="scenario-grid">
        {[...builtinScenarios, ...custom].map((sc, i) => {
          const cover = covers[sc.id]
          return (
            <button
              key={sc.id}
              className={`scenario-card ${cover ? 'has-cover' : ''}`}
              onClick={() => onSelect(sc)}
            >
              {cover && (
                <span
                  className="card-cover"
                  style={{ backgroundImage: `url(${cover})` }}
                  aria-hidden="true"
                />
              )}
              <span className="card-rune" aria-hidden="true">{TRIGRAMS[i % TRIGRAMS.length]}</span>
              {hasLocalMode(sc) && <span className="free-badge">免 Key 可玩</span>}
              <span className="scenario-emoji">{sc.emoji}</span>
              <span className="scenario-title">{sc.title}</span>
              <span className="scenario-intro">{sc.intro}</span>
            </button>
          )
        })}
        <button className="scenario-card gen-card" onClick={() => setShowGen(true)}>
          <span className="scenario-emoji">✨</span>
          <span className="scenario-title">AI 生成剧本</span>
          <span className="scenario-intro">给一个主题，AI 现编一个带上百支线的全新剧本，加入剧本库</span>
        </button>
        <button className="scenario-card import-card" onClick={() => fileRef.current?.click()}>
          <span className="scenario-emoji">＋</span>
          <span className="scenario-title">导入剧本</span>
          <span className="scenario-intro">选择符合剧本格式的 JSON 文件，详见 README</span>
        </button>
      </div>

      {importError && <p className="error">{importError}</p>}

      {showGen && (
        <GenerateModal
          existingIds={[...builtinScenarios, ...custom].map((s) => s.id)}
          onClose={() => setShowGen(false)}
          onCreated={(sc) => {
            addCustomScenario(sc)
            setCustom(loadCustomScenarios())
            setShowGen(false)
          }}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onImport(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

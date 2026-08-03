import { useEffect, useRef, useState } from 'react'
import type { Scenario, Opening } from '../scenarios/schema'
import { chat, friendlyError } from '../ai/client'
import { PRESETS } from '../ai/presets'
import { hasLocalMode } from '../engine/local'
import { loadConfig } from '../storage'
import { SearchSelect } from './SearchSelect'
import { useAIConfig } from './useAIConfig'
import { msg } from './messages'
import { covers } from './covers'

const providerOptions = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  hint: p.baseURL ? new URL(p.baseURL).host : msg.noBaseUrl,
}))

export function Setup({
  scenario,
  onStart,
  onBack,
  initialOpening,
}: {
  scenario: Scenario
  onStart: (sc: Scenario, opening?: Opening, ambition?: string, mode?: 'ai' | 'local') => void
  onBack: () => void
  // 挑战链接预选的开局下标（?o=）；缺省取首个开局
  initialOpening?: number
}) {
  const [testResult, setTestResult] = useState('')
  // 每次配置变更/发起测试都自增；在途测试结算时若已变更则丢弃其结果，避免旧配置的”连接成功/失败”覆盖当前
  const testSeq = useRef(0)
  // AI 配置（受控 + 改即存 + key 跟服务商走）；任一字段变更即让旧的连接测试结果失效
  const cfg = useAIConfig(() => {
    setTestResult('')
    testSeq.current++
  })
  const savedConfig = loadConfig() // 仅用于下方「模式默认」判断（已配过 Key 则默认 AI）

  const [opening, setOpening] = useState<Opening | undefined>(
    scenario.openings?.[initialOpening ?? 0] ?? scenario.openings?.[0],
  )
  const [customId, setCustomId] = useState(false)
  const [customIdText, setCustomIdText] = useState('')
  const [ambition, setAmbition] = useState('')
  const [testing, setTesting] = useState(false)
  // 卸载（如测试中点「返回」）或发起新测试时中断在途请求，停止消耗额度、不在卸载后 setState
  const aliveRef = useRef(true)
  const testAbort = useRef<AbortController | null>(null)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      testAbort.current?.abort()
    }
  }, [])

  // 模式：本地（无需 Key）/ AI 驱动。剧本无本地事件时只能 AI；默认无 Key 选本地、有 Key 选 AI
  const localAvailable = hasLocalMode(scenario)
  const [mode, setMode] = useState<'ai' | 'local'>(
    localAvailable && !savedConfig ? 'local' : 'ai',
  )

  // 最终身份：自定义优先，否则用选中的预设开局
  const finalOpening = (): Opening | undefined =>
    customId
      ? customIdText.trim()
        ? { name: '自设', prompt: customIdText.trim() }
        : undefined
      : opening

  // 本地模式无需配置；AI 模式需要 key + model。另：选了「自定义身份」却没写，则不放行——
  // 否则会以「无身份」静默开局，玩家明明选了自设身份却丢失（finalOpening 此时返回 undefined）。
  const ready =
    (mode === 'local' || (cfg.apiKey.trim() !== '' && cfg.model.trim() !== '')) &&
    !(customId && customIdText.trim() === '')

  const testConnection = async () => {
    const seq = ++testSeq.current
    testAbort.current?.abort() // 中断上一次仍在途的测试，避免叠加请求
    const ac = new AbortController()
    testAbort.current = ac
    setTesting(true)
    setTestResult('')
    try {
      await chat(cfg.config(), [{ role: 'user', content: '请只回复 OK 两个字母。' }], undefined, ac.signal)
      if (aliveRef.current && testSeq.current === seq) setTestResult('✅ 连接成功')
    } catch (e) {
      if (aliveRef.current && testSeq.current === seq) setTestResult(`❌ ${friendlyError(e)}`)
    } finally {
      // 复位加载态由「仍是当前在途请求」把关（testAbort），而非 seq——否则改配置只 bump seq
      // 不发新请求时，本次请求结束也不复位，按钮会永久卡在「测试中…」
      if (aliveRef.current && testAbort.current === ac) setTesting(false)
    }
  }

  return (
    <div className="setup">
      <button className="ghost setup-back" onClick={onBack}>← 返回</button>
      <div className={`setup-hero ${covers[scenario.id] ? 'has-art' : ''}`}>
        {covers[scenario.id] && (
          <div
            className="setup-hero-art"
            style={{ backgroundImage: `url(${covers[scenario.id]})` }}
            aria-hidden="true"
          />
        )}
        <div className="setup-hero-veil" aria-hidden="true" />
        <div className="setup-hero-cap">
          {scenario.genre && <span className="setup-genre">{scenario.genre}</span>}
          <h2 className="setup-name">{scenario.title}</h2>
        </div>
      </div>
      <p className="setup-intro">{scenario.intro}</p>

      {localAvailable && (
        <section className="panel">
          <h3>游玩模式</h3>
          <div className="mode-row">
            <button
              className={`mode-card ${mode === 'local' ? 'selected' : ''}`}
              onClick={() => {
                setMode('local')
                setCustomId(false)
              }}
            >
              <strong>本地试玩 · 无需 Key</strong>
              <span>引擎按内置剧情池随机演进，即点即玩、完全免费；每局不同，但剧情有限</span>
            </button>
            <button
              className={`mode-card ${mode === 'ai' ? 'selected' : ''}`}
              onClick={() => setMode('ai')}
            >
              <strong>AI 驱动</strong>
              <span>大模型实时编织独一无二的剧情与结局，支持自定义行动；需填 API Key</span>
            </button>
          </div>
        </section>
      )}

      {mode === 'ai' && (
      <section className="panel">
        <h3>AI 服务配置（仅保存在本浏览器）</h3>
        <label>
          <span className="label-row">
            服务商（可搜索）
            {cfg.preset.docs && (
              <a className="ext" href={cfg.preset.docs} target="_blank" rel="noreferrer">
                API 文档 ↗
              </a>
            )}
          </span>
          <SearchSelect
            options={providerOptions}
            value={cfg.presetId}
            onChange={cfg.changePreset}
            placeholder="搜索服务商…"
          />
        </label>
        <label>
          Base URL（可改为代理或区域地址）
          <input
            list="endpoint-options"
            value={cfg.baseURL}
            onChange={(e) => cfg.changeBaseURL(e.target.value)}
            placeholder={cfg.preset.baseURL || 'https://api.openai.com/v1'}
          />
          <datalist id="endpoint-options">
            {(cfg.preset.endpoints ?? []).map((ep) => (
              <option key={ep.url} value={ep.url}>{ep.label}</option>
            ))}
          </datalist>
        </label>
        <label>
          <span className="label-row">
            API Key
            {cfg.preset.apiKeyUrl && (
              <a className="ext" href={cfg.preset.apiKeyUrl} target="_blank" rel="noreferrer">
                获取 Key ↗
              </a>
            )}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={cfg.apiKey}
            onChange={(e) => cfg.changeApiKey(e.target.value)}
            placeholder="sk-..."
          />
        </label>
        <label>
          模型（可搜索，也可直接输入任意模型名）
          <SearchSelect
            allowCustom
            options={cfg.preset.models.map((m) => ({ value: m }))}
            value={cfg.model}
            onChange={cfg.changeModel}
            placeholder={cfg.preset.models[0] ?? '模型名'}
          />
        </label>
        <p className="hint">
          请求直接从浏览器发出；若服务商不支持跨域（CORS），可改用 OpenRouter 等支持浏览器直连的服务。
        </p>
        <div className="row">
          <button onClick={testConnection} disabled={!ready || testing}>
            {testing ? '测试中…' : '测试连接'}
          </button>
          {testResult && <span className="test-result">{testResult}</span>}
        </div>
      </section>
      )}

      <section className="panel">
        <h3>选择开局身份</h3>
        <div className="opening-list">
          {(scenario.openings ?? []).map((o) => (
            <button
              key={o.name}
              className={`opening ${!customId && opening?.name === o.name ? 'selected' : ''}`}
              onClick={() => {
                setCustomId(false)
                setOpening(o)
              }}
            >
              <strong>{o.name}</strong>
              <span>{o.prompt}</span>
            </button>
          ))}
          {mode === 'ai' && (
            <button
              className={`opening ${customId ? 'selected' : ''}`}
              onClick={() => setCustomId(true)}
              title="AI 会据此身份演绎你的专属剧情与际遇"
            >
              <strong>✎ 自定义身份</strong>
              <span>自己写一个角色：身份、性格、秘密、处境……</span>
            </button>
          )}
          {mode === 'ai' && customId && (
            <textarea
              className="custom-input"
              value={customIdText}
              onChange={(e) => setCustomIdText(e.target.value)}
              placeholder="写下你的出身、性格与那点藏着的秘密"
              rows={2}
              autoFocus
            />
          )}
        </div>
        {mode === 'local' && (
          <p className="hint">
            本地试玩从内置事件池取材，开局身份决定你会遇上哪些事件——三种身份走的是三条不同的线。切到「AI 驱动」还能自己写身份，由 AI 现编贴合你设定的剧情。
          </p>
        )}
      </section>

      {mode === 'ai' && (
      <section className="panel">
        <h3 title="AI 会围绕它编织机遇与阻碍、推动或阻挠剧情，并在结局点明它最终实现、落空还是变质">
          立下你的目标（可选）
        </h3>
        <p className="hint">游戏会围绕它编织机遇与阻碍，让每个选择都有方向。留空则随遇而安。</p>
        {scenario.ambitions && scenario.ambitions.length > 0 && (
          <div className="ambition-list">
            {scenario.ambitions.map((a) => (
              <button
                key={a}
                className={`ambition-chip ${ambition === a ? 'selected' : ''}`}
                onClick={() => setAmbition(ambition === a ? '' : a)}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        {/* placeholder 原本写死三个例子（扳倒太后/集齐物资/改写原著），在仙侠、武侠这些剧本里全是串台的；
            上面的备选标签本就来自当前剧本，示例交给它们，这里只邀请你自己写 */}
        <textarea
          className="custom-input"
          value={ambition}
          onChange={(e) => setAmbition(e.target.value)}
          placeholder="或者，自己写一个"
          rows={2}
        />
      </section>
      )}

      <button
        className="primary start-btn"
        disabled={!ready}
        onClick={() => {
          // 配置已在编辑时即时落盘（useAIConfig），此处无需再存
          onStart(scenario, finalOpening(), mode === 'ai' ? ambition : '', mode)
        }}
      >
        开始这段人生
      </button>
    </div>
  )
}

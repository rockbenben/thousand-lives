import { useRef, useState } from 'react'
import type { Scenario, Opening } from '../scenarios/schema'
import type { AIConfig, Provider } from '../ai/types'
import { chat, friendlyError } from '../ai/client'
import { PRESETS, matchPreset, findPreset } from '../ai/presets'
import { hasLocalMode } from '../engine/local'
import { loadConfig, saveConfig } from '../storage'
import { SearchSelect } from './SearchSelect'
import { covers } from './covers'

const providerOptions = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  hint: p.baseURL ? new URL(p.baseURL).host : '自填地址',
}))

export function Setup({
  scenario,
  onStart,
  onBack,
}: {
  scenario: Scenario
  onStart: (sc: Scenario, opening?: Opening, ambition?: string, mode?: 'ai' | 'local') => void
  onBack: () => void
}) {
  const saved = loadConfig()
  const [presetId, setPresetId] = useState(() =>
    saved ? matchPreset(saved.provider, saved.baseURL ?? '', saved.presetId).id : PRESETS[0].id,
  )
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? PRESETS[0].provider)
  const [baseURL, setBaseURL] = useState(saved?.baseURL ?? PRESETS[0].baseURL)
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [model, setModel] = useState(saved?.model ?? PRESETS[0].models[0] ?? '')
  const [opening, setOpening] = useState<Opening | undefined>(scenario.openings?.[0])
  const [customId, setCustomId] = useState(false)
  const [customIdText, setCustomIdText] = useState('')
  const [ambition, setAmbition] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  // 每次配置变更/发起测试都自增；在途测试结算时若已变更则丢弃其结果，避免旧配置的“连接成功/失败”覆盖当前
  const testSeq = useRef(0)

  // 模式：本地（无需 Key）/ AI 驱动。剧本无本地事件时只能 AI；默认无 Key 选本地、有 Key 选 AI
  const localAvailable = hasLocalMode(scenario)
  const [mode, setMode] = useState<'ai' | 'local'>(
    localAvailable && !saved ? 'local' : 'ai',
  )

  // 最终身份：自定义优先，否则用选中的预设开局
  const finalOpening = (): Opening | undefined =>
    customId
      ? customIdText.trim()
        ? { name: '自设', prompt: customIdText.trim() }
        : undefined
      : opening

  const preset = findPreset(presetId)!

  // 任一配置字段变化后，旧的连接测试结果即失效
  const update = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v)
    setTestResult('')
    testSeq.current++ // 配置已改：使在途测试结果失效
  }
  const changePreset = (id: string) => {
    const p = findPreset(id)!
    setPresetId(id)
    setProvider(p.provider)
    setBaseURL(p.baseURL)
    setModel(p.models[0] ?? '')
    setTestResult('')
    testSeq.current++
  }

  const config = (): AIConfig => ({
    provider,
    baseURL: baseURL.trim() || undefined,
    apiKey: apiKey.trim(),
    model: model.trim(),
    presetId,
  })
  // 本地模式无需配置；AI 模式需要 key + model
  const ready = mode === 'local' || (apiKey.trim() !== '' && model.trim() !== '')

  const testConnection = async () => {
    const seq = ++testSeq.current
    setTesting(true)
    setTestResult('')
    try {
      await chat(config(), [{ role: 'user', content: '请只回复 OK 两个字母。' }])
      if (testSeq.current === seq) setTestResult('✅ 连接成功')
    } catch (e) {
      if (testSeq.current === seq) setTestResult(`❌ ${friendlyError(e)}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="setup">
      <button className="ghost" onClick={onBack}>← 返回</button>
      {covers[scenario.id] && (
        <div
          className="setup-cover"
          style={{ backgroundImage: `url(${covers[scenario.id]})` }}
          aria-hidden="true"
        />
      )}
      <h2>{scenario.emoji} {scenario.title}</h2>
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
            {preset.docs && (
              <a className="ext" href={preset.docs} target="_blank" rel="noreferrer">
                API 文档 ↗
              </a>
            )}
          </span>
          <SearchSelect
            options={providerOptions}
            value={presetId}
            onChange={(id) => changePreset(id)}
            placeholder="搜索服务商…"
          />
        </label>
        <label>
          Base URL（可改为代理或区域地址）
          <input
            list="endpoint-options"
            value={baseURL}
            onChange={(e) => update(setBaseURL)(e.target.value)}
            placeholder={preset.baseURL || 'https://api.openai.com/v1'}
          />
          <datalist id="endpoint-options">
            {(preset.endpoints ?? []).map((ep) => (
              <option key={ep.url} value={ep.url}>{ep.label}</option>
            ))}
          </datalist>
        </label>
        <label>
          <span className="label-row">
            API Key
            {preset.apiKeyUrl && (
              <a className="ext" href={preset.apiKeyUrl} target="_blank" rel="noreferrer">
                获取 Key ↗
              </a>
            )}
          </span>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => update(setApiKey)(e.target.value)}
            placeholder="sk-..."
          />
        </label>
        <label>
          模型（可搜索，也可直接输入任意模型名）
          <SearchSelect
            allowCustom
            options={preset.models.map((m) => ({ value: m }))}
            value={model}
            onChange={(v) => update(setModel)(v)}
            placeholder={preset.models[0] ?? '模型名'}
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
              placeholder="例：原著里早夭的废太子，重生后藏着前世记忆与一身暗伤"
              rows={2}
              autoFocus
            />
          )}
        </div>
        {mode === 'local' && (
          <p className="hint">
            本地试玩按固定剧情池演进，所选身份仅作代入参考；切到「AI 驱动」可自定义身份，且 AI 会让剧情贴合你的设定。
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
        <textarea
          className="custom-input"
          value={ambition}
          onChange={(e) => setAmbition(e.target.value)}
          placeholder="例：扳倒太后，登上后位 / 集齐物资建立据点 / 改写原著结局"
          rows={2}
        />
      </section>
      )}

      <button
        className="primary start-btn"
        disabled={!ready}
        onClick={() => {
          if (mode === 'ai') saveConfig(config())
          onStart(scenario, finalOpening(), mode === 'ai' ? ambition : '', mode)
        }}
      >
        开始这段人生
      </button>
    </div>
  )
}

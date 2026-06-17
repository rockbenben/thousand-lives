import { useRef, useState } from 'react'
import type { Scenario } from '../scenarios/schema'
import type { AIConfig, Provider } from '../ai/types'
import { PRESETS, matchPreset, findPreset } from '../ai/presets'
import { generateScenario, type GenProgress } from '../ai/generateScenario'
import { friendlyError, isAbortError } from '../ai/client'
import { loadConfig, saveConfig } from '../storage'
import { SearchSelect } from './SearchSelect'

const providerOptions = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  hint: p.baseURL ? new URL(p.baseURL).host : '自填地址',
}))

const SUGGESTIONS = ['大航海海盗', '赛博朋克侦探', '武侠江湖', '三国谋士', '校园青春', '星际殖民', '民国名伶']

export function GenerateModal({
  existingIds,
  onClose,
  onCreated,
}: {
  existingIds: string[]
  onClose: () => void
  onCreated: (sc: Scenario) => void
}) {
  const saved = loadConfig()
  const [presetId, setPresetId] = useState(() =>
    saved ? matchPreset(saved.provider, saved.baseURL ?? '', saved.presetId).id : PRESETS[0].id,
  )
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? PRESETS[0].provider)
  const [baseURL, setBaseURL] = useState(saved?.baseURL ?? PRESETS[0].baseURL)
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [model, setModel] = useState(saved?.model ?? PRESETS[0].models[0] ?? '')

  const [theme, setTheme] = useState('')
  const [target, setTarget] = useState(40)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<GenProgress | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const preset = findPreset(presetId)!
  const changePreset = (id: string) => {
    const p = findPreset(id)!
    setPresetId(id)
    setProvider(p.provider)
    setBaseURL(p.baseURL)
    setModel(p.models[0] ?? '')
  }

  const ready = theme.trim() !== '' && apiKey.trim() !== '' && model.trim() !== '' && !busy

  const run = async () => {
    const cfg: AIConfig = {
      provider,
      baseURL: baseURL.trim() || undefined,
      apiKey: apiKey.trim(),
      model: model.trim(),
      presetId,
    }
    saveConfig(cfg)
    setBusy(true)
    setError('')
    setProgress({ phase: 'skeleton', events: 0, target })
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const sc = await generateScenario(cfg, theme.trim(), {
        target,
        existingIds,
        signal: ac.signal,
        onProgress: setProgress,
      })
      onCreated(sc)
    } catch (e) {
      if (!isAbortError(e)) setError(friendlyError(e))
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    onClose()
  }

  const phaseText = (p: GenProgress) =>
    p.phase === 'skeleton'
      ? '正在构思世界观与属性…'
      : p.phase === 'done'
        ? '正在收尾校验…'
        : `正在撰写支线剧情… ${p.events}/${p.target}`

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal gen-modal" onClick={(e) => e.stopPropagation()}>
        <h3>✨ AI 生成新剧本</h3>
        <p className="hint">给一个主题，AI 会为你设计属性、结局与上百条支线，生成后加入剧本库（可本地试玩）。</p>

        <label>
          剧本主题
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例：大航海海盗 / 赛博朋克侦探 / 武侠江湖"
            disabled={busy}
            autoFocus
          />
        </label>
        <div className="suggest-row">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="ambition-chip" disabled={busy} onClick={() => setTheme(s)}>
              {s}
            </button>
          ))}
        </div>

        <label>
          支线数量：{target}
          <input
            type="range"
            min={20}
            max={100}
            step={10}
            value={target}
            disabled={busy}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <span className="hint">数量越多越耐玩，但更耗时、更费 API 额度（按你自己的 Key 计）。</span>
        </label>

        <details className="gen-config" open={!apiKey}>
          <summary>AI 服务配置（与游戏共用，仅保存在本浏览器）</summary>
          <label>
            服务商
            <SearchSelect
              options={providerOptions}
              value={presetId}
              onChange={changePreset}
              placeholder="搜索服务商…"
            />
          </label>
          <label>
            Base URL
            <input value={baseURL} onChange={(e) => setBaseURL(e.target.value)} placeholder={preset.baseURL} />
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
            <input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
          </label>
          <label>
            模型
            <SearchSelect
              allowCustom
              options={preset.models.map((m) => ({ value: m }))}
              value={model}
              onChange={setModel}
              placeholder={preset.models[0] ?? '模型名'}
            />
          </label>
        </details>

        {busy && progress && (
          <div className="gen-progress">
            <span className="spinner" aria-hidden="true" />
            {phaseText(progress)}
          </div>
        )}
        {error && <p className="error">{error}</p>}

        <div className="row gen-actions">
          {busy ? (
            <button className="ghost" onClick={cancel}>
              取消生成
            </button>
          ) : (
            <>
              <button className="ghost" onClick={onClose}>
                关闭
              </button>
              <button className="primary" disabled={!ready} onClick={run}>
                开始生成
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

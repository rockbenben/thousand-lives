import { useRef, useState } from 'react'
import type { Scenario } from '../scenarios/schema'
import { PRESETS } from '../ai/presets'
import { generateScenario, type GenProgress } from '../ai/generateScenario'
import { friendlyError, isAbortError } from '../ai/client'
import { SearchSelect } from './SearchSelect'
import { useAIConfig } from './useAIConfig'
import { msg } from './messages'
import { useModalA11y } from './useModalA11y'

const providerOptions = PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
  hint: p.baseURL ? new URL(p.baseURL).host : msg.noBaseUrl,
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
  // AI 配置（受控 + 改即存 + key 跟服务商走），与设置页共用一份逻辑
  const cfg = useAIConfig()

  const [theme, setTheme] = useState('')
  const [target, setTarget] = useState(40)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<GenProgress | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const ready = theme.trim() !== '' && cfg.apiKey.trim() !== '' && cfg.model.trim() !== '' && !busy

  const run = async () => {
    // 配置已在编辑时即时落盘（useAIConfig）；此处直接用当前配置生成
    setBusy(true)
    setError('')
    setProgress({ phase: 'skeleton', events: 0, target })
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const sc = await generateScenario(cfg.config(), theme.trim(), {
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

  // 仅中断本次生成、退回表单（busy→false 后重现「关闭 / 生成」），保留已填主题与配置供调整重试；
  // 不再连带关掉整个弹窗——「取消生成」只该取消生成，离开由「关闭」负责
  const cancel = () => {
    abortRef.current?.abort()
  }

  const phaseText = (p: GenProgress) =>
    p.phase === 'skeleton'
      ? '正在构思世界观与属性…'
      : p.phase === 'done'
        ? '正在收尾校验…'
        : `正在撰写支线剧情… ${p.events}/${p.target}`

  // 生成中（busy）禁用 Esc 关闭，与点击遮罩一致——避免误触中断
  const ref = useModalA11y<HTMLDivElement>(onClose, !busy)

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div
        className="modal gen-modal"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="AI 生成新剧本"
        tabIndex={-1}
      >
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

        <details className="gen-config" open={!cfg.apiKey}>
          <summary>AI 服务配置（与游戏共用，仅保存在本浏览器）</summary>
          <label>
            服务商
            <SearchSelect
              options={providerOptions}
              value={cfg.presetId}
              onChange={cfg.changePreset}
              placeholder="搜索服务商…"
            />
          </label>
          <label>
            Base URL
            <input value={cfg.baseURL} onChange={(e) => cfg.changeBaseURL(e.target.value)} placeholder={cfg.preset.baseURL} />
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
            <input type="password" autoComplete="off" value={cfg.apiKey} onChange={(e) => cfg.changeApiKey(e.target.value)} placeholder="sk-..." />
          </label>
          <label>
            模型
            <SearchSelect
              allowCustom
              options={cfg.preset.models.map((m) => ({ value: m }))}
              value={cfg.model}
              onChange={cfg.changeModel}
              placeholder={cfg.preset.models[0] ?? '模型名'}
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

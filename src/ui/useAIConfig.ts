import { useState } from 'react'
import type { AIConfig, Provider } from '../ai/types'
import { PRESETS, findPreset, matchPreset } from '../ai/presets'
import { loadConfig, loadPresetConfig, saveConfig } from '../storage'

// AI 服务配置的受控状态 + 「改即存」持久化 + 「key 跟服务商走」的切换逻辑。
// Setup 与 GenerateModal 共用一份，避免两处各写一份而漂移（参考 web-tools 的按服务商分存配置）。
// onChange：任一字段变更后回调（如设置页据此使已有的连接测试结果失效）。
export function useAIConfig(onChange?: () => void) {
  const saved = loadConfig()
  const initId = saved ? matchPreset(saved.provider, saved.baseURL ?? '', saved.presetId).id : PRESETS[0].id
  const initPreset = findPreset(initId)!
  const [presetId, setPresetId] = useState(initId)
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? initPreset.provider)
  const [baseURL, setBaseURL] = useState(saved?.baseURL ?? initPreset.baseURL)
  const [apiKey, setApiKey] = useState(saved?.apiKey ?? '')
  const [model, setModel] = useState(saved?.model ?? initPreset.models[0] ?? '')

  type Fields = { presetId: string; provider: Provider; baseURL: string; apiKey: string; model: string }
  const build = (o: Fields): AIConfig => ({
    provider: o.provider,
    baseURL: o.baseURL.trim() || undefined,
    apiKey: o.apiKey.trim(),
    model: o.model.trim(),
    presetId: o.presetId,
  })
  // 以最新值（覆盖当前 state）落盘，不等开局；随后触发 onChange
  const persist = (o: Fields) => {
    saveConfig(build(o))
    onChange?.()
  }

  const changePreset = (id: string) => {
    const p = findPreset(id)!
    // key 跟服务商走：切到某服务商时恢复它自己存过的配置；没配过则用预设默认、key 留空（不串用上一家的 key）
    const prev = loadPresetConfig(id)
    const next: Fields = {
      presetId: id,
      provider: prev?.provider ?? p.provider,
      baseURL: prev?.baseURL ?? p.baseURL,
      apiKey: prev?.apiKey ?? '',
      model: prev?.model ?? p.models[0] ?? '',
    }
    setPresetId(next.presetId)
    setProvider(next.provider)
    setBaseURL(next.baseURL)
    setApiKey(next.apiKey)
    setModel(next.model)
    persist(next)
  }

  const changeBaseURL = (v: string) => {
    setBaseURL(v)
    persist({ presetId, provider, baseURL: v, apiKey, model })
  }
  const changeApiKey = (v: string) => {
    setApiKey(v)
    persist({ presetId, provider, baseURL, apiKey: v, model })
  }
  const changeModel = (v: string) => {
    setModel(v)
    persist({ presetId, provider, baseURL, apiKey, model: v })
  }

  return {
    presetId,
    provider,
    baseURL,
    apiKey,
    model,
    preset: findPreset(presetId)!,
    changePreset,
    changeBaseURL,
    changeApiKey,
    changeModel,
    config: (): AIConfig => build({ presetId, provider, baseURL, apiKey, model }),
  }
}

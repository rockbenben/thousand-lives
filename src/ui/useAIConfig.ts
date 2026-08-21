import { useState } from 'react'
import type { AIConfig, Provider, ThinkingLevel } from '../ai/types'
import { PRESETS, findPreset, matchPreset, supportsThinking, needsProxy, keyOptional, canDisableThinking, DEFAULT_PROXY } from '../ai/presets'
import { isComplete, loadConfig, loadPresetConfig, saveConfig } from '../storage'
import { isHttpUrl } from '../utils/url'

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
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingLevel>(saved?.thinkingLevel ?? 'off')
  /**
   * 中转拆成【开关 + 地址】两件事，与另外两个项目一致。
   *
   * 线上的形态没变：AIConfig.proxy 仍是「空 = 直连，非空 = 经它转发」这一个字段，
   * 开关只是它的 UI 投影（proxyOn = 地址非空），所以既不用改存档结构也不用迁移。
   * 拆开是因为「把地址删掉」和「不走中转」在用户脑子里不是一回事：想临时直连一次
   * 就得先把地址剪贴出来，回头再粘回去。
   *
   * ⚠ 关掉后刷新，自建中转的地址会回落成默认地址（关闭态本就不落盘地址）。
   * 常见情形是用默认中转，重填一次可接受；要真持久化就得往 AIConfig 里塞一个
   * 纯 UI 字段，那是把界面状态混进引擎契约，代价更大。
   */
  const [proxyOn, setProxyOn] = useState(saved ? Boolean(saved.proxy) : needsProxy(initId))
  const [proxyAddr, setProxyAddr] = useState(saved?.proxy || DEFAULT_PROXY)
  const proxy = proxyOn ? proxyAddr.trim() || DEFAULT_PROXY : ''

  type Fields = { presetId: string; provider: Provider; baseURL: string; apiKey: string; model: string; thinkingLevel: ThinkingLevel; proxy: string }
  const build = (o: Fields): AIConfig => ({
    provider: o.provider,
    baseURL: o.baseURL.trim() || undefined,
    apiKey: o.apiKey.trim(),
    model: o.model.trim(),
    presetId: o.presetId,
    thinkingLevel: o.thinkingLevel,
    // 存空串而不是丢字段：丢了的话「特意关掉的」与「从没配过」在切回来时分不开，
    // changePreset 的 ?? 会把中转重新默认打开 —— Key 与整段 prompt 又开始过中转。
    proxy: o.proxy.trim(),
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
      // 思考档位跟着服务商走：换回某家时恢复它上次的选择，没配过则关闭
      thinkingLevel: prev?.thinkingLevel ?? 'off',
      // 中转同理；没配过的话，直连已坏的那几家默认开
      proxy: prev?.proxy ?? (needsProxy(id) ? DEFAULT_PROXY : ''),
    }
    setPresetId(next.presetId)
    setProvider(next.provider)
    setBaseURL(next.baseURL)
    setApiKey(next.apiKey)
    setModel(next.model)
    setThinkingLevel(next.thinkingLevel)
    setProxyOn(Boolean(next.proxy))
    setProxyAddr(next.proxy || DEFAULT_PROXY)
    persist(next)
  }

  const changeBaseURL = (v: string) => {
    setBaseURL(v)
    persist({ presetId, provider, baseURL: v, apiKey, model, thinkingLevel, proxy })
  }
  const changeApiKey = (v: string) => {
    setApiKey(v)
    persist({ presetId, provider, baseURL, apiKey: v, model, thinkingLevel, proxy })
  }
  const changeModel = (v: string) => {
    setModel(v)
    persist({ presetId, provider, baseURL, apiKey, model: v, thinkingLevel, proxy })
  }

  const changeThinkingLevel = (v: ThinkingLevel) => {
    setThinkingLevel(v)
    persist({ presetId, provider, baseURL, apiKey, model, thinkingLevel: v, proxy })
  }

  const changeProxyOn = (on: boolean) => {
    setProxyOn(on)
    persist({ presetId, provider, baseURL, apiKey, model, thinkingLevel, proxy: on ? proxyAddr.trim() || DEFAULT_PROXY : '' })
  }
  const changeProxyAddr = (v: string) => {
    setProxyAddr(v)
    persist({ presetId, provider, baseURL, apiKey, model, thinkingLevel, proxy: proxyOn ? v.trim() || DEFAULT_PROXY : '' })
  }

  const current = build({ presetId, provider, baseURL, apiKey, model, thinkingLevel, proxy })
  // 中转地址填了但不是合法 http(s) 地址。留空不算错（= 用内置那台）。
  const proxyAddrInvalid = proxyOn && proxyAddr.trim() !== '' && !isHttpUrl(proxyAddr)

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
    thinkingLevel,
    changeThinkingLevel,
    // 该服务商+型号有没有已知的思考线格式 —— 没有就别显示控件（点了不会有效果）
    canThink: supportsThinking(presetId, model),
    // 这家的地址才是凭据（本地推理 / 自建网关），界面据此不再把 key 说成必填
    keyOptional: keyOptional(presetId),
    // 这个型号有没有「关闭」这一档 —— 没有的话最低档仍在推理、仍在计费，界面不能写「关闭」
    canDisableThinking: canDisableThinking(presetId, model),
    proxyOn,
    proxyAddr,
    changeProxyOn,
    changeProxyAddr,
    // 这家直连已坏 —— 关掉中转就发不出请求，UI 据此给出提示
    proxyRequired: needsProxy(presetId),
    // 自填地址（本地服务 / 自建网关）不该送进中转：那台按 host 白名单转发，
    // 局域网地址它根本够不着，公网自建地址也不在白名单里，只会拿到 400。
    // 判据用 keyOptional（=「地址才是凭据」）而不是列 id：presets.ts 里刚说过
    // 「不在这里按 id 列名单」，下一家自建网关预设进来时不该还要回头改 UI 文件。
    proxyApplicable: !keyOptional(presetId),
    proxyAddrInvalid,
    // 「配好了」= storage 肯存 + 真发得出去。界面自己再写一份必然漂 —— 放行开局却
    // 存不下来，玩家刷新后归零，全程没有任何报错（isComplete 那段注释说的就是这个
    // 静默 bug）。地址填错的中转同理：放行了也是每回合死在 viaProxy，而错值已经落盘，
    // 刷新都清不掉。
    complete: isComplete(current) && !proxyAddrInvalid,
    config: (): AIConfig => current,
  }
}

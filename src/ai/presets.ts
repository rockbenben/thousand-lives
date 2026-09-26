import type { Provider, ThinkingLevel } from './types'
import { findProvider, PROVIDER_CATALOG, type CatalogProvider } from './providerCatalog.generated'

/** 下拉里的分组。目录只分 llm / aggregator 两类，国内/国外的区分是本 app 加的 —— 中文用户按这个找服务商更快。 */
export type PresetGroup = 'china' | 'international' | 'aggregator' | 'custom'

export const PRESET_GROUPS: ReadonlyArray<{ id: PresetGroup; label: string }> = [
  { id: 'china', label: '国内厂商' },
  { id: 'international', label: '国际厂商' },
  { id: 'aggregator', label: '聚合 / 自建' },
  { id: 'custom', label: '自定义' },
]

export interface ProviderPreset {
  id: string
  group: PresetGroup
  label: string
  /**
   * 默认在服务商选择器里隐藏（来自目录 hidden）—— 当前是火山方舟 Coding Plan
   * 与阿里百炼 Token Plan 两个订阅套餐：两家官方文档均写明，在非 AI 编程工具 /
   * 允许范围之外使用套餐 Base URL / Key 可能被判滥用而封停账号 / 订阅。只是
   * 【默认 UI 过滤】：已选中它的存档与按 id 解析必须照常工作
   * （visibleProviderOptions 会把当前项留住）。
   */
  hidden?: boolean
  /** 官方 API 文档 */
  docs?: string
  /** 获取 / 管理 API Key 的控制台页面 */
  apiKeyUrl?: string
  /** 底层协议：决定走哪个 adapter 与鉴权方式 */
  provider: Provider
  /** 默认服务地址；空字符串表示需用户自填（仅自定义项） */
  baseURL: string
  /** 可选的备用地址（多区域 / 多计费模式），进 Base URL 的下拉建议 */
  endpoints?: { label: string; url: string; docs?: string }[]
  /** 推荐模型，第一个为默认值；模型输入框支持搜索与自定义 */
  models: string[]
}

// ────────────────────────────────────────────────────────────────────────────
// 厂商事实（模型 id / 区域端点 / 文档与控制台链接）来自 providerCatalog.generated.ts
// —— 那份文件由同步脚本整份重写，别手改它，也别把这些事实抄回本文件。
// 以前这些是手抄的，结果长期滞后：腾讯改名 TokenHub 之后这里还写着 hunyuan，
// 火山/千问/智谱的型号也都停在上一代。
//
// 本文件只留【本 app 自己的东西】：
//   · 收录哪几家（PICKED）——目录是超集，不是全都要
//   · 中文界面用的显示名与端点标签（目录的 label 一律英文，且禁止中文）
//   · 兜底的自定义项（CUSTOM_PRESET）
// 【顺序不在本文件定】：PRESETS 按目录顺序生成，上游怎么排这边就怎么排。
//
// ⚠ preset id 【就是】目录 key，不另起本地别名 —— 一处命名，省掉一张只会漂的
// 对照表。id 同时是【存档键】（storage 按它分存各家 API key），所以这次改名会让
// 旧存档失联：kimi→moonshot、ernie→qianfan、anthropic→claude、hunyuan→tokenhub、
// custom→llm。腾讯那条本来也非改不可（换了域名与模型 id，旧 key 打不通新端点）。
// ────────────────────────────────────────────────────────────────────────────

/** 目录的端点标签一律英文（上游是多语界面）；本 app 只有中文界面，翻回来。 */
const EP_LABEL: Record<string, string> = {
  'Mainland (CN)': '中国大陆',
  International: '国际',
  'International (Z.ai)': '国际（Z.ai）',
  US: '美国',
  'Pay-as-you-go': '按量付费',
  'Token Plan (CN)': 'Token Plan（中国）',
  'Token Plan (Singapore)': 'Token Plan（新加坡）',
  'Token Plan (Europe)': 'Token Plan（欧洲）',
}

/**
 * 各协议的 base 约定不同 —— adapters.ts 里 openai 拼 `/chat/completions`、
 * anthropic 拼 `/v1/messages`、gemini 拼 `/v1beta/models/...`。目录给的 baseUrl
 * 统一到「版本路径为止」，所以 anthropic 要再退一级，否则拼出 /v1/v1/messages。
 */
function baseFor(protocol: string, baseUrl: string): string {
  return protocol === 'anthropic' ? baseUrl.replace(/\/v1$/, '') : baseUrl
}

/**
 * 收录目录里的一家。preset id 【就是】目录 key —— 不另起本地别名，这样
 * 「以目录为准」由结构强制，不靠人记一张对照表。
 */
function fromCatalog(key: string, pick: Pick): ProviderPreset {
  const p = findProvider(key)
  if (!p) throw new Error(`providerCatalog 里没有 ${key} —— 上游可能已删除该 provider`)
  const eps = p.endpoints.map((e) => ({ label: EP_LABEL[e.label] ?? e.label, url: baseFor(p.protocol, e.baseUrl) }))
  if (!eps.length) throw new Error(`providerCatalog 的 ${key} 没有端点，无法作为预设`)
  return {
    id: key,
    group: pick.group,
    label: pick.label ?? p.label,
    ...(p.hidden ? { hidden: true as const } : {}),
    docs: p.docs,
    apiKeyUrl: p.apiKeyUrl,
    // 协议是三种之一由下面的启动校验保证（目录是超集，还有 azure-openai 之类）
    provider: p.protocol as Provider,
    baseURL: eps[0].url,
    // 只有一个端点时不出下拉（沿用原有约定：endpoints 表示"有别的选择"）
    ...(eps.length > 1 ? { endpoints: eps } : {}),
    // 目录指定了 defaultModel 就把它排首位 —— models[0] 是界面的预填值，让上游的
    // 排序来决定它，用户不动手就可能按 Opus 5 计费（目录默认给的是 Sonnet 5）。
    models: orderedModels(p),
  }
}

/** 模型清单，目录指定的 defaultModel 排首位（它是界面的预填值）。 */
function orderedModels(p: CatalogProvider): string[] {
  const ids = p.models.map((m) => m.id)
  return p.defaultModel && ids.includes(p.defaultModel)
    ? [p.defaultModel, ...ids.filter((id) => id !== p.defaultModel)]
    : ids
}

/**
 * 通用兜底项。目录里它就叫 llm / Custom (OpenAI-compatible)。
 *
 * baseURL 留空表示「用户自己填」，`endpoints` 是**起步地址建议**而不是同一服务
 * 的区域变体 —— 所以这一项刻意不满足「默认 baseURL 必在端点列表中」那条约定
 * （presets.test.ts 对它豁免）。Ollama / LM Studio / llama.cpp / LiteLLM /
 * Together AI / Fireworks AI 都在这里，不再各占一个预设：它们只是地址不同的
 * OpenAI 兼容端点，单列出来就得各自维护一份模型清单，而那正是要消灭的手工活。
 */
const CUSTOM_PRESET: ProviderPreset = {
  id: 'llm',
  group: 'custom',
  label: '自定义（OpenAI 兼容协议）',
  provider: 'openai',
  baseURL: '',
  // 每条端点各自带文档：背后是一个独立产品（LM Studio / Ollama / LiteLLM…），
  // 用户得先照着它的说明把服务跑起来。provider 级的一条链接在这里没有意义。
  endpoints: (findProvider('llm')?.endpoints ?? []).map((e) => ({ label: e.label, url: e.baseUrl, docs: e.docs })),
  models: [],
}

/**
 * 收录清单：目录 key → 中文显示名（省略则用目录的名字）。
 *
 * ⚠ 这里【只管收录，不管顺序】—— PRESETS 按目录顺序生成。上游调整排序或在中间
 * 插入一家时，这边自动跟上，不用再手工挪位置（手工排序正是上一版每次同步都要
 * 重来一遍的活）。
 *
 * 未收录的两家不是漏了：
 *   · yandex —— model 必须是 gpt://<folderId>/<model> 这种 URI，本 app 没有
 *     folderId 字段，列上短模型名会每请求 400
 *   · azureopenai —— 认证头是 api-key 而非 Bearer，URL 还要拼
 *     /openai/deployments/<部署名>?api-version=…，与本 app 的 OpenAI 适配器不兼容
 * llm 不在表里：它是兜底项，由 CUSTOM_PRESET 单独给，永远排最后。
 */
interface Pick {
  group: PresetGroup
  /** 中文显示名；省略则用目录的名字 */
  label?: string
}

const PICKED: Record<string, Pick> = {
  deepseek: { group: 'china' },
  openai: { group: 'international' },
  claude: { group: 'international', label: 'Anthropic Claude' },
  gemini: { group: 'international', label: 'Google Gemini' },
  qwen: { group: 'china', label: '通义千问 Qwen' },
  moonshot: { group: 'china', label: 'Kimi（月之暗面）' },
  doubao: { group: 'china', label: '豆包（火山引擎）' },
  mimo: { group: 'china', label: '小米 MiMo' },
  zhipu: { group: 'china', label: '智谱 GLM' },
  minimax: { group: 'china' },
  stepfun: { group: 'china', label: '阶跃星辰 StepFun' },
  qianfan: { group: 'china', label: '百度文心（千帆）' },
  mistral: { group: 'international' },
  grok: { group: 'international', label: 'xAI Grok' },
  cohere: { group: 'international' },
  openrouter: { group: 'aggregator', label: 'OpenRouter（聚合）' },
  // 上游 2026-09 把 key 从 opencode 改成 opencodeZen（同一账号下有 Zen 余额按量 /
  // Go 订阅两条产品线，光写 opencode 读不出是哪条）。不跟改的话下面那条守卫会直接
  // 抛错，整个启动就挂了。
  opencodeZen: { group: 'aggregator' },
  tokenhub: { group: 'china', label: 'TokenHub（腾讯）' },
  groq: { group: 'aggregator' },
  cerebras: { group: 'aggregator' },
  siliconflow: { group: 'aggregator', label: '硅基流动 SiliconFlow' },
  atlascloud: { group: 'aggregator' },
  nvidia: { group: 'aggregator', label: 'Nvidia NIM' },
  // 订阅套餐端点 —— 目录标了 hidden（默认选择器不显示，官方文档称非 AI 编程工具 /
  // 允许范围之外使用套餐端点可能被判定滥用而封停账号 / 订阅），由高级开关放出。
  // alibaba 2026-09 由 Coding Plan 换成 Token Plan（host/SKU 全换，见目录）。
  volcengine: { group: 'china', label: '字节方舟 Coding Plan' },
  alibaba: { group: 'china', label: '阿里百炼 Token Plan' },
}

/**
 * 本 app 有 adapter 的协议。目录是超集（azure-openai 之类也在里面），收录到一个
 * 没有 adapter 的协议时，chatOnce 那个三分支 switch 会直接落空返回 undefined，
 * 而报错要到 parseTurnResult 才冒出来 —— 离真正的原因十万八千里。启动时就拦。
 */
const SUPPORTED_PROTOCOLS: readonly string[] = ['openai', 'anthropic', 'gemini']

// 收录了却在目录里找不到 = 上游删了这家。显式报错，不要让 filter 静默吞掉
// （静默的后果是某天下拉里少了一项，而没有任何地方提示过）。
for (const key of Object.keys(PICKED)) {
  const p = findProvider(key)
  if (!p) throw new Error(`PICKED 收录了 ${key}，但 providerCatalog 里没有 —— 上游已删除该 provider，请更新 PICKED`)
  if (!SUPPORTED_PROTOCOLS.includes(p.protocol)) {
    throw new Error(`PICKED 收录的 ${key} 是 ${p.protocol} 协议，本 app 没有对应的 adapter —— 上游改了 protocol，请更新 PICKED`)
  }
}

/** 默认使用的中转地址。可在设置里改成自建的（见 README）。 */
export const DEFAULT_PROXY = 'https://cors.api2026.workers.dev'

/**
 * 该服务商是否【必须】走中转 —— 目录的 directBlocked 说明上游不给浏览器发
 * CORS 头（预检 404 之类），与用户网络无关，直连在浏览器里根本发不出去。
 * 用它给这几家把中转默认打开，而不是让用户配好 key 才发现用不了。
 *
 * 这是「当前事实、不是永恒属性」：上游修好后跑一次同步就变 false，这边自动
 * 不再默认开，不用有人记得回来改。
 */
export function needsProxy(presetId: string | undefined): boolean {
  return presetId ? findProvider(presetId)?.directBlocked === true : false
}

/**
 * 该服务商的【地址才是凭据】，key 可选甚至根本不存在（自建网关、局域网里的本地
 * 推理）。别拿「没填 key」拦住开局 —— LM Studio / Ollama / llama.cpp 这类本地服务
 * 没有 key 这个概念，拦住只会逼用户随便编一个字符串糊弄过去。
 * 同样由目录下发（keyOptional），不在这里按 id 列名单。
 */
export function keyOptional(presetId: string | undefined): boolean {
  return presetId ? findProvider(presetId)?.keyOptional === true : false
}

/**
 * 关闭形态是不是【明确的关】而不是「发最低档」。
 *
 * 按叶子值判，不按字段名 —— 各家的关法形状差得很远，而且不止字符串一种：
 *   真关：{reasoning_effort:"none"} · {thinking:{type:"disabled"}} ·
 *         {enable_thinking:false} · {reasoning:{enabled:false}}
 *   仍在想：{reasoning_effort:"low"} · {generationConfig:{thinkingConfig:{thinkingLevel:"low"}}}
 * 只认 "disabled"/"none" 这类字符串的话，qwen / 文心 / OpenRouter 的布尔关法会被
 * 误判成「关不掉」，界面就会对着一个真能关的服务商喊「仍会计费」。
 */
function isRealOff(wire: Record<string, unknown>): boolean {
  const leaves = (v: unknown): unknown[] =>
    v !== null && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [v]
  const vs = leaves(wire)
  return vs.length > 0 && vs.every((v) => v === false || v === 0 || (typeof v === 'string' && ['none', 'disabled', 'off'].includes(v)))
}

/**
 * 选「关」时这个型号是不是【真的不思考】。
 *
 * ⚠ false 的意思是选了关也仍在推理、仍在计费。界面因此不能把最低档写成
 * 「关闭（更快更省）」：用户以为省下了推理的钱，账单上并没有。
 *
 * 逐 SKU 判，因为同一家里两种都有：moonshot 的 kimi-k3 关闭档发
 * `reasoning_effort:"low"`（还在想），k2.6 发 `thinking:{type:"disabled"}`
 * （真关了）—— 拿 provider 级的一个布尔值说话，两个方向都会说错。
 * 不给 model 时（只知道服务商）退回 provider 级判据。
 */
export function canDisableThinking(presetId: string | undefined, model?: string): boolean {
  const p = presetId ? findProvider(presetId) : undefined
  if (!p) return true // 目录里没有的本地条目按「能关」处理
  if (model === undefined) return p.canDisableThinking !== false
  if (!supportsThinking(presetId, model)) return true // 压根不思考，无所谓关不关
  const off = thinkingWireFor(presetId, model, 'off')
  // 有关闭形态：形态本身说了算 —— 是「明确的关」还是「发最低档」
  if (off) return isRealOff(off)
  // ponytail: 没有关闭形态 = 关闭态什么都不发，这既可能是「服务端默认就关」
  // （claude-haiku-4-5），也可能是「关不掉」（claude-fable-5）—— 目录当前不区分。
  // 从严算作还在思考：多留一点 max_tokens、界面多一句提醒，都不伤人；反过来说成
  // 「关闭更省」而账单照跑才是真坑。等目录下发 alwaysOnThinking 之类再收紧。
  return false
}

export const PRESETS: ProviderPreset[] = [
  ...PROVIDER_CATALOG.filter((p) => p.key in PICKED).map((p) => fromCatalog(p.key, PICKED[p.key])),
  CUSTOM_PRESET,
]

/**
 * 下拉用的选项：先按 PRESET_GROUPS 分组，组内保持目录顺序。
 * 两个调用点（Setup / GenerateModal）以前各写一份逐字相同的构建代码，
 * 加分组时就要改两处 —— 收成一份。
 */
export const providerOptions: ReadonlyArray<{ value: string; label: string; hint: string; group: string }> = PRESET_GROUPS.flatMap((g) =>
  PRESETS.filter((p) => p.group === g.id).map((p) => ({
    value: p.id,
    label: p.label,
    hint: p.baseURL ? new URL(p.baseURL).host : '自填地址',
    group: g.label,
  })),
)

/** 该预设是否默认隐藏（订阅套餐端点：火山 Coding Plan / 阿里 Token Plan）。 */
export function isHiddenPreset(id: string | undefined): boolean {
  return Boolean(findPreset(id)?.hidden)
}

/**
 * 下拉【实际可见】的选项：hidden 预设默认过滤掉，用户打开高级开关才放出。
 * 当前已选中的那一项永远保留 —— 老存档 / 导入的配置选了隐藏预设时，不能让
 * SearchSelect 显示一个解析不出的裸 id。组顺序与连续性与 providerOptions 相同。
 */
export function visibleProviderOptions(
  showHidden: boolean,
  currentId?: string,
): ReadonlyArray<{ value: string; label: string; hint: string; group: string }> {
  if (showHidden) return providerOptions
  return providerOptions.filter((o) => o.value === currentId || !isHiddenPreset(o.value))
}

export function findPreset(id: string | undefined): ProviderPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}

/**
 * 该服务商 + 型号在某个档位下要往请求体里合并的字段；没有则返回 undefined
 * （= 一个思考参数都不发）。
 *
 * 逐 SKU 取：同一家的形态可以不同（Kimi K3 收顶层 reasoning_effort，
 * K2.x 收 thinking:{type}）。用户手填的未列出型号能力未知，退到 provider 级形态。
 *
 * ⚠ 目录只给 OpenAI 兼容协议那批的形态。Claude 与 Gemini 我们走的是各自的原生
 * 接口（/v1/messages、:streamGenerateContent），形态不同且目录不带 —— 所以这两家
 * 拿不到条目，思考控件也不该显示（见 supportsThinking）。
 */
/**
 * 未列出的 SKU 命中的【条件形态】规则（目前只有 Claude 有，按模型名判代）。
 *
 * ⚠ 取【首个】匹配，不是任意一个：规则之间会互相包含 —— 官方标 Always on 的那几支
 * 同属新世代，正则是新世代那条的子集，形态却差在关闭档（它们连 disabled 都回 400，
 * 所以那条规则没有 off 键）。目录已按「窄的在前」排好，照顺序取第一条即可。
 */
function wireIfFor(p: CatalogProvider, model: string) {
  return p.thinkingWireIf?.find((r) => new RegExp(r.pattern).test(model))
}

export function thinkingWireFor(
  presetId: string | undefined,
  model: string,
  level: ThinkingLevel,
): Record<string, unknown> | undefined {
  const p = presetId ? findProvider(presetId) : undefined
  if (!p) return undefined
  const listed = p.models.find((m) => m.id === model)
  if (listed) return listed.thinkingWire?.[level]
  // 未列出的 SKU：先看目录的【条件形态】。Claude 的形态取决于模型属于哪一代
  // （adaptive 世代发 output_config，旧世代发 budget_tokens），只能按模型名判 ——
  // 这条判代规则由目录统一下发，正是为了不让每个 app 各写一份（各写一份必然漂：
  // 上游注释里记着已经漂过一次，手填 opus-4-8 就 400）。
  const rule = wireIfFor(p, model)
  if (rule) return rule.wire?.[level]
  // 条件也不匹配的 Claude SKU 仍然不猜：provider 级回退是旧世代形状，套到新世代
  // 上每请求 400。不发只是没有思考，发错是根本发不出去。
  if (p.protocol === 'anthropic') return undefined
  return p.thinkingWire?.[level]
}

/** 该服务商 + 型号有没有已知的思考线格式 —— 没有就别显示思考控件（点了也不会有任何效果）。 */
export function supportsThinking(presetId: string | undefined, model: string): boolean {
  const p = presetId ? findProvider(presetId) : undefined
  if (!p) return false
  const listed = p.models.find((m) => m.id === model)
  if (listed) return Boolean(listed.thinkingWire)
  // 与 thinkingWireFor 同一条判断：先看条件形态，再是「未列出的 Claude SKU 不猜」
  if (wireIfFor(p, model)) return true
  return p.protocol !== 'anthropic' && Boolean(p.thinkingWire)
}

// 从已保存的配置反推预设（优先 presetId，其次按 provider+baseURL 精确匹配，最后同协议兜底）
export function matchPreset(
  provider: Provider,
  baseURL: string,
  presetId?: string,
): ProviderPreset {
  return (
    findPreset(presetId) ??
    PRESETS.find((p) => p.provider === provider && p.baseURL === baseURL) ??
    (provider === 'openai'
      ? findPreset('llm')!
      : PRESETS.find((p) => p.provider === provider)!)
  )
}

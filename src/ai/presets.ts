import type { Provider } from './types'

export interface ProviderPreset {
  id: string
  label: string
  /** 官方 API 文档 */
  docs?: string
  /** 获取 / 管理 API Key 的控制台页面 */
  apiKeyUrl?: string
  /** 底层协议：决定走哪个 adapter 与鉴权方式 */
  provider: Provider
  /** 默认服务地址；空字符串表示需用户自填（仅自定义项） */
  baseURL: string
  /** 可选的备用地址（多区域 / 多计费模式），进 Base URL 的下拉建议 */
  endpoints?: { label: string; url: string }[]
  /** 推荐模型，第一个为默认值；模型输入框支持搜索与自定义 */
  models: string[]
}

// Base URL 约定：openai 协议的 adapter 会在末尾拼 /chat/completions，
// 因此这里填到版本路径为止（如 .../v1），不带尾斜杠
export const PRESETS: ProviderPreset[] = [
  // ── 国内云 ──
  {
    id: 'deepseek',
    docs: 'https://api-docs.deepseek.com/',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    label: 'DeepSeek',
    provider: 'openai',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  },
  {
    id: 'kimi',
    docs: 'https://platform.moonshot.cn/docs',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    label: 'Kimi（月之暗面）',
    provider: 'openai',
    baseURL: 'https://api.moonshot.cn/v1',
    endpoints: [
      { label: '中国大陆', url: 'https://api.moonshot.cn/v1' },
      { label: '国际', url: 'https://api.moonshot.ai/v1' },
    ],
    models: ['kimi-k2.6', 'kimi-k2.5'],
  },
  {
    id: 'qwen',
    docs: 'https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
    label: '通义千问 Qwen',
    provider: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    endpoints: [
      { label: '中国大陆', url: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
      { label: '国际', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
      { label: '美国', url: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1' },
    ],
    models: ['qwen3.6-plus', 'qwen3.7-max', 'qwen3.6-flash'],
  },
  {
    id: 'zhipu',
    docs: 'https://docs.bigmodel.cn/cn/guide/start/introduction',
    apiKeyUrl: 'https://bigmodel.cn/usercenter/proj-mgmt/apikeys',
    label: '智谱 GLM',
    provider: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    endpoints: [
      { label: '中国大陆', url: 'https://open.bigmodel.cn/api/paas/v4' },
      { label: '国际（Z.ai）', url: 'https://api.z.ai/api/paas/v4' },
    ],
    models: ['glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.7-flashx', 'glm-4.7-flash', 'glm-4.6'],
  },
  {
    id: 'doubao',
    docs: 'https://www.volcengine.com/docs/82379',
    apiKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    label: '豆包（火山引擎）',
    provider: 'openai',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    endpoints: [
      { label: '标准', url: 'https://ark.cn-beijing.volces.com/api/v3' },
      { label: 'Coding Plan', url: 'https://ark.cn-beijing.volces.com/api/coding/v3' },
    ],
    models: [
      'doubao-seed-2-0-pro-260215',
      'doubao-seed-2-0-lite-260428',
      'doubao-seed-2-0-mini-260428',
    ],
  },
  {
    id: 'minimax',
    docs: 'https://platform.minimax.io/docs/api-reference/text-chat',
    apiKeyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key',
    label: 'MiniMax',
    provider: 'openai',
    baseURL: 'https://api.minimaxi.com/v1',
    endpoints: [
      { label: '中国大陆', url: 'https://api.minimaxi.com/v1' },
      { label: '国际', url: 'https://api.minimax.io/v1' },
    ],
    models: ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5'],
  },
  {
    id: 'mimo',
    docs: 'https://platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api',
    apiKeyUrl: 'https://platform.xiaomimimo.com/#/console/api-keys',
    label: '小米 MiMo',
    provider: 'openai',
    // 按量付费与 Token Plan 走不同域名、不同格式的 Key（sk-/tp-），不可混用
    baseURL: 'https://api.xiaomimimo.com/v1',
    endpoints: [
      { label: '按量付费', url: 'https://api.xiaomimimo.com/v1' },
      { label: 'Token Plan（中国）', url: 'https://token-plan-cn.xiaomimimo.com/v1' },
      { label: 'Token Plan（新加坡）', url: 'https://token-plan-sgp.xiaomimimo.com/v1' },
      { label: 'Token Plan（欧洲）', url: 'https://token-plan-ams.xiaomimimo.com/v1' },
    ],
    models: ['mimo-v2.5', 'mimo-v2.5-pro'],
  },
  {
    id: 'hunyuan',
    docs: 'https://cloud.tencent.com/document/product/1729/111007',
    apiKeyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    label: '腾讯混元',
    provider: 'openai',
    baseURL: 'https://api.hunyuan.cloud.tencent.com/v1',
    models: [
      'hunyuan-turbos-latest',
      'hunyuan-2.0-thinking-20251109',
      'hunyuan-2.0-instruct-20251111',
      'hunyuan-t1-latest',
      'hunyuan-lite',
    ],
  },
  {
    id: 'ernie',
    docs: 'https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya',
    apiKeyUrl: 'https://console.bce.baidu.com/iam/#/iam/apikey/list',
    label: '百度文心（千帆）',
    provider: 'openai',
    baseURL: 'https://qianfan.baidubce.com/v2',
    models: [
      'ernie-5.1',
      'ernie-5.0',
      'ernie-5.0-thinking-latest',
      'ernie-4.5-turbo-128k-preview',
    ],
  },
  // ── 聚合 / 网关 ──
  {
    id: 'openrouter',
    docs: 'https://openrouter.ai/models?q=free',
    apiKeyUrl: 'https://openrouter.ai/settings/keys',
    label: 'OpenRouter（聚合）',
    provider: 'openai',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      'anthropic/claude-sonnet-4.6',
      'google/gemini-3.5-flash',
      'deepseek/deepseek-v4-flash',
      'moonshotai/kimi-k2.6',
      'openai/gpt-5.4-mini',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'poolside/laguna-m.1:free',
    ],
  },
  {
    id: 'siliconflow',
    docs: 'https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions',
    apiKeyUrl: 'https://cloud.siliconflow.cn/me/account/ak',
    label: '硅基流动 SiliconFlow',
    provider: 'openai',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: [
      'deepseek-ai/DeepSeek-V4-Flash',
      'deepseek-ai/DeepSeek-V4-Pro',
      'moonshotai/Kimi-K2.6',
      'zai-org/GLM-5.1',
      'minimax/MiniMax-M2.5',
    ],
  },
  {
    id: 'github',
    docs: 'https://docs.github.com/en/github-models',
    apiKeyUrl: 'https://github.com/settings/personal-access-tokens',
    label: 'GitHub Models',
    provider: 'openai',
    baseURL: 'https://models.github.ai/inference',
    models: [
      'openai/gpt-4.1-mini',
      'openai/gpt-4o-mini',
      'openai/gpt-4.1',
      'meta/llama-3.3-70b-instruct',
      'microsoft/phi-4',
    ],
  },
  {
    id: 'nvidia',
    docs: 'https://build.nvidia.com/explore/discover',
    apiKeyUrl: 'https://build.nvidia.com/',
    label: 'Nvidia NIM',
    provider: 'openai',
    baseURL: 'https://integrate.api.nvidia.com/v1',
    models: [
      'deepseek-ai/deepseek-v4-flash',
      'deepseek-ai/deepseek-v4-pro',
      'z-ai/glm-5.1',
      'nvidia/nemotron-3-super-120b-a12b',
      'meta/llama-3.1-70b-instruct',
    ],
  },
  {
    id: 'together',
    docs: 'https://docs.together.ai/docs/chat-overview',
    apiKeyUrl: 'https://api.together.ai/settings/api-keys',
    label: 'Together AI',
    provider: 'openai',
    baseURL: 'https://api.together.xyz/v1',
    models: ['deepseek-ai/DeepSeek-V3.1', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'],
  },
  {
    id: 'fireworks',
    docs: 'https://docs.fireworks.ai/api-reference/post-chatcompletions',
    apiKeyUrl: 'https://app.fireworks.ai/settings/users/api-keys',
    label: 'Fireworks AI',
    provider: 'openai',
    baseURL: 'https://api.fireworks.ai/inference/v1',
    models: [
      'accounts/fireworks/models/deepseek-v3',
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
    ],
  },
  // ── 国际厂商 ──
  {
    id: 'openai',
    docs: 'https://developers.openai.com/api/docs/guides/text',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    label: 'OpenAI',
    provider: 'openai',
    baseURL: 'https://api.openai.com/v1',
    models: ['gpt-5.4-mini', 'gpt-5.5', 'gpt-5.4'],
  },
  {
    id: 'anthropic',
    docs: 'https://platform.claude.com/docs/en/intro',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    label: 'Anthropic Claude',
    provider: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    models: ['claude-sonnet-4-6', 'claude-opus-4-8', 'claude-haiku-4-5-20251001'],
  },
  {
    id: 'gemini',
    docs: 'https://ai.google.dev/gemini-api/docs/text-generation',
    apiKeyUrl: 'https://aistudio.google.com/app/api-keys',
    label: 'Google Gemini',
    provider: 'gemini',
    baseURL: 'https://generativelanguage.googleapis.com',
    models: ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
  },
  {
    id: 'grok',
    docs: 'https://docs.x.ai/docs/models',
    apiKeyUrl: 'https://console.x.ai/',
    label: 'xAI Grok',
    provider: 'openai',
    baseURL: 'https://api.x.ai/v1',
    models: ['grok-4.3', 'grok-4.20-0309-reasoning', 'grok-4.20-0309-non-reasoning'],
  },
  {
    id: 'mistral',
    docs: 'https://docs.mistral.ai/api/',
    apiKeyUrl: 'https://console.mistral.ai/api-keys',
    label: 'Mistral',
    provider: 'openai',
    baseURL: 'https://api.mistral.ai/v1',
    models: ['mistral-medium-3-5', 'mistral-small-4', 'mistral-large-3', 'ministral-3-14b'],
  },
  {
    id: 'groq',
    docs: 'https://console.groq.com/docs/text-chat',
    apiKeyUrl: 'https://console.groq.com/keys',
    label: 'Groq',
    provider: 'openai',
    baseURL: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
  },
  {
    id: 'perplexity',
    docs: 'https://docs.perplexity.ai/api-reference/chat-completions-post',
    apiKeyUrl: 'https://www.perplexity.ai/account/api/keys',
    label: 'Perplexity',
    provider: 'openai',
    baseURL: 'https://api.perplexity.ai',
    models: ['sonar', 'sonar-pro', 'sonar-reasoning-pro'],
  },
  {
    id: 'cohere',
    docs: 'https://docs.cohere.com/docs/compatibility-api',
    apiKeyUrl: 'https://dashboard.cohere.com/api-keys',
    label: 'Cohere',
    provider: 'openai',
    baseURL: 'https://api.cohere.ai/compatibility/v1',
    models: ['command-a-plus-05-2026', 'command-a-03-2025', 'command-a-reasoning-08-2025'],
  },
  // ── 本地 / 自建 ──
  {
    id: 'ollama',
    docs: 'https://docs.ollama.com/openai',
    label: 'Ollama（本地）',
    provider: 'openai',
    baseURL: 'http://localhost:11434/v1',
    models: ['qwen3', 'llama3.3', 'deepseek-r1'],
  },
  {
    id: 'lmstudio',
    docs: 'https://lmstudio.ai/docs/app/api/endpoints/openai',
    label: 'LM Studio（本地）',
    provider: 'openai',
    baseURL: 'http://127.0.0.1:1234/v1',
    models: [],
  },
  {
    id: 'llamacpp',
    docs: 'https://github.com/ggml-org/llama.cpp/tree/master/tools/server',
    label: 'llama.cpp（本地）',
    provider: 'openai',
    baseURL: 'http://127.0.0.1:8080/v1',
    models: [],
  },
  {
    id: 'litellm',
    docs: 'https://docs.litellm.ai/docs/',
    label: 'LiteLLM（自建网关）',
    provider: 'openai',
    baseURL: 'http://127.0.0.1:4000/v1',
    models: [],
  },
  {
    id: 'custom',
    label: '自定义（OpenAI 兼容协议）',
    provider: 'openai',
    baseURL: '',
    models: [],
  },
]

export function findPreset(id: string | undefined): ProviderPreset | undefined {
  return PRESETS.find((p) => p.id === id)
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
      ? findPreset('custom')!
      : PRESETS.find((p) => p.provider === provider)!)
  )
}

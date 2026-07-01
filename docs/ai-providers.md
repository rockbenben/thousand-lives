# 配置 AI

> 返回 [README](../README.md) · 相关：[剧本格式](scenario-format.md) · [玩法机制](gameplay.md)

设置页内置 28 个服务商预设（可搜索），选择后自动填好 Base URL 与推荐模型，只需再填 API Key；模型同样可搜索，也可直接输入任意模型名。

## 预设服务商

- **国内云**：DeepSeek · Kimi · 通义千问 · 智谱 GLM · 豆包 · MiniMax · 小米 MiMo · 腾讯混元 · 百度文心
- **聚合 / 网关**：OpenRouter · 硅基流动 · GitHub Models · Nvidia NIM · Together AI · Fireworks AI
- **国际厂商**：OpenAI · Claude · Gemini · Grok · Mistral · Groq · Perplexity · Cohere
- **本地 / 自建**：Ollama · LM Studio · llama.cpp · LiteLLM

## 底层协议

| 协议 | 默认 Base URL | 说明 |
|------|--------------|------|
| OpenAI 兼容 | `https://api.openai.com/v1` | 绝大多数云服务商与本地推理均兼容 |
| Anthropic Claude | `https://api.anthropic.com` | 支持浏览器直连 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Google AI Studio |

## 安全说明

API Key 仅保存在本地浏览器的 `localStorage` 中，请求从浏览器直接发往 AI 服务商，不经过任何第三方中转。

> **提示：** 若某 OpenAI 兼容服务不支持浏览器跨域（CORS），可改用 OpenRouter 等支持浏览器直接调用的代理服务。

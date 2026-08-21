# 配置 AI

> 返回 [README](../README.md) · 相关：[剧本格式](scenario-format.md) · [玩法机制](gameplay.md)

不填 Key 也能玩内置剧本；填了才换成大模型现场编。入口在右上角 ☰ → 设置。

设置页内置 24 个服务商预设（可搜索），选中后自动填好 Base URL 与推荐模型，只需再填 API Key；模型同样可搜索，也可直接输入任意模型名。

## 预设服务商

清单由 `src/ai/providerCatalog.generated.ts`（同步脚本整份重写）派生，下拉里就是这四组：

- **国内厂商**：DeepSeek · 通义千问 Qwen · Kimi（月之暗面）· 豆包（火山引擎）· 小米 MiMo · 智谱 GLM · MiniMax · 阶跃星辰 StepFun · 百度文心（千帆）· TokenHub（腾讯）
- **国际厂商**：OpenAI · Anthropic Claude · Google Gemini · Mistral · xAI Grok · Cohere
- **聚合 / 自建**：OpenRouter · OpenCode Zen · Groq · Cerebras · 硅基流动 SiliconFlow · AtlasCloud · Nvidia NIM
- **自定义（OpenAI 兼容协议）**：Ollama · LM Studio · llama.cpp · LiteLLM · Together AI · Fireworks AI 都填这一项 —— 它们只是地址不同的 OpenAI 兼容端点，Base URL 那一栏点一下就能填上；本地服务通常不需要 API Key。

## 底层协议

| 协议 | 默认 Base URL | 说明 |
|------|--------------|------|
| OpenAI 兼容 | `https://api.openai.com/v1` | 绝大多数云服务商与本地推理均兼容 |
| Anthropic Claude | `https://api.anthropic.com` | 支持浏览器直连 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Google AI Studio |

## 安全说明

API Key 仅保存在本地浏览器的 `localStorage` 中，绝大多数服务商的请求从浏览器**直发**，不经第三方。

### CORS 中转

少数服务商不给浏览器发跨域（CORS）响应头，直连在浏览器里根本发不出去。当前是 **OpenCode Zen、TokenHub（腾讯）、Nvidia NIM** 这三家：设置里会标成「必须开」，中转默认就是打开的。它做的事只有一件：把请求原样转发到服务商，再把响应带回来。

- **开了之后，你的 API Key 与完整 prompt 会经过这台中转再到服务商。** 这是「经过」，不是「留存」：那台 Worker 是纯透传（`fetch(目标, { headers, body })`），没有日志、不写任何存储；而且只转发白名单里声明过的服务商域名，不是开放代理。
- 不放心就换成自己的：设置里把地址改掉即可。部署步骤与 Worker 源码见 [legend-talk 的「CORS 中转」一节](https://github.com/rockbenben/legend-talk/blob/main/README.zh.md#cors-%E4%B8%AD%E8%BD%AC) —— 两个项目共用同一台，源码只维护一份。（那一节里列的默认开启服务商是 legend-talk 自己的清单，与本项目不同；要看的是部署步骤。）
- 只用直连的服务商（OpenAI / Claude / Gemini / DeepSeek 等绝大多数）不受影响，这一栏保持关闭。

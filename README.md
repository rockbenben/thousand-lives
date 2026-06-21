# 千世书 · thousand-lives

> 繁體中文 → [README.zh-TW.md](README.zh-TW.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org/)

> 365 开源计划 #015 · AI 驱动的文字人生模拟器 — 一卷千世，活过千种人生

**10 个剧本 · 28 家 AI 服务商预设 · 61 枚成就 · 纯前端 · 无需 Key 即玩**

🎮 **[在线体验](https://lives.newzone.top)**

![千世书](public/og.jpg)

---

## 目录

- [是什么](#是什么)
- [快速开始](#快速开始)
- [配置 AI](#配置-ai)
- [自定义剧本](#自定义剧本)
- [玩法机制](#玩法机制)
- [开发](#开发)
- [License](#license)

---

## 是什么

**千世书**是一款完全运行在浏览器中的 AI 文字人生模拟器，无需后端、无需服务器。

- **剧本（JSON）** 定义世界观、属性与结局规则
- **AI** 负责每回合生成剧情叙事与 3～4 个带数值影响的选项
- **引擎** 负责结算属性、判定结局、管理上下文压缩

内置 **10 个剧本**，覆盖仙侠、穿越、武侠、三国、末世、官场、谍战、科幻等题材，每个均自带本地事件池，**无需 API Key 即可试玩**：

| 剧本 | 题材 | 简介 |
|------|------|------|
| ⛰️ 缥缈仙途 | 仙侠 | 凡人踏入修真之门，于宗门倾轧与雷劫心魔间求一线长生 |
| 📖 穿书逆袭 | 穿越 | 穿成狗血虐文里第三章就领盒饭的炮灰配角，亲手改写原著结局 |
| ⚔️ 快意江湖 | 武侠 | 提一柄缺口旧刀闯荡江湖，从无名小卒走到一代大侠 |
| 🐉 乱世谋臣 | 三国 | 汉末群雄并起，一介谋士凭一笔一舌择主、献策、定鼎天下 |
| ☢️ 末世求生 | 末世 | 病毒爆发后的现代废土，三年间从苟活到重建据点、君临一方 |
| 🏯 宦海浮沉 | 官场 | 新科进士踏入官场，于党争、考成与皇权之间步步为营 |
| 🕵️ 孤岛谍影 | 谍战 | 1940 年上海孤岛，在日伪、租界与重庆三方夹缝中潜伏传情 |
| 🚀 群星彼端 | 科幻 | 随世代殖民舰驶向三十光年外，守护人类最后的火种 |
| 🏴‍☠️ 怒海争锋 | 航海 | 大航海时代，驾你的第一艘船在宝藏与风暴间搏一个王座 |
| 🎭 梨园浮梦 | 民国 | 民国戏园里苦熬出头的伶人，在乱世粉墨春秋间浮沉 |

除内置剧本外，还可**用一句主题让 AI 现场生成新剧本**，或导入社区自制的 JSON 剧本——详见 [自定义剧本](#自定义剧本)。

---

## 快速开始

**环境要求：** Node.js ≥ 18

```bash
npm install
npm run dev
# 访问 http://localhost:5173
```

**生产部署：**

```bash
npm run build
# 将 dist/ 目录部署到任意静态托管：GitHub Pages / Vercel / Cloudflare Pages
```

纯静态站点，`vite base: './'` 走相对路径，可部署到任意子路径。

---

## 配置 AI

设置页内置 28 个服务商预设（可搜索），选择后自动填好 Base URL 与推荐模型，只需再填 API Key；模型同样可搜索，也可直接输入任意模型名：

- **国内云**：DeepSeek · Kimi · 通义千问 · 智谱 GLM · 豆包 · MiniMax · 小米 MiMo · 腾讯混元 · 百度文心
- **聚合 / 网关**：OpenRouter · 硅基流动 · GitHub Models · Nvidia NIM · Together AI · Fireworks AI
- **国际厂商**：OpenAI · Claude · Gemini · Grok · Mistral · Groq · Perplexity · Cohere
- **本地 / 自建**：Ollama · LM Studio · llama.cpp · LiteLLM

底层支持三种协议：

| 协议 | 默认 Base URL | 说明 |
|------|--------------|------|
| OpenAI 兼容 | `https://api.openai.com/v1` | 绝大多数云服务商与本地推理均兼容 |
| Anthropic Claude | `https://api.anthropic.com` | 支持浏览器直连 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Google AI Studio |

**安全说明：** API Key 仅保存在本地浏览器的 `localStorage` 中，请求从浏览器直接发往 AI 服务商，不经过任何第三方中转。

> **提示：** 若某 OpenAI 兼容服务不支持浏览器跨域（CORS），可改用 OpenRouter 等支持浏览器直接调用的代理服务。

---

## 自定义剧本

获得新剧本有两条路：**让 AI 生成**（最省事）或**手写 / 导入 JSON**。

### AI 生成新剧本

首页点击「✨ AI 生成剧本」，填入一个主题（如「赛博朋克侦探 / 荒岛求生 / 大唐长安」），AI 会为你设计属性、状态分段、结局规则与上百条本地支线，生成后直接加入剧本库——**自带事件池，无需 Key 也能本地试玩**。

### 剧本 JSON 示例

也可按下方 schema 手写剧本，再从首页导入：

```json
{
  "id": "my-scenario",
  "title": "荒岛漂流",
  "emoji": "🏝️",
  "intro": "飞机失事，你独自漂上一座无人荒岛。求生还是等待救援？",
  "attributes": [
    { "key": "hp",     "name": "体力", "initial": 80, "max": 100, "deathBelow": 0 },
    { "key": "morale", "name": "士气", "initial": 60, "max": 100, "deathBelow": 0 }
  ],
  "openings": [
    { "name": "户外探险家", "prompt": "有丰富野外生存经验，擅长搭建庇护所与寻找食物。" },
    { "name": "普通上班族", "prompt": "没有特殊技能，但意志力顽强，善于观察与学习。" }
  ],
  "turnUnit": "天",
  "maxTurns": 20,
  "systemPrompt": "你是一个荒岛求生文字游戏的主持人。风格写实，每天都充满挑战。",
  "endings": [
    { "condition": "maxTurns", "tone": "获救" },
    { "condition": "hp<=0",    "tone": "力竭死亡" },
    { "condition": "morale<=0","tone": "绝望放弃" },
    { "condition": "hp>=90",   "tone": "体魄极佳、精神振奋地获救" }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，不能与内置剧本的 id 相同（`xian` / `book` / `wuxia` / `sanguo` / `wasteland` / `officialdom` / `spy` / `scifi` / `voyage` / `liyuan`） |
| `title` | string | 剧本名称 |
| `emoji` | string | 剧本图标 |
| `intro` | string | 开场介绍文字 |
| `attributes` | array | 属性列表（至少 1 个） |
| `openings` | array? | 可选的开局身份列表，每项含 `name` 和 `prompt` |
| `turnUnit` | string | 回合单位名称，默认 `"回合"` |
| `maxTurns` | integer | 最大回合数（正整数） |
| `systemPrompt` | string | 给 AI 的系统提示词，定义 GM 风格与规则 |
| `endings` | array | 结局列表（至少 1 个） |
| `ambitions` | array? | 可选，建议的「目标/野心」文本列表，玩家可选或自填 |
| `localEvents` | array? | 可选，本地事件池；提供后该剧本支持「无需 Key」本地试玩模式 |

**localEvents 子字段**（每个事件含 `narrative` 正文、`choices`（`text` + `effects`）、`summary`；可选 `minTurn`/`maxTurn` 回合区间、`once` 仅触发一次、`weight` 抽取权重、`itemsGained`/`itemsLost` 物品）。

**attributes 子字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 小写字母开头的 ASCII 标识符（如 `hp`、`sanity`） |
| `name` | string | 属性显示名 |
| `initial` | number | 初始值，必须在 `[0, max]` 范围内 |
| `max` | number | 最大值（正数） |
| `deathBelow` | number? | 可选，属性值 ≤ 此值时触发死亡结局 |
| `bands` | array? | 可选，命名状态分段（见下表） |

**bands 子字段**（按 `upTo` 严格升序排列）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `upTo` | number | 该状态段的上界（含） |
| `label` | string | 状态名（如「濒临崩溃」） |
| `severity` | string? | `critical` / `low` / `normal` / `high`，决定配色与告警，默认 `normal` |
| `directive` | string? | 落入此段时注入给 AI 的硬指令，强制剧情据此改写 |

> 给关键属性写好 `bands` + `directive`（尤其 `critical`/`low` 段），是让数值「有体感」的核心——AI 会据状态改写叙事语气、限制或解锁选项。

**endings 子字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `condition` | string | 结局触发条件（见下方语法） |
| `tone` | string | 结局基调，传给 AI 生成结局文字 |

### 条件语法

- `maxTurns` — 达到最大回合数
- `attr<=N` — 某属性值 ≤ N（如 `hp<=0`）
- `attr>=N` — 某属性值 ≥ N（如 `sanity>=95`）
- `has(印记)` — 持有某状态印记（开局身份或晋阶解锁的 flag）
- `&` 串联多个条件（如 `maxTurns & has(营地) & supplies>=70`）

> 结局判定**取所有满足条件中最具体的那个**（更严格的条件自动胜出，作者无需手工排序防遮蔽）；仅当多个满足条件互不蕴含时，才按数组顺序取靠前者。
>
> **死亡结局可写多条同条件的并列死法**（如多个 `hp<=0`，基调各异：饿毙 / 渴死 / 病亡…）：引擎先按上述 salience 取最具体，再在同等具体的并列死法里**随机取一**，使数值相同也死得不同（仅 AI 模式启用随机，本地确定性回放取首个）。

### 进阶字段（内置剧本用，写自定义剧本可选；完整规范以 `src/scenarios/schema.ts` 为准）

- **属性**：`ceiling` + `ceilingUnlocks:[{flag,max}]`（机缘封顶：上限冻结在 base，持印记后逐级抬高，造「晋阶」纵深）、`decayPerTurn`（每回合自动衰减）。
- **开局**：`openings[].flag`（注入身份印记，门控专属事件/结局）；剧本级 `tierLabel`（晋阶用词，如「境界/据点/官阶」）、`ambitions`（目标池）。
- **事件**：`keyMoment`（命运抉择大节点，配剧情大卡 + gemini 专属图）、`requires`/`requiresItem`（门控）、`once`/`weight`/`minTurn`/`maxTurn`/`wildcard`（奇遇乱入）；选项可带 `outcomes:[{weight,effects,flagsSet,itemsGained,endTone}]`（加权分支 + 隐藏彩蛋结局）、`reaction`（他人即时反馈）。
- **结局**：`epilogue`（本地模式专属尾声）；`art`（稳定配图 id，改文案不丢图）+ `gen`（`flux`/`gemini`，出图方式标注）。

### 导入方法

在首页点击「导入剧本」，上传 JSON 文件即可。剧本通过 Zod schema 校验，格式错误时会给出提示。

---

## 玩法机制

**叙事 & 决策**
- **状态分段**：属性按数值落入命名状态（如理智「清醒 / 动摇 / 濒临崩溃」），以文字+配色显示，同时作为硬指令注入 AI——理智崩溃必现幻觉，数字改变你看到的故事
- **明牌决策**：每个选项直接展示属性影响（如「生命 -10 / 物资 +5」），选择是权衡而非盲猜
- **部分执行**：任何选项都能尝试，当前状态决定它达成到什么程度——状态差则同一行动只能勉力完成，收益缩水、代价加重
- **突发起伏**：属性进入危急时开场呈现突发危机，高位属性偶尔带来转机，节奏不再平铺

**系统深度**
- **行囊系统**：剧情中获得/消耗的道具进入行囊，并回灌给 AI 作为后续选项依据，形成跨回合因果
- **自定义行动**：选项之外可「自己写一个行动」，由 AI 按部分执行裁定其属性影响——从「选答案」变成「我说了算」
- **AI 托管**：一键「托管」，由 AI 依角色身份与目标自动替你抉择、自动演进，可随时接管
- **存档管理**：支持自动续玩、手动命名存档、导出/导入 JSON（便于跨浏览器/设备迁移）

**Meta 游戏**
- **结局卡 + 称号评级**：每局评出 S～D 评级与专属称号，一键导出图片结局卡（墨与朱砂主题）或文字版分享
- **命途留影**：走过的每个命运抉择节点汇成可回溯的剧情卡相册，关键节点配专属插画，一局即是一本命运图册
- **结局图鉴**：累计记录每个剧本见过的结局，未解锁显示为「？？？」，激励重开探索不同命运
- **成就系统**：61 枚成就，覆盖局数里程碑、结局收集、S 评级、各剧本通关与传说结局、无伤通关、剧本创作等维度

**技术亮点**
- **流式叙事**：剧情正文随 AI 生成逐字呈现（SSE），无需等待完整响应；退出对局会真正中断在途请求
- **上下文压缩**：最近 3 回合保留原文，更早的自动滚动压缩为摘要，30 回合也不会超出 token 限制
- **本地试玩**：内置剧本自带事件池，无 Key 即点即玩，每局不同；填入 Key 则切换为大模型实时驱动模式
- **容错重试**：AI 输出格式不合法时自动纠错并重试，引擎状态在拿到合法结果前绝不推进

---

## 开发

```bash
npm test       # 运行 Vitest 单元测试（覆盖 engine / AI 层）
npm run build  # TypeScript 类型检查 + Vite 打包
npm run dev    # 启动开发服务器（热更新）
```

### 目录结构

```
src/
├── engine/      # 核心引擎：属性结算、状态分段、结局判定、评级、关键抉择、上下文压缩、成就、本地引擎
├── ai/          # AI 适配层：三协议适配器、服务商预设、回合生成、剧本生成、重试与 JSON 纠错
├── scenarios/   # 剧本：schema 校验（Zod）+ 10 个内置剧本数据（含本地事件池）
├── ui/          # React 界面：主页 / 游戏页 / 设置 / 结局卡 / 命途留影 / 成就 / AI 生成弹窗
├── assets/      # 内置剧本封面、结局图、节点插画、成就徽章（webp）
├── storage.ts   # localStorage 存档与设置读写
└── App.tsx      # 路由与全局状态
```

---

## License

[MIT](LICENSE) © [rockbenben](https://github.com/rockbenben)

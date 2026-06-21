# 千世書 · thousand-lives

> 简体中文 → [README.md](README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-brightgreen)](https://nodejs.org/)

> 365 開源計畫 #015 · AI 驅動的文字人生模擬器 — 一本書，活過千種人生

**10 個劇本 · 28 家 AI 服務商預設 · 61 枚成就 · 純前端 · 無需 Key 即玩**

🎮 **[線上體驗](https://lives.newzone.top)**

![千世書](public/og.jpg)

---

## 目錄

- [是什麼](#是什麼)
- [快速開始](#快速開始)
- [設定 AI](#設定-ai)
- [自訂劇本](#自訂劇本)
- [玩法機制](#玩法機制)
- [開發](#開發)
- [License](#license)

---

## 是什麼

**千世書**是一款完全執行於瀏覽器中的 AI 文字人生模擬器，無需後端、無需伺服器。

- **劇本（JSON）** 定義世界觀、屬性與結局規則
- **AI** 負責每回合生成劇情敘事與 3～4 個帶數值影響的選項
- **引擎** 負責結算屬性、判定結局、管理上下文壓縮

內建 **10 個劇本**，涵蓋仙俠、穿越、武俠、三國、末世、官場、諜戰、科幻等題材，每個均自帶本地事件池，**無需 API Key 即可試玩**：

| 劇本 | 題材 | 簡介 |
|------|------|------|
| ⛰️ 縹緲仙途 | 仙俠 | 凡人踏入修真之門，於宗門傾軋與雷劫心魔間求一線長生 |
| 📖 穿書逆襲 | 穿越 | 穿成狗血虐文裡第三章就領便當的炮灰配角，親手改寫原著結局 |
| ⚔️ 快意江湖 | 武俠 | 提一柄缺口舊刀闖蕩江湖，從無名小卒走到一代大俠 |
| 🐉 亂世謀臣 | 三國 | 漢末群雄並起，一介謀士憑一筆一舌擇主、獻策、定鼎天下 |
| ☢️ 末世求生 | 末世 | 病毒爆發後的現代廢土，三年間從苟活到重建據點、君臨一方 |
| 🏯 宦海浮沉 | 官場 | 新科進士踏入官場，於黨爭、考成與皇權之間步步為營 |
| 🕵️ 孤島諜影 | 諜戰 | 1940 年上海孤島，在日偽、租界與重慶三方夾縫中潛伏傳情 |
| 🚀 群星彼端 | 科幻 | 隨世代殖民艦駛向三十光年外，守護人類最後的火種 |
| 🏴‍☠️ 怒海爭鋒 | 航海 | 大航海時代，駕你的第一艘船在寶藏與風暴間搏一個王座 |
| 🎭 梨園浮夢 | 民國 | 民國戲園裡苦熬出頭的伶人，在亂世粉墨春秋間浮沉 |

除內建劇本外，還可**用一句主題讓 AI 現場生成新劇本**，或匯入社群自製的 JSON 劇本——詳見 [自訂劇本](#自訂劇本)。

---

## 快速開始

**環境需求：** Node.js ≥ 18

```bash
npm install
npm run dev
# 訪問 http://localhost:5173
```

**正式部署：**

```bash
npm run build
# 將 dist/ 目錄部署到任意靜態託管：GitHub Pages / Vercel / Cloudflare Pages
```

純靜態站點，`vite base: './'` 走相對路徑，可部署到任意子路徑。

---

## 設定 AI

設定頁內建 28 個服務商預設（可搜尋），選擇後自動填好 Base URL 與推薦模型，只需再填 API Key；模型同樣可搜尋，也可直接輸入任意模型名：

- **國內雲**：DeepSeek · Kimi · 通義千問 · 智譜 GLM · 豆包 · MiniMax · 小米 MiMo · 騰訊混元 · 百度文心
- **聚合 / 閘道**：OpenRouter · 矽基流動 · GitHub Models · Nvidia NIM · Together AI · Fireworks AI
- **國際廠商**：OpenAI · Claude · Gemini · Grok · Mistral · Groq · Perplexity · Cohere
- **本地 / 自建**：Ollama · LM Studio · llama.cpp · LiteLLM

底層支援三種協定：

| 協定 | 預設 Base URL | 說明 |
|------|--------------|------|
| OpenAI 相容 | `https://api.openai.com/v1` | 絕大多數雲服務商與本地推理均相容 |
| Anthropic Claude | `https://api.anthropic.com` | 支援瀏覽器直連 |
| Google Gemini | `https://generativelanguage.googleapis.com` | Google AI Studio |

**安全說明：** API Key 僅儲存於本地瀏覽器的 `localStorage` 中，請求從瀏覽器直接發往 AI 服務商，不經過任何第三方中轉。

> **提示：** 若某 OpenAI 相容服務不支援瀏覽器跨域（CORS），可改用 OpenRouter 等支援瀏覽器直接呼叫的代理服務。

---

## 自訂劇本

獲得新劇本有兩條路：**讓 AI 生成**（最省事）或**手寫 / 匯入 JSON**。

### AI 生成新劇本

首頁點擊「✨ AI 生成劇本」，填入一個主題（如「賽博龐克偵探 / 荒島求生 / 大唐長安」），AI 會為你設計屬性、狀態分段、結局規則與上百條本地支線，生成後直接加入劇本庫——**自帶事件池，無需 Key 也能本地試玩**。

### 劇本 JSON 範例

也可按下方 schema 手寫劇本，再從首頁匯入：

```json
{
  "id": "my-scenario",
  "title": "荒島漂流",
  "emoji": "🏝️",
  "intro": "飛機失事，你獨自漂上一座無人荒島。求生還是等待救援？",
  "attributes": [
    { "key": "hp",     "name": "體力", "initial": 80, "max": 100, "deathBelow": 0 },
    { "key": "morale", "name": "士氣", "initial": 60, "max": 100, "deathBelow": 0 }
  ],
  "openings": [
    { "name": "戶外探險家", "prompt": "有豐富野外生存經驗，擅長搭建庇護所與尋找食物。" },
    { "name": "普通上班族", "prompt": "沒有特殊技能，但意志力頑強，善於觀察與學習。" }
  ],
  "turnUnit": "天",
  "maxTurns": 20,
  "systemPrompt": "你是一個荒島求生文字遊戲的主持人。風格寫實，每天都充滿挑戰。",
  "endings": [
    { "condition": "maxTurns", "tone": "獲救" },
    { "condition": "hp<=0",    "tone": "力竭死亡" },
    { "condition": "morale<=0","tone": "絕望放棄" },
    { "condition": "hp>=90",   "tone": "體魄極佳、精神振奮地獲救" }
  ]
}
```

### 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | string | 唯一識別符，不能與內建劇本的 id 相同（`xian` / `book` / `wuxia` / `sanguo` / `wasteland` / `officialdom` / `spy` / `scifi` / `voyage` / `liyuan`） |
| `title` | string | 劇本名稱 |
| `emoji` | string | 劇本圖示 |
| `intro` | string | 開場介紹文字 |
| `attributes` | array | 屬性列表（至少 1 個） |
| `openings` | array? | 可選的開局身份列表，每項含 `name` 和 `prompt` |
| `turnUnit` | string | 回合單位名稱，預設 `"回合"` |
| `maxTurns` | integer | 最大回合數（正整數） |
| `systemPrompt` | string | 給 AI 的系統提示詞，定義 GM 風格與規則 |
| `endings` | array | 結局列表（至少 1 個） |
| `ambitions` | array? | 可選，建議的「目標/野心」文本列表，玩家可選或自填 |
| `localEvents` | array? | 可選，本地事件池；提供後該劇本支援「無需 Key」本地試玩模式 |

**localEvents 子欄位**（每個事件含 `narrative` 正文、`choices`（`text` + `effects`）、`summary`；可選 `minTurn`/`maxTurn` 回合區間、`once` 僅觸發一次、`weight` 抽取權重、`itemsGained`/`itemsLost` 物品）。

**attributes 子欄位：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `key` | string | 小寫字母開頭的 ASCII 識別符（如 `hp`、`sanity`） |
| `name` | string | 屬性顯示名 |
| `initial` | number | 初始值，必須在 `[0, max]` 範圍內 |
| `max` | number | 最大值（正數） |
| `deathBelow` | number? | 可選，屬性值 ≤ 此值時觸發死亡結局 |
| `bands` | array? | 可選，命名狀態分段（見下表） |

**bands 子欄位**（按 `upTo` 嚴格升序排列）：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `upTo` | number | 該狀態段的上界（含） |
| `label` | string | 狀態名（如「瀕臨崩潰」） |
| `severity` | string? | `critical` / `low` / `normal` / `high`，決定配色與告警，預設 `normal` |
| `directive` | string? | 落入此段時注入給 AI 的硬指令，強制劇情據此改寫 |

> 給關鍵屬性寫好 `bands` + `directive`（尤其 `critical`/`low` 段），是讓數值「有體感」的核心——AI 會據狀態改寫敘事語氣、限制或解鎖選項。

**endings 子欄位：**

| 欄位 | 類型 | 說明 |
|------|------|------|
| `condition` | string | 結局觸發條件（見下方語法） |
| `tone` | string | 結局基調，傳給 AI 生成結局文字 |

### 條件語法

- `maxTurns` — 達到最大回合數
- `attr<=N` — 某屬性值 ≤ N（如 `hp<=0`）
- `attr>=N` — 某屬性值 ≥ N（如 `sanity>=95`）
- `has(印記)` — 持有某狀態印記（開局身份或晉階解鎖的 flag）
- `&` 串聯多個條件（如 `maxTurns & has(營地) & supplies>=70`）

> 結局判定**取所有滿足條件中最具體的那個**（更嚴格的條件自動勝出，作者無需手工排序防遮蔽）；僅當多個滿足條件互不蘊含時，才按陣列順序取靠前者。
>
> **死亡結局可寫多條同條件的並列死法**（如多個 `hp<=0`，基調各異：餓斃 / 渴死 / 病亡…）：引擎先按上述 salience 取最具體，再在同等具體的並列死法裡**隨機取一**，使數值相同也死得不同（僅 AI 模式啟用隨機，本地確定性回放取首個）。

### 進階欄位（內建劇本用，寫自訂劇本可選；完整規範以 `src/scenarios/schema.ts` 為準）

- **屬性**：`ceiling` + `ceilingUnlocks:[{flag,max}]`（機緣封頂：上限凍結在 base，持印記後逐級抬高，造「晉階」縱深）、`decayPerTurn`（每回合自動衰減）。
- **開局**：`openings[].flag`（注入身份印記，門控專屬事件/結局）；劇本級 `tierLabel`（晉階用詞，如「境界/據點/官階」）、`ambitions`（目標池）。
- **事件**：`keyMoment`（命運抉擇大節點，配劇情大卡 + gemini 專屬圖）、`requires`/`requiresItem`（門控）、`once`/`weight`/`minTurn`/`maxTurn`/`wildcard`（奇遇亂入）；選項可帶 `outcomes:[{weight,effects,flagsSet,itemsGained,endTone}]`（加權分支 + 隱藏彩蛋結局）、`reaction`（他人即時反饋）。
- **結局**：`epilogue`（本地模式專屬尾聲）；`art`（穩定配圖 id，改文案不丟圖）+ `gen`（`flux`/`gemini`，出圖方式標註）。

### 匯入方法

在首頁點擊「匯入劇本」，上傳 JSON 檔案即可。劇本透過 Zod schema 校驗，格式錯誤時會給出提示。

---

## 玩法機制

**敘事 & 決策**
- **狀態分段**：屬性按數值落入命名狀態（如理智「清醒 / 動搖 / 瀕臨崩潰」），以文字+配色顯示，同時作為硬指令注入 AI——理智崩潰必現幻覺，數字改變你看到的故事
- **明牌決策**：每個選項直接展示屬性影響（如「生命 -10 / 物資 +5」），選擇是權衡而非盲猜
- **部分執行**：任何選項都能嘗試，當前狀態決定它達成到什麼程度——狀態差則同一行動只能勉力完成，收益縮水、代價加重
- **突發起伏**：屬性進入危急時開場呈現突發危機，高位屬性偶爾帶來轉機，節奏不再平鋪

**系統深度**
- **行囊系統**：劇情中獲得/消耗的道具進入行囊，並回灌給 AI 作為後續選項依據，形成跨回合因果
- **自訂行動**：選項之外可「自己寫一個行動」，由 AI 按部分執行裁定其屬性影響——從「選答案」變成「我說了算」
- **AI 託管**：一鍵「託管」，由 AI 依角色身份與目標自動替你抉擇、自動演進，可隨時接管
- **存檔管理**：支援自動續玩、手動命名存檔、匯出/匯入 JSON（便於跨瀏覽器/裝置遷移）

**Meta 遊戲**
- **結局卡 + 稱號評級**：每局評出 S～D 評級與專屬稱號，一鍵匯出圖片結局卡（墨與朱砂主題）或文字版分享
- **命途留影**：走過的每個命運抉擇節點匯成可回溯的劇情卡相冊，關鍵節點配專屬插畫，一局即是一本命運圖冊
- **結局圖鑑**：累計記錄每個劇本見過的結局，未解鎖顯示為「？？？」，激勵重開探索不同命運
- **成就系統**：61 枚成就，涵蓋局數里程碑、結局收集、S 評級、各劇本通關與傳說結局、無傷通關、劇本創作等維度

**技術亮點**
- **串流敘事**：劇情正文隨 AI 生成逐字呈現（SSE），無需等待完整回應；退出對局會真正中斷在途請求
- **上下文壓縮**：最近 3 回合保留原文，更早的自動滾動壓縮為摘要，30 回合也不會超出 token 限制
- **本地試玩**：內建劇本自帶事件池，無 Key 即點即玩，每局不同；填入 Key 則切換為大模型即時驅動模式
- **容錯重試**：AI 輸出格式不合法時自動糾錯並重試，引擎狀態在拿到合法結果前絕不推進

---

## 開發

```bash
npm test       # 執行 Vitest 單元測試（涵蓋 engine / AI 層）
npm run build  # TypeScript 型別檢查 + Vite 打包
npm run dev    # 啟動開發伺服器（熱更新）
```

### 目錄結構

```
src/
├── engine/      # 核心引擎：屬性結算、狀態分段、結局判定、評級、關鍵抉擇、上下文壓縮、成就、本地引擎
├── ai/          # AI 適配層：三協定適配器、服務商預設、回合生成、劇本生成、重試與 JSON 糾錯
├── scenarios/   # 劇本：schema 校驗（Zod）+ 10 個內建劇本資料（含本地事件池）
├── ui/          # React 介面：首頁 / 遊戲頁 / 設定 / 結局卡 / 命途留影 / 成就 / AI 生成彈窗
├── assets/      # 內建劇本封面、結局圖、節點插畫、成就徽章（webp）
├── storage.ts   # localStorage 存檔與設定讀寫
└── App.tsx      # 路由與全域狀態
```

---

## License

[MIT](LICENSE) © [rockbenben](https://github.com/rockbenben)

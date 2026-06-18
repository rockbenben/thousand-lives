# 千世书 · L2c：AI 模式吃下机缘体系

日期：2026-06-18
状态：设计已确认，待写实现计划
前置：L1 引擎、L2a（xian 配置）、L2b（xian 内容）均已合入 main。

## 1. 目标

让 **AI 驱动模式**也体现 xian 的机缘修仙愿景：AI GM 能在恰当时机授予印记（境界突破/因果）、触发隐藏天堂地狱结局，并按末法世界观与境界封顶规则演绎。引擎（L1）已会强制执行封顶/forceEnding/印记——本期是**让 AI 能产出这些字段 + 用 systemPrompt 指导它**。同时顺手修掉涌现剧本在 AI 提示里「共 undefined 载」的遗留 bug。

**非目标**：其他题材的 AI 改造（xian 先行，机制是共享的）；新引擎能力；本地模式（已在 L2a/b 完成）。

## 2. §1 AI 回合 schema（`src/ai/turn.ts`）

`choiceSchema` 增加三个可选、容错字段（沿用文件既有 `.catch` 容错风格，非法值不拖垮整回合解析）：
```ts
const choiceSchema = z.object({
  text: z.string().min(1),
  effects: z.record(z.string(), z.number()).default({}),
  flagsSet: z.array(z.string()).optional().catch(undefined),
  flagsClear: z.array(z.string()).optional().catch(undefined),
  endTone: z.string().optional().catch(undefined),
})
```
引擎 `applyChoice`（L1）已消费这些字段（写 flags、endTone 强制结局）。`TurnResult.Choice` 类型（L1 已含这些字段）无需改。tailSchema 的 choices 复用同一 `choicesField` 即自动获得。

## 3. §2 prompt 状态注入（`src/engine/prompt.ts`）

新增 `scenarioUsesFlags(sc)` = `sc.openings?.some(o => o.flag) || sc.attributes.some(a => a.ceilingUnlocks)`（xian=true，其余题材=false）。仅对 usesFlags 剧本注入下列段落，不污染其他题材：

- **【当前印记】**：直接列出 `st.flags`（如「筑基、正道追缉、魔道」）。让 AI 知道当前境界与在演的因果/身份。
- **【境界封顶】**：对带 `ceilingUnlocks` 的属性，注入「当前境界=X，修为上限 N（须真突破方能更进），寿元上限 M」。AI 据此不凭空越级；要让玩家进境，须在 JSON 里 `flagsSet:["下一境界"]`（境界印记名取自 `ceilingUnlocks[].flag`）。
- **可授予的印记 / 可触发的隐藏结局词表**：从剧本派生并写入契约——境界印记 = `ceilingUnlocks[].flag` 的并集（筑基/金丹/元婴/化神）；隐藏结局 endTone = `endings` 中 `condition==='lifespan<=-1'` 的 tone（误入杀阵·横死当场 等）。务必让 AI 用**精确字符串**（否则封顶不解锁/结局不命中）。

**修复涌现 header（bug）**：`buildTurnMessages` 第 86 行 `【第 X 载，共 ${sc.maxTurns} 载】`——当 `maxTurns===undefined` 时改为不写「共 N」，仅 `【第 X 载】`（避免「共 undefined 载」）。soft-cap 剧本（有 maxTurns）保持原样。

## 4. §3 契约扩展 + xian systemPrompt

**`formatContract`** 增参 `usesFlags` + 词表；usesFlags 时追加契约行（仅此情形，保持其他题材契约干净）：
- `- 可选 "flagsSet":["印记名"]`：仅在剧情中玩家真正达成境界突破/获得某身份际遇时授予；境界印记只能取：<境界词表>，且须按炼气→筑基→金丹→元婴→化神顺序、不得越级。
- `- 可选 "endTone":"结局基调"`：**极稀有**，仅当出现无视一切的横死凶险或泼天造化时用，使本回合即终局；可取的隐藏基调：<endTone 词表>（须精确）。天威难测，绝大多数回合不应出现。

**xian `systemPrompt`** 在现有规则上补：末法/灵气衰微世界观（天才地宝稀缺、突破凶险、飞升百年难见）；境界封顶（修为到顶须真机缘方破，破时 flagsSet 境界印记）；寿元赛跑与续命（已有，强化）；身份贯穿（已有 opening）；隐藏天堂地狱（endTone 暴毙/造化须极稀有）。

## 5. §4 测试与验证

- **schema**（`turn.test.ts`）：含 flagsSet/flagsClear/endTone 的 AI JSON 能解析并保留；非法值（如 flagsSet 写成字符串）被 `.catch` 兜底为 undefined 而不抛、其余字段正常。
- **prompt**（`prompt.test.ts`）：xian 的 buildTurnMessages 含【当前印记】【境界封顶】与契约里的 flagsSet/endTone 说明；一个无 flag 的题材（如 wasteland）**不含**这些段落（门控正确）。
- **涌现 header**：xian（无 maxTurns）的 prompt **不含**「共 undefined」；一个有 maxTurns 的题材仍含「共 N」。
- **引擎强制**：L1 已测 applyChoice 消费 flags/endTone + clampEffects 封顶——本期不重测引擎。
- **AI 行为**：靠 systemPrompt + **人工 playtest**（无 sim）。playtest 三身份各一局，确认 AI 尊重封顶、在机缘处授境界、隐藏结局稀有不滥用。

## 6. 触点文件
- `src/ai/turn.ts`（choiceSchema 三字段）
- `src/engine/prompt.ts`（scenarioUsesFlags、印记/境界注入、formatContract 扩展、涌现 header 修复）
- `src/scenarios/xian.ts`（systemPrompt 扩写）
- 测试：`src/ai/turn.test.ts`、`src/engine/prompt.test.ts`

## 7. 成功标准
- AI JSON 的 flagsSet/flagsClear/endTone 被正确解析、容错；引擎据此授印记/强制结局。
- xian 的 AI 提示含印记+境界封顶+词表;其他题材不含;无「共 undefined 载」。
- playtest:AI 模式下 xian 体现机缘/封顶/寿元/身份/隐藏的愿景,暴毙不滥用。
- 全量 `vitest` + `tsc` 绿。

## 8. 风险
- **AI 滥用 endTone 暴毙** → 劝退。缓解:systemPrompt 明确「极稀有、仅真凶险/造化」;无 sim 守门,靠 playtest。若 playtest 显滥用,可在引擎侧加「endTone 早于第 N 回合则忽略」之类的护栏（留作后续，不在本期）。
- **AI 用错印记/基调字符串** → 封顶不解锁/结局不命中。缓解:契约给精确词表 + 顺序约束;错误字符串被引擎安全忽略（flags 只是没匹配的字符串、未知 endTone 仍会强制一个该 tone 的结局但无对应 epilogue → 回退通用模板）。
- **契约变长** → 仅对 usesFlags 剧本注入,其他题材不受影响。

## 9. 测试策略
- 单测覆盖 §5 的 schema/prompt/header/门控四类。
- 引擎消费不重测（L1 已覆盖）。
- 人工 playtest 作为 AI 行为的唯一验证手段，列入成功标准。

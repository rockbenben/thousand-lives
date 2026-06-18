# L2c：AI 模式吃下机缘体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 AI 驱动模式也能授印记/触发隐藏结局并按末法世界观演绎,并修掉涌现剧本「共 undefined 载」提示 bug。

**Architecture:** AI 回合 JSON schema(`turn.ts`)加 flagsSet/flagsClear/endTone;`prompt.ts` 按 `scenarioUsesFlags` 门控注入当前印记+境界封顶+派生词表并修复涌现 header;xian systemPrompt 扩写。引擎(L1)已强制执行。

**Tech Stack:** TypeScript、Zod、Vitest。

## Global Constraints

- 不改游戏引擎逻辑(`src/engine/state.ts` 等);仅改 AI 适配层(`src/ai/turn.ts`)、提示构建(`src/engine/prompt.ts`)、xian 内容(`src/scenarios/xian.ts`)。`prompt.ts` 属提示构建,允许改。
- 新 schema 字段可选 + `.catch` 容错(沿用 turn.ts 既有非必要字段风格),非法值不拖垮整回合解析。
- 印记/境界注入与扩展契约**仅对 `scenarioUsesFlags(sc)` 为真的剧本**(xian)生效,不污染其他题材。
- 涌现剧本(无 maxTurns)的提示**不得**出现「undefined」。
- 测试 Vitest(`npx vitest run`,21 文件单跑);提交前 `npx tsc --noEmit` 干净、全量绿。
- 提交信息以这两行结尾:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- 中文风格一致。

**派生词表定义**(Task 3/4 共用):境界印记 = 各属性 `ceilingUnlocks[].flag` 的并集(xian: 筑基/金丹/元婴/化神);隐藏 endTone = `sc.endings` 中 `condition==='lifespan<=-1'` 的 `tone`(xian: 误入杀阵·横死当场 等)。

---

## File Structure
- `src/ai/turn.ts` — `choiceSchema` 加 3 字段。
- `src/engine/prompt.ts` — `scenarioUsesFlags`、印记/境界注入、`formatContract` 扩展、涌现 header 修复。
- `src/scenarios/xian.ts` — systemPrompt 扩写。
- 测试:`src/ai/turn.test.ts`、`src/engine/prompt.test.ts`。

---

## Task 1: AI 回合 schema 加 flagsSet/flagsClear/endTone

**Files:** Modify `src/ai/turn.ts`；Test `src/ai/turn.test.ts`

**Interfaces:** Produces `choiceSchema` 接受可选 `flagsSet:string[]`、`flagsClear:string[]`、`endTone:string`,容错(非法→undefined)。`TurnResult.Choice`(L1 已含这些字段)无需改。

- [ ] **Step 1: 写失败测试** — 在 `src/ai/turn.test.ts` 加：

```ts
import { parseTurnResult } from './turn'

describe('AI 回合含印记/强制结局字段', () => {
  const wrap = (choice: object) => JSON.stringify({
    narrative: '你立于山门之前，灵气稀薄。',
    choices: [choice, { text: '另寻他途', effects: {} }],
    summary: '山门前',
  })
  it('flagsSet/flagsClear/endTone 被保留', () => {
    const r = parseTurnResult(wrap({ text: '凝结金丹', effects: { cultivation: 6 }, flagsSet: ['金丹'], endTone: '仙缘垂青·一步登天' }))
    expect(r.choices[0].flagsSet).toEqual(['金丹'])
    expect(r.choices[0].endTone).toBe('仙缘垂青·一步登天')
  })
  it('非法 flagsSet（字符串）被容错为 undefined，整回合仍解析', () => {
    const r = parseTurnResult(wrap({ text: 'x', effects: {}, flagsSet: '金丹' }))
    expect(r.choices[0].flagsSet).toBeUndefined()
    expect(r.choices.length).toBe(2)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/ai/turn.test.ts -t "印记"` → FAIL（字段被 strip 掉，flagsSet undefined 而非 ['金丹']；或非法值未容错）。

- [ ] **Step 3: 实现** — 把 `src/ai/turn.ts` 的 `choiceSchema` 改为：

```ts
const choiceSchema = z.object({
  text: z.string().min(1),
  effects: z.record(z.string(), z.number()).default({}),
  // AI 可授印记 / 触发隐藏结局；非必要字段，非法值容错为 undefined，不拖垮整回合解析
  flagsSet: z.array(z.string().min(1)).optional().catch(undefined),
  flagsClear: z.array(z.string().min(1)).optional().catch(undefined),
  endTone: z.string().min(1).optional().catch(undefined),
})
```

（`choicesField`、`tailSchema` 复用 `choiceSchema`，自动获得新字段，无需另改。）

- [ ] **Step 4: 跑绿** — `npx vitest run src/ai/turn.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/ai/turn.ts src/ai/turn.test.ts && git commit -m "feat(ai): 回合 schema 接受 flagsSet/flagsClear/endTone（容错）"`（trailer）。

---

## Task 2: 修复涌现剧本 prompt header「共 undefined 载」

**Files:** Modify `src/engine/prompt.ts`（buildTurnMessages 第 86 行）；Test `src/engine/prompt.test.ts`

**Interfaces:** Produces buildTurnMessages 在 `sc.maxTurns===undefined` 时 header 不含「共 … 载」/「undefined」。

- [ ] **Step 1: 写失败测试** — 在 `src/engine/prompt.test.ts` 加：

```ts
import { buildTurnMessages } from './prompt'
import { builtinScenarios } from '../scenarios'
import { initState } from './state'

describe('涌现剧本 prompt header', () => {
  it('xian（无 maxTurns）的提示不含 undefined', () => {
    const xian = builtinScenarios.find((s) => s.id === 'xian')!
    const msgs = buildTurnMessages(xian, initState(xian, xian.openings![0], undefined, 'ai'))
    const user = msgs.find((m) => m.role === 'user')!.content
    expect(user).not.toContain('undefined')
    expect(user).toContain(`第 1 ${xian.turnUnit}`)
  })
  it('有 maxTurns 的剧本仍标出总数', () => {
    const sg = builtinScenarios.find((s) => s.id === 'spy')! // spy 有 maxTurns
    const msgs = buildTurnMessages(sg, initState(sg, undefined, undefined, 'ai'))
    const user = msgs.find((m) => m.role === 'user')!.content
    expect(user).toContain(`共 ${sg.maxTurns}`)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/engine/prompt.test.ts -t "header"` → FAIL（xian 含「共 undefined 载」）。

- [ ] **Step 3: 实现** — 把 `prompt.ts` 的：

```ts
  lines.push(`【第 ${current} ${sc.turnUnit}，共 ${sc.maxTurns} ${sc.turnUnit}】`)
```
改为：
```ts
  lines.push(
    sc.maxTurns !== undefined
      ? `【第 ${current} ${sc.turnUnit}，共 ${sc.maxTurns} ${sc.turnUnit}】`
      : `【第 ${current} ${sc.turnUnit}】`,
  )
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/engine/prompt.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/engine/prompt.ts src/engine/prompt.test.ts && git commit -m "fix(prompt): 涌现剧本 header 不再出现「共 undefined 载」"`（trailer）。

---

## Task 3: prompt 注入当前印记 + 境界封顶 + 契约扩展（按剧本门控）

**Files:** Modify `src/engine/prompt.ts`；Test `src/engine/prompt.test.ts`

**Interfaces:**
- Consumes: L1 `effectiveCeiling(a, flags)`（`src/engine/state.ts` 导出）、`Attribute` 类型。
- Produces: `export function scenarioUsesFlags(sc): boolean`；buildTurnMessages 对 usesFlags 剧本注入【当前印记】【境界封顶】;`formatContract` 增参注入 flagsSet/endTone 契约行。

- [ ] **Step 1: 写失败测试** — 在 `src/engine/prompt.test.ts` 加：

```ts
import { scenarioUsesFlags } from './prompt'

describe('印记/境界注入（门控）', () => {
  const xian = builtinScenarios.find((s) => s.id === 'xian')!
  const wasteland = builtinScenarios.find((s) => s.id === 'wasteland')!
  it('scenarioUsesFlags 仅对带 flag/ceilingUnlocks 的剧本为真', () => {
    expect(scenarioUsesFlags(xian)).toBe(true)
    expect(scenarioUsesFlags(wasteland)).toBe(false)
  })
  it('xian 提示含当前印记、境界封顶、flagsSet/endTone 契约与词表', () => {
    const st = { ...initState(xian, xian.openings!.find((o) => o.flag === '魔道'), undefined, 'ai') }
    const msgs = buildTurnMessages(xian, st)
    const all = msgs.map((m) => m.content).join('\n')
    expect(all).toContain('当前印记')
    expect(all).toContain('魔道')
    expect(all).toContain('境界封顶')
    expect(all).toContain('flagsSet')
    expect(all).toContain('金丹') // 境界印记词表
    expect(all).toContain('endTone')
  })
  it('无 flag 题材（wasteland）提示不含印记/境界/flagsSet 段', () => {
    const msgs = buildTurnMessages(wasteland, initState(wasteland, undefined, undefined, 'ai'))
    const all = msgs.map((m) => m.content).join('\n')
    expect(all).not.toContain('当前印记')
    expect(all).not.toContain('flagsSet')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/engine/prompt.test.ts -t "门控"` → FAIL（scenarioUsesFlags 未定义等）。

- [ ] **Step 3: 实现** — 在 `prompt.ts`：

(a) 顶部 import 补 `effectiveCeiling`、`Attribute`：
```ts
import { effectiveCeiling } from './state'
import type { Scenario, Attribute } from '../scenarios/schema'
```
（若已 import `Scenario`，合并即可。）

(b) 加导出函数（放在 `currentBands` 附近）：
```ts
// 该剧本是否启用「印记/境界封顶」体系（决定是否给 AI 注入相关上下文与契约）
export function scenarioUsesFlags(sc: Scenario): boolean {
  return !!sc.openings?.some((o) => o.flag) || sc.attributes.some((a) => a.ceilingUnlocks)
}

// 派生 AI 可授予的境界印记词表与可触发的隐藏结局基调词表
function flagVocab(sc: Scenario): { realms: string[]; hiddenTones: string[] } {
  const realms = [...new Set(sc.attributes.flatMap((a) => (a.ceilingUnlocks ?? []).map((u) => u.flag)))]
  const hiddenTones = sc.endings.filter((e) => e.condition === 'lifespan<=-1').map((e) => e.tone)
  return { realms, hiddenTones }
}
```

(c) 改 `formatContract` 签名与体：增 `usesFlags` + `vocab`，usesFlags 时追加契约行：
```ts
function formatContract(
  attrKeys: string[], useItems: boolean, hasGoal: boolean,
  usesFlags: boolean, vocab: { realms: string[]; hiddenTones: string[] },
): string {
  // ...原有 lines 构造不变...
  // 在 return 的数组里、物品段之后追加：
  ...(usesFlags
    ? [
        `- 可选 "flagsSet":["印记名"]：仅当剧情中玩家真正达成境界突破或获得关键身份际遇时授予；境界印记只能取：${vocab.realms.join('、')}，且须按炼气→筑基→金丹→元婴→化神顺序、不得越级`,
        `- 可选 "endTone":"结局基调"：极稀有，仅当出现无视一切的横死凶险或泼天造化时用，使本回合即终局；可取的隐藏基调（须精确）：${vocab.hiddenTones.join('、')}。天威难测，绝大多数回合都不应出现`,
      ]
    : []),
```
（把这两行并进 `formatContract` 现有 `return [...].join('\n')` 的数组尾部。）

(d) 在 `buildTurnMessages`：计算 `const usesFlags = scenarioUsesFlags(sc)` 与 `const vocab = flagVocab(sc)`;`formatContract(keys, useItems, !!st.ambition, usesFlags, vocab)`。在 `st.opening` 身份段之后,加印记/境界注入:
```ts
  if (usesFlags) {
    const flags = st.flags ?? []
    if (flags.length > 0) {
      lines.push(`【当前印记】${flags.join('、')} —— 这是玩家已达的境界、身份与在演的因果，剧情须与之一致。`)
    }
    const capped = sc.attributes.filter((a) => a.ceilingUnlocks)
    if (capped.length > 0) {
      lines.push(
        `【境界封顶】${capped.map((a: Attribute) => `${a.name}上限 ${effectiveCeiling(a, flags)}`).join('，')} —— 未达更高境界印记前，相关属性最多到此；要让玩家更进一境，须在 JSON 中 flagsSet 对应境界印记，且只在真正的突破机缘时。`,
      )
    }
  }
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/engine/prompt.test.ts` → PASS；`npx tsc --noEmit` → 0；`npx vitest run` 全绿（prompt.test 既有用例不被破坏）。

- [ ] **Step 5: Commit** — `git add src/engine/prompt.ts src/engine/prompt.test.ts && git commit -m "feat(prompt): AI 注入当前印记+境界封顶+印记/结局词表（按剧本门控）"`（trailer）。

---

## Task 4: xian systemPrompt 注入末法世界观与机制

**Files:** Modify `src/scenarios/xian.ts`（systemPrompt）；Test `src/engine/prompt.test.ts`（或 `src/scenarios/xian.test.ts`）

**Interfaces:** Consumes Task 3 注入。Produces xian.systemPrompt 含末法世界观 + 境界封顶/机缘稀缺/寿元续命/身份/隐藏天堂地狱(endTone 极稀有)的 GM 指导。

- [ ] **Step 1: 写失败测试** — 在 `src/scenarios/xian.test.ts` 加：

```ts
describe('xian systemPrompt 末法世界观', () => {
  it('含末法/机缘稀缺/境界突破/隐藏结局极稀有的指导', () => {
    const sp = xian.systemPrompt
    expect(sp).toMatch(/末法|灵气衰微/)
    expect(sp).toMatch(/机缘|突破/)
    expect(sp).toMatch(/极稀有|天威难测/) // 约束 endTone 不滥用
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "末法世界观"` → FAIL（现 systemPrompt 无这些词）。

- [ ] **Step 3: 实现** — 在 `xian.ts` 的 `systemPrompt` 字符串末尾(规则列表内)追加几条规则(中文仙气，与现有规则并列)：
  - 末法/灵气衰微世界观:天才地宝稀缺、突破凶险、飞升百年难见;莫随意给唾手可得的机缘。
  - 境界封顶:修为到本境上限后,须真正的突破机缘(灵药/顿悟/历劫)方能更进;突破时在 JSON `flagsSet` 对应境界印记,按炼气→筑基→金丹→元婴→化神顺序、不越级。
  - 寿元赛跑与续命(强化现有):寿元随岁月流逝,须主动续命。
  - 隐藏天堂地狱:仅在极罕见的横死凶险(踩中杀阵/凶煞)或泼天造化(仙缘传承)时,用 `endTone` 当场定结局;**天威难测,绝大多数回合都不该出现,切忌滥用暴毙**。
  保持与现有规则同体例(`- ...`)。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS；`npx tsc --noEmit` → 0；`npx vitest run` 全绿。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): systemPrompt 注入末法世界观与机缘/封顶/续命/隐藏机制"`（trailer）。

---

## Task 5: AI playtest（人工验证）

**Files:** 无代码改动（验证 + 记录）

**Interfaces:** Consumes Task 1-4。

- [ ] **Step 1: 全量回归** — `npx vitest run` 全绿;`npx tsc --noEmit` 0;`npm run build` 成功。
- [ ] **Step 2: 人工 playtest（无 sim 替代）** — 控制器(非子代理)在 AI 模式下用 xian 跑短局(若有可用 Key/本地模型),或至少审 buildTurnMessages 对一个真实中局 state 的输出文本:确认含【当前印记】【境界封顶】、契约词表正确、无「undefined」、systemPrompt 末法指导在位。把检查记录写入报告。
- [ ] **Step 3: 记录** — 在报告中列出:AI 提示快照要点、是否尊重封顶词表、endTone 约束是否到位。若无 Key 无法真跑 AI,明确标注「仅提示文本审查,未跑真模型」,并把真模型 playtest 列为遗留验证项。
- [ ] **Step 4: Commit（如有记录文件）** — 若仅验证无改动,跳过 commit;否则提交验证记录。

---

## Self-Review

- **Spec 覆盖**:§1 schema(Task1)✓;§2 prompt 注入+涌现 header(Task2 header + Task3 印记/境界/契约)✓;§3 契约+xian systemPrompt(Task3 契约 + Task4 systemPrompt)✓;§4 测试(各任务单测 + Task5 playtest)✓;§6 触点全覆盖✓。
- **占位符**:所有代码步骤给确切代码(schema、header 三元、scenarioUsesFlags/flagVocab/formatContract 扩展、注入段、systemPrompt 追加为内容简报);无 TODO。
- **类型一致**:`scenarioUsesFlags(sc)`、`flagVocab(sc):{realms,hiddenTones}`、`effectiveCeiling(a,flags)`、`formatContract(...,usesFlags,vocab)`、choiceSchema 字段名(flagsSet/flagsClear/endTone)跨任务一致;派生词表定义在 Global Constraints 固定。
- **顺序依赖**:Task3 的契约用 Task1 已能解析的字段;Task4 systemPrompt 配合 Task3 注入;Task5 验证全部。执行须按序。
- **范围**:其他题材 AI 改造不在本计划(机制共享,词表为空时不注入)。引擎消费不重测(L1 已覆盖);AI 真行为靠 playtest。

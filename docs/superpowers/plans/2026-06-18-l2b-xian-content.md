# L2b：xian 深度内容 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 xian 事件池注入身份支线弧、因果种子、隐藏天堂地狱三类内容，全用 L1 原语、不改引擎，且保住 L2a 平衡。

**Architecture:** 纯内容增补在 `src/scenarios/xian.ts`（localEvents + 少量新 endings），复用 L1 的 `flags`/`has()`/`outcomes`/`endTone`。每批内容用 `scripts/sim-balance.ts` 守门。

**Tech Stack:** TypeScript、Zod、Vitest、vite-node（sim）。

## Global Constraints

- 不改引擎（`src/engine/*`）。仅 L1 已有能力。
- **保住 L2a 平衡**（每个 sim 守门任务断言）：技术流(survive)登顶率 ~个位数%（≤~12%，jackpot 飞升单独 <~1%）；**P(收场回合<10)=0** 三策略；死亡非零且 random 死亡 ≤~50%；random 多止步炼气/筑基。
- 致死/暴毙隐藏事件 `minTurn>=10`；早期负向单事件 effect 不致 10 回合内归零。
- 隐藏（仅 endTone 驱动）结局的 condition 统一用永不成立的 `lifespan<=-1`。
- 测试 Vitest（`npx vitest run`，21 文件单跑）；提交前 `npx tsc --noEmit` 干净、全量绿。
- 提交信息以这两行结尾：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- 中文文案/注释风格与 `xian.ts` 既有一致；新事件结构与既有 localEvent 一致。

**L1 字段速查**（实现者用）：localEvent `{narrative, choices[], summary, minTurn?, maxTurn?, once?, weight?, requires?, requiresItem?, itemsGained?, itemsLost?}`；choice `{text, effects, reaction?, outcomes?, flagsSet?, flagsClear?, endTone?}`；outcome `{weight, effects?, reaction?, flagsSet?, flagsClear?, itemsGained?, itemsLost?, endTone?}`。`requires` 支持 `has(X)`/`!has(X)` 与属性比较、`&` 组合。

---

## File Structure
- `src/scenarios/xian.ts` — localEvents 增补；endings 增 3 个隐藏基调。单一文件。
- `src/scenarios/xian.test.ts` — 各支柱功能+守护测试。
- `scripts/sim-balance.ts` — 复用（如需新度量可加，否则不动）。

---

## Task 1: 身份起点事件 ×3（第 1 回合分化）

**Files:** Modify `src/scenarios/xian.ts`（localEvents）；Test `src/scenarios/xian.test.ts`

**Interfaces:** Produces 3 个 `requires has(身份)`、`minTurn:1, maxTurn:1, once:true`、高 `weight` 的起点事件，主选项 effects 拉开起点。

**实现说明**：L1 无「按开局给不同初始属性」能力，故用第 1 回合的高权重身份事件等价分化。`weight: 200` 使其在 turn 1 几乎必被抽中（pickLocalEvent 的 effWeight=weight×(requires?2)×stageBias，200×2 远压其它 ~1-30 的事件）。

- [ ] **Step 1: 写失败测试** — 追加到 `xian.test.ts`：

```ts
import { localTurn } from '../engine/local'

describe('xian 身份起点分化', () => {
  // 第 1 回合（history 为空）抽中各身份起点事件的概率（高权重应≈必中）
  const startHitRate = (flag: string) => {
    const base = initState(xian, undefined, undefined, 'local')
    const st = { ...base, flags: [flag], history: [] as typeof base.history }
    let hit = 0
    for (let i = 0; i < 300; i++) {
      const tr = localTurn(xian, st, () => Math.random())
      if (tr.summary.includes(`${flag}起点`)) hit++
    }
    return hit / 300
  }
  it('三身份第1回合高概率命中各自起点事件', () => {
    expect(startHitRate('魔道')).toBeGreaterThan(0.9)
    expect(startHitRate('仙门')).toBeGreaterThan(0.9)
    expect(startHitRate('散修')).toBeGreaterThan(0.9)
  })
})
```
（起点事件的 `summary` 须为 `魔道起点`/`仙门起点`/`散修起点`，与此断言对齐。`initState` 第 4 参 `'local'` 与 L2a 一致。）

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "起点分化"` → FAIL（无起点事件）。

- [ ] **Step 3: 实现** — 在 `xian.ts` 的 `localEvents` 追加 3 个起点事件：

| 身份 | requires | 主选项 effects | 附加 |
|---|---|---|---|
| 魔道 | `has(魔道)` | `{cultivation:6, daoHeart:-15}` | reaction 点出魔功起步快、道心有亏 |
| 仙门 | `has(仙门)` | `{daoHeart:8}` | `itemsGained:['宗门信物']` |
| 散修 | `has(散修)` | `{cultivation:-2}` | reaction 点出无门无派、自由但艰难 |

每个：`minTurn:1, maxTurn:1, once:true, weight:200`，`summary` 含「起点」（如「魔道起点」），2 个选项（一个承接身份、一个略作他选），主选项放第一。narrative/文案用 xian 仙气文风现写（读文件既有事件对齐语气）。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 三身份第1回合起点分化事件"`（trailer）。

---

## Task 2: 魔道支线弧 + 正道追缉因果链

**Files:** Modify `xian.ts`；Test `xian.test.ts`

**Interfaces:** Consumes Task 1 的 `has(魔道)`。Produces 4-5 个魔道弧事件，其中一个屠戮/采补事件的某 outcome `flagsSet:['正道追缉']`；一个 `requires has(正道追缉)` 的追杀回收事件（`once`，`flagsClear:['正道追缉']`，outcomes 含险死分支）。

- [ ] **Step 1: 写失败测试** — 追加：

```ts
describe('xian 魔道弧 + 正道追缉', () => {
  it('存在魔道屠戮事件可埋下正道追缉印记', () => {
    const seedEv = (xian.localEvents ?? []).find((e) =>
      e.requires?.includes('魔道') &&
      e.choices.some((c) => (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('正道追缉'))))
    expect(seedEv).toBeTruthy()
  })
  it('存在 requires has(正道追缉) 的追杀回收事件', () => {
    const payoff = (xian.localEvents ?? []).find((e) => e.requires?.includes('正道追缉'))
    expect(payoff).toBeTruthy()
    expect(payoff!.choices.some((c) => (c.flagsClear ?? []).includes('正道追缉') ||
      (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('正道追缉')))).toBe(true)
  })
})
```

- [ ] **Step 2: 跑红** — `-t "魔道弧"` → FAIL。

- [ ] **Step 3: 实现** — 追加魔道弧事件（`requires has(魔道)`，部分 `once`）：
  - **采补/屠戮**（≥2 个）：修为快涨、道心降；其中一个的某 outcome `flagsSet:['正道追缉']`（埋因果）。effects 量级参照既有事件（修为 +6~+12、道心 -6~-12）。
  - **正道追缉 回收**（1 个，`requires has(正道追缉)`，`once:true`，`minTurn>=10`）：outcomes 三态——逃脱(小损)/恶战险死(`{lifespan:-10,daoHeart:-6}` 甚至 `endTone:'走火入魔·身死道消'` 的孤注分支)/反杀立威(修为+、得物品)；命中分支 `flagsClear:['正道追缉']`。
  - 文案魔道狠辣气质，对齐文件语气。

- [ ] **Step 4: 跑绿 + sim 守门** — `npx vitest run src/scenarios/xian.test.ts` PASS；`npx tsc --noEmit` 0；`npx vite-node scripts/sim-balance.ts xian 3000` 确认 Global Constraints 的平衡带仍成立（登顶~个位数%、P(<10)=0、死亡非零、random 多低境界）。把 sim block 记入提交说明或报告。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 魔道支线弧 + 正道追缉因果链"`（trailer）。

---

## Task 3: 仙门支线弧

**Files:** Modify `xian.ts`；Test `xian.test.ts`

**Interfaces:** Consumes `has(仙门)`。Produces 4-6 个仙门弧事件。

- [ ] **Step 1: 写失败测试**：

```ts
describe('xian 仙门弧', () => {
  it('存在 requires has(仙门) 的支线事件（≥3）', () => {
    const evs = (xian.localEvents ?? []).filter((e) => e.requires?.includes('仙门'))
    expect(evs.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: 跑红** → FAIL（仅起点事件 1 个）。

- [ ] **Step 3: 实现** — 追加 ≥3 个仙门弧事件（`requires has(仙门)`）：宗门任务（给资源/物品/修为，但耗时）；违门规受惩戒（道心/资源-）；长辈庇荫（益）与宗门倾轧（损）。量级参照既有。文案稳重受束缚气质。

- [ ] **Step 4: 跑绿** — vitest PASS；tsc 0。

- [ ] **Step 5: Commit** — `git commit -m "feat(xian): 仙门支线弧"`（trailer）。

---

## Task 4: 散修支线弧

**Files:** Modify `xian.ts`；Test `xian.test.ts`

**Interfaces:** Consumes `has(散修)`。Produces 4-6 个散修弧事件。

- [ ] **Step 1: 写失败测试**：

```ts
describe('xian 散修弧', () => {
  it('存在 requires has(散修) 的支线事件（≥3）', () => {
    const evs = (xian.localEvents ?? []).filter((e) => e.requires?.includes('散修'))
    expect(evs.length).toBeGreaterThanOrEqual(3)
  })
})
```

- [ ] **Step 2: 跑红** → FAIL。

- [ ] **Step 3: 实现** — 追加 ≥3 个散修弧事件（`requires has(散修)`）：资源匮乏的碰壁（修为/寿元-或徒劳）；孤身奇遇（低概率益）；无门规的自由抉择。量级参照既有。文案孤勇艰辛气质。

- [ ] **Step 4: 跑绿** — vitest PASS；tsc 0。

- [ ] **Step 5: Commit** — `git commit -m "feat(xian): 散修支线弧"`（trailer）。

---

## Task 5: 因果种子 ×4（通用）

**Files:** Modify `xian.ts`；Test `xian.test.ts`

**Interfaces:** Produces 4 组「种子事件 + 回收事件」：种子事件某 outcome `flagsSet:['因果·X']`；回收事件 `requires has('因果·X')`、`once:true`、`minTurn>=8`、回收分支 `flagsClear:['因果·X']`、outcomes 善/恶/徒劳三态。

种子清单（`因果·X` 印记名）：`善缘老者`、`宿怨仇敌`、`传艺之徒`、`受恩散修`。

- [ ] **Step 1: 写失败测试**：

```ts
import { applyChoice } from '../engine/state'
describe('xian 因果种子', () => {
  const seeds = ['善缘老者', '宿怨仇敌', '传艺之徒', '受恩散修']
  it('每组种子都有埋种与回收事件', () => {
    for (const s of seeds) {
      const plant = (xian.localEvents ?? []).find((e) =>
        e.choices.some((c) => (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(s))))
      const reap = (xian.localEvents ?? []).find((e) => e.requires?.includes(s))
      expect(plant, `${s} 埋种`).toBeTruthy()
      expect(reap, `${s} 回收`).toBeTruthy()
      expect(reap!.choices.some((c) => (c.outcomes ?? []).length >= 2 || (c.flagsClear ?? []).includes(s) ||
        (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes(s))), `${s} 回收三态/清除`).toBe(true)
    }
  })
})
```

- [ ] **Step 2: 跑红** → FAIL。

- [ ] **Step 3: 实现** — 追加 4 组：
  - **善缘老者**：帮路边老人 →（outcome 埋 `善缘老者`，小损时间）；回收 `requires has(善缘老者)`：高人传承(印记/大益)/仇家寻仇(寿元-)/徒劳，三态加权（徒劳权重最高、善报最低）。
  - **宿怨仇敌**：放过/结下仇敌 → 埋 `宿怨仇敌`；回收：反噬被袭(性命险)/化敌为援(益)/相安无事。
  - **传艺之徒**：收徒传艺 → 埋 `传艺之徒`；回收：叛徒噬主(损)/衣钵有传(益)/平庸离去。
  - **受恩散修**：施恩落难散修 → 埋 `受恩散修`；回收：涌泉相报(益)/恩将仇报(损)/杳无音讯。
  每组回收事件 `once:true`、`minTurn>=8`、回收时 `flagsClear` 该种子。三态用 outcomes 加权（坏/徒劳偏多，营造「好心未必好报」的无常）。文案对齐文件语气。

- [ ] **Step 4: 跑绿 + sim 守门** — vitest PASS；tsc 0；`npx vite-node scripts/sim-balance.ts xian 3000` 平衡带仍成立。

- [ ] **Step 5: Commit** — `git commit -m "feat(xian): 4 组因果种子（埋种→延迟随机善恶报）"`（trailer）。

---

## Task 6: 隐藏天堂地狱 + 新结局基调

**Files:** Modify `xian.ts`（localEvents + endings）；Test `xian.test.ts`

**Interfaces:** Produces 隐藏事件（`minTurn>=10`，低 weight），其 outcome 带 `endTone`；新增 3 个仅 endTone 驱动的 ending（condition `lifespan<=-1`）：`误入杀阵·横死当场`、`凶煞缠身·暴毙荒野`、`仙缘垂青·一步登天`。另含天堂「跳境界」事件（`flagsSet` 直接给下一境界印记 + 寿元回补）。

- [ ] **Step 1: 写失败测试**：

```ts
import { checkEnding } from '../engine/state'
describe('xian 隐藏天堂地狱', () => {
  it('三个隐藏结局基调存在且 condition 永不自然成立', () => {
    const tones = ['误入杀阵·横死当场', '凶煞缠身·暴毙荒野', '仙缘垂青·一步登天']
    for (const t of tones) {
      const e = xian.endings.find((x) => x.tone === t)
      expect(e, t).toBeTruthy()
      expect(e!.condition).toBe('lifespan<=-1')
    }
    // 满血也不会自然触发任何隐藏结局
    const r = checkEnding(xian, { cultivation: 50, daoHeart: 80, lifespan: 80 }, 20, ['筑基'])
    expect(tones.includes(r?.tone ?? '')).toBe(false)
  })
  it('存在带 endTone 的隐藏地狱事件（minTurn>=10）', () => {
    const hell = (xian.localEvents ?? []).find((e) =>
      (e.minTurn ?? 0) >= 10 &&
      e.choices.some((c) => c.endTone || (c.outcomes ?? []).some((o) => o.endTone)))
    expect(hell).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑红** → FAIL。

- [ ] **Step 3: 实现** —
  (a) endings 增 3 条（放在飞升类附近，但因 condition `lifespan<=-1` 永不自然命中，位置不影响）：
  ```ts
  { condition: 'lifespan<=-1', tone: '误入杀阵·横死当场', epilogue: '<横死类 epilogue，2-3句仙气文风>' },
  { condition: 'lifespan<=-1', tone: '凶煞缠身·暴毙荒野', epilogue: '<横死类>' },
  { condition: 'lifespan<=-1', tone: '仙缘垂青·一步登天', epilogue: '<登天 jackpot epilogue>' },
  ```
  (b) localEvents 增隐藏事件（`minTurn>=10`，低 `weight`，如 `weight:0.3`）：
  - 地狱（≥2）：误入上古杀阵 / 踩中凶煞 → 「探/避」选项；「探」分支 outcomes 含 `endTone:'误入杀阵·横死当场'`（或凶煞）高代价分支 + 侥幸脱险分支。
  - 天堂（≥2）：遇仙人传承 → 大造化分支 `flagsSet:[下一境界]` + `{lifespan:+12}`（跳境界，要求已有前一境界印记以合逻辑，用 `requires has(前境界)`）；得泼天造化 → **极稀有** `endTone:'仙缘垂青·一步登天'`（该事件 `weight` 压到极低如 `0.1`）。
  文案对齐语气。

- [ ] **Step 4: 跑绿 + sim 守门** — vitest PASS；tsc 0；`npx vite-node scripts/sim-balance.ts xian 3000`：确认登顶率仍 ≤~12%、**jackpot「一步登天」单独占比 <~1%**（如超，把该事件 weight 再压低）、P(<10)=0、死亡非零。

- [ ] **Step 5: Commit** — `git commit -m "feat(xian): 隐藏天堂地狱事件 + 3 个隐藏结局基调"`（trailer）。

---

## Task 7: sim 守门 + 全量平衡回归

**Files:** 可能回改 `xian.ts`（数值/weight）；`scripts/sim-balance.ts`（按需）；Test 全量

**Interfaces:** Consumes 全部前序内容。

- [ ] **Step 1: 全量 sim** — `npx vite-node scripts/sim-balance.ts xian 5000`，记录三策略的：登顶率、飞升率、收场回合分布、最高境界分布、死亡率。

- [ ] **Step 2: 校验目标** — 断言（对照 Global Constraints）：survive 登顶 ~个位数%（≤~12%）；jackpot 一步登天 <~1%；P(收场<10)=0 三策略；死亡非零且 random ≤~50%；random 多止步炼气/筑基。任何越界，调对应支柱事件的 weight/minTurn/effects，**小步重跑**直至全部回归。把最终指标写入报告。

- [ ] **Step 3: 守护测试** — 追加到 `xian.test.ts`：

```ts
import { parseCondition } from '../engine/condition'
describe('xian L2b 守护', () => {
  it('所有结局条件可解析', () => {
    for (const e of xian.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
  it('所有致死/暴毙类隐藏事件 minTurn>=10', () => {
    const lethal = (xian.localEvents ?? []).filter((e) =>
      e.choices.some((c) => c.endTone?.match(/横死|暴毙|身死|形神/) ||
        (c.outcomes ?? []).some((o) => o.endTone?.match(/横死|暴毙|身死|形神/))))
    for (const e of lethal) expect(e.minTurn ?? 0).toBeGreaterThanOrEqual(10)
  })
})
```

- [ ] **Step 4: 回归** — `npx vitest run` 全绿；`npx tsc --noEmit` 0。若调参改了被断言的值，同步更新断言为新真值。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "balance(xian): L2b 全量 sim 守门，平衡回归达标"`（trailer）。

---

## Self-Review

- **Spec 覆盖**：§2 身份弧（起点 Task1 + 魔道 Task2 + 仙门 Task3 + 散修 Task4）✓；§3 因果种子（魔道链 Task2 + 通用 Task5）✓；§4 隐藏天堂地狱 + 新基调（Task6）✓；§5 sim 守门（Task2/5/6/7）✓；§6 触点 ✓；§7-9 成功/风险/测试由各任务测试 + Task7 守护覆盖 ✓。
- **占位符**：机械部分（requires/flags/minTurn/weight/effects/endTone/condition）给确切值；事件叙事散文为「按 xian 文风现写」内容简报（参照文件既有，沿 L2a Task4 已验证的做法）；隐藏 epilogue 为待写 2-3 句（内容简报，非代码占位）。
- **类型一致**：印记名（魔道/仙门/散修/正道追缉/善缘老者/宿怨仇敌/传艺之徒/受恩散修/筑基/金丹/元婴/化神）、字段（outcomes/flagsSet/flagsClear/endTone/requires/minTurn/weight）跨任务一致；隐藏结局 condition 统一 `lifespan<=-1`。
- **顺序依赖**：Task2 依赖 Task1 的 `has(魔道)`；Task6 天堂跳境界用 `has(前境界)`；Task7 可回改前序数值并同步断言。执行须按序。
- **平衡守门**：Task2/5/6 各自 sim 检查 + Task7 全量回归，防内容堆积破坏 L2a 带。
- **范围**：L2c（AI）、其他题材不在本计划。

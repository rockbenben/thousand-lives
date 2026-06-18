# L2a：xian 引擎配置 + 重平衡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用已合入的 L1 原语把 xian 改造成「涌现长度 + 境界封顶 + 稀缺突破机缘 + 寿元赛跑 + 飞升稀有」的修仙人生，**不改引擎**。

**Architecture:** 纯数据/config 改在 `src/scenarios/xian.ts`（属性 ceiling/ceilingUnlocks、开局印记、结局重挂、去 maxTurns、4 个核心突破机缘事件）；`storage.ts` bump 存档版本作废旧档；`scripts/sim-balance.ts` 扩展度量并据此调参。

**Tech Stack:** TypeScript、Zod、Vitest、vite-node（sim）。

## Global Constraints

- 不改引擎（`src/engine/*`）。仅用 L1 已有能力：`ceiling`/`ceilingUnlocks`、`flags`/`has()`、`outcomes`、`endTone`、可选 `maxTurns`/涌现终止。
- 不必向后兼容旧存档：xian 结构变了，**必须** bump 存档版本作废旧的进行中 xian 档（旧档无 ceiling/印记会行为错乱）。
- **最短人生 ≥ 10 回合**：开局 10 回合内不得收场。致死/暴毙事件 `minTurn>=10`；早期负向 lifespan/daoHeart 单事件 effect 不致 10 回合内归零；sim 验证 `P(收场回合<10)=0`。
- 境界封顶档位（起点，经 sim 调）：修为 ceiling 20，印记解锁 筑基45/金丹70/元婴90/化神100；寿元上限 印记解锁 筑基75/金丹88/元婴96/化神100。
- 飞升稀有：技术流飞升率个位数 %。
- 测试 Vitest（`npx vitest run`，20 文件单跑）；提交前 `npx tsc --noEmit` 干净、全量绿。
- 提交信息以这两行结尾：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- 中文文案/注释风格与 `xian.ts` 既有一致。

**范围修正（plan-time finding）**：spec §4「各异起点」（按身份给不同初始属性）当前 schema 无法表达（initial 在属性上、非开局；L2a 不改引擎）。故 **L2a 身份只写印记**；按身份分化起点/轨迹移到 L2b（印记门控的早期事件）。

---

## File Structure
- `src/scenarios/xian.ts` — 属性(ceiling/unlocks)、openings(flag)、endings(重挂)、去 maxTurns、新增 4 突破事件。单一文件，职责不变。
- `src/storage.ts` — 新增 `SAVE_VERSION`；`validateSaveGame` 拒绝旧版本存档。
- `scripts/sim-balance.ts` — 度量境界/飞升/收场回合。
- 测试：`src/scenarios/xian.test.ts`（新建，xian 专项）、`src/scenarios/invariants.test.ts`/`content-integrity.test.ts`（按需放行涌现剧本）、`src/storage.test.ts`（版本作废）。

---

## Task 1: xian 属性封顶（修为/寿元 ceilingUnlocks）

**Files:**
- Modify: `src/scenarios/xian.ts`（cultivation、lifespan 属性对象）
- Test: `src/scenarios/xian.test.ts`（新建）

**Interfaces:**
- Consumes: L1 `clampEffects(sc, attrs, effects, flags)`、`effectiveCeiling`、`scenarioSchema`。
- Produces: xian.cultivation 带 `ceiling:20` + 4 段 `ceilingUnlocks`；xian.lifespan 带 4 段 `ceilingUnlocks`（保留 `decayPerTurn:2`、`deathBelow:0`）。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/xian.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { builtinScenarios } from './index'
import { clampEffects } from '../engine/state'

const xian = builtinScenarios.find((s) => s.id === 'xian')!

describe('xian 境界封顶', () => {
  it('无印记时修为封顶 20（炼气）', () => {
    expect(clampEffects(xian, { cultivation: 19 }, { cultivation: 50 }, []).cultivation).toBe(20)
  })
  it('持金丹印记修为可达 70', () => {
    expect(clampEffects(xian, { cultivation: 60 }, { cultivation: 50 }, ['筑基', '金丹']).cultivation).toBe(70)
  })
  it('持化神印记修为可达满 100', () => {
    expect(clampEffects(xian, { cultivation: 90 }, { cultivation: 50 }, ['筑基', '金丹', '元婴', '化神']).cultivation).toBe(100)
  })
  it('寿元上限随境界印记抬高', () => {
    // 无印记寿元封顶 60；持元婴印记封顶 96
    expect(clampEffects(xian, { lifespan: 55 }, { lifespan: 50 }, []).lifespan).toBe(60)
    expect(clampEffects(xian, { lifespan: 90 }, { lifespan: 50 }, ['筑基', '金丹', '元婴']).lifespan).toBe(96)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "境界封顶"` → FAIL（封顶到 100）。

- [ ] **Step 3: 实现** — 在 `src/scenarios/xian.ts` 的 cultivation 属性对象里，于 `max: 100,` 后加：

```ts
      ceiling: 20,
      ceilingUnlocks: [
        { flag: '筑基', max: 45 },
        { flag: '金丹', max: 70 },
        { flag: '元婴', max: 90 },
        { flag: '化神', max: 100 },
      ],
```

在 lifespan 属性对象里，于 `decayPerTurn: 2,` 后加：

```ts
      ceilingUnlocks: [
        { flag: '筑基', max: 75 },
        { flag: '金丹', max: 88 },
        { flag: '元婴', max: 96 },
        { flag: '化神', max: 100 },
      ],
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 修为/寿元境界封顶 ceilingUnlocks"`（附两行 trailer）。

---

## Task 2: xian 开局身份印记

**Files:**
- Modify: `src/scenarios/xian.ts`（openings）
- Test: `src/scenarios/xian.test.ts`

**Interfaces:**
- Consumes: L1 `initState` 写 `opening.flag` 进 `state.flags`。
- Produces: 3 开局各带 `flag`：草根散修→`散修`、仙门弟子→`仙门`、魔道余孽→`魔道`。

- [ ] **Step 1: 写失败测试** — 追加到 `xian.test.ts`：

```ts
import { initState } from '../engine/state'

describe('xian 身份印记', () => {
  it('每个开局写入对应身份印记', () => {
    const byName = (n: string) => xian.openings!.find((o) => o.name === n)!
    expect(initState(xian, byName('草根散修')).flags).toEqual(['散修'])
    expect(initState(xian, byName('仙门弟子')).flags).toEqual(['仙门'])
    expect(initState(xian, byName('魔道余孽')).flags).toEqual(['魔道'])
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "身份印记"` → FAIL（flags 为空）。

- [ ] **Step 3: 实现** — 给 `xian.ts` 的三个 opening 各加 `flag`：

```ts
  openings: [
    { name: '草根散修', prompt: '出身寒微、无门无派的散修，灵根驳杂、家底全无，一身道行皆是九死一生换来的。', flag: '散修' },
    { name: '仙门弟子', prompt: '名门正派的入室弟子，资粮丰沛、师长庇佑，却被门规、辈分与宗门倾轧层层束缚。', flag: '仙门' },
    { name: '魔道余孽', prompt: '魔功传人，修行迅猛、手段狠辣，却为正道所不容、被心魔与追剿如影随形。', flag: '魔道' },
  ],
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 开局身份印记（散修/仙门/魔道）"`（trailer）。

---

## Task 3: xian 去 maxTurns + 结局重挂到寿元将尽

**Files:**
- Modify: `src/scenarios/xian.ts`（去 `maxTurns`，重写 `endings`）
- Test: `src/scenarios/xian.test.ts`

**Interfaces:**
- Consumes: L1 `checkEnding(sc, attrs, completedTurns, flags)`（emergent：无 maxTurns 不在固定回合收场；普通结局循环支持 `has()` + 复合条件）。
- Produces: xian 无 `maxTurns`；endings 为下列「死亡/飞升/堕魔 + 寿元将尽按境界分流」集合。

- [ ] **Step 1: 写失败测试** — 追加到 `xian.test.ts`：

```ts
import { checkEnding } from '../engine/state'

describe('xian 结局重挂', () => {
  it('无 maxTurns：第 30 回合不自动收场', () => {
    expect(checkEnding(xian, { cultivation: 40, daoHeart: 50, lifespan: 40 }, 30, ['筑基'])).toBeNull()
  })
  it('寿元将尽按境界分流', () => {
    expect(checkEnding(xian, { cultivation: 70, daoHeart: 60, lifespan: 8 }, 40, ['筑基', '金丹'])?.tone).toBe('金丹寿尽·享寿千载')
    expect(checkEnding(xian, { cultivation: 15, daoHeart: 50, lifespan: 8 }, 40, [])?.tone).toBe('炼气蹉跎·泯然众生')
  })
  it('飞升不受寿元门控，到点即触', () => {
    expect(checkEnding(xian, { cultivation: 96, daoHeart: 75, lifespan: 50 }, 20, ['筑基','金丹','元婴','化神'])?.tone).toBe('渡劫飞升·得道成仙')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "结局重挂"` → FAIL（第 30 回合返回 '落幕'；新 tone 不存在）。

- [ ] **Step 3: 实现** —
(a) 删除 `xian.ts` 的 `maxTurns: 30,` 行（其上 `turnUnit: '载',` 保留）。
(b) 整段替换 `endings: [ ... ]` 为下面的集合。**复用现有 epilogue 文案**：保留的结局（走火/油尽/跳出三界/飞升/形神俱灭/堕魔）原样保留；寿元将尽各档**沿用被替换的 maxTurns 结局的 epilogue 原文**（证道成圣→化神档、元婴大成→元婴档、金丹有成→金丹档、筑基有成→筑基档、蹉跎一生→炼气档），仅改 `condition` 与 `tone`。删除其余 maxTurns 结局。最终 endings（顺序即优先级）：

```
1. daoHeart<=0            → 走火入魔·身死道消        （原 epilogue 保留）
2. lifespan<=0            → 寿元耗尽·油尽坐化        （原 epilogue 保留；寿元真到 0 的兜底）
3. cultivation>=96 & daoHeart>=70  → 渡劫飞升·得道成仙   （原 epilogue 保留）
4. cultivation>=90 & daoHeart>=85  → 跳出三界·不在五行   （原 epilogue 保留）
5. cultivation>=96 & daoHeart<=30  → 强渡天劫·形神俱灭   （原 epilogue 保留）
6. daoHeart<=6           → 心魔加身·堕入魔道        （原 epilogue 保留）
7. lifespan<=8 & has(化神) → 仙逝得道·寿尽道存        （沿用「证道成圣·万仙来朝」epilogue 原文）
8. lifespan<=8 & has(元婴) → 元婴坐化·遗泽千秋        （沿用「元婴大成·一方仙尊」epilogue 原文）
9. lifespan<=8 & has(金丹) → 金丹寿尽·享寿千载        （沿用「金丹有成·寿享千载」epilogue 原文）
10. lifespan<=8 & has(筑基) → 筑基老死·山中岁月        （沿用「筑基有成·山中岁月」epilogue 原文）
11. lifespan<=8           → 炼气蹉跎·泯然众生        （沿用「蹉跎一生·泯然众修」epilogue 原文）
```

注：删除原有的 `lifespan<=6 回光返照`（被第 7-11 的 `lifespan<=8` 档覆盖，永不触发）及全部 `maxTurns & ...` 结局（其文案已被第 7-11 复用或退休）。`turnUnit:'载'` 保留。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS；`npx tsc --noEmit` → 0；`npx vitest run` 全绿（注意 invariants/content-integrity 可能因 xian 无 maxTurns 报错——若是，见 Task 7 放行；本步若被它们绊住，先记录，Task 7 修）。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 去 maxTurns 涌现长度 + 结局重挂寿元将尽按境界分流"`（trailer）。

---

## Task 4: xian 4 个核心突破机缘事件

**Files:**
- Modify: `src/scenarios/xian.ts`（localEvents 追加 4 个事件）
- Test: `src/scenarios/xian.test.ts`

**Interfaces:**
- Consumes: L1 `pickLocalEvent`（`requires` 支持 `has()`、`minTurn/maxTurn` 窗口）、`localTurn` 透传 outcomes、`applyChoice` 掷骰 outcomes 写 flags/回补/endTone。
- Produces: 4 个突破机缘事件，门控与回补如下表；成功授下一境界印记 + 回补寿元，失败重伤/走火。

| 境界 | requires | 窗口 minTurn/maxTurn | 成功(主选项 outcomes 高权重分支) | 失败分支 |
|---|---|---|---|---|
| 筑基 | `has(散修)`无所谓；`cultivation>=18` | 3 / 14 | flagsSet `['筑基']`, effects `{lifespan:+10, cultivation:+4}` | `{cultivation:-4, lifespan:-6}` |
| 金丹 | `has(筑基) & cultivation>=42` | 10 / 30 | flagsSet `['金丹']`, `{lifespan:+14, cultivation:+6}` | `{daoHeart:-10, lifespan:-8}` |
| 元婴 | `has(金丹) & cultivation>=66` | 24 / 55 | flagsSet `['元婴']`, `{lifespan:+18, cultivation:+8}` | `{daoHeart:-14, lifespan:-12}` |
| 化神 | `has(元婴) & cultivation>=86` | 45 / — | flagsSet `['化神']`, `{lifespan:+20, cultivation:+8}` | `{daoHeart:-16}`，可含 `endTone:'强渡天劫·形神俱灭'` 的孤注分支 |

设计要点：道心越低，失败分支权重越高（用一个**「稳妥」选项**=成功概率高但要求道心达标，与一个**「强行突破」选项**=高失败/走火，让玩家据道心抉择）。每事件 `keyMoment: true`，`once: true`（一生一次机缘）。

- [ ] **Step 1: 写失败测试** — 追加到 `xian.test.ts`（验证「拿到突破事件并取成功分支后，印记授予、封顶抬高」）：

```ts
import { localTurn } from '../engine/local'
import { applyChoice } from '../engine/state'

describe('xian 突破机缘', () => {
  it('筑基机缘成功授「筑基」印记并解锁更高修为', () => {
    // 构造：修为 19（炼气顶）、第 5 回合、散修开局
    let st = initState(xian, xian.openings!.find((o) => o.name === '草根散修'))
    st = { ...st, attributes: { cultivation: 19, daoHeart: 60, lifespan: 55 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    // 直接构造一个筑基突破 TurnResult（取自事件池中 summary 含「筑基」的事件）
    const ev = (xian.localEvents ?? []).find((e) => e.summary.includes('筑基') && e.keyMoment)
    expect(ev).toBeTruthy()
    // 取其「稳妥成功」选项（带 outcomes，成功分支 flagsSet 含 筑基）
    const tr = { narrative: ev!.narrative, summary: ev!.summary, choices: ev!.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('筑基')) || (c.flagsSet ?? []).includes('筑基'))
    expect(idx).toBeGreaterThanOrEqual(0)
    // rng=0 取首个 outcome（事件作者把成功分支放第一、权重最高）
    const next = applyChoice(xian, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('筑基')
    // 现在修为可超过 20（封顶已抬到 45）
    expect(clampEffects(xian, next.attributes, { cultivation: 30 }, next.flags!).cultivation).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "突破机缘"` → FAIL（找不到筑基 keyMoment 事件）。

- [ ] **Step 3: 实现** — 在 `xian.ts` 的 `localEvents` 数组追加 4 个突破机缘事件。每个按上表的 `requires`/`minTurn`/`maxTurn`/`once:true`/`keyMoment:true`；`choices` 至少两项：「稳妥」（首项，`outcomes` 成功分支权重高、`flagsSet:[下一境界]`、`effects` 含 lifespan 回补；失败分支低权重、按上表 damage）与「强行突破」（成功权重更低、失败更重、化神事件失败分支可带 `endTone`）。`summary` 含境界名（如「筑基机缘」），`narrative`/选项文案用 xian 仙气文风现写（参照文件中现有事件与 epilogue 的语气）。成功分支 `reaction` 给突破喜讯。**门控与窗口务必照上表**，确保按序解锁、错过即难再遇。

  （实现者：保持每事件结构与文件中既有 localEvent 一致；`outcomes` 字段见 L1 schema：`{weight, effects?, reaction?, flagsSet?, flagsClear?, endTone?}`。）

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS；`npx tsc --noEmit` → 0；`npx vitest run` 全绿。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 4 个核心突破机缘事件（窗口+道心门控+成败 outcomes）"`（trailer）。

---

## Task 5: storage 存档版本作废旧档

**Files:**
- Modify: `src/storage.ts`
- Test: `src/storage.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `SAVE_VERSION` 常量；`SaveGame` 写入带 `v: SAVE_VERSION`；`validateSaveGame` 对缺失/不符版本的存档返回 `null`（旧档作废，不迁移）。

- [ ] **Step 1: 写失败测试** — 追加到 `src/storage.test.ts`：

```ts
import { validateSaveGame, SAVE_VERSION } from './storage'

describe('存档版本作废', () => {
  const xianSave = (v?: number) => ({
    v, scenario: builtinScenarios.find((s) => s.id === 'xian'),
    state: { scenarioId: 'xian', attributes: { cultivation: 10, daoHeart: 50, lifespan: 60 }, history: [] },
    pendingTurn: null,
  })
  it('无版本/旧版本的存档作废为 null', () => {
    expect(validateSaveGame(xianSave(undefined))).toBeNull()
    expect(validateSaveGame(xianSave(SAVE_VERSION - 1))).toBeNull()
  })
  it('当前版本存档正常加载', () => {
    expect(validateSaveGame(xianSave(SAVE_VERSION))).not.toBeNull()
  })
})
```
（`builtinScenarios` 已在 storage.test.ts 顶部导入；若无则加 `import { builtinScenarios } from './scenarios'`。）

- [ ] **Step 2: 跑红** — `npx vitest run src/storage.test.ts -t "版本作废"` → FAIL（无 SAVE_VERSION / 旧档未作废）。

- [ ] **Step 3: 实现** — 在 `src/storage.ts`：
(a) 加 `export const SAVE_VERSION = 2`（紧邻其它 KEY 常量）。
(b) `SaveGame` 接口加 `v?: number`。
(c) `validateSaveGame` 开头加版本校验（在 `if (!d || typeof d !== 'object') return null` 之后）：
```ts
    if (d.v !== SAVE_VERSION) return null
```
(d) `saveSave`、`saveToSlot` 写入时带版本：`saveSave` 改为 `localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, v: SAVE_VERSION }))`；`saveToSlot` 的 `game` 同样补 `v`。

- [ ] **Step 4: 跑绿** — `npx vitest run src/storage.test.ts` → PASS；`npx tsc --noEmit` → 0；`npx vitest run` 全绿（注意：既有 storage 测试若构造 SaveGame 未带 v 会被作废——按需在那些测试的 fixture 补 `v: SAVE_VERSION`，这属必要修正）。

- [ ] **Step 5: Commit** — `git add src/storage.ts src/storage.test.ts && git commit -m "feat(storage): SAVE_VERSION 作废结构已变的旧存档"`（trailer）。

---

## Task 6: 守护测试 / 不变量放行涌现 xian

**Files:**
- Modify:（按需）`src/scenarios/invariants.test.ts`、`src/scenarios/content-integrity.test.ts`
- Test: 同上

**Interfaces:**
- Consumes: 无。
- Produces: 既有不变量在 xian 无 `maxTurns` 时不误报；新增守护：xian 过 schema、所有结局条件可解析、存在 4 个 keyMoment 突破事件。

- [ ] **Step 1: 跑全量找出被绊的断言** — `npx vitest run` 2>&1，定位因 xian 无 maxTurns / 新印记结局而失败的具体断言（如 invariants 里假设每剧本有 maxTurns、或事件 minTurn<=maxTurns 的检查）。把失败列表记入报告。

- [ ] **Step 2: 写守护测试** — 在 `src/scenarios/xian.test.ts` 追加：

```ts
import { parseCondition } from '../engine/condition'
describe('xian 守护', () => {
  it('结局条件全部可解析（含 has()）', () => {
    for (const e of xian.endings) expect(() => parseCondition(e.condition)).not.toThrow()
  })
  it('四境界突破事件齐备（keyMoment）', () => {
    const km = (xian.localEvents ?? []).filter((e) => e.keyMoment && /筑基|金丹|元婴|化神/.test(e.summary))
    expect(km.length).toBeGreaterThanOrEqual(4)
  })
})
```

- [ ] **Step 3: 放行既有不变量** — 对 Step 1 找到的每处断言，加 `maxTurns !== undefined` 守卫（仅在该断言依赖 maxTurns 时跳过涌现剧本），不放松对仍有 maxTurns 剧本的校验。若 Step 1 没有失败，跳过本步并在报告说明。

- [ ] **Step 4: 跑绿** — `npx vitest run` 全绿；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "test(xian): 守护测试 + 不变量放行涌现剧本"`（trailer）。

---

## Task 7: sim 扩展度量 + 重平衡到目标

**Files:**
- Modify: `scripts/sim-balance.ts`；按调参需要回改 `src/scenarios/xian.ts`（数值）
- Test: 运行 sim（非单测）

**Interfaces:**
- Consumes: 真实引擎 + xian 新 config。
- Produces: sim 输出每策略的「最高境界达成分布 / 飞升率 / 收场回合分布（含 <10 占比）/ 死亡率」；xian 数值调到满足目标。

- [ ] **Step 1: 扩展 sim** — 在 `scripts/sim-balance.ts` 的统计里加：最高境界（取 `st.flags` 中 化神>元婴>金丹>筑基>炼气 的最高者）、飞升率（结局 tone 含「飞升」）、收场回合分布桶（`<10`、`10-29`、`30-59`、`60+`）。打印每策略这些指标。（纯增量，不破坏既有输出。）

- [ ] **Step 2: 跑基线** — `npx vite-node scripts/sim-balance.ts xian 3000`，记录当前（Task1-4 后）指标。

- [ ] **Step 3: 调参达标** — 目标：
  - `P(收场回合<10) == 0`（survive/random/greedy 三策略皆是）；
  - 技术流(survive)飞升率为个位数 %（>0、<~10%）；
  - 卡关/低境界「寿元将尽」类结局是 random/被动玩法的常见归宿；
  - 死亡（走火/形神/油尽真到 0）有真实占比（非 0）。
  调整对象（在 `xian.ts`）：突破窗口 minTurn/maxTurn、突破 requires 阈值、成功/失败 outcomes 权重与 effects、lifespan decay/初始/上限档位、寿元将尽阈值（如需从 8 微调）。**每次只调少量、重跑 sim 对照**，直到全部目标命中。把最终指标写入报告。

- [ ] **Step 4: 回归** — 调参后 `npx vitest run`（xian.test.ts 的断言若因数值微调失配则同步更新断言为新真值）全绿；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add scripts/sim-balance.ts src/scenarios/xian.ts && git commit -m "balance(xian): sim 度量境界/飞升/收场回合，调参达标（飞升稀有、无<10回合收场）"`（trailer）。

---

## Self-Review

- **Spec 覆盖**：§2 时间/寿元(Task1 寿元 unlocks + Task4 突破回补 + 文案在 L2b/L2c) ✓；§3 境界阶梯+突破(Task1+Task4) ✓；§4 身份印记(Task2；起点分化已注明移 L2b) ✓；§5 结局重挂(Task3)+10回合下限&平衡(Task7) ✓；§6 触点(xian/storage/sim/不变量=Task1-7) ✓；存档作废(Task5) ✓。
- **占位符**：机械部分（条件/effects/flags/窗口/schema/版本）均给确切值；新突破事件的叙事散文为「按 xian 文风现写」的内容简报（参照文件既有 epilogue），非代码占位；结局散文复用文件内既有 epilogue 原文（按名指明）。
- **类型一致**：`clampEffects(...,flags)`、`checkEnding(...,flags)`、`initState(sc,opening)`、`applyChoice(...,rng)`、`outcomes`/`flagsSet`/`endTone` 字段名与 L1 一致；印记名（筑基/金丹/元婴/化神/散修/仙门/魔道）全程一致。
- **顺序依赖**：Task3 去 maxTurns 可能绊到既有不变量 → Task6 放行（Task3 Step4 已提示先记录）。Task7 调参可能回改 Task1/4 数值并同步 Task1-4 的断言。执行须按序。
- **范围**：L2b（身份起点分化/支线、因果种子、隐藏天堂地狱）、L2c（AI schema+systemPrompt）不在本计划。

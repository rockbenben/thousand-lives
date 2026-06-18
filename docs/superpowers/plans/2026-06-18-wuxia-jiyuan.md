# 武侠机缘体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 xian 已验证的机缘体系（境界封顶+突破印记+身份弧+因果+隐藏endTone+keyMoment+C式赌命apex+AI镜像）完整移植到 `wuxia`（快意江湖），主题化为江湖武学境界，保持软上限 30 年。

**Architecture:** 纯内容/配置改动，零引擎改动——全部复用 L1 的 `ceiling`/`ceilingUnlocks`/`outcomes`/`endTone`/`keyMoment`/`flags`（condition 语言 `has()`）。在 `src/scenarios/wuxia.ts` 上「加字段、retrofit 既有事件、改 apex 两结局 condition 为哨兵」；新建 `src/scenarios/wuxia.test.ts`；sim 用现成 `scripts/sim-balance.ts`。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints

- **长度保持软上限 `maxTurns: 30`**（不改涌现）；现有 ~20 个 maxTurns 阈值善终结局**不动**。
- **`life`（性命）不加 ceiling/ceilingUnlocks**；`fame`（侠名）也不加。**只有 `gongfu`（武功）有境界阶梯**。
- **一代宗师/武林至尊 apex 保持极稀有**：apex 只能经 §apex 渡劫事件的 `endTone` 触发，被动阈值废除（改哨兵 `life<=-1`）。sim 守门：survive 登顶近 0、各策略个位数%。
- 境界印记名固定四个、按序：`入流`→`一流`→`绝顶`→`宗师`，不得越级。
- 哨兵 condition 用 `life<=-1`（`life.deathBelow===0`，`invariants.test.ts` A2 已豁免 `value<deathBelow` 的 `<=` 隐藏结局）。
- 测试 Vitest；每个 Task 提交前 `npx tsc --noEmit` 干净、全量 `npx vitest run` 绿。
- 提交信息结尾两行 trailer：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- sim 数字由控制器亲验，不信任 agent 自报。

## File Structure

- `src/scenarios/wuxia.ts`（修改）：唯一内容文件。武功加封顶、开局加 flag、突破事件 retrofit、身份事件 gate、apex 两结局改哨兵 + 新增致死结局、apex 事件改造、隐藏 endTone、systemPrompt 补段。
- `src/scenarios/wuxia.test.ts`（新建）：本题材的封顶/印记链/apex哨兵/身份gate/AI词表/守护断言。
- `scripts/sim-balance.ts`（沿用，不改）。
- `src/scenarios/invariants.test.ts`（通常无需改；若跨题材守护对新哨兵结局报错则按 xian 同款修；预期不需要）。

参考样板（只读，勿改）：`src/scenarios/xian.ts`（ceilingUnlocks 第 13-21/52-57 行；apex 结局哨兵第 101-118、156-174 行；「九重天劫」apex 事件第 1114-1147 行）、`src/scenarios/xian.test.ts`（封顶/哨兵/keyMoment/突破授印记断言）。

---

## Task 1: 武功境界封顶阶梯（§1/§2）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（`gongfu` 属性，约第 10-22 行）
- Create: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: L1 `clampEffects(sc, attrs, effects, flags)`、`effectiveCeiling`（已实现，按已解锁印记取最高 max）。
- Produces: `gongfu` 带 `ceiling: 30` + `ceilingUnlocks: [{flag:'入流',max:50},{flag:'一流',max:70},{flag:'绝顶',max:88},{flag:'宗师',max:100}]`。后续 Task 3/4 的突破事件靠这些印记抬升封顶。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/wuxia.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { wuxia } from './wuxia'
import { initState, applyChoice, clampEffects, checkEnding } from '../engine/state'

describe('wuxia 武功境界封顶', () => {
  it('无境界印记时武功封顶 30', () => {
    expect(clampEffects(wuxia, { gongfu: 28 }, { gongfu: 50 }, []).gongfu).toBe(30)
  })
  it('入流印记解锁封顶 50', () => {
    expect(clampEffects(wuxia, { gongfu: 45 }, { gongfu: 50 }, ['入流']).gongfu).toBe(50)
  })
  it('一流印记解锁封顶 70', () => {
    expect(clampEffects(wuxia, { gongfu: 60 }, { gongfu: 50 }, ['入流', '一流']).gongfu).toBe(70)
  })
  it('绝顶印记解锁封顶 88', () => {
    expect(clampEffects(wuxia, { gongfu: 80 }, { gongfu: 50 }, ['入流', '一流', '绝顶']).gongfu).toBe(88)
  })
  it('宗师印记解锁封顶 100', () => {
    expect(clampEffects(wuxia, { gongfu: 95 }, { gongfu: 50 }, ['入流', '一流', '绝顶', '宗师']).gongfu).toBe(100)
  })
  it('性命与侠名不设境界封顶（高于任何印记仍可到 max）', () => {
    expect(clampEffects(wuxia, { life: 95 }, { life: 50 }, []).life).toBe(100)
    expect(clampEffects(wuxia, { fame: 95 }, { fame: 50 }, []).fame).toBe(100)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "境界封顶"` → FAIL（当前 gongfu 无 ceiling，封顶测试得 62/100 等而非 30/50）。

- [ ] **Step 3: 实现** — 在 `wuxia.ts` 的 `gongfu` 属性里加 `ceiling` 与 `ceilingUnlocks`（保留现有 `bands` 不动）：

```ts
{
  key: 'gongfu',
  name: '武功',
  initial: 12,
  max: 100,
  ceiling: 30,
  ceilingUnlocks: [
    { flag: '入流', max: 50 },
    { flag: '一流', max: 70 },
    { flag: '绝顶', max: 88 },
    { flag: '宗师', max: 100 },
  ],
  bands: [ /* 保持原样 */ ],
},
```

`life`、`fame` 属性**不加** `ceiling`/`ceilingUnlocks`（确认它们仍是原样）。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/scenarios/wuxia.ts src/scenarios/wuxia.test.ts && git commit`（trailer）：`feat(wuxia): 武功境界封顶阶梯（入流/一流/绝顶/宗师 ceilingUnlocks）`

---

## Task 2: 身份印记 + 身份事件门控（§4 身份）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（`openings`，约第 53-57 行；身份相关 localEvents 的 `requires`）
- Modify: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: L1 `initState`（opening.flag 写入 `st.flags`）、condition `has(X)`/`!has(X)`。
- Produces: 3 开局各带 flag（`市井孤儿`/`名门弟子`/`灭门遗孤`）；名门/遗孤专属事件加 `has()` gate。

- [ ] **Step 1: 写失败测试** — 在 `wuxia.test.ts` 追加：

```ts
import { evalCondition } from '../engine/condition'
import { parseCondition } from '../engine/condition'

describe('wuxia 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const names = ['市井孤儿', '名门弟子', '灭门遗孤']
    for (const n of names) {
      const op = wuxia.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(wuxia, op).flags).toContain(n)
    }
  })
  it('名门专属事件带 has(名门弟子) 门控', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '师兄刁难')
    expect(ev?.requires).toContain('has(名门弟子)')
  })
  it('灭门遗孤专属事件带 has(灭门遗孤) 门控', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '残谱现世')
    expect(ev?.requires).toContain('has(灭门遗孤)')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "身份印记"` → FAIL（openings 无 flag、事件无 has gate）。

- [ ] **Step 3: 实现** —
(a) `openings` 加 flag：
```ts
openings: [
  { name: '市井孤儿', flag: '市井孤儿', prompt: '街头长大、机敏狠辣，一身拳脚全靠偷师与拼命换来，无门无派、举目无亲。' },
  { name: '名门弟子', flag: '名门弟子', prompt: '名门大派的入室弟子，根基正统、师门庇佑，却背负沉重的门规与门户之争。' },
  { name: '灭门遗孤', flag: '灭门遗孤', prompt: '满门被屠的唯一幸存者，怀着血海深仇与一本残缺的家传武学残谱。' },
],
```
(b) 给身份专属事件加/合并 `requires`（若该事件已有 requires，用 ` & ` 串接，**不要**覆盖原条件）：
- **名门弟子专属**（初入师门设定本就该身份）：`名门收徒`、`师兄刁难`、`师门蒙冤` → 加 `has(名门弟子)`。例：`师兄刁难` 原 `minTurn: 4` 无 requires → 加 `requires: 'has(名门弟子)'`；`名门收徒` 原 `minTurn: 3` → 加 `requires: 'has(名门弟子)'`。
- **灭门遗孤专属**（家传残谱/血仇）：`残谱现世`(原 once/minTurn1，无 requires)→ `requires: 'has(灭门遗孤)'`；`残谱补全`(原 `requires: 'gongfu>=60'`)→ `requires: 'has(灭门遗孤) & gongfu>=60'`；`血仇真相`(原 `requires: 'gongfu>=65'`)→ `requires: 'has(灭门遗孤) & gongfu>=65'`。
- **市井孤儿倾斜**（至少 1 个）：`街头拳师`(原 minTurn1)→ 加 `requires: 'has(市井孤儿)'`（偷师底层味，归孤儿）。
- 其余通用事件（山道劫匪/黑店惊魂/以武会友/破庙佛肚藏经等）**不加**身份 gate。

> 注：`残谱现世` 是 `灭门遗孤` 复仇弧起点且 `itemsGained: ['家传残谱']`；`险些走火`/`残谱补全` 等 `requiresItem: '家传残谱'` 的事件因此天然只对走通残谱线者开放——加 `has(灭门遗孤)` 后逻辑自洽，无需改 requiresItem。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(wuxia): 三开局身份印记 + 名门/遗孤/孤儿身份事件门控`

---

## Task 3: 三道突破闸门 入流/一流/绝顶（§3）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（事件 `秘籍到手`/`闭关参悟`/`内功突破`）
- Modify: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: Task 1 的 ceilingUnlocks；L1 `applyChoice`（同回合先 applyFlags 再 clampEffects，突破当回合武功可达新上限）；keyMoment 涌现节奏（每 4 回合：年 4/8/12/16/20/24/28）。
- Produces: 3 个 `keyMoment:true` 突破事件，突破选项带 `flagsSet:['下一印记']`，按 `入流→一流→绝顶` 串成 requires 链。第 4 道（宗师）由 Task 4 的 apex 事件承担。

- [ ] **Step 1: 写失败测试** — 在 `wuxia.test.ts` 追加（仿 xian.test.ts 的突破授印记断言）：

```ts
describe('wuxia 突破闸门', () => {
  it('三道突破机缘均为 keyMoment 且授对应境界印记', () => {
    const want = [
      { summary: '秘籍到手', flag: '入流' },
      { summary: '闭关参悟', flag: '一流' },
      { summary: '内功突破', flag: '绝顶' },
    ]
    for (const w of want) {
      const ev = (wuxia.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const grants = ev!.choices.some(
        (c) => (c.flagsSet ?? []).includes(w.flag) || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes(w.flag)),
      )
      expect(grants, w.summary).toBe(true)
    }
  })
  it('入流突破后同回合武功可破 30 上限', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '市井孤儿'))
    st = { ...st, attributes: { gongfu: 28, fame: 40, life: 70 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '秘籍到手')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('入流') || (c.outcomes ?? []).some((o) => (o.flagsSet ?? []).includes('入流')))
    expect(idx).toBeGreaterThanOrEqual(0)
    const next = applyChoice(wuxia, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('入流')
    expect(next.attributes.gongfu).toBeGreaterThan(30) // 封顶已抬到 50
  })
  it('一流闸门需先有入流印记（requires 串链）', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '闭关参悟')!
    expect(ev.requires).toContain('has(入流)')
    const ev3 = (wuxia.localEvents ?? []).find((e) => e.summary === '内功突破')!
    expect(ev3.requires).toContain('has(一流)')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "突破闸门"` → FAIL（事件非 keyMoment、无 flagsSet、requires 未串链）。

- [ ] **Step 3: 实现** — 对三个事件做精确 retrofit（保留原叙事/reaction，仅改字段与突破选项的 effects/flagsSet/事件级 requires·keyMoment·minTurn）：

**① `秘籍到手`（入流闸门）** — 当前 `once: true, minTurn: 9, itemsGained: ['武学秘籍']`，choices[0]=`{ text: '如获至宝，潜心钻研', effects: { gongfu: 10, life: -2 } }`：
- 事件级加 `keyMoment: true`、`requires: 'gongfu>=26'`，`minTurn` 9 → `4`（保留 once 与 itemsGained）。
- choices[0] 改为 `{ text: '如获至宝，潜心钻研', effects: { gongfu: 30, life: -2 }, flagsSet: ['入流'] }`（gongfu 增益放大到能冲上新上限 50；reaction 保留）。
- choices[1]（只录其要）不动、不授印记。

**② `闭关参悟`（一流闸门）** — 当前 `requiresItem: '武学秘籍', requires: 'gongfu>=50', minTurn: 18`，choices[0]=`{ text: '闭关数载，参透秘籍', effects: { gongfu: 14, fame: -4, life: -4 } }`：
- 事件级 `requires` 改为 `'has(入流) & gongfu>=46'`（保留 requiresItem: '武学秘籍'）；加 `keyMoment: true`；`minTurn` 18 → `12`。
- choices[0] 改为 `{ text: '闭关数载，参透秘籍', effects: { gongfu: 30, fame: -4, life: -4 }, flagsSet: ['一流'] }`（冲上新上限 70；reaction 保留）。
- choices[1] 不动。

**③ `内功突破`（绝顶闸门）** — 当前 `requires: 'gongfu>=65', minTurn: 20`，choices[0]=`{ text: '心无旁骛，全力冲关', effects: { gongfu: 14, life: -8 } }`：
- 事件级 `requires` 改为 `'has(一流) & gongfu>=66'`；加 `keyMoment: true`；`minTurn` 20 → `16`。
- choices[0] 改为 `{ text: '心无旁骛，全力冲关', effects: { gongfu: 24, life: -8 }, flagsSet: ['绝顶'] }`（冲上新上限 88；reaction 保留）。
- choices[1] 不动。

> 闸门窗口（minTurn 4/12/16）须落在 keyMoment 抽取的 key 回合（年 4/8/12/16/20/24/28）上——已对齐。若 Task 7 sim 显示某闸门 reach 率过低（<~30%），放宽其 minTurn 或抬其 `weight`，**不改 flagsSet/印记链**。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(wuxia): 三道突破机缘闸门（秘籍到手→入流/闭关参悟→一流/内功突破→绝顶），keyMoment+授印记+串链`

---

## Task 4: C 式 apex 渡劫（宗师闸门 + 两 apex 结局改哨兵 + 走火入魔致死结局）（§5/§6 apex）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（两 apex 结局 condition；新增致死结局；事件 `泰山论剑` 改造为 apex 闸门）
- Modify: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: Task 1（绝顶 ceiling 88）、Task 3（绝顶印记链）。L1：`endTone` 强制结局、`outcomes` 加权掷骰、哨兵 condition。
- Produces: `武林至尊·一代宗师` 与 `武功盖世·终成独夫` 两结局 condition → `life<=-1`（不再被动）；新增 `走火入魔·经脉俱断` 致死结局；`泰山论剑` 成 `keyMoment+once` 的 apex 闸门（`requires:'has(绝顶) & gongfu>=85'`），三选项含 endTone outcomes，成功分支授 `flagsSet:['宗师']`。

- [ ] **Step 1: 写失败测试** — 在 `wuxia.test.ts` 追加：

```ts
describe('wuxia C 式 apex 渡劫', () => {
  it('两 apex 结局改哨兵，高武功高侠名也不被动触发', () => {
    // 满血绝顶高武高侠名，回合 28：被动 apex 不应触发
    const r = checkEnding(wuxia, { gongfu: 96, fame: 80, life: 70 }, 28, ['入流', '一流', '绝顶'])
    expect(r?.tone === '武林至尊·一代宗师').toBe(false)
    expect(r?.tone === '武功盖世·终成独夫').toBe(false)
  })
  it('apex 闸门事件结构：keyMoment+once、requires 绝顶、三选项含 endTone', () => {
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '泰山论剑')!
    expect(ev.keyMoment).toBe(true)
    expect(ev.once).toBe(true)
    expect(ev.requires).toContain('has(绝顶)')
    // 全力一搏选项含三态 endTone（至尊/独夫/走火入魔）
    const bold = ev.choices.find((c) => (c.outcomes ?? []).some((o) => o.endTone === '武林至尊·一代宗师'))!
    const tones = (bold.outcomes ?? []).map((o) => o.endTone)
    expect(tones).toContain('武林至尊·一代宗师')
    expect(tones).toContain('走火入魔·经脉俱断')
    // 避险选项不带 endTone
    const safe = ev.choices.find((c) => !(c.outcomes ?? []).length && !c.endTone)
    expect(safe).toBeTruthy()
  })
  it('迎劫成功分支 → 武林至尊；失败分支 → 走火入魔', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '名门弟子'))
    st = { ...st, attributes: { gongfu: 88, fame: 70, life: 60 }, flags: ['入流', '一流', '绝顶'], history: Array(24).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '泰山论剑')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const boldIdx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '武林至尊·一代宗师'))
    // rng=0 取首个 outcome（成功·至尊放第一）
    const win = applyChoice(wuxia, st, tr as any, boldIdx, () => 0)
    expect(win.ended?.tone).toBe('武林至尊·一代宗师')
    // rng=0.99 取末个 outcome（走火入魔放最后）
    const lose = applyChoice(wuxia, st, tr as any, boldIdx, () => 0.99)
    expect(lose.ended?.tone).toBe('走火入魔·经脉俱断')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "apex 渡劫"` → FAIL（apex 仍被动阈值、泰山论剑仍普通事件、无走火入魔结局）。

- [ ] **Step 3: 实现** —
(a) **两 apex 结局 condition 改哨兵**（tone/epilogue 不变）：
- `武林至尊·一代宗师`：`condition: 'gongfu>=96 & fame>=70'` → `condition: 'life<=-1'`
- `武功盖世·终成独夫`：`condition: 'gongfu>=96'` → `condition: 'life<=-1'`
- 其余 maxTurns 阈值善终结局（侠之大者/功成名就/名满天下…）**全部不动**。

(b) **新增致死结局**（放在 endings 数组里，挨着其它 life<=-1 哨兵结局；走火入魔，给独立 epilogue）：
```ts
{
  condition: 'life<=-1',
  tone: '走火入魔·经脉俱断',
  epilogue:
    '冲击武学化境的刹那，你体内奔涌的真气终于挣脱了束缚，如脱缰野马在经脉里横冲直撞。你拼命想压住那股暴走的劲力，却只觉五脏俱裂、七窍渗血——多年苦修的一身功力，反成了反噬自己的利刃。你倒在冷硬的青石上，眼前最后映出的，是那座终究没能登上的武学之巅。一代天骄，竟止步于咫尺之遥。',
},
```

(c) **`泰山论剑` 改造为 apex 闸门**（当前 `requires: 'gongfu>=78', minTurn: 27, weight: 1.2`，两个普通选项）。整体替换为以下事件对象（narrative 改写为冲击武学化境的赌命；三选项仿 xian「九重天劫」）：
```ts
{
  narrative:
    '三十年刀光剑影，所有的苦熬、伤痛与不悔，都将在这一刻交出答卷。你立于绝顶，气血鼓荡如沸，那横亘在「绝顶」与「宗师」之间的最后一道壁障在眼前若隐若现——只差临门一脚，便是举手投足皆成绝招的武学化境，是后人仰望的一代宗师。可你也清楚，强冲这道关隘九死一生：成，则脱胎换骨、武道登顶；败，则真气暴走、经脉俱断，三十年功业毁于一旦。冲，还是不冲？',
  choices: [
    {
      text: '全力一搏，冲击武学化境',
      effects: {},
      outcomes: [
        { weight: 2, effects: {}, flagsSet: ['宗师'], endTone: '武林至尊·一代宗师', reaction: '你长啸一声，将毕生所学尽数倾出，硬撼那道壁障。剑气冲霄、天地变色——待那口真气贯通周身百脉的刹那，你只觉眼前豁然开朗，举手投足已是另一重天地。你成了，真真正正的一代宗师。' },
        { weight: 1, effects: {}, flagsSet: ['宗师'], endTone: '武功盖世·终成独夫', reaction: '你以一身孤绝杀伐之气强行破关，武功臻至化境——可那贯通周身的，除了浩荡内力，还有多年厮杀积下、化不开的冷硬戾气。你站上武道之巅，却发现四下空荡，再无一人。' },
        { weight: 4, effects: {}, endTone: '走火入魔·经脉俱断', reaction: '壁障未破，反噬已至。被你强行催动的真气在经脉里轰然炸开，你嘶吼着想压制，终究晚了一步——血肉翻涌、百脉俱断，三十年苦功化作了催命的烈焰。' },
      ],
    },
    {
      text: '借天时地利，稳中冲关',
      effects: { life: -6 },
      outcomes: [
        { weight: 4, effects: {}, flagsSet: ['宗师'], endTone: '武林至尊·一代宗师', reaction: '你不急于求成，借一处绝地灵气、择一个吉时，将那道壁障一寸寸磨穿。当最后一线桎梏崩解，你气定神闲地睁开眼——水到渠成，再无凶险，一代宗师之名自此实至名归。' },
        { weight: 1, effects: {}, flagsSet: ['宗师'], endTone: '武功盖世·终成独夫', reaction: '你稳稳破关登顶，武功盖世再无敌手。只是登顶那日回望来路，当年并肩的人早已散尽，唯余你一人立于高处，听风声呼啸。' },
        { weight: 2, effects: {}, endTone: '走火入魔·经脉俱断', reaction: '纵是步步为营，这最后一关终究太险。真气在临门一脚处骤然失控，你拼尽全力也没拉住——经脉寸断的剧痛里，你眼睁睁看着武学之巅在眼前崩碎。' },
      ],
    },
    {
      text: '急流勇退，不强一搏',
      effects: { fame: -3 },
      reaction: '你凝视那道壁障良久，终是缓缓收了引而待发的真气。强求未必能成，何苦拿三十年功业去赌这一线？你含笑转身——做不成宗师，做个逍遥自在的绝顶高手，又有何妨。江湖上有人惋惜你功亏一篑，你只当耳旁风。',
    },
  ],
  summary: '泰山论剑',
  requires: 'has(绝顶) & gongfu>=85',
  keyMoment: true,
  once: true,
  minTurn: 24,
  weight: 1.4,
},
```

> 成功分支授 `flagsSet:['宗师']` 虽即终局，但保证印记语义完整 + AI 词表一致（`宗师` 在 ceilingUnlocks 中）。avalanche：`急流勇退` 不带 endTone → 留在绝顶，最终走 maxTurns 善终。avoid-死者选它 → 永不 apex。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(wuxia): C式apex渡劫——泰山论剑改赌命闸门，两apex结局改哨兵，新增走火入魔致死结局`

---

## Task 5: 隐藏 endTone（走火入魔/暴毙 + 奇缘窗口）（§7）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（凶险事件 `运功撞墙吐血`/`险些走火`/`中毒暗算` 加低权 endTone outcome；新增 1 致死结局 + 1 奇缘结局）
- Modify: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: L1 `outcomes`（choice 有 outcomes 时按权重掷骰，忽略顶层 effects）、`endTone` 强制结局、哨兵 condition。
- Produces: 2-3 个凶险事件的「逞强」选项获极低权致死 endTone 分支；新增 `暗伤迸发·暴毙荒途`（致死）与 `奇缘证道·剑道通玄`（稀有天堂）两结局，均哨兵 condition；AI 词表 hiddenTones 自动收录。

- [ ] **Step 1: 写失败测试** — 在 `wuxia.test.ts` 追加：

```ts
describe('wuxia 隐藏 endTone', () => {
  it('凶险事件的逞强选项含低权致死 endTone', () => {
    const summaries = ['运功撞墙吐血', '险些走火', '中毒暗算']
    let found = 0
    for (const s of summaries) {
      const ev = (wuxia.localEvents ?? []).find((e) => e.summary === s)
      if (ev?.choices.some((c) => (c.outcomes ?? []).some((o) => /走火入魔|暴毙/.test(o.endTone ?? '')))) found++
    }
    expect(found).toBeGreaterThanOrEqual(2)
  })
  it('新增致死与奇缘隐藏结局存在且为哨兵 condition', () => {
    const die = wuxia.endings.find((e) => e.tone === '暗伤迸发·暴毙荒途')
    const heaven = wuxia.endings.find((e) => e.tone === '奇缘证道·剑道通玄')
    expect(die?.condition).toBe('life<=-1')
    expect(heaven?.condition).toBe('life<=-1')
  })
  it('暴毙 endTone 即终局', () => {
    let st = initState(wuxia, wuxia.openings!.find((o) => o.name === '市井孤儿'))
    st = { ...st, attributes: { gongfu: 50, fame: 40, life: 60 }, history: Array(12).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wuxia.localEvents ?? []).find((e) => e.summary === '运功撞墙吐血')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => /走火入魔|暴毙/.test(o.endTone ?? '')))
    const next = applyChoice(wuxia, st, tr as any, idx, () => 0.999) // 末个 outcome = 致死
    expect(next.ended?.reason).toBe('forced')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "隐藏 endTone"` → FAIL（事件无 endTone outcome、结局不存在）。

- [ ] **Step 3: 实现** —
(a) **新增两结局**（endings 数组，挨着其它 life<=-1 哨兵）：
```ts
{
  condition: 'life<=-1',
  tone: '暗伤迸发·暴毙荒途',
  epilogue:
    '那些年累下的暗伤旧创，终究在最不该发作的时刻一齐迸发。你正赶着夜路，忽觉胸口一窒，一口黑血涌上喉头，眼前天旋地转。你扶着路旁枯树缓缓滑坐下去，听着自己越来越微弱的心跳，竟连呼救的力气都没有。荒野长风呜咽而过，无人知晓一位曾搅动江湖的人物，就这样悄无声息地殁在了路旁。',
},
{
  condition: 'life<=-1',
  tone: '奇缘证道·剑道通玄',
  epilogue:
    '电光石火的一瞬，那困扰你多年的滞涩忽然尽数化开——刀光与心念合而为一，你看清了武学最深处那一线玄机。那一刻你周身气劲流转如江河入海，举手投足皆暗合天地至理，再无半分窒碍。世人只道你一夜之间脱胎换骨，却不知你是踩中了那道千载难逢、可遇不可求的奇缘。从此剑道通玄，江湖再无人能解你这一剑。',
},
```
(b) **凶险事件加低权致死 outcome**——把这些事件的「逞强」选项从纯 effects 改为 outcomes（保留原 effects 为高权常态分支 + 加一个低权 endTone 致死分支）：

**`运功撞墙吐血`**（choices[0]=`{ text:'主动寻强敌死斗，破而后立', effects:{ gongfu:12, life:-14 } }`，事件 minTurn 10）改为：
```ts
{ text: '主动寻强敌死斗，破而后立', effects: {}, outcomes: [
  { weight: 12, effects: { gongfu: 12, life: -14 }, reaction: '生死搏杀间你那堵高墙轰然洞开，真气贯通周身；那云游前辈远远见了，捻须长叹这后生竟真有破釜沉舟的胆魄。' },
  { weight: 1, effects: {}, endTone: '走火入魔·经脉俱断', reaction: '死斗到性命相搏处，你强催真气逆冲那道壁障，却在最凶险的一瞬心神一晃——气血轰然倒灌，经脉如遭雷殛，你连那破墙的喜悦都未及品尝，便已栽倒在血泊里。' },
] },
```
**`中毒暗算`**（minTurn 15；先 Read 该事件确认其最激进选项的 text 与 effects，按同法把该选项改为 `outcomes: [{weight:12, effects:<原effects>, reaction:<原reaction>}, {weight:1, effects:{}, endTone:'暗伤迸发·暴毙荒途', reaction:'……'}]`，reaction 写 1-2 句中毒攻心暴毙的凶险文案）。
**`险些走火`**（requiresItem 家传残谱，choices[0]=`{ text:'强提真气，闯过这一关', effects:{ gongfu:10, life:-12 } }`）同法加 `{ weight:1, effects:{}, endTone:'走火入魔·经脉俱断', reaction:'……' }`（reaction 写真气暴走、经脉俱断当场身死）。
(c) **奇缘窗口**（天堂 endTone）——选一个**晚期高武功**事件（如 `拈花化作剑气` minTurn28/gongfu>=85，或 `五绝论剑` minTurn26/gongfu>=80；先 Read 确认其选项），给其最进取选项加一个**极低权**（weight 1 对常态 weight ~20）`endTone: '奇缘证道·剑道通玄'` outcome，体现「电光石火间踩中奇缘、剑道通玄」。仅此一处奇缘，确保稀有。

> 致死/奇缘 outcome 权重起点：致死 1 : 常态 12（≈8%，且事件本身稀有）、奇缘 1 : 常态 20（≈5%）。Task 7 sim 据「暴毙不滥用、奇缘登顶 <1%」微调。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(wuxia): 隐藏endTone——凶险事件低权走火入魔/暴毙 + 稀有奇缘天堂结局`

---

## Task 6: AI 模式 systemPrompt 补 + prompt 注入回归（§8）

**Files:**
- Modify: `src/scenarios/wuxia.ts`（`systemPrompt`）
- Modify: `src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: L2c 已实现的 `scenarioUsesFlags(sc) = sc.openings?.some(o=>o.flag) || sc.attributes.some(a=>a.ceilingUnlocks)`、`flagVocab(sc)`、`buildTurnMessages`（usesFlags 时注入【当前印记】【境界封顶】+ 词表）。**不改 prompt.ts**。
- Produces: wuxia `systemPrompt` 含江湖境界封顶 + 走火入魔暴毙极稀的指导；测试确认 AI 提示自动注入印记/境界封顶/4 境界词表/隐藏 tone。

- [ ] **Step 1: 写失败测试** — 在 `wuxia.test.ts` 追加：

```ts
import { buildTurnMessages } from '../engine/prompt'

describe('wuxia AI 模式', () => {
  it('加 ceilingUnlocks+flag 后 scenarioUsesFlags 生效，提示注入印记/境界封顶/词表', () => {
    const st = initState(wuxia, wuxia.openings!.find((o) => o.name === '名门弟子'), undefined, 'ai')
    const sys = buildTurnMessages(wuxia, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('印记')
    expect(sys).toContain('封顶')
    // 4 境界词表入提示
    for (const f of ['入流', '一流', '绝顶', '宗师']) expect(sys).toContain(f)
    // 隐藏 tone 入提示（走火入魔/奇缘）
    expect(sys).toContain('走火入魔')
  })
  it('systemPrompt 含江湖境界封顶规则与走火入魔极稀指导', () => {
    expect(wuxia.systemPrompt).toContain('境界')
    expect(wuxia.systemPrompt).toContain('走火入魔')
  })
  it('有 maxTurns，提示用「共 30 载/年」而非「共 undefined」', () => {
    const st = initState(wuxia, wuxia.openings![0], undefined, 'ai')
    const msgs = buildTurnMessages(wuxia, st).map((m) => m.content).join('\n')
    expect(msgs).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/wuxia.test.ts -t "AI 模式"` → 第 1、3 条应已绿（Task1/4/5 落地后自动注入），第 2 条 FAIL（systemPrompt 尚无境界封顶/走火入魔段）。

- [ ] **Step 3: 实现** — 在 wuxia `systemPrompt` 末尾「文风简洁有侠气」前追加规则行（保持原有规则不动）：
```
- 江湖有境界之别：武功（gongfu）有「封顶」，到顶须真机缘（得秘籍、遇名师、顿悟、生死战）方破；让玩家进境时，在 JSON 里 flagsSet:["下一境界"]，境界印记只能取 入流→一流→绝顶→宗师，须按此序、不得越级
- 当前境界与封顶见【境界封顶】，未破境前武功增益会被压在当前上限，不要凭空越级
- 走火入魔、暗伤暴毙等无视一切的横死极其凶险，仅在真正九死一生处偶用 endTone 令本年即终局；天意难测，绝大多数年份不应出现
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/wuxia.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(wuxia): AI模式systemPrompt补江湖境界封顶+走火入魔极稀（印记/词表自动注入）`

---

## Task 7: 平衡 sim 守门 + 全量回归（§9）

**Files:**
- Modify（按需微调）：`src/scenarios/wuxia.ts`（apex/隐藏 outcome 权重、闸门窗口/weight）
- Modify（若数值调动断言）：`src/scenarios/wuxia.test.ts`

**Interfaces:**
- Consumes: `scripts/sim-balance.ts`（`npx vite-node scripts/sim-balance.ts wuxia 5000`，度量真死亡/坏结局/活到满期/登顶率/收场分布/最高境界分布；survive 策略已会跳过 lethal-endTone 选项）。
- Produces: 达标的平衡数值；最终 sim block 记入本 Task 报告。

- [ ] **Step 1: 跑 sim 基线** — `npx vite-node scripts/sim-balance.ts wuxia 5000`，记录 random/survive/greedy 三策略数字。

- [ ] **Step 2: 对照目标，微调** — 目标（同 spec §9）：
  - **apex（武林至尊+武功盖世·终成独夫）对所有策略稀有**，尤其 survive（避论剑）→ 近 0；各策略登顶个位数%。
  - **真死亡非零且论剑/走火入魔贡献明显**，random 死亡 ≤~55%。
  - **坏结局占比够**（公敌/油尽灯枯/碌碌半生等），给继续玩的动力。
  - **P(收场<10)=0** 三策略（apex/闸门 minTurn 晚）。
  - **乱点多止步低境界**（无印记/入流）；登顶/宗师 个位数%。
  - **突破闸门 reach 合理**（入流/一流/绝顶 达成率不应 ~0）。
  调节杠杆（小步、单改单跑）：apex 三选项 endTone 权重（走火入魔↑则 apex↓死亡↑）；隐藏致死/奇缘权重；闸门 `weight`/`minTurn`（reach 偏低则放宽）。**不改印记链结构与哨兵 condition**。

- [ ] **Step 3: 控制器亲验** — 控制器（非 agent）亲自重跑 `npx vite-node scripts/sim-balance.ts wuxia 5000`，确认上述指标达标；把最终 sim block 贴入报告。

- [ ] **Step 4: 全量回归** — `npx vitest run`（全题材绿，wuxia 数值若调则同步 wuxia.test.ts 断言）；`npx tsc --noEmit` → 0；`npx vite-node scripts/sim-balance.ts all 1000`（确认未连带影响其它题材）。

- [ ] **Step 5: Commit** — `fix(wuxia): 重 sim 守平衡（apex 稀有/死亡合理/坏结局够/P(<10)=0），记录最终 sim`

---

## Self-Review

- **Spec coverage**：§1/§2 封顶=Task1；§3 突破=Task3；§4 身份=Task2；§5/§6 apex=Task4；§6/§7 隐藏=Task5；§7 AI=Task6；§8 平衡=Task7。全覆盖。
- **Placeholder scan**：Task5 的 `中毒暗算`/奇缘事件要求实现者先 Read 确认选项再按给定模式改——给了精确转换模式（outcomes 结构 + 权重 + endTone 字符串）与样例，非占位；其余皆给确切代码。无 TBD/TODO。
- **Type consistency**：境界印记名 `入流/一流/绝顶/宗师` 跨 Task1（ceilingUnlocks flag）、Task3（flagsSet）、Task4（apex flagsSet/词表）、Task6（systemPrompt/词表）一致；致死 tone `走火入魔·经脉俱断` 跨 Task4（结局+apex outcome）、Task5（凶险 outcome）一致；哨兵 `life<=-1` 跨 Task4/Task5 一致；事件 summary（秘籍到手/闭关参悟/内功突破/泰山论剑/运功撞墙吐血/险些走火/中毒暗算）均为 wuxia.ts 现存。
- **顺序依赖**：Task1（封顶）→Task3（突破抬封顶）→Task4（绝顶→宗师 apex）；Task2 独立（建议紧随 Task1）；Task5 独立；Task6 依赖 Task1+Task4+Task5（词表）；Task7 最后守门。按 1→2→3→4→5→6→7 执行。
- **范围**：单题材、纯内容、零引擎改动；sim 遍历全开局是可选增强（Task7 沿用 openings[0] 基线即可，不强求）。

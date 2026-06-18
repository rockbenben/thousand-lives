# L1 后续修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 修两个 L1 遗留:① applyChoice 同回合突破封顶用「选择前」印记(应用选择后);② keyMoment 在涌现剧本失效(无 maxTurns 永不触发,Memoir/剧情大卡对 xian 死);并把 xian 4 突破重标 keyMoment、重 sim 守平衡(飞升保持极稀)。

**Architecture:** 引擎小修(`state.ts`、`keymoment.ts`)+ 调用点去守卫(`local.ts`/`Play.tsx`/`Memoir.tsx`/`prompt.ts`)+ xian 重标 + sim 守门。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints
- **飞升保持极稀有**:Fix 1 让化神突破当回合修为能冲到新上限 → 飞升(修为≥96)更可达;sim 重跑后若 survive 飞升率 >~1.5% 则微调(化神门槛/飞升阈值)压回极稀,**登顶仍个位数%、无 <10 回合收场、死亡真实**。
- 涌现 keyMoment 节奏:无 maxTurns 时每 4 回合一个里程碑(与软上限 ≈maxTurns/4 同密度)。
- 测试 Vitest;提交前 `npx tsc --noEmit` 干净、全量绿。
- 提交信息结尾两行:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`

---

## Task 1: 同回合突破封顶用选择后印记（state.ts）

**Files:** Modify `src/engine/state.ts`（applyChoice）；Test `src/engine/state.test.ts`

**Interfaces:** Produces applyChoice 在 clampEffects 前先 `applyFlags`,用**选择后**的 flags 截断,使同回合授境界印记 + 属性增益能达新上限。

- [ ] **Step 1: 写失败测试** — 用现有 `decaySc` 或新建一个带 ceilingUnlocks 的剧本;断言:玩家 cultivation 19(筑基 ceiling 45 前的炼气顶 20)选一个 `flagsSet:['筑基']` + `effects:{cultivation:50}` 的 outcome → 同回合 cultivation 应到 45(筑基上限),而非 20。新建测试 scenario:

```ts
describe('同回合突破封顶用选择后印记', () => {
  const sc2 = scenarioSchema.parse({
    id: 'brk', title: 'B', emoji: '⛰️', intro: 'x',
    attributes: [{ key: 'p', name: '修为', initial: 10, max: 100, ceiling: 20, ceilingUnlocks: [{ flag: '甲', max: 60 }] }],
    maxTurns: 5, systemPrompt: 'g', endings: [{ condition: 'maxTurns', tone: '终' }],
  })
  it('同回合授印记后修为可达新上限', () => {
    const st = { ...initState(sc2, undefined, undefined, 'local'), attributes: { p: 19 } }
    const tr: TurnResult = { narrative: 'n', summary: 's', choices: [{ text: '破', effects: {}, outcomes: [{ weight: 1, effects: { p: 50 }, flagsSet: ['甲'] }] }] }
    const next = applyChoice(sc2, st, tr, 0, () => 0)
    expect(next.flags).toContain('甲')
    expect(next.attributes.p).toBe(60) // 旧实现会卡在 20
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/engine/state.test.ts -t "选择后印记"` → FAIL（p=20）。

- [ ] **Step 3: 实现** — 在 `applyChoice` 中,把「先 clampEffects(用 flags0) 再 applyFlags」改为「先 applyFlags 得到 flags,再用 flags clampEffects」。即将：
```ts
  const attributes = clampEffects(sc, st.attributes, mergeEffects(baseEffects, decayEffects(sc)), flags0)
  const flags = applyFlags(flags0, setFlags, clearFlags)
```
改为：
```ts
  const flags = applyFlags(flags0, setFlags, clearFlags)
  // 同回合突破:用「选择后」印记算封顶,使本回合授境界印记 + 属性增益能达新上限
  const attributes = clampEffects(sc, st.attributes, mergeEffects(baseEffects, decayEffects(sc)), flags)
```
（其余 applyChoice 逻辑不变;后续用 `flags` 与 `attributes` 构造 history/ended。）

- [ ] **Step 4: 跑绿** — `npx vitest run src/engine/state.test.ts` → PASS;`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add src/engine/state.ts src/engine/state.test.ts && git commit -m "fix(engine): applyChoice 同回合突破用选择后印记算封顶"`（trailer）。

---

## Task 2: keyMoment 支持涌现剧本（周期节奏）

**Files:** Modify `src/engine/keymoment.ts`、`src/engine/local.ts`、`src/ui/Play.tsx`、`src/ui/Memoir.tsx`、`src/engine/prompt.ts`；Test `src/engine/keymoment.test.ts`

**Interfaces:** Produces `isKeyMoment(turnNo, maxTurns?: number)`、`keyMomentIndex(turnNo, maxTurns?: number)` 支持 `maxTurns===undefined`(每 4 回合一个里程碑);各调用点去掉 `maxTurns!==undefined &&` 守卫。

- [ ] **Step 1: 写失败测试** — 在 `src/engine/keymoment.test.ts` 加：

```ts
describe('涌现剧本 keyMoment 周期节奏', () => {
  it('无 maxTurns 时每 4 回合一个里程碑', () => {
    expect(isKeyMoment(4, undefined)).toBe(true)
    expect(isKeyMoment(8, undefined)).toBe(true)
    expect(isKeyMoment(7, undefined)).toBe(false)
    expect(isKeyMoment(0, undefined)).toBe(false)
  })
  it('keyMomentIndex 在涌现下给递增序号', () => {
    expect(keyMomentIndex(4, undefined)).toBe(0)
    expect(keyMomentIndex(8, undefined)).toBe(1)
    expect(keyMomentIndex(7, undefined)).toBe(-1)
  })
  it('有 maxTurns 行为不变', () => {
    expect(isKeyMoment(5, 20)).toBe(isKeyMoment(5, 20)) // 占位:保持原 keyMomentTurns(20) 逻辑
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/engine/keymoment.test.ts -t "周期节奏"` → FAIL（现签名不接受 undefined / 行为错）。

- [ ] **Step 3: 实现** —
(a) `keymoment.ts`：
```ts
const EMERGENT_KEY_EVERY = 4 // 涌现剧本:每 4 回合一个命运抉择里程碑

export function isKeyMoment(turnNo: number, maxTurns?: number): boolean {
  if (maxTurns === undefined) return turnNo > 0 && turnNo % EMERGENT_KEY_EVERY === 0
  return keyMomentTurns(maxTurns).includes(turnNo)
}

export function keyMomentIndex(turnNo: number, maxTurns?: number): number {
  if (maxTurns === undefined) {
    return turnNo > 0 && turnNo % EMERGENT_KEY_EVERY === 0 ? turnNo / EMERGENT_KEY_EVERY - 1 : -1
  }
  return keyMomentTurns(maxTurns).indexOf(turnNo)
}
```
（`keyMomentTurns(maxTurns: number)` 保持原样,仅由上面在 maxTurns 已定义时调用。）
(b) 调用点去守卫,直接传 `sc.maxTurns`（可为 undefined，由 isKeyMoment 处理）：
- `local.ts:38`：`const keyTurn = isKeyMoment(turn, sc.maxTurns)`
- `prompt.ts:132`：`if (isKeyMoment(current, sc.maxTurns)) {`
- `Play.tsx:183`：`const keyMoment = isKeyMoment(turnNo, scenario.maxTurns)`
- `Play.tsx:314`：`const km = isKeyMoment(i + 1, scenario.maxTurns)`
- `Memoir.tsx`：把 `scenario.maxTurns !== undefined ? keyMomentIndex(...) : -1` 改为 `keyMomentIndex(turnNo, scenario.maxTurns)`（读 Memoir.tsx 当前写法对齐）。

- [ ] **Step 4: 跑绿** — `npx vitest run` 全绿（keymoment + 既有调用点用例不破）；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `git add -A && git commit -m "fix(engine): keyMoment 支持涌现剧本（每4回合里程碑）+ 调用点去守卫"`（trailer）。

---

## Task 3: xian 重标 4 突破为 keyMoment + 重 sim 守平衡

**Files:** Modify `src/scenarios/xian.ts`（4 突破事件加 keyMoment）;可能微调数值;`src/scenarios/xian.test.ts`（断言更新）；Test 全量 + sim

**Interfaces:** Consumes Task 1/2。Produces 4 突破事件 `keyMoment:true`（获剧情大卡/留影）；平衡仍在带（飞升极稀）。

- [ ] **Step 1: 写测试** — 在 `xian.test.ts` 加（突破事件现应为 keyMoment）：

```ts
it('四突破机缘标为 keyMoment（剧情大卡/留影）', () => {
  const km = (xian.localEvents ?? []).filter((e) => e.keyMoment && /筑基机缘|金丹机缘|元婴机缘|化神机缘/.test(e.summary))
  expect(km.length).toBe(4)
})
```

- [ ] **Step 2: 跑红** — FAIL（突破当前非 keyMoment）。

- [ ] **Step 3: 实现** — 给 xian 的 4 个突破机缘事件各加 `keyMoment: true`。注意：keyMoment 事件只在 key 回合(每4回合)被抽中——确认其窗口(minTurn/maxTurn)内含足够 key 回合（筑基 3-14 含 4/8/12;金丹 10-30 含 12/16/20/24/28;元婴 24-65;化神 45+ 含 48/52/…）。若某窗口 key 回合太少导致难触发,适度放宽该窗口。

- [ ] **Step 4: 重 sim 守门（关键，控制器会亲验）** — `npx vite-node scripts/sim-balance.ts xian 5000`。确认并按需微调到：
  - **飞升率(survive) 极稀有(<~1.5%)**——Fix 1 让其更可达,若升高则微调（如把化神突破 cult 门槛抬 1-2，或飞升 daoHeart 阈值微升），压回极稀;
  - 登顶率(飞升+跳出三界) survive 仍个位数%（~2-9%）;
  - **P(收场<10)=0** 三策略;死亡非零;乱点多止步低境界;
  - 突破/境界达成未因 keyMoment 门控而崩（化神 reach 不应骤降到 ~0）。
  小步调、重跑,直到全部达标。把最终 sim block 记入报告。

- [ ] **Step 5: 回归 + Commit** — `npx vitest run` 全绿（数值若调，同步 xian.test.ts 断言）；`npx tsc --noEmit` 0。`git add src/scenarios/xian.ts src/scenarios/xian.test.ts scripts/sim-balance.ts && git commit -m "fix(xian): 4 突破重标 keyMoment（大卡/留影）+ 重 sim 守平衡，飞升保稀"`（trailer）。

---

## Self-Review
- **覆盖**:Fix 1 clamp(Task1);Fix 2 keyMoment 引擎+调用点(Task2);完整版重标突破+re-sim(Task3) ✓。
- **占位符**:Task1/2 给确切代码;Task3 给 keyMoment 标记 + sim 目标(数值微调是平衡循环,非占位)。
- **类型一致**:`isKeyMoment(turnNo, maxTurns?)`、`keyMomentIndex(turnNo, maxTurns?)`、`applyFlags`/`clampEffects(...,flags)` 跨任务一致。
- **顺序依赖**:Task3 依赖 Task1(clamp 影响化神修为)+Task2(keyMoment 才能触发突破大卡);三者都影响平衡,Task3 的 re-sim 是最终守门。执行须按序;控制器在 Task3 亲验 sim 数字。
- **范围**:sim 遍历全开局是可选增强(Task3 可顺带,否则沿用 openings[0]);不强求。

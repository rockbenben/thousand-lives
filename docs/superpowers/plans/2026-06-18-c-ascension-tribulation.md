# C：渡劫飞升 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 把 xian 的飞升/跳出三界从被动数值阈值改成「渡天劫」赌命抉择的 endTone 产物,使 apex 对谨慎玩法也极稀。

**Architecture:** 两 apex 结局 condition 改哨兵 `lifespan<=-1`(只经 endTone);改造现有「九重天劫」事件为 keyMoment 渡劫闸门(requires has(化神)&修为≥92,三选项:迎劫/护道→三态 endTone,避劫→苟着);sim 的 survive 策略改为规避带致死结局的赌命选项,再重平衡。全用 L1 原语,不改引擎。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints
- 不改引擎(`src/engine/*`);仅 `src/scenarios/xian.ts`、`src/scenarios/xian.test.ts`、`scripts/sim-balance.ts`。
- apex(飞升+跳出三界)只能由渡天劫事件的 `endTone` 触发;两 apex 结局 condition = `lifespan<=-1`(寿元 clamp 在 [0,max],永不自然成立)。
- **飞升极稀有**;apex 对所有策略稀有(含 survive ——它会避劫);P(收场<10)=0 三策略;死亡非零(渡劫贡献)、random ≤~55%。
- 致死类 endTone 事件 minTurn 合规(渡劫 requires has(化神),天然晚)。
- 测试 Vitest;提交前 `npx tsc --noEmit` 干净、全量绿。
- 提交信息结尾两行:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- 中文仙气文风一致。

---

## Task 1: 两 apex 改哨兵 + 改造「九重天劫」为渡劫闸门

**Files:** Modify `src/scenarios/xian.ts`；Test `src/scenarios/xian.test.ts`

**Interfaces:** Produces 飞升/跳出三界 结局 condition=`lifespan<=-1`;现有 `summary:'九重天劫'` 事件改为 `requires:'has(化神) & cultivation>=92'`、`keyMoment:true`、`once:true`,三选项含三态 endTone。

- [ ] **Step 1: 写失败测试** — 在 `xian.test.ts` 加（并准备更新既有飞升断言）：

```ts
describe('C 渡劫飞升', () => {
  it('飞升/跳出三界 改为哨兵 condition，不再被动达标', () => {
    const fs = xian.endings.find((e) => e.tone === '渡劫飞升·得道成仙')!
    const tj = xian.endings.find((e) => e.tone === '跳出三界·不在五行')!
    expect(fs.condition).toBe('lifespan<=-1')
    expect(tj.condition).toBe('lifespan<=-1')
    // 满血化神高道心高修为也不自然触发 apex
    const r = checkEnding(xian, { cultivation: 98, daoHeart: 90, lifespan: 80 }, 40, ['筑基', '金丹', '元婴', '化神'])
    expect(['渡劫飞升·得道成仙', '跳出三界·不在五行'].includes(r?.tone ?? '')).toBe(false)
  })
  it('渡天劫事件:keyMoment + requires has(化神)&修为>=92 + 迎劫三态 endTone', () => {
    const ev = (xian.localEvents ?? []).find((e) => e.summary === '九重天劫')!
    expect(ev.keyMoment).toBe(true)
    expect(ev.once).toBe(true)
    expect(ev.requires).toBe('has(化神) & cultivation>=92')
    const brave = ev.choices.find((c) => (c.outcomes ?? []).some((o) => o.endTone === '强渡天劫·形神俱灭'))!
    const tones = (brave.outcomes ?? []).map((o) => o.endTone)
    expect(tones).toContain('渡劫飞升·得道成仙')
    expect(tones).toContain('跳出三界·不在五行')
    expect(tones).toContain('强渡天劫·形神俱灭')
    const safe = ev.choices.find((c) => !(c.outcomes ?? []).some((o) => o.endTone))!
    expect(safe).toBeTruthy() // 避劫选项不带 endTone
  })
  it('迎劫成功/失败由 endTone 定结局', () => {
    const ev = (xian.localEvents ?? []).find((e) => e.summary === '九重天劫')!
    const st = { ...initState(xian, undefined, undefined, 'local'), flags: ['筑基','金丹','元婴','化神'], attributes: { cultivation: 95, daoHeart: 70, lifespan: 40 } }
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects ?? {}, outcomes: c.outcomes, endTone: c.endTone })) }
    const braveIdx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '强渡天劫·形神俱灭'))
    // rng=0 取首个 outcome（作者把"跳出三界"或"飞升"放靠前即成功）
    const ended = applyChoice(xian, st, tr as any, braveIdx, () => 0).ended
    expect(['渡劫飞升·得道成仙','跳出三界·不在五行','强渡天劫·形神俱灭'].includes(ended?.tone ?? '')).toBe(true)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/xian.test.ts -t "C 渡劫飞升"` → FAIL（apex 还是旧 condition;九重天劫 还是普通事件）。

- [ ] **Step 3: 实现** —
(a) `xian.ts`:把
```
{ condition: 'cultivation>=96 & daoHeart>=70', tone: '渡劫飞升·得道成仙', ... }
{ condition: 'has(化神) & daoHeart>=85', tone: '跳出三界·不在五行', ... }
```
两处 condition 改为 `'lifespan<=-1'`(tone/epilogue 不变)。
(b) 改造现有 `summary:'九重天劫'` 事件:
- `requires: 'has(化神) & cultivation>=92'`、`keyMoment: true`、`once: true`、`weight: 1.4`、保留 `minTurn`（≥26）。
- 三选项(沿用/改写现有叙事文风),起点权重(Task 2 再调):
  - 「迎九重天劫,舍身一搏」:`outcomes:[{weight:1, endTone:'跳出三界·不在五行', reaction:'…'}, {weight:3, endTone:'渡劫飞升·得道成仙', reaction:'…'}, {weight:4, endTone:'强渡天劫·形神俱灭', reaction:'…'}]`
  - 「倾尽底蕴护道渡劫」:`outcomes:[{weight:1, endTone:'跳出三界·不在五行'}, {weight:4, endTone:'渡劫飞升·得道成仙'}, {weight:2, endTone:'强渡天劫·形神俱灭'}]`（成功概率更高、死亡更低,体现耗尽底蕴换胜算）
  - 「暂不渡劫,固守化神」:`effects:{ daoHeart:-4 }`,无 outcomes/endTone(安全,留化神,继续游戏→终老得「仙逝得道·寿尽道存」)
  - （`强渡天劫·形神俱灭` 结局 tone 已存在于 endings;`渡劫飞升·得道成仙`、`跳出三界·不在五行` 经本任务改为哨兵 condition,但 endTone 仍能命中它们的 tone+epilogue。）

(c) **更新既有飞升/跳出三界断言**:`xian.test.ts` 里旧的「飞升不受寿元门控」「飞升需修为>=96」「跳出三界门控」等断言依赖被动达标,现已不成立——改为断言这些 condition=哨兵、被动不触发(或并入上面 Step 1 的新断言,删除矛盾的旧断言)。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/xian.test.ts` → PASS;`npx tsc --noEmit` → 0;`npx vitest run` 全绿(更新所有受影响断言)。

- [ ] **Step 5: Commit** — `git add src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "feat(xian): 飞升/跳出三界 改渡劫赌命(哨兵 condition + 九重天劫闸门三态 endTone)"`（trailer）。

---

## Task 2: sim survive 规避赌命 + 重平衡

**Files:** Modify `scripts/sim-balance.ts`；可能微调 `src/scenarios/xian.ts`（迎劫 odds）；Test 全量 + sim

**Interfaces:** Consumes Task 1。Produces survive 策略规避带致死 endTone 的选项(模拟谨慎玩家避劫);apex 对所有策略稀有。

- [ ] **Step 1: 让 survive 规避赌命选项** — 在 `scripts/sim-balance.ts` 的 `survive` 策略里,跳过「任一 outcome 带致死 endTone」的选项(谨慎玩家不赌命):

```ts
  survive: () => (sc, st, tr) => {
    const dk = deathAttrs(sc).map((a) => a.key)
    const lethal = /形神俱灭|横死|暴毙|身死|道消|坐化|羽化|走火/
    let best = 0
    let bestScore = -Infinity
    tr.choices.forEach((c, i) => {
      // 谨慎玩家避开"有致死结局分支"的赌命选项（如渡天劫的迎劫）
      const risky = (c.outcomes ?? []).some((o) => o.endTone && lethal.test(o.endTone)) || (c.endTone && lethal.test(c.endTone))
      if (risky) return
      const minDeath = Math.min(...dk.map((k) => (st.attributes[k] ?? 0) + (c.effects[k] ?? 0)))
      const sum = Object.values(c.effects).reduce((s, v) => s + v, 0)
      const score = minDeath * 100 + sum
      if (score > bestScore) { bestScore = score; best = i }
    })
    return best
  },
```
（若全是 risky 选项,best 维持 0；渡天劫有"避劫"非 risky 选项,survive 必选它→不渡劫→无 apex。）

- [ ] **Step 2: 跑基线** — `npx vite-node scripts/sim-balance.ts xian 5000`,记录三策略 登顶/飞升/死亡/收场分布。预期:survive 登顶≈0(避劫);random/greedy 偶尔迎劫→部分 apex、部分形神俱灭。

- [ ] **Step 3: 调 odds 达标** — 目标(对 xian.ts 的迎劫/护道 outcomes 权重微调):
  - **survive 登顶 ≈ 0 / 极低**(它避劫;若仍非零,排查是否有非 risky 的 apex 路径)。
  - **飞升极稀有**(random/greedy 个位数%下;survive≈0）。
  - **P(收场<10)=0** 三策略。
  - **死亡非零、渡劫贡献明显**(random/greedy 迎劫失败=形神俱灭),random ≤~55%。
  - 乱点多止步低境界。
  小步调权重、重跑,直到达标。最终 sim block 记入报告。

- [ ] **Step 4: 守护测试 + 回归** — 在 `xian.test.ts` 加守护:

```ts
it('apex 只经 endTone：两 apex condition 恒为哨兵', () => {
  for (const t of ['渡劫飞升·得道成仙', '跳出三界·不在五行']) {
    expect(xian.endings.find((e) => e.tone === t)!.condition).toBe('lifespan<=-1')
  }
})
```
`npx vitest run` 全绿;`npx tsc --noEmit` 0。

- [ ] **Step 5: Commit** — `git add scripts/sim-balance.ts src/scenarios/xian.ts src/scenarios/xian.test.ts && git commit -m "balance(xian): sim survive 规避赌命 + 渡劫 odds 调到 apex 全策略稀有"`（trailer）。

---

## Self-Review
- **覆盖**:§1 apex 哨兵(Task1);§2 渡天劫闸门(Task1);§3 平衡 + survive 规避赌命(Task2);§4 测试(Task1/2)。
- **占位符**:Task1 给确切 condition 改动 + 事件结构(odds 起点权重,Task2 调);叙事散文为按文风现写简报;Task2 给确切 survive 代码。
- **关键洞察**:sim survive 默认按 top-level effects 评分、看不到 outcome 里的赌命死亡 → 会误选迎劫;Task2 Step1 显式让 survive 规避致死-endTone 选项,才能让"谨慎避劫→apex 稀有"在 sim 里成立。
- **类型一致**:endTone tone 字符串(渡劫飞升·得道成仙/跳出三界·不在五行/强渡天劫·形神俱灭)与 endings tone 精确一致;`applyChoice`/`outcomes`/`endTone` 字段名一致。
- **顺序依赖**:Task1 必先(改 condition + 事件);Task2 依赖 Task1 的事件 + 调 odds。控制器在 Task2 亲验 sim。
- **既有测试**:多处旧"飞升被动达标"断言会红,Task1 Step3(c) 要求同步更新为真值,不删测逃避。

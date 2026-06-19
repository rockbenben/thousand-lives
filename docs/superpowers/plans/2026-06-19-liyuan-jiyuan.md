# 梨园机缘体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已验证的机缘体系移植到 `liyuan`（梨园浮梦），主题化为戏曲名位晋升：技艺名位封顶阶梯 + 升艺机缘 + 身份弧 + 攀爬式 apex（无赌命）+ 隐藏横祸 + AI tierLabel。

**Architecture:** 纯内容/配置改动，零引擎改动——复用 L1 的 `ceiling`/`ceilingUnlocks`/`outcomes`/`endTone`/`keyMoment`/`flags`（`has()` 条件）。prompt.ts 与 sim-balance.ts 已通用（含 tierLabel/晋阶之序），本期无需改引擎。所有改动落在 `src/scenarios/liyuan.ts`；新建 `src/scenarios/liyuan.test.ts`。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints

- **长度保持 `maxTurns: 30`**（「三十年粉墨春秋」，不改）；`turnUnit` 仍「年」。~19 个 `maxTurns & …` 善终结局条件不变。
- **名位印记**固定四个、按序：`搭班`→`挑梁`→`名伶`→`宗匠`，不得越级。**只有 `art`（技艺）有名位阶梯**；`safety`（安稳，衰减死亡赛跑）、`fame`（声名，standing，death-at-0）不设封顶。
- **apex 走 climb（不走赌命）**：3 个 passive 巅峰结局改 `maxTurns &` 门控，名角/宗匠靠攀爬；**survive 登顶不强求 0**。
- **tierLabel: '名位'**。
- 哨兵 condition 用 `safety<=-1`（`safety.deathBelow===0`，`invariants.test.ts` A2 已豁免）。
- 测试 Vitest；每个 Task 提交前 `npx tsc --noEmit` 干净、全量 `npx vitest run` 绿。
- 提交信息结尾两行 trailer：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- sim 数字由控制器亲验。命令用工具原生 cwd（`git -C`、`npx --prefix`），不用复合 `cd <path>; cmd`。

## File Structure

- `src/scenarios/liyuan.ts`（修改）：唯一内容文件（~1600 行，~70 events，22 endings）。
- `src/scenarios/liyuan.test.ts`（新建）：封顶/印记链/巅峰门控/身份 gate/隐藏 endTone/AI/守护断言。
- `scripts/sim-balance.ts`（沿用，已通用，不改）。

参考样板（只读，勿改）：`src/scenarios/wuxia.ts`（ceilingUnlocks、身份 flag、keyMoment+flagsSet）、`src/scenarios/officialdom.ts`（新建升迁事件、巅峰改 maxTurns、tierLabel、隐藏 endTone 哨兵）、`src/scenarios/wuxia.test.ts`/`officialdom.test.ts`（测试样式）。

---

## Task 1: 技艺名位封顶阶梯（搭班/挑梁/名伶/宗匠）

**Files:** Modify `src/scenarios/liyuan.ts`（`art` 属性）；Create `src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes L1 `clampEffects(sc, attrs, effects, flags)`。Produces `art` 带 `ceiling:20` + `ceilingUnlocks:[{flag:'搭班',max:45},{flag:'挑梁',max:70},{flag:'名伶',max:90},{flag:'宗匠',max:100}]`。后续 Task 3 升艺事件靠这些印记抬升封顶。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/liyuan.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { liyuan } from './liyuan'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'

describe('liyuan 技艺名位封顶', () => {
  it('无名位印记时技艺封顶 20', () => {
    expect(clampEffects(liyuan, { art: 18 }, { art: 50 }, []).art).toBe(20)
  })
  it('搭班印记解锁封顶 45', () => {
    expect(clampEffects(liyuan, { art: 40 }, { art: 50 }, ['搭班']).art).toBe(45)
  })
  it('挑梁印记解锁封顶 70', () => {
    expect(clampEffects(liyuan, { art: 60 }, { art: 50 }, ['搭班', '挑梁']).art).toBe(70)
  })
  it('名伶印记解锁封顶 90', () => {
    expect(clampEffects(liyuan, { art: 85 }, { art: 50 }, ['搭班', '挑梁', '名伶']).art).toBe(90)
  })
  it('宗匠印记解锁封顶 100', () => {
    expect(clampEffects(liyuan, { art: 95 }, { art: 50 }, ['搭班', '挑梁', '名伶', '宗匠']).art).toBe(100)
  })
  it('安稳与声名不设名位封顶', () => {
    expect(clampEffects(liyuan, { safety: 95 }, { safety: 50 }, []).safety).toBe(100)
    expect(clampEffects(liyuan, { fame: 95 }, { fame: 50 }, []).fame).toBe(100)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "名位封顶"` → FAIL（art 当前无 ceiling）。

- [ ] **Step 3: 实现** — 在 `art` 属性加 `ceiling` + `ceilingUnlocks`（保留 bands）：

```ts
{
  key: 'art',
  name: '技艺',
  initial: 12,
  max: 100,
  ceiling: 20,
  ceilingUnlocks: [
    { flag: '搭班', max: 45 },
    { flag: '挑梁', max: 70 },
    { flag: '名伶', max: 90 },
    { flag: '宗匠', max: 100 },
  ],
  bands: [ /* 保持原样 */ ],
},
```

`safety`、`fame` **不加** ceiling/ceilingUnlocks。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(liyuan): 技艺名位封顶阶梯（搭班/挑梁/名伶/宗匠 ceilingUnlocks）`

---

## Task 2: 身份印记 + 身份事件门控

**Files:** Modify `src/scenarios/liyuan.ts`（`openings`、身份相关事件 requires）；Modify `src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes L1 `initState`、`has(X)`/`!has(X)`。Produces 3 开局各带 flag。

- [ ] **Step 1: 写失败测试** — 在 `liyuan.test.ts` 追加：

```ts
describe('liyuan 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['戏班学徒', '落魄世家小姐', '票友下海']) {
      const op = liyuan.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(liyuan, op).flags).toContain(n)
    }
  })
  it('身份专属事件带 has() 门控（至少各一）', () => {
    const evs = liyuan.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('落魄世家小姐')).toBeGreaterThanOrEqual(1)
    expect(byFlag('票友下海')).toBeGreaterThanOrEqual(1)
    expect(byFlag('戏班学徒')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "身份印记"` → FAIL（openings 无 flag）。

- [ ] **Step 3: 实现** —
(a) `openings` 加 flag（prompt 不变）：
```ts
openings: [
  { name: '戏班学徒', flag: '戏班学徒', prompt: '自幼被卖入戏班坐科，挨过无数打骂、吊过无数早功，一身本事是拿血汗换来的，无依无靠、举目无亲。' },
  { name: '落魄世家小姐', flag: '落魄世家小姐', prompt: '本是没落官宦人家的小姐，家道中落后不顾家族反对、毅然下海唱戏，身上还带着几分书卷气与傲骨。' },
  { name: '票友下海', flag: '票友下海', prompt: '原是富家子弟，痴迷戏曲、常年票戏，因家变或一腔孤勇而正式下海搭班，根基浅却人脉广、见过世面。' },
],
```
(b) 给身份专属事件加/合并 `requires`（**已有 requires 用 ` & ` 串接，不覆盖**；逐事件 Grep+Read 确认现有字段）。按主题选 2-5 个事件，**每个身份至少 1 个**：
- **落魄世家小姐**（家族反对/门第/书卷傲骨）：择 1-2 个含「家族/门第/旧家/书香/清白」味的事件 → 加 `has(落魄世家小姐)`。
- **票友下海**（人脉广/票友捧场/根基浅被轻视）：择 1-2 个含「票友/阔少人脉/外行」味的事件（如 `阔少捧角`）→ 加 `has(票友下海)`。
- **戏班学徒**（坐科血汗/师门恩义/无依）：`科班早功`(minTurn1) 或 `名旦收徒` 类 → 加 `has(戏班学徒)`。
- 通用事件（堂会/军阀/报馆/对台通用面）不加身份 gate。
> 实现者须先 Read 每个目标事件确认 summary 命中且 requires 正确合并；报告列出每个事件 before→after requires 与选取理由。若某身份找不到贴切事件，挑一个语义最近的并说明。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(liyuan): 三开局身份印记 + 学徒/世家小姐/票友身份事件门控`

---

## Task 3: 四道升艺机缘（新建专属事件）

**Files:** Modify `src/scenarios/liyuan.ts`（新增 4 个 keyMoment 升艺事件）；Modify `src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes Task 1 的 ceilingUnlocks；L1 `applyChoice`（同回合先 applyFlags 再 clampEffects，升艺当回合技艺可达新上限）；keyMoment `keyMomentTurns(30)`。Produces 4 个 `keyMoment:true` 专属升艺事件，授印记选项带 `flagsSet:['下一名位']`，按 搭班→挑梁→名伶→宗匠 串链。

> **设计说明**：既有 唱对台戏/堂会受辱/研习真传 是两难/风险事件（技艺/声名来源），不适合直接当闸门。故**新建 4 个专属升艺事件**（同 officialdom 做法）。

- [ ] **Step 1: 写失败测试** — 在 `liyuan.test.ts` 追加：

```ts
describe('liyuan 升艺闸门', () => {
  it('四道升艺机缘均为 keyMoment 且授对应名位印记、按序串链', () => {
    const want = [
      { summary: '出科搭班', flag: '搭班', prev: undefined },
      { summary: '挑梁担纲', flag: '挑梁', prev: '搭班' },
      { summary: '唱红名动', flag: '名伶', prev: '挑梁' },
      { summary: '开宗立派', flag: '宗匠', prev: '名伶' },
    ]
    for (const w of want) {
      const ev = (liyuan.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      expect(ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag)), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('出科搭班后同回合技艺可破 20 上限', () => {
    let st = initState(liyuan, liyuan.openings!.find((o) => o.name === '戏班学徒'))
    st = { ...st, attributes: { art: 18, fame: 40, safety: 70 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (liyuan.localEvents ?? []).find((e) => e.summary === '出科搭班')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('搭班'))
    const next = applyChoice(liyuan, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('搭班')
    expect(next.attributes.art).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "升艺闸门"` → FAIL（事件不存在）。

- [ ] **Step 3: 实现** — 在 `liyuan.ts` 的 `localEvents` 数组新增以下 4 个事件（完整对象，逐字加入；「登台/受艺」选项授印记 + 技艺冲新上限，「辞/稳」选项小代价不授）：

```ts
{
  narrative:
    '坐科满师的日子到了。班主把你叫到跟前，上下打量这些年挨打挨骂熬出来的功底，终于松口：你可以正式搭班入园、登台唱戏了。从此不再是后台打杂、跑龙套的学徒，而是有名有姓、能领包银的正式伶人。出科那日，师兄弟们既羡且妒，你攥着第一份戏份，知道这粉墨生涯算是真正起了头。',
  choices: [
    { text: '正式搭班，登台亮相', effects: { art: 28, fame: 4, safety: -2 }, flagsSet: ['搭班'], reaction: '你一招一式有板有眼，台下竟有了零星彩声；班主暗暗点头，同行也收起了轻视，知道这后生是真坐科熬出来的。' },
    { text: '再磨一年，不急登台', effects: { art: 6, safety: 2 }, reaction: '你自觉火候未到，宁可再吊一年功；师傅赞你沉得住气，只是这搭班登台的时机，到底慢了旁人一步。' },
  ],
  summary: '出科搭班',
  requires: 'art>=16',
  keyMoment: true,
  once: true,
  minTurn: 4,
  weight: 3,
},
{
  narrative:
    '园子里挑梁的角儿临时倒了嗓，一出大戏眼看开不了天。班主病急乱投医，把目光落在你身上——这是你头一回有机会挑大梁、唱主角，一鸣则惊人，一砸则前功尽弃。后台的同行有等着看笑话的，也有真心替你捏汗的。锣鼓已经响了，大幕将启，这副担子，挑还是不挑？',
  choices: [
    { text: '临危挑梁，唱响这出大戏', effects: { art: 24, fame: 8, safety: -4 }, flagsSet: ['挑梁'], reaction: '你一开嗓便镇住了满堂，一出大戏唱得水泄不通、彩声雷动；自此园子里挂头牌的戏，再不能没有你的名字。' },
    { text: '自陈火候未足，让贤求稳', effects: { fame: 2, safety: 2 }, reaction: '你谦称担不起这副担子、力荐他人；班主叹你知分寸，可这挑梁成角的难得时机，终究从指缝里溜了。' },
  ],
  summary: '挑梁担纲',
  requires: 'has(搭班) & art>=42 & fame>=35',
  keyMoment: true,
  once: true,
  minTurn: 10,
  weight: 3,
},
{
  narrative:
    '一出你打磨多年的拿手好戏，终于唱到了火候。这一晚名流云集、报馆云集，台下黑压压坐满了懂行的看客。你水袖一扬、一个高腔拔起，满座先是死寂、继而轰然叫好，掌声几乎掀翻屋顶。第二天，你的名字与剧照登上了各大报馆的头版，唱片公司、堂会的帖子雪片般飞来——你红了，真正红遍了京沪，成了人人争说的名伶。',
  choices: [
    { text: '趁势而起，红遍京沪', effects: { art: 18, fame: 12, safety: -2 }, flagsSet: ['名伶'], reaction: '一夜之间你的戏码一票难求，名伶之名响彻十里洋场；捧角的、约戏的、登报的纷至沓来，你站在了万人瞩目的红氍毹中央。' },
    { text: '低调收敛，不慕虚名', effects: { art: 6, safety: 4 }, reaction: '你婉拒了铺天盖地的吹捧、只想守着戏好好唱；懂戏的赞你有定力，只是这唱红成名伶的泼天声势，到底淡了几分。' },
  ],
  summary: '唱红名动',
  requires: 'has(挑梁) & art>=66 & fame>=55',
  keyMoment: true,
  once: true,
  minTurn: 18,
  weight: 3,
},
{
  narrative:
    '唱戏唱到你这般地步，已不只是演别人的戏，而是要创自己的腔、立自己的派了。你毕生琢磨的唱法、身段、戏路，自成一家气象；门下弟子渐多，戏界元老也来请教。是时候开宗立派，把这一身绝艺凝成一脉传世的戏脉——让后来者唱你创的腔、排你排的戏，把你的名字刻进这门艺术的骨血里。这一步迈出去，你便从一个名伶，成了一代宗匠。',
  choices: [
    { text: '开宗立派，自成一家', effects: { art: 14, fame: 6, safety: -2 }, flagsSet: ['宗匠'], reaction: '你创的腔、排的戏被刻进唱片、写进戏考，门下桃李济济、戏脉绵延；梨园中人提起你，无不肃然，知是开了一派的宗匠。' },
    { text: '守成传艺，不敢称派', effects: { art: 6, fame: 2 }, reaction: '你自谦才疏、只肯本分传艺、不敢妄言立派；后辈虽得你真传，叹你这开宗立派的一步终是没能迈出。' },
  ],
  summary: '开宗立派',
  requires: 'has(名伶) & art>=88 & fame>=70',
  keyMoment: true,
  once: true,
  minTurn: 24,
  weight: 3,
},
```

- [ ] **Step 4: 跑绿 + Commit** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。`feat(liyuan): 四道升艺机缘（出科搭班→挑梁担纲→唱红名动→开宗立派），keyMoment+授名位印记+串链`

---

## Task 4: 三个巅峰结局改 maxTurns 门控（apex 不中途白嫖）

**Files:** Modify `src/scenarios/liyuan.ts`（3 个 passive 巅峰结局 condition）；Modify `src/scenarios/liyuan.test.ts`

**Interfaces:** Produces 3 个正向巅峰结局 condition 前缀 `maxTurns &`，只在落幕年触发。负面/死亡结局不变。

- [ ] **Step 1: 写失败测试** — 在 `liyuan.test.ts` 追加：

```ts
describe('liyuan 巅峰结局须 maxTurns（不中途白嫖）', () => {
  it('满血高位在非落幕年不触发巅峰结局', () => {
    const r = checkEnding(liyuan, { art: 98, fame: 98, safety: 98 }, 18, ['搭班', '挑梁', '名伶', '宗匠'])
    for (const t of ['一代宗师·开宗立派', '艺压群伶·曲高和寡', '红透半边天·万人空巷']) {
      expect(r?.tone === t, t).toBe(false)
    }
  })
  it('落幕年（满期）高位触发巅峰结局', () => {
    const r = checkEnding(liyuan, { art: 98, fame: 98, safety: 98 }, 30, ['搭班', '挑梁', '名伶', '宗匠'])
    expect(r?.tone).toBeTruthy()
    expect(['一代宗师·开宗立派', '艺压群伶·曲高和寡', '红透半边天·万人空巷', '梨园泰斗·桃李天下']).toContain(r!.tone)
  })
})
```
（末尾 `梨园泰斗·桃李天下` 是占位兜底——实现者用 `liyuan.endings` 中实际存在的最高 maxTurns 善终 tone 替换；若上面三巅峰之一已命中即可，断言只需保证返回的是这几个高位 tone 之一。实现者据实际 endings 数组调整该数组成员，确保测试真实通过。）

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "巅峰结局须 maxTurns"` → FAIL（第 18 年满血会触发被动巅峰）。

- [ ] **Step 3: 实现** — 改 3 个巅峰结局的 condition（tone/epilogue 不变），其余结局**全部不动**：
  - `一代宗师·开宗立派`：`condition: 'art>=96 & fame>=70'` → `'maxTurns & art>=96 & fame>=70'`
  - `艺压群伶·曲高和寡`：`condition: 'art>=96'` → `'maxTurns & art>=96'`
  - `红透半边天·万人空巷`：`condition: 'fame>=96'` → `'maxTurns & fame>=96'`
  > 这 3 个须位于其余 `maxTurns & …` 善终结局**之前**（checkEnding 取首个匹配；它们已在现文件靠前——确认顺序，不移动条目）。负面结局 `safety<=0`（潦倒病故）、`fame<=0`（身败名裂）、`fame<=6`、`safety<=6` 等保持原样（伶人原生倾覆，可中途触发）。

- [ ] **Step 4: 跑绿 + Commit** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。`feat(liyuan): 三巅峰结局改maxTurns门控（名角/宗匠靠攀爬，不中途白嫖）`

---

## Task 5: 隐藏 endTone（梨园横祸 + 际遇天堂）

**Files:** Modify `src/scenarios/liyuan.ts`（凶险事件低权 endTone outcome；新增 2 致死 + 1 天堂哨兵结局）；Modify `src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes L1 `outcomes`/`endTone`/哨兵 `safety<=-1`。Produces 凶险事件低权致死 endTone 分支；新增 `开罪权贵·横死乱世`、`名节尽毁·封箱绝迹`（致死）与 `一夜爆红·伶界天骄`（天堂）三结局，均哨兵。

- [ ] **Step 1: 写失败测试** — 在 `liyuan.test.ts` 追加：

```ts
describe('liyuan 隐藏 endTone', () => {
  it('新增致死与天堂隐藏结局存在且为哨兵 safety<=-1', () => {
    for (const t of ['开罪权贵·横死乱世', '名节尽毁·封箱绝迹', '一夜爆红·伶界天骄']) {
      const e = liyuan.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('safety<=-1')
    }
  })
  it('军阀逼伶含低权横死 endTone 分支', () => {
    const ev = (liyuan.localEvents ?? []).find((e) => e.summary === '军阀逼伶')!
    const has = ev.choices.some((c) => (c.outcomes ?? []).some((o) => o.endTone === '开罪权贵·横死乱世'))
    expect(has).toBe(true)
  })
  it('endTone 强制即终局', () => {
    let st = initState(liyuan, liyuan.openings!.find((o) => o.name === '票友下海'))
    st = { ...st, attributes: { art: 60, fame: 60, safety: 50 }, history: Array(18).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (liyuan.localEvents ?? []).find((e) => e.summary === '军阀逼伶')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '开罪权贵·横死乱世'))
    const next = applyChoice(liyuan, st, tr as any, idx, () => 0.999)
    expect(next.ended?.reason).toBe('forced')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "隐藏 endTone"` → FAIL。

- [ ] **Step 3: 实现** —
(a) **新增三结局**（endings 数组，挨着 `safety<=0` 潦倒病故附近，**置于 `safety<=0` 之前**，均 `condition: 'safety<=-1'`）：
```ts
{
  condition: 'safety<=-1',
  tone: '开罪权贵·横死乱世',
  epilogue:
    '你到底是开罪了那位惹不起的人物。乱世里一条伶人的性命，比戏台上的一句道白还轻——某个收戏的夜晚，几个黑影堵在后台，没有道理可讲。你那条倾倒过满座的好嗓子，连一声呼救都没来得及喊出，便永远沉进了这乱世的黑暗里。第二天戏园照常开锣，台上换了别人，仿佛从没有过你这号角儿。',
},
{
  condition: 'safety<=-1',
  tone: '名节尽毁·封箱绝迹',
  epilogue:
    '一桩泼天的丑闻，被报馆的笔墨翻炒得满城风雨，再多的辩白都成了越描越黑的笑柄。戏园不敢再挂你的牌，捧你的人作鸟兽散，同行见你绕道而行。你那一身好本事，从此再无处施展——封了箱、谢了幕，悄无声息地绝迹于梨园。世人只记得那桩丑闻，再没人记得你曾在台上有过怎样的风光。',
},
{
  condition: 'safety<=-1',
  tone: '一夜爆红·伶界天骄',
  epilogue:
    '谁也没料到，那一夜会是你的造化。台下偶然坐着的贵人、报馆，被你一段戏彻底惊住——一夜之间，你的名字传遍京沪，戏码一票难求，唱片灌了一张又一张、销遍大江南北。这般一炮而红、平步青云的际遇，梨园百年也难得一见。你甚至来不及细想其中的偶然与凶险，便已被那泼天的声名裹挟着，站上了伶界天骄的位置。',
},
```
(b) **军阀逼伶 加低权致死 outcome**（先 Read summary='军阀逼伶' 事件，约 line 562，requires fame>=55/minTurn18）：把其「犯险/硬顶」选项从纯 effects 改为 outcomes（保留原 effects 为高权常态分支 + 加低权 `endTone:'开罪权贵·横死乱世'` 分支）：
```ts
// 形如：
{ text: <原硬顶选项文案>, effects: {}, outcomes: [
  { weight: 12, effects: <原 effects>, reaction: <原 reaction> },
  { weight: 1, effects: {}, endTone: '开罪权贵·横死乱世', reaction: '你硬顶回去的那句话，彻底触了那位督军的逆鳞——当夜后台几个黑影闪过，你才惊觉，乱世里一条伶人的命，从来由不得自己。' },
] },
```
(c) **另一致死 + 天堂落点**（先 Read 对应事件）：
  - `名节尽毁·封箱绝迹`：挂在 `小报中伤`(line 476, requires fame>=50) 或 `堂会受辱`(391) 的激进/犯险选项，加低权 `endTone:'名节尽毁·封箱绝迹'`（卷入丑闻被报馆彻底毁掉）。
  - `一夜爆红·伶界天骄`（天堂）：挂在一个**晚期高声名/高技艺**事件（如 `灌录唱片`(452, fame>=45) 或 `义演赈灾`(514, fame>=55) 或 `封箱盛宴`(640, fame>=65)）的进取选项，加**极低权**（weight 1 对常态 ~20）`endTone:'一夜爆红·伶界天骄'`。仅此一处天堂，确保稀有。
  > 转换模式同 wuxia/officialdom：原 effects+reaction 留作高权常态分支，仅 ADD 低权 endTone 分支。实现者 Read 每个目标事件后按此改，报告列出改了哪些事件/选项/权重。

- [ ] **Step 4: 跑绿 + Commit** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。`feat(liyuan): 隐藏endTone——开罪权贵横死/名节尽毁封箱 + 稀有一夜爆红天堂`

---

## Task 6: AI 模式 tierLabel + systemPrompt 补 + 注入回归

**Files:** Modify `src/scenarios/liyuan.ts`（`tierLabel`、`systemPrompt`）；Modify `src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes 已通用化的 `scenarioUsesFlags`/`flagVocab`/`buildTurnMessages`（usesFlags 时注入【当前印记】【晋阶之序】+ 词表，晋阶之序用 `sc.tierLabel`）。**不改 prompt.ts**。Produces liyuan `tierLabel:'名位'` + systemPrompt 含名位晋阶 + 横祸极稀指导。

- [ ] **Step 1: 写失败测试** — 在 `liyuan.test.ts` 追加：

```ts
import { buildTurnMessages } from '../engine/prompt'

describe('liyuan AI 模式', () => {
  it('tierLabel=名位，晋阶之序用本剧术语「名位」+ 名位印记序', () => {
    const st = initState(liyuan, liyuan.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(liyuan, st).map((m) => m.content).join('\n')
    expect(liyuan.tierLabel).toBe('名位')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('名位')
    expect(all).toContain('搭班→挑梁→名伶→宗匠')
    expect(all).not.toContain('封顶')
    // 隐藏 tone 经词表注入（伶界天骄 不在 systemPrompt 文本，证明 hiddenTones 注入生效）
    expect(all).toContain('伶界天骄')
  })
  it('systemPrompt 含名位晋阶规则与横祸极稀指导', () => {
    expect(liyuan.systemPrompt).toContain('名位')
    expect(liyuan.systemPrompt).toContain('横祸')
  })
  it('提示不含「共 undefined」', () => {
    const st = initState(liyuan, liyuan.openings![0], undefined, 'ai')
    const all = buildTurnMessages(liyuan, st).map((m) => m.content).join('\n')
    expect(all).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/liyuan.test.ts -t "AI 模式"` → 晋阶/词表条因 Task1/3/5 落地已自动绿，tierLabel 条与 systemPrompt 条 FAIL（尚无 tierLabel/名位规则/横祸段）。

- [ ] **Step 3: 实现** —
(a) 在 liyuan scenario 加 `tierLabel: '名位',`（放在 `turnUnit`/`maxTurns` 附近，schema 字段顺序：…maxTurns, tierLabel, systemPrompt…）。
(b) 在 liyuan `systemPrompt` 末尾追加规则行（保留原有规则）：
```
- 梨园有名位之别：技艺（art）须积渐精进，欲晋名位须真机缘（出科搭班、临危挑梁、唱红名动、开宗立派）；让玩家晋名位时，在 JSON 里 flagsSet:["下一名位"]，名位印记只能取 搭班→挑梁→名伶→宗匠，须按此序、不得越级
- 未晋名位前技艺不应越级暴涨，晋名位唯凭真机缘（flagsSet 下一名位）
- 开罪权贵·横死乱世、名节尽毁·封箱绝迹等无视一切的横祸极其凶险，仅在真正万劫不复处偶用 endTone 令本年即终局；乱世无常，绝大多数年份不应出现
```

- [ ] **Step 4: 跑绿 + Commit** — `npx vitest run src/scenarios/liyuan.test.ts` → PASS；`npx tsc --noEmit` → 0。`feat(liyuan): AI模式tierLabel名位+systemPrompt补名位晋阶+横祸极稀`

---

## Task 7: 平衡 sim 守门 + 全量回归

**Files:** Modify（按需微调）`src/scenarios/liyuan.ts`（安稳 decay、升艺 requires/weight/minTurn、apex/endTone 权重）；Modify（若数值调动断言）`src/scenarios/liyuan.test.ts`

**Interfaces:** Consumes 已通用的 `scripts/sim-balance.ts`（`npx vite-node scripts/sim-balance.ts liyuan 5000`）。Produces 达标的平衡数值。

- [ ] **Step 1: 跑 sim 基线** — `npx vite-node scripts/sim-balance.ts liyuan 5000`，记录三策略。

- [ ] **Step 2: 对照目标微调**（spec §8）：
  - **apex（一代宗师+艺压群伶+红透半边天）稀有**：乱点/greedy 登顶低；survive 登顶个位数%且来自真攀爬（不强求 0）。若 survive 登顶过高或非攀爬所得，收紧末阶升艺 requires（如开宗立派 fame 阈值抬高）。
  - **安稳衰减下可活到落幕**：survive 活到 maxTurns（reachedMax 不应 ~0；若偏低则调 safety decay 或升艺/事件的 safety 回补）。
  - **真死亡非零**：safety<=0 流落 + 横祸 endTone 计入；random 死亡合理（乱世凶险，≤~60%）。
  - **坏结局够**（身败/流落/潦倒/默默无闻）。
  - **P(收场<10)≈0**（random/survive；巅峰已 maxTurns 门控）；greedy 早死残余按 wuxia/officialdom 同理接受。
  - **乱点止步低名位**（无印记/搭班）；宗匠 个位数%。
  - **升艺闸门 reach 合理**（搭班/挑梁/名伶 达成率不应 ~0）。
  小步、单改单跑。**不改印记链结构与巅峰 maxTurns 门控**。
- [ ] **Step 3: 控制器亲验** — 控制器（非 agent）重跑 `npx vite-node scripts/sim-balance.ts liyuan 5000`，确认达标，sim block 贴入报告。
- [ ] **Step 4: 全量回归** — `npx vitest run` 全绿（数值若调同步断言）；`npx tsc --noEmit` 0；`npx vite-node scripts/sim-balance.ts all 1000`（确认未连带影响其它题材）。
- [ ] **Step 5: Commit** — `fix(liyuan): 重 sim 守平衡（apex攀爬稀有/安稳可活/死亡合理/坏结局够），记录最终 sim`

---

## Self-Review

- **Spec coverage**：§1 技艺封顶=Task1；§4 身份=Task2；§2 升艺=Task3；§3 apex 改 maxTurns=Task4；§5 隐藏 endTone=Task5；§6 AI tierLabel=Task6；§7 平衡=Task7。全覆盖。
- **Placeholder 扫描**：Task2/5 要求实现者先 Read 既有事件再按精确模式改（合并 requires / outcomes 转换）——给了精确规则与样例；Task3 给 4 个完整事件对象；Task4 占位兜底 tone 已注明「按实际 endings 替换」。无 TBD/TODO。
- **Type 一致**：名位印记 `搭班/挑梁/名伶/宗匠` 跨 Task1（ceilingUnlocks）、Task3（flagsSet）、Task6（systemPrompt/词表）一致；哨兵 `safety<=-1` 跨 Task5 一致；致死/天堂 tone 跨 Task5 一致；巅峰 tone 跨 Task4 一致；tierLabel '名位' 跨 Task6 一致。事件 summary（军阀逼伶/小报中伤/灌录唱片/阔少捧角/科班早功 等）均为 liyuan.ts 现存。
- **顺序依赖**：Task1（封顶）→ Task3（升艺抬封顶）；Task4 独立；Task2/5 相对独立；Task6 依赖 Task1+Task5（词表）；Task7 最后守门。按 1→2→3→4→5→6→7 执行。
- **范围**：单题材、纯内容、零引擎改动；长度不变（无 officialdom 那样的扩展任务）。

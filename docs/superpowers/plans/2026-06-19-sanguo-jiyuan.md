# 三国机缘体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把机缘体系移植到 `sanguo`（乱世谋臣），以**主公势力的兴衰**为脊：谋略施展上限由势力阶段解锁，阶梯**可升（flagsSet）可跌（flagsClear）**、可**改换门庭**；apex 须辅主成霸业；加主公信任 decay 治旧「0% 死亡」之平淡。

**Architecture:** 纯内容/配置改动，零引擎改动——复用 L1 的 `ceiling`/`ceilingUnlocks`/`outcomes`/`endTone`/`keyMoment`/`flags`/**`flagsClear`**（`has()`/`!has()` 条件）。prompt.ts 与 sim-balance.ts 已通用（含 tierLabel）。所有改动落在 `src/scenarios/sanguo.ts`；新建 `src/scenarios/sanguo.test.ts`。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints

- **长度保持 `maxTurns: 30`**（「三十年风云」，不改）；`turnUnit` 仍「年」。既有 `maxTurns & …` 善终结局条件不变（除 §apex 三巅峰）。
- **势力印记**固定四个、按序：`据州`→`称雄`→`鼎足`→`霸业`，**只有 `wit`（谋略）有此阶梯**；`repute`（声望）/`trust`（主公信任）不设封顶。
- **base ceiling 必须 = wit initial 30**（不可更低：`clampEffects` 无条件截断，base<30 会把开局 wit=30 削到 ceiling）。
- **volatility**：势力阶梯靠 `flagsSet` 升、靠 `flagsClear` 跌（主公失势/改投）；这是本题材独有。apex 须 `has(霸业)`。
- **tierLabel: '势力'**；trust 加 `decayPerTurn: 1`（治平淡，sim 调）。
- 哨兵 condition 用 `trust<=-1`（`trust.deathBelow===0`，`invariants.test.ts` A2 已豁免）。
- **新建事件前必须 Grep 既有 summary 防撞名**（梨园曾因新建「开宗立派」与既有事件撞名）。
- 测试 Vitest；每 Task 提交前 `npx tsc --noEmit` 干净、全量 `npx vitest run` 绿。
- 提交 trailer 两行：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- sim 数字控制器亲验。命令用工具原生 cwd（`git -C`、`npx --prefix`），不用复合 `cd <path>; cmd`。

## File Structure

- `src/scenarios/sanguo.ts`（修改）：唯一内容文件（~1500 行，~70 events，22 endings）。
- `src/scenarios/sanguo.test.ts`（新建）：封顶/势力链/**flagsClear 失势改投**/巅峰门控/身份/隐藏 endTone/AI/守护。
- `scripts/sim-balance.ts`（沿用，已通用，不改）。

参考样板（只读，勿改）：`src/scenarios/wuxia.ts`/`officialdom.ts`/`liyuan.ts`（ceilingUnlocks、新建/retrofit 闸门、巅峰改 maxTurns、tierLabel、隐藏 endTone 哨兵）、`src/scenarios/liyuan.test.ts`（测试样式）。

---

## Task 1: 谋略势力封顶阶梯 + 主公信任 decay

**Files:** Modify `src/scenarios/sanguo.ts`（`wit`、`trust` 属性）；Create `src/scenarios/sanguo.test.ts`

**Interfaces:** Produces `wit` 带 `ceiling:30` + `ceilingUnlocks:[{flag:'据州',max:45},{flag:'称雄',max:70},{flag:'鼎足',max:88},{flag:'霸业',max:100}]`；`trust` 带 `decayPerTurn:1`。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/sanguo.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { sanguo } from './sanguo'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'

describe('sanguo 谋略势力封顶', () => {
  it('无势力印记时谋略封顶 30（= initial，不被削）', () => {
    expect(clampEffects(sanguo, { wit: 30 }, { wit: 20 }, []).wit).toBe(30)
  })
  it('据州印记解锁封顶 45', () => {
    expect(clampEffects(sanguo, { wit: 40 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('称雄印记解锁封顶 70', () => {
    expect(clampEffects(sanguo, { wit: 60 }, { wit: 20 }, ['据州', '称雄']).wit).toBe(70)
  })
  it('鼎足印记解锁封顶 88', () => {
    expect(clampEffects(sanguo, { wit: 80 }, { wit: 20 }, ['据州', '称雄', '鼎足']).wit).toBe(88)
  })
  it('霸业印记解锁封顶 100', () => {
    expect(clampEffects(sanguo, { wit: 95 }, { wit: 20 }, ['据州', '称雄', '鼎足', '霸业']).wit).toBe(100)
  })
  it('失势降阶：有据州称雄、失称雄后谋略上限回落 45', () => {
    // flagsClear 把 称雄 去掉，只剩 据州 → ceiling 45
    expect(clampEffects(sanguo, { wit: 45 }, { wit: 20 }, ['据州']).wit).toBe(45)
  })
  it('声望与信任不设封顶；信任带每年衰减', () => {
    expect(clampEffects(sanguo, { repute: 95 }, { repute: 20 }, []).repute).toBe(100)
    expect(sanguo.attributes.find((a) => a.key === 'trust')!.decayPerTurn).toBe(1)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/sanguo.test.ts -t "势力封顶"` → FAIL（wit 无 ceiling、trust 无 decay）。

- [ ] **Step 3: 实现** —
(a) `wit` 属性加 `ceiling: 30` + `ceilingUnlocks`（保留 bands）：
```ts
{
  key: 'wit', name: '谋略', initial: 30, max: 100,
  ceiling: 30,
  ceilingUnlocks: [
    { flag: '据州', max: 45 },
    { flag: '称雄', max: 70 },
    { flag: '鼎足', max: 88 },
    { flag: '霸业', max: 100 },
  ],
  bands: [ /* 保持原样 */ ],
},
```
(b) `trust` 属性加 `decayPerTurn: 1`（在 deathBelow 旁；注释：主公日久情疏、功高生疑，信任须主动经营维系，否则渐失宠见弃）。`repute` 不动。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/sanguo.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(sanguo): 谋略势力封顶阶梯（据州/称雄/鼎足/霸业）+ 主公信任decay`

---

## Task 2: 身份印记 + 身份事件门控

**Files:** Modify `src/scenarios/sanguo.ts`（`openings`、身份事件 requires）；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Produces 3 开局各带 flag（寒门游学士子/世家子弟/降将谋臣）。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
describe('sanguo 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门游学士子', '世家子弟', '降将谋臣']) {
      const op = sanguo.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(sanguo, op).flags).toContain(n)
    }
  })
  it('身份专属事件带 has() 门控（至少各一）', () => {
    const evs = sanguo.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('降将谋臣')).toBeGreaterThanOrEqual(1)
    expect(byFlag('世家子弟')).toBeGreaterThanOrEqual(1)
    expect(byFlag('寒门游学士子')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑红** — FAIL（openings 无 flag）。

- [ ] **Step 3: 实现** —
(a) `openings` 加 flag（prompt 不变）：
```ts
openings: [
  { name: '寒门游学士子', flag: '寒门游学士子', prompt: '出身寒微，靠游学访师博览群书，胸有韬略却苦无门路，正欲投一明主以展抱负。' },
  { name: '世家子弟', flag: '世家子弟', prompt: '名门望族之后，自幼受经世之学，背负家族兴衰之托，举手投足皆系一族荣辱。' },
  { name: '降将谋臣', flag: '降将谋臣', prompt: '旧主已败，你携残部与一身计谋归降新主，背着降臣的身份，须以功业洗去猜忌。' },
],
```
(b) 给身份专属事件加/合并 `requires`（**已有 requires 用 ` & ` 串接，不覆盖**；逐事件 Grep+Read 确认）。每身份至少 1 个：
- **降将谋臣**：`降将密告`(summary='降将密告') 或含「降/旧主/贰臣/猜忌」味事件 → 加 `has(降将谋臣)`。
- **世家子弟**：含「门第/家族/望族」味事件（如 `幕府倾轧` 之类，先 Read 判断）→ 加 `has(世家子弟)`。
- **寒门游学士子**：含「寒门/游学/无门路/清介」味事件 → 加 `has(寒门游学士子)`。
- 通用事件（征伐/盟约/天下大势）不加身份 gate。
> 实现者先 Read 每个目标事件确认 summary 命中且 requires 正确合并；报告列出每事件 before→after requires 与选取理由。找不到贴切的挑语义最近者并说明。

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): 三开局身份印记 + 寒门/世家/降将身份事件门控`

---

## Task 3: 四道升势机缘（2 新建 + 2 retrofit），势力阶梯上行

**Files:** Modify `src/scenarios/sanguo.ts`（新增 2 + retrofit 三分定策/一统在望）；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Consumes Task 1 ceilingUnlocks。Produces 4 个 `keyMoment` 升势事件，「献定策」选项 `flagsSet:['下一势力']` + 谋略冲新上限，按 据州→称雄→鼎足→霸业 串链。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
describe('sanguo 升势闸门', () => {
  it('四道升势机缘均为 keyMoment 且授对应势力印记、按序串链', () => {
    const want = [
      { summary: '助主据州', flag: '据州', prev: undefined },
      { summary: '助主称雄', flag: '称雄', prev: '据州' },
      { summary: '三分定策', flag: '鼎足', prev: '称雄' },
      { summary: '一统在望', flag: '霸业', prev: '鼎足' },
    ]
    for (const w of want) {
      const ev = (sanguo.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      expect(ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag)), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('助主据州后同回合谋略可破 30 上限', () => {
    let st = initState(sanguo, sanguo.openings!.find((o) => o.name === '寒门游学士子'))
    st = { ...st, attributes: { wit: 30, repute: 40, trust: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '助主据州')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据州'))
    const next = applyChoice(sanguo, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('据州')
    expect(next.attributes.wit).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: 跑红** — FAIL（助主据州/助主称雄 不存在；三分定策/一统在望 未授印记）。

- [ ] **Step 3a: 新建 据州/称雄 两个升势事件** — **先 Grep 确认 `助主据州`/`助主称雄` 不与既有 summary 撞名**，再加入 `localEvents`：

```ts
{
  narrative:
    '你辅佐的这位主公，奔走半生而无尺寸之地，麾下不过残兵数千、流离失所。你献上一策：趁邻郡空虚、人心思定之机，先取一州为根基，结民心、收豪杰、积粮秣，进可图天下，退可保一方。主公沉吟良久，终是依你之计起兵。这一州若得，你与主公便算在这乱世里立稳了脚跟；若败，则连这残破的局面也保不住。',
  choices: [
    { text: '献据州之策，为主公谋一立锥之基', effects: { wit: 18, repute: 6, trust: 6 }, flagsSet: ['据州'], reaction: '你运筹半年、奇正并用，助主公一举据有一州之地；流民归附、府库渐充，主公握你之手叹道得先生，方知何为根基。' },
    { text: '劝主公暂且依附强邻、徐图后计', effects: { repute: 4, trust: 4 }, reaction: '你劝主公暂屈身于强邻檐下、积蓄力量，主公虽采纳却面有不甘；这一缓，立基之机也悄悄迟了。' },
  ],
  summary: '助主据州',
  requires: 'wit>=28 & trust>=35',
  keyMoment: true,
  once: true,
  minTurn: 4,
  weight: 3,
},
{
  narrative:
    '据有一州之后，四邻诸侯环伺，皆欲并吞你这新立的基业。主公召你问策：是趁势扩张、并吞邻郡以成割据称雄之势，还是固守自保、坐观群雄相争。乱世之中，不进则退——你深知唯有打出一片更大的天地，主公的旗号才能真正在这逐鹿场上立住。一篇方略献上，干系着这股势力是就此称雄一方，还是泯然于群雄的吞并之中。',
  choices: [
    { text: '献并邻称雄之策，打出割据局面', effects: { wit: 28, repute: 8, trust: 6 }, flagsSet: ['称雄'], reaction: '你定下远交近攻、各个击破之略，助主公连吞数郡、割据称雄一方；旌旗所指、群雄侧目，你这首席谋臣之名也随之大噪。' },
    { text: '主固守积蓄、深沟高垒以自保', effects: { wit: 6, trust: 4 }, reaction: '你主守成自保、不轻言扩张，主公依你深根固本；基业是稳了，可这偏安一隅的局面，到底没能更进一步。' },
  ],
  summary: '助主称雄',
  requires: 'has(据州) & wit>=42 & repute>=40',
  keyMoment: true,
  once: true,
  minTurn: 10,
  weight: 3,
},
```

- [ ] **Step 3b: Retrofit 三分定策（鼎足 gate）** — 找 `summary: '三分定策'`（现 `requires: 'wit>=60', keyMoment:true, minTurn:22`）：
  - 事件级 `requires` 改为 `'has(称雄) & wit>=60'`；加 `once: true`（保留 keyMoment/minTurn/weight）。
  - 给**两个** choice 各加 `flagsSet: ['鼎足']`，并把其 `wit` 增益调大到冲上限 88（choice[0] `wit:10`→`wit:28`；choice[1] `wit:8`→`wit:28`；其余 effects/reaction 保留）。

- [ ] **Step 3c: Retrofit 一统在望（霸业 gate）** — 找 `summary: '一统在望'`（现 `requires:'wit>=70', once:true, keyMoment:true, minTurn:26`）：
  - 事件级 `requires` 改为 `'has(鼎足) & wit>=70'`（保留 once/keyMoment/minTurn）。
  - 给**两个** choice 各加 `flagsSet: ['霸业']`，wit 增益调大到冲上限 100（choice[0] `wit:8`→`wit:30`；choice[1] `wit:10`→`wit:30`；其余保留）。

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): 四道升势机缘（助主据州→助主称雄→三分定策→一统在望），keyMoment+授势力印记+串链`

---

## Task 4: 势力 volatility —— 失势（flagsClear 降阶）+ 改投（清空）+ 择主

**Files:** Modify `src/scenarios/sanguo.ts`；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Consumes Task 1/3。Produces：①`择主投效` 新建 keyMoment 设主公印记；②`主公丧师失地` 新建 keyMoment（`flagsClear:['鼎足']` 降阶）；③retrofit `敌国招揽` 加 `requires: has(据州)` + 改投选项 `flagsClear:['据州','称雄','鼎足','霸业']`。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
describe('sanguo 势力 volatility（升降可逆 + 改投）', () => {
  it('择主投效 设主公印记', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '择主投效')!
    expect(ev.keyMoment).toBe(true)
    const lordFlags = ev.choices.flatMap((c) => c.flagsSet ?? [])
    expect(lordFlags.some((f) => ['强主', '明主', '汉室'].includes(f))).toBe(true)
  })
  it('主公丧师失地：有鼎足者失势 flagsClear 掉鼎足', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '主公丧师失地')!
    expect(ev.requires).toContain('has(鼎足)')
    const drops = ev.choices.some((c) => (c.flagsClear ?? []).includes('鼎足') || (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('鼎足')))
    expect(drops).toBe(true)
  })
  it('失势后谋略上限回落（鼎足→称雄，clampEffects 用清后印记）', () => {
    // 构造 has(据州,称雄,鼎足) state、取失势选项 → 清掉鼎足 → flags 不含鼎足 → 上限回 70
    let st = initState(sanguo, sanguo.openings![0])
    st = { ...st, attributes: { wit: 88, repute: 50, trust: 50 }, flags: ['据州', '称雄', '鼎足'], history: Array(20).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '主公丧师失地')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsClear ?? []).includes('鼎足') || (c.outcomes ?? []).some((o) => (o.flagsClear ?? []).includes('鼎足')))
    const next = applyChoice(sanguo, st, tr as any, idx, () => 0.999)
    expect(next.flags).not.toContain('鼎足')
    // 上限回 70：再给 wit+20 应被压在 70
    expect(clampEffects(sanguo, next.attributes, { wit: 20 }, next.flags!).wit).toBe(70)
  })
  it('敌国招揽 改投选项清空全部势力印记', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '敌国招揽')!
    expect(ev.requires).toContain('has(据州)')
    const reinvest = ev.choices.find((c) => (c.flagsClear ?? []).includes('据州'))
    expect(reinvest).toBeTruthy()
    for (const f of ['据州', '称雄', '鼎足', '霸业']) expect(reinvest!.flagsClear).toContain(f)
  })
  it('站错主公·身死族灭 结局存在且为哨兵（主公丧师失地的 endTone 落点，本任务自洽）', () => {
    const e = sanguo.endings.find((x) => x.tone === '站错主公·身死族灭')
    expect(e?.condition).toBe('trust<=-1')
  })
})
```

- [ ] **Step 2: 跑红** — FAIL（事件不存在 / 未加 flagsClear）。

- [ ] **Step 3a: 新建 择主投效**（**先 Grep 防撞名**；早期 keyMoment）：
```ts
{
  narrative:
    '乱世群雄并起，你怀揣一身韬略，终要择一木而栖。摆在面前的有几条路：投那兵强马壮、却也多疑寡恩的强主，从此背靠大树却如履薄冰；投那礼贤下士、起步却弱的明主，赌一个君臣相得、白手成业；或扶保那名分犹在、风雨飘摇的汉室正统，得一身清望却也系于累卵。良禽择木，这一选关乎你往后三十年的荣辱生死。',
  choices: [
    { text: '投兵强马壮的强主，背靠大树好乘凉', effects: { repute: 6, trust: -2, wit: 2 }, flagsSet: ['强主'], reaction: '你投入那势大之主帐下，麾下兵精粮足、声势赫赫；只是主上多疑、宿将林立，你这新进谋臣的信任，须一刀一枪去挣。' },
    { text: '投礼贤下士的明主，赌一个君臣相得', effects: { trust: 8, repute: 2 }, flagsSet: ['明主'], reaction: '你择那礼贤下士的明主而事，他待你如手足、言听计从；只是基业未立、前路艰难，这一注押的是君臣相知、白手成业。' },
    { text: '扶保汉室正统，求一身清望', effects: { repute: 10, trust: 2, wit: -2 }, flagsSet: ['汉室'], reaction: '你扶保那名分犹在的汉室，得士林清望加身、忠义之名远播；只是大厦将倾、危如累卵，这份正统的招牌底下，是说不尽的步步惊心。' },
  ],
  summary: '择主投效',
  keyMoment: true,
  once: true,
  minTurn: 2,
  maxTurn: 6,
  weight: 1.4,
},
```

- [ ] **Step 3b: 新建 主公丧师失地**（**先 Grep 防撞名**；失势降阶）：
```ts
{
  narrative:
    '一场倾国之战，败了。主公轻信他人、不纳你的持重之谏，贸然与强敌决于野，结果中伏大败，丧师过半、连失数郡。捷报变讣告，三分鼎足的根基一夕动摇，麾下人心惶惶，邻敌闻风蚕食。你站在残破的舆图前，看着那一片片重新染成敌色的疆土，一时心如刀绞——这倾颓之势，已非你一人之力可挽。',
  choices: [
    { text: '收拾残局、力保不再崩坏', effects: { wit: 6, repute: 2, trust: 2 }, flagsClear: ['鼎足'], reaction: '你竭力收拢溃兵、稳住要害，总算止住了崩盘之势；可三分鼎足的局面到底是丢了，势力退回偏安一隅，元气大伤、再难一时复振。' },
    { text: '献险策行反间、赌一把扳回颓势', effects: {}, outcomes: [
      { weight: 11, effects: { wit: 8, repute: 4 }, flagsClear: ['鼎足'], reaction: '你行险设间、勉力周旋，虽未能挽回失地，倒也让敌军互生猜忌、暂缓了蚕食；可鼎足之势终究丢了，只保住了不致全盘崩溃。' },
      { weight: 1, effects: {}, endTone: '站错主公·身死族灭', reaction: '你那行险的反间之计被敌方将计就计、反咬一口，主公败亡之际迁怒于你，一道令下——你这押错了势力的谋臣，连同满门，都成了这场大败的殉葬。' },
    ] },
  ],
  summary: '主公丧师失地',
  requires: 'has(鼎足)',
  keyMoment: true,
  minTurn: 18,
  weight: 1.1,
},
```

- [ ] **Step 3c: Retrofit 敌国招揽（改投）** — 找 `summary: '敌国招揽'`（现 keyMoment, minTurn 15，choice[2]=`挂印而去，另投那势盛之主`）：
  - 事件级加 `requires: 'has(据州)'`（有基业可弃才谈得上改投）。
  - 给 choice[2] 加 `flagsClear: ['据州', '称雄', '鼎足', '霸业']`（改投强主 → 清空旧主处积累的全部势力阶段，从头辅佐；其 `effects: { wit:4, repute:-6, trust:-10 }` 与 reaction 保留——trust 已重置低位）。

- [ ] **Step 3d: 新增 站错主公·身死族灭 结局**（本任务的「主公丧师失地」失败分支 endTone 落点，使本任务自洽——放 endings 数组、置于 `trust<=0` 见弃问罪 结局**之前**）：
```ts
{
  condition: 'trust<=-1',
  tone: '站错主公·身死族灭',
  epilogue:
    '良禽择木，你却押错了那一棵。你倾尽智计辅佐的主公终是败亡，胜者清算旧敌，绝不容你这运筹帷幄的首脑残喘。城破之日，你立于残垣之间，看着自家的旗号被踏入泥中——满门老幼，皆因你当年那一念之差的择主，一同葬送在这逐鹿天下的棋局里。乱世之中，才高八斗，也敌不过站错了队。',
},
```

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): 势力volatility——失势flagsClear降阶 + 改投清空 + 择主设主公印记 + 站错主公结局`

---

## Task 5: 三巅峰结局改 maxTurns（经天纬地须 has(霸业)）

**Files:** Modify `src/scenarios/sanguo.ts`（3 巅峰结局 condition）；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Produces 经天纬地 须 `maxTurns & has(霸业) & …`；算无遗策 = `maxTurns & wit>=96`（不要求霸业，天然成「才高功业旁落」结局）。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
describe('sanguo 巅峰结局须 maxTurns + 经天纬地须霸业', () => {
  it('满血高谋略在非落幕年不触发巅峰', () => {
    const r = checkEnding(sanguo, { wit: 98, repute: 98, trust: 98 }, 18, ['据州', '称雄', '鼎足', '霸业'])
    for (const t of ['经天纬地·名相千古', '算无遗策·智极而孤', '海内名士·万世景仰']) {
      expect(r?.tone === t, t).toBe(false)
    }
  })
  it('落幕年有霸业+高信任 → 经天纬地', () => {
    const r = checkEnding(sanguo, { wit: 98, trust: 90, repute: 60 }, 30, ['据州', '称雄', '鼎足', '霸业'])
    expect(r?.tone).toBe('经天纬地·名相千古')
  })
  it('落幕年高谋略但无霸业（失势/改投后）→ 落算无遗策而非经天纬地', () => {
    // wit 96 但 flags 无霸业（曾有后被清）
    const r = checkEnding(sanguo, { wit: 98, trust: 90, repute: 60 }, 30, ['据州', '称雄', '鼎足'])
    expect(r?.tone).toBe('算无遗策·智极而孤')
  })
})
```

- [ ] **Step 2: 跑红** — FAIL（巅峰仍被动；经天纬地未要求霸业）。

- [ ] **Step 3: 实现** — 改 3 巅峰 condition（tone/epilogue 不变），其余结局**不动**：
  - `经天纬地·名相千古`：`'wit>=96 & trust>=70'` → `'maxTurns & has(霸业) & wit>=96 & trust>=70'`
  - `算无遗策·智极而孤`：`'wit>=96'` → `'maxTurns & wit>=96'`（不加 has(霸业)——它就是「才高而主未成霸业/失势后」的结局）
  - `海内名士·万世景仰`：`'repute>=96'` → `'maxTurns & repute>=96'`
  > 这 3 个须位于其余 maxTurns 善终结局**之前**（checkEnding 取首个匹配；经天纬地 最具体须最先）。确认顺序、不移动条目。负面/死亡结局（`trust<=0`/`repute<=0`/`repute<=6`/`trust<=6`）保持原样。

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): 三巅峰改maxTurns门控，经天纬地须辅主成霸业，失势后落算无遗策`

---

## Task 6: 隐藏 endTone（站错主公/功高震主 + 一言定鼎天堂）

**Files:** Modify `src/scenarios/sanguo.ts`；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Produces 新增 `站错主公·身死族灭`、`功高震主·赐死狱中`（致死）与 `一言定鼎·名动天下`（天堂）三哨兵结局（`trust<=-1`）；凶险事件加低权 endTone。注：Task 4 的「主公丧师失地」失败分支已用了 `站错主公·身死族灭` endTone——本任务确保该结局**存在**即可被其触发。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
describe('sanguo 隐藏 endTone', () => {
  it('新增三哨兵隐藏结局 trust<=-1', () => {
    for (const t of ['站错主公·身死族灭', '功高震主·赐死狱中', '一言定鼎·名动天下']) {
      const e = sanguo.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('trust<=-1')
    }
  })
  it('功高震主 含低权赐死 endTone 分支', () => {
    const ev = (sanguo.localEvents ?? []).find((e) => e.summary === '功高震主')!
    const has = ev.choices.some((c) => (c.outcomes ?? []).some((o) => o.endTone === '功高震主·赐死狱中'))
    expect(has).toBe(true)
  })
  it('每个哨兵基调都被某事件 endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of sanguo.localEvents ?? []) for (const c of ev.choices) for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
    for (const t of ['站错主公·身死族灭', '功高震主·赐死狱中', '一言定鼎·名动天下']) expect(used.has(t), t).toBe(true)
  })
})
```

- [ ] **Step 2: 跑红** — FAIL。

- [ ] **Step 3: 实现** —
(a) **新增两结局**（endings 数组，置于 `trust<=0` 见弃问罪 结局**之前**，均 `condition: 'trust<=-1'`；注：`站错主公·身死族灭` 已在 Task 4 Step 3d 创建，本任务不重复加）：
```ts
{
  condition: 'trust<=-1',
  tone: '功高震主·赐死狱中',
  epilogue:
    '你的功业太盛、权柄太重，盛到主公夜不能寐。狡兔死、走狗烹的古训，到底还是应在了你身上。一杯御赐的鸩酒、一道莫须有的罪名，便了结了你这经天纬地的一生。诏狱阴冷，你饮下那酒，恍惚又见当年初投时主公执手相托的模样——原来君臣相得，从来都抵不过那高悬于顶、终要落下的猜忌之刃。',
},
{
  condition: 'trust<=-1',
  tone: '一言定鼎·名动天下',
  epilogue:
    '那一席话，你等了半生。主公屏退左右，独问你天下大计，你从容剖陈分合之势、指点未来数十年的走向，一言既出，满座皆惊——这便是定鼎乾坤的隆中之对。消息不胫而走，天下英雄无不动容：原来这乱世的棋局，早已被你一人看穿。自此你声动四海，诸侯争相延揽，你的名字，与这定天下的一策，一同刻进了青史。',
},
```
(b) **功高震主 加低权致死 outcome**（先 Read summary='功高震主' 事件，约 line 502）：把其最激进/恋栈选项从纯 effects 改为 outcomes（保留原 effects 为高权常态 + 加低权 `endTone:'功高震主·赐死狱中'`）。
(c) **天堂 一言定鼎·名动天下** 落点：挂在一个**晚期高谋略**事件（如 `三分定策` 之外的高 wit 事件，或 `密室对策`/`帐中献策` 系，先 Read）的进取选项，加**极低权**（weight 1 对常态 ~20）`endTone:'一言定鼎·名动天下'`。仅此一处天堂。
  > 注：`站错主公·身死族灭` 已由 Task 4「主公丧师失地」失败分支触发（本任务只需保证结局存在）。转换模式同前题材：原 effects+reaction 留高权常态分支，仅 ADD 低权 endTone 分支。实现者 Read 后按此改、报告列出改了哪些事件/选项/权重。

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): 隐藏endTone——站错主公/功高震主赐死 + 稀有一言定鼎天堂`

---

## Task 7: AI 模式 tierLabel 势力 + systemPrompt 补（含 volatility）

**Files:** Modify `src/scenarios/sanguo.ts`（`tierLabel`、`systemPrompt`）；Modify `src/scenarios/sanguo.test.ts`

**Interfaces:** Consumes 已通用的 buildTurnMessages（tierLabel 驱动【晋阶之序】）。**不改 prompt.ts**。Produces `tierLabel:'势力'` + systemPrompt 含势力沉浮/改投规则。

- [ ] **Step 1: 写失败测试** — 在 `sanguo.test.ts` 追加：

```ts
import { buildTurnMessages } from '../engine/prompt'

describe('sanguo AI 模式', () => {
  it('tierLabel=势力，晋阶之序用本剧术语「势力」+ 势力印记序', () => {
    const st = initState(sanguo, sanguo.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(sanguo, st).map((m) => m.content).join('\n')
    expect(sanguo.tierLabel).toBe('势力')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('势力')
    expect(all).toContain('据州→称雄→鼎足→霸业')
    expect(all).not.toContain('封顶')
    expect(all).toContain('一言定鼎') // 隐藏天堂 tone 经词表注入
  })
  it('systemPrompt 含势力沉浮/改投规则与横祸极稀指导', () => {
    expect(sanguo.systemPrompt).toContain('势力')
    expect(sanguo.systemPrompt).toContain('改换门庭')
  })
  it('提示不含「共 undefined」', () => {
    const st = initState(sanguo, sanguo.openings![0], undefined, 'ai')
    expect(buildTurnMessages(sanguo, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑红** — tierLabel/systemPrompt 条 FAIL。

- [ ] **Step 3: 实现** —
(a) 加 `tierLabel: '势力',`（放 `turnUnit`/`maxTurns` 附近，schema 顺序：…maxTurns, tierLabel, systemPrompt…）。
(b) 在 `systemPrompt` 末尾追加（保留原有规则）：
```
- 谋士之命系于主公在逐鹿天下中的兴衰：势力（你辅佐之主的争霸阶段：据州→称雄→鼎足→霸业）决定你谋略的施展上限，须真机缘 + 主公做大方能更进；让势力推进时在 JSON 里 flagsSet:["下一势力"]，势力印记只能取 据州→称雄→鼎足→霸业、按序不越级
- 势力随主公沉浮、可进可退：主公大败会失势（剧情中可叙其失地退阶），主公败亡时谋臣可殉主、可归隐、可改换门庭另投强主（从头辅佐，旧势力尽失）；切勿把势力当作只升的个人等级
- 站错主公、功高震主等无视一切的横祸极其凶险，仅在真正万劫不复处偶用 endTone 令本年即终局；乱世无常，绝大多数年份不应出现
```

- [ ] **Step 4: 跑绿 + Commit** — `feat(sanguo): AI模式tierLabel势力+systemPrompt补势力沉浮/改投+横祸极稀`

---

## Task 8: 平衡 sim 守门 + 全量回归（重点治旧 0% 死亡）

**Files:** Modify（按需微调）`src/scenarios/sanguo.ts`（trust decay、升势/失势/改投 requires·weight·minTurn、apex/endTone 权重）；Modify（若调断言）`src/scenarios/sanguo.test.ts`

**Interfaces:** Consumes `scripts/sim-balance.ts`（`npx vite-node scripts/sim-balance.ts sanguo 5000`）。

- [ ] **Step 1: 跑 sim 基线** — `npx vite-node scripts/sim-balance.ts sanguo 5000`，记录三策略。
- [ ] **Step 2: 对照目标微调**（spec §10）：
  - **治旧 0% 死亡**：加 trust decay + endTone 后 random 真死亡应从 0% 拉到合理（≤~55%）；坏结局够（旧 5.8% → 显著提高）。若仍偏低，抬 trust decay 或减升势的 trust 回补。
  - **apex 稀有**：经天纬地须 has(霸业)；乱点/greedy 登顶低；survive 个位数%且来自真攀爬+押对赢家（不强求 0）。
  - **可活到落幕**：survive 活到 maxTurns（reachedMax 不应 ~0）；trust decay 调到「主动经营可维持」。
  - **P(收场<10)≈0**（random/survive）；greedy 早死残余按同理接受。
  - **乱点止步低势力**（无印记/据州）；霸业 个位数%。
  - **升势 reach 合理**（据州/称雄/鼎足 达成率不应~0）；改投/失势确有触发。
  小步、单改单跑。**不改印记链结构与巅峰门控**。
- [ ] **Step 3: 控制器亲验** — 控制器重跑确认，sim block 贴入报告。
- [ ] **Step 4: 全量回归** — `npx vitest run` 全绿；`npx tsc --noEmit` 0；`npx vite-node scripts/sim-balance.ts all 1000`（确认未影响其它题材）。
- [ ] **Step 5: Commit** — `fix(sanguo): 重 sim 守平衡（治旧0%死亡/apex须霸业稀有/可活到落幕），记录最终 sim`

---

## Self-Review

- **Spec coverage**：§2 封顶=Task1；§8 decay=Task1；§6 身份=Task2；§2 升势=Task3；§2/§3 volatility(失势/改投/择主)=Task4；§5 apex=Task5；§7 隐藏 endTone=Task6；§9 AI=Task7；§10 平衡=Task8。全覆盖。
- **Placeholder 扫描**：Task2/3b-c/4c/6 要求实现者先 Read 既有事件再按精确模式改/合并；Task3a/3b、Task4 给完整新建事件对象；新建事件均注明「先 Grep 防撞名」（梨园教训）。无 TBD/TODO。
- **Type 一致**：势力印记 `据州/称雄/鼎足/霸业` 跨 Task1（ceilingUnlocks）、Task3（flagsSet）、Task4（flagsClear）、Task7（systemPrompt/词表）一致；哨兵 `trust<=-1` 跨 Task4(endTone)/Task6 一致；致死 tone `站错主公·身死族灭` 跨 Task4（endTone）+Task6（结局）一致；巅峰 tone 跨 Task5 一致；tierLabel '势力' 跨 Task7 一致。retrofit 事件 summary（三分定策/一统在望/敌国招揽/功高震主）均为 sanguo.ts 现存。
- **顺序依赖**：Task1（封顶/decay）→ Task3（升势抬封顶）→ Task4（失势/改投需有印记可清）→ Task5（apex 须 has(霸业)）；Task2/6 相对独立；Task7 依赖 Task1+Task4+Task6（词表）；Task8 最后守门。按 1→2→3→4→5→6→7→8。
- **范围**：单题材、纯内容、零引擎改动；volatility(flagsClear) 是本题材独有、Task4 专测升与降。

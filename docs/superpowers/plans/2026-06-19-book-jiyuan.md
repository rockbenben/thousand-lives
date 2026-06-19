# 穿书「穿书逆袭」机缘体系 实现计划（收官）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给穿书题材（最后一个）铺机缘体系——剧情偏离为脊（plot ceiling 随改写关键节点抬升）、双死亡线、隐藏 endTone 彩蛋；并修复 book 现被引擎测试当「无flag样本」的连带问题。

**Architecture:** 在 `src/scenarios/book.ts`（export 名 `bookTransmigration`，id `'book'`）上做最小机缘叠加：①`plot` 加 `ceilingUnlocks`（偏离印记 撬动→生变→颠覆→改天，只进不退）；②三开局加 `flag` + 三身份事件；③改造四道既有 keyMoment 剧情节点为升偏离闸门；④三个 `safety<=-1` 哨兵结局（1新增篡位支+2改造，加权 outcomes endTone）；⑤`tierLabel:'偏离'` + systemPrompt；⑥`favor` decay 与 sim 校准 + **修 prompt.test 的 book 无flag-fixture**。新建测试 `src/scenarios/book.test.ts`。

**Tech Stack:** Vite + React 18 + TypeScript + Zod + Vitest。

## Global Constraints
- 测试：`npx vitest run src/scenarios/book.test.ts`（仓库根 `D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives`）。**收尾必跑全量 `npx vitest run` + `npx tsc --noEmit`**。**不要** compound `cd ...;`（用 `git -C`）。
- 提交**不带** AI 署名 trailer。
- export 名是 **`bookTransmigration`**（不是 `book`）；测试 `import { bookTransmigration } from './book'`。
- 引擎契约（勿改 `src/engine/`）：`clampEffects` 用「选择后」flags 算 `effectiveCeiling`；base `ceiling` 须 ≥ initial；`rollOutcome` 有 `outcomes` 时按 weight 取一、`picked.effects` 覆盖扁平 effects、`picked.endTone` 强制结局（无 rng 取 outcomes[0]）；条件语法支持 `has(印记)` 与 `&`。
- `plot` initial=10 → base `ceiling` 取 **10**。偏离**只进不退**：无 `flagsClear`。
- **★outcomes 约定**：带 `outcomes` 的**选项本身**必须 `effects: {}`；每个 outcome 分支（含纯 endTone 分支）必须有 `effects: {}`（缺则 tsc TS2741）；endTone 分支补 `reaction`。
- 新增事件/选项前先 `Grep "summary: '<名>'" src/scenarios/book.ts` 防撞名。测试 import 仅取实际用到的。

---

### Task 1: 剧情偏离 ceilingUnlocks 阶梯

**Files:** Modify `src/scenarios/book.ts`（`plot` 属性，约 line 10-20）；Test `src/scenarios/book.test.ts`（新建）

**Interfaces:** Produces `plot` 带 `ceiling:10` + `ceilingUnlocks:[{flag:'撬动',max:30},{flag:'生变',max:60},{flag:'颠覆',max:85},{flag:'改天',max:100}]`。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/book.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { bookTransmigration } from './book'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

const book = bookTransmigration

describe('book 剧情偏离封顶', () => {
  it('无偏离印记时偏离封顶 10（= base，≥ initial 不被削）', () => {
    expect(clampEffects(book, { plot: 10 }, { plot: 20 }, []).plot).toBe(10)
  })
  it('撬动→30 生变→60 颠覆→85 改天→100 逐级解锁', () => {
    expect(clampEffects(book, { plot: 25 }, { plot: 20 }, ['撬动']).plot).toBe(30)
    expect(clampEffects(book, { plot: 50 }, { plot: 20 }, ['撬动', '生变']).plot).toBe(60)
    expect(clampEffects(book, { plot: 80 }, { plot: 20 }, ['撬动', '生变', '颠覆']).plot).toBe(85)
    expect(clampEffects(book, { plot: 95 }, { plot: 20 }, ['撬动', '生变', '颠覆', '改天']).plot).toBe(100)
  })
  it('主角好感与安全值不设偏离封顶', () => {
    expect(clampEffects(book, { favor: 95 }, { favor: 20 }, []).favor).toBe(100)
    expect(clampEffects(book, { safety: 95 }, { safety: 20 }, []).safety).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: FAIL。

- [ ] **Step 3: 实现** — 在 `plot` 属性的 `max: 100,` 行与 `bands: [` 行之间插入：

```ts
      max: 100,
      // 偏离印记逐级解锁剧情天花板：循原著则偏离卡 10（注定领盒饭），唯改写关键节点方能层层挣脱命运
      ceiling: 10,
      ceilingUnlocks: [
        { flag: '撬动', max: 30 },
        { flag: '生变', max: 60 },
        { flag: '颠覆', max: 85 },
        { flag: '改天', max: 100 },
      ],
      bands: [
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/book.ts src/scenarios/book.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(book): 剧情偏离封顶阶梯（撬动/生变/颠覆/改天逐级解锁）"
```

---

### Task 2: 三开局身份印记 + 三身份事件

**Files:** Modify `src/scenarios/book.ts`（`openings` 约 line 51-55；`localEvents` 末尾追加三事件）；Test `src/scenarios/book.test.ts`

**Interfaces:** Produces 开局 flag `恶毒女配`/`反派之女`/`陪嫁婢女`；三道 `requires:'has(<flag>)'` 身份事件（summary `恶女人设`/`反女宿命`/`婢女近身`）。

- [ ] **Step 1: 写失败测试** — 在 `book.test.ts` 追加：

```ts
describe('book 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 恶毒女配: '恶毒女配', 反派之女: '反派之女', 陪嫁婢女: '陪嫁婢女' }
    for (const [name, flag] of Object.entries(want)) {
      const op = book.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(book, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = book.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('恶毒女配')).toBeGreaterThanOrEqual(1)
    expect(byFlag('反派之女')).toBeGreaterThanOrEqual(1)
    expect(byFlag('陪嫁婢女')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 给三开局加 flag** — 把 `openings` 改为（仅加 `flag`，`prompt` 不动）：

```ts
  openings: [
    { name: '恶毒女配', prompt: '原著中处处针对女主、第三章便被赐死的贵女，身份显赫却命途已定。', flag: '恶毒女配' },
    { name: '反派之女', prompt: '大反派的独女，注定陪父亲一族一同覆灭，养在深闺却身处权斗漩涡正中。', flag: '反派之女' },
    { name: '陪嫁婢女', prompt: '原著中替主子挡灾、不起眼却贴近主线的世家陪嫁丫鬟，身份卑微，却看遍内宅风波。', flag: '陪嫁婢女' },
  ],
```

- [ ] **Step 3b: 追加三道身份事件** — 先 `Grep "summary: '恶女人设'|summary: '反女宿命'|summary: '婢女近身'" src/scenarios/book.ts` 确认无撞名；在 `localEvents: [` 数组**末尾**插入：

```ts
    {
      narrative:
        '你这恶毒女配的名声，早被原著写死了——眼下又一桩「该由你使坏」的戏码撞上门来：旁人皆等着看你刁难磋磨，剧情的惯性也推着你照本宣科地恶下去。可你心里清楚，每演一回书里的恶毒，便往那第三章的死签上又贴近一分。是顺着「恶毒女配」的人设演下去图个眼前安稳，还是反其道而行、做一件原著里这角色绝不会做的事，撬一撬命运？',
      choices: [
        { text: '照人设使坏，图眼前安稳', effects: { plot: -3, safety: 8, favor: -6 }, reaction: '你照着「恶毒女配」的本分磋磨了人，旁人见怪不怪、剧情安稳滑过；可那第三章的死签，又冷冷地贴近了一分。' },
        { text: '反其道行善，撬动既定人设', effects: { plot: 8, favor: 8, safety: -4 }, reaction: '你做了件「恶毒女配」绝不会做的善事，旁人面面相觑、议论纷纷；那钉死你人设的剧情，竟被生生撬开一道缝。' },
      ],
      summary: '恶女人设',
      requires: 'has(恶毒女配)',
      minTurn: 3,
      weight: 0.9,
    },
    {
      narrative:
        '你是大反派的独女，原著里注定要陪父亲一族一同抄家问斩。今日父亲那边又递来要你出力的差事——办了，便与那艘注定沉没的船绑得更死；推了，又恐当场招来父亲的雷霆。深宅大院里，覆灭的倒计时在头顶滴答作响。是恪守「反派之女」的本分、随父族一条道走到黑，还是暗中替自己另留一手、悄悄从那覆灭的命数里挪开半步？',
      choices: [
        { text: '随父族行事，恪守本分', effects: { plot: -3, safety: 6 }, reaction: '你恪守反派之女的本分替父亲办了事，府里上下安心，父亲也未起疑；可你与那艘注定沉没的船，又绑紧了一分。' },
        { text: '暗中另留一手，挪开半步', effects: { plot: 8, safety: -4, favor: 4 }, reaction: '你不动声色地替自己留了条后路，悄悄从父族那覆灭的命数里挪开半步；旁人未觉，命运的绳索却松了一丝。' },
      ],
      summary: '反女宿命',
      requires: 'has(反派之女)',
      minTurn: 3,
      weight: 0.9,
    },
    {
      narrative:
        '你是世家陪嫁的丫鬟，身份卑微得没人正眼瞧，原著里你不过是替主子挡灾的一笔背景。可也正因这份不起眼，内宅里多少风波、多少机密，都在你眼皮底下过——这是高门贵女们绝想不到的便利。今日你又瞧见了一桩要紧的端倪。是继续做那透明的背景、安稳藏身，还是借这「没人当回事」的近身之便，悄悄插手、改一改那既定的剧情？',
      choices: [
        { text: '安做透明背景，藏身要紧', effects: { plot: -2, safety: 8 }, reaction: '你垂手立在角落做回那透明的背景，没人多看你一眼；安稳是安稳了，那桩你本可撬动的端倪，也从眼前溜了过去。' },
        { text: '借近身之便，暗中插手', effects: { plot: 8, favor: 6, safety: -4 }, reaction: '你借着「没人当回事」的近身之便悄悄动了手脚，贵人们浑然不觉；一介婢女，竟在内宅风波里改写了一笔旁人想不到的剧情。' },
      ],
      summary: '婢女近身',
      requires: 'has(陪嫁婢女)',
      minTurn: 3,
      weight: 0.9,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/book.ts src/scenarios/book.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(book): 三开局身份印记 + 三道身份事件门控"
```

---

### Task 3: 四道升偏离闸门（改造既有剧情节点）

**Files:** Modify `src/scenarios/book.ts`（事件 `宫宴落水`/`反派密谈`/`储位之争`/`宫变前夜`）；Test `src/scenarios/book.test.ts`

**Interfaces:** Consumes Task 1 印记（撬动/生变/颠覆/改天）。Produces 四道 keyMoment 闸门，按序串链 `撬动→has(撬动)→has(生变)→has(颠覆)`。

- [ ] **Step 1: 写失败测试** — 在 `book.test.ts` 追加：

```ts
describe('book 升偏离闸门', () => {
  it('四道升偏离机缘均为 keyMoment、授对应偏离印记、按序串链', () => {
    const want = [
      { summary: '宫宴落水', flag: '撬动', prev: undefined as string | undefined, pick: '反其道行之，当众救下女主' },
      { summary: '反派密谈', flag: '生变', prev: '撬动', pick: '阳奉阴违，暗中给反派使绊' },
      { summary: '储位之争', flag: '颠覆', prev: '生变', pick: '押注太子，倾力相助' },
      { summary: '宫变前夜', flag: '改天', prev: '颠覆', pick: '先发制人，连夜布局逼宫' },
    ]
    for (const w of want) {
      const ev = (book.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('救女主当回合偏离可破 10 上限', () => {
    let st = initState(book, book.openings![0])
    st = { ...st, attributes: { plot: 10, favor: 20, safety: 60 }, history: [] }
    const ev = (book.localEvents ?? []).find((e) => e.summary === '宫宴落水')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('撬动'))
    const next = applyChoice(book, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('撬动')
    expect(next.attributes.plot).toBeGreaterThan(10) // 该支 plot+12，破上限 10（撬动上限 30）
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 宫宴落水 → 撬动闸门** — 给「反其道行之，当众救下女主」加 `flagsSet: ['撬动']`（事件已 keyMoment/once/minTurn1/maxTurn30，无 requires）：

```ts
        { text: '反其道行之，当众救下女主', effects: { plot: 12, favor: 15, safety: -8 }, flagsSet: ['撬动'], reaction: '满座宾客倒吸一口凉气，天子眼底掠过一丝讶异；那只静候你推人入水的无形之手，竟生生顿在了半空。' },
```

- [ ] **Step 3b: 反派密谈 → 生变闸门** — 给「阳奉阴违，暗中给反派使绊」加 `flagsSet: ['生变']`，事件加 `requires: 'has(撬动)'`（已 keyMoment，保留 weight1.3）。尾部改为：

```ts
        { text: '阳奉阴违，暗中给反派使绊', effects: { plot: 14, favor: 6, safety: -12 }, flagsSet: ['生变'], reaction: '反派的几名党羽暗自交换着疑色，竟看不透你葫芦里卖的什么药；那盘必胜的死局，悄然裂开一道缝。' },
```
并在 `summary: '反派密谈',` 与 `weight: 1.3,` 之间插入 `requires: 'has(撬动)',`。另两选项不动。

- [ ] **Step 3c: 储位之争 → 颠覆闸门** — 给「押注太子，倾力相助」加 `flagsSet: ['颠覆']`，事件加 `requires: 'has(生变)'`（已 keyMoment/once/minTurn10）：

```ts
        { text: '押注太子，倾力相助', effects: { plot: 12, favor: 14, safety: -8 }, flagsSet: ['颠覆'], reaction: '太子怔了怔，眼底那层提防化作一缕动容；东宫幕僚暗暗心惊：这枚弃子，竟主动押上了全副身家。' },
```
并在 `summary: '储位之争',` 下方插入 `requires: 'has(生变)',`（与 `keyMoment: true,` 同级）。另一选项不动。

- [ ] **Step 3d: 宫变前夜 → 改天闸门** — 给「先发制人，连夜布局逼宫」加 `flagsSet: ['改天']`，事件加 `requires: 'has(颠覆)'`（已 keyMoment/once/minTurn24/weight2）：

```ts
        { text: '先发制人，连夜布局逼宫', effects: { plot: 14, favor: 5, safety: -10 }, flagsSet: ['改天'], reaction: '心腹幕僚倒吸一口冷气，又惊又佩；远处宫城的修正力轰然一震，竟没料到炮灰敢先翻盘。' },
```
并在 `summary: '宫变前夜',` 下方插入 `requires: 'has(颠覆)',`。另两选项不动。

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/book.ts src/scenarios/book.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(book): 四道升偏离闸门（宫宴落水/反派密谈/储位之争/宫变前夜）keyMoment+授偏离印记+串链"
```

---

### Task 4: 三个隐藏 endTone 哨兵彩蛋

**Files:** Modify `src/scenarios/book.ts`（`endings` 追加 3 项；事件 `世界濒临崩解`/`主角翻脸` 改对应支为 outcomes、`女主示好` **新增**篡位支）；Test `src/scenarios/book.test.ts`

**Interfaces:** Produces 三个 `condition:'safety<=-1'` 结局（`窥破天机·归返现世`、`夺运噬主·堕为新煞`、`鸠占凤巢·反噬其身`）。

- [ ] **Step 1: 写失败测试** — 在 `book.test.ts` 追加：

```ts
describe('book 隐藏 endTone 哨兵', () => {
  const tones = ['窥破天机·归返现世', '夺运噬主·堕为新煞', '鸠占凤巢·反噬其身']
  it('三哨兵结局存在且 condition 为 safety<=-1', () => {
    for (const t of tones) expect(book.endings.find((x) => x.tone === t)?.condition, t).toBe('safety<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of book.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('掀翻原著的 endTone 分支被掷中即强制天堂结局', () => {
    let st = initState(book, book.openings![0])
    st = { ...st, attributes: { plot: 80, favor: 30, safety: 40 }, history: Array(20).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (book.localEvents ?? []).find((e) => e.summary === '世界濒临崩解')!
    const idx = ev.choices.findIndex((c) => c.text === '顺势而为，将原著彻底掀翻')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(book, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('窥破天机·归返现世')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 追加三个哨兵结局** — 在 `endings: [` 数组里、紧跟 `safety<=0`（`被剧情修正力抹杀`）那个结局对象之后，插入：

```ts
    { condition: 'safety<=-1', tone: '窥破天机·归返现世', epilogue: '当原著被你掀到彻底崩解的那一刻，天地间忽然裂开一道刺目的白光——井水倒涌，星象崩落，那本名为《凤凰劫》的书，连同它所有的字句、人物、命数，在你眼前轰然碎成齑粉。再睁眼时，你躺在自己家中的床上，台灯还亮着，那本看了一半的虐文摊在枕边，一切恍如大梦。你窥破了这世界的虚妄，竟真从书里走了回来——只是往后每次翻开书页，你都会想起那个你曾拼命改写过的、有血有肉的世界。' },
    { condition: 'safety<=-1', tone: '夺运噬主·堕为新煞', epilogue: '绝境之中，你做了最不该做的事——不只揭破主角的隐秘，更趁势夺了他那一身的气运光环，取而代之。一时间你权势滔天，仿佛成了这本书新的主角。可你很快就懂了：这世界需要的从来不是「主角」，而是一个供它碾碎的「劫」。气运噬主，反噬其身，那曾庇佑主角的修正之力，如今尽数化作绞索朝你收来——你成了《凤凰劫》里，一个比原著炮灰更惨烈的新煞。' },
    { condition: 'safety<=-1', tone: '鸠占凤巢·反噬其身', epilogue: '你借着女主递来的那点信任，反手将她推进了万劫不复，又一步步爬上了她那本该「天命所归」的位置。凤巢是你的了，可你忘了：这书里的「凤凰」从来不是谁想替就替得了的。你坐上那个位置的当天，原属于女主的所有劫难、所有要她偿命的伏笔，便一桩桩、一件件，尽数转到了你头上。鸠占凤巢，反噬其身——你篡来的荣华，原来是一份催命的契。' },
```

- [ ] **Step 3b: 世界濒临崩解「顺势掀翻」改 outcomes（天堂·稀有 4:1）** — 把 `世界濒临崩解` 事件里「顺势而为，将原著彻底掀翻」整体替换为：

```ts
        {
          text: '顺势而为，将原著彻底掀翻',
          effects: {},
          outcomes: [
            { weight: 4, effects: { plot: 15, safety: -10, favor: -4 }, reaction: '京中异象愈烈，连主角的光环都黯了下去；那盘原著大棋被你一把掀翻，满天修正力为之骇然失色。' },
            { weight: 1, effects: {}, endTone: '窥破天机·归返现世', reaction: '你把这本书掀到了彻底崩解，天地间裂开一道白光——《凤凰劫》连同它的一切轰然碎尽，你竟从书里梦醒，回到了现实。' },
          ],
        },
```

- [ ] **Step 3c: 主角翻脸「反咬揭隐秘」改 outcomes（地狱 4:1）** — 把 `主角翻脸` 事件里「反咬一口，揭主角的隐秘旧事」整体替换为：

```ts
        {
          text: '反咬一口，揭主角的隐秘旧事',
          effects: {},
          outcomes: [
            { weight: 4, effects: { plot: 14, favor: -8, safety: -6 }, reaction: '满朝文武倒抽一口凉气，萧宸脸色骤变；那桩本该烂进土里的隐秘被你掀出，剧情之力为之骇然一滞。' },
            { weight: 1, effects: {}, endTone: '夺运噬主·堕为新煞', reaction: '你不只揭破他的隐秘，更趁势夺了他一身的气运取而代之——可这世界要的从不是主角，而是一个供它碾碎的劫；气运噬主，你成了比炮灰更惨的新煞。' },
          ],
        },
```

- [ ] **Step 3d: 女主示好 新增「篡位」支（地狱 4:1）** — 在 `女主示好` 事件的 `choices` 数组里、最后一个选项「虚与委蛇，暗中提防」之后，追加：

```ts
        {
          text: '将计就计，取而代之',
          effects: {},
          outcomes: [
            { weight: 4, effects: { plot: 8, favor: -10, safety: -6 }, reaction: '你借着女主递来的信任反手设局，一步步将她推开、爬上她的位置；她错愕的眼神里，第一次有了真切的恨意。' },
            { weight: 1, effects: {}, endTone: '鸠占凤巢·反噬其身', reaction: '你篡了女主那本该天命所归的位置——可她身上所有的劫难与催命的伏笔，从你坐上去那天起，便一桩桩尽数转到了你头上。' },
          ],
        },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/book.ts src/scenarios/book.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(book): 三隐藏endTone哨兵——窥破归现世（天堂）+ 夺运噬主/鸠占凤巢（地狱）"
```

---

### Task 5: tierLabel + systemPrompt + AI 注入

**Files:** Modify `src/scenarios/book.ts`（顶层加 `tierLabel`；`systemPrompt` 末尾补）；Test `src/scenarios/book.test.ts`

**Interfaces:** Consumes Task 1 ceilingUnlocks。Produces `tierLabel:'偏离'`；systemPrompt 含偏离晋阶/改写损safety权衡/隐藏结局指引。

- [ ] **Step 1: 写失败测试** — 在 `book.test.ts` 追加：

```ts
describe('book AI 模式', () => {
  it('tierLabel=偏离，晋阶之序用本剧术语「偏离」+ 偏离印记序', () => {
    const st = initState(book, book.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(book, st).map((m) => m.content).join('\n')
    expect(book.tierLabel).toBe('偏离')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('偏离')
    expect(all).toContain('撬动→生变→颠覆→改天')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含偏离晋阶与改写损安全的权衡指引', () => {
    expect(book.systemPrompt).toContain('偏离')
    expect(book.systemPrompt).toContain('撬动')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(book, book.openings![0], undefined, 'ai')
    expect(buildTurnMessages(book, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: FAIL（无 tierLabel）。

- [ ] **Step 3a: 加 tierLabel** — 在 `turnUnit: '章',` 一行之后插入：

```ts
  turnUnit: '章',
  tierLabel: '偏离',
  maxTurns: 30,
```

- [ ] **Step 3b: systemPrompt 补两行** — 在 `systemPrompt` 末尾、`- 临近第30章时，铺垫大结局的多种可能走向` 这一行之后（闭合反引号 `` ` `` 之前）追加两行（最后一行以原本的闭合反引号收尾，勿破坏模板字符串）：

```
- 偏离分「撬动→生变→颠覆→改天」数级，唯有改写关键剧情节点（关键抉择中反原著而行的那一手）方能晋阶；偏离越高，主角光环越弱、修正力越难碾压你——但每一次改写都会折损安全值（修正力反扑），抉择须在「改写求活」与「贴合保命」之间权衡
- 夺取主角气运取而代之、借信任篡夺女主之位等极端僭越，或把原著彻底掀翻的孤注一掷，皆可能通向隐藏的结局`
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/book.ts src/scenarios/book.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(book): tierLabel偏离 + systemPrompt补偏离晋阶/改写损安全权衡/隐藏结局指引"
```

---

### Task 6: favor decay + sim 校准 + 修引擎测试 fixture + 全量回归（收官）

**Files:** Modify `src/scenarios/book.ts`（`favor`，按 sim 定 decay）；`src/engine/prompt.test.ts`（修无flag-fixture）；Test `src/scenarios/book.test.ts`

**Interfaces:** Consumes Task 1–5。Produces 经 sim 校准的 `favor` decay 值 + 修好的引擎测试。

- [ ] **Step 1: 先修 prompt.test 的无flag-fixture（否则全量回归必红）** — `src/engine/prompt.test.ts` 现把 `book` 当「无 flag 样本」(`const noFlag = builtinScenarios.find((s) => s.id === 'book')!`)，book 铺机缘后 `scenarioUsesFlags(book)` 变真、prompt 会含晋阶段，那两条断言会红。**9 题材现已全有机缘，无内置无flag题材**，故改用一个手造的最小无flag scenario 对象。把 `prompt.test.ts` 里那行 `const noFlag = builtinScenarios.find((s) => s.id === 'book')! ...` 替换为：

```ts
  // 9 个内置题材现已全部铺了机缘体系，无现成「无 flag」样本，改用手造的最小无 flag 剧本
  const noFlag = {
    id: 'noflag-sample',
    title: '无机缘样本',
    emoji: '🧪',
    intro: '一个不带任何印记/晋阶机制的最小剧本，仅用于校验无 flag 分支。',
    attributes: [{ key: 'hp', name: '生命', initial: 50, max: 100, deathBelow: 0 }],
    turnUnit: '回合',
    maxTurns: 10,
    systemPrompt: '你是一个测试用的主持人（GM）。简洁推进剧情。',
    endings: [{ condition: 'maxTurns', tone: '收场', epilogue: '一局终了。' }],
  } as unknown as (typeof builtinScenarios)[number]
```
（其余引用 `noFlag` 的两处断言不动：`scenarioUsesFlags(noFlag)).toBe(false)` 与 `无 flag 题材...提示不含印记/境界/flagsSet 段`。若该 describe 顶部已有 `import type { Scenario }`，亦可用 `as Scenario`。）

- [ ] **Step 2: 跑 tsc + 基线 sim** — Run: `npx tsc --noEmit`（须干净）；Run: `npx vitest run src/engine/prompt.test.ts`（确认 fixture 修好、两条无flag断言绿）；Run: `npx vite-node scripts/sim-balance.ts book 5000`。记录：双死亡率（追杀 favor<=0 + 抹杀 safety<=0 + endTone 致死）；偏离登顶档（颠覆/改天 + 高 plot 改写结局）在 random/survive/greedy 占比。

- [ ] **Step 3: 判定 favor decay** — 决策规则：
  - 若「主角死敌·命丧追杀」(favor<=0) 在 random 下显著偏低（favor trivially 稳、几乎不构成压力），给 `favor` 加 `decayPerTurn: 1`（穿书者言行难免渐露破绽、主角好感自然消磨），重跑验证追杀死成为活压力（个位数百分比，且 survive 不至大面积被追杀死）。
  - 注意双死亡线平衡：safety decay2 + 每次改写损 safety 已是主压力，favor decay 勿过猛致双重过罚；若 favor 死已健康则保持 0。记下最终值 `<DECAY>`（0、1 或 2）。

- [ ] **Step 4: 落地 decay（若 >0）+ 写断言测试** — 若 `<DECAY>` > 0，在 `favor` 属性的 `deathBelow: 0,` 之后插入 `decayPerTurn: <值>,`（带注释「穿书者言行渐露破绽，主角好感逐章消磨（sim 校准）」）。然后在 `book.test.ts` 追加（把 `<DECAY>` 换成实际值）：

```ts
describe('book 衰减与 sim 健壮性', () => {
  it('主角好感 decay 经 sim 校准', () => {
    const favor = book.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn ?? 0).toBe(<DECAY>) // sim-tuned
  })
  it('安全值保持每章衰减 2（被剧情修正力抹杀的悬顶之危）', () => {
    expect(book.attributes.find((a) => a.key === 'safety')!.decayPerTurn).toBe(2)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of book.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})
```
Run: `npx vitest run src/scenarios/book.test.ts`，Expected: PASS。

- [ ] **Step 5: 全量回归 + tsc + 提交** — Run: `npx vitest run`（全套绿——含修好的 prompt.test）；Run: `npx tsc --noEmit`（干净）。然后：

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add -A
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "fix(book): 平衡sim——主角好感decay校准 + 修prompt.test无flag-fixture（9题材全有机缘后改手造最小样本）+ 全量回归"
```

---

## Self-Review（对照 spec）

**Spec coverage:** §1 plot ceilingUnlocks→T1 ✓；§2 四升偏离闸门→T3 ✓；§3 双死亡线/favor decay→T6 ✓；§4 三身份事件→T2 ✓；§5 三隐藏 endTone 哨兵→T4 ✓；§6 apex 靠 ceiling（不改结局）→T1 ceiling 即达成 ✓；§7 tierLabel+systemPrompt→T5 ✓；§8 sim + ★fixture修复→T6 ✓。

**Placeholder scan:** 仅 T6 `<DECAY>` 为 sim 经验值（已给决策规则）；其余步骤含完整代码与确切命令。

**Type consistency:** 偏离印记 `撬动/生变/颠覆/改天` 在 T1(ceilingUnlocks)/T3(flagsSet/requires) 一致；哨兵基调 `窥破天机·归返现世`/`夺运噬主·堕为新煞`/`鸠占凤巢·反噬其身` 在 T4 结局/outcomes.endTone/测试三处一致；`tierLabel:'偏离'` 与 T5 一致；export 名 `bookTransmigration` 在测试 import 一致。outcomes 选项均带 `effects:{}`（选项级+每分支级），endTone 分支带 reaction；女主示好新增篡位支为新 choice（2→3，仍 ≤6）。T6 含 prompt.test 无flag-fixture 修复（9 题材全铺机缘后必需）。

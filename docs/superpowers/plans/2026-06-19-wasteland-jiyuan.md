# 废土「末世求生→末世重建」机缘体系 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把废土从「撑30天等救援」扩为「三年末世长期求生+重建」，并铺上机缘体系：据点前进式阶梯（物资 ceiling 随据点抬升）、三身份事件、隐藏 endTone 彩蛋。

**Architecture:** 在 `src/scenarios/wasteland.ts` 上：①时间尺度 turnUnit 天→月、maxTurns 30→36，重写 intro/systemPrompt 前提；②`物资` 加 `ceilingUnlocks`（据点印记 落脚点→据点→堡垒→营地，只进不退）；③新增 4 道建据点 keyMoment 闸门（has(prev) 串链）；④三开局 flag + 三身份事件；⑤把 23 个「救援」结局重构为「三年末世归宿」框架（含 tone 改名）；⑥三个 `sanity<=-1` 哨兵结局（outcomes endTone）；⑦tierLabel '据点' + systemPrompt 晋阶/隐藏结局指引；⑧理智 decay 与 sim 校准。新建测试 `src/scenarios/wasteland.test.ts`。

**Tech Stack:** Vite + React 18 + TypeScript + Zod + Vitest。

## Global Constraints
- 测试：`npx vitest run src/scenarios/wasteland.test.ts`（仓库根 `D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives`）。**收尾必跑 `npx tsc --noEmit`**。**不要** compound `cd ...;`（用 `git -C`）。
- 提交**不带** AI 署名 trailer（无 `Co-Authored-By: Claude` / `Claude-Session:`）。
- 引擎契约（勿改 `src/engine/`）：`clampEffects` 用「选择后」flags 算 `effectiveCeiling`（当回合授印记即破上限）；base `ceiling` 须 **≥ initial**；`rollOutcome` 在有 `outcomes` 时按 weight 取一、`picked.effects` 覆盖扁平 effects、`picked.endTone` 强制结局（无 rng 时取 outcomes[0]）；条件语法支持 `has(印记)` 与 `&`；死亡级替代结局须 `<=` 且 value<=deathBelow。
- `物资` initial=50 → base `ceiling` 取 **50**。据点**只进不退**：不引入任何 `flagsClear`。
- **★outcomes 约定**：带 `outcomes` 的**选项本身**必须写 `effects: {}`；每个 outcome 分支（含纯 endTone 分支）也必须有 `effects: {}`（缺则 tsc TS2741）；endTone 分支补 `reaction`。
- 新增事件前先 `Grep "summary: '<名>'" src/scenarios/wasteland.ts` 确认不撞名。测试 import 仅取实际用到的（避免 TS6133）。

---

### Task 1: 时间尺度 + 前提重构

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`intro` line 7-8；`turnUnit/maxTurns` line 58-59；`systemPrompt` line 60-68）
- Test: `src/scenarios/wasteland.test.ts`（新建）

**Interfaces:**
- Produces: turnUnit `'月'`、maxTurns `36`、重写的 intro/systemPrompt（前提：救援无望、长期求生+重建据点）。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/wasteland.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { wasteland } from './wasteland'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('wasteland 尺度与前提', () => {
  it('turnUnit=月、maxTurns=36（三年末世）', () => {
    expect(wasteland.turnUnit).toBe('月')
    expect(wasteland.maxTurns).toBe(36)
  })
  it('intro 与 systemPrompt 改为「救援无望·长期重建」框架（去掉「撑过三十天」「等待...军方救援」）', () => {
    expect(wasteland.intro).not.toContain('三十天')
    expect(wasteland.systemPrompt).toContain('每回合代表一个月')
    expect(wasteland.systemPrompt).toContain('据点')
    expect(wasteland.systemPrompt).not.toContain('每回合代表一天')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 重写 intro** — 把 `intro:` 的值替换为：

```ts
  intro:
    '不明病毒爆发的那年，城市在尖叫中陷落。许诺的军方救援始终没有到来，官方安全区一个接一个失守、沦为新的坟场。废墟成了世界的全部，感染者昼伏夜出，幸存者之间既有相濡以沫，也有彼此吞噬。三年，你要在这片崩坏的土地上活下去——并从瓦砾里，亲手重建一处属于活人的据点与秩序。',
```

- [ ] **Step 3b: 改 turnUnit/maxTurns** — 把 `turnUnit: '天',` 改为 `turnUnit: '月',`；把 `maxTurns: 30,` 改为 `maxTurns: 36,`。

- [ ] **Step 3c: 重写 systemPrompt** — 把整个 `systemPrompt` 模板字符串替换为：

```ts
  systemPrompt: `你是一个末世生存文字游戏的主持人（GM）。世界观：不明病毒爆发后的现代废土，军方救援早已成泡影、官方安全区接连失守，感染者昼伏夜出，幸存者之间既有互助也有掠夺。叙事风格：紧张、写实、有压迫感，偶尔留一丝人性微光。
规则：
- 每回合代表一个月，剧情按月推进、可有跨度更大的经营与变故，不要原地打转
- 感染者、其他幸存者、物资短缺、天气与伤病都是威胁来源
- 物资（supplies）持续消耗：每个选项的 effects 都必须包含 supplies 的负数变化（通常 -3 至 -10）；觅食与经营类选项可在扣除消耗后净增加 supplies
- supplies 为 0 时玩家陷入饥饿，本回合所有选项的 effects 必须额外扣减 hp（约 -10）与 sanity（约 -5），剧情中体现饥饿与绝望
- 末世环境持续侵蚀生命（饥渴、严寒、辐射、旧伤），生命会自然流失，须靠进食、医疗、据点等主动恢复，坐以待毙则油尽身死；紧要关头可给出「耗命搏一线」的险选
- 玩家理智（sanity）过低时，剧情中应出现幻觉与误判
- 救援已成泡影，长期求生与经营据点才是出路；随回合推进可铺陈据点的兴建、幸存者的聚散与废土秩序的重建`,
```
（说明：中段求生事件作「某月的遭遇」原样可用，无需逐一改写；安全区类事件视作仍在勉力支撑/终将失守的中途遭遇，不暗示终局获救。）

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 扩为三年末世——turnUnit月/maxTurns36 + 重写intro/systemPrompt前提（救援无望·长期重建）"
```

---

### Task 2: 物资据点 ceilingUnlocks 阶梯

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`supplies` 属性，约 line 39-50）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Produces: `supplies` 带 `ceiling:50` + `ceilingUnlocks:[{flag:'落脚点',max:65},{flag:'据点',max:80},{flag:'堡垒',max:92},{flag:'营地',max:100}]`。

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland 物资据点封顶', () => {
  it('无据点印记时物资封顶 50（= base，≥ initial 不被削）', () => {
    expect(clampEffects(wasteland, { supplies: 50 }, { supplies: 20 }, []).supplies).toBe(50)
  })
  it('落脚点→65 据点→80 堡垒→92 营地→100 逐级解锁', () => {
    expect(clampEffects(wasteland, { supplies: 60 }, { supplies: 20 }, ['落脚点']).supplies).toBe(65)
    expect(clampEffects(wasteland, { supplies: 75 }, { supplies: 20 }, ['落脚点', '据点']).supplies).toBe(80)
    expect(clampEffects(wasteland, { supplies: 90 }, { supplies: 20 }, ['落脚点', '据点', '堡垒']).supplies).toBe(92)
    expect(clampEffects(wasteland, { supplies: 95 }, { supplies: 20 }, ['落脚点', '据点', '堡垒', '营地']).supplies).toBe(100)
  })
  it('生命与理智不设据点封顶', () => {
    expect(clampEffects(wasteland, { hp: 95 }, { hp: 20 }, []).hp).toBe(100)
    expect(clampEffects(wasteland, { sanity: 95 }, { sanity: 20 }, []).sanity).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3: 实现** — 在 `supplies` 属性的 `max: 100,` 行与 `bands: [` 行之间插入（保留 `bands`）：

```ts
      max: 100,
      // 据点印记逐级解锁物资天花板：孤身流浪屯不住（卡 50），唯建据点方能层层囤积、缓冲生命与理智
      ceiling: 50,
      ceilingUnlocks: [
        { flag: '落脚点', max: 65 },
        { flag: '据点', max: 80 },
        { flag: '堡垒', max: 92 },
        { flag: '营地', max: 100 },
      ],
      bands: [
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 物资据点封顶阶梯（落脚点/据点/堡垒/营地逐级解锁）"
```

---

### Task 3: 三开局身份印记 + 三身份事件

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`openings` line 52-56；`localEvents` 末尾追加三事件）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Produces: 开局 flag `店员`/`军医`/`高中生`；三道 `requires:'has(<flag>)'` 身份事件（summary `熟门熟路`/`军医本色`/`少年血气`）。

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 便利店店员: '店员', 退役军医: '军医', 高中生: '高中生' }
    for (const [name, flag] of Object.entries(want)) {
      const op = wasteland.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(wasteland, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = wasteland.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('店员')).toBeGreaterThanOrEqual(1)
    expect(byFlag('军医')).toBeGreaterThanOrEqual(1)
    expect(byFlag('高中生')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 给三开局加 flag** — 把 `openings` 改为（仅加 `flag`，`prompt` 不动）：

```ts
  openings: [
    { name: '便利店店员', prompt: '值夜班时被困的店员，熟悉店内物资与周边街区。', flag: '店员' },
    { name: '退役军医', prompt: '懂急救与武器，但左腿有旧伤，体力消耗更快。', flag: '军医' },
    { name: '高中生', prompt: '体力好、跑得快，但缺乏生存经验，容易冲动。', flag: '高中生' },
  ],
```

- [ ] **Step 3b: 追加三道身份事件** — 先 `Grep "summary: '熟门熟路'|summary: '军医本色'|summary: '少年血气'" src/scenarios/wasteland.ts` 确认无撞名；在 `localEvents: [` 数组**末尾**（最后一个事件 `},` 之后、`],` 之前）插入：

```ts
    {
      narrative:
        '又一次缺粮的当口，你这便利店老店员的脑子忽然转了起来——总店有一处只有值夜班的人才晓得的暗格仓库，当初为了防盗藏得极深，外人翻烂了货架也找不着。三年过去，那批货十有八九还压在夹层里。这是一笔足以让你缓口气的横财，可若声张出去，难保不引来红了眼的同类。是摸黑独吞，还是匀出来分给同伴、聚一聚人心？',
      choices: [
        { text: '摸黑独吞这批隐藏库存', effects: { supplies: 10, sanity: -3 }, reaction: '你借着夜色搬空了只有你记得的暗格，背包鼓了起来——可这秘密压在心头，也让你愈发提防身边的每一双眼睛。' },
        { text: '拿出来分给同伴，聚拢人心', effects: { supplies: 2, sanity: 6 }, reaction: '你把那批别人找不到的库存匀给了同伴，换来一圈感激的眼神——废土上，肯分粮的人，才聚得起一群肯替你拼命的人。' },
      ],
      summary: '熟门熟路',
      requires: 'has(店员)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '一个重伤的幸存者被同伴七手八脚抬到你面前——腹部一道深可见骨的撕裂伤，血已经浸透了半边衣裳，气息奄奄。旁人都束手无策，唯有你这退役军医看得明白：这伤还有救，但要赌上你珍藏的抗生素与缝合器械，还得让你那条旧伤的左腿在手术台前硬撑上几个钟头。救，要掏空本就紧张的药品家底；不救，眼睁睁看一条命在你专长的领域里流逝。',
      choices: [
        { text: '倾尽药品器械，救他一命', effects: { hp: -4, supplies: -8, sanity: 8 }, reaction: '你赌上珍贵的药品和自己的旧伤把人从鬼门关拽了回来——他攥着你的手发誓此生跟定你，这份医者仁心，在废土上重过千金。' },
        { text: '保住药品，只做简单包扎', effects: { supplies: -2, sanity: -4 }, reaction: '你只草草包扎便收起了药箱——药是省下了，可那人渐渐没了气息时望你的那一眼，让你往后许多夜都翻来覆去。' },
      ],
      summary: '军医本色',
      requires: 'has(军医)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '一处高处的断桥彼端，吊着半箱没人够得着的救命物资。围观的老幸存者都摇头说太险，可你这年轻人腿脚利索、又一身使不完的劲，眼睛一下就亮了——凭你的身手，攀过那道朽断的桥梁去够它，未必不能成。心口那股不服输的冲动嗡嗡作响，撺掇着你去露一手、搏一把；可理智又在角落里发虚地提醒你：这世道，逞强的少年，往往死得最快。',
      choices: [
        { text: '逞勇涉险，赌一把身手', effects: { hp: -10, supplies: 8, sanity: -2 }, reaction: '你仗着年轻腿快攀过朽桥险险够到了物资，落地时后怕得腿发软——这次赌赢了，可这股莽劲，早晚要让你吃个大亏。' },
        { text: '按住冲动，稳妥行事', effects: { supplies: -3, sanity: 6 }, reaction: '你死死按住了逞强的念头、稳稳退了开——一个年轻人能在废土上学会「忍」字，是比跑得快、跳得高更要命的本事。' },
      ],
      summary: '少年血气',
      requires: 'has(高中生)',
      minTurn: 3,
      weight: 0.9,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 三开局身份印记 + 三道身份事件门控"
```

---

### Task 4: 四道建据点闸门（全新增）

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`localEvents` 末尾追加四事件）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Consumes: Task 2 的 ceilingUnlocks（印记 落脚点/据点/堡垒/营地）。
- Produces: 四道 keyMoment 建据点闸门，按序串链 `落脚点→has(落脚点)→has(据点)→has(堡垒)`。

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland 建据点闸门', () => {
  it('四道建据点机缘均为 keyMoment、授对应据点印记、按序串链', () => {
    const want = [
      { summary: '觅一处栖身', flag: '落脚点', prev: undefined as string | undefined, pick: '清场加固，据为巢穴' },
      { summary: '加固扩建', flag: '据点', prev: '落脚点', pick: '扩建据点，囤粮储水' },
      { summary: '筑墙设防', flag: '堡垒', prev: '据点', pick: '筑墙设防，严阵以待' },
      { summary: '聚拢幸存者', flag: '营地', prev: '堡垒', pick: '接纳幸存者，立规矩号令一方' },
    ]
    for (const w of want) {
      const ev = (wasteland.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扩建据点当回合物资可破落脚点上限 65', () => {
    let st = initState(wasteland, wasteland.openings![0])
    st = { ...st, attributes: { hp: 70, sanity: 60, supplies: 65 }, flags: ['落脚点'], history: Array(8).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wasteland.localEvents ?? []).find((e) => e.summary === '加固扩建')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('据点'))
    const next = applyChoice(wasteland, st, tr as any, idx, () => 0.5) // 0.5>=0.18 不触发命运无常
    expect(next.flags).toContain('据点')
    expect(next.attributes.supplies).toBeGreaterThan(65) // 该支 supplies+10，破落脚点上限65（据点上限80）
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3: 追加四道闸门事件** — 先 `Grep "summary: '觅一处栖身'|summary: '加固扩建'|summary: '筑墙设防'|summary: '聚拢幸存者'" src/scenarios/wasteland.ts` 确认无撞名；在 `localEvents: [` 数组**末尾**插入：

```ts
    {
      narrative:
        '漂泊了太久，居无定所地在废墟间东躲西藏，让你身心俱疲。这日你撞见一处难得的好地方——一栋只剩单一入口的半塌公寓，地势高、易守难攻，里头还封存着没被翻动过的物资。唯一的麻烦是，楼里盘踞着几个游荡的感染者，且门窗破败、需要大动干戈地封堵加固。是咬牙清场、把这里据为自己的第一处巢穴，还是嫌麻烦、继续做个无根的流浪者？',
      choices: [
        { text: '清场加固，据为巢穴', effects: { hp: -8, supplies: -6, sanity: 6 }, flagsSet: ['落脚点'], reaction: '你清掉了游荡的感染者、堵死了多余的门窗，头一回有了一处能安睡的角落——脚下有了根，飘了太久的心也定了几分。' },
        { text: '不敢久留，继续流浪', effects: { hp: -4, supplies: -4, sanity: -3 }, reaction: '你终究没敢在一处久待，又背起行囊钻进无边的废墟——连个能踏实喘口气的地方都没有，这日子何时是个头。' },
      ],
      summary: '觅一处栖身',
      keyMoment: true,
      minTurn: 2,
      weight: 1.2,
    },
    {
      narrative:
        '在落脚点安顿下来后，你愈发觉得「能守」还不够，得让它「养得起人」。你盘算着把这处巢穴扩建成一个真正的据点：清出一间干燥的库房囤粮储水，在必经的过道上设几道简陋却致命的陷阱，再辟出一小块能种点东西的地方。这是一笔不小的投入，要耗去你眼下大半的体力与物资去经营；可一旦建成，你便不再是手到口的流浪汉，而有了一份能层层囤积、细水长流的家底。',
      choices: [
        { text: '扩建据点，囤粮储水', effects: { supplies: 10, hp: -6 }, flagsSet: ['据点'], reaction: '库房一点点充实起来，过道的陷阱也布置停当，你抚着囤起的粮水长出一口气——从今往后，你总算有了能囤得住的家底，不必再为下一顿发愁。' },
        { text: '维持现状，不折腾扩建', effects: { supplies: -4, sanity: -2 }, reaction: '你嫌扩建太耗精力，只守着这处巢穴将就过活——日子是省心，可家底始终薄薄一层，攒不下、也囤不久。' },
      ],
      summary: '加固扩建',
      requires: 'has(落脚点)',
      keyMoment: true,
      minTurn: 9,
      weight: 1.1,
    },
    {
      narrative:
        '据点的名声渐渐传开，引来的不止是投奔者，还有觊觎你这份家底的掠夺者，以及偶尔成群涌来的感染者。仅靠门闩和陷阱，迟早要被撞破。你意识到，要想真正立住，必须把据点筑成一座堡垒：垒起高墙、清出射界、囤备应对围攻的水火之械。这是脱胎换骨的一步，要押上大量物资与心血，还要冒着筑墙期间防备空虚、被人趁虚而入的风险；可一旦墙成，寻常的尸潮与匪帮便再难撼动你分毫。',
      choices: [
        { text: '筑墙设防，严阵以待', effects: { hp: -8, supplies: -6, sanity: 4 }, flagsSet: ['堡垒'], reaction: '高墙垒起的那天，你站在墙头俯瞰自己一手撑起的天地，心头第一次有了底气——往后再有尸潮或匪帮撞来，这堵墙，扛得住。' },
        { text: '只小修小补，不大兴土木', effects: { supplies: -4, hp: -2 }, reaction: '你只给据点小修小补、加了几道门闩，没敢大动干戈——墙是没筑起来，可往后每逢风吹草动，你都得提心吊胆地睡。' },
      ],
      summary: '筑墙设防',
      requires: 'has(据点)',
      keyMoment: true,
      minTurn: 16,
      weight: 1.1,
    },
    {
      narrative:
        '堡垒立稳之后，慕名前来投奔的幸存者越来越多——拖家带口的、身怀一技的、走投无路的，都聚到你的墙下，眼里是劫后余生的渴望。人多了是力量，也是麻烦：要分配口粮、要排班守夜、要调解纷争、更要立下一套人人遵从的规矩，否则乌合之众转眼就会内讧崩散。是敞开大门、把这堡垒经营成一座号令一方、自有秩序的营地，还是怕担风险、只守着自己这一小撮人闭门过活？',
      choices: [
        { text: '接纳幸存者，立规矩号令一方', effects: { supplies: 8, sanity: 6, hp: -4 }, flagsSet: ['营地'], reaction: '你立下规矩、排定分工，墙内渐渐有了集市、有了哨岗、有了孩子的笑声——一座有秩序的营地在废土上拔地而起，众人提起你的名字，眼里是信服。' },
        { text: '闭门自守，不愿担这摊子', effects: { supplies: -4, sanity: -2 }, reaction: '你婉拒了大多数投奔者、只守着自己这一小撮人——是省了管一大摊子的烦难，可墙外那些失望离去的背影，也带走了你本可号令一方的可能。' },
      ],
      summary: '聚拢幸存者',
      requires: 'has(堡垒)',
      keyMoment: true,
      minTurn: 26,
      weight: 1.1,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 四道建据点闸门（觅栖身→加固扩建→筑墙设防→聚拢幸存者）keyMoment+授据点印记+串链"
```

---

### Task 5: 结局重构（救援框架 → 三年末世归宿）

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`endings` 数组，约 line 69-95，23 个结局）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Produces: 23 个结局的 `epilogue` 去除「军方救援/获救/担架/军旗/救援者/救援点/救援的车灯」等抵达-获救框架，改写为「三年末世后的归宿」；8 个含「获救/撤离」的 `tone` 改名（见下表）。**所有 condition 原样保留**（hp/理智/物资 仍是对的轴）。两个死亡结局（hp<=0 力竭身亡 / sanity<=0 疯癫失智）原样保留。

**这是内容任务**：实现者通读 `endings`（line 69-95），逐个改写。新前提：救援从未到来、安全区失守，36 个月（三年）后玩家的结局＝他在废土上**熬成/建成了什么**。改写规则：①删除一切「军方/军队/救援抵达/救援者/救援点/担架/军旗/获救/撤离」字样，换成「三年了/废土上/你扎下的根/你建成的据点/投奔来的人/活到第三年」等长期重建框架；②每条 epilogue 的「身心状态描写」部分（强健/重建据点/苟延残喘等）保留其神韵；③高物资结局突出「据点/重建文明」，纯 hp/纯 sanity 结局突出个人熬住，低位结局突出残喘。

**Tone 改名表**（仅这 8 个；其余 15 个 tone 名不变、只改 epilogue）：
| 旧 tone | 新 tone |
|---|---|
| 从容获救·重建希望 | 从容立足·重建有望 |
| 安稳撤离的幸存者 | 安稳扎根的幸存者 |
| 获救·却已精神崩坏 | 苟活·却已精神崩坏 |
| 油尽灯枯地获救 | 油尽灯枯·勉力撑住 |
| 饿殍边缘·勉强获救 | 饿殍边缘·勉强熬过 |
| 体魄尚健·安然获救 | 体魄尚健·安然立足 |
| 伤痕累累地获救 | 伤痕累累·熬到今日 |
| 获救 | 熬过末世 |

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland 结局重构为三年末世归宿', () => {
  it('结局总数不变（23），两个死亡结局保留', () => {
    expect(wasteland.endings.length).toBe(23)
    expect(wasteland.endings.find((e) => e.tone === '力竭身亡')?.condition).toBe('hp<=0')
    expect(wasteland.endings.find((e) => e.tone === '疯癫失智·消失在废墟')?.condition).toBe('sanity<=0')
  })
  it('8 个救援 tone 已改名为长期重建框架', () => {
    const renamed = ['从容立足·重建有望', '安稳扎根的幸存者', '苟活·却已精神崩坏', '油尽灯枯·勉力撑住', '饿殍边缘·勉强熬过', '体魄尚健·安然立足', '伤痕累累·熬到今日', '熬过末世']
    for (const t of renamed) expect(wasteland.endings.some((e) => e.tone === t), t).toBe(true)
    const oldTones = ['从容获救·重建希望', '安稳撤离的幸存者', '油尽灯枯地获救', '获救']
    for (const t of oldTones) expect(wasteland.endings.some((e) => e.tone === t), `旧tone ${t} 应已改名`).toBe(false)
  })
  it('所有 epilogue 不再含「军方救援/救援者/救援点/担架/军旗」等抵达-获救字样', () => {
    const banned = ['军方', '军队', '救援者', '救援点', '救援的', '担架', '军旗', '救援车', '撤离']
    for (const e of wasteland.endings)
      for (const b of banned) expect(e.epilogue?.includes(b), `${e.tone} 含「${b}」`).not.toBe(true)
  })
  it('据点/重建类高物资结局仍以 supplies 为门（apex 靠 ceiling 自动门控）', () => {
    const rebuild = wasteland.endings.find((e) => e.tone === '重建据点·重燃文明')
    expect(rebuild?.condition).toContain('supplies>=80')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3: 改写 endings** — 逐个改写 `endings`（line 69-95）。下面给 4 个范例（其余按同规则改写，**condition 一字不改**）：

`末世王者·重塑秩序`（condition 不变）epilogue 改为：
```
'三年了。当最后一批掠夺者也退出你的势力范围，你站在据点最高的墙头俯瞰脚下——堆满给养的库房、安睡的人、井然的秩序，都是你从瓦砾里一寸寸立起来的。废土在你脚下俯首，你不只是活了下来，你重新立起了秩序。风掀动你褴褛却干净的衣角，墙下有人低声唤你的名字，那声音里带着敬意——新的世界，将从你站立的地方开始。'
```
`从容立足·重建有望`（原 从容获救·重建希望，condition 不变）epilogue 改为：
```
'三年的厮杀与饥寒，没在你身上留下太重的痕迹。你带着尚算充裕的给养、清醒的头脑，立在你一手撑起的落脚处，看着废墟之上第一缕炊烟袅袅升起。活下来只是开始，而重建一切的种子，早已握在你手里——这片死地，终究被你熬出了一点活气。'
```
`据点之主·守得云开`（condition 不变）epilogue 改为：
```
'你曾在无数个不眠的夜里死守这方寸之地，把每一罐补给、每一道门闩都看得比命还重。三年熬下来，云开了——投奔的人在你墙下扎了营，孩子的笑声第一次盖过了远处的嘶吼。你拍了拍身旁囤满物资的墙垛，像在与一位并肩到底的老友相视而笑。这据点是你的疆土，而你，是它当之无愧的主人。'
```
`熬过末世`（原 获救，catch-all，condition 不变）epilogue 改为：
```
'第三十六个月的月光照进断墙时，你忽然意识到自己真的撑了下来。感染者的嘶吼还在远处此起彼伏，可你已不再是那个在便利店废墟里惊惶醒来的人。你拖着疲惫的身躯走过这座吞噬了无数生命的城，它没放过别人，却独独漏下了你。前路依旧未知，但至少，你还活着，还能呼吸这劫后的空气——对一个幸存者而言，这就够了。'
```
其余 19 条（含 力竭身亡/疯癫失智 两死亡结局原样不动；王者归来/满载而归/身心俱全/重建据点/安稳扎根/苟延残喘/行尸走肉/形神俱疲/苟活/油尽灯枯/饿殍边缘/心如磐石/钢筋铁骨/坐拥余粮/体魄尚健/神志清明/伤痕累累 等）按上述规则逐条改写 epilogue（去救援框架、保状态神韵），并对照改名表改 tone 名。

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS（含「banned 字样」全清）。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 结局重构——救援框架改为三年末世归宿（8救援tone改名+epilogue去军方救援）"
```

---

### Task 6: 三个隐藏 endTone 哨兵彩蛋

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`endings` 追加 3 项；事件 `末日食人`/`尸潮围城`/`免疫之子` 对应选项改 `outcomes`）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Produces: 三个 `condition:'sanity<=-1'` 结局（`同流合污·食人自保`、`弃众独生·孤鬼游荡`、`以命护苗·废土微光`），由对应事件加权 `outcomes[].endTone` 强制触发。

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland 隐藏 endTone 哨兵', () => {
  const tones = ['同流合污·食人自保', '弃众独生·孤鬼游荡', '以命护苗·废土微光']
  it('三哨兵结局存在且 condition 为 sanity<=-1', () => {
    for (const t of tones) expect(wasteland.endings.find((x) => x.tone === t)?.condition, t).toBe('sanity<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of wasteland.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('食人自保的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(wasteland, wasteland.openings![0])
    st = { ...st, attributes: { hp: 50, sanity: 30, supplies: 20 }, history: Array(6).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (wasteland.localEvents ?? []).find((e) => e.summary === '末日食人')!
    const idx = ev.choices.findIndex((c) => c.text === '装作不知，蹭一顿饱饭再走')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(wasteland, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('同流合污·食人自保')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 追加三个哨兵结局** — 在 `endings: [` 数组里、紧跟 `sanity<=0`（`疯癫失智·消失在废墟`）那个结局对象之后，插入：

```ts
    {
      condition: 'sanity<=-1',
      tone: '同流合污·食人自保',
      epilogue:
        '你咽下了那几口明知是什么的「肉」，也咽下了自己作为人的最后一点东西。从那以后，饥饿不再让你恐惧，因为你已经知道了一条谁都不愿说破的「活路」。你在废土上越走越远，吃得越来越「饱」，可镜子里那张脸，你已渐渐认不出——你没死在感染者口中，却亲手把自己变成了比它们更让人作呕的东西。',
    },
    {
      condition: 'sanity<=-1',
      tone: '弃众独生·孤鬼游荡',
      epilogue:
        '你把信任你的同伴推向了死亡，踩着他们的惨叫独自活了下来。命是保住了，可那一双双临死前不可置信的眼睛，从此夜夜在你梦里睁着。你再不敢与任何人结伴，因为你比谁都清楚自己会怎样背叛——你像一缕孤魂，独自游荡在空荡的废土上，活着，却比那些死去的人更像个鬼。',
    },
    {
      condition: 'sanity<=-1',
      tone: '以命护苗·废土微光',
      epilogue:
        '你押上了自己的一切，护着那个对病毒免疫的孩子，一路躲过军方、匪帮与人贩子的围猎，把他和他血管里那点足以拯救世界的希望，亲手送到了还在运转的研究所。他们说，疫苗有望了。你或许看不到那一天，可你知道——在这片人性几近熄灭的废土上，你用一条命，替所有人守住了一簇不肯灭的微光。',
    },
```

- [ ] **Step 3b: 末日食人「装作不知」改 outcomes（地狱）** — 把 `末日食人` 事件里「装作不知，蹭一顿饱饭再走」整体替换为：

```ts
        {
          text: '装作不知，蹭一顿饱饭再走',
          effects: {},
          outcomes: [
            { weight: 1, effects: { supplies: 6, sanity: -12 }, reaction: '你装作什么都没看见，就着那几扇「肉」吃了顿饱饭。东西是吃下去了，可那滋味连同自己默许的恶，会在胃里翻搅许久。' },
            { weight: 1, effects: {}, endTone: '同流合污·食人自保', reaction: '你不仅咽下了那几口明知是什么的「肉」，还在心底悄悄认下了这条「活路」——从这一口起，你与那群笑容可掬的食人者，再没了分别。' },
          ],
        },
```

- [ ] **Step 3c: 尸潮围城「把同伴推出去断后」改 outcomes（地狱）** — 把 `尸潮围城` 事件里「把同伴推出去断后，独自逃」整体替换为：

```ts
        {
          text: '把同伴推出去断后，独自逃',
          effects: {},
          outcomes: [
            { weight: 1, effects: { hp: -2, sanity: -16, supplies: 4 }, reaction: '你猛地把同伴推向尸潮，趁着他凄厉的惨叫脱身。活下来的你，从此再不敢回头看任何人的眼睛——这条命，沾着同伴的血。' },
            { weight: 1, effects: {}, endTone: '弃众独生·孤鬼游荡', reaction: '你把信任你的同伴一个个推向尸潮，踩着他们的惨叫独自杀出生天——那一刻起，你保住了命，却把自己活成了一缕谁也不敢靠近的孤魂。' },
          ],
        },
```

- [ ] **Step 3d: 免疫之子「誓死护送」改 outcomes（天堂·稀有 4:1）** — 把 `免疫之子` 事件里「誓死护送孩子去研究所」整体替换为：

```ts
        {
          text: '誓死护送孩子去研究所',
          effects: {},
          outcomes: [
            { weight: 4, effects: { sanity: 10, hp: -10, supplies: -6 }, reaction: '你把孩子紧紧护在身后，迎着各路追兵杀出一条血路——以一己之力同满世界的强权为敌，只为护一个孩子，这份孤勇足以载入传说。' },
            { weight: 1, effects: {}, endTone: '以命护苗·废土微光', reaction: '你押上了自己的一切，一路躲过军方、匪帮与人贩子的围猎，把那个对病毒免疫的孩子亲手送进了还在运转的研究所——你用一条命，替所有人守住了希望。' },
          ],
        },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): 三隐藏endTone哨兵——食人自保/弃众独生（地狱）+ 以命护苗（稀有天堂）"
```

---

### Task 7: tierLabel + systemPrompt 晋阶/隐藏结局 + AI 注入

**Files:**
- Modify: `src/scenarios/wasteland.ts`（顶层加 `tierLabel`；`systemPrompt` 末尾补两行）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Consumes: Task 2 的 ceilingUnlocks（【晋阶之序】据此叙述据点序）。
- Produces: `tierLabel:'据点'`；systemPrompt 含据点晋阶/极端抉择隐藏结局指引。

- [ ] **Step 1: 写失败测试** — 在 `wasteland.test.ts` 追加：

```ts
describe('wasteland AI 模式', () => {
  it('tierLabel=据点，晋阶之序用本剧术语「据点」+ 据点印记序', () => {
    const st = initState(wasteland, wasteland.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(wasteland, st).map((m) => m.content).join('\n')
    expect(wasteland.tierLabel).toBe('据点')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('据点')
    expect(all).toContain('落脚点→据点→堡垒→营地')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含据点经营与隐藏结局指引', () => {
    expect(wasteland.systemPrompt).toContain('落脚点')
    expect(wasteland.systemPrompt).toContain('据点')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(wasteland, wasteland.openings![0], undefined, 'ai')
    expect(buildTurnMessages(wasteland, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: FAIL（无 tierLabel）。

- [ ] **Step 3a: 加 tierLabel** — 在 `turnUnit: '月',` 一行之后插入：

```ts
  turnUnit: '月',
  tierLabel: '据点',
  maxTurns: 36,
```

- [ ] **Step 3b: systemPrompt 补两行** — 在 `systemPrompt` 末尾、`- 救援已成泡影...废土秩序的重建` 这一行之后（闭合反引号 `` ` `` 之前）追加两行（最后一行以原本的闭合反引号收尾，勿破坏模板字符串）：

```
- 据点分「落脚点→据点→堡垒→营地」数级，唯有觅地清场、加固扩建、筑墙设防、聚拢幸存者的重大机缘（关键抉择中肯投入经营的那一手）方能晋阶，据点越高越能囤积物资、缓冲生命与理智
- 泯灭人性的僭越（同流合污食人、弃同伴独活）或舍身护住希望的极难抉择，皆可能通向隐藏的结局`
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(wasteland): tierLabel据点 + systemPrompt补据点晋阶/隐藏结局指引"
```

---

### Task 8: 理智 decay 与 sim-balance 校准

**Files:**
- Modify: `src/scenarios/wasteland.ts`（`sanity` 属性，按 sim 结果定 `decayPerTurn`）
- Test: `src/scenarios/wasteland.test.ts`

**Interfaces:**
- Consumes: Task 1–7 全部。
- Produces: 经 sim 校准的 `理智` decay 值与断言它的测试。

- [ ] **Step 1: 先跑 tsc + 基线 sim** — Run: `npx tsc --noEmit`（须干净，捕捉 outcomes/effects 漏写）；再 Run: `npx vite-node scripts/sim-balance.ts wasteland 5000`。记录：死亡率（力竭+疯癫+endTone 致死）；据点登顶档（据点/堡垒/营地 + 高物资结局）在 random/survive/greedy 占比。

- [ ] **Step 2: 判定 decay** — 决策规则（参照 voyage/scifi 经验，36 回合更长、磨蚀更久）：
  - 若「疯癫」类坏结局（sanity<=0 死 + sanity<=20 诸结局）在 random 下显著偏低（理智 trivially 高、几乎不构成压力），给 `sanity` 加 `decayPerTurn: 1`（漫长末世精神磨蚀），重跑验证理智成为须经营的活压力（疯癫死/低理智结局升到健康区间，且 survive 不至大面积疯癫死）。若 1 仍太弱可试 2；若基线已是健康压力则保持 0。
  - 记下最终值 `<DECAY>`（0、1 或 2）。

- [ ] **Step 3: 落地 decay（若 >0）** — 若 `<DECAY>` > 0，在 `sanity` 属性的 `deathBelow: 0,` 之后插入（示例为 1，按结论填实际值）：

```ts
      key: 'sanity',
      name: '理智',
      initial: 70,
      max: 100,
      deathBelow: 0,
      // 漫长末世（36个月）持续磨蚀精神（sim 校准：治「理智 trivially 高」之平淡）
      decayPerTurn: 1,
      bands: [
```
（若结论为 0，跳过本步。）

- [ ] **Step 4: 写断言测试并跑** — 在 `wasteland.test.ts` 追加（把 `<DECAY>` 换成实际值）：

```ts
describe('wasteland 衰减与 sim 健壮性', () => {
  it('理智 decay 经 sim 校准', () => {
    const sanity = wasteland.attributes.find((a) => a.key === 'sanity')!
    expect(sanity.decayPerTurn ?? 0).toBe(<DECAY>) // sim-tuned
  })
  it('生命保持每回合衰减 1（末世侵蚀）', () => {
    expect(wasteland.attributes.find((a) => a.key === 'hp')!.decayPerTurn).toBe(1)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of wasteland.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})
```
Run: `npx vitest run src/scenarios/wasteland.test.ts`，Expected: PASS。

- [ ] **Step 5: 全量回归 + tsc + 提交** — Run: `npx vitest run`（全套绿）；Run: `npx tsc --noEmit`（干净）。然后：

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/wasteland.ts src/scenarios/wasteland.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "fix(wasteland): 平衡sim——理智decay校准 + 双死亡线/effects守护回归"
```

---

## Self-Review（对照 spec）

**Spec coverage:** §1 尺度+前提→T1 ✓；§2 物资 ceilingUnlocks→T2 ✓；§3 四建据点闸门→T4 ✓；§4 apex 靠 ceiling（不改结局条件）→ T2 的 ceiling 即达成、T5 保留 condition ✓；§5 结局重构→T5 ✓；§6 三身份事件→T3 ✓；§7 三隐藏 endTone 哨兵→T6 ✓；tierLabel+systemPrompt→T7 ✓；§8 理智 decay/sim→T8 ✓。

**Placeholder scan:** 仅 T8 `<DECAY>` 为 sim 经验值（已给决策规则）；T5 结局改写给了规则+改名表+4 范例（内容任务固有），其余无占位。

**Type consistency:** 据点印记 `落脚点/据点/堡垒/营地` 在 T2(ceilingUnlocks)/T4(flagsSet/requires) 一致；哨兵基调 `同流合污·食人自保`/`弃众独生·孤鬼游荡`/`以命护苗·废土微光` 在 T6 结局/outcomes.endTone/测试三处一致；改名表 8 个新 tone 在 T5 测试断言；`tierLabel:'据点'` 与 T7 一致；turnUnit '月'/maxTurns 36 在 T1 与各处一致。outcomes 选项均带 `effects:{}`（选项级+每分支级），endTone 分支带 reaction。

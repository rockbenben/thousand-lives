# 谍战「孤岛谍影」机缘体系 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给谍战题材铺机缘体系——情报功勋为脊（intel ceiling 随谍报奇功抬升）、双死亡线 seesaw、三身份事件、隐藏 endTone 彩蛋。

**Architecture:** 在 `src/scenarios/spy.ts` 上做最小机缘叠加：①`intel` 加 `ceilingUnlocks`（功勋印记 立功→建功→奇功→殊勋，只进不退）；②三开局加 `flag` + 三身份事件；③改造四道既有谍报奇功事件为 keyMoment 升功勋闸门（`flagsSet` + `has(prev)` 串链）；④三个 `trust<=-1` 哨兵结局（2 新增背叛支 + 1 改造，加权 outcomes endTone）；⑤`tierLabel:'功勋'` + systemPrompt；⑥`trust` decay 与 sim 校准。新建测试 `src/scenarios/spy.test.ts`。

**Tech Stack:** Vite + React 18 + TypeScript + Zod + Vitest。

## Global Constraints
- 测试：`npx vitest run src/scenarios/spy.test.ts`（仓库根 `D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives`）。**收尾必跑全量 `npx vitest run` + `npx tsc --noEmit`**（spy 铺机缘可能打破引用它作无flag样本的引擎测试——废土教训）。**不要** compound `cd ...;`（用 `git -C`）。
- 提交**不带** AI 署名 trailer（无 `Co-Authored-By: Claude` / `Claude-Session:`）。
- 引擎契约（勿改 `src/engine/`）：`clampEffects` 用「选择后」flags 算 `effectiveCeiling`（当回合授印记即破上限）；base `ceiling` 须 **≥ initial**；`rollOutcome` 在有 `outcomes` 时按 weight 取一、`picked.effects` 覆盖扁平 effects、`picked.endTone` 强制结局（无 rng 时取 outcomes[0]）；条件语法支持 `has(印记)` 与 `&`。
- `intel` initial=15 → base `ceiling` 取 **15**。功勋**只进不退**：不引入任何 `flagsClear`。
- **★outcomes 约定**：带 `outcomes` 的**选项本身**必须写 `effects: {}`；每个 outcome 分支（含纯 endTone 分支）也必须有 `effects: {}`（缺则 tsc TS2741）；endTone 分支补 `reaction`。
- 新增事件/选项前先 `Grep "summary: '<名>'" src/scenarios/spy.ts` 确认不撞名。测试 import 仅取实际用到的（避免 TS6133）。

---

### Task 1: 情报功勋 ceilingUnlocks 阶梯

**Files:** Modify `src/scenarios/spy.ts`（`intel` 属性，约 line 26-37）；Test `src/scenarios/spy.test.ts`（新建）

**Interfaces:** Produces `intel` 带 `ceiling:15` + `ceilingUnlocks:[{flag:'立功',max:50},{flag:'建功',max:75},{flag:'奇功',max:90},{flag:'殊勋',max:100}]`。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/spy.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { spy } from './spy'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('spy 情报功勋封顶', () => {
  it('无功勋印记时情报封顶 15（= base，≥ initial 不被削）', () => {
    expect(clampEffects(spy, { intel: 15 }, { intel: 20 }, []).intel).toBe(15)
  })
  it('立功→50 建功→75 奇功→90 殊勋→100 逐级解锁', () => {
    expect(clampEffects(spy, { intel: 45 }, { intel: 20 }, ['立功']).intel).toBe(50)
    expect(clampEffects(spy, { intel: 70 }, { intel: 20 }, ['立功', '建功']).intel).toBe(75)
    expect(clampEffects(spy, { intel: 85 }, { intel: 20 }, ['立功', '建功', '奇功']).intel).toBe(90)
    expect(clampEffects(spy, { intel: 95 }, { intel: 20 }, ['立功', '建功', '奇功', '殊勋']).intel).toBe(100)
  })
  it('掩护与信任不设功勋封顶', () => {
    expect(clampEffects(spy, { cover: 95 }, { cover: 20 }, []).cover).toBe(100)
    expect(clampEffects(spy, { trust: 95 }, { trust: 20 }, []).trust).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: FAIL。

- [ ] **Step 3: 实现** — 在 `intel` 属性的 `max: 100,` 行与 `bands: [` 行之间插入：

```ts
      max: 100,
      // 功勋印记逐级解锁情报天花板：寸功未立则攒不起功勋（卡 15），唯谍报奇功方能层层晋功
      ceiling: 15,
      ceilingUnlocks: [
        { flag: '立功', max: 50 },
        { flag: '建功', max: 75 },
        { flag: '奇功', max: 90 },
        { flag: '殊勋', max: 100 },
      ],
      bands: [
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/spy.ts src/scenarios/spy.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(spy): 情报功勋封顶阶梯（立功/建功/奇功/殊勋逐级解锁）"
```

---

### Task 2: 三开局身份印记 + 三身份事件

**Files:** Modify `src/scenarios/spy.ts`（`openings` 约 line 52-56；`localEvents` 末尾追加三事件）；Test `src/scenarios/spy.test.ts`

**Interfaces:** Produces 开局 flag `潜伏特工`/`双面间谍`/`觉醒伪职`；三道 `requires:'has(<flag>)'` 身份事件（summary `孤悬一线`/`真心几误`/`伪职薄冰`）。

- [ ] **Step 1: 写失败测试** — 在 `spy.test.ts` 追加：

```ts
describe('spy 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = { 潜伏特工: '潜伏特工', 双面间谍: '双面间谍', 觉醒的伪职: '觉醒伪职' }
    for (const [name, flag] of Object.entries(want)) {
      const op = spy.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(spy, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = spy.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('潜伏特工')).toBeGreaterThanOrEqual(1)
    expect(byFlag('双面间谍')).toBeGreaterThanOrEqual(1)
    expect(byFlag('觉醒伪职')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 给三开局加 flag** — 把 `openings` 改为（仅加 `flag`，`prompt` 不动）：

```ts
  openings: [
    { name: '潜伏特工', prompt: '重庆方面派驻孤岛的潜伏者，明面身份是瑞商瑞昌洋行的中方职员，孤身一人、上不连天下不接地。', flag: '潜伏特工' },
    { name: '双面间谍', prompt: '游走于汪伪特工总部与重庆之间的双重间谍，两边都用你、两边都防你，真心连自己都快分不清。', flag: '双面间谍' },
    { name: '觉醒的伪职', prompt: '本在汪伪政府某部任职的小官，因亲眼目睹同胞惨死而暗中倒戈，手握门路却如履薄冰。', flag: '觉醒伪职' },
  ],
```

- [ ] **Step 3b: 追加三道身份事件** — 先 `Grep "summary: '孤悬一线'|summary: '真心几误'|summary: '伪职薄冰'" src/scenarios/spy.ts` 确认无撞名；在 `localEvents: [` 数组**末尾**（最后一个事件对象 `},` 之后、`],` 之前）插入：

```ts
    {
      narrative: '上线已断了联络多日，可一桩稍纵即逝的机会偏在此刻撞上门来。你这孤悬一线的潜伏特工，上不接天、下不连地，没有人能替你拿主意，也没有人能替你担后果。是凭一己之判当机立断、抓住这转瞬即逝的窗口，还是死守纪律、苦候那迟迟不来的指令？',
      choices: [
        { text: '孤身决断，抓住时机', effects: { intel: 8, cover: -6 }, reaction: '你没等指令便自作主张，险中抢下了这一手；事后上线复联，听罢沉吟——这份敢担的果决，是孤身潜伏者的本钱，也是催命的赌注。' },
        { text: '死守纪律，苦候指令', effects: { cover: 6, trust: 4, intel: -4 }, reaction: '你按捺住蠢动的心思，严守着无令不动的铁律；机会从指缝溜走，可你这份沉得住气的纪律，正是潜伏者活得久的根本。' },
      ],
      summary: '孤悬一线',
      requires: 'has(潜伏特工)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative: '两边都用你，两边都防你——这双面间谍当久了，你常在深夜惊醒，分不清哪个才是真的自己。这一回，敌营交办的差事与组织的利益正面撞上：演得太真，便要实打实地替敌人办成一件损己方的事；露了真心，这层苦心经营的双重身份便要露馅。镜子里那张脸笑得熟练，你却忽然认不出它向着哪一边。',
      choices: [
        { text: '假戏真做，把双重身份演到底', effects: { cover: 10, trust: -8 }, reaction: '你硬着心肠替敌人办成了那件事，双重身份愈发牢不可破；可组织那头的眼神冷了几分，你自己也分不清，这是演戏，还是早已入了戏。' },
        { text: '守住本心，暗中保全己方', effects: { trust: 8, cover: -8 }, reaction: '关键一步你到底偏向了真正的自己，暗中保全了己方；组织信你更深，可敌营那边，某双眼睛已对你这「自己人」起了一丝疑。' },
      ],
      summary: '真心几误',
      requires: 'has(双面间谍)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative: '你这身伪职是把双刃剑：衙门里的门路、文件、关防，都能为递情报大开方便之门；可同僚一双双眼睛也盯着你，谁要逮着你的把柄，转头便是一份请功的密报。这一回，一份要紧的敌方文件正压在你够得着的案头，顺手就能抄录传出——可经办的痕迹，瞒不瞒得过那些同样想往上爬的眼睛？',
      choices: [
        { text: '利用职权，抄录传出情报', effects: { intel: 12, cover: -8 }, reaction: '你借着职务之便把那份文件抄录传了出去，功劳是立下了；只是衙门里有人注意到你今日多翻了几页不该翻的卷宗，目光在你背后多停了一瞬。' },
        { text: '藏拙自保，不留半分痕迹', effects: { cover: 8, intel: -4 }, reaction: '你按住了伸向那份文件的手，半分痕迹也没留；情报是错过了，可你这身伪职的伪装，又稳稳当当地多撑了一程。' },
      ],
      summary: '伪职薄冰',
      requires: 'has(觉醒伪职)',
      minTurn: 3,
      weight: 0.9,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/spy.ts src/scenarios/spy.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(spy): 三开局身份印记 + 三道身份事件门控"
```

---

### Task 3: 四道升功勋闸门（改造既有事件）

**Files:** Modify `src/scenarios/spy.ts`（事件 `舞厅套话`/`策反译电员`/`日侨名册`/`密电草稿`）；Test `src/scenarios/spy.test.ts`

**Interfaces:** Consumes Task 1 印记（立功/建功/奇功/殊勋）。Produces 四道 keyMoment 闸门，按序串链 `立功→has(立功)&cover>=50→has(建功)→has(奇功)`。

- [ ] **Step 1: 写失败测试** — 在 `spy.test.ts` 追加：

```ts
describe('spy 升功勋闸门', () => {
  it('四道升功勋机缘均为 keyMoment、授对应功勋印记、按序串链', () => {
    const want = [
      { summary: '舞厅套话', flag: '立功', need: undefined as string | undefined, pick: '步步引话，套取布防' },
      { summary: '策反译电员', flag: '建功', need: 'has(立功) & cover>=50', pick: '动之以情、济其困厄，徐图策反' },
      { summary: '日侨名册', flag: '奇功', need: 'has(建功)', pick: '通宵比对，挖出潜藏暗桩' },
      { summary: '密电草稿', flag: '殊勋', need: 'has(奇功)', pick: '冒险去敌机要室盗取密码本' },
    ]
    for (const w of want) {
      const ev = (spy.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.need) expect(ev!.requires, w.summary).toBe(w.need)
    }
  })
  it('套取布防当回合情报可破 15 上限', () => {
    let st = initState(spy, spy.openings![0])
    st = { ...st, attributes: { cover: 60, intel: 15, trust: 45 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (spy.localEvents ?? []).find((e) => e.summary === '舞厅套话')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('立功'))
    const next = applyChoice(spy, st, tr as any, idx, () => 0.5)
    expect(next.flags).toContain('立功')
    expect(next.attributes.intel).toBeGreaterThan(15) // 该支 intel+12，破上限 15（立功上限 50）
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 舞厅套话 → 立功闸门** — 给「步步引话，套取布防」加 `flagsSet: ['立功']`，事件加 `keyMoment: true`。尾部改为：

```ts
        { text: '步步引话，套取布防', effects: { intel: 12, cover: -4 }, flagsSet: ['立功'], reaction: '那随员越喝越得意，把番号调动竹筒倒豆子般抖了出来，末了还拍你的手称你「懂行的朋友」，浑不知话已被你记牢。' },
```
并把 `summary: '舞厅套话',` 下方的 `minTurn: 4,` 之前插入 `keyMoment: true,`（即尾部为 `summary:'舞厅套话', keyMoment:true, minTurn:4,`）。另两选项不动。

- [ ] **Step 3b: 策反译电员 → 建功闸门** — 给「动之以情、济其困厄，徐图策反」加 `flagsSet: ['建功']`；把 `requires: 'cover>=50'` 改为 `requires: 'has(立功) & cover>=50'`，加 `keyMoment: true`。尾部改为：

```ts
        { text: '动之以情、济其困厄，徐图策反', effects: { intel: 14, cover: -6, trust: 4 }, flagsSet: ['建功'], reaction: '译电员捧着你塞来的药钱，眼圈一下红了，攥着你的手哽咽道「同乡待我比上头还亲」——这道缝，终于撬开了。' },
        { text: '只资助看病，不急求回报', effects: { cover: 4, intel: 4 }, reaction: '他千恩万谢，却也没起一丝防备，只当你是个心善的同乡；这份不求回报的善，反倒在他心里扎了根。' },
        { text: '怕是陷阱，敬而远之', effects: { cover: 6, intel: -4 }, reaction: '你寻了个由头淡了来往，他茶馆角落那声长叹追在身后；一条本可撬动敌营的缝，就这么放过了。' },
      ],
      summary: '策反译电员',
      requires: 'has(立功) & cover>=50',
      keyMoment: true,
      minTurn: 8,
    },
```

- [ ] **Step 3c: 日侨名册 → 奇功闸门** — 给「通宵比对，挖出潜藏暗桩」加 `flagsSet: ['奇功']`，事件加 `requires: 'has(建功)'` + `keyMoment: true`。尾部改为：

```ts
        { text: '通宵比对，挖出潜藏暗桩', effects: { intel: 12, cover: -6 }, flagsSet: ['奇功'], reaction: '天亮时你揉着血红的眼把名单递上去，上线一行行看过，神色越来越凝重，末了重重一拍桌：「好几条暗桩，全揪出来了！」' },
```
并把事件尾部改为 `summary:'日侨名册', requires:'has(建功)', keyMoment:true, minTurn:9,`（在 `summary: '日侨名册',` 与 `minTurn: 9,` 之间插入 `requires: 'has(建功)',` 与 `keyMoment: true,`）。另两选项不动。

- [ ] **Step 3d: 密电草稿 → 殊勋闸门** — 给「冒险去敌机要室盗取密码本」加 `flagsSet: ['殊勋']`，事件加 `requires: 'has(奇功)'` + `keyMoment: true`（保留既有 `weight: 1.1`）。尾部改为：

```ts
        { text: '冒险去敌机要室盗取密码本', effects: { intel: 12, cover: -14 }, flagsSet: ['殊勋'], reaction: '你摸进机要室的当口，巡夜的脚步声忽然在门外停住，手电的光从门缝里斜插进来——心跳擂得几乎要撞破胸膛。' },
```
并把事件尾部改为：`summary:'密电草稿', requires:'has(奇功)', keyMoment:true, minTurn:10, weight:1.1,`（在 `summary: '密电草稿',` 与 `minTurn: 10,` 之间插入 `requires: 'has(奇功)',` 与 `keyMoment: true,`）。另两选项不动。

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/spy.ts src/scenarios/spy.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(spy): 四道升功勋闸门（舞厅套话/策反译电员/日侨名册/密电草稿）keyMoment+授功勋印记+串链"
```

---

### Task 4: 三个隐藏 endTone 哨兵彩蛋

**Files:** Modify `src/scenarios/spy.ts`（`endings` 追加 3 项；事件 `七十六号传唤`/`同志被捕` **各加一道背叛支**、`策反探长` 改 outcomes）；Test `src/scenarios/spy.test.ts`

**Interfaces:** Produces 三个 `condition:'trust<=-1'` 结局（`卖国求荣·遗臭万年`、`卖友求生·血债难偿`、`策反成功·扭转乾坤`）。

- [ ] **Step 1: 写失败测试** — 在 `spy.test.ts` 追加：

```ts
describe('spy 隐藏 endTone 哨兵', () => {
  const tones = ['卖国求荣·遗臭万年', '卖友求生·血债难偿', '策反成功·扭转乾坤']
  it('三哨兵结局存在且 condition 为 trust<=-1', () => {
    for (const t of tones) expect(spy.endings.find((x) => x.tone === t)?.condition, t).toBe('trust<=-1')
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用', () => {
    const used = new Set<string>()
    for (const ev of spy.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('投靠敌营的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(spy, spy.openings![0])
    st = { ...st, attributes: { cover: 40, intel: 30, trust: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (spy.localEvents ?? []).find((e) => e.summary === '七十六号传唤')!
    const idx = ev.choices.findIndex((c) => c.text === '献情报投靠七十六号')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(spy, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('卖国求荣·遗臭万年')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 追加三个哨兵结局** — 在 `endings: [` 数组里、紧跟 `被疑内奸·暗巷清除`（`condition: 'trust<=0'`）那个结局对象之后，插入：

```ts
    { condition: 'trust<=-1', tone: '卖国求荣·遗臭万年', epilogue: '你终究还是把心向了另一边。投名状一递，荣华富贵随之而来——洋房、汽车、敌营里体面的位子，样样不缺。可每当夜深，你总不敢去看镜子：那张脸下面，藏着一个出卖了同胞、出卖了来路的人。组织把你的名字钉上了必杀的名册，昔日的同志提起你只剩一个冷冷的「呸」字。你活成了人人唾骂的汉奸，纵有泼天的富贵，也填不平那道再回不去的沟——青史之上，你的名字旁只一行「遗臭万年」。' },
    { condition: 'trust<=-1', tone: '卖友求生·血债难偿', epilogue: '为了自己活命，你把接头点和同志的名字，一个个吐给了敌人。你是脱身了，可那几张曾与你出生入死的脸，从此再没在世上出现过。组织查清原委，一纸「叛徒」的判词压了下来；你东躲西藏，却躲不过良心的追债——夜里一闭眼，全是他们临刑前望你的眼睛。这条用同志的血换来的命，活着比死了还沉。血债难偿，你欠下的，这辈子都还不清。' },
    { condition: 'trust<=-1', tone: '策反成功·扭转乾坤', epilogue: '你竟真把那枚敌营的棋子，策成了自己人。不费一枪一弹，敌人心脏里从此多了一双向着光明的眼睛——他递出的情报屡屡先敌一步，几桩险些酿成大祸的阴谋被消弭于无形。这是谍战里最漂亮的一手：最深的刀，藏在敌人最信任的人身上。多年以后没人知道那场扭转乾坤的暗战里有你不动声色的一招，可你知道——你用一颗人心，撬动了整个战局。' },
```

- [ ] **Step 3b: 七十六号传唤 新增「投敌」支（地狱）** — 在 `七十六号传唤` 事件的 `choices` 数组里、最后一个选项「称病拖延，连夜安排退路」之后，追加一个新选项：

```ts
        {
          text: '献情报投靠七十六号',
          effects: {},
          outcomes: [
            { weight: 4, effects: { cover: 12, trust: -24 }, reaction: '你递上投名状、把知道的暗线供了出去，七十六号当即纳你为「自己人」，敌营里步步高升；只是这一步迈出，组织那头已把你当成了必除的死敌。' },
            { weight: 1, effects: {}, endTone: '卖国求荣·遗臭万年', reaction: '你心一横，把组织、把同胞、把来路尽数卖给了敌人，换一身荣华——从这一刻起，你不再是潜伏的志士，而是钉在耻辱柱上的汉奸。' },
          ],
        },
```

- [ ] **Step 3c: 同志被捕 新增「卖友」支（地狱）** — 在 `同志被捕` 事件的 `choices` 数组里、最后一个选项「按兵不动，赌他守得住口」之后，追加：

```ts
        {
          text: '供出接头点与同志，换自己脱身',
          effects: {},
          outcomes: [
            { weight: 4, effects: { cover: 8, trust: -18 }, reaction: '你把接头点和几个名字悄悄递了出去，换得敌人暂且放过自己；可同志接连出事，组织看你的眼神，已凉得能结冰。' },
            { weight: 1, effects: {}, endTone: '卖友求生·血债难偿', reaction: '为保自己这条命，你把出生入死的同志一个个供了出去——他们倒在敌人枪下的那一刻，你也把自己永远钉在了「叛徒」二字上。' },
          ],
        },
```

- [ ] **Step 3d: 策反探长 改 outcomes（天堂·稀有 4:1）** — 把 `策反探长` 事件里「小心结交，验过几回真伪再用」整体替换为：

```ts
        {
          text: '小心结交，验过几回真伪再用',
          effects: {},
          outcomes: [
            { weight: 4, effects: { intel: 10, cover: -6 }, reaction: '那探长几回递来的消息都对得上号，渐渐放下戒心，竟主动透起巡捕房的耳目布置——在敌人眼皮底下，你安上了一双眼。' },
            { weight: 1, effects: {}, endTone: '策反成功·扭转乾坤', reaction: '几番周旋，你竟把这名巡捕房探长彻底策成了自己人——敌人心脏里从此多了一双向着光明的眼睛，这不流血的一手，扭转的何止一局。' },
          ],
        },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/spy.ts src/scenarios/spy.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(spy): 三隐藏endTone哨兵——卖国求荣/卖友求生（地狱）+ 策反成功（稀有天堂）"
```

---

### Task 5: tierLabel + systemPrompt + AI 注入

**Files:** Modify `src/scenarios/spy.ts`（顶层加 `tierLabel`；`systemPrompt` 末尾补）；Test `src/scenarios/spy.test.ts`

**Interfaces:** Consumes Task 1 ceilingUnlocks。Produces `tierLabel:'功勋'`；systemPrompt 含功勋晋阶/双面 seesaw/隐藏结局指引。

- [ ] **Step 1: 写失败测试** — 在 `spy.test.ts` 追加：

```ts
describe('spy AI 模式', () => {
  it('tierLabel=功勋，晋阶之序用本剧术语「功勋」+ 功勋印记序', () => {
    const st = initState(spy, spy.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(spy, st).map((m) => m.content).join('\n')
    expect(spy.tierLabel).toBe('功勋')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('功勋')
    expect(all).toContain('立功→建功→奇功→殊勋')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含功勋晋阶与双面权衡指引', () => {
    expect(spy.systemPrompt).toContain('功勋')
    expect(spy.systemPrompt).toContain('立功')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(spy, spy.openings![0], undefined, 'ai')
    expect(buildTurnMessages(spy, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: FAIL（无 tierLabel）。

- [ ] **Step 3a: 加 tierLabel** — 在 `turnUnit: '月',` 一行之后插入：

```ts
  turnUnit: '月',
  tierLabel: '功勋',
  maxTurns: 24,
```

- [ ] **Step 3b: systemPrompt 补两行** — 在 `systemPrompt` 末尾、`- 文风简洁有张力，避免冗长说教` 这一行之后（闭合反引号 `` ` `` 之前）追加两行（最后一行以原本的闭合反引号收尾，勿破坏模板字符串）：

```
- 功勋分「立功→建功→奇功→殊勋」数级，唯有重大谍报奇功（关键抉择中搏命立功的那一手）方能晋阶；潜伏掩护与组织信任是悬于头顶的双刃，取信敌营常折损组织信任、反之亦然，抉择须在二者间权衡
- 真叛变投敌、出卖同志保命，或不流血策反敌酋的极端抉择，皆可能通向隐藏的结局`
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/spy.ts src/scenarios/spy.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(spy): tierLabel功勋 + systemPrompt补功勋晋阶/双面权衡/隐藏结局指引"
```

---

### Task 6: trust decay 与 sim-balance 校准

**Files:** Modify `src/scenarios/spy.ts`（`trust` 属性，按 sim 结果定 `decayPerTurn`）；Test `src/scenarios/spy.test.ts`

**Interfaces:** Consumes Task 1–5。Produces 经 sim 校准的 `trust` decay 值与断言它的测试。

- [ ] **Step 1: 先跑 tsc + 基线 sim** — Run: `npx tsc --noEmit`（须干净）；再 Run: `npx vite-node scripts/sim-balance.ts spy 5000`。记录：双死亡率（暴露 cover<=0 + 清除 trust<=0 + endTone 致死）；功勋登顶档（奇功/殊勋 + 高 intel 结局）在 random/survive/greedy 占比。

- [ ] **Step 2: 判定 decay** — 决策规则：
  - 若「被疑内奸·暗巷清除」(trust<=0) 在 random 下显著偏低（trust trivially 高、几乎不构成压力），给 `trust` 加 `decayPerTurn: 1`（潜伏日久、猜忌自然累积），重跑验证清除成为活压力（trust<=0 死/低信任结局升到健康区间，且 survive 不至大面积被清除死）。若 1 仍太弱试 2；若基线已是健康压力（cover decay3 已使暴露主导、trust 另有大量损益）则保持 0。
  - 注意双死亡线平衡：cover decay3 已很致命，trust decay 勿过猛致双重过罚。记下最终值 `<DECAY>`（0、1 或 2）。

- [ ] **Step 3: 落地 decay（若 >0）** — 若 `<DECAY>` > 0，在 `trust` 属性的 `deathBelow: 0,` 之后插入（示例为 1，按结论填实际值）：

```ts
      key: 'trust',
      name: '组织信任',
      initial: 45,
      max: 100,
      deathBelow: 0,
      // 潜伏日久、猜忌自然累积，组织信任逐月消蚀（sim 校准：使「被自己人清除」成为活的第二死亡线）
      decayPerTurn: 1,
      bands: [
```
（若结论为 0，跳过本步。）

- [ ] **Step 4: 写断言测试并跑** — 在 `spy.test.ts` 追加（把 `<DECAY>` 换成实际值）：

```ts
describe('spy 衰减与 sim 健壮性', () => {
  it('组织信任 decay 经 sim 校准', () => {
    const trust = spy.attributes.find((a) => a.key === 'trust')!
    expect(trust.decayPerTurn ?? 0).toBe(<DECAY>) // sim-tuned
  })
  it('潜伏掩护保持每月衰减 3（悬顶之危）', () => {
    expect(spy.attributes.find((a) => a.key === 'cover')!.decayPerTurn).toBe(3)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of spy.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})
```
Run: `npx vitest run src/scenarios/spy.test.ts`，Expected: PASS。

- [ ] **Step 5: 全量回归 + tsc + 提交** — Run: `npx vitest run`（全套绿——**若引擎测试因 spy 现已带 flag/turnUnit 而红，按废土教训改其 fixture/断言**）；Run: `npx tsc --noEmit`（干净）。然后：

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add -A
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "fix(spy): 平衡sim——组织信任decay校准 + 双死亡线/effects守护回归"
```

---

## Self-Review（对照 spec）

**Spec coverage:** §1 intel ceilingUnlocks→T1 ✓；§2 四升功勋闸门→T3 ✓；§3 双死亡线/trust decay→T6 ✓；§4 三身份事件→T2 ✓；§5 三隐藏 endTone 哨兵→T4 ✓；§6 apex 靠 ceiling（不改结局）→ T1 ceiling 即达成 ✓；§7 tierLabel+systemPrompt→T5 ✓；§8 sim→T6 ✓。

**Placeholder scan:** 仅 T6 `<DECAY>` 为 sim 经验值（已给决策规则）；其余步骤均含完整代码与确切命令。

**Type consistency:** 功勋印记 `立功/建功/奇功/殊勋` 在 T1(ceilingUnlocks)/T3(flagsSet/requires) 一致；哨兵基调 `卖国求荣·遗臭万年`/`卖友求生·血债难偿`/`策反成功·扭转乾坤` 在 T4 结局/outcomes.endTone/测试三处一致；`tierLabel:'功勋'` 与 T5 一致。outcomes 选项均带 `effects:{}`（选项级+每分支级），endTone 分支带 reaction；新增背叛支为新 choice（七十六号传唤/同志被捕 各 +1，仍 ≤6）。测试 import 仅 `clampEffects/initState/applyChoice/buildTurnMessages`。T6 收尾含「引擎 fixture 可能因 spy 铺机缘而红」的废土教训提醒。

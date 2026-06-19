# 科幻「群星彼端」机缘体系 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已验证的「机缘体系」铺到科幻题材——以**航程阶段**为进阶脊梁（科技 ceiling 随航程抬升）、三开局身份印记、隐藏 endTone 彩蛋，区别于单系统升级。

**Architecture:** 在 `src/scenarios/scifi.ts` 上做最小机缘叠加：①`科技` 加 `ceilingUnlocks`（航程印记 深空→越障→抵近→扎根 逐级解锁上限）；②三开局加 `flag` + 三道新身份事件；③改造四道既有事件为 keyMoment 升程闸门（`flagsSet` 授航程印记、`has(prev)` 串链）；④三个 `colony<=-1` 哨兵结局，靠既有极端抉择的加权 `outcomes[].endTone` 强制触发；⑤`tierLabel:'航程'` + systemPrompt 一句；⑥`文明火种` decay 与 sim 校准。新建测试 `src/scenarios/scifi.test.ts`。

**Tech Stack:** Vite + React 18 + TypeScript + Zod + Vitest。

## Global Constraints
- 测试运行器：`npx vitest run <file>`（项目根 `D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives`，命令用 `npx --prefix "<root>" vitest run ...` 或先 `Set-Location` 再单独跑，**不要** compound `cd ...;`）。
- 提交**不带** AI 署名 trailer（无 `Co-Authored-By: Claude` / `Claude-Session:`）。
- 引擎契约（勿改 `src/engine/`）：`clampEffects` 用「选择后」flags 算 `effectiveCeiling`（line state.ts:88，先应用 flags 再 clamp → 当回合授印记即破上限）；`ceiling` 基线须 **≥ initial**（否则开局值被削）；`rollOutcome` 在有 `outcomes` 时按 weight 取一，`picked.effects` 覆盖扁平 effects、`picked.endTone` 强制结局（无 rng 时取 outcomes[0]）；条件语法支持 `has(印记)` 与 `&`（如 `has(抵近) & colony>=50`）。
- `科技` initial=15，故航程 base `ceiling` 取 **25**（=「捉襟见肘」带上限，≥ initial）。
- 航程**只进不退**：不引入任何 `flagsClear`。
- 改造既有事件前先 `Grep "summary:" src/scenarios/scifi.ts` 确认新身份事件的 summary 不与既有撞名（梨园教训）。

---

### Task 1: 科技航程 ceilingUnlocks 阶梯

**Files:**
- Modify: `src/scenarios/scifi.ts`（`tech` 属性对象，约 line 10-22）
- Test: `src/scenarios/scifi.test.ts`（新建）

**Interfaces:**
- Produces: `tech` 属性带 `ceiling:25` + `ceilingUnlocks:[{flag:'深空',max:45},{flag:'越障',max:70},{flag:'抵近',max:90},{flag:'扎根',max:100}]`。后续任务的升程闸门 `flagsSet` 这些印记来抬升上限。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/scifi.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { scifi } from './scifi'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('scifi 科技航程封顶', () => {
  it('无航程印记时科技封顶 25（= base，≥ initial 不被削）', () => {
    expect(clampEffects(scifi, { tech: 25 }, { tech: 20 }, []).tech).toBe(25)
  })
  it('开局科技 15 不被 base ceiling 削', () => {
    expect(clampEffects(scifi, { tech: 15 }, {}, []).tech).toBe(15)
  })
  it('深空→45 越障→70 抵近→90 扎根→100 逐级解锁', () => {
    expect(clampEffects(scifi, { tech: 40 }, { tech: 30 }, ['深空']).tech).toBe(45)
    expect(clampEffects(scifi, { tech: 60 }, { tech: 30 }, ['深空', '越障']).tech).toBe(70)
    expect(clampEffects(scifi, { tech: 85 }, { tech: 30 }, ['深空', '越障', '抵近']).tech).toBe(90)
    expect(clampEffects(scifi, { tech: 95 }, { tech: 30 }, ['深空', '越障', '抵近', '扎根']).tech).toBe(100)
  })
  it('船体与文明不设航程封顶', () => {
    expect(clampEffects(scifi, { integrity: 95 }, { integrity: 20 }, []).integrity).toBe(100)
    expect(clampEffects(scifi, { colony: 95 }, { colony: 20 }, []).colony).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: FAIL（深空/越障…断言不成立，因 tech 无 ceilingUnlocks 时上限=max 100）。

- [ ] **Step 3: 实现** — 在 `scifi.ts` 的 `tech` 属性里，把 `initial: 15, max: 100,` 之后插入 `ceiling` 与 `ceilingUnlocks`（保留既有 `bands`）：

```ts
    {
      key: 'tech',
      name: '科技',
      initial: 15,
      max: 100,
      // 航程印记逐级解锁科技天花板：深空航行初期资源匮乏，唯有渡过重大航段方能突破更高科技
      ceiling: 25,
      ceilingUnlocks: [
        { flag: '深空', max: 45 },
        { flag: '越障', max: 70 },
        { flag: '抵近', max: 90 },
        { flag: '扎根', max: 100 },
      ],
      bands: [
```
（即在 `max: 100,` 行和 `bands: [` 行之间插入 `ceiling` + `ceilingUnlocks`，`bands` 内容不动。）

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS（4 个 it 全绿）。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(scifi): 科技航程封顶阶梯（深空/越障/抵近/扎根逐级解锁）"
```

---

### Task 2: 三开局身份印记 + 三道身份事件

**Files:**
- Modify: `src/scenarios/scifi.ts`（`openings` 约 line 53-57；`localEvents` 数组追加三事件）
- Test: `src/scenarios/scifi.test.ts`

**Interfaces:**
- Consumes: 无（独立于 Task 1）。
- Produces: 开局 flag `殖民舰长`/`首席科学家`/`代理舰长`；三道 `requires:'has(<flag>)'` 身份事件（summary `一言九鼎`/`生存与伦理`/`根基未稳`）。

- [ ] **Step 1: 写失败测试** — 在 `scifi.test.ts` 追加：

```ts
describe('scifi 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      殖民舰长: '殖民舰长',
      首席科学家: '首席科学家',
      临危受命的代理舰长: '代理舰长',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = scifi.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(scifi, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = scifi.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('殖民舰长')).toBeGreaterThanOrEqual(1)
    expect(byFlag('首席科学家')).toBeGreaterThanOrEqual(1)
    expect(byFlag('代理舰长')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: FAIL（开局无 flag、无身份事件）。

- [ ] **Step 3a: 给三开局加 flag** — 把 `openings` 改为（仅加 `flag` 字段，`prompt` 不动）：

```ts
  openings: [
    { name: '殖民舰长', prompt: '背负数万人命的最高指挥官，一言九鼎，却也千夫所指、孤悬高位。', flag: '殖民舰长' },
    { name: '首席科学家', prompt: '掌握全船尖端科技的核心，却常在生存与伦理之间反复煎熬。', flag: '首席科学家' },
    { name: '临危受命的代理舰长', prompt: '原舰长突然殒命，你被应急条例从深眠中紧急唤醒、接掌全船最高指挥权——一个仓促上位、根基未稳的接班人。', flag: '代理舰长' },
  ],
```

- [ ] **Step 3b: 追加三道身份事件** — 先 `Grep "summary: '一言九鼎'|summary: '生存与伦理'|summary: '根基未稳'" src/scenarios/scifi.ts` 确认无撞名；然后在 `localEvents: [` 数组**末尾**（最后一个事件对象 `},` 之后、`],` 之前）插入：

```ts
    {
      narrative:
        '一桩棘手的纠纷闹到你面前，舱内所有人却不约而同地噤了声——他们什么都不说，只是望着你，把决断连同全部责任，一股脑儿推到你一个人肩上。你忽然意识到，作为这数万人的最高指挥，你的每一句话都一言九鼎，可一旦出了岔子，千夫所指的也只有你一个名字。这便是孤悬高位的代价：所有的光荣与骂名，最终都得你一个人扛。是乾纲独断、当场拍板，还是放下身段、把决定交还众人共担？',
      choices: [
        { text: '乾纲独断，一肩担起', effects: { integrity: 2, colony: -2 }, reaction: '你一锤定音，雷厉风行，办事的人松了口气；可也有人私下嘀咕，舰长的话越来越没人敢驳，这担子终究压得你一个人喘不过气。' },
        { text: '放下身段，交众人共担', effects: { colony: 4, tech: -2 }, reaction: '你把决断交还众人，舱内先是一阵错愕，继而暖意涌动；只是几个老军官皱眉，担心这先例一开，往后号令难行。' },
      ],
      summary: '一言九鼎',
      requires: 'has(殖民舰长)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '实验台上那组数据，只有你这个首席科学家才真正掂得出它的分量——它能立竿见影地缓解全船的窘迫，可推到尽头，那是一条你比谁都清楚不该越过的线。旁人只看见救命的曙光，催着你赶紧用；唯有你独自在生存与良知之间反复煎熬，掂量着那曙光背后看不见的代价。是以技救船、先把人保下来，还是守住科学的底线，哪怕代价是亲手错过这一线生机？',
      choices: [
        { text: '以技救船，先保人命', effects: { tech: 4, colony: 2, integrity: -2 }, reaction: '你按下了那个按钮，窘迫应声缓解，众人感激；可夜深人静时，那条被你亲手越过的线，仍在心头隐隐作痛。' },
        { text: '守住底线，哪怕错过生机', effects: { colony: -2, tech: 2 }, reaction: '你把那组数据封存起来，守住了科学家的良知；理解的人敬你风骨，可望着仍未解的困局，你自己也说不清这份坚持值不值。' },
      ],
      summary: '生存与伦理',
      requires: 'has(首席科学家)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '原舰长的旧部们，从没真正把你这个仓促上位的接班人放在眼里。一道寻常的指令下去，几个资深军官阳奉阴违、当众给你脸色，舱里所有人都在暗暗观望——这个从深眠里被紧急唤醒、根基未稳的代理舰长，到底镇不镇得住场子。你心里清楚，今天这一关过不去，往后的号令就成了一纸空文。是立威整肃、当众拿不服者开刀，还是放低姿态、以诚意一点点收服这些旧人的心？',
      choices: [
        { text: '立威整肃，杀威立信', effects: { integrity: 2, colony: -2 }, reaction: '你当众处置了带头给脸色的军官，舱里瞬间噤声；号令是立住了，可那些旧部低着头，眼里的不服只是被强压下去，并未真正散去。' },
        { text: '放低姿态，以诚收心', effects: { colony: 4, tech: -2 }, reaction: '你没有摆架子，反倒一个个登门把旧部的委屈听了个遍；几个老军官怔了怔，终是叹服地点头：「这接班人，倒还算个明白人。」' },
      ],
      summary: '根基未稳',
      requires: 'has(代理舰长)',
      minTurn: 3,
      weight: 0.9,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(scifi): 三开局身份印记 + 三道身份事件门控"
```

---

### Task 3: 四道升程闸门（改造既有事件）

**Files:**
- Modify: `src/scenarios/scifi.ts`（事件 `水源告急`/`陨石带`/`候选行星`/`第一座城`）
- Test: `src/scenarios/scifi.test.ts`

**Interfaces:**
- Consumes: Task 1 的 ceilingUnlocks（印记 深空/越障/抵近/扎根）。
- Produces: 四道 keyMoment 闸门，按序串链 `has(深空)→has(越障)→has(抵近)→has(扎根)`；授印记选项见下。

- [ ] **Step 1: 写失败测试** — 在 `scifi.test.ts` 追加：

```ts
describe('scifi 升程闸门', () => {
  it('四道升程机缘均为 keyMoment、授对应航程印记、按序串链', () => {
    const want = [
      { summary: '水源告急', flag: '深空', prev: undefined, pick: '研发新型水循环装置' },
      { summary: '陨石带', flag: '越障', prev: '深空', pick: '研发临时护盾再穿越' },
      { summary: '候选行星', flag: '抵近', prev: '越障', pick: '改道详查，或是新家园' },
      { summary: '第一座城', flag: '扎根', prev: '抵近', pick: '开放包容，广纳人心' },
    ]
    for (const w of want) {
      const ev = (scifi.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('扎根闸门保留 colony>=50 数值门控（不被 has 覆盖）', () => {
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '第一座城')!
    expect(ev.requires).toContain('has(抵近)')
    expect(ev.requires).toContain('colony>=50')
  })
  it('助渡深空当回合科技可破 25 上限', () => {
    let st = initState(scifi, scifi.openings![0])
    st = { ...st, attributes: { tech: 25, integrity: 60, colony: 50 }, history: Array(3).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '水源告急')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('深空'))
    const next = applyChoice(scifi, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('深空')
    expect(next.attributes.tech).toBeGreaterThan(25)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 水源告急 → 深空闸门** — 给「研发新型水循环装置」选项加 `flagsSet: ['深空']`，并给事件加 `keyMoment: true`。把该事件块替换为：

```ts
        { text: '研发新型水循环装置', effects: { tech: 6, colony: 2, integrity: -2 }, flagsSet: ['深空'], reaction: '工程组精神一振，连夜画起了图纸；补给官看着那条下滑曲线，第一次露出了一丝指望得上的神色。' },
      ],
      summary: '水源告急',
      keyMoment: true,
      minTurn: 3,
    },
```
（即：在该 choice 末尾 `reaction` 前插入 `flagsSet: ['深空'],`；在 `summary: '水源告急',` 与 `minTurn: 3,` 之间插入 `keyMoment: true,`。另一选项「严格配给…」不动。）

- [ ] **Step 3b: 陨石带 → 越障闸门** — 给「研发临时护盾再穿越」选项加 `flagsSet: ['越障']`，事件加 `requires: 'has(深空)'` 与 `keyMoment: true`：

```ts
        { text: '研发临时护盾再穿越', effects: { tech: 6, integrity: -4 }, flagsSet: ['越障'], reaction: '首席科学家眼睛一亮，连声道「这思路有戏」；工程组当即围拢过来，连一向沉默的老工程师都难得露出跃跃欲试的神情。' },
      ],
      summary: '陨石带',
      requires: 'has(深空)',
      keyMoment: true,
      weight: 1.2,
    },
```
（陨石带原有 `weight: 1.2`，新增 `requires` 与 `keyMoment`；另两选项不动。）

- [ ] **Step 3c: 候选行星 → 抵近闸门** — 该事件已 `keyMoment: true`；给「改道详查，或是新家园」加 `flagsSet: ['抵近']`，并加 `requires: 'has(越障)'`：

```ts
        { text: '改道详查，或是新家园', effects: { tech: 6, colony: 6, integrity: -4 }, flagsSet: ['抵近'], reaction: '舰桥里压抑的兴奋几乎要冲破天花板，有人喃喃「也许这就是终点了」；可首席科学家盯着那丝生物活性信号，眉头始终没松开。' },
```
并在该事件的 `summary: '候选行星',` 下方（与 `keyMoment: true,` 同级）加入 `requires: 'has(越障)',`，最终该事件尾部为：

```ts
      summary: '候选行星',
      requires: 'has(越障)',
      keyMoment: true,
      minTurn: 18,
      weight: 1.1,
    },
```

- [ ] **Step 3d: 第一座城 → 扎根闸门** — 给「开放包容，广纳人心」加 `flagsSet: ['扎根']`；把 `requires: 'colony>=50'` 改为 `requires: 'has(抵近) & colony>=50'`，并加 `keyMoment: true`：

```ts
        { text: '开放包容，广纳人心', effects: { colony: 10, integrity: -4 }, flagsSet: ['扎根'], reaction: '蓝图一公布，移民们欢呼雀跃，奔走相告这将是一座没有高墙的家园；唯有几位主张设防的工程师摇头，忧心未知的星球。' },
```
事件尾部改为：

```ts
      summary: '第一座城',
      requires: 'has(抵近) & colony>=50',
      keyMoment: true,
      minTurn: 27,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(scifi): 四道升程闸门（水源/陨石带/候选行星/第一座城）keyMoment+授航程印记+串链"
```

---

### Task 4: 三个隐藏 endTone 哨兵彩蛋

**Files:**
- Modify: `src/scenarios/scifi.ts`（`endings` 数组追加 3 项；事件 `加密屏前的减员名单`/`原住文明`/`外星问候` 的对应选项改为 `outcomes`）
- Test: `src/scenarios/scifi.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: 三个 `condition:'colony<=-1'` 结局（`清洗续命·血债驶向虚空`、`屠灭原民·新世罪基`、`星海共生·文明永续`），由对应事件加权 `outcomes[].endTone` 强制触发。

- [ ] **Step 1: 写失败测试** — 在 `scifi.test.ts` 追加：

```ts
describe('scifi 隐藏 endTone 哨兵', () => {
  const tones = ['清洗续命·血债驶向虚空', '屠灭原民·新世罪基', '星海共生·文明永续']
  it('三哨兵结局存在且 condition 为 colony<=-1', () => {
    for (const t of tones) {
      const e = scifi.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('colony<=-1')
    }
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of scifi.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('默许清洗的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(scifi, scifi.openings![0])
    st = { ...st, attributes: { tech: 50, integrity: 60, colony: 40 }, history: Array(18).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (scifi.localEvents ?? []).find((e) => e.summary === '加密屏前的减员名单')!
    const idx = ev.choices.findIndex((c) => c.text === '默许 AI 的冷酷算计')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    // rng=0.999 → rollOutcome 取末位（endTone 分支）
    const next = applyChoice(scifi, st, tr as any, idx, () => 0.999)
    expect(next.ended?.tone).toBe('清洗续命·血债驶向虚空')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 追加三个哨兵结局** — 在 `endings: [` 数组里、紧跟 `火种熄灭·文明断绝`（`condition: 'colony<=0'`）那个结局对象之后，插入：

```ts
    {
      condition: 'colony<=-1',
      tone: '清洗续命·血债驶向虚空',
      epilogue:
        '你授权了那份名单。三成沉睡者再没醒来，被悄无声息地折算进剩下人的氧、水与口粮。飞船是撑到了终点，可它运送的早已不是一个文明，而是一笔永远算不清的血账——活下来的人夜夜被名单上的名字惊醒，史册在这一页上，只留下一片不敢直视的猩红。',
    },
    {
      condition: 'colony<=-1',
      tone: '屠灭原民·新世罪基',
      epilogue:
        '新世界的第一捧土，是用原住者的血浇灌的。你们夺走了他们的家园、碾碎了一个本该被尊重的文明，把屠戮亲手刻进了立国的地基。穹顶之下纵有万家灯火，根却烂在那片被血浸透的土里——人类逃过了星海的黑暗，却把最深的黑暗，一并带到了群星彼端。',
    },
    {
      condition: 'colony<=-1',
      tone: '星海共生·文明永续',
      epilogue:
        '门后站着的，果然是友邻。当两个文明的信号第一次温柔地交握，疾病、隔阂、对死亡的恐惧，都被一种更辽阔的理解轻轻抚平。人类不再是黑暗里孤独潜行的猎手，而成了星海共同体中崭新的一员——地球的火种，终于在群星彼端，汇入了一片更浩瀚、更温暖的光。',
    },
```

- [ ] **Step 3b: 减员名单「默许」改 outcomes（地狱）** — 把 `加密屏前的减员名单` 事件里「默许 AI 的冷酷算计」那一项整体替换为（扁平 effects 改为加权 outcomes：50% 原效果存活、50% 强制地狱结局）：

```ts
        {
          text: '默许 AI 的冷酷算计',
          outcomes: [
            { weight: 1, effects: { colony: -14, integrity: 6, tech: 2 }, reaction: '名单执行的那几日，全船笼罩在死一般的恐怖里，活下来的人不敢看彼此的眼睛；史册会怎样记下这一笔，你不敢去想。' },
            { weight: 1, endTone: '清洗续命·血债驶向虚空' },
          ],
        },
```

- [ ] **Step 3c: 原住文明「掠夺」改 outcomes（地狱）** — 把 `原住文明` 事件里「掠夺其资源，先下手为强」整体替换为：

```ts
        {
          text: '掠夺其资源，先下手为强',
          outcomes: [
            { weight: 1, effects: { tech: 4, colony: -10 }, reaction: '突袭得手了，可原住生命惊恐又仇恨的眼神，深深烙进了在场每个人的记忆；连先遣队里都有人别过脸去，不忍再看。' },
            { weight: 1, endTone: '屠灭原民·新世罪基' },
          ],
        },
```

- [ ] **Step 3d: 外星问候「谨慎回应」改 outcomes（天堂·稀有）** — 把 `外星问候` 事件里「谨慎回应，尝试交流」整体替换为（4:1 → 20% 触发超越性天堂结局）：

```ts
        {
          text: '谨慎回应，尝试交流',
          outcomes: [
            { weight: 4, effects: { tech: 10, integrity: -2, colony: -4 }, reaction: '通讯舱里所有人都屏住了呼吸，盯着信号一来一往；首席科学家手心全是汗，喃喃「但愿门后站着的，是友邻」。' },
            { weight: 1, endTone: '星海共生·文明永续' },
          ],
        },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(scifi): 三隐藏endTone哨兵——清洗续命/屠灭原民（地狱）+ 星海共生（稀有天堂）"
```

---

### Task 5: tierLabel + systemPrompt + AI 注入

**Files:**
- Modify: `src/scenarios/scifi.ts`（顶层加 `tierLabel`；`systemPrompt` 末尾补一句）
- Test: `src/scenarios/scifi.test.ts`

**Interfaces:**
- Consumes: Task 1 的 ceilingUnlocks（【晋阶之序】据此叙述航程序）。
- Produces: `tierLabel:'航程'`；systemPrompt 含航程晋阶/极端抉择隐藏结局提示。

- [ ] **Step 1: 写失败测试** — 在 `scifi.test.ts` 追加：

```ts
describe('scifi AI 模式', () => {
  it('tierLabel=航程，晋阶之序用本剧术语「航程」+ 航程印记序', () => {
    const st = initState(scifi, scifi.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(scifi, st).map((m) => m.content).join('\n')
    expect(scifi.tierLabel).toBe('航程')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('航程')
    expect(all).toContain('深空→越障→抵近→扎根')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含航程晋阶指引', () => {
    expect(scifi.systemPrompt).toContain('航程')
    expect(scifi.systemPrompt).toContain('深空')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(scifi, scifi.openings![0], undefined, 'ai')
    expect(buildTurnMessages(scifi, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: FAIL（无 tierLabel）。

- [ ] **Step 3a: 加 tierLabel** — 在 `scifi.ts` 顶层 `turnUnit: '年',` 一行之后插入：

```ts
  turnUnit: '年',
  tierLabel: '航程',
  maxTurns: 30,
```
（即在 `turnUnit` 与 `maxTurns` 之间插入 `tierLabel: '航程',`。）

- [ ] **Step 3b: systemPrompt 补一句** — 在 `systemPrompt` 末尾、`- 文风简洁有科幻感，避免冗长说教` 这一行之后（闭合反引号 `` ` `` 之前）追加两行：

```
- 航程分「深空→越障→抵近→扎根」数程，唯有渡过重大航段的关键抉择（突破性的那一手）方能推进，科技的天花板亦随航程步步抬升——未历其程，则更高的科技无从谈起
- 极端泯灭人性的僭越（默许大规模清洗、屠灭原住文明等）或可耻地改写结局；而极难得的善意与远见（如与星海文明的善意接触修成共生）亦可能通向超越性的隐藏结局`
```
（注意最后一行以原本的闭合反引号收尾；不要破坏模板字符串。）

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(scifi): tierLabel航程 + systemPrompt补航程晋阶/隐藏结局指引"
```

---

### Task 6: 文明火种 decay 与 sim-balance 校准

**Files:**
- Modify: `src/scenarios/scifi.ts`（`colony` 属性，按 sim 结果定 `decayPerTurn`）
- Test: `src/scenarios/scifi.test.ts`

**Interfaces:**
- Consumes: Task 1–5 全部。
- Produces: 经 sim 校准的 `文明火种` decay 值与一条断言它的测试。

- [ ] **Step 1: 跑基线 sim** — Run: `npx vite-node scripts/sim-balance.ts scifi 5000`。记录：①死亡率（飞船解体 + 文明断绝 + endTone 致死 合计）；②登顶档（抵近/扎根 + 高 tech 结局）在 random/survive/greedy 的占比。

- [ ] **Step 2: 判定 decay** — 决策规则：
  - 若「文明断绝」类坏结局在 random 下 **< 3%**（文明几乎不可能崩），给 `colony` 加 `decayPerTurn: 1` 治平淡（人心在漫长航程中本就自然消磨）；加完重跑 sim 验证文明断绝升到健康区间（个位数百分比，不至于 survive 也大面积死）。若仍 < 3% 再试 `2`，若 ≥ ~3% 且分布健康则保持当前值。
  - 若基线已 **≥ 3%** 且非过高（survive 策略下文明断绝 < ~15%），则 `colony` 不加 decay（保持 0）。
  - 记下最终值 `<DECAY>`（0、1 或 2）。

- [ ] **Step 3: 落地 decay（若 >0）** — 若 `<DECAY>` > 0，在 `colony` 属性的 `deathBelow: 0,` 之后插入（示例为 1，按 Step 2 结论填实际值）：

```ts
      key: 'colony',
      name: '文明火种',
      initial: 50,
      max: 100,
      deathBelow: 0,
      // 漫长航程中人心自然消磨（sim 校准：治「文明几乎不可能崩」之平淡）
      decayPerTurn: 1,
      bands: [
```
（若 Step 2 结论为 0，则跳过本步、不加 `decayPerTurn`。）

- [ ] **Step 4: 写断言测试并跑** — 在 `scifi.test.ts` 的 `describe('scifi 科技航程封顶'...)` 块或新 `describe` 里追加（把 `<DECAY>` 换成实际值；0 时断言 `undefined`）：

```ts
it('文明火种 decay 经 sim 校准（治文明断绝过低）', () => {
  const colony = scifi.attributes.find((a) => a.key === 'colony')!
  expect(colony.decayPerTurn ?? 0).toBe(<DECAY>) // sim-tuned
})
it('船体保持每年衰减 3（悬顶之危）', () => {
  expect(scifi.attributes.find((a) => a.key === 'integrity')!.decayPerTurn).toBe(3)
})
```
Run: `npx vitest run src/scenarios/scifi.test.ts`，Expected: PASS。

- [ ] **Step 5: 全量回归 + 提交** — Run: `npx vitest run`（全套绿）。然后：

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/scifi.ts src/scenarios/scifi.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "fix(scifi): 平衡sim——文明火种decay校准 + 双死亡线回归"
```

---

## Self-Review（对照 spec）

**Spec coverage:**
- §1 航程 ceilingUnlocks → Task 1 ✓
- §2 四升程闸门（改造既有、串链、单支授印记）→ Task 3 ✓（sim 杠杆「必要时两支授印记」在 Task 6 sim 阶段按登顶率决定，已在 spec §2 记为杠杆）
- §3 三开局 flag + 三身份事件 → Task 2 ✓
- §4 双死亡线 / 文明 decay → Task 6 ✓
- §5 三隐藏 endTone 哨兵 → Task 4 ✓
- §6 apex 靠 ceiling 自动门控（不改结局）→ 无需任务，Task 1 的 ceiling 即达成；Task 4 不动既有 apex 结局 ✓
- §7 tierLabel + systemPrompt + AI 注入 → Task 5 ✓
- §8 sim-balance → Task 6 ✓

**Placeholder scan:** Task 6 的 `<DECAY>`/`<DECAY>` 是 sim 经验值占位，已给明确决策规则与默认起点（这是 sim-balance 任务的固有性质，非含糊）；其余步骤均含完整代码与确切命令。

**Type consistency:** 印记名 `深空/越障/抵近/扎根` 在 Task 1（ceilingUnlocks）与 Task 3（flagsSet/requires）一致；哨兵基调串 `清洗续命·血债驶向虚空`/`屠灭原民·新世罪基`/`星海共生·文明永续` 在 Task 4 结局与 outcomes.endTone、测试三处一致；`tierLabel:'航程'` 与 Task 5 测试一致。

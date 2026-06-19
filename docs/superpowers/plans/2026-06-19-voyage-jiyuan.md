# 航海「怒海争锋」机缘体系 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已验证的「机缘体系」铺到航海题材——船级前进式（船力 ceiling 随海上势力抬升）+ 财富为魂（升级要花钱）、三开局身份印记、隐藏 endTone 彩蛋。

**Architecture:** 在 `src/scenarios/voyage.ts` 上做最小机缘叠加：①`船力` 加 `ceilingUnlocks`（势力印记 私掠→船队→海枭→霸主 逐级解锁上限，只进不退）；②三开局加 `flag` + 三道新身份事件；③改造四道既有事件为 keyMoment 升势力闸门（`flagsSet` 授势力印记、`has(prev) & wealth>=N` 串链+财富门槛）；④三个 `crew<=-1` 哨兵结局，靠既有抉择的加权 `outcomes[].endTone` 强制；⑤`tierLabel:'势力'` + systemPrompt；⑥`人心` decay 与 sim 校准。新建测试 `src/scenarios/voyage.test.ts`。

**Tech Stack:** Vite + React 18 + TypeScript + Zod + Vitest。

## Global Constraints
- 测试：`npx vitest run src/scenarios/voyage.test.ts`（已在仓库根 `D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives`）。**收尾必跑 `npx tsc --noEmit`**（vitest 不查类型）。**不要** compound `cd ...;`（用 `git -C` 或先单独 `Set-Location`）。
- 提交**不带** AI 署名 trailer（无 `Co-Authored-By: Claude` / `Claude-Session:`）。
- 引擎契约（勿改 `src/engine/`）：`clampEffects` 用「选择后」flags 算 `effectiveCeiling`（先应用 flags 再 clamp → 当回合授印记即破上限）；base `ceiling` 须 **≥ initial**；`rollOutcome` 在有 `outcomes` 时按 weight 取一、`picked.effects` 覆盖扁平 effects、`picked.endTone` 强制结局（无 rng 时取 outcomes[0]）；条件语法支持 `has(印记)` 与 `&`。
- `船力` initial=35 → base `ceiling` 取 **35**（=initial）。势力**只进不退**：不引入任何 `flagsClear`。
- **★outcomes 约定（科幻期踩坑，务必遵守）**：带 `outcomes` 的**选项本身**必须写 `effects: {}`（`local.ts magOf` 直接读 `c.effects`，缺则 sim 崩）；**每个 outcome 分支**（含纯 endTone 分支）也必须有 `effects: {}`（Outcome 类型 effects 必填，缺则 tsc 报 TS2741）；endTone 分支补 `reaction`。
- 改造/新增事件前先 `Grep "summary: '<名>'" src/scenarios/voyage.ts` 确认不撞名。

---

### Task 1: 船力势力 ceilingUnlocks 阶梯

**Files:**
- Modify: `src/scenarios/voyage.ts`（`ship` 属性，约 line 10-26）
- Test: `src/scenarios/voyage.test.ts`（新建）

**Interfaces:**
- Produces: `ship` 带 `ceiling:35` + `ceilingUnlocks:[{flag:'私掠',max:50},{flag:'船队',max:70},{flag:'海枭',max:88},{flag:'霸主',max:100}]`。后续升势力闸门 `flagsSet` 这些印记。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/voyage.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { voyage } from './voyage'
import { clampEffects, initState, applyChoice } from '../engine/state'
import { buildTurnMessages } from '../engine/prompt'

describe('voyage 船力势力封顶', () => {
  it('无势力印记时船力封顶 35（= base，≥ initial 不被削）', () => {
    expect(clampEffects(voyage, { ship: 35 }, { ship: 20 }, []).ship).toBe(35)
  })
  it('私掠→50 船队→70 海枭→88 霸主→100 逐级解锁', () => {
    expect(clampEffects(voyage, { ship: 45 }, { ship: 20 }, ['私掠']).ship).toBe(50)
    expect(clampEffects(voyage, { ship: 65 }, { ship: 20 }, ['私掠', '船队']).ship).toBe(70)
    expect(clampEffects(voyage, { ship: 85 }, { ship: 20 }, ['私掠', '船队', '海枭']).ship).toBe(88)
    expect(clampEffects(voyage, { ship: 95 }, { ship: 20 }, ['私掠', '船队', '海枭', '霸主']).ship).toBe(100)
  })
  it('财富与人心不设势力封顶', () => {
    expect(clampEffects(voyage, { wealth: 95 }, { wealth: 20 }, []).wealth).toBe(100)
    expect(clampEffects(voyage, { crew: 95 }, { crew: 20 }, []).crew).toBe(100)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: FAIL（船力无 ceilingUnlocks 时上限=100）。

- [ ] **Step 3: 实现** — 在 `ship` 属性的 `decayPerTurn: 1,` 行与 `bands: [` 行之间插入：

```ts
      decayPerTurn: 1,
      // 势力印记逐级解锁船力天花板：无名小卒的旧船难壮大，唯立威、结队、破局、称霸方能层层升级
      ceiling: 35,
      ceilingUnlocks: [
        { flag: '私掠', max: 50 },
        { flag: '船队', max: 70 },
        { flag: '海枭', max: 88 },
        { flag: '霸主', max: 100 },
      ],
      bands: [
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS（3 it 全绿）。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(voyage): 船力势力封顶阶梯（私掠/船队/海枭/霸主逐级解锁）"
```

---

### Task 2: 三开局身份印记 + 三道身份事件

**Files:**
- Modify: `src/scenarios/voyage.ts`（`openings` 约 line 53-57；`localEvents` 末尾追加三事件）
- Test: `src/scenarios/voyage.test.ts`

**Interfaces:**
- Produces: 开局 flag `商人之子`/`哗变水手`/`贵族航海家`；三道 `requires:'has(<flag>)'` 身份事件（summary `行情先机`/`通缉旧账`/`旧圈认人`）。

- [ ] **Step 1: 写失败测试** — 在 `voyage.test.ts` 追加：

```ts
describe('voyage 身份印记', () => {
  it('三开局各注入身份印记', () => {
    const want: Record<string, string> = {
      破产商人之子: '商人之子',
      哗变水手: '哗变水手',
      落魄贵族航海家: '贵族航海家',
    }
    for (const [name, flag] of Object.entries(want)) {
      const op = voyage.openings!.find((o) => o.name === name)
      expect(op?.flag).toBe(flag)
      expect(initState(voyage, op).flags).toContain(flag)
    }
  })
  it('三道身份专属事件带 has() 门控', () => {
    const evs = voyage.localEvents ?? []
    const byFlag = (f: string) => evs.filter((e) => (e.requires ?? '').includes(`has(${f})`)).length
    expect(byFlag('商人之子')).toBeGreaterThanOrEqual(1)
    expect(byFlag('哗变水手')).toBeGreaterThanOrEqual(1)
    expect(byFlag('贵族航海家')).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 给三开局加 flag** — 把 `openings` 改为（仅加 `flag`，`prompt` 不动）：

```ts
  openings: [
    { name: '破产商人之子', prompt: '海贸世家的没落子弟，家财在一场海难中尽数沉没，只余一艘抵债剩下的旧船与满脑子的航路与行情。', flag: '商人之子' },
    { name: '哗变水手', prompt: '受尽欺压后率众夺船的舵手，一身水上本领与一帮过命的弟兄，却背着官府通缉的恶名，无港可靠。', flag: '哗变水手' },
    { name: '落魄贵族航海家', prompt: '失了封地的破落贵族，怀着祖传的残缺海图与对未知大陆的痴迷，变卖徽章只为换一张远航的船票。', flag: '贵族航海家' },
  ],
```

- [ ] **Step 3b: 追加三道身份事件** — 先 `Grep "summary: '行情先机'|summary: '通缉旧账'|summary: '旧圈认人'" src/scenarios/voyage.ts` 确认无撞名；在 `localEvents: [` 数组**末尾**（最后一个事件对象 `},` 之后、`],` 之前）插入：

```ts
    {
      narrative:
        '一处港口的行市忽然透着古怪：你这破产商人之子的眼力一眼便看穿了门道——某种南洋香料因一则尚未传开的海难消息眼看要暴涨，可眼下港中无人察觉，仍按旧价大量抛售。这是只有深谙海贸行情的人才抓得住的先机。是趁这信息差囤货居奇、狠赚一笔，还是把实情透给相熟的商户、博一个童叟无欺的招牌？',
      choices: [
        { text: '囤货居奇，狠赚信息差', effects: { wealth: 8, crew: -2 }, reaction: '你压价吃进、待价而沽，香料一涨便赚得盆满钵满；只是被你瞒着的几家商户事后回过味来，往后与你打交道都多留了个心眼。' },
        { text: '透露实情，博个信誉招牌', effects: { wealth: 2, crew: 4 }, reaction: '你把实情透给相熟的商户，少赚了眼前这笔，却落下个童叟无欺的名声；往后港中商家认你这块招牌，货源门路反倒越走越宽。' },
      ],
      summary: '行情先机',
      requires: 'has(商人之子)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '当年率众夺船的旧账，到底还是追了上来。一名赏金猎人嗅着官府的通缉令找到港口，扬言要拿你这哗变水手的人头去领赏；更棘手的是，他手里还攥着几个当年随你一同夺船的老弟兄当筹码。你背着通缉的恶名本就无港可靠，如今是丢下那几个累赘弟兄、自己金蝉脱壳，还是认下这份过命的交情、把人捞出来？',
      choices: [
        { text: '丢卒保车，自己脱身要紧', effects: { wealth: 2, crew: -5 }, reaction: '你连夜拔锚撇下了那几个弟兄、自己脱了身；消息传回船上，老水手们嘴上不说，看你的眼神却凉了——原来当年一同夺船的情分，也是能丢的。' },
        { text: '认下交情，把弟兄捞出来', effects: { crew: 6, wealth: -4 }, reaction: '你散尽盘缠、险中设局把那几个老弟兄从赏金猎人手里换了回来；被救的汉子红着眼眶捶你胸口，满船弟兄都说跟着这样不弃兄弟的船长，这条命交得值。' },
      ],
      summary: '通缉旧账',
      requires: 'has(哗变水手)',
      minTurn: 4,
      weight: 0.9,
    },
    {
      narrative:
        '一座殖民港的宴席上，一位昔日的贵族同侪竟一眼认出了落魄至此的你。他端着酒杯似笑非笑，话里话外都是怜悯与试探：只要你肯低头、舍了这刀头舔血的海上营生，凭旧日的门第情面，未必不能替你在贵族圈里谋个体面位置，重回那个你失了封地的世界。祖传的残图与对未知大陆的痴迷在胸中翻涌，你握着酒杯，一时竟分不清自己究竟想要什么。',
      choices: [
        { text: '放下身段，攀回旧日贵族圈', effects: { wealth: 6, crew: -3 }, reaction: '你陪着笑脸应酬旧日同侪，换来了些门第的关照与实惠；可席散人静时，对着舷窗外的远洋，你忽然觉得自己活成了当年最瞧不起的那种人。' },
        { text: '决绝向海，不慕旧日门第', effects: { crew: 4, ship: 2 }, reaction: '你放下酒杯、当众谢绝了那份施舍般的好意，转身回了自己的船；弟兄们听说船长连贵族的橄榄枝都不稀罕，反倒挺直了腰板，说咱们船长图的是星辰大海。' },
      ],
      summary: '旧圈认人',
      requires: 'has(贵族航海家)',
      minTurn: 3,
      weight: 0.9,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(voyage): 三开局身份印记 + 三道身份事件门控"
```

---

### Task 3: 四道升势力闸门（改造既有事件 + 财富门槛）

**Files:**
- Modify: `src/scenarios/voyage.ts`（事件 `海上肥羊`/`海盗结盟`/`老提督甲板献策`/`决战在即`）
- Test: `src/scenarios/voyage.test.ts`

**Interfaces:**
- Consumes: Task 1 的 ceilingUnlocks（印记 私掠/船队/海枭/霸主）。
- Produces: 四道 keyMoment 闸门，按序串链 `私掠→has(私掠)&wealth>=40→has(船队)&wealth>=55→has(海枭)&wealth>=70`。

- [ ] **Step 1: 写失败测试** — 在 `voyage.test.ts` 追加：

```ts
describe('voyage 升势力闸门', () => {
  it('四道升势力机缘均为 keyMoment、授对应势力印记、按序串链+财富门槛', () => {
    const want = [
      { summary: '海上肥羊', flag: '私掠', need: undefined as string | undefined, pick: '升起黑旗，登船劫掠' },
      { summary: '海盗结盟', flag: '船队', need: 'has(私掠) & wealth>=40', pick: '歃血结盟，借势纵横怒海' },
      { summary: '老提督甲板献策', flag: '海枭', need: 'has(船队) & wealth>=55', pick: '主动挑战列强舰队，破而后立' },
      { summary: '决战在即', flag: '霸主', need: 'has(海枭) & wealth>=70', pick: '设伏火攻，险中求一场大胜' },
    ]
    for (const w of want) {
      const ev = (voyage.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const ch = ev!.choices.find((c) => c.text === w.pick)
      expect((ch?.flagsSet ?? []).includes(w.flag), w.summary).toBe(true)
      if (w.need) expect(ev!.requires, w.summary).toBe(w.need)
    }
  })
  it('升起黑旗当回合船力可破 35 上限', () => {
    let st = initState(voyage, voyage.openings![0])
    st = { ...st, attributes: { ship: 35, wealth: 30, crew: 60 }, history: Array(2).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (voyage.localEvents ?? []).find((e) => e.summary === '海上肥羊')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('私掠'))
    const next = applyChoice(voyage, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('私掠')
    expect(next.attributes.ship).toBeGreaterThan(35)
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 海上肥羊 → 私掠闸门** — 给「升起黑旗，登船劫掠」加 `flagsSet: ['私掠']`（事件已 keyMoment，无 requires）：

```ts
        { text: '升起黑旗，登船劫掠', effects: { wealth: 10, crew: 4, ship: -3 }, flagsSet: ['私掠'], reaction: '商船水手吓得弃械跪降，你的弟兄们搬空货舱欢呼雀跃，可那艘船的旗号你也记下了——往后这片海上多了一桩仇怨。' },
```

- [ ] **Step 3b: 海盗结盟 → 船队闸门** — 给「歃血结盟，借势纵横怒海」加 `flagsSet: ['船队']`，事件加 `requires: 'has(私掠) & wealth>=40'` 与 `keyMoment: true`。该事件尾部改为：

```ts
        { text: '歃血结盟，借势纵横怒海', effects: { crew: 6, ship: 4, wealth: -3 }, flagsSet: ['船队'], reaction: '老海盗大喜，当即引你割腕滴血、对天盟誓，碗沿一圈血酒分饮而尽；从此各港散船皆是你行走怒海的照应。' },
        { text: '只交朋友，不入盟约', effects: { crew: 4, wealth: 2 }, reaction: '老海盗虽有几分遗憾，仍与你碰碗痛饮，赞你坦荡不假意，临别拍肩道日后海上相逢，他认你这个朋友。' },
      ],
      summary: '海盗结盟',
      requires: 'has(私掠) & wealth>=40',
      keyMoment: true,
      minTurn: 8,
    },
```

- [ ] **Step 3c: 老提督甲板献策 → 海枭闸门** — 给「主动挑战列强舰队，破而后立」加 `flagsSet: ['海枭']`；把 `requires: 'ship>=45'` 改为 `requires: 'has(船队) & wealth>=55'`，加 `keyMoment: true`。尾部改为：

```ts
        { text: '主动挑战列强舰队，破而后立', effects: { ship: 12, crew: -6, wealth: 4 }, flagsSet: ['海枭'], reaction: '惊涛炮火间你竟以小博大撕开了列强的封锁线，缴获连营；那老提督远远见了，捻须长叹这后生竟真有破釜沉舟的胆魄。' },
        { text: '稳扎稳打，慢慢添船募人', effects: { ship: 4, wealth: -2, crew: 2 }, reaction: '你不肯弄险，只沉下心来一艘艘添船、一个个募人，老提督微微颔首道稳便是稳，只是这道关口，怕要熬上更长的年月了。' },
      ],
      summary: '老提督甲板献策',
      requires: 'has(船队) & wealth>=55',
      keyMoment: true,
      minTurn: 10,
      weight: 1.1,
    },
```

- [ ] **Step 3d: 决战在即 → 霸主闸门** — 给「设伏火攻，险中求一场大胜」加 `flagsSet: ['霸主']`；把 `requires: 'ship>=65'` 改为 `requires: 'has(海枭) & wealth>=70'`（事件已 keyMoment）。尾部改为：

```ts
        { text: '设伏火攻，险中求一场大胜', effects: { ship: 8, crew: 6, wealth: 4 }, flagsSet: ['霸主'], reaction: '你巧设火攻、诱敌入彀，烈焰冲天里宿敌的联合船队溃不成军；这一战以弱胜强名震七海，弟兄们将你的名字喊得震天响。' },
        { text: '暂避锋芒，保存实力图后计', effects: { ship: 2, crew: -3, wealth: -2 }, reaction: '你审时度势避开了这场恶战、保全了舰队，虽未折损元气，可那不战而退的姿态，到底让憋着劲的弟兄们泄了几分气。' },
      ],
      summary: '决战在即',
      keyMoment: true,
      requires: 'has(海枭) & wealth>=70',
      weight: 1.2,
    },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(voyage): 四道升势力闸门（海上肥羊/海盗结盟/老提督/决战在即）keyMoment+授势力印记+财富门槛串链"
```

---

### Task 4: 三个隐藏 endTone 哨兵彩蛋

**Files:**
- Modify: `src/scenarios/voyage.ts`（`endings` 追加 3 项；事件 `孤岛通商`/`藏宝图争夺`/`王室招安` 对应选项改 `outcomes`）
- Test: `src/scenarios/voyage.test.ts`

**Interfaces:**
- Produces: 三个 `condition:'crew<=-1'` 结局（`屠岛劫财·恶贯满盈`、`见利忘义·众叛弃尸`、`逍遥怒海·自由之王`），由对应事件加权 `outcomes[].endTone` 强制触发。

- [ ] **Step 1: 写失败测试** — 在 `voyage.test.ts` 追加：

```ts
describe('voyage 隐藏 endTone 哨兵', () => {
  const tones = ['屠岛劫财·恶贯满盈', '见利忘义·众叛弃尸', '逍遥怒海·自由之王']
  it('三哨兵结局存在且 condition 为 crew<=-1', () => {
    for (const t of tones) {
      const e = voyage.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('crew<=-1')
    }
  })
  it('每个哨兵基调都被某事件 outcomes.endTone 引用（防 tone 打错）', () => {
    const used = new Set<string>()
    for (const ev of voyage.localEvents ?? [])
      for (const c of ev.choices) {
        if (c.endTone) used.add(c.endTone)
        for (const o of c.outcomes ?? []) if (o.endTone) used.add(o.endTone)
      }
    for (const t of tones) expect(used.has(t), t).toBe(true)
  })
  it('屠掠土人的 endTone 分支被掷中即强制地狱结局', () => {
    let st = initState(voyage, voyage.openings![0])
    st = { ...st, attributes: { ship: 60, wealth: 50, crew: 40 }, history: Array(10).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (voyage.localEvents ?? []).find((e) => e.summary === '孤岛通商')!
    const idx = ev.choices.findIndex((c) => c.text === '恃强凌弱，巧取豪夺一番')
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, endTone: c.endTone })) }
    const next = applyChoice(voyage, st, tr as any, idx, () => 0.999) // 取末位 = endTone 分支
    expect(next.ended?.tone).toBe('屠岛劫财·恶贯满盈')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: FAIL。

- [ ] **Step 3a: 追加三个哨兵结局** — 在 `endings: [` 数组里、紧跟 `众叛亲离·丧于内变`（`condition: 'crew<=0'`）那个结局对象之后，插入：

```ts
    {
      condition: 'crew<=-1',
      tone: '屠岛劫财·恶贯满盈',
      epilogue:
        '你的炮口对准了那些只求公平交易的土人，铁与火换来满舱的香料珍珠，也换来一路的血与哀嚎。恶名顺着洋流传遍七海，连最凶悍的海狼都不齿与你为伍；终有一夜，再忠的弟兄也受不住良心的煎熬与同道的唾弃，趁你熟睡割断了你的缆绳——你这一身用无辜者的血堆起的「霸业」，到头来连个替你收尸的人都没有。',
    },
    {
      condition: 'crew<=-1',
      tone: '见利忘义·众叛弃尸',
      epilogue:
        '为了独吞那片死亡海域里的财宝，你眼睁睁看着随你出生入死的弟兄葬身礁石与暗流，归来时船舱金银满载、甲板却空了大半。活下来的人记住了你见利忘义的嘴脸：金子捂不热寒透的人心，没过多久，剩下的弟兄也红着眼把你连同你的金子一道掀进了海里。怒海无言，只把一个忘恩负义之徒，连同他的财宝，一并吞没。',
    },
    {
      condition: 'crew<=-1',
      tone: '逍遥怒海·自由之王',
      epilogue:
        '你笑着把那纸烫金的国书推了回去——封地、爵位、提督的披风，都换不来头顶这片不归谁管的天。从此你扬帆来去、四海为家，劫富济弱、快意恩仇，弟兄们以追随你为荣，各港的穷苦水手把你的故事编成歌谣。你没坐上谁的王座，却成了这片怒海上最自由的王——后世说起大航海的传奇，总绕不开一个拒了王冠、只认风浪的名字。',
    },
```

- [ ] **Step 3b: 孤岛通商「恃强凌弱」改 outcomes（地狱）** — 把 `孤岛通商` 事件里「恃强凌弱，巧取豪夺一番」整体替换为：

```ts
        {
          text: '恃强凌弱，巧取豪夺一番',
          effects: {},
          outcomes: [
            { weight: 1, effects: { wealth: 9, crew: -4 }, reaction: '你仗着船坚炮利低价强买、几近掠夺，满舱货物是堆满了，可部落首领怨毒的目光让几个老实弟兄背地里直摇头。' },
            { weight: 1, effects: {}, endTone: '屠岛劫财·恶贯满盈', reaction: '一言不合便升起黑旗，你纵兵血洗了那座与世无争的孤岛，满舱的香料珍珠浸着土人的血——连你自己的弟兄，都在这场屠戮后再不敢正眼看你。' },
          ],
        },
```

- [ ] **Step 3c: 藏宝图争夺「独闯死亡海域」改 outcomes（地狱）** — 把 `藏宝图争夺` 事件里「独闯死亡海域，富贵险中求」整体替换为：

```ts
        {
          text: '独闯死亡海域，富贵险中求',
          effects: {},
          outcomes: [
            { weight: 1, effects: { wealth: 10, ship: -6, crew: -3 }, reaction: '你独闯迷雾夺宝而归，引来满海红眼觊觎，道上有人忌你心狠手辣，也有人骂你只顾私利、不顾弟兄死活。' },
            { weight: 1, effects: {}, endTone: '见利忘义·众叛弃尸', reaction: '为夺那片死亡海域里的宝藏，你驱着弟兄硬闯礁群、葬送大半，自己抱着金箱独活——这见利忘义的一幕，弟兄们都记在了眼里。' },
          ],
        },
```

- [ ] **Step 3d: 王室招安「婉拒王命」改 outcomes（天堂·稀有 4:1）** — 把 `王室招安` 事件里「婉拒王命，宁做自由的怒海之主」整体替换为：

```ts
        {
          text: '婉拒王命，宁做自由的怒海之主',
          effects: {},
          outcomes: [
            { weight: 4, effects: { crew: 6, ship: 2, wealth: -2 }, reaction: '你笑着退回了国书，使节悻悻而返；甲板上一个独腿老水手把烟斗往栏杆上一磕，咧嘴道：「跟着船长这种人出海，图的就是头顶这片不归谁管的天。」' },
            { weight: 1, effects: {}, endTone: '逍遥怒海·自由之王', reaction: '你当众推回那纸国书，宁舍王侯之贵、只认这一片自由海天；满船弟兄轰然叫好，那一刻你忽然明白，这怒海之上最贵的从来不是王座。' },
          ],
        },
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(voyage): 三隐藏endTone哨兵——屠岛劫财/见利忘义（地狱）+ 逍遥自由之王（稀有天堂）"
```

---

### Task 5: tierLabel + systemPrompt + AI 注入

**Files:**
- Modify: `src/scenarios/voyage.ts`（顶层加 `tierLabel`；`systemPrompt` 末尾补）
- Test: `src/scenarios/voyage.test.ts`

**Interfaces:**
- Consumes: Task 1 的 ceilingUnlocks（【晋阶之序】据此叙述势力序）。
- Produces: `tierLabel:'势力'`；systemPrompt 含势力晋阶/财富为引擎/隐藏结局提示。

- [ ] **Step 1: 写失败测试** — 在 `voyage.test.ts` 追加：

```ts
describe('voyage AI 模式', () => {
  it('tierLabel=势力，晋阶之序用本剧术语「势力」+ 势力印记序', () => {
    const st = initState(voyage, voyage.openings!.find((o) => o.flag), undefined, 'ai')
    const all = buildTurnMessages(voyage, st).map((m) => m.content).join('\n')
    expect(voyage.tierLabel).toBe('势力')
    expect(all).toContain('晋阶之序')
    expect(all).toContain('势力')
    expect(all).toContain('私掠→船队→海枭→霸主')
    expect(all).not.toContain('封顶')
  })
  it('systemPrompt 含势力晋阶与财富引擎指引', () => {
    expect(voyage.systemPrompt).toContain('势力')
    expect(voyage.systemPrompt).toContain('私掠')
  })
  it('AI 提示不含「undefined」', () => {
    const st = initState(voyage, voyage.openings![0], undefined, 'ai')
    expect(buildTurnMessages(voyage, st).map((m) => m.content).join('\n')).not.toContain('undefined')
  })
})
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: FAIL（无 tierLabel）。

- [ ] **Step 3a: 加 tierLabel** — 在 `turnUnit: '年',` 一行之后插入：

```ts
  turnUnit: '年',
  tierLabel: '势力',
  maxTurns: 30,
```

- [ ] **Step 3b: systemPrompt 补两行** — 在 `systemPrompt` 末尾、`- 文风简洁有海洋气息，避免冗长说教` 这一行之后（闭合反引号 `` ` `` 之前）追加两行（注意最后一行以原本的闭合反引号收尾，勿破坏模板字符串）：

```
- 海上势力分「私掠→船队→海枭→霸主」数级，唯有立威、结队、破局、称霸的重大机缘（关键抉择中壮大的那一手）方能晋阶，而财富是层层扩张的本钱——无财则难买船募人、势力难进
- 泯灭道义的僭越（屠掠无辜、见利忘义弃友）或巅峰拒冠而逍遥的极难抉择，皆可能通向隐藏的结局`
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "feat(voyage): tierLabel势力 + systemPrompt补势力晋阶/财富引擎/隐藏结局指引"
```

---

### Task 6: 人心 decay 与 sim-balance 校准

**Files:**
- Modify: `src/scenarios/voyage.ts`（`crew` 属性，按 sim 结果定 `decayPerTurn`）
- Test: `src/scenarios/voyage.test.ts`

**Interfaces:**
- Consumes: Task 1–5 全部。
- Produces: 经 sim 校准的 `人心` decay 值与断言它的测试。

- [ ] **Step 1: 先跑 tsc + 基线 sim** — Run: `npx tsc --noEmit`（须干净，捕捉 outcomes/effects 类型漏写）；再 Run: `npx vite-node scripts/sim-balance.ts voyage 5000`。记录：①死亡率（沉船+哗变+endTone 致死 合计）；②登顶档（海枭/霸主 + 高 stats）在 random/survive/greedy 占比。

- [ ] **Step 2: 判定 decay** — 决策规则：
  - 若「哗变」类坏结局（含 crew<=0 死亡 + 人心散尽等）在 random 下 **< 3%**（人心几乎不崩），给 `crew` 加 `decayPerTurn: 1`（漫长怒海生涯人心自然消磨），重跑 sim 验证哗变升到健康区间（个位数百分比，且 survive 不至大面积哗变死）。若仍 < 3% 试 `2`；若基线已 ≥ 3% 且分布健康则保持 0。
  - 记下最终值 `<DECAY>`（0、1 或 2）。

- [ ] **Step 3: 落地 decay（若 >0）** — 若 `<DECAY>` > 0，在 `crew` 属性的 `deathBelow: 0,` 之后插入（示例为 1，按 Step 2 结论填实际值）：

```ts
      key: 'crew',
      name: '人心',
      initial: 60,
      max: 100,
      deathBelow: 0,
      // 漫长怒海生涯中人心自然消磨（sim 校准：治「哗变几乎不可能」之平淡）
      decayPerTurn: 1,
      bands: [
```
（若结论为 0，跳过本步、不加 `decayPerTurn`。）

- [ ] **Step 4: 写断言测试并跑** — 在 `voyage.test.ts` 追加（把 `<DECAY>` 换成实际值；0 时断言 `?? 0` 等于 0）：

```ts
describe('voyage 衰减与 sim 健壮性', () => {
  it('人心 decay 经 sim 校准（治哗变过低）', () => {
    const crew = voyage.attributes.find((a) => a.key === 'crew')!
    expect(crew.decayPerTurn ?? 0).toBe(<DECAY>) // sim-tuned
  })
  it('船力保持每年衰减 1（悬顶之危·船蛀）', () => {
    expect(voyage.attributes.find((a) => a.key === 'ship')!.decayPerTurn).toBe(1)
  })
  it('每个本地事件选项都带 effects（含 outcomes 分支选项），防 sim magOf 崩溃', () => {
    for (const ev of voyage.localEvents ?? [])
      for (const c of ev.choices) expect(c.effects, `${ev.summary}/${c.text}`).toBeDefined()
  })
})
```
Run: `npx vitest run src/scenarios/voyage.test.ts`，Expected: PASS。

- [ ] **Step 5: 全量回归 + tsc + 提交** — Run: `npx vitest run`（全套绿）；Run: `npx tsc --noEmit`（干净）。然后：

```bash
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" add src/scenarios/voyage.ts src/scenarios/voyage.test.ts
git -C "D:/Backup/Libraries/Documents/GitHub/Projects/365/015-thousand-lives" commit -m "fix(voyage): 平衡sim——人心decay校准 + 双死亡线回归"
```

---

## Self-Review（对照 spec）

**Spec coverage:** §1 船力 ceilingUnlocks→T1 ✓；§2 财富门槛→T3 的 requires ✓；§3 四升势力闸门(改造/串链/财富门槛/单支授印记)→T3 ✓（sim 杠杆「必要时两支授印记」在 T6 按登顶率定，spec §3 已记）；§4 三身份事件→T2 ✓；§5 三隐藏 endTone 哨兵→T4 ✓；§6 apex 靠 ceiling 自动门控(不改结局)→无需任务，T1 的 ceiling 即达成、T4 不动既有 apex ✓；§7 tierLabel+systemPrompt→T5 ✓；§8 人心 decay/sim→T6 ✓。

**Placeholder scan:** 仅 T6 的 `<DECAY>` 为 sim 经验值，已给明确决策规则与默认起点（sim-balance 任务固有性质）；其余步骤均含完整代码与确切命令。

**Type consistency:** 印记名 `私掠/船队/海枭/霸主` 在 T1(ceilingUnlocks) 与 T3(flagsSet/requires) 一致；哨兵基调 `屠岛劫财·恶贯满盈`/`见利忘义·众叛弃尸`/`逍遥怒海·自由之王` 在 T4 结局/outcomes.endTone/测试三处一致；`tierLabel:'势力'` 与 T5 测试一致。outcomes 选项均按约定带 `effects: {}`（选项级 + 每分支级），endTone 分支带 reaction。测试 import 仅 `clampEffects/initState/applyChoice/buildTurnMessages`（无未用 import，避免 tsc TS6133）。

# 官场机缘体系 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已验证的机缘体系移植到 `officialdom`（宦海浮沉），主题化为明代官阶升迁，并把长度扩到 70 岁荣休（maxTurns 24→44）；apex 不走渡劫赌命，改「官阶攀爬 + 晚节封顶」。

**Architecture:** 纯内容/配置改动，零引擎改动——复用 L1 的 `ceiling`/`ceilingUnlocks`/`outcomes`/`endTone`/`keyMoment`/`flags`（`has()` 条件语言）。prompt.ts 与 sim-balance.ts 已在 wuxia 期通用化，本期无需再改。所有改动落在 `src/scenarios/officialdom.ts`；新建 `src/scenarios/officialdom.test.ts`。

**Tech Stack:** TypeScript、Vitest、vite-node。

## Global Constraints

- **长度 70 岁荣休**：`maxTurns: 24 → 44`；`turnUnit` 仍「年」。~24 个 `maxTurns & …` 善终结局条件不变。
- **圣眷 decay `2 → 1`**（44 年长跑可活；最终值 sim 调，起点 1）。
- **官阶印记**固定四个、按序：`知府`→`封疆`→`九卿`→`阁老`，不得越级。**只有 `power`（权势）有官阶阶梯**；`favor`（圣眷，死亡赛跑）、`name`（官声，standing）不设封顶。
- **apex 不走渡劫赌命**：拜相靠 44 年攀爬 + 晚节，4 个 passive 巅峰结局改 `maxTurns &` 门控；**survive 登顶不强求 0**（官场可「修成正果」）。
- 哨兵 condition 用 `favor<=-1`（`favor.deathBelow===0`，`invariants.test.ts` A2 已豁免）。
- 测试 Vitest；每个 Task 提交前 `npx tsc --noEmit` 干净、全量 `npx vitest run` 绿。
- 提交信息结尾两行 trailer：
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01PHzsPTk6RFo3GtatFSduqL`
- sim 数字由控制器亲验，不信任 agent 自报。
- 命令用工具原生 cwd（`git -C <repo>`、`npx --prefix <repo>` 或以 repo 为工作目录），不用复合 `cd <path>; cmd`。

## File Structure

- `src/scenarios/officialdom.ts`（修改）：唯一内容文件（~1684 行，~70 events，~24 endings）。
- `src/scenarios/officialdom.test.ts`（新建）：本题材的长度/封顶/印记链/巅峰结局门控/身份 gate/隐藏 endTone/AI 词表/守护断言。
- `scripts/sim-balance.ts`（沿用，已通用，不改）。

参考样板（只读，勿改）：`src/scenarios/wuxia.ts`（ceilingUnlocks、身份 flag、keyMoment+flagsSet 突破、隐藏 endTone 哨兵 + maxTurns 巅峰门控）、`src/scenarios/wuxia.test.ts`、`src/scenarios/xian.ts`（专属突破事件结构）。

---

## Task 1: 长度扩到 44 年 + 圣眷 decay 降为 1 + 去「第24年」硬编

**Files:** Modify `src/scenarios/officialdom.ts`（maxTurns、favor.decayPerTurn、systemPrompt）；Create `src/scenarios/officialdom.test.ts`

**Interfaces:** Produces `officialdom.maxTurns === 44`、`favor` 属性 `decayPerTurn: 1`、systemPrompt 无「第 24 年」字样。后续 Task 的事件 minTurn / 巅峰结局 maxTurns 都基于 44。

- [ ] **Step 1: 写失败测试** — 新建 `src/scenarios/officialdom.test.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { officialdom } from './officialdom'
import { clampEffects, initState, applyChoice, checkEnding } from '../engine/state'

describe('officialdom 长度与圣眷衰减（70岁荣休）', () => {
  it('maxTurns 扩到 44（进士→70岁荣休）', () => {
    expect(officialdom.maxTurns).toBe(44)
  })
  it('圣眷 decay 降为 1（44年长跑可活）', () => {
    const favor = officialdom.attributes.find((a) => a.key === 'favor')!
    expect(favor.decayPerTurn).toBe(1)
  })
  it('systemPrompt 不再硬编「第 24 年」', () => {
    expect(officialdom.systemPrompt).not.toContain('第 24 年')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "70岁荣休"` → FAIL（当前 maxTurns 24、decay 2、含「第 24 年」）。

- [ ] **Step 3: 实现** — 在 `officialdom.ts`：
  - `maxTurns: 24` → `maxTurns: 44`。
  - `favor` 属性 `decayPerTurn: 2` → `decayPerTurn: 1`（注释里的「-2/年」一并改「-1/年」）。
  - systemPrompt 末行 `- 临近第 24 年时，铺垫致仕、入阁、或倾覆等大结局的多种走向` → `- 为官生涯约四十余年（进士及第至七十岁荣休）；临近晚年（第 40 年后）应铺垫致仕、入阁、或倾覆等大结局的多种走向`。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): 扩到44年(70岁荣休)+圣眷decay降为1+去「第24年」硬编`

---

## Task 2: 权势官阶封顶阶梯（知府/封疆/九卿/阁老）

**Files:** Modify `src/scenarios/officialdom.ts`（`power` 属性）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes L1 `clampEffects(sc, attrs, effects, flags)`、`effectiveCeiling`。Produces `power` 带 `ceiling:30` + `ceilingUnlocks:[{flag:'知府',max:50},{flag:'封疆',max:70},{flag:'九卿',max:85},{flag:'阁老',max:100}]`。后续 Task 4 升迁事件靠这些印记抬升封顶。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
describe('officialdom 权势官阶封顶', () => {
  it('无官阶印记时权势封顶 30', () => {
    expect(clampEffects(officialdom, { power: 28 }, { power: 50 }, []).power).toBe(30)
  })
  it('知府印记解锁封顶 50', () => {
    expect(clampEffects(officialdom, { power: 45 }, { power: 50 }, ['知府']).power).toBe(50)
  })
  it('封疆印记解锁封顶 70', () => {
    expect(clampEffects(officialdom, { power: 60 }, { power: 50 }, ['知府', '封疆']).power).toBe(70)
  })
  it('九卿印记解锁封顶 85', () => {
    expect(clampEffects(officialdom, { power: 80 }, { power: 50 }, ['知府', '封疆', '九卿']).power).toBe(85)
  })
  it('阁老印记解锁封顶 100', () => {
    expect(clampEffects(officialdom, { power: 95 }, { power: 50 }, ['知府', '封疆', '九卿', '阁老']).power).toBe(100)
  })
  it('圣眷与官声不设官阶封顶', () => {
    expect(clampEffects(officialdom, { favor: 95 }, { favor: 50 }, []).favor).toBe(100)
    expect(clampEffects(officialdom, { name: 95 }, { name: 50 }, []).name).toBe(100)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "官阶封顶"` → FAIL（power 当前无 ceiling）。

- [ ] **Step 3: 实现** — 在 `power` 属性加 `ceiling` + `ceilingUnlocks`（保留 bands）：

```ts
{
  key: 'power',
  name: '权势',
  initial: 30,
  max: 100,
  ceiling: 30,
  ceilingUnlocks: [
    { flag: '知府', max: 50 },
    { flag: '封疆', max: 70 },
    { flag: '九卿', max: 85 },
    { flag: '阁老', max: 100 },
  ],
  bands: [ /* 保持原样 */ ],
},
```

`favor`、`name` **不加** ceiling/ceilingUnlocks。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): 权势官阶封顶阶梯（知府/封疆/九卿/阁老 ceilingUnlocks）`

---

## Task 3: 身份印记 + 身份事件门控

**Files:** Modify `src/scenarios/officialdom.ts`（`openings`、身份相关事件 requires）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes L1 `initState`（opening.flag → `st.flags`）、`has(X)`/`!has(X)`。Produces 3 开局各带 flag。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
describe('officialdom 身份印记', () => {
  it('三开局各注入身份印记', () => {
    for (const n of ['寒门进士', '世家子弟', '内廷养子']) {
      const op = officialdom.openings!.find((o) => o.name === n)
      expect(op?.flag).toBe(n)
      expect(initState(officialdom, op).flags).toContain(n)
    }
  })
  it('内廷养子专属事件带 has(内廷养子) 门控', () => {
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '内廷阴影')
    expect(ev?.requires).toContain('has(内廷养子)')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "身份印记"` → FAIL。

- [ ] **Step 3: 实现** —
(a) `openings` 加 flag（prompt 不变）：
```ts
openings: [
  { name: '寒门进士', flag: '寒门进士', prompt: '苦读出身、毫无背景，一身清气却根基浅薄，凡事只能靠自己。' },
  { name: '世家子弟', flag: '世家子弟', prompt: '名门之后，人脉深厚、起点优渥，却背负沉重的门户与派系包袱。' },
  { name: '内廷养子', flag: '内廷养子', prompt: '攀附司礼监大珰而起，圣眷与门路易得，却为清流士林所不齿。' },
],
```
(b) 给身份专属事件加/合并 `requires`（**已有 requires 用 ` & ` 串接，不覆盖**；先 Grep+Read 该事件确认现有字段）：
- **内廷养子**：`内廷阴影`（summary='内廷阴影'）→ 加 `requires: 'has(内廷养子)'`（阉党门路/被清流弹劾「幸进」）。
- **世家子弟**：`权门联姻`/`权门婚约`/`修谱疑云` 中至少 2 个 → 加 `has(世家子弟)`（门第党援/门户包袱）。
- **寒门进士**：`孤立被构陷`（原 `requires: 'power<=18'`）→ 合并为 `requires: 'has(寒门进士) & power<=18'`（孤臣无援）；另择 1 个科甲/清流自守事件加 `has(寒门进士)`。
- 通用事件（灾荒/边患/京察通用面）不加身份 gate。
> 实现者须对每个目标事件先 Read，确认 summary 命中且既有 requires 正确合并；在报告中列出每个事件 before→after requires。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): 三开局身份印记 + 寒门/世家/内廷身份事件门控`

---

## Task 4: 四道升迁机缘（新建专属事件）+ 里程碑事件 minTurn 重铺

**Files:** Modify `src/scenarios/officialdom.ts`（新增 4 个 keyMoment 升迁事件；重铺既有里程碑事件 minTurn）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes Task 2 的 ceilingUnlocks；L1 `applyChoice`（同回合先 applyFlags 再 clampEffects，升迁当回合权势可达新上限）；keyMoment 节奏 `keyMomentTurns(44)`。Produces 4 个 `keyMoment:true` 专属升迁事件，「领命赴任」选项带 `flagsSet:['下一官阶']`，按 知府→封疆→九卿→阁老 串链。

> **设计说明**：既有 京察/督师/弹劾 等是「道德两难」事件（power/name/favor 来源），不适合直接当升迁闸门（清官也该能升）。故**新增 4 个专属升迁事件**（同 xian 的专属突破事件结构），既有里程碑事件保留为攒数值、逼近升迁阈值的来源。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
describe('officialdom 升迁闸门', () => {
  it('四道升迁机缘均为 keyMoment 且授对应官阶印记、按序串链', () => {
    const want = [
      { summary: '擢升知府', flag: '知府', prev: undefined },
      { summary: '晋升封疆', flag: '封疆', prev: '知府' },
      { summary: '晋位九卿', flag: '九卿', prev: '封疆' },
      { summary: '入阁拜相', flag: '阁老', prev: '九卿' },
    ]
    for (const w of want) {
      const ev = (officialdom.localEvents ?? []).find((e) => e.summary === w.summary)
      expect(ev?.keyMoment, w.summary).toBe(true)
      const grants = ev!.choices.some((c) => (c.flagsSet ?? []).includes(w.flag))
      expect(grants, w.summary).toBe(true)
      if (w.prev) expect(ev!.requires, w.summary).toContain(`has(${w.prev})`)
    }
  })
  it('擢升知府后同回合权势可破 30 上限', () => {
    let st = initState(officialdom, officialdom.openings!.find((o) => o.name === '寒门进士'))
    st = { ...st, attributes: { power: 28, name: 50, favor: 40 }, history: Array(4).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '擢升知府')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, flagsSet: c.flagsSet, flagsClear: c.flagsClear, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.flagsSet ?? []).includes('知府'))
    const next = applyChoice(officialdom, st, tr as any, idx, () => 0)
    expect(next.flags).toContain('知府')
    expect(next.attributes.power).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "升迁闸门"` → FAIL（事件不存在）。

- [ ] **Step 3: 实现** — 在 `officialdom.ts` 的 `localEvents` 数组中新增以下 4 个事件（完整对象，逐字加入；「领命」选项授印记 + power 冲新上限，「辞让」选项不授印记的小代价稳妥）：

```ts
{
  narrative:
    '京察卓异、政绩斐然，吏部一纸调令送到案头——擢你为一府之尊的知府。从此你不再是亲民一线的七品县令，而是手握一府钱粮刑名、可独当一面的五品正官。接印之日，僚属列班相贺，你立于府衙正堂，望着「明镜高悬」的匾额，掂量着这骤增的权柄与随之而来的干系。',
  choices: [
    { text: '领命赴任，整饬一府', effects: { power: 30, name: 4, favor: 2 }, flagsSet: ['知府'], reaction: '你接印履新、雷厉整饬，一府气象为之一新；上官赞你能员可用，僚属亦慑于你的手腕，不敢怠慢。' },
    { text: '上疏辞让，自陈资浅', effects: { name: 6, favor: -2 }, reaction: '你上疏谦辞、自陈资历尚浅，天子虽未允辞，却嘉你谦抑之德；只是这一让，到底慢了旁人一步。' },
  ],
  summary: '擢升知府',
  requires: 'power>=26 & favor>=30',
  keyMoment: true,
  once: true,
  minTurn: 4,
  weight: 3,
},
{
  narrative:
    '一方有警，朝廷需一能臣总督军政、抚绥地方。廷议之上，你的名字被反复提起——擢任三品督抚、封疆大吏，节制一省，权柄之重已非寻常京官可比。这是简在帝心、跻身方面大员的一跃，也意味着你将独镇一方、直面边患民变的滔天干系，功过都将被无限放大。',
  choices: [
    { text: '受命开府，节镇一方', effects: { power: 24, favor: 4, name: 2 }, flagsSet: ['封疆'], reaction: '你开府建牙、总揽一省军政，封疆大吏的威仪自此加身；朝野侧目，门生故吏渐多，你在地方说一不二。' },
    { text: '固辞重任，求稳守成', effects: { name: 4, favor: -2 }, reaction: '你以才浅力薄固辞，朝廷另简他人；你虽落得清闲安稳，却也错过了这跻身封疆的难得一跃。' },
  ],
  summary: '晋升封疆',
  requires: 'has(知府) & power>=46 & favor>=35',
  keyMoment: true,
  once: true,
  minTurn: 16,
  weight: 3,
},
{
  narrative:
    '内召入京、晋位九卿的廷寄到了。六部堂官、都察院、大理寺——这二品部院的堂上之位，是天下文官梦寐以求的清要枢机。你将从坐镇一方的封疆，跻身中枢决策的部院大臣，亲历庙堂之上的每一场风浪。这一步踏进去，便是真正进了这天朝权力的核心圈。',
  choices: [
    { text: '入觐受职，跻身部堂', effects: { power: 18, name: 4, favor: 2 }, flagsSet: ['九卿'], reaction: '你入觐谢恩、执掌部院，自此位列九卿、参与中枢机要；门生故吏布于朝堂，你的一言一动皆有分量。' },
    { text: '称疾稍缓，避其锋芒', effects: { name: 4, favor: -2 }, reaction: '你称疾暂缓入京、避一避朝中风头，圣心虽未见疑，这晋身中枢的时机却悄悄从指缝里溜走了几分。' },
  ],
  summary: '晋位九卿',
  requires: 'has(封疆) & power>=66 & name>=40',
  keyMoment: true,
  once: true,
  minTurn: 26,
  weight: 3,
},
{
  narrative:
    '首辅出缺，廷推入阁的呼声中赫然有你之名。入阁拜相、位极人臣——这是文臣一生所能抵达的极顶，一人之下、万人之上，票拟天下章奏、参决军国大政。半生宦海浮沉、如履薄冰，所有的隐忍与经营，都为了今日这一步。你立于紫禁城的丹墀之下，望着那座象征着无上权柄的内阁，知道踏进去便是另一重天地。',
  choices: [
    { text: '受推入阁，秉钧当国', effects: { power: 18, name: 2, favor: 2 }, flagsSet: ['阁老'], reaction: '你拜相入阁、秉钧当国，位极人臣，天下章奏经你票拟、军国大政由你参决；半生隐忍，终成这一人之下的辅弼之尊。' },
    { text: '谦退荐贤，甘居其次', effects: { name: 8, favor: -2 }, reaction: '你上疏谦退、转荐他人入阁，士林赞你不恋权位、有古大臣之风；只是这宰辅之位，终究与你擦肩而过。' },
  ],
  summary: '入阁拜相',
  requires: 'has(九卿) & power>=82 & favor>=50',
  keyMoment: true,
  once: true,
  minTurn: 34,
  weight: 3,
},
```

- [ ] **Step 4: 里程碑事件 minTurn 重铺（44 年铺开）** — 把既有「时局升级」事件的 minTurn 按 44 年重排，避免后半程无戏。逐事件 Read 确认后改 minTurn（仅改 minTurn，不动其他字段）：
  - 早期（保持/微调）：`夺嫡选边` minTurn 10、`丁忧与夺情` minTurn 8、`文字狱主审` minTurn 10 — 不变或微调。
  - 中后期上移：把若干现 minTurn ≤12 的「储位/党争/中枢」味事件（`储位暗潮`、`党争站队`、`御史发难`、`边功争议`、`宿敌失势`、`御前问策`）设/上调 minTurn 到 18-34，使其落在后半程。
  - 晚期：`告老归田`(1260)、`新君清算`(1478) 等 minTurn 上调到 ≥36。
  > 具体每事件目标 minTurn 由实现者据「早1-14/中14-28/晚28-44」分布判断；规则：4 道升迁闸门的 minTurn（4/16/26/34）必须落在 `keyMomentTurns(44)` 的 key 回合上（实现者用 `import { keyMomentTurns } from '../engine/keymoment'` 在一次性脚本里打印 `keyMomentTurns(44)` 核对；若某 minTurn 不在 key 回合，下调到最近的 key 回合）。Task 8 的 sim 会暴露 reach 率，据此再调。

- [ ] **Step 5: 跑绿 + Commit** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。`feat(officialdom): 四道升迁机缘（擢升知府→晋升封疆→晋位九卿→入阁拜相）+ 里程碑事件44年重铺`

---

## Task 5: 四个巅峰结局改 maxTurns 门控（apex 不中途白嫖）

**Files:** Modify `src/scenarios/officialdom.ts`（4 个 passive 巅峰结局 condition）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes Task 1（maxTurns 44）。Produces 4 个正向巅峰结局 condition 前缀 `maxTurns &`，只在荣休年触发，不中途秒收场。负面/死亡结局不变。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
describe('officialdom 巅峰结局须 maxTurns（不中途白嫖）', () => {
  it('满血高位在非荣休年不触发巅峰结局', () => {
    // 高 name/power/favor，但回合数 < maxTurns（第 20 年）：巅峰结局不应触发
    const r = checkEnding(officialdom, { name: 98, power: 98, favor: 98 }, 20, ['知府', '封疆', '九卿', '阁老'])
    for (const t of ['出将入相·名垂青史', '权倾朝野·一手遮天', '万民称颂·青天再世', '简在帝心·恩宠无两']) {
      expect(r?.tone === t, t).toBe(false)
    }
  })
  it('荣休年（满期）高位触发巅峰结局', () => {
    const r = checkEnding(officialdom, { name: 98, power: 98, favor: 98 }, 44, ['知府', '封疆', '九卿', '阁老'])
    expect(r?.tone).toBeTruthy()
    // 满期高 name&power → 出将入相（最具体在前）
    expect(['出将入相·名垂青史', '权倾朝野·一手遮天', '万民称颂·青天再世', '简在帝心·恩宠无两', '名相贤臣·配享太庙']).toContain(r!.tone)
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "巅峰结局须 maxTurns"` → FAIL（第 20 年满血会触发被动巅峰）。

- [ ] **Step 3: 实现** — 改 4 个巅峰结局的 condition（tone/epilogue 不变），其余结局**全部不动**：
  - `出将入相·名垂青史`：`condition: 'name>=96 & power>=70'` → `'maxTurns & name>=96 & power>=70'`
  - `权倾朝野·一手遮天`：`condition: 'power>=96'` → `'maxTurns & power>=96'`
  - `万民称颂·青天再世`：`condition: 'name>=96'` → `'maxTurns & name>=96'`
  - `简在帝心·恩宠无两`：`condition: 'favor>=96'` → `'maxTurns & favor>=96'`
  > 这 4 个须位于其余 `maxTurns & …` 善终结局**之前**（checkEnding 取首个匹配；它们已在现文件靠前位置——确认顺序，必要时保持原位即可，本改动不移动条目）。负面结局 `favor<=0`（抄家）、`name<=4`（削籍）等保持原样（官场原生倾覆，可中途触发）。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): 四巅峰结局改maxTurns门控（拜相靠攀爬+晚节，不中途白嫖）`

---

## Task 6: 隐藏 endTone（文字狱/站队暴毙 + 际遇天堂）

**Files:** Modify `src/scenarios/officialdom.ts`（凶险事件低权 endTone outcome；新增 2 致死 + 1 天堂哨兵结局）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes L1 `outcomes`（choice 有 outcomes 时按权重掷骰）、`endTone` 强制结局、哨兵 condition `favor<=-1`。Produces 凶险事件低权致死 endTone 分支；新增 `文字狱·瘐死诏狱`、`站队倾覆·满门抄斩`（致死）与 `简在帝心·骤擢入阁`（天堂）三结局，均哨兵。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
describe('officialdom 隐藏 endTone', () => {
  it('新增致死与天堂隐藏结局存在且为哨兵 favor<=-1', () => {
    for (const t of ['文字狱·瘐死诏狱', '站队倾覆·满门抄斩', '简在帝心·骤擢入阁']) {
      const e = officialdom.endings.find((x) => x.tone === t)
      expect(e?.condition, t).toBe('favor<=-1')
    }
  })
  it('夺嫡选边含低权站队倾覆 endTone 分支', () => {
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '夺嫡选边')!
    const has = ev.choices.some((c) => (c.outcomes ?? []).some((o) => o.endTone === '站队倾覆·满门抄斩'))
    expect(has).toBe(true)
  })
  it('endTone 强制即终局', () => {
    let st = initState(officialdom, officialdom.openings!.find((o) => o.name === '世家子弟'))
    st = { ...st, attributes: { name: 50, power: 50, favor: 50 }, history: Array(12).fill({ narrative: '', choiceText: '', summary: '' }) }
    const ev = (officialdom.localEvents ?? []).find((e) => e.summary === '夺嫡选边')!
    const tr = { narrative: ev.narrative, summary: ev.summary, choices: ev.choices.map((c) => ({ text: c.text, effects: c.effects, outcomes: c.outcomes, endTone: c.endTone })) }
    const idx = tr.choices.findIndex((c) => (c.outcomes ?? []).some((o) => o.endTone === '站队倾覆·满门抄斩'))
    const next = applyChoice(officialdom, st, tr as any, idx, () => 0.999)
    expect(next.ended?.reason).toBe('forced')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "隐藏 endTone"` → FAIL。

- [ ] **Step 3: 实现** —
(a) **新增三结局**（endings 数组，挨着 `favor<=0` 抄家结局附近；均 `condition: 'favor<=-1'`）：
```ts
{
  condition: 'favor<=-1',
  tone: '文字狱·瘐死诏狱',
  epilogue:
    '一句诗、一行字，被人挑出来罗织成「讪谤君上」的弥天大罪。诏狱的铁门在身后轰然合拢，潮湿的霉气里只有镣铐拖地的声响。你在不见天日的牢底熬过了一个又一个寒夜，等不到昭雪的那一日——一身的抱负、满腹的经纶，最终都化作狱卒草草掩埋的一抔黄土。世人只记得你「以文获罪」，再无人记得你曾想为这天下做些什么。',
},
{
  condition: 'favor<=-1',
  tone: '站队倾覆·满门抄斩',
  epilogue:
    '你押上身家性命赌的那一注，终究输得干干净净。新君即位的那一刻，你昔日效忠的主子轰然垮台，清算的屠刀随即落到你头上。缇骑破门、九族同罪，半生苦心经营的门楣，在一夜之间化作刑场上的森森白骨。储位之争从无中间地带——站错了队，便是这般万劫不复的下场。你至死才懂，这赌局赢家通吃，输家连尸骨都难全。',
},
{
  condition: 'favor<=-1',
  tone: '简在帝心·骤擢入阁',
  epilogue:
    '一道中旨自宫中飞出，越过层层资历与廷推的常规，天子竟亲点你骤然入阁！满朝错愕之中，你一步登天、位列辅臣。这般不次之擢、简在帝心的际遇，百年难逢一回——你甚至来不及细想其中的凶险与众人的眼红，便已被那泼天的恩宠裹挟着，站上了这一人之下的权力之巅。是福是祸，且待来日，但此刻，你确是这煌煌天朝里最得圣心的那一个。',
},
```
(b) **夺嫡选边 加低权致死 outcome**（先 Read summary='夺嫡选边' 事件，约 line 390，once/minTurn10/keyMoment）：把其「押注一方」的最激进选项从纯 effects 改为 outcomes（保留原 effects 为高权常态分支 + 加一个低权 `endTone:'站队倾覆·满门抄斩'` 分支）：
```ts
// 形如：
{ text: <原押注选项文案>, effects: {}, outcomes: [
  { weight: 12, effects: <原 effects>, reaction: <原 reaction> },
  { weight: 1, effects: {}, endTone: '站队倾覆·满门抄斩', reaction: '你押下的那位皇子终究败了，新君翻旧账只在朝夕——缇骑破门那夜，你才惊觉这一注押的从来不是前程，是满门的性命。' },
] },
```
(c) **另一致死 + 天堂落点**（先 Read 对应事件）：
  - `文字狱·瘐死诏狱`：挂在 `文字狱主审`(line 540) 或 `文字风狱`(632) 的最激进/逞强选项，加低权 `endTone:'文字狱·瘐死诏狱'`（自己反被文字狱反噬）。
  - `简在帝心·骤擢入阁`（天堂）：挂在一个**晚期高圣眷**事件（如 `帝王密旨` requires favor>=80，或 `御前奏对`/`御前问策`）的进取选项，加**极低权**（weight 1 对常态 ~20）`endTone:'简在帝心·骤擢入阁'`。仅此一处天堂，确保稀有。
  > 转换模式同 wuxia Task 5：原 effects+reaction 留作高权常态分支，仅 ADD 低权 endTone 分支。实现者 Read 每个目标事件后按此改，报告列出改了哪些事件/选项/权重。

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): 隐藏endTone——文字狱/站队倾覆暴毙 + 稀有骤擢入阁天堂`

---

## Task 7: AI 模式 systemPrompt 补 + prompt 注入回归

**Files:** Modify `src/scenarios/officialdom.ts`（`systemPrompt`）；Modify `src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes 已通用化的 `scenarioUsesFlags`/`flagVocab`/`buildTurnMessages`（usesFlags 时注入【当前印记】【官阶封顶】+ 词表）。**不改 prompt.ts**。Produces officialdom systemPrompt 含官阶封顶 + 文字狱暴毙极稀指导。

- [ ] **Step 1: 写失败测试** — 在 `officialdom.test.ts` 追加：

```ts
import { buildTurnMessages } from '../engine/prompt'

describe('officialdom AI 模式', () => {
  it('加 ceilingUnlocks+flag 后提示注入官阶印记/封顶/词表', () => {
    const st = initState(officialdom, officialdom.openings!.find((o) => o.name === '世家子弟'), undefined, 'ai')
    const sys = buildTurnMessages(officialdom, st).find((m) => m.role === 'system')!.content
    expect(sys).toContain('印记')
    expect(sys).toContain('封顶')
    for (const f of ['知府', '封疆', '九卿', '阁老']) expect(sys).toContain(f)
    // 隐藏 tone 经词表注入（骤擢入阁 不在 systemPrompt 文本，证明 hiddenTones 注入生效）
    expect(sys).toContain('骤擢入阁')
  })
  it('systemPrompt 含官阶封顶规则与文字狱极稀指导', () => {
    expect(officialdom.systemPrompt).toContain('官阶')
    expect(officialdom.systemPrompt).toContain('文字狱')
  })
  it('提示不含「共 undefined」与「第 24 年」', () => {
    const st = initState(officialdom, officialdom.openings![0], undefined, 'ai')
    const msgs = buildTurnMessages(officialdom, st).map((m) => m.content).join('\n')
    expect(msgs).not.toContain('undefined')
    expect(msgs).not.toContain('第 24 年')
  })
})
```

- [ ] **Step 2: 跑红** — `npx vitest run src/scenarios/officialdom.test.ts -t "AI 模式"` → 词表条已自动绿（Task2/6 落地后），systemPrompt 条 FAIL（尚无官阶/文字狱段）。

- [ ] **Step 3: 实现** — 在 officialdom `systemPrompt` 末尾追加规则行（保留原有规则）：
```
- 官场有品级之别：权势（power）有「封顶」，到顶须真升迁（京察卓异、军功、廷推、简拔）方破；让玩家晋阶时，在 JSON 里 flagsSet:["下一官阶"]，官阶印记只能取 知府→封疆→九卿→阁老，须按此序、不得越级
- 当前官阶与封顶见【官阶封顶】，未晋阶前权势增益会被压在当前上限，不要凭空越级
- 文字狱、廷杖、站队倾覆等无视一切的横祸极其凶险，仅在真正万劫不复处偶用 endTone 令本年即终局；天威难测，绝大多数年份不应出现
```

- [ ] **Step 4: 跑绿** — `npx vitest run src/scenarios/officialdom.test.ts` → PASS；`npx tsc --noEmit` → 0。

- [ ] **Step 5: Commit** — `feat(officialdom): AI模式systemPrompt补官阶封顶+文字狱极稀（印记/词表自动注入）`

---

## Task 8: 平衡 sim 守门 + 全量回归（44 年长跑）

**Files:** Modify（按需微调）`src/scenarios/officialdom.ts`（圣眷 decay、升迁 requires/weight/minTurn、apex/endTone 权重）；Modify（若数值调动断言）`src/scenarios/officialdom.test.ts`

**Interfaces:** Consumes 已通用的 `scripts/sim-balance.ts`（`npx vite-node scripts/sim-balance.ts officialdom 5000`：真死亡/坏结局/活到满期/登顶/最高境界/收场分布/结局Top）。Produces 达标的平衡数值。

- [ ] **Step 1: 跑 sim 基线** — `npx vite-node scripts/sim-balance.ts officialdom 5000`，记录三策略。

- [ ] **Step 2: 对照目标微调**（spec §9）：
  - **44 年可活**：survive 活到满期（reachedMax 不应 ~0；圣眷 decay 调到「主动经营可维持」——若 survive reachedMax 偏低则把 favor decay 1→适当或调升迁/事件的 favor 回补）。
  - **apex（出将入相+权倾朝野）稀有**：乱点/greedy 登顶极低；survive 登顶个位数%且来自真攀爬（不强求 0）。若 survive 登顶过高（>~15%）或非攀爬所得，收紧末阶升迁 requires（如 入阁拜相 favor 阈值抬高）。
  - **真死亡非零**：favor<=0 抄家 + 文字狱/站队 endTone 计入；random 死亡合理（≤~60%）。
  - **坏结局够**（抄家/削籍/潦倒/蹉跎）。
  - **P(收场<10)≈0**（random/survive；巅峰已 maxTurns 门控）；greedy 早死残余按 wuxia 同理接受。
  - **乱点止步低官阶**（无印记/知府）；阁老 个位数%。
  - **升迁闸门 reach 合理**（知府/封疆/九卿 达成率不应 ~0）。
  小步、单改单跑。**不改印记链结构与巅峰 maxTurns 门控**。
- [ ] **Step 3: 控制器亲验** — 控制器（非 agent）重跑 `npx vite-node scripts/sim-balance.ts officialdom 5000`，确认达标，sim block 贴入报告。
- [ ] **Step 4: 全量回归** — `npx vitest run` 全绿（数值若调同步断言）；`npx tsc --noEmit` 0；`npx vite-node scripts/sim-balance.ts all 1000`（确认未连带影响其它题材）。
- [ ] **Step 5: Commit** — `fix(officialdom): 重 sim 守平衡（44年可活/apex攀爬稀有/死亡合理/坏结局够），记录最终 sim`

---

## Self-Review

- **Spec coverage**：§0 长度=Task1；§1 官阶封顶=Task2；§3 身份=Task3；§2 升迁+重铺=Task4；§4 apex 改 maxTurns=Task5；§5 隐藏 endTone=Task6；§6 AI=Task7；§7 平衡=Task8。全覆盖。
- **Placeholder 扫描**：Task3/4(Step4)/6 要求实现者先 Read 既有事件再按精确模式改（合并 requires / 重铺 minTurn / outcomes 转换）——给了精确规则与样例，非占位；4 个升迁事件给完整对象。无 TBD/TODO。
- **Type 一致**：官阶印记 `知府/封疆/九卿/阁老` 跨 Task2（ceilingUnlocks）、Task4（flagsSet）、Task7（systemPrompt/词表）一致；哨兵 `favor<=-1` 跨 Task6 一致；致死/天堂 tone 字符串跨 Task6（结局 + endTone outcome）一致；巅峰 tone 跨 Task5 一致。事件 summary（夺嫡选边/文字狱主审/帝王密旨/内廷阴影/孤立被构陷 等）均为 officialdom.ts 现存。
- **顺序依赖**：Task1（长度）→ Task2（封顶）→ Task4（升迁抬封顶，依赖 maxTurns 定 minTurn）；Task5 依赖 Task1（maxTurns）；Task3/6 相对独立；Task7 依赖 Task2+Task6（词表）；Task8 最后守门。按 1→2→3→4→5→6→7→8 执行。
- **范围**：单题材、纯内容、零引擎改动；sim 遍历全开局可选（Task8 沿用 openings[0]）。

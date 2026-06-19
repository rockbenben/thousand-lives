# 谍战「孤岛谍影」机缘体系 设计（spec）

> 第 8 个题材。立意：1940 上海孤岛的深度潜伏——**情报功勋是脊（mission-achievement），潜伏掩护+组织信任是双死亡线（敌方暴露 / 自己人清除），抉择在二者间跷跷板**。前进式（功勋只进不退），区别于三国 volatility。

## 现状（spy.ts，~700 行）
- 3 属性：`cover 潜伏掩护`(init65, deathBelow0, **decay3** 重, 暴露处决死亡线; bands 身份将破/行迹可疑/掩护尚稳/天衣无缝)、`intel 情报功勋`(init15, 非死亡, **使命成就轴**; bands 寸功未立/略有建树/功勋卓著/居功至伟)、`trust 组织信任`(init45, deathBelow0, 被自己人当叛徒清除死亡线; bands 疑为内奸/受人猜忌/信任尚存/心腹股肱)。
- 3 开局：潜伏特工 / 双面间谍 / 觉醒的伪职——**均无 flag**。
- **无** ceilingUnlocks/tierLabel/flags/flagsClear/endTone。turnUnit **月**，maxTurns **24**。
- ~60 个 localEvents（谍报奇功/道德两难/脱险危机；keyMoment：电车盘查/同志被捕/七十六号传唤/受命掌组；itemsGained 良民证/密写药水/微型相机/手枪）。
- ~23 个结局：cover<=0(身份暴露)/trust<=0(被疑内奸暗巷清除) 双死亡 + intel>=96/80/70 的功成结局 + 双线张力结局（intel>=70&trust<=30 功高遭忌 等）。

## 设计总览

### 1. 进阶脊梁：情报功勋阶梯（挂 `intel` ceilingUnlocks，只进不退）
潜伏者的功勋随一次次谍报奇功累积；未立功则功勋卡在低位（intel init=15=base，寸功未立）。
```
intel: { initial:15, max:100,
  ceiling: 15,                      // base = initial（寸功未立，首功之前攒不起功勋）
  ceilingUnlocks: [
    { flag:'立功', max:50 },          // 站稳并立下首功
    { flag:'建功', max:75 },          // 成为组织骨干、屡有建树
    { flag:'奇功', max:90 },          // 打入核心、屡建奇功
    { flag:'殊勋', max:100 },         // 居功至伟、足以左右战局
  ] }
```
- tierLabel = **功勋**。AI【晋阶之序】叙述「本剧功勋依次为：立功→建功→奇功→殊勋」。
- **只进不退**（无 flagsClear；潜伏的凶险由 cover/trust 双死亡线承担，不叠 volatility）。
- base15=init：首功（立功印记）前 intel 卡 15，早期小情报被 clampEffects 压在 15——「寸功未立，攒不起拿得出手的功勋」。

### 2. 四道升功勋闸门（keyMoment + flagsSet，改造既有谍报奇功事件，has(prev) 串链）
授印记的是各事件的**「奇功」支**（intel 大增益）；另一支只周旋、不晋功。
| 印记 | 改造既有事件 | 新增门控 `requires` | 授印记的选项 |
|---|---|---|---|
| **立功** | `舞厅套话`(minTurn4) | （无；first gate，+keyMoment）| 「步步引话，套取布防」(intel+12)→ flagsSet:['立功'] |
| **建功** | `策反译电员`(minTurn8,本就 cover>=50) | `has(立功) & cover>=50`（+keyMoment）| 「动之以情…徐图策反」(intel+14)→ flagsSet:['建功'] |
| **奇功** | `日侨名册`(minTurn9) | `has(建功)`（+keyMoment）| 「通宵比对，挖出潜藏暗桩」(intel+12)→ flagsSet:['奇功'] |
| **殊勋** | `密电草稿`(minTurn10) | `has(奇功)`（+keyMoment）| 「冒险去敌机要室盗取密码本」(intel+12)→ flagsSet:['殊勋'] |
- 同回合即时生效（applyChoice 先 flags 再 clamp）。has(prev) 串链保证顺序。
- **sim 杠杆**：若闸门晋功支被策略极少选中致登顶≈0，改两支都授印记。

### 3. 双死亡线 seesaw（谍战独特点）
`cover`(decay3，敌方暴露处决) **与** `trust`(被自己人当叛徒清除) 双线可致死——抉择常跷跷板（为取信敌营须做有损组织信任之事；为表忠诚又 risk 暴露）。decay：cover decay3 保留（深度潜伏的快速消蚀），trust decay 留 sim 定。

### 4. 三开局身份印记 + 三身份事件（新增，不删既有）
| 开局 | flag | 新增身份事件主题 |
|---|---|---|
| 潜伏特工 | `潜伏特工` | 孤悬无援、上不接天——孤身决断 vs 苦候上线指令 |
| 双面间谍 | `双面间谍` | 两边都用都防——真心几近迷失（演到入戏 vs 守住本心）|
| 觉醒的伪职 | `觉醒伪职` | 身在伪职、手握门路如履薄冰——利用职权递情报 vs 自保藏拙 |

### 5. 隐藏 endTone 哨兵（`trust<=-1`，忠诚/背叛是谍战道德轴；2 地狱 + 1 天堂）
新增 3 结局 `condition:'trust<=-1'`（trust floors 0、永不自然触发；仅 endTone 强制）。
| 基调 | 性质 | 宿主事件·新增/改造支 | 权重(survive:哨兵) |
|---|---|---|---|
| **卖国求荣·遗臭万年** | 地狱 | `七十六号传唤` **新增**「献情报投靠七十六号」支(outcomes)| 4:1 |
| **卖友求生·血债难偿** | 地狱 | `同志被捕` **新增**「供出接头点与同志，换自己脱身」支(outcomes)| 4:1 |
| **策反成功·扭转乾坤** | 天堂 | `策反探长`「小心结交，验过真伪再用」支改 outcomes | 4:1（稀有）|
- 两地狱的「叛变/卖友」新增支用 outcomes：**survive 支＝背叛得逞但 trust 暴跌**（cover+、trust 大减，多半随即触发 trust<=0「被疑内奸·暗巷清除」死）；**endTone 支＝直接堕入叛徒结局**。4:1 使哨兵稀有（避免 random 一选即坠——废土教训）。
- 哨兵均用 `trust`。测试：每个哨兵基调被某事件 outcomes.endTone 引用。

### 6. apex 靠 ceiling 自动门控（不改结局条件）
功勋印记锁 intel ceiling，故高情报结局**自动**隐式需对应印记：不世奇功(intel>=96)/功勋盖世(intel>=96)⟺有殊勋；隐蔽战线(intel>=80)⟺有奇功；功勋彪炳/潜伏不败(intel>=70)⟺有建功。不立功者 intel 封顶低、只能落「寸功难立/潜伏不败/全身而退」类结局。只进不退，intel 高 ⟺ 已抵该印记，**无需在结局加 has() 兜底**。

### 7. AI 注入 & systemPrompt
- 加 `tierLabel:'功勋'` → prompt.ts【晋阶之序】自动用本剧术语 + 功勋印记序（prompt.ts 已通用，不动）。
- systemPrompt 补：功勋分立功→建功→奇功→殊勋、唯重大谍报奇功方能晋阶；潜伏掩护与组织信任是悬于头顶的双刃（取信敌营常损组织信任，反之亦然），抉择须在二者间权衡；真叛变投敌、出卖同志或不流血策反敌酋的极端抉择可触发隐藏结局。**不讲数值/封顶**。

### 8. sim-balance
跑 `npx vite-node scripts/sim-balance.ts spy 5000`。校准：双死亡率健康（暴露+清除+endTone 致死）；登顶（奇功/殊勋+高 intel）random 稀有但 survive/greedy 可达；据此定 `trust` decay 与（必要时）闸门是否双支授印记、哨兵权重。**收尾跑全量 `npx vitest run`（spy 加 flags 后若有引擎测试引用它作无flag样本会红，参废土教训 F）+ `npx tsc --noEmit`。**

## 不做（YAGNI）
- 不加功勋 flagsClear/倒退（前进式）。
- 不重写既有 ~60 事件/~23 结局文案；只做最小机缘叠加 + 2 地狱哨兵的新增背叛支。
- 不动 maxTurns(24)/cover decay3（深度潜伏快速消蚀，合适）。

## ★复用教训（务必遵守）
带 `outcomes`/`endTone` 的**选项本身**必须写 `effects: {}`（local.ts magOf 读 c.effects，缺则 sim 崩）；每个 outcome 分支（含纯 endTone 分支）也必须有 `effects: {}`（缺则 tsc TS2741，vitest 不报）；endTone 分支补 `reaction`。**收尾必跑 `npx tsc --noEmit` 与全量 `npx vitest run`**（spy 铺机缘可能打破引用它的引擎测试 fixture）。新增事件/身份事件前先 grep summary 防撞名。测试 import 仅取实际用到的。

## 实现顺序（plan ~6 任务）
1. 情报功勋 ceilingUnlocks（+测）→ 2. 三开局 flag + 三身份事件（+测）→ 3. 四升功勋闸门改造串链（+测）→ 4. 三隐藏 endTone 哨兵（2新增背叛支+1改造，+测）→ 5. tierLabel + systemPrompt + AI 注入测 → 6. trust decay 与 sim 校准（+全量回归+tsc）。

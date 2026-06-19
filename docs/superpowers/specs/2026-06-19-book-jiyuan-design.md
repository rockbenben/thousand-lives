# 穿书「穿书逆袭」机缘体系 设计（spec）

> 第 9 个题材（**收官**）。立意：穿成炮灰配角，靠**改写关键剧情节点**挣脱既定死签。脊梁＝剧情偏离度（plot），前进式（只进不退）。妙处：**偏离越高→主角光环越弱→修正力越难抹杀你**，故「改写剧情」既是进阶、也是活路；但每次改写都损 safety（修正力反扑）——这是穿书区别于其它题材的核心张力。

## 现状（book.ts，~690 行；export 名 `bookTransmigration`，id `'book'`）
- 3 属性：`plot 剧情偏离度`(init10, 非死亡, 偏离/改写轴; bands 循原著25/生变数60/改天换地100)、`favor 主角好感`(init20, deathBelow0, 跌为死敌→追杀死亡线)、`safety 安全值`(init60, deathBelow0, **decay2**, 被剧情修正力抹杀死亡线)。
- 3 开局：恶毒女配 / 反派之女 / 陪嫁婢女——**均无 flag**。
- **无** ceilingUnlocks/tierLabel/flags/flagsClear/endTone。turnUnit **章**，maxTurns **30**。
- ~60 个 localEvents（几乎每个都是「改写剧情(plot+)」vs「循原著(plot-/safety+)」抉择；keyMoment：宫宴落水/反派密谈/储位之争/宫变前夜/新君登基；itemsGained 一名忠心的眼线）。
- ~24 个结局：favor<=0(主角死敌)/safety<=0(被修正抹杀) 双死亡 + plot>=98/85/40 的偏离/改写结局 + favor/safety 各路结局。

## 设计总览

### 1. 进阶脊梁：剧情偏离阶梯（挂 `plot` ceilingUnlocks，只进不退）
炮灰靠改写关键节点一步步挣脱死签；不改写则偏离卡 10（循原著=注定领盒饭）。
```
plot: { initial:10, max:100,
  ceiling: 10,                      // base = initial（循原著，未改写真节点前偏离卡 10）
  ceilingUnlocks: [
    { flag:'撬动', max:30 },          // 撬动第一个原著死结
    { flag:'生变', max:60 },          // 主线生出变数
    { flag:'颠覆', max:85 },          // 颠覆原著走向
    { flag:'改天', max:100 },         // 改天换地、剧本作废
  ] }
```
- tierLabel = **偏离**。AI【晋阶之序】叙述「本剧偏离依次为：撬动→生变→颠覆→改天」。
- **只进不退**（无 flagsClear；穿书的凶险由 favor/safety 双死亡线承担）。
- base10=init：撬动印记（首个真改写）前 plot 卡 10，早期小偏离被 clampEffects 压在 10——「小打小闹改不了剧情，唯有改写关键节点方能撬开命运」。

### 2. 四道升偏离闸门（keyMoment + flagsSet，改造既有剧情节点，has(prev) 串链）
授印记的是各事件的**「改写剧情」支**（plot+）；「循原著」支只苟安、不晋偏离。
| 印记 | 改造既有事件 | 新增门控 `requires` | 授印记的选项 |
|---|---|---|---|
| **撬动** | `宫宴落水`(keyMoment,once,minTurn1) | （无；first gate）| 「反其道行之，当众救下女主」(plot+12)→ flagsSet:['撬动'] |
| **生变** | `反派密谈`(keyMoment) | `has(撬动)` | 「阳奉阴违，暗中给反派使绊」(plot+14)→ flagsSet:['生变'] |
| **颠覆** | `储位之争`(keyMoment,once,minTurn10) | `has(生变)` | 「押注太子，倾力相助」(plot+12)→ flagsSet:['颠覆'] |
| **改天** | `宫变前夜`(keyMoment,once,minTurn24) | `has(颠覆)` | 「先发制人，连夜布局逼宫」(plot+14)→ flagsSet:['改天'] |
- 同回合即时生效（applyChoice 先 flags 再 clamp）。has(prev) 串链保证顺序。
- 改写支均带 safety 负增益（修正力反扑），体现「偏离损安全」的张力——但 plot+ 为正，故「同回合破上限」测试用宫宴落水(plot+12)成立。
- **sim 杠杆**：若闸门改写支被策略极少选中致登顶≈0，改两支都授印记。

### 3. 双死亡线（穿书独特点）
`favor`(跌为死敌→主角阵营追杀) **与** `safety`(decay2，被剧情修正力抹杀) 双线可致死。核心：**每次改写剧情(plot+)都损 safety**（如宫宴落水救女主 safety-8、反派密谈使绊 safety-12）——偏离得越狠越接近活路(削主角光环)，也越招修正力雷霆。decay：safety decay2 保留，favor decay 留 sim 定。

### 4. 三开局身份印记 + 三身份事件（新增，不删既有）
| 开局 | flag | 新增身份事件主题（皆「演人设苟安(循原著) vs 反其道撬命(偏离)」）|
|---|---|---|
| 恶毒女配 | `恶毒女配` | 又一桩「该使坏」的戏码——照人设演下去(贴近死签) vs 反做善事撬人设 |
| 反派之女 | `反派之女` | 父族又递差事——随父族走到黑(绑死沉船) vs 暗中另留一手挪开半步 |
| 陪嫁婢女 | `陪嫁婢女` | 卑微近身瞧见端倪——安做透明背景 vs 借近身之便暗中插手改剧情 |

### 5. 隐藏 endTone 哨兵（`safety<=-1`，命运/存在轴；1 天堂 + 2 地狱）
新增 3 结局 `condition:'safety<=-1'`（safety floors 0、永不自然触发；仅 endTone 强制）。
| 基调 | 性质 | 宿主事件·支 | 权重(survive:哨兵) |
|---|---|---|---|
| **窥破天机·归返现世** | 天堂 | `世界濒临崩解`「顺势而为，将原著彻底掀翻」(把书掀至崩解竟震碎书界、梦醒回现实——穿书者终极梦想)| 4:1（稀有）|
| **夺运噬主·堕为新煞** | 地狱 | `主角翻脸`「反咬一口，揭主角的隐秘旧事」(绝境夺主角气运取而代之，反成世界要碾碎的新煞)| 4:1 |
| **鸠占凤巢·反噬其身** | 地狱 | `女主示好` **新增**「将计就计，取而代之」(借女主信任除之篡位，女主所有劫难尽转到你头上)| 4:1 |
- 三哨兵均用 `safety`。世界濒临崩解 requires plot>=70（天堂归返须深度偏离方可达，立意贴合）；主角翻脸 requires favor<=12（绝境黑化）。测试：每哨兵被某事件 endTone 引用。

### 6. apex 靠 ceiling 自动门控（不改结局条件）
偏离印记锁 plot ceiling，故高偏离结局**自动**隐式需对应印记：天翻地覆(plot>=98)⟺改天；彻底改写·改天换地(plot>=85)⟺颠覆(85);偏离原著(plot>=40/70)⟺生变/颠覆。不改写者 plot 封顶 10、只能落「随波逐流·泯然炮灰/安分守己」类结局——「不改剧情＝照原著当炮灰」，符合立意。

### 7. AI 注入 & systemPrompt
- 加 `tierLabel:'偏离'` → prompt.ts【晋阶之序】自动用本剧术语 + 偏离印记序（prompt.ts 已通用，不动）。
- systemPrompt 补：偏离分撬动→生变→颠覆→改天、唯改写关键剧情节点方能晋阶（偏离越高主角光环越弱、修正力越难碾你）；但每次改写都损安全值（修正力反扑），抉择须权衡；夺主角气运、篡女主之位等极端僭越或把书彻底掀翻的孤注，皆可能触发隐藏结局。**不讲数值/封顶**。

### 8. sim-balance
跑 `npx vite-node scripts/sim-balance.ts book 5000`。校准：双死亡率健康（追杀+抹杀+endTone 致死）；偏离登顶（颠覆/改天+高 plot 改写结局）random 稀有但 survive/greedy 可达；据此定 `favor` decay 与（必要时）闸门是否双支授印记、哨兵权重。**收尾跑全量 `npx vitest run`（book 加 flag 后若有引擎测试引用它作无flag样本会红——废土教训F；prompt.test 现用 book 作「无flag样本」，加 flag 后必红，须改回别的无机缘题材或更新断言）+ `npx tsc --noEmit`。**

## ★关键风险（务必处理）：book 现被引擎测试当「无 flag 样本」
废土期把 prompt.test.ts 的无flag样本从 wasteland 改成了 `book`。本题材给 book 铺机缘(flag/tierLabel)后，`scenarioUsesFlags(book)` 变真、prompt 会含晋阶段，**那两条断言必红**。Task 8 收尾须把该 fixture 改回唯一仍无机缘的题材——届时 9 题材全有机缘，**已无「无flag」内置题材**：改用一个**手造的最小无flag scenario 对象**（或断言改为「带 flag 题材为真」用 xian/book）。spec 实现顺序里单列此修复。

## 不做（YAGNI）
- 不加偏离 flagsClear/倒退（前进式）。
- 不重写既有 ~60 事件/~24 结局文案；只做最小机缘叠加 + 女主示好的新增篡位支。
- 不动 maxTurns(30)/safety decay2。

## ★复用教训（务必遵守）
带 `outcomes`/`endTone` 的**选项本身**必须写 `effects: {}`；每个 outcome 分支（含纯 endTone 分支）也必须有 `effects: {}`（缺则 tsc TS2741）；endTone 分支补 `reaction`。**收尾必跑 `npx tsc --noEmit` 与全量 `npx vitest run`**。新增事件/身份事件前先 grep summary 防撞名。测试 import 仅取实际用到的。注意 export 名是 `bookTransmigration`（不是 `book`）。

## 实现顺序（plan ~6 任务 + fixture 修复）
1. 剧情偏离 ceilingUnlocks（+测）→ 2. 三开局 flag + 三身份事件（+测）→ 3. 四升偏离闸门改造串链（+测）→ 4. 三隐藏 endTone 哨兵（1新增篡位支+2改造，+测）→ 5. tierLabel + systemPrompt + AI 注入测 → 6. favor decay 与 sim 校准 + **修复 prompt.test 的 book 无flag-fixture（改手造最小无flag对象）** + 全量回归 + tsc。

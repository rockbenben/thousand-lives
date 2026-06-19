# 千世书 · 梨园机缘体系（wuxia 技艺阶梯 + officialdom 攀爬式 apex）

日期：2026-06-19
状态：设计已确认（climb-based apex 无赌命；tierLabel=名位；保持软上限 30），待写实现计划
前置：L1 引擎 + xian/wuxia/officialdom 机缘（含 prompt.ts tierLabel/晋阶之序 通用化）均已合入 main。本期是「全题材完整版」rollout 的**第 3 个题材**（顺序：武侠✓→官场✓→梨园→三国→科幻→航海→废土→谍战→穿书）。

## 1. 目标与背景

把已验证的机缘体系移植到 `liyuan`（梨园浮梦，民国梨园伶人），主题化为戏曲名位晋升。

`liyuan` 现状与 wuxia 同构：~70 localEvents、22 结局、3 属性带 bands、3 开局、8 个既有 keyMoment，但缺机缘结构——技艺 12→100 自由涨、无封顶；开局无 flag；apex（`art>=96 & fame>=70` 一代宗师·开宗立派、`art>=96`、`fame>=96`）是被动阈值。

**属性映射（已确认）**：
- **技艺（art）**：非死亡进取属性 → **承载名位封顶阶梯**（对应 wuxia 武功 / xian 修为）。
- **安稳（safety）**：死亡/生存赛跑属性（`deathBelow:0, decayPerTurn:2`，伶人乱世人身/生计安危）→ 对应 wuxia 性命。`safety<=0` = 流落凄凉/横死。
- **声名（fame）**：名望 standing（`deathBelow:0`，`fame<=0` = 身败名裂）→ 对应 wuxia 侠名。

**关键设计（已确认）**：
- **apex 走 climb（不走渡劫赌命）**：成「一代名角/泰斗」是三十年技艺与声名的积累终点，非二元生死赌（同 officialdom 拜相）。3 个 passive 巅峰结局改 `maxTurns &` 门控，稀有性来自攀爬难度。**survive 登顶不强求 0**。
- **长度保持软上限 `maxTurns:30`**（「三十年粉墨春秋」，不改）。
- **tierLabel: '名位'**；名位印记四个、按序：`搭班`→`挑梁`→`名伶`→`泰斗`，不得越级。

**非目标**：引擎能力改动（全用 L1 现成 + 已通用的 prompt.ts/sim-balance.ts）；其他题材；重写既有结局/事件文案（除条件改动、retrofit 字段、新增升艺事件外，沿用现有叙事）。

## 2. §1 技艺名位封顶阶梯（art）

给 `art` 加 `ceiling` + `ceilingUnlocks`，4 个名位印记，门槛对齐现有 band：

| 印记（flag） | art ceiling | 语义 band |
|---|---|---|
| 无（坐科学徒） | 20 | 初学乍练 |
| `搭班` | 45 | 小有功底（入班搭戏） |
| `挑梁` | 70 | 台柱之才（挑梁担纲） |
| `名伶` | 90 | 名角风范（唱红成名） |
| `泰斗` | 100 | 一代宗师（开宗立派） |

```ts
{ key: 'art', name: '技艺', initial: 12, max: 100, ceiling: 20,
  ceilingUnlocks: [
    { flag: '搭班', max: 45 },
    { flag: '挑梁', max: 70 },
    { flag: '名伶', max: 90 },
    { flag: '泰斗', max: 100 },
  ],
  bands: [ /* 保持原样 */ ] }
```

技艺到顶须真升艺（flagsSet 名位印记）方破。`safety`、`fame` 不加 ceiling/ceilingUnlocks。bands 保持不变。

## 3. §2 升艺机缘（keyMoment + flagsSet 授名位印记）

新建 4 个专属升艺事件（同 officialdom 做法：既有 唱对台戏/压箱绝活/堂会受辱 是两难/风险事件，留作攒技艺/声名来源；专属升艺事件作闸门，技艺纯熟+机缘到时晋一阶）。各 `keyMoment:true, once:true, weight:3`，「登台/拜师/成名」选项授 `flagsSet:['下一名位']` + 技艺冲新上限，按 搭班→挑梁→名伶→泰斗 串链。窗口含足够 key 回合（keyMomentTurns(30)）。

| 名位印记 | 新建事件（暂名） | requires（起点，sim 调） | minTurn |
|---|---|---|---|
| `搭班` | 出科搭班 | `art>=16`（接近 20） | 早期 4 |
| `挑梁` | 挑梁担纲 | `has(搭班) & art>=42 & fame>=35` | 中期 10 |
| `名伶` | 唱红名动 | `has(挑梁) & art>=66 & fame>=55` | 中后 18 |
| `泰斗` | 开宗立派 | `has(名伶) & art>=88 & fame>=70` | 晚期 24 |

实现要点：4 个新建事件给完整对象（登台/受艺选项授印记 + 技艺增益达新上限，辞/稳选项不授）；升艺多要付代价（苦功伤安稳、得罪人损声名），使纯避险者攀爬受阻（apex 稀有来源，替代赌命）。既有「技艺/堂会」事件保持普通 effects。

## 4. §3 apex（climb，不走赌命）

3 个被动「巅峰」结局改 `maxTurns &` 门控（避免中途白嫖，作三十年落幕封顶结局，同 wuxia fame>=96 / officialdom 巅峰修法）：
- `一代宗师·开宗立派`：`art>=96 & fame>=70` → `maxTurns & art>=96 & fame>=70`
- `art>=96` 那条（技高名薄的孤高结局）→ `maxTurns & art>=96`
- `fame>=96` 那条（红透半边天）→ `maxTurns & fame>=96`
- 其余 `maxTurns & …` 善终结局与负面/死亡结局（`safety<=0` 流落、`fame<=0` 身败、`safety<=6` 等）**保持不变**（伶人原生倾覆，可中途触发）。

apex 稀有由攀爬难度保证：爬到 `泰斗` 印记 + 三十年守住声名安稳，天然极少；乱点/早死/纯避险者绝无可能登顶。**唱对台戏保留为高风险事件**（打对台败→声名/安稳重挫或 endTone 横死），但只是凶险事件之一，**非 apex 闸门**。

## 5. §4 身份印记 + 身份弧

3 开局加 flag（戏班学徒/落魄世家小姐/票友下海），gate 身份专属事件（合并既有 requires 不覆盖）：
- **落魄世家小姐**：家族反对/门第包袱/书卷傲骨类事件 → `has(落魄世家小姐)`。
- **票友下海**：人脉广/票友捧场/根基浅被同行轻视类 → `has(票友下海)`。
- **戏班学徒**：坐科血汗/师门恩义/无依无靠类 → `has(戏班学徒)`（至少 1-2 个专属）。
- 通用事件（堂会/军阀/报馆/对台通用面）不加身份 gate。

## 6. §5 隐藏 endTone（梨园横祸 + 际遇天堂）

给若干既有凶险事件（督军堂会/堂会受辱/唱对台戏/得罪权贵）的「逞强/犯险」选项加极稀致死 `endTone`（minTurn≥8，无视数值即时终局），新增 2 致死 + 1 天堂结局（均哨兵 `safety<=-1`，safety deathBelow 0 永不自然成立，仅由 endTone 触发；AI 词表 hiddenTones 自动收录）：
- `开罪权贵·横死乱世`（致死）：触怒军阀/恶霸/捧角狂徒的犯险选项低权 outcome。
- `名节尽毁·封箱绝迹`（致死/社死）：被报馆构陷或卷入丑闻的激进选项。
- `一夜爆红·伶界天骄`（天堂，际遇一步登天，极稀，minTurn 晚）：对极冒险者的稀有正向回报（一炮而红/灌片传世）。

数量克制：2 致死 + 1 天堂，权重极低（常态~12 : 致死1；天堂~20 : 1），暴毙稀有不滥用。沿用既有叙事改写。

## 7. §6 AI 模式镜像

`liyuan` 加 ceilingUnlocks + opening flag 后 `scenarioUsesFlags` 自动 = true，AI 提示**自动**注入【当前印记】【晋阶之序】+ flagsSet/endTone 契约 + 词表（名位印记 = ceilingUnlocks flags 搭班/挑梁/名伶/泰斗；隐藏 tone = endings 中 `condition==='safety<=-1'` 的 tone）。**prompt.ts 已通用化，无需再改**。

需：① 加 `tierLabel: '名位'`（晋阶之序读「本剧名位依次为：搭班→挑梁→名伶→泰斗」）；② `liyuan systemPrompt` 补名位晋阶（技艺到顶须真升艺→flagsSet 名位印记，按 搭班→挑梁→名伶→泰斗 顺序、不越级）+ 梨园横祸暴毙极稀。

## 8. §7 平衡（sim 守门）

`scripts/sim-balance.ts` 已通用。运行 `npx vite-node scripts/sim-balance.ts liyuan 5000`，目标：
- **apex（一代宗师+技高/名盛巅峰）稀有**：乱点/greedy 登顶低；survive 登顶个位数%且来自真攀爬（不强求 0）。
- **安稳衰减下可活到落幕**：survive 能活到 maxTurns（reachedMax 不应 ~0）；安稳 decay 调到主动经营可维持。
- **真死亡非零**：safety<=0 流落 + 横祸 endTone 计入；random 死亡合理（乱世凶险，≤~60%）。
- **坏结局够**（身败/流落/潦倒/默默无闻），给继续玩动力。
- **P(收场<10)≈0**（random/survive；巅峰已 maxTurns 门控）；greedy 早死残余按 wuxia/officialdom 同理接受。
- **乱点多止步低名位**（无印记/搭班）；泰斗 个位数%。
- **升艺闸门 reach 合理**（搭班/挑梁/名伶 达成率不应 ~0）。
调节杠杆：安稳 decay、升艺 requires/weight/minTurn、apex 阈值、endTone 权重。小步调，**控制器亲验**。

## 9. 触点文件

- `src/scenarios/liyuan.ts`：技艺加 ceiling/ceilingUnlocks（§2）；加 tierLabel '名位'（§7）；3 开局加 flag（§5）；4 新建升艺事件 keyMoment+flagsSet+requires 串链（§3）；身份事件 has() gate（§5）；3 个 passive 巅峰结局改 maxTurns（§4）；新增 2 致死+1 天堂哨兵结局 + 凶险 endTone outcomes（§6）；systemPrompt 补段（§7）。
- `src/scenarios/liyuan.test.ts`（新建）：技艺名位封顶 clamp、4 印记顺序链、巅峰须 maxTurns、身份 gate、隐藏 endTone 触发、AI 晋阶之序+名位词表、所有结局可解析、致死 endTone minTurn 合规、merged-cond 守护。
- `scripts/sim-balance.ts`：沿用（已通用）。

## 10. 成功标准

- 技艺名位封顶生效（无印记卡 20，须 flagsSet 印记方破）；4 印记按序、各有 keyMoment 升艺机缘；
- apex 由攀爬保证稀有（乱点/greedy 低、survive 个位数且非白嫖）；3 巅峰结局只在落幕触发；
- 安稳衰减下可活到落幕；身份弧成立；隐藏横祸暴毙稀有不滥用；
- AI 自动注入名位印记/晋阶之序/词表（tierLabel=名位），systemPrompt 含名位规则、无串味、无「共 undefined」；
- 全量 `vitest` + `tsc --noEmit` 绿；sim 守门达标（控制器亲验）。

## 11. 风险

- **apex 无赌命如何保稀**：靠攀爬难度 + 升艺担代价 + maxTurns 门控。若 sim 显示 survive 白嫖（登顶过高/非攀爬所得），收紧末阶升艺 requires（如泰斗需 fame 更高）。
- **安稳 decay 平衡**：decay 2 over 30 年；太高人人早死、太低无张力。sim 重点调。
- **新建 4 升艺事件须写戏曲味叙事**：plan 给完整对象 + 文案样例。
- **retrofit 既有事件易遗漏/串味**：加字段非重写，逐事件小改 + 测试/sim 兜底。
- **升艺 minTurn 与 key 回合**：keyMoment 升艺须落在每 4 回合 key 回合且窗口含足够 key 回合，sim 暴露 reach 率骤降时放宽。

## 12. 测试策略

- 单测：技艺名位封顶 clamp（无印记冲 90 卡 20）；4 印记顺序链；3 巅峰须 maxTurns（满血高 art 非落幕不触发）；身份 gate（has/!has）；隐藏 endTone 三态触发；AI 晋阶之序含名位序 + 隐藏 tone；merged-cond 守护。
- sim 守门：apex 稀有（乱点/greedy 低、survive 非白嫖）、安稳衰减可活、死亡合理、坏结局够、P(<10)≈0、乱点止步低名位、升艺 reach 合理。控制器亲验。
- 守护：结局可解析、致死 endTone minTurn 合规、`tsc` 绿。

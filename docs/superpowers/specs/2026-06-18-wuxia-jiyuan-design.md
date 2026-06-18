# 千世书 · 武侠机缘体系（xian 模板移植到江湖）

日期：2026-06-18
状态：设计已确认（保持软上限 30 年；完整版 7 支柱移植），待写实现计划
前置：L1 引擎 + xian 全栈（L2a/b/c + L1-followups + C 渡劫）均已合入 main。本期是「全题材完整版」rollout 的**第 1 个题材**（构建顺序：武侠→官场→梨园→三国→科幻→航海→废土→谍战→穿书）。

## 1. 目标与背景

把 xian 旗舰已验证的机缘体系（境界封顶 + 突破印记 + 身份弧 + 因果种子 + 隐藏 endTone + keyMoment 抉择 + C 式赌命 apex + AI 模式镜像）**完整移植**到 `wuxia`（快意江湖），主题化为江湖武学境界。

`wuxia` 现状：内容已极丰富（~90 个 localEvents、~24 个结局、武功 5 段 band），但缺机缘结构——武功 12→100 自由涨、无封顶；3 开局无 flag；apex「武林至尊·一代宗师」是被动阈值 `gongfu>=96 & fame>=70`（即 xian C 之前的老问题：避死的完美生存者迟早白嫖登顶）。本期补齐结构。

**关键差异（相对 xian，已确认）**：
- **长度**：保持作者隐藏软上限 `maxTurns=30`（「三十年江湖路」是题材之魂，~20 个 maxTurns 结局不重写）。**非**涌现。
- **性命不设境界封顶**：性命是战斗血量+岁月损耗，不是修为续命；硬 30 年上限下无寿元赛跑。只有武功有阶梯。

**非目标**：引擎能力改动（全用 L1 现成 ceiling/ceilingUnlocks/outcomes/endTone/keyMoment/flags）；其他题材（各自独立循环）；重写既有结局/事件文案（除 apex 两结局的 condition 改哨兵、retrofit 事件加字段外，沿用现有叙事）。

## 2. §1 境界封顶阶梯（武功）

给 `gongfu` 属性加 `ceiling` + `ceilingUnlocks`，4 个境界印记，门槛对齐现有 band：

| 印记（flag） | gongfu ceiling | 语义 band |
|---|---|---|
| 无（三流） | 30 | 三脚猫/小有身手 |
| `入流` | 50 | 跨入高手之列 |
| `一流` | 70 | 一流高手 |
| `绝顶` | 88 | 绝顶高手 |
| `宗师` | 100 | 一代宗师 |

```ts
// wuxia.ts 武功属性
{ key: 'gongfu', name: '武功', initial: 12, max: 100, ceiling: 30,
  ceilingUnlocks: [
    { flag: '入流', max: 50 },
    { flag: '一流', max: 70 },
    { flag: '绝顶', max: 88 },
    { flag: '宗师', max: 100 },
  ],
  bands: [...保持不变...] }
```

引擎 `effectiveCeiling` 取「已解锁印记里的最高 max」，`clampEffects` 已会强制——武功到顶必须真突破（flagsSet 下一印记）方能再进。无印记封顶 30，撞墙感由此产生。bands（含 directive）保持原样，与境界并存（band 是叙事提示，ceiling 是硬封顶）。

## 3. §2 性命不设境界封顶

`life`（性命）保持现状：`initial:70, max:100, deathBelow:0, decayPerTurn:1`，**不加** ceiling/ceilingUnlocks。理由见 §1 关键差异。`fame`（侠名）亦不加封顶（它是侠名/口碑，deathBelow 0 已是公敌死线）。**只有 gongfu 有阶梯**。

## 4. §3 突破机缘（keyMoment + flagsSet 授印记）

把 4 个既有「突破味」事件 retrofit 成 4 道境界闸门：各加 `keyMoment: true`、`requires: has(前一印记) & gongfu>=接近当前上限`、突破选项的 outcome/effects 加 `flagsSet:['下一印记']` + 大幅 gongfu 增益（足以冲到新上限）。窗口（minTurn/maxTurn）须含足够 key 回合（每 4 年一个里程碑：年 4/8/12/16/20/24/28）。

| 境界印记 | retrofit 事件（候选） | requires | 窗口（minTurn） |
|---|---|---|---|
| `入流` | `秘籍到手`(once,minTurn9) 或 `街头拳师` | `gongfu>=26`（接近 30） | 早期，含年 4/8/12 |
| `一流` | `闭关参悟`(minTurn18) 或 `内功突破`(minTurn20) | `has(入流) & gongfu>=46` | 中期，含年 12/16/20 |
| `绝顶` | `重剑无锋`(minTurn13) 或 `残谱补全`(minTurn19) | `has(一流) & gongfu>=66` | 中后期，含年 16/20/24 |
| `宗师` | = §5 apex 闸门事件 | `has(绝顶) & gongfu>=85` | 晚期，含年 24/28 |

实现要点：
- retrofit 时保留事件原叙事，仅给突破选项加 `flagsSet` + 调大 gongfu 增益（达新上限）；非突破选项不授印记。
- 若选中的候选事件 `minTurn` 与窗口 key 回合不匹配（key 回合太少难触发），适度放宽该事件 minTurn/加 maxTurn 或改选另一候选。**实现期按 sim 实际触发率定**，不在 spec 锁死具体哪个事件——但 4 道闸门必须各有一个 `keyMoment + flagsSet` 事件落地，且按 入流→一流→绝顶→宗师 顺序、靠 requires 串成链。
- 其余既有「内功/秘籍」事件（高人指点/名宿授功/古墓壁谱/扫地老僧/神雕授艺等）保持普通 effects（不授印记），作为攒武功、逼近下一道闸门的常规增长源。

## 5. §4 身份印记 + 身份弧

给 3 开局加 flag，gate 身份专属事件：

```ts
openings: [
  { name: '市井孤儿', flag: '市井孤儿', prompt: '...' },
  { name: '名门弟子', flag: '名门弟子', prompt: '...' },
  { name: '灭门遗孤', flag: '灭门遗孤', prompt: '...' },
]
```

- **名门弟子**：`名门收徒`/`师兄刁难`/`师门蒙冤` 加 `requires: has(名门弟子)`（已假设「初入师门」，本就该身份专属）。
- **灭门遗孤**：`残谱现世`/`残谱补全`/`血仇真相`/`仇人现身`/`仇敌临终` 串成复仇弧——`残谱现世`(once,minTurn1) 加 `requires: has(灭门遗孤)`；复仇弧后段（血仇真相/仇人现身）加 `requires: has(灭门遗孤) & ...`。
- **市井孤儿**：偷师/江湖底层味事件（街头拳师/破庙佛肚藏经等）可加 `requires: !has(名门弟子)` 或 `has(市井孤儿)` 倾斜；至少 1-2 个市井专属机缘。
- 通用事件（山道劫匪/黑店惊魂/以武会友等）不加身份 gate，三身份共享。

身份 gate 用 L1 condition 语言 `has(X)`/`!has(X)`，已支持。

## 6. §5 C 式 apex 赌命（保一代宗师极稀）

**两个 apex 结局 condition 改哨兵 `life<=-1`**（性命 clamp 在 [0,max]，永不自然成立），tone/epilogue 不变：
- `武林至尊·一代宗师`：`gongfu>=96 & fame>=70` → `life<=-1`
- `武功盖世·终成独夫`：`gongfu>=96` → `life<=-1`

此后这两个 apex **只能由 apex 事件的 endTone 触发**，不再被动达标。（其余 maxTurns 阈值结局——功成名就/侠之大者/名满天下等——**保持不变**，它们是善终而非「武学化境登顶」，不属 apex 哨兵。）

**新增/改造 apex 闸门 keyMoment 事件**「华山论剑·问鼎天下第一」（或复用 `泰山论剑`/`五绝论剑`/`巅峰对决` 之一改造）：
- `requires: 'has(绝顶) & gongfu>=85'`、`keyMoment: true`、`once: true`、晚 minTurn（≥25，宗师通常此后才到）。
- 同时这是 §3 的 `宗师` 闸门：成功登顶分支也授 `flagsSet:['宗师']`（虽即终局，但语义完整 + AI 词表一致）。
- 三选项（权重起点，sim 调）：
  1. **「全力一搏·冲击武学化境」**（裸冲，最险）outcomes（纯加权随机分支——L1 outcome 不能读属性，故成功态不按 fame 条件分流，与 xian 飞升/跳出三界同理）：`endTone:'武林至尊·一代宗师'`（成功登顶，权重较高的善果）/ `endTone:'武功盖世·终成独夫'`（另一成功态，孤独登顶）/ `endTone:'走火入魔·经脉俱断'`（死，占比不小）。至尊/独夫的「侠名高低」之别由两段 epilogue 文案承载，是叙事差异、非机制门槛。起点权重：至尊 2、独夫 1、走火入魔 4（sim 调）。
  2. **「借天时地利·稳中冲关」**（耗底蕴换胜算）outcomes：同三态，死亡权重低、成功权重高（如 成功 4、走火入魔 2）；可叠加 life/物品代价 effects 体现「耗尽心血」。
  3. **「急流勇退·不强一搏」**（安全）effects 小代价（如 `{fame:-3}` 或 `{gongfu:-2}` 体现强压未竟），**不登顶**；留在绝顶，最终走 maxTurns 善终（功成名就/武功大成·安享余年等）。
- 文案沿用/改写现有泰山/五绝论剑的论剑叙事 + 走火入魔的凶险。

净效果：apex = 必须选 1 或 2（赌命）。survive（避死）选 3 → 永不 apex → 一代宗师对谨慎玩法极稀。

新增致死结局 `走火入魔·经脉俱断`（普通结局，非哨兵，给独立 epilogue）供 endTone 命中。

## 7. §6 隐藏 endTone（走火入魔/暴毙 + 泼天奇遇）

给若干既有凶险事件的某个「逞强」选项加 `极稀` 致死 `endTone`（minTurn>=10，天威难测式无视数值即时终局）：
- `运功撞墙吐血`/`险些走火`/`引刀自宫`/`噬天魔刀`/`中毒暗算`/`苗疆蛊毒` 等——给最激进选项一个低权重 outcome `endTone:'走火入魔·经脉俱断'` 或新增 `endTone:'暗伤攻心·暴毙当场'`。
- 一个隐藏 **泼天奇遇** 天堂结局（如 `endTone:'奇遇证道·飞升武圣'` 或并入「武林至尊」），minTurn 晚、权重极低，作为对极冒险者的稀有正向回报。
- 这些隐藏结局 condition 同样设哨兵 `life<=-1`（与 apex 同列，AI 词表 hiddenTones 自动收录）。

数量克制：2-4 个致死隐藏 + 0-1 个奇遇天堂，权重极低（个位数 outcome 权重里占 1），确保暴毙稀有不滥用。

## 8. §7 AI 模式镜像

`wuxia` 加 ceilingUnlocks + opening flag 后，`scenarioUsesFlags(wuxia)` 自动 = true（L2c 已实现 `sc.openings?.some(o=>o.flag) || sc.attributes.some(a=>a.ceilingUnlocks)`），于是 AI 提示**自动**注入：【当前印记】【境界封顶】+ 契约里的 flagsSet/endTone 说明 + 词表（境界印记 = ceilingUnlocks flags 入流/一流/绝顶/宗师；隐藏 tone = endings 中 `condition==='life<=-1'` 的 tone）。**无需改 prompt.ts**。

仅需 **wuxia `systemPrompt` 补**（在现有规则上追加）：
- 江湖境界封顶：武功到顶须真机缘（秘籍/顿悟/名师/生死战）方破，破时在 JSON 里 `flagsSet:["下一境界"]`，须按 入流→一流→绝顶→宗师 顺序、不得越级；
- 走火入魔/暗伤暴毙极稀有，仅真凶险时用 endTone，绝大多数回合不出现；
- 身份贯穿（已有 opening）。

## 9. §8 平衡（sim 守门）

`scripts/sim-balance.ts` 已通用（登顶/飞升/死亡/收场分布度量都在；survive 已会跳过 lethal-endTone 选项）。运行 `npx vite-node scripts/sim-balance.ts wuxia 5000`，目标：
- **apex（武林至尊+武功盖世·终成独夫）对所有策略稀有**，尤其 survive 避论剑 → 近 0；
- **真死亡非零且论剑/走火入魔贡献明显**，random 死亡 ≤~55%；
- 坏结局（公敌/油尽灯枯/碌碌半生等）占比够，给「想继续玩」的动力；
- **P(收场<10)=0** 三策略（apex/突破闸门 minTurn 晚，天然不早）；
- 乱点多止步低境界（无印记/入流），登顶/宗师 个位数%。
- 突破闸门未因 keyMoment 门控而崩（入流/一流/绝顶 reach 率合理，不应骤降到 ~0）。
apex outcome 权重 + 闸门 requires/窗口据此微调，小步调。**控制器亲验最终 sim 数字**（不信任 agent 自报）。

## 10. 触点文件

- `src/scenarios/wuxia.ts`：武功加 ceiling/ceilingUnlocks（§2）；3 开局加 flag（§5）；4 突破事件 retrofit keyMoment+flagsSet+requires（§4）；身份事件加 has() gate（§5）；两 apex 结局 condition 改哨兵 + 新增走火入魔致死结局（§6）；apex 闸门事件改造（§6）；隐藏 endTone outcomes（§7）；systemPrompt 补段（§8）。
- `src/scenarios/wuxia.test.ts`（若不存在则新建）：境界封顶 clamp、4 印记顺序链、apex 哨兵不自然触发 + 仅 endTone 触发、身份 gate、AI 词表派生、所有结局 condition 可解析、致死/apex 闸门 minTurn 合规。
- `scripts/sim-balance.ts`：沿用（度量已在）。
- `src/scenarios/invariants.test.ts`：若有跨题材守护断言（结局可解析、A2 死线豁免 `life<=-1` 哨兵），按 xian 同款方式让 wuxia 通过。

## 11. 成功标准

- 武功境界封顶生效（无印记卡 30，须 flagsSet 印记方破）；4 印记按序、各有 keyMoment 机缘；
- apex 对所有策略稀有（survive 登顶大幅下降）、一代宗师极稀，走火入魔死亡计入；P(<10)=0；
- 身份弧成立（名门/遗孤/孤儿各有专属事件链）；隐藏暴毙稀有不滥用；
- AI 模式自动注入印记/境界封顶/词表，systemPrompt 含江湖境界封顶规则，无「共 undefined 载」（wuxia 有 maxTurns，本就写「共 30 载」，无此 bug，但回归确认）；
- 全量 `vitest` + `tsc --noEmit` 绿；sim 守门达标（控制器亲验）。

## 12. 风险

- **retrofit 既有 90 事件易遗漏/串味**：身份 gate 与突破 flagsSet 是「加字段」非重写，逐事件小改；测试 + sim 兜底。
- **apex odds 调参**：论剑三态权重须 sim 校到 apex 稀有但可达、死亡合理。小步调。
- **既有 apex 测试**（若有断言 `gongfu>=96` 被动登顶）：改哨兵后会红 → 同步更新为「被动不触发、仅 endTone 登顶」，不删测逃避。
- **闸门 minTurn 与 key 回合错配**：keyMoment 事件只在每 4 年的 key 回合被抽中，窗口须含足够 key 回合，否则突破难触发——sim 守门会暴露（reach 率骤降），届时放宽窗口。
- **性命无封顶 vs 战斗血量**：确认 life 不被误加 ceilingUnlocks；30 年硬上限下寿元赛跑不存在。

## 13. 测试策略

- 单测：境界封顶 clamp（无印记 gongfu 冲 90 被卡 30）；4 印记顺序链（缺前序印记拿不到后序闸门）；apex 哨兵不自然触发 + 三选项 endTone 三态对应结局；身份 gate（has/!has）；AI 词表派生（4 境界印记 + 隐藏 tone 入提示）。
- sim 守门：apex 稀有（含 survive）、死亡合理、坏结局够、P(<10)=0、乱点止步低境界、闸门 reach 率合理。控制器亲验 sim 数字。
- 守护：结局可解析、致死/apex 闸门 minTurn 合规、`tsc` 绿。

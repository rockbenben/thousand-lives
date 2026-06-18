# 千世书 · 官场机缘体系（xian/wuxia 模板移植 + 70岁荣休长度扩展）

日期：2026-06-19
状态：设计已确认（70岁荣休扩到 maxTurns≈44；apex 不走渡劫赌命，改官阶攀爬+晚节封顶），待写实现计划
前置：L1 引擎 + xian 全栈 + wuxia 机缘（含 prompt.ts/sim-balance.ts 通用化）均已合入 main。本期是「全题材完整版」rollout 的**第 2 个题材**（顺序：武侠✓→官场→梨园→三国→科幻→航海→废土→谍战→穿书）。

## 1. 目标与背景

把已验证的机缘体系（官阶封顶 + 升迁印记 + 身份弧 + 因果种子 + 隐藏 endTone + keyMoment 抉择 + AI 镜像）移植到 `officialdom`（宦海浮沉），主题化为明代官场的品级升迁。

`officialdom` 现状与 wuxia 同构：~1684 行、~70 localEvents、~24 结局、3 属性带 bands、3 开局、~8 个既有 keyMoment（初任知县/京察大计/督师平乱/夺嫡选边/弹劾首辅 等），但缺机缘结构——权势 30→100 自由涨、无封顶；开局无 flag；apex（出将入相 `name>=96 & power>=70`、权倾朝野 `power>=96`）是被动阈值。

**属性映射（已确认）**：
- **圣眷（favor）**：死亡/生存赛跑属性（`deathBelow:0, decayPerTurn:2`），对应 xian 寿元 / wuxia 性命。`favor<=0` = 抄家问斩。
- **权势（power）**：非死亡进取属性 → **承载官阶封顶阶梯**（对应 xian 修为 / wuxia 武功）。
- **官声（name）**：清议/民望 standing（对应 道心/侠名），**不设封顶**。

**两处关键差异（相对 wuxia，已确认）**：
1. **长度扩到 70岁荣休**：`maxTurns: 24 → 44`（进士~26岁 → 70岁荣休），连带 圣眷 decay 与事件 minTurn 重铺（见 §2）。
2. **apex 不走 C 式渡劫赌命**：入阁拜相是「长期攀爬的终点」而非二元生死赌；改为「爬到阁老印记 + 晚节守住高位 → 荣休封顶结局」，稀有性来自 44 年攀爬本身（见 §6）。**不引入 xian/wuxia 的 sentinel+迎劫 apex 闸门**。

**非目标**：引擎能力改动（全用 L1 现成 ceiling/ceilingUnlocks/outcomes/endTone/keyMoment/flags）；其他题材；重写既有结局/事件文案（除条件改动、retrofit 字段外，沿用现有叙事）。

## 2. §0 长度扩展（70岁荣休）

- **`maxTurns: 24 → 44`**。`turnUnit` 仍「年」。
- **圣眷 decay `2 → 1`**：44 年 ×2=-88 必死；降到 1（满程 -44，配合主动经营可活到荣休）。最终值由 sim 调（§7），起点 1。
- **事件 minTurn 重铺**：现有里程碑事件 minTurn 集中在 1-24，须按 44 年重铺，避免后半程（25-44）无戏：早期任官/京察 1-12、中期党争/外放/灾政 12-28、晚期储位/夺嫡/入阁 28-44。**实现期逐事件调 minTurn**（plan 给映射），保证「时局逐年升级」延展到 44 年。
- **systemPrompt 修**：现「临近第 24 年时…」改为「临近晚年（第 40 年后）/荣休之年…」，去掉硬编 24。
- **maxTurns 善终结局**：~24 个 `maxTurns & …` 结局**条件不变**（其 epilogue 多为致仕/荣休/配享太庙，正合 70 岁，已核无硬编年数）。

## 3. §1 官阶封顶阶梯（权势 power）

给 `power` 加 `ceiling` + `ceilingUnlocks`，4 个官阶印记按品级：

| 印记（flag） | power ceiling | 语义 |
|---|---|---|
| 无（七品入仕） | 30 | 知县/科道言官 |
| `知府` | 50 | 五品亲民正官 |
| `封疆` | 70 | 三品督抚（一方封疆） |
| `九卿` | 85 | 二品部院堂官 |
| `阁老` | 100 | 一品内阁辅臣 |

```ts
{ key: 'power', name: '权势', initial: 30, max: 100, ceiling: 30,
  ceilingUnlocks: [
    { flag: '知府', max: 50 },
    { flag: '封疆', max: 70 },
    { flag: '九卿', max: 85 },
    { flag: '阁老', max: 100 },
  ],
  bands: [ /* 保持原样 */ ] }
```

权势到顶须真升迁（flagsSet 官阶印记）方破。`favor`、`name` 不加 ceiling/ceilingUnlocks（圣眷是死亡赛跑、官声是 standing）。bands 保持不变。

## 4. §2 升迁机缘（keyMoment + flagsSet 授官阶印记）

retrofit 既有「升迁味」事件为 4 道升迁闸门：各加 `keyMoment:true`、`requires: has(前阶) & <圣眷或官声/政绩阈值>`、升迁选项 outcome/effects 加 `flagsSet:['下一官阶']` + 权势冲新上限。窗口（minTurn）须含足够 key 回合（keyMomentTurns(44)），按 知府→封疆→九卿→阁老 串链。

| 官阶印记 | retrofit 候选事件 | requires（起点，sim 调） | 窗口 minTurn |
|---|---|---|---|
| `知府` | 初任知县 / 京察大计 | `power>=26`（接近 30）`& favor>=30` | 早期 4-14 |
| `封疆` | 督师平乱 / 京察风波 | `has(知府) & power>=46 & favor>=35` | 中期 14-26 |
| `九卿` | 考成积弊 / 廷议 | `has(封疆) & power>=66 & name>=40` | 中后 24-36 |
| `阁老` | 弹劾首辅 / 储位暗潮 | `has(九卿) & power>=82 & favor>=50` | 晚期 32-44 |

实现要点：retrofit 保留原叙事，仅给升迁选项加 `flagsSet` + 调大 power 增益（达新上限），非升迁选项不授印记；4 道闸门各须一个 keyMoment+flagsSet 事件、按序串链。其余「政绩/党援」事件保持普通 effects（攒权势、逼近下一闸门）。**升迁多要付政治资本/担风险**（如督师平乱有性命/圣眷代价），使纯避险者攀爬受阻——这是官场 apex 稀有的主要来源（替代渡劫赌命，见 §6）。

## 5. §3 身份印记 + 身份弧

```ts
openings: [
  { name: '寒门进士', flag: '寒门进士', prompt: '...' },
  { name: '世家子弟', flag: '世家子弟', prompt: '...' },
  { name: '内廷养子', flag: '内廷养子', prompt: '...' },
]
```

gate 身份专属事件（用 `has(X)`/`!has(X)`，合并既有 requires 不覆盖）：
- **世家子弟**：门第党援/门生故旧/门户包袱类事件 → `has(世家子弟)`。
- **内廷养子**：阉党门路/司礼监奥援/被清流弹劾「幸进」类 → `has(内廷养子)`。
- **寒门进士**：孤臣无援/清流自守/科甲同年类 → `has(寒门进士)`（至少 1-2 个专属）。
- 通用事件（灾荒/边患/京察通用面）不加身份 gate。

## 6. §4 apex（取消渡劫赌命，改官阶攀爬 + 晚节封顶）

**核心修订**：官场 apex 不走 xian/wuxia 的 sentinel + 迎劫闸门。入阁拜相是长期攀爬的终点：

1. **四个被动「巅峰」结局改 `maxTurns &` 门控**（避免中途白嫖秒收场，作荣休封顶结局；同 wuxia `fame>=96` 老年结局修法）：
   - `出将入相·名垂青史`：`name>=96 & power>=70` → `maxTurns & name>=96 & power>=70`
   - `权倾朝野·一手遮天`：`power>=96` → `maxTurns & power>=96`
   - `万民称颂·青天再世`：`name>=96` → `maxTurns & name>=96`
   - `简在帝心·恩宠无两`：`favor>=96` → `maxTurns & favor>=96`
   - 其余 `maxTurns & …` 善终结局与负面/死亡结局（`favor<=0` 抄家、`name<=4` 削籍）**保持不变**（抄家/削籍是官场原生倾覆，可中途触发）。
2. **apex 稀有由攀爬难度保证**：`maxTurns & power>=96`（权倾朝野）须爬到 `阁老` 印记（ceiling 100）；`maxTurns & name>=96 & power>=70` 须 `封疆`+ 且 44 年守住高官声——走完 4 道升迁 + 在圣眷衰减下活到荣休 + 同撑高官声/权势，天然极少。**升迁链要担政治风险**（§2），乱点/早死/纯避险者绝无可能登顶。
3. **官场 apex 可被「老练谨慎、活满 44 年、爬到阁老」者达成**——这是合理的「修成正果」，**不强求 survive→0**（与 xian「飞升须极稀」不同）。sim 只需保证：乱点(random)/greedy 登顶极低、survive 登顶为个位数%且非轻易（不是白嫖）。
4. **倾覆/死亡走官场原生 + 分散 endTone**（见 §5）：圣眷<=0 抄家（渐进），加挂在直谏/夺嫡/诏狱具体凶险选项上的极稀 endTone。**夺嫡选边保留为高风险事件**（站错队→巨损圣眷或 endTone 死），但只是诸多凶险 keyMoment 之一，**非 apex 闸门**。

## 7. §5 隐藏 endTone（文字狱/廷杖暴毙 + 际遇天堂）

给若干既有凶险事件（冒死直谏/夺情/诏狱/夺嫡站队）的「逞强」选项加极稀致死 `endTone`（minTurn≥12，无视数值即时终局），新增 2 致死 + 1 天堂结局（均哨兵 `favor<=-1`，favor deathBelow 0 永不自然成立，仅由 endTone 触发；AI 词表 hiddenTones 自动收录）：
- `文字狱·瘐死诏狱`（致死）：触挂直谏/著述/结党类激进选项。
- `站队倾覆·满门抄斩`（致死）：夺嫡站错队的低权 outcome。
- `简在帝心·骤擢入阁`（天堂，际遇一步登天，极稀，minTurn 晚）：对极冒险者的稀有正向回报。

数量克制：2-3 致死 + 0-1 天堂，权重极低（常态~12 : 致死1；天堂~20 : 1），暴毙稀有不滥用。沿用既有叙事改写。

## 8. §6 AI 模式镜像

`officialdom` 加 ceilingUnlocks + opening flag 后，`scenarioUsesFlags` 自动 = true，AI 提示**自动**注入【当前印记】【官阶封顶】+ flagsSet/endTone 契约 + 词表（官阶印记=ceilingUnlocks flags 知府/封疆/九卿/阁老；隐藏 tone = endings 中 `condition==='favor<=-1'` 的 tone）。**prompt.ts 已在 wuxia 期通用化，无需再改**。

仅需 **officialdom `systemPrompt` 补**：官阶封顶（权势到顶须真升迁→flagsSet 官阶印记，按 知府→封疆→九卿→阁老 顺序、不越级）；文字狱/廷杖暴毙极稀（仅真凶险用 endTone）；并把硬编「第 24 年」改「晚年/荣休之年」（§2）。

## 9. §7 平衡（sim 守门）

`scripts/sim-balance.ts` 已通用（realmLadder/sentinelTones/diedAny/结局Top 跨题材）。运行 `npx vite-node scripts/sim-balance.ts officialdom 5000`，目标：
- **44 年长跑可活**：survive 能活到荣休（reachedMax 不应~0）；圣眷 decay 调到「主动经营可维持、躺平必失势」。
- **apex（出将入相+权倾朝野）稀有**：乱点/greedy 登顶极低；survive 登顶个位数%且来自真攀爬（非白嫖）——不强求 0。
- **真死亡非零**：圣眷<=0 抄家 + 文字狱/站队 endTone 计入；random 死亡合理（官场凶险，可较高但 ≤~60%）。
- **坏结局够**（抄家/削籍/潦倒致仕/蹉跎），给继续玩的动力。
- **P(收场<10)≈0**（random/survive；早期无 apex/巅峰秒收场——已靠 §6 maxTurns 门控）；greedy 若有早死残余按 wuxia 同理接受（鲁莽政争致死）。
- **乱点多止步低官阶**（无印记/知府）；阁老 个位数%。
- **升迁闸门 reach 合理**（知府/封疆/九卿 达成率不应~0）。
调节杠杆：圣眷 decay、升迁 requires/weight/minTurn、apex 阈值、endTone 权重。小步调，**控制器亲验 sim 数字**。

## 10. 触点文件

- `src/scenarios/officialdom.ts`：maxTurns 24→44（§2）；圣眷 decay 2→1（§2）；权势加 ceiling/ceilingUnlocks（§3）；3 开局加 flag（§5）；4 升迁事件 retrofit keyMoment+flagsSet+requires + minTurn 重铺（§4）；身份事件 has() gate（§5）；4 个 passive 巅峰结局改 maxTurns（§6）；新增 2 致死+1 天堂哨兵结局 + 凶险 endTone outcomes（§7）；systemPrompt 补段 + 去「第24年」硬编（§8）。
- `src/scenarios/officialdom.test.ts`（新建）：官阶封顶 clamp、4 印记顺序链、巅峰结局须 maxTurns（不中途触发）、身份 gate、隐藏 endTone 触发、AI 词表派生、所有结局可解析、致死 endTone minTurn 合规。
- `scripts/sim-balance.ts`：沿用（已通用）。
- `src/scenarios/invariants.test.ts`：若跨题材守护对新哨兵结局/maxTurns 改动报错则按 wuxia 同款处理（预期不需要）。

## 11. 成功标准

- 权势官阶封顶生效（无印记卡 30，须 flagsSet 印记方破）；4 印记按序、各有 keyMoment 升迁机缘；
- 44 年长跑可玩（survive 活到荣休、圣眷可维持）；
- apex 由攀爬保证稀有（乱点/greedy 极低、survive 个位数且非白嫖）；4 巅峰结局只在荣休触发；
- 身份弧成立；隐藏文字狱/站队暴毙稀有不滥用；
- AI 自动注入官阶印记/封顶/词表，systemPrompt 含官阶规则、无「第24年」硬编、无「共 undefined」；
- 全量 `vitest` + `tsc --noEmit` 绿；sim 守门达标（控制器亲验）。

## 12. 风险

- **长度扩展工作量**：maxTurns 24→44 牵动 圣眷 decay、事件 minTurn 重铺、巅峰结局门控——比纯 retrofit 大。逐项小改 + sim 兜底。
- **圣眷 decay 平衡**：44 年下 decay 太高则人人早死、太低则生存无张力。sim 重点调。
- **apex 无渡劫如何保稀**：靠攀爬难度 + 升迁担风险 + maxTurns 门控。若 sim 显示 survive 白嫖（登顶过高/非攀爬所得），收紧末阶升迁 requires（如阁老需 favor 更高）。
- **retrofit 既有 ~70 事件易遗漏/串味**：加字段非重写，逐事件小改 + 测试/sim 兜底。
- **事件 minTurn 重铺错配**：keyMoment 升迁须落在 key 回合且窗口含足够 key 回合，sim 暴露 reach 率骤降时放宽。

## 13. 测试策略

- 单测：权势官阶封顶 clamp（无印记冲 90 卡 30）；4 印记顺序链（缺前阶拿不到后阶）；4 巅峰结局须 maxTurns（满血高 power 非荣休年不触发）；身份 gate（has/!has）；隐藏 endTone 三态触发；AI 词表派生（4 官阶印记 + 隐藏 tone 入提示）。
- sim 守门：apex 稀有（乱点/greedy 极低、survive 非白嫖）、44 年可活、死亡合理、坏结局够、P(<10)≈0、乱点止步低阶、升迁 reach 合理。控制器亲验。
- 守护：结局可解析、致死 endTone minTurn 合规、`tsc` 绿。

# 千世书 · 三国机缘体系（以主公势力兴衰为脊，阶梯可升可跌 + 改投）

日期：2026-06-19
状态：设计已确认（争霸为核、势力阶梯可升可跌、改换门庭；tierLabel=势力；加主公信任 decay；软上限 30），待写实现计划
前置：L1 引擎 + xian/wuxia/officialdom/liyuan 机缘（含 prompt.ts tierLabel/晋阶之序 通用化）均已合入 main。本期是「全题材完整版」rollout 的**第 4 个题材**（顺序：武侠✓→官场✓→梨园✓→三国→科幻→航海→废土→谍战→穿书）。

## 1. 目标与背景

`sanguo`（乱世谋臣）现状：~70 localEvents、22 结局、3 属性带 bands、3 开局、8 个既有 keyMoment。但旧 sim 显示它是**最平淡的题材**（random 真死亡 0%、坏结局 5.8%）——正是「坏结局太少、缺乏继续玩的动力」问题的典型。

**关键重构（已确认）**：三国是**乱世争霸**，不是个人单线练级。谋士之命系于其主公在逐鹿天下中的兴衰——绝世之才辅一必败之主照样身死族灭；站对队的庸才也能开国封侯。故机缘体系**以「主公势力的兴衰」为脊梁**，而非个人「谋阶」线性升级。

**属性映射（已确认）**：
- **谋略（wit）**：你的本事（争霸事件成败的乘数）；其**施展上限由势力阶段决定**（承载 ceilingUnlocks，但解锁 flag = 主公的争霸阶段，见 §2）。
- **主公信任（trust）**：死亡/生存线（`deathBelow:0`），加 `decayPerTurn`（伴君如伴虎，见 §7）。`trust<=0` = 见弃问罪、身死狱中。
- **声望（repute）**：天下名望 standing（`deathBelow:0`，`repute<=0` = 身败族诛）；高声望令诸侯争揽、改投更易。

**与其余题材最大的不同**：势力阶梯**可升可跌**（主公大败 → flagsClear 掉一阶）、且可**改换门庭**（主公败亡 → 改投强主，清空势力阶段、保留谋略声望）。别题材印记只升；三国随主公沉浮。

**长度**：保持软上限 `maxTurns:30`（「三十年风云」，不改）。

**非目标**：引擎能力改动（全用 L1 现成 ceiling/ceilingUnlocks/outcomes/endTone/keyMoment/flags/flagsClear/`has`/`!has` + 已通用的 prompt.ts/sim-balance.ts）；其他题材；重写既有结局/事件文案（除条件改动、新增事件外，沿用现有叙事）。

## 2. §1 势力阶段阶梯（谋略 ceilingUnlocks，flag=主公争霸阶段）

你纵有经天纬地之才，主公只据一隅也施展不开。给 `wit` 加 `ceiling` + `ceilingUnlocks`，4 个**势力印记**（解锁谋略施展上限）：

| 势力印记（flag） | wit ceiling | 局面 |
|---|---|---|
| 无（初投寒微之主） | 30 | 群雄逐鹿、立足未稳 |
| `据州` | 45 | 主公据一州之地 |
| `称雄` | 70 | 割据称雄一方 |
| `鼎足` | 88 | 三分鼎立之一 |
| `霸业` | 100 | 一统在望、成就霸业 |

```ts
{ key: 'wit', name: '谋略', initial: 30, max: 100, ceiling: 30,
  ceilingUnlocks: [
    { flag: '据州', max: 45 },
    { flag: '称雄', max: 70 },
    { flag: '鼎足', max: 88 },
    { flag: '霸业', max: 100 },
  ],
  bands: [ /* 保持原样 */ ] }
```

> **关键：base ceiling 必须 = initial 30**（不可设更低）。引擎 `clampEffects`（state.ts:88）无条件把「current+effect」截到 ceiling：若 base ceiling < 30，则开局 wit=30 一旦有任何正增益就会被**削到 ceiling**（30→20，错误）。故 base=30：无势力印记时谋略冻在 30（初露锋芒）、得 据州 方能再涨——正合「你的舞台限制你的施展，主公做大方能更进」之设定（早期 4 回合内即可触 据州 闸门）。`trust`、`repute` 不加 ceiling/ceilingUnlocks。

## 3. §2 势力升降机缘（升 flagsSet / 降 flagsClear / 改投）

势力阶段靠 keyMoment 争霸大事推进，**可升可跌**：

- **升（助主争霸）**：新建 4 个专属「争霸」keyMoment 事件——`助主据州`→`助主称雄`→`助主鼎足`→`助主霸业`。各 `keyMoment:true, once:true, weight:3`，「献定策」选项 `flagsSet:['下一势力']` + 谋略冲新上限；`requires: has(前一势力) & wit/trust 达标`，按 据州→称雄→鼎足→霸业 串链。
- **跌（主公失势）**：retrofit/新建若干「主公大败」keyMoment 事件（如官渡/赤壁式决战失利），`requires: has(某势力)`，其「败局」outcome `flagsClear:['该势力']` → 掉回前一阶（谋略不再施展到原高度；apex 须 has(霸业)，失势即失 apex 资格）。
- **改投门庭（主公败亡）**：新建 `改换门庭` keyMoment（`requires: has(据州)`，即已有基业可失），三选项：①殉主（`endTone` 忠烈结局）②归隐（maxTurns 善终向，不再争霸）③**改投强主**（`flagsClear:['据州','称雄','鼎足','霸业']` 清空全部势力阶段 + trust 重置到低位 effects，保留谋略/声望，从头辅佐新主）。

引擎支持：`flagsSet`/`flagsClear` 均可在 choice/outcome 上；条件语言 `has(X)`/`!has(X)` 已支持。

## 4. §3 择主（开局后早期 keyMoment + 轻量主公弧）

新建 `择主投效` 早期 keyMoment（minTurn 2-4）：投**强主**（信任难得、势大根稳）/ **明主**（君臣相得、起步弱）/ **汉室正统**（声望高、危如累卵）三选项，各以 effects 体现起步差异，并 `flagsSet` 一个**主公印记**（`强主`/`明主`/`汉室`）。该主公印记仅 gate 2-3 个轻量弧事件（如 强主→功高震主之忌、汉室→忠义与现实之争），是次要色彩，不喧宾夺主（势力阶段才是脊）。

## 5. §4 apex（climb，须辅主成霸业）

3 个被动巅峰结局改 `maxTurns &` 门控，且**最高荣耀须 `has(霸业)`**（你辅佐的主公赢了争霸、你是首功）：
- `经天纬地·名相千古`：`wit>=96 & trust>=70` → `maxTurns & has(霸业) & wit>=96 & trust>=70`（**THE apex**：辅主成霸业、君臣相得、经天纬地）。
- `算无遗策·智极而孤`：`wit>=96` → `maxTurns & wit>=96`（**不要求 has(霸业)**——它天然成为「才高而主未成霸业/失势」的悲剧向结局：你有经天纬地之才，却落子无对手、所辅之主终未一统，智极而孤）。
- `海内名士·万世景仰`：`repute>=96` → `maxTurns & repute>=96`。
- 其余 `maxTurns & …` 善终结局与负面/死亡结局（`trust<=0` 见弃问罪、`repute<=0` 身败族诛、`repute<=6`、`trust<=6`）**保持不变**（争霸原生倾覆，可中途触发）。

> 妙处：谋略 ceiling 由势力解锁，wit>=96 须先有 `霸业`(ceiling 100)。若曾达 霸业(wit 冲到 96+) 后**失势/改投**(flagsClear 霸业)，wit 值仍 96 但 `has(霸业)` 已假 → 不触发 经天纬地，落到 `算无遗策·智极而孤`（才高而功业旁落）。volatility 自然落到结局。apex 稀有由「押对/扶起赢家 + 守住信任 + 活到落幕」共同保证。

## 6. §5 身份印记 + 身份弧

3 开局加 flag（寒门游学士子/世家子弟/降将谋臣），gate 身份专属事件（合并既有 requires 不覆盖）：
- **降将谋臣**：以功业洗猜忌、旧主部曲、贰臣之议类 → `has(降将谋臣)`（降将本就是「改投」弧的范例，与 §3 改投呼应）。
- **世家子弟**：门第党援、家族兴衰之托类 → `has(世家子弟)`。
- **寒门游学士子**：苦无门路、寒门晋身、清介自守类 → `has(寒门游学士子)`（至少 1-2 个专属）。
- 通用事件（征伐/盟约/天下大势）不加身份 gate。

## 7. §6 隐藏 endTone（争霸横祸 + 际遇天堂）

给若干既有凶险事件（站队/谋逆/功高震主/决战）的「犯险」选项加极稀致死 `endTone`（minTurn≥8，无视数值即时终局），新增 2 致死 + 1 天堂结局（均哨兵 `trust<=-1`，trust deathBelow 0 永不自然成立，仅由 endTone 触发；AI 词表 hiddenTones 自动收录）：
- `站错主公·身死族灭`（致死）：押错势力、卷入败亡阵营的犯险 outcome。
- `功高震主·赐死狱中`（致死）：权势震主、不知敛抑的激进 outcome。
- `一言定鼎·名动天下`（天堂，际遇一步登天，极稀，minTurn 晚）：一策定乾坤、为天下所惊（隆中对式）。

数量克制：2 致死 + 1 天堂，权重极低（常态~12:致死1；天堂~20:1），暴毙稀有不滥用。沿用既有叙事改写。

## 8. §7 主公信任 decay（治平淡）

给 `trust` 加 `decayPerTurn: 1`（注释：主公日久情疏、功高生疑，信任须主动经营——献良策、表忠、立功——维系，否则渐失宠见弃）。这给三国它现在缺的生存赛跑，把旧 sim 的 0% 死亡拉到合理。最终 decay 值由 sim 调（起点 1）。

## 9. §8 AI 模式镜像

`sanguo` 加 ceilingUnlocks + opening flag 后 `scenarioUsesFlags` 自动 = true，AI 提示**自动**注入【当前印记】【晋阶之序】+ flagsSet/endTone 契约 + 词表（势力印记 = ceilingUnlocks flags 据州/称雄/鼎足/霸业；隐藏 tone = endings 中 `condition==='trust<=-1'` 的 tone）。**prompt.ts 已通用化，无需再改**。

需：① 加 `tierLabel: '势力'`（晋阶之序读「本剧势力依次为：据州→称雄→鼎足→霸业」）；② `sanguo systemPrompt` 补：势力随主公争霸沉浮、**可进可退、主公大败会失势、可改换门庭另投强主**（叙事须体现这层 volatility，不要把势力当作只升的个人等级）；谋略须真机缘 + 主公做大方能更进；功高震主/站错主公的横祸极稀。

## 10. §9 平衡（sim 守门）

`scripts/sim-balance.ts` 已通用。运行 `npx vite-node scripts/sim-balance.ts sanguo 5000`，目标（**重点：治旧 0% 死亡**）：
- **真死亡非零且合理**：加 trust decay + 站错主公/功高震主 endTone 计入；random 死亡从旧 0% 拉到合理（乱世凶险，≤~55%）。
- **坏结局够**（见弃/身败/碌碌/貌合神离），治旧 5.8%、给继续玩的动力。
- **apex 稀有**：经天纬地须 has(霸业)；乱点/greedy 登顶低；survive 登顶个位数%且来自真攀爬+押对赢家（不强求 0）。
- **可活到落幕**：survive 能活到 maxTurns；trust decay 调到「主动经营可维持」。
- **P(收场<10)≈0**（random/survive；巅峰已 maxTurns 门控）；greedy 早死残余按 wuxia/officialdom 同理接受。
- **乱点多止步低势力**（无印记/据州）；霸业 个位数%。
- **势力升降机缘 reach 合理**（据州/称雄/鼎足 达成率不应~0）；改投/失势事件确有触发（volatility 体现）。
调节杠杆：trust decay、争霸 requires/weight/minTurn、apex 阈值、endTone 权重。小步调，**控制器亲验**。

## 11. 触点文件

- `src/scenarios/sanguo.ts`：谋略加 ceiling/ceilingUnlocks（§2）；加 tierLabel '势力'（§9）；trust 加 decayPerTurn（§8）；3 开局加 flag（§6）；新建 4 升势 + 失势 + 改投 + 择主 事件（§3/§4）；身份事件 has() gate（§6）；3 巅峰结局改 maxTurns（经天纬地 加 has(霸业)）（§5）；新增 2 致死+1 天堂哨兵结局 + 凶险 endTone outcomes（§7）；systemPrompt 补段（§9）。
- `src/scenarios/sanguo.test.ts`（新建）：谋略势力封顶 clamp、4 势力印记顺序链、**flagsClear 失势/改投降阶**、巅峰须 maxTurns（经天纬地须 has(霸业)）、身份 gate、隐藏 endTone 触发、AI 晋阶之序+势力词表、所有结局可解析、致死 endTone minTurn 合规、merged-cond 守护。
- `scripts/sim-balance.ts`：沿用（已通用）。

## 12. 成功标准

- 谋略施展上限由势力解锁（无印记卡 20，须真机缘 + 主公做大方破）；4 势力印记按序升、且**失势/改投会降阶/清空**（volatility 落地、可测）；
- apex 须辅主成霸业（经天纬地 has(霸业)）、稀有；3 巅峰只在落幕触发；失势后落 算无遗策·智极而孤（才高功业旁落）；
- **治平淡**：加 decay 后真死亡/坏结局够（旧 0%/5.8% → 合理）；
- 身份弧成立（降将=改投范例）；隐藏横祸稀有不滥用；
- AI 自动注入势力印记/晋阶之序/词表（tierLabel=势力），systemPrompt 含势力沉浮/改投规则、无串味、无「共 undefined」；
- 全量 `vitest` + `tsc --noEmit` 绿；sim 守门达标（控制器亲验）。

## 13. 风险

- **volatility 实现复杂度**：flagsClear 失势/改投是新机制（别题材没用过），须测「降阶后谋略上限回落、apex 资格丧失」。逐事件给确切 flagsSet/flagsClear；测试覆盖升与降。
- **两套 flag（身份 + 主公 + 势力）**：身份 3 + 主公 3（轻量）+ 势力 4。主公弧须克制（2-3 事件），不喧宾夺主；势力是脊。
- **apex 须 has(霸业) 是否可达**：reach 霸业 须走完 4 升势且不被失势打断。若 sim 显示 霸业/apex ~0，放宽升势 requires 或减失势权重。
- **trust decay 平衡**：太高人人见弃、太低无张力。sim 重点调。
- **新建事件多**（4 升势 + 失势 + 改投 + 择主）：须写三国味叙事；plan 给完整对象 + 样例。

## 14. 测试策略

- 单测：谋略势力封顶 clamp（无印记冲 90 卡 20）；4 势力印记顺序链；**flagsClear 测试**（构造 has(鼎足) state，取失势 outcome → 失 鼎足、谋略上限回 70；取改投 → 清空全部势力）；巅峰须 maxTurns（经天纬地须 has(霸业)；曾有霸业后清空 → wit96 落 算无遗策 而非 经天纬地）；身份 gate；隐藏 endTone 三态触发；AI 晋阶之序含势力序 + 隐藏 tone；merged-cond 守护。
- sim 守门：死亡/坏结局够（治平淡）、apex 稀有（has 霸业）、可活到落幕、P(<10)≈0、乱点止步低势力、升降/改投确有触发。控制器亲验。
- 守护：结局可解析、致死 endTone minTurn 合规、`tsc` 绿。

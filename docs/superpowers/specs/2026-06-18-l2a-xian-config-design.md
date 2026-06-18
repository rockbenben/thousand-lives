# 千世书 · L2a：xian 引擎配置 + 重平衡（机缘重构旗舰）

日期：2026-06-18
状态：设计已确认（§1-5 + 10 回合下限约束），待写实现计划
前置：L1 引擎已合入 main（flags / has() / ceiling+ceilingUnlocks / outcomes / endTone / maxTurns 可选+涌现终止）。父设计见 `2026-06-18-jiyuan-redesign-design.md`。

## 1. 目标

把 xian（缥缈仙途）从「管 3 个数字、活 30 载、必飞升」改造成「**与寿元赛跑、靠稀缺机缘层层突破、错过即卡死、飞升稀有**」的涌现长度修仙人生。本期只做 **config + 重平衡 + 4 个核心突破机缘事件 + 结局重挂**，全部基于已有的 L1 原语，**不改引擎**。

**非目标（后续 spec）**
- L2b：身份支线弧、因果种子事件、隐藏天堂地狱事件、事件池深度扩充。
- L2c：AI 回合 schema 产出 flags/endTone + systemPrompt 世界观/机制注入。
- 其他 8 个剧本的同类改造。

**约束**
- 不必向后兼容旧存档：改 xian 属性结构时可直接 bump 存档版本/丢弃旧档，不写迁移。
- **最短人生 ≥ 10 回合**：开局 10 回合内不得收场（详见 §5）。

## 2. 时间 / 寿元模型（境界决定时间尺度 + 寿数）

回合数有界，但「一回合代表多少年」随境界放大，境界大幅抬高寿元上限。成功修士活几百上千年、却仍在合理回合数内；卡关者数十年油尽。

- 寿元 = 0-100「命数/精元」（剩余生机比例），非字面年数；每回合衰减（老去）。
- 境界经 `ceilingUnlocks` 抬寿元上限，突破机缘**额外回补寿元**（续命）。
- 每回合在世时间由境界 band 决定，写进本地事件文案/（L2c）systemPrompt：炼气≈数年、筑基≈一二十年、金丹≈数十年、元婴≈一二百年、化神≈数百年。引擎只数回合（涌现终止 + 硬兜底 300）。
- 净效果：卡在炼气者一生数十年；筑基散修活二三百年；飞升者横跨千年。「30 年」只属于没走出炼气的人。

## 3. 修为境界阶梯 + 突破封顶

`cultivation`：`initial: 10`，`ceiling: 20`（炼气顶），印记逐级解锁（数值经 §5 sim 调，下为起点）：

| 印记 | 修为上限 | 寿元上限 | 突破机缘门控 |
|---|---|---|---|
| (无) 炼气 | 20 | 60 | — |
| 筑基 | 45 | 75 | `cultivation>=18 & daoHeart>=40` |
| 金丹 | 70 | 88 | `cultivation>=42 & daoHeart>=55` |
| 元婴 | 90 | 96 | `cultivation>=66 & daoHeart>=70` |
| 化神 | 100 | 100 | `cultivation>=86 & daoHeart>=80` |

schema 形态：
```
{ key:'cultivation', initial:10, max:100, ceiling:20,
  ceilingUnlocks:[{flag:'筑基',max:45},{flag:'金丹',max:70},{flag:'元婴',max:90},{flag:'化神',max:100}], bands:[...] }
{ key:'lifespan', initial:60, max:100, deathBelow:0, decayPerTurn:2,
  ceilingUnlocks:[{flag:'筑基',max:75},{flag:'金丹',max:88},{flag:'元婴',max:96},{flag:'化神',max:100}], bands:[...] }
{ key:'daoHeart', initial:50, max:100, deathBelow:0, bands:[...] }   // 不变
```

**4 个核心突破机缘事件（本期 L2a 内含）**——每个是 `keyMoment` 或低权重稀有事件，门控如上表，窗口由 `minTurn/maxTurn` 限定（错过即此生再难遇）。每个突破事件用 `outcomes` 表达成败：
- 成功分支：`flagsSet:[下一境界]`、`effects:{lifespan:+回补}`、修为小增、`reaction` 喜讯。
- 失败分支（道心不足时权重升高）：重伤（lifespan-）或走火（daoHeart-，可触 `endTone:'走火入魔·身死道消'`）。
窗口示例：筑基 `minTurn:3,maxTurn:12`；金丹 `minTurn:10,maxTurn:30`；元婴 `minTurn:25,maxTurn:60`；化神 `minTurn:45`（窗口经 sim 调）。门控 `has(前一境界)` 确保按序。

## 4. 身份印记 + 开局

3 开局写身份印记 + 各异起点（利用「不必兼容旧档」自由调）：
- 魔道余孽 `flag:'魔道'`：`cultivation` 起点偏高、`daoHeart` 偏低（如 16 / 35）；快而险。
- 仙门弟子 `flag:'仙门'`：资粮足、有靠山；均衡偏稳。
- 草根散修 `flag:'散修'`：起点最薄（如 10 / 50）；机缘更稀但自由。
（具体差值经 §5 sim 调；身份**支线事件**属 L2b。）

## 5. 结局重挂 + 平衡目标

**结局重挂（不动引擎）**：xian 去掉 `maxTurns`（涌现）；现有 `maxTurns & ...` 那批成就结局改写为「寿元将尽」阈值结局，在普通结局循环按境界高→低排序触发（循环支持复合条件 + `has()`，死亡块只认单子句故不能在 0 处分流）：
```
lifespan<=8 & has(化神) → 仙逝得道·寿尽道存
lifespan<=8 & has(元婴) → 元婴坐化·遗泽千秋
lifespan<=8 & has(金丹) → 金丹寿尽·享寿千载
lifespan<=8 & has(筑基) → 筑基老死·山中岁月
lifespan<=8            → 炼气蹉跎·泯然众生
```
飞升类（`cultivation>=96 & daoHeart>=...`）到点即触，不受寿元门控；道心链（`daoHeart<=0` 走火、`daoHeart<=6` 堕魔）沿用。寿元真到 0 = 兜底（暴毙/油尽）。

**10 回合下限（硬约束）**：开局 10 回合内不得收场。据此：
- 寿元将尽结局阈值与衰减保证纯衰减最早收场远晚于 10 回合（60 寿元、decay 2 → 寿元<=8 约第 26 回合）。
- 早期负向 lifespan/daoHeart 单事件 effect 设上限（不致 10 回合内归零）。
- 致死/暴毙类事件（含 L2b 隐藏地狱）一律 `minTurn>=10`。
- sim 验证：P(收场回合 < 10) ≈ 0。

**sim 重平衡**：扩展 `scripts/sim-balance.ts` 追踪「最高境界（看印记）/ 飞升率 / 存活回合 / 收场回合分布」。目标：
- 苟命/卡关：低境界没突破收场为常见归宿（但 ≥10 回合）。
- 会争机缘的技术流：层层突破、活得久；飞升稀有（个位数 %）。
- 死亡有真实占比；无 <10 回合收场。

## 6. 触点文件

- `src/scenarios/xian.ts`：attributes（cultivation/lifespan 的 ceiling+ceilingUnlocks、decay）、openings（flag + 起点）、endings（去 maxTurns 依赖、改寿元阈值分流）、新增 4 个突破机缘事件、去掉 `maxTurns`。
- `src/storage.ts`：bump 存档版本以作废旧的进行中存档（结构已变；不写迁移）。
- `scripts/sim-balance.ts`：追踪境界/飞升/收场回合分布。
- 可能 `src/scenarios/invariants.test.ts` / `content-integrity.test.ts`：xian 无 maxTurns 后相关不变量校验需放行（守护现有断言不误伤涌现剧本）。

## 7. 成功标准

- sim（≥2000 局/策略）：技术流飞升率个位数%、卡关「没突破」结局为被动玩法主归宿、死亡有真实占比、**P(收场<10 回合)=0**、不同身份命中不同起点轨迹。
- 一局本地试玩三身份各一，体感确认「争机缘」紧张与境界时间尺度。
- 全量 `vitest` + `tsc` 绿。

## 8. 风险

- ceiling/窗口/寿元数值需多轮 sim 才能落在「飞升稀有但可达、10 回合下限、卡关常见」三角内 → 留足调参回合。
- 突破事件窗口与现有事件池权重相互作用（稀有度）→ 用 sim 的境界达成分布校准。
- 去 maxTurns 可能触发 xian 相关测试/不变量 → 触点 §6 已列，TDD 守护。
- 存档版本 bump 必须确实作废旧 xian 档（旧档属性无 ceiling/印记会行为错乱）。

## 9. 测试策略

- 每处 config 改动有针对性单测（ceiling 解锁链、突破事件成败分支、寿元阈值结局分流、无 maxTurns 不早收场）。
- 扩展 sim 跑批，断言成功标准的量化目标。
- 守护测试：xian 仍通过 schema、所有结局条件可解析、无 maxTurns 不破坏既有不变量。

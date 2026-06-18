# 千世书 · C：渡劫飞升（apex 改为赌命抉择）

日期：2026-06-18
状态：设计已确认（两 apex 都走渡劫赌命），待写实现计划
前置：L1/L2a/L2b/L2c + L1-followups（clamp 修复、keyMoment 涌现、4 突破重标）均已合入 main。

## 1. 目标与背景

clamp 修复后，飞升(被动达标 `修为≥96 & 道心≥70`)对**涌现剧本**的完美生存者变得可白嫖(survive 飞升 ~34%)，违背「飞升极稀」。根因:飞升/跳出三界是**被动数值阈值**,无限回合的避死玩家迟早攒够。

**C 的解法**:把两个 apex 结局从「被动达标」改成「**主动渡一场九死一生的天劫**」的抉择产物。避死玩家会躲开致命渡劫 → 永不飞升 → apex 对谨慎玩法也极稀;胆大者迎劫,部分飞升/超脱、相当一部分形神俱灭。这正是修仙「飞升须渡九重天劫」的内核。**clamp 保留**(其正确性收益在,飞升稀有改由渡劫负责)。

**非目标**:其他题材;新引擎能力(全用 L1 的 endTone/outcomes/keyMoment);改动 L1-followups 已落地的内容。

## 2. §1 两 apex 结局改为 endTone-only

`xian.ts` 的两个 apex 结局,condition 改为永不自然成立的哨兵 `lifespan<=-1`(同隐藏结局,寿元 clamp 在 [0,max]),tone/epilogue 不变:
- `渡劫飞升·得道成仙`:`cultivation>=96 & daoHeart>=70` → `lifespan<=-1`
- `跳出三界·不在五行`:`has(化神) & daoHeart>=85` → `lifespan<=-1`
此后这两个结局**只能由渡天劫事件的 `endTone` 触发**,不再被动达标。

## 3. §2 渡天劫 keyMoment 抉择事件（改造现有「九重天劫」）

把 `xian.ts` 现有的 `summary:'九重天劫'` 事件(当前 `requires:'cultivation>=88'`、普通 effects)改造为 apex 唯一闸门:
- `requires: 'has(化神) & cultivation>=92'`(须达化神、近巅峰);`keyMoment: true`、`once: true`;`minTurn` 保持晚期(≥30,化神通常此后才到)。
- 三个选项:
  1. **「迎九重天劫」(裸渡,最险)** —— `outcomes` 加权:
     - `endTone:'跳出三界·不在五行'`(最稀,以无上道心炼化天劫而超脱)
     - `endTone:'渡劫飞升·得道成仙'`(中)
     - `endTone:'强渡天劫·形神俱灭'`(死,占比不小)
     起点权重(sim 调):跳出三界 1 / 飞升 3 / 形神俱灭 4。
  2. **「倾尽底蕴护道渡劫」(耗本钱换更好胜算)** —— `outcomes`:同三态,但死亡权重低、成功权重高(如 跳出三界1/飞升4/形神俱灭2);可叠加 lifespan/物品代价的 effects 体现"耗尽底蕴"。
  3. **「暂不渡劫,固守化神」(安全)** —— effects 体现强压境界的小代价(如 `{daoHeart:-4}`),**不飞升**;留在化神,继续游戏,最终寿元将尽得「仙逝得道·寿尽道存」善终。
- 文案沿用/改写现有「九重天劫」的仙气叙事。

净效果:apex = 必须选 1 或 2(赌命)。survive(避死)选 3 → 永不 apex。

## 4. §3 平衡（sim 守门）

`npx vite-node scripts/sim-balance.ts xian 5000`，目标:
- **apex(飞升+跳出三界)对所有策略稀有**(含 survive ——它会避劫;survive 登顶应从 ~36% 降到个位数甚至更低)。
- **飞升极稀有**(各策略个位数%以下;survive 可接近 0,因其避劫)。
- **P(收场<10)=0** 三策略(渡天劫 minTurn 晚,天然不早)。
- **死亡非零且渡劫贡献明显**(迎劫失败=形神俱灭),但 random ≤~55%。
- 乱点多止步低境界。
渡劫 outcomes 权重据此微调。

## 5. §4 测试

- 飞升/跳出三界 condition 现为 `lifespan<=-1`;`checkEnding` 在满血高境界下**不**自然触发它们(更新 L2a/L2b 既有的"飞升达标"断言——它们现应改为:被动条件不触发,飞升只经渡劫 endTone)。
- 渡天劫事件:`keyMoment:true`、`requires has(化神) & cultivation>=92`、`once:true`;迎劫/护道选项的 outcomes 含三个 apex/death endTone(精确字符串匹配现有 endings tone);避劫选项不带 endTone。
- 构造 has(化神)+高修为 state、取迎劫成功分支 → `st.ended.tone` 为飞升/跳出三界;取失败分支 → 形神俱灭。
- sim 守门断言(§4)。
- 守护:所有结局条件可解析;渡天劫 minTurn≥10(实际≥30)。

## 6. 触点文件
- `src/scenarios/xian.ts`:两 apex 结局 condition → 哨兵;改造「九重天劫」事件(requires/keyMoment/once + 三选项 outcomes endTone)。
- `src/scenarios/xian.test.ts`:更新飞升/跳出三界断言;加渡天劫事件与 endTone 触发测试。
- `scripts/sim-balance.ts`:沿用(登顶/飞升/死亡度量已在)。

## 7. 成功标准
- apex 对所有策略稀有(survive 登顶大幅下降);飞升极稀;渡劫死亡计入;P(<10)=0;全量 vitest + tsc 绿。
- 体感(人工/提示审查):化神后面临「赌命渡劫 or 苟着善终」的真抉择;避劫者得仙逝善终而非 apex。

## 8. 风险
- **AI 模式**:L2c 已让 AI 可 endTone;渡天劫是本地事件(AI 模式由 AI 自行编排渡劫,systemPrompt 已含"渡劫凶险")。本期聚焦本地;AI 渡劫靠 L2c systemPrompt + playtest,不在此重做。
- **既有飞升测试**:多处断言飞升被动达标,改 endTone-only 后会红 —— spec §5 已要求同步更新为真值,不可删测试逃避。
- **odds 调参**:迎劫三态权重需 sim 校到 apex 稀有但可达、死亡合理。小步调。
- 化神后若长期既不渡劫也不死,会拖长游戏 —— 寿元衰减 + 寿元将尽结局兜底(已有),不会无限。

## 9. 测试策略
- 单测:apex condition 哨兵不自然触发;渡天劫事件结构 + endTone 三态触发对应结局。
- sim 守门:apex 稀有(含 survive)、飞升极稀、死亡合理、P(<10)=0。控制器亲验 sim 数字。
- 守护:结局可解析、致死渡劫 minTurn 合规。

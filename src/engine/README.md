# engine/ — 通用 QBN 内核

这是一款 **Quality-Based Narrative（品质叙事 / storylet）** 文字人生模拟器的通用引擎。
属性 + 标志位即「品质」，`localEvents` + `requires` 即 storylet，`pickLocalEvent` 是显著性选择（salience），
`endings` 是终结 storylet。整套引擎**不内置任何具体剧本内容**，可整体复制到系列里的下一款游戏，
只需替换「游戏内容」（见下）。

## 边界规则

- `engine/` 只依赖 `scenarios/schema.ts` 里的**类型契约**（`Scenario` / `Attribute` / `LocalEvent` …），
  绝不 import 任何具体剧本数据或剧本 id。改动靠 grep 守住：
  `engine/` 内不应出现 `xian` / `sanguo` 等剧本 id 字面量。
- 「成就内容」由游戏经 `computeAchievements({ achConfig })` 注入（见 `achievements.ts` 的
  `ScenarioAchConfig`）。缺省 `achConfig` 时只生成通用阶梯成就，不生成任何剧本专属成就——
  这正是引擎对未知剧本零耦合的体现，有测试兜底（`achievements.test.ts`）。

## 通用核心（可复制）

| 文件 | 职责 |
| --- | --- |
| `state.ts` | 回合推进、`checkEnding`（显著性择优，消除遮蔽）、`reachableEndingTones` |
| `condition.ts` | 条件 DSL 解析 / 求值 + `conditionImplies`（区域子集判定） |
| `achievements.ts` | 纯函数成就推导；剧本专属内容经 `achConfig` 注入 |
| `grade.ts` `bands.ts` | 评级、属性分档 |
| `local.ts` | 免 Key 本地模式的事件 / 结局拼写 |
| `prompt.ts` `summary.ts` `keymoment.ts` | AI 提示词、结算卡、关键节点 |
| `types.ts` | 运行时状态类型 |

## 回合来源（TurnSource，可复制）

`ai/turnSource.ts` 把「AI 在线生成」与「免 Key 本地事件池」统一到一个契约
（`streaming` / `supportsCustomAction` / `choiceRng` / `generate`）。它桥接 `engine/` 与
`ai/` + 配置，故不放进纯内核，但同样与具体剧本无关、可整体复制。`Play.tsx` 只依赖来源的
能力声明，不判断 `mode`；新增一种来源（脚本回放、另一套后端）只实现一个 `TurnSource`，UI 不动。

## 游戏内容（每款游戏自带，不进引擎）

`scenarios/<id>.ts`（剧本数据）、`scenarios/achievementConfig.ts`（成就内容）、
`ui/covers.ts` 与各 `*Art.ts`（配图）。换游戏 = 换这批 + 换 `schema` 之外不动引擎。

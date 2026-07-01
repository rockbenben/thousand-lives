# 剧本格式规范

> 返回 [README](../README.md) · 相关：[玩法机制](gameplay.md) · [AI 配置](ai-providers.md)

获得新剧本有两条路：**让 AI 生成**（最省事）或**手写 / 导入 JSON**。完整规范以 [`src/scenarios/schema.ts`](../src/scenarios/schema.ts)（Zod）为准。

## AI 生成新剧本

首页点击「✨ AI 生成剧本」，填入一个主题（如「赛博朋克侦探 / 荒岛求生 / 大唐长安」），AI 会为你设计属性、状态分段、结局规则与上百条本地支线，生成后直接加入剧本库——**自带事件池，无需 Key 也能本地试玩**。

## JSON 示例

也可按下方 schema 手写剧本，再从首页导入：

```json
{
  "id": "my-scenario",
  "title": "荒岛漂流",
  "intro": "飞机失事，你独自漂上一座无人荒岛。求生还是等待救援？",
  "attributes": [
    { "key": "hp",     "name": "体力", "initial": 80, "max": 100, "deathBelow": 0 },
    { "key": "morale", "name": "士气", "initial": 60, "max": 100, "deathBelow": 0 }
  ],
  "openings": [
    { "name": "户外探险家", "prompt": "有丰富野外生存经验，擅长搭建庇护所与寻找食物。" },
    { "name": "普通上班族", "prompt": "没有特殊技能，但意志力顽强，善于观察与学习。" }
  ],
  "turnUnit": "天",
  "maxTurns": 20,
  "systemPrompt": "你是一个荒岛求生文字游戏的主持人。风格写实，每天都充满挑战。",
  "endings": [
    { "condition": "maxTurns", "tone": "获救" },
    { "condition": "hp<=0",    "tone": "力竭死亡" },
    { "condition": "morale<=0","tone": "绝望放弃" },
    { "condition": "hp>=90",   "tone": "体魄极佳、精神振奋地获救" }
  ]
}
```

## 顶层字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 唯一标识符，不能与内置剧本的 id 相同（`xian` / `book` / `wuxia` / `sanguo` / `wasteland` / `officialdom` / `spy` / `scifi` / `voyage` / `liyuan`） |
| `title` | string | 剧本名称 |
| `genre` | string? | 可选，题材标签（如「仙侠」「穿越」），作选关卡与设置页题名之上的鎏金眉标 |
| `intro` | string | 开场介绍文字 |
| `attributes` | array | 属性列表（至少 1 个） |
| `openings` | array? | 可选的开局身份列表，每项含 `name` 和 `prompt` |
| `turnUnit` | string | 回合单位名称，默认 `"回合"` |
| `maxTurns` | integer | 最大回合数（正整数） |
| `systemPrompt` | string | 给 AI 的系统提示词，定义 GM 风格与规则 |
| `endings` | array | 结局列表（至少 1 个） |
| `ambitions` | array? | 可选，建议的「目标/野心」文本列表，玩家可选或自填 |
| `localEvents` | array? | 可选，本地事件池；提供后该剧本支持「无需 Key」本地试玩模式 |

**localEvents 子字段**：每个事件含 `narrative` 正文、`choices`（`text` + `effects`）、`summary`；可选 `minTurn`/`maxTurn` 回合区间、`once` 仅触发一次、`weight` 抽取权重、`itemsGained`/`itemsLost` 物品。

## attributes 子字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | 小写字母开头的 ASCII 标识符（如 `hp`、`sanity`） |
| `name` | string | 属性显示名 |
| `initial` | number | 初始值，必须在 `[0, max]` 范围内 |
| `max` | number | 最大值（正数） |
| `deathBelow` | number? | 可选，属性值 ≤ 此值时触发死亡结局 |
| `bands` | array? | 可选，命名状态分段（见下表） |

**bands 子字段**（按 `upTo` 严格升序排列）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `upTo` | number | 该状态段的上界（含） |
| `label` | string | 状态名（如「濒临崩溃」） |
| `severity` | string? | `critical` / `low` / `normal` / `high`，决定配色与告警，默认 `normal` |
| `directive` | string? | 落入此段时注入给 AI 的硬指令，强制剧情据此改写 |

> 给关键属性写好 `bands` + `directive`（尤其 `critical`/`low` 段），是让数值「有体感」的核心——AI 会据状态改写叙事语气、限制或解锁选项。

## endings 子字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `condition` | string | 结局触发条件（见下方语法） |
| `tone` | string | 结局基调，传给 AI 生成结局文字 |

## 条件语法

- `maxTurns` — 达到最大回合数
- `attr<=N` — 某属性值 ≤ N（如 `hp<=0`）
- `attr>=N` — 某属性值 ≥ N（如 `sanity>=95`）
- `has(印记)` — 持有某状态印记（开局身份或晋阶解锁的 flag）
- `&` 串联多个条件（如 `maxTurns & has(营地) & supplies>=70`）

> 结局判定**取所有满足条件中最具体的那个**（更严格的条件自动胜出，作者无需手工排序防遮蔽）；仅当多个满足条件互不蕴含时，才按数组顺序取靠前者。
>
> **死亡结局可写多条同条件的并列死法**（如多个 `hp<=0`，基调各异：饿毙 / 渴死 / 病亡…）：引擎先按上述 salience 取最具体，再在同等具体的并列死法里**随机取一**，使数值相同也死得不同（仅 AI 模式启用随机，本地确定性回放取首个）。

## 进阶字段

内置剧本用，写自定义剧本可选；完整规范以 [`src/scenarios/schema.ts`](../src/scenarios/schema.ts) 为准。

- **属性**：`ceiling` + `ceilingUnlocks:[{flag,max}]`（机缘封顶：上限冻结在 base，持印记后逐级抬高，造「晋阶」纵深）、`decayPerTurn`（每回合自动衰减）。
- **开局**：`openings[].flag`（注入身份印记，门控专属事件/结局）；剧本级 `tierLabel`（晋阶用词，如「境界/据点/官阶」）、`ambitions`（目标池）。
- **事件**：`keyMoment`（命运抉择关键节点，卷文题签上就地鎏金标记 +「落子问命」金框选项 + gemini 专属图）、`requires`/`requiresItem`（门控）、`once`/`weight`/`minTurn`/`maxTurn`/`wildcard`（奇遇乱入）；选项可带 `outcomes:[{weight,effects,flagsSet,itemsGained,endTone}]`（加权分支 + 隐藏彩蛋结局）、`reaction`（他人即时反馈）。
- **结局**：`epilogue`（本地模式专属尾声）；`art`（稳定配图 id，改文案不丢图）+ `gen`（`flux`/`gemini`，出图方式标注）。

## 导入方法

在首页点击「导入剧本」，上传 JSON 文件即可。剧本通过 Zod schema 校验，格式错误时会给出提示。

import { covers } from './covers'
import { builtinScenarios } from '../scenarios'

// 节点配图三层解析：① 专属图(按事件 summary 哈希，名/图/内容同源)
// ② 主题图(按事件主题归类，每剧本一套，复用；本地+AI 两模式都有画面)
// ③ 回退剧本封面。
const art = import.meta.glob('../assets/nodes/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>
const themeArt = import.meta.glob('../assets/node-themes/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// djb2：summary → 稳定的 ASCII 文件名片段（与生成脚本一致）
function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// 事件的稳定配图 id：优先取 localEvent.art（与 summary 文案解耦，改名不丢图），缺省回退 hash(summary)。
function nodeArtId(scenarioId: string, summary: string): string {
  const ev = builtinScenarios.find((s) => s.id === scenarioId)?.localEvents?.find((e) => e.summary === summary)
  return ev?.art ?? hash(summary)
}

// 里程碑事件配图文件名（不含扩展名）：{scenarioId}-{art}
export function nodeImageName(scenarioId: string, summary: string): string {
  return `${scenarioId}-${nodeArtId(scenarioId, summary)}`
}

// ── 主题归类：按 summary 关键词把任意事件（含 AI 动态事件）归入一个主题，
// 命中专属图前用主题图兜底，使每个节点都有贴合的画面。按优先级从重到轻匹配。
export const NODE_THEMES = [
  'death', 'conflict', 'betray', 'crisis', 'scheme', 'glory', 'breakthrough',
  'bond', 'parting', 'setback', 'encounter', 'start', 'mundane',
] as const
export type NodeTheme = (typeof NODE_THEMES)[number]

const THEME_KW: Array<[NodeTheme, RegExp]> = [
  ['death', /死|亡|殒|陨|薨|戮|斩首|问斩|赐死|鸩|瘐|葬|坟|身亡|命丧|罹难|溺|坠亡|形神俱灭|身死道消|油尽|力竭|绝命/],
  ['conflict', /战|斗|杀|袭|搏|刺|决斗|厮|围攻|火并|对峙|交锋|血战|出招|拔刀|拔剑|炮|劫匪|强敌|大战|围杀|海战/],
  ['betray', /叛|背|出卖|内鬼|反水|倒戈|构陷|诬|告密|反扑|哗变|众叛|内变|暗算/],
  ['crisis', /危|险|劫|陷|困|崩|塌|毒|瘟|疫|灾|风暴|围城|断粮|追杀|逃|追兵|心魔|天劫|瓶颈|质问|动荡|失控|围困|绝境/],
  ['scheme', /谋|策|计|算|局|间谍|密|诈|奏|参|弹劾|账册|名册|布防|献策|进言|对策|劝降|招安|权衡|筹谋|定计|盘查|周旋/],
  ['glory', /荣|封|赏|捷|名动|登顶|称王|加冕|凯旋|宗师|飞升|大成|问鼎|夺魁|登基|加身|声名|功成|名垂|巅峰|扬名|满堂彩|得道/],
  ['breakthrough', /突破|破境|顿悟|晋|渡劫|结丹|元婴|化神|登坛|证道|涅槃|蜕变|绝学|大成|练成|精进|得传/],
  ['bond', /情|爱|恋|知己|故人|姻|婚|妻|侣|恩|相守|白首|赠|托孤|师徒|结义|红颜|挚爱|相许|眷|同袍|知音/],
  ['parting', /别|离|归隐|退隐|辞|送行|远行|告老|散场|卸妆|出走|还乡|挂印|金盆洗手|远赴|漂泊|浪迹/],
  ['setback', /败|落魄|贬|黜|逐|流落|潦倒|蹉跎|黯然|冷落|被弃|散尽|羞辱|身败|名裂|碌碌|泯然|失意|重伤|缠身|苟延/],
  ['encounter', /遇|逢|拾|获|偶|奇遇|宝|秘|邀|现世|寻得|入手|捡|发现|来访|相邀|意外|传闻|残卷|古/],
  ['start', /初|开局|启程|入门|登场|拜师|上任|初入|起步|新科|第一|赴任|出山|下海/],
]

export function themeOf(summary?: string): NodeTheme {
  if (summary) {
    for (const [theme, re] of THEME_KW) if (re.test(summary)) return theme
  }
  return 'mundane'
}

function themeImage(scenarioId: string, theme: NodeTheme): string | undefined {
  return themeArt[`../assets/node-themes/${scenarioId}-${theme}.webp`]
}

// 节点配图：专属图 → 主题图 → 封面
export function nodeImage(scenarioId: string, summary?: string): string | undefined {
  if (summary) {
    const key = `../assets/nodes/${nodeImageName(scenarioId, summary)}.webp`
    if (art[key]) return art[key]
  }
  return themeImage(scenarioId, themeOf(summary)) ?? covers[scenarioId]
}

// 是否有比「回退封面」更贴合的图（专属图或主题图）——决定是否展示节点缩略图
export function hasNodeArt(scenarioId: string, summary?: string): boolean {
  if (!summary) return false
  if (`../assets/nodes/${nodeImageName(scenarioId, summary)}.webp` in art) return true
  return !!themeImage(scenarioId, themeOf(summary))
}

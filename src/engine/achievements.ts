import type { RunStats } from '../storage'

export type AchievementGroup = 'legend' | 'collect' | 'mastery' | 'journey'

// 成就分组（命书阁勋章墙按此分栏陈列）：传说居首为题眼，余者收集 / 精通 / 历练
export const ACH_GROUP_LABELS: Record<AchievementGroup, string> = {
  legend: '传说',
  collect: '收集',
  mastery: '精通',
  journey: '历练',
}
export const ACH_GROUP_ORDER: AchievementGroup[] = ['legend', 'collect', 'mastery', 'journey']

function groupOf(id: string): AchievementGroup {
  if (id.startsWith('legend-')) return 'legend'
  if (
    id.startsWith('seen-') ||
    id.startsWith('complete-') ||
    id.startsWith('clear-') ||
    id === 'first' ||
    id === 'all-scenarios'
  )
    return 'collect'
  if (id.startsWith('s-rank') || id.startsWith('master') || id === 'all-ranks' || id === 'goal-100')
    return 'mastery'
  return 'journey'
}

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  done: boolean
  group: AchievementGroup
  progress?: { cur: number; total: number }
}

export interface AchievementInput {
  // 每个内置剧本：已解锁结局数 / 该剧本结局总数
  scenarios: { id: string; seen: number; total: number }[]
  stats: RunStats
  // 每个剧本已解锁的结局基调集合（传说结局成就用）；缺省视为空
  seenTones?: Record<string, string[]>
}

// 各剧本的「传说结局」：达成该巅峰结局即解锁专属成就。
const LEGEND: Record<string, { tone: string; name: string; desc: string; icon: string }> = {
  wasteland: { tone: '末世王者·重塑秩序', name: '末世为王', desc: '在末世废墟上重塑秩序、君临废土', icon: '👑' },
  book: { tone: '母仪天下·宠冠后宫', name: '母仪天下', desc: '改写穿书命运、宠冠后宫', icon: '👸' },
  officialdom: { tone: '出将入相·名垂青史', name: '出将入相', desc: '位极人臣、名垂青史', icon: '🏛️' },
  spy: { tone: '不世奇功·全身而退', name: '不世奇功', desc: '立下不世奇功、全身而退', icon: '🎖️' },
  xian: { tone: '渡劫飞升·得道成仙', name: '羽化登仙', desc: '渡劫飞升、得道成仙', icon: '🪽' },
  wuxia: { tone: '武林至尊·一代宗师', name: '武林至尊', desc: '问鼎武林、一代宗师', icon: '🐲' },
  scifi: { tone: '万世昌隆·星海帝国', name: '星海帝国', desc: '奠定万世昌隆的星海帝国', icon: '🌌' },
  voyage: { tone: '海上霸主·七海之王', name: '纵横七海', desc: '成为七海之王、海上霸主', icon: '🏴‍☠️' },
  sanguo: { tone: '辅成大业·开国元勋', name: '佐定乾坤', desc: '辅成大业、位列开国元勋', icon: '🐉' },
  liyuan: { tone: '一代宗师·开宗立派', name: '梨园宗师', desc: '开宗立派、一代梨园宗师', icon: '🎭' },
}

// 每个内置剧本的「走完一段人生」专属成就（具体、题材化）：解锁该剧本任一结局即达成。
const SCENARIO_ACH: Record<string, { name: string; desc: string; icon: string }> = {
  wasteland: { name: '废土行者', desc: '在末世求生中走到一个结局', icon: '🏚️' },
  book: { name: '破书之人', desc: '在穿书逆袭中走到一个结局', icon: '📖' },
  officialdom: { name: '宦海沉浮', desc: '在宦海浮沉中走到一个结局', icon: '🎎' },
  spy: { name: '暗夜之影', desc: '在孤岛谍影中走到一个结局', icon: '🕵️' },
  xian: { name: '证道之人', desc: '在缥缈仙途中走到一个结局', icon: '⛩️' },
  wuxia: { name: '江湖儿女', desc: '在快意江湖中走到一个结局', icon: '🗡️' },
  scifi: { name: '星海舟子', desc: '在群星彼端中走到一个结局', icon: '🛸' },
  voyage: { name: '逐浪之人', desc: '在怒海争锋中走到一个结局', icon: '⚓' },
  sanguo: { name: '乱世谋者', desc: '在乱世谋臣中走到一个结局', icon: '🐉' },
  liyuan: { name: '梨园角儿', desc: '在梨园浮梦中走到一个结局', icon: '🎭' },
}

// 每个内置剧本「集齐全部结局」的专属成就（各自独立雅称，不用统一后缀）。
const COMPLETE_ACH: Record<string, { name: string; icon: string }> = {
  wasteland: { name: '废土编年', icon: '🏚️' },
  book: { name: '著书立说', icon: '📖' },
  officialdom: { name: '庙堂阅尽', icon: '🎎' },
  spy: { name: '谍海无遗', icon: '🕵️' },
  xian: { name: '仙道大成', icon: '⛩️' },
  wuxia: { name: '江湖百晓', icon: '🗡️' },
  scifi: { name: '星海史诗', icon: '🛸' },
  voyage: { name: '怒海尽揽', icon: '⚓' },
  sanguo: { name: '天下尽算', icon: '🐉' },
  liyuan: { name: '粉墨春秋', icon: '🎭' },
}

// 由「结局图鉴 + 全局统计」纯函数推导成就，无副作用，便于测试与复用
export function computeAchievements({ scenarios, stats, seenTones = {} }: AchievementInput): Achievement[] {
  const totalSeen = scenarios.reduce((s, x) => s + x.seen, 0)
  const clearedScenarios = scenarios.filter((x) => x.seen > 0).length
  const completedCount = scenarios.filter((x) => x.total > 0 && x.seen >= x.total).length
  const n = scenarios.length
  const ALL_RANKS = ['S', 'A', 'B', 'C', 'D']
  const hasAllRanks = ALL_RANKS.every((r) => stats.ratings.includes(r))

  const count = (cur: number, total: number) => ({ cur: Math.min(cur, total), total })

  // 每剧本专属通关成就（具体、按出现的内置剧本动态生成）
  const perScenario: Omit<Achievement, 'group'>[] = scenarios
    .filter((s) => SCENARIO_ACH[s.id])
    .map((s) => {
      const a = SCENARIO_ACH[s.id]
      return { id: `clear-${s.id}`, name: a.name, desc: a.desc, icon: a.icon, done: s.seen > 0 }
    })

  // 传说结局成就（达成各剧本标志性巅峰结局）
  const perLegend: Omit<Achievement, 'group'>[] = scenarios
    .filter((s) => LEGEND[s.id])
    .map((s) => {
      const l = LEGEND[s.id]
      return {
        id: `legend-${s.id}`, name: l.name, desc: l.desc, icon: l.icon,
        done: (seenTones[s.id] ?? []).includes(l.tone),
      }
    })

  // 每剧本「集齐全部结局」成就
  const perComplete: Omit<Achievement, 'group'>[] = scenarios
    .filter((s) => COMPLETE_ACH[s.id] && s.total > 0)
    .map((s) => {
      const a = COMPLETE_ACH[s.id]
      return {
        id: `complete-${s.id}`, name: a.name, desc: `集齐该剧本全部 ${s.total} 种结局`, icon: a.icon,
        done: s.seen >= s.total, progress: count(s.seen, s.total),
      }
    })

  const all: Omit<Achievement, 'group'>[] = [
    { id: 'first', name: '初入千世', desc: '完成第一段人生', icon: '🌱', done: totalSeen >= 1 },
    ...perScenario,
    {
      id: 'runs-10', name: '江湖阅历', desc: '累计游玩 10 局', icon: '🎲',
      done: stats.runs >= 10, progress: count(stats.runs, 10),
    },
    {
      id: 'runs-30', name: '阅人无数', desc: '累计游玩 30 局', icon: '🃏',
      done: stats.runs >= 30, progress: count(stats.runs, 30),
    },
    {
      id: 'runs-50', name: '百战之身', desc: '累计游玩 50 局', icon: '⚔️',
      done: stats.runs >= 50, progress: count(stats.runs, 50),
    },
    {
      id: 'runs-100', name: '千锤百炼', desc: '累计游玩 100 局', icon: '🔥',
      done: stats.runs >= 100, progress: count(stats.runs, 100),
    },
    {
      id: 'all-scenarios', name: '道道皆通', desc: `每个剧本都至少通关一次`, icon: '📚',
      done: n > 0 && clearedScenarios >= n, progress: count(clearedScenarios, n),
    },
    {
      id: 'seen-20', name: '百味人生', desc: '累计解锁 20 种结局', icon: '🎭',
      done: totalSeen >= 20, progress: count(totalSeen, 20),
    },
    {
      id: 'seen-50', name: '千面阅历', desc: '累计解锁 50 种结局', icon: '🌌',
      done: totalSeen >= 50, progress: count(totalSeen, 50),
    },
    {
      id: 'seen-100', name: '阅尽千世', desc: '累计解锁 100 种结局', icon: '✨',
      done: totalSeen >= 100, progress: count(totalSeen, 100),
    },
    {
      id: 'seen-150', name: '千世通览', desc: '累计解锁 150 种结局', icon: '🌠',
      done: totalSeen >= 150, progress: count(totalSeen, 150),
    },
    {
      id: 'seen-200', name: '窥尽千世', desc: '累计解锁 200 种结局', icon: '💫',
      done: totalSeen >= 200, progress: count(totalSeen, 200),
    },
    ...perComplete,
    { id: 'complete-one', name: '功德圆满', desc: '集齐任一剧本的全部结局', icon: '🏆', done: completedCount >= 1 },
    {
      id: 'complete-three', name: '三生有幸', desc: '集齐三个剧本的全部结局', icon: '🏅',
      done: completedCount >= 3, progress: count(completedCount, 3),
    },
    {
      id: 'complete-all', name: '千世圆满', desc: '集齐所有剧本的全部结局', icon: '🎖️',
      done: n > 0 && completedCount >= n, progress: count(completedCount, n),
    },
    { id: 's-rank', name: '登峰造极', desc: '取得一次 S 级评价', icon: '👑', done: stats.ratings.includes('S') },
    {
      id: 's-rank-3', name: '炉火纯青', desc: '累计取得 3 次 S 级评价', icon: '💎',
      done: stats.sRanks >= 3, progress: count(stats.sRanks, 3),
    },
    {
      id: 's-rank-10', name: '一代宗匠', desc: '累计取得 10 次 S 级评价', icon: '🏵️',
      done: stats.sRanks >= 10, progress: count(stats.sRanks, 10),
    },
    { id: 'all-ranks', name: '五味杂陈', desc: '集齐 S/A/B/C/D 全部评级', icon: '🌈', done: hasAllRanks },
    {
      id: 'marathon', name: '颐养天年', desc: '单局活过 20 个回合', icon: '⏳',
      done: stats.maxTurns >= 20, progress: count(stats.maxTurns, 20),
    },
    {
      id: 'marathon-30', name: '寿与天齐', desc: '单局活过 30 个回合', icon: '🌳',
      done: stats.maxTurns >= 30, progress: count(stats.maxTurns, 30),
    },
    {
      id: 'goal-100', name: '得偿所愿', desc: '单局目标完成度达到 100%', icon: '🎯',
      done: stats.maxGoal >= 100, progress: count(stats.maxGoal, 100),
    },
    { id: 'unscathed', name: '全身而退', desc: '不经历死亡走完一段人生', icon: '🕊️', done: stats.aliveClear },
    { id: 'creator', name: '自成一界', desc: '通关一个生成或导入的剧本', icon: '🪶', done: stats.customCleared },
    {
      id: 'master-3', name: '通才', desc: '在 3 个不同剧本取得 S 级评价', icon: '🎓',
      done: stats.sRankScenarios.length >= 3, progress: count(stats.sRankScenarios.length, 3),
    },
    {
      id: 'master-all', name: '全能宗师', desc: '在每个剧本都取得过 S 级评价', icon: '🏆',
      done: n > 0 && stats.sRankScenarios.length >= n, progress: count(stats.sRankScenarios.length, n),
    },
    { id: 'local-clear', name: '白手起家', desc: '用免 Key 本地模式通关', icon: '🔌', done: stats.anyLocal },
    { id: 'ai-clear', name: '神机妙算', desc: '用 AI 模式通关', icon: '🤖', done: stats.anyAi },
    { id: 'dual', name: '虚实之间', desc: '本地与 AI 模式都通关过', icon: '☯️', done: stats.anyLocal && stats.anyAi },
    { id: 'death-1', name: '向死而生', desc: '经历一次死亡结局', icon: '💀', done: stats.deaths >= 1 },
    {
      id: 'death-10', name: '九死一生', desc: '累计 10 次死亡结局', icon: '⚰️',
      done: stats.deaths >= 10, progress: count(stats.deaths, 10),
    },
    {
      id: 'death-30', name: '轮回不息', desc: '累计 30 次死亡结局', icon: '🔁',
      done: stats.deaths >= 30, progress: count(stats.deaths, 30),
    },
    ...perLegend,
  ]
  return all.map((a) => ({ ...a, group: groupOf(a.id) }))
}

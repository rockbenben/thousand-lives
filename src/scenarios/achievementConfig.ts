import type { ScenarioAchConfig } from '../engine/achievements'

// 千世书各剧本的专属成就内容（传说巅峰 / 走完一段人生 / 集齐全部结局）。
// 这是「游戏内容」，与通用引擎解耦——换一款游戏，只换这份配置 + 剧本，引擎 computeAchievements 不动。
export const achievementConfig: ScenarioAchConfig = {
  xian: {
    legend: { tone: '渡劫飞升·得道成仙', name: '羽化登仙', desc: '渡劫飞升、得道成仙', icon: '🪽' },
    clear: { name: '证道之人', desc: '在缥缈仙途中走到一个结局', icon: '⛩️' },
    complete: { name: '仙道大成', icon: '⛩️' },
  },
  book: {
    legend: { tone: '母仪天下·宠冠后宫', name: '母仪天下', desc: '改写穿书命运、宠冠后宫', icon: '👸' },
    clear: { name: '破书之人', desc: '在穿书逆袭中走到一个结局', icon: '📖' },
    complete: { name: '著书立说', icon: '📖' },
  },
  wuxia: {
    legend: { tone: '武林至尊·一代宗师', name: '武林至尊', desc: '问鼎武林、一代宗师', icon: '🐲' },
    clear: { name: '江湖儿女', desc: '在快意江湖中走到一个结局', icon: '🗡️' },
    complete: { name: '江湖百晓', icon: '🗡️' },
  },
  sanguo: {
    legend: { tone: '辅成大业·开国元勋', name: '佐定乾坤', desc: '辅成大业、位列开国元勋', icon: '🐉' },
    clear: { name: '乱世谋者', desc: '在乱世谋臣中走到一个结局', icon: '🐉' },
    complete: { name: '天下尽算', icon: '🐉' },
  },
  wasteland: {
    legend: { tone: '末世王者·重塑秩序', name: '末世为王', desc: '在末世废墟上重塑秩序、君临废土', icon: '👑' },
    clear: { name: '废土行者', desc: '在末世求生中走到一个结局', icon: '🏚️' },
    complete: { name: '废土编年', icon: '🏚️' },
  },
  officialdom: {
    legend: { tone: '出将入相·名垂青史', name: '出将入相', desc: '位极人臣、名垂青史', icon: '🏛️' },
    clear: { name: '宦海沉浮', desc: '在宦海浮沉中走到一个结局', icon: '🎎' },
    complete: { name: '庙堂阅尽', icon: '🎎' },
  },
  spy: {
    legend: { tone: '不世奇功·全身而退', name: '不世奇功', desc: '立下不世奇功、全身而退', icon: '🎖️' },
    clear: { name: '暗夜之影', desc: '在孤岛谍影中走到一个结局', icon: '🕵️' },
    complete: { name: '谍海无遗', icon: '🕵️' },
  },
  scifi: {
    legend: { tone: '万世昌隆·星海帝国', name: '星海帝国', desc: '奠定万世昌隆的星海帝国', icon: '🌌' },
    clear: { name: '星海舟子', desc: '在群星彼端中走到一个结局', icon: '🛸' },
    complete: { name: '星海史诗', icon: '🛸' },
  },
  voyage: {
    legend: { tone: '海上霸主·七海之王', name: '纵横七海', desc: '成为七海之王、海上霸主', icon: '🏴‍☠️' },
    clear: { name: '逐浪之人', desc: '在怒海争锋中走到一个结局', icon: '⚓' },
    complete: { name: '怒海尽揽', icon: '⚓' },
  },
  liyuan: {
    legend: { tone: '一代宗师·开宗立派', name: '梨园宗师', desc: '开宗立派、一代梨园宗师', icon: '🎭' },
    clear: { name: '梨园角儿', desc: '在梨园浮梦中走到一个结局', icon: '🎭' },
    complete: { name: '粉墨春秋', icon: '🎭' },
  },
}

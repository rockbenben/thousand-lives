import type { Scenario } from './schema'
import { wasteland } from './wasteland'
import { bookTransmigration } from './book'
import { officialdom } from './officialdom'
import { spy } from './spy'
import { xian } from './xian'
import { wuxia } from './wuxia'
import { scifi } from './scifi'
import { voyage } from './voyage'
import { liyuan } from './liyuan'
import { sanguo } from './sanguo'

// 首页排序大体按题材大众吸引力/搜索流量从高到低（修仙、穿书为两大流量入口），
// 但把谍战（孤岛谍影）提到第三：其潜伏/背叛/家国张力最能展示本作的叙事深度，值得抢占首屏黄金位，
// 而非埋在纯流量序的第七。其后武侠、三国，再到普世的末世、官场与科幻，最后是更小众的大航海与戏曲。
export const builtinScenarios: Scenario[] = [xian, bookTransmigration, spy, wuxia, sanguo, wasteland, officialdom, scifi, voyage, liyuan]

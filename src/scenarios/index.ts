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

// 首页排序按题材的大众吸引力/搜索流量从高到低：修仙、穿书、武侠、三国为四大入口，
// 其后是普世的末世求生与官场升官，再到谍战、科幻，最后是更小众的大航海与戏曲。
export const builtinScenarios: Scenario[] = [xian, bookTransmigration, wuxia, sanguo, wasteland, officialdom, spy, scifi, voyage, liyuan]

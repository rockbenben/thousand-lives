// 平衡/内容模拟脚本(sim-balance / balance-greedy / content-check)共享的小工具：
// 可复现伪随机 + 致死属性提取。三脚本曾各写一份逐字相同的实现，抽此单一来源。
import type { Scenario } from '../src/scenarios/schema'

// 可复现伪随机(mulberry32)——同 seed 同序列，让每次跑结果稳定、可对照前后改动。
export function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 致死属性(设了 deathBelow 的)——归零即死，survive/判死等据此识别。
export const deathAttrs = (sc: Scenario) => sc.attributes.filter((a) => a.deathBelow !== undefined)

// 致命结局 endTone 判据：判定某 endTone 是否「死亡级结局」，供 content-check / sim-balance 统一计死，
// 避免两脚本各持一份漂移的正则、对同一剧本算出不一致的死亡数。
// 注意：balance-greedy 用的是另一套更宽的「greedy 避险网」(含单字 沉/坠/崩/亡，语义=尽量躲一切像致命的 endTone)，
// 与此处「精确判定死亡结局」语义不同，故不并入——保留其本地定义。
export const LETHAL_TONE = /形神俱灭|横死|暴毙|身死|道消|坐化|羽化|走火|经脉俱断|抹杀|殒命|当场/

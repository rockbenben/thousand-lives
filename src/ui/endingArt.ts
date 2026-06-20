import { covers } from './covers'
import { builtinScenarios } from '../scenarios'

// 结局配图解析：按「剧本 id + 稳定配图 id」定位 assets/endings/{id}-{art}.webp。
// 用 Vite glob 动态收集已有图片，图片存在即用、缺图回退到剧本封面——随放随生效。
const art = import.meta.glob('../assets/endings/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// djb2：把文本映射为稳定的 ASCII 文件名片段（与生成清单脚本一致）
function hashTone(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// 结局的稳定配图 id：优先取 ending.art（与 tone 文案解耦，改名不丢图），缺省回退 hash(tone)。
// 自定义/生成剧本不在内置表中 → 回退 hash(tone)。
function endingArtId(scenarioId: string, tone: string): string {
  const e = builtinScenarios.find((s) => s.id === scenarioId)?.endings.find((x) => x.tone === tone)
  return e?.art ?? hashTone(tone)
}

// 某结局对应的图片文件名（不含扩展名），生成图片时按此命名落到 assets/endings/
export function endingImageName(scenarioId: string, tone: string): string {
  return `${scenarioId}-${endingArtId(scenarioId, tone)}`
}

// 结局配图：有专属图用专属图，否则回退到剧本封面（可能为 undefined）
export function endingImage(scenarioId: string, tone: string): string | undefined {
  const key = `../assets/endings/${endingImageName(scenarioId, tone)}.webp`
  return art[key] ?? covers[scenarioId]
}

// 是否已有该结局的专属配图（用于区分"专属"与"回退封面"）
export function hasEndingArt(scenarioId: string, tone: string): boolean {
  return `../assets/endings/${endingImageName(scenarioId, tone)}.webp` in art
}

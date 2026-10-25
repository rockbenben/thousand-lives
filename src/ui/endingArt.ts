import { covers } from './covers'
import { builtinScenarios } from '../scenarios'
import { djb2 } from './djb2'

// 结局配图解析：按「剧本 id + 稳定配图 id」定位 assets/endings/{id}-{art}.webp。
// 用 Vite glob 动态收集已有图片，图片存在即用、缺图回退到剧本封面——随放随生效。
const art = import.meta.glob('../assets/endings/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// 命运之卡与结局图鉴看的是结局图中央竖幅（3:4 裁切，只留中间 50% 宽）：
// 384×512 与 105×140 两个 CSS 框，也就是 768 与 210 设备像素。
// 结局图本身是 2528×1696，让这两个小框去下载整张就是几百 KB 换几百像素，
// 图鉴页一个结局一张。所以另切一张同裁切的缩略图（scripts/gen-ending-thumbs.mjs），
// 结局页与灯箱仍然用原图。
const thumbs = import.meta.glob('../assets/ending-thumbs/*.webp', {
  eager: true,
  import: 'default',
}) as Record<string, string>

// 结局的稳定配图 id：优先取 ending.art（与 tone 文案解耦，改名不丢图），缺省回退 djb2(tone)。
// 自定义/生成剧本不在内置表中 → 回退 djb2(tone)。
function endingArtId(scenarioId: string, tone: string): string {
  const e = builtinScenarios.find((s) => s.id === scenarioId)?.endings.find((x) => x.tone === tone)
  return e?.art ?? djb2(tone)
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

// 小框用的竖幅缩略图：命运之卡与结局图鉴用。
// 缩略图还没切出来时退回原图，再没有就退回剧本封面——旧图与新图都能显示。
export function endingTile(scenarioId: string, tone: string): string | undefined {
  const key = `../assets/ending-thumbs/${endingImageName(scenarioId, tone)}.webp`
  return thumbs[key] ?? endingImage(scenarioId, tone)
}

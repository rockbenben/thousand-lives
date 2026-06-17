import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'
import { gradeRun } from '../engine/grade'
import { bandOf } from '../engine/bands'

export interface CardAchievement {
  icon: string
  name: string
}

// 把一局结局渲染成一张可保存/分享的图片（墨与朱砂主题）。返回 canvas。
export async function drawShareCard(
  sc: Scenario,
  st: GameState,
  achievements: CardAchievement[] = [],
  coverUrl?: string,
): Promise<HTMLCanvasElement> {
  const W = 720
  const pad = 48
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const grade = gradeRun(sc, st)
  const ending = st.ended?.tone ?? '进行中'
  const serif = '"Noto Serif SC", "Songti SC", SimSun, serif'
  const art = coverUrl ? await loadImage(coverUrl) : null
  const bannerH = 320 // 配图主视觉横幅高度

  // 先按内容估算高度
  const picks = st.history.slice(-4).map((t) => `· ${t.summary}（${t.choiceText}）`)
  const achShown = achievements.slice(0, 6)
  const showGoal = !!st.ambition
  const headerH = art ? bannerH : 150 // 无图时退化为暗色刊头
  const H =
    headerH +
    250 +
    picks.length * 30 +
    (achShown.length ? 44 + achShown.length * 28 : 0) +
    (showGoal ? 84 : 0) +
    sc.attributes.length * 30

  const canvas = document.createElement('canvas')
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)

  // 背景
  ctx.fillStyle = '#0c1126'
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'

  // ── 顶部主视觉：配图满宽铺开（cover-fit 居中裁剪），底部渐隐入暗底 ──
  if (art) {
    const ar = art.width / art.height
    const tr = W / bannerH
    let sw, sh, sx, sy
    if (ar > tr) { sh = art.height; sw = sh * tr; sx = (art.width - sw) / 2; sy = 0 }
    else { sw = art.width; sh = sw / tr; sx = 0; sy = (art.height - sh) / 2 }
    ctx.drawImage(art, sx, sy, sw, sh, 0, 0, W, bannerH)
    // 暗色渐隐：上轻下重，保证压字处可读、并融入卡身
    const g = ctx.createLinearGradient(0, 0, 0, bannerH)
    g.addColorStop(0, 'rgba(12,17,38,0.30)')
    g.addColorStop(0.45, 'rgba(12,17,38,0.12)')
    g.addColorStop(0.82, 'rgba(12,17,38,0.78)')
    g.addColorStop(1, '#0c1126')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, bannerH)
  }

  // 压在横幅底部的题铭
  let y = (art ? bannerH : headerH) - 96
  ctx.save()
  if (art) ctx.shadowColor = 'rgba(0,0,0,0.85)'
  if (art) ctx.shadowBlur = 12
  ctx.fillStyle = '#c9a05c'
  ctx.font = `600 24px ${serif}`
  ctx.fillText(`千世书 · ${sc.title}`, pad, y)
  y += 52
  ctx.fillStyle = '#e0704e'
  ctx.font = `700 46px ${serif}`
  ctx.fillText(truncate(ctx, ending, W - pad * 2), pad, y)
  ctx.restore()
  y += 50

  // 评级 + 称号
  ctx.fillStyle = '#c9a05c'
  ctx.font = `700 24px ${serif}`
  ctx.fillText(`${grade.rating} 级`, pad, y)
  const rW = ctx.measureText(`${grade.rating} 级`).width
  ctx.fillStyle = '#b4b8d8'
  ctx.font = `400 22px ${serif}`
  ctx.fillText(truncate(ctx, `  称号「${grade.title}」`, W - pad * 2 - rW), pad + rW, y)
  y += 34
  ctx.fillStyle = '#868bb2'
  ctx.font = `400 18px ${serif}`
  ctx.fillText(`历经 ${st.history.length} ${sc.turnUnit}`, pad, y)
  y += 38

  // 分隔
  ctx.strokeStyle = '#28326a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, y)
  ctx.lineTo(W - pad, y)
  ctx.stroke()
  y += 34

  // 最终状态
  ctx.fillStyle = '#c9a05c'
  ctx.font = `400 18px ${serif}`
  ctx.fillText('最终状态', pad, y)
  y += 30
  ctx.font = `400 19px ${serif}`
  for (const a of sc.attributes) {
    const v = st.attributes[a.key]
    const band = bandOf(a, v)
    ctx.fillStyle = '#dcdcef'
    ctx.fillText(`${a.name}  ${v}`, pad, y)
    ctx.fillStyle =
      band.severity === 'critical'
        ? '#e0704e'
        : band.severity === 'high'
          ? '#6fae9b'
          : '#868bb2'
    ctx.fillText(band.label, pad + 200, y)
    y += 30
  }
  y += 14

  // 目标与完成度
  if (showGoal) {
    ctx.fillStyle = '#c9a05c'
    ctx.font = `400 18px ${serif}`
    ctx.fillText('目标', pad, y)
    y += 28
    ctx.fillStyle = '#b4b8d8'
    ctx.font = `400 17px ${serif}`
    ctx.fillText(truncate(ctx, st.ambition!, W - pad * 2), pad, y)
    y += 26
    const p = Math.min(100, Math.max(0, st.goalProgress ?? 0))
    const barW = W - pad * 2 - 64
    const barY = y - 9
    ctx.fillStyle = 'rgba(201, 160, 92, 0.18)'
    ctx.fillRect(pad, barY, barW, 8)
    const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0)
    grad.addColorStop(0, '#c9a05c')
    grad.addColorStop(1, '#e0704e')
    ctx.fillStyle = grad
    ctx.fillRect(pad, barY, (barW * p) / 100, 8)
    ctx.fillStyle = '#c9a05c'
    ctx.font = `400 16px ${serif}`
    ctx.fillText(`${p}%`, pad + barW + 12, y)
    y += 30
  }

  // 关键抉择
  ctx.fillStyle = '#c9a05c'
  ctx.font = `400 18px ${serif}`
  ctx.fillText('关键抉择', pad, y)
  y += 30
  ctx.fillStyle = '#b4b8d8'
  ctx.font = `400 17px ${serif}`
  for (const p of picks) {
    ctx.fillText(truncate(ctx, p, W - pad * 2), pad, y)
    y += 30
  }

  // 已解锁成就
  if (achShown.length) {
    y += 14
    ctx.fillStyle = '#c9a05c'
    ctx.font = `400 18px ${serif}`
    ctx.fillText(`已得成就 ${achievements.length}`, pad, y)
    y += 30
    ctx.font = `400 18px ${serif}`
    for (const a of achShown) {
      ctx.fillStyle = '#dcdcef'
      ctx.fillText(`${a.icon}  ${a.name}`, pad, y)
      y += 28
    }
  }

  // 朱砂印
  ctx.fillStyle = '#c9503a'
  ctx.fillRect(W - pad - 56, H - pad - 56, 56, 56)
  ctx.fillStyle = '#f3e4c8'
  ctx.font = `400 16px ${serif}`
  ctx.textAlign = 'center'
  ctx.fillText('千', W - pad - 28, H - pad - 33)
  ctx.fillText('世', W - pad - 28, H - pad - 14)
  ctx.textAlign = 'left'

  // 贴边金色外框（最上层）
  ctx.strokeStyle = 'rgba(203,168,90,0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(3, 3, W - 6, H - 6)

  return canvas
}

// 单行截断，超出加省略号
function truncate(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// 加载图片用于绘入 canvas；失败（如加载超时）返回 null，分享卡退化为无封面版
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

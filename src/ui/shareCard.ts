import type { Scenario } from '../scenarios/schema'
import type { GameState } from '../engine/types'
import { gradeRun } from '../engine/grade'
import { bandOf } from '../engine/bands'
import qrcode from 'qrcode-generator'
import { hookQuestion } from './hookQuestion'
import { buildShareUrl, openingIndexOf } from './challengeLink'

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
  // 卡底页脚：钩子问句 + 挑战二维码（自包含——图片被单独转发也带着入口与钩子）
  const hook = hookQuestion(sc, st)
  const shareUrl = buildShareUrl(sc, openingIndexOf(sc, st))
  const footerH = 168
  const H =
    headerH +
    250 +
    (st.fateHighlight ? 34 : 0) +
    picks.length * 30 +
    (achShown.length ? 44 + achShown.length * 28 : 0) +
    (showGoal ? 84 : 0) +
    sc.attributes.length * 30 +
    footerH

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

  // 命运高光（极端命运事件）：朱砂/翠引出本局最戏剧的一刻
  if (st.fateHighlight) {
    ctx.fillStyle = st.fateHighlight.kind === 'disaster' ? '#e0704e' : '#6fae9b'
    ctx.font = `400 19px ${serif}`
    ctx.fillText(truncate(ctx, `命运 · ${st.fateHighlight.text}`, W - pad * 2), pad, y)
    y += 34
  }

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

  // ── 页脚：钩子问句（左）+ 挑战二维码（右）。固定贴底，自成一带。 ──
  const footY = H - footerH
  ctx.strokeStyle = '#28326a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad, footY)
  ctx.lineTo(W - pad, footY)
  ctx.stroke()

  const qrSize = 116
  const qrX = W - pad - qrSize
  const qrY = footY + 22
  drawQR(ctx, shareUrl, qrX, qrY, qrSize)
  ctx.fillStyle = '#868bb2'
  ctx.font = `400 15px ${serif}`
  ctx.textAlign = 'center'
  ctx.fillText('扫码 · 同款开局', qrX + qrSize / 2, qrY + qrSize + 20)
  ctx.textAlign = 'left'

  // 钩子问句：左侧大字、鎏金，最多两行
  const hookMaxW = qrX - pad - 24
  const hookLines = wrapLines(ctx, hook, hookMaxW, `600 23px ${serif}`, 3)
  ctx.fillStyle = '#ecd28f'
  ctx.font = `600 23px ${serif}`
  let hy = footY + 44
  for (const ln of hookLines) {
    ctx.fillText(ln, pad, hy)
    hy += 34
  }
  ctx.fillStyle = '#868bb2'
  ctx.font = `400 16px ${serif}`
  ctx.fillText('— 千世书', pad, footY + footerH - 22)

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

// 按宽度逐字折行（中文无空格），最多 maxLines 行，超出丢弃剩余
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  font: string,
  maxLines: number,
): string[] {
  ctx.font = font
  const lines: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > maxW) {
      lines.push(cur)
      cur = ch
      if (lines.length === maxLines) {
        cur = ''
        break
      }
    } else cur += ch
  }
  if (cur) lines.push(cur)
  return lines.slice(0, maxLines)
}

// 把挑战链接画成二维码（浅底深块 + 安静区，确保可扫）
function drawQR(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): void {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  const quiet = 4
  const cell = size / (n + quiet * 2)
  ctx.fillStyle = '#f3e4c8'
  ctx.fillRect(x, y, size, size)
  ctx.fillStyle = '#0c1126'
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c))
        ctx.fillRect(x + (c + quiet) * cell, y + (r + quiet) * cell, cell + 0.6, cell + 0.6)
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// 加载图片用于绘入 canvas；失败（如加载超时）返回 null，分享卡退化为无封面版。
// 不设 crossOrigin：封面/节点图都是同源打包资源，设了反而强制 CORS 重新拉取、绕过页面已加载的
// 缓存图，让每次「生成命运卡」都白等一次网络+解码（这是分享慢的主因）。同源画布也不会被污染。
function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

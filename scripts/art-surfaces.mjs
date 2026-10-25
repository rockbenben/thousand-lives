// 配图展示面登记表 —— 出图规格与构图规则都从这里算出来，不再手写。
//
// 同一张图会被画进形状完全不同的框里：
//   封面  → 252×252 的选关卡方卡、786×300 的设置页 hero、720×320 的分享卡横幅、1200×630 的 og 图
//   节点画 → VN 整屏场景：笔记本 1.33、桌面 1.6、手机竖屏 0.46
//   结局画 → 结局页 520×347、命运之卡 384×512（竖）、结局图鉴 105×140（竖）
//   徽章   → 灯箱 300×300（contain，不裁）
//
// `object-fit: cover` 会把装不下的部分裁掉，所以每个框实际看到的都是同一张画的
// 不同窗口。把这些窗口求交集、再扣掉被文字压住的那一段，就得到「安全区」——
// 唯一能被所有展示面同时看到的地方。生成时按安全区构图，画面到哪儿都读得出来。
//
// 各框的尺寸与文字占比都实测过（CDP 量真实盒子 + ffmpeg 量亮度），
// 每条都注明出处；改了版式要回来改这里，别去改提示词。
//
// 单独运行可打印推导过程：
//   node scripts/art-surfaces.mjs
import { lookupNative } from './native-sizes.mjs'

export const DPR = 2

/**
 * @typedef {object} Surface
 * @property {string} name     展示面名
 * @property {[number, number]} box  CSS 像素下的框尺寸
 * @property {'cover'|'contain'} fit
 * @property {string} position  object-position / background-position
 * @property {number} text      框底部被文字与渐变压住的比例（0 = 压不到）
 * @property {number} [weight]  权重：越重要的面越重（默认 1）
 * @property {number} [dpr]     设备像素比（默认 2；静态定尺文件用 1）
 * @property {string} where     出处
 */

/** @type {Record<string, Surface[]>} */
export const SURFACES = {
  cover: [
    { name: 'card', box: [252, 252], fit: 'cover', position: 'center', text: 0.5, weight: 4, where: '选关卡卡片 .card-cover（实测 252×252）' },
    { name: 'hero', box: [786, 300], fit: 'cover', position: 'center 28%', text: 0.34, where: '设置页 hero .setup-hero-art（实测 786×298，background-position center 28%）' },
    { name: 'banner', box: [720, 320], fit: 'cover', position: 'center', text: 0.3, where: '分享卡横幅 drawShareCard（720×320，题铭压在底部 30%）' },
    { name: 'og', box: [1200, 630], fit: 'cover', position: 'center 6%', text: 0, dpr: 1, weight: 2, where: 'og 图 scripts/gen-og-images.mjs（crop 1200:630:0:6%，静态 1200 宽不放大）' },
    // 封面同时是节点的兜底图（nodeImage(): 节点图 → 主题图 → 封面），
    // AI 生成的动态事件更是只有封面可画，所以它必须同时吃住整屏幕布的裁法
    { name: 'stage-desktop', box: [1440, 900], fit: 'cover', position: 'center', text: 0.455, weight: 2, where: 'VN 整屏 .vn-scene（桌面实测 1440×900，卷文区顶在 54.5%）' },
    { name: 'stage-laptop', box: [1024, 768], fit: 'cover', position: 'center', text: 0.533, where: 'VN 整屏（笔记本 1024×768，卷文区顶在 46.7%）' },
    { name: 'stage-phone', box: [390, 844], fit: 'band', position: 'center top', text: 0.672, weight: 2, where: 'VN 整屏（手机 390×844，竖屏改成整幅宽置顶，卷文区顶在 32.8%）' },
  ],
  node: [
    { name: 'stage-desktop', box: [1440, 900], fit: 'cover', position: 'center', text: 0.455, weight: 2, where: 'VN 整屏 .vn-scene（桌面实测 1440×900，卷文区顶在 54.5%）' },
    { name: 'stage-laptop', box: [1024, 768], fit: 'cover', position: 'center', text: 0.533, where: 'VN 整屏（笔记本 1024×768，卷文区顶在 46.7%）' },
    { name: 'stage-phone', box: [390, 844], fit: 'band', position: 'center top', text: 0.672, weight: 2, where: 'VN 整屏（手机 390×844，竖屏改成整幅宽置顶成画带，卷文区顶在 32.8%）' },
    { name: 'stage-tablet', box: [820, 1180], fit: 'cover', position: 'center', text: 0.348, where: 'VN 整屏（平板竖屏 820×1180，仍整屏铺，只露 47% 宽度）' },
  ],
  ending: [
    { name: 'page', box: [520, 347], fit: 'cover', position: 'center', text: 0, weight: 3, where: '结局页 .ending-art（max-width 520，比例 3:2）' },
    { name: 'detail', box: [540, 360], fit: 'cover', position: 'center', text: 0, weight: 2, where: '结局详情弹层 .ed-art（.ending-detail 宽 540，比例 3:2）' },
    // 命运之卡与图鉴格子看的是结局图的中央竖幅（3:4 裁切，只留中间 50% 宽）。
    // 出的是 768×1024 的裁切缩略图，不是原图；这里记的是「原图要能被裁成什么样」，
    // 所以原图的安全区要把这两条一起算进去。
    { name: 'fate', box: [384, 512], fit: 'cover', position: 'center', text: 0.35, weight: 2, where: '命运之卡 .fate-card-art（384×512，竖 3:4，取原图中央 50% 宽）' },
    { name: 'gallery', box: [105, 140], fit: 'cover', position: 'center', text: 0.3, where: '结局图鉴 .gal-tile（105×140，竖 3:4，同一张裁切缩略图）' },
  ],
  achievement: [
    { name: 'badge', box: [300, 300], fit: 'contain', position: 'center', text: 0, where: '徽章灯箱 .badge-show-img（300×300，contain 不裁）' },
  ],
}
// 主题图与节点图同规格：它们就是节点图的兜底，画在同一块幕上
SURFACES.theme = SURFACES.node

/** 各类配图的画幅。
 *  节点/主题图用 3:2：推导出的「主体方块」在所有候选里最大（3:2 20.2% vs 4:3 20.0%
 *  vs 16:9 18.3%）。这三类画满屏铺，画幅只决定各面裁切后还剩多少可用构图区。
 *  封面用 16:9：它有六个面（方卡 / hero / 分享横幅 / og / VN 桌面 / VN 手机），
 *  其中宽面占多数，推导出的主体方块也最大（16:9 20.4% vs 3:2 16.2%）。只有 10 张。
 *  徽章用 1:1：章面本身就是圆的方形章，灯箱是 contain 不裁，任何画幅都能露全，
 *  所以画幅由章面形状定，不由推导定。
 *  结局图留在 3:2：指标上 1:1 略大一点（36.3% vs 32.5%），但结局页是按 3:2 排的版
 *  （.ending-art 的 aspect-ratio），换 1:1 等于在主展示面上裁掉上下三成。
 * 推导过程见 `node scripts/art-surfaces.mjs` 的输出（会列出各画幅的主体方块大小）。 */
export const ASPECT_OF = {
  cover: '16:9',
  node: '3:2',
  theme: '3:2',
  ending: '3:2',
  achievement: '1:1',
}

/** 连接器支持的画幅（后端枚举文档不全，3:2 实际可用） */
export const ASPECTS = [
  { name: '1:1', ratio: 1 },
  { name: '4:3', ratio: 4 / 3 },
  { name: '3:2', ratio: 3 / 2 },
  { name: '16:9', ratio: 16 / 9 },
  { name: '9:16', ratio: 9 / 16 },
  { name: '3:4', ratio: 3 / 4 },
]

/** 各类配图的清晰度档。
 *  场景画满屏铺，是这张图最大的用处，2K 起。
 *  徽章是 300px 的章面，1K（1024×1024）已经绰绰有余——2K 只是白占四倍像素。
 *  结局图统一 2K：它的命运之卡是 384×512 的竖裁（只取原图中央 50% 宽），
 *  1K 的 1264×848 装进这个框要被放大 1.21 倍才够，是全库唯一还在被插值放大的面；
 *  2K 的 2528×1696 装进去是 0.60 倍，反而清晰。结局图也是唯一能点开看原图
 *  （灯箱按原图尺寸放大）的画种，1K 到 1264px 就到顶了。
 *  命运之卡与图鉴格子看的是裁切缩略图，尺寸由 scripts/gen-ending-thumbs.mjs 另定。 */
export const RESOLUTION_OF = {
  cover: '2K',
  node: '2K',
  theme: '2K',
  ending: '2K',
  achievement: '1K',
}

/** 连接器各档各画幅的直出像素（后端直出，不缩放）。
 *  这一张表只当「还没实测过的组合」的保守估计用：出图时按画幅 + 档位请求，
 *  原图直出、不缩放，所以这里填错不会影响生成。
 *  实测过的组合以 scripts/native-sizes.mjs 量到的真实文件为准（nativeFor）；
 *  下面这几行已经填上了实测值，新克隆的仓库没有那份记录时也不会退回到猜测。
 *    2K 3:2  → 2528×1696   2K 16:9 → 2752×1536   1K 1:1 → 1024×1024 */
export const NATIVE = {
  '2K 1:1': [2048, 2048],
  '2K 4:3': [2400, 1792],
  '2K 3:2': [2528, 1696],
  '2K 16:9': [2752, 1536],
  '2K 9:16': [1422, 2528],
  '2K 3:4': [1696, 2528],
  '1K 1:1': [1024, 1024],
  '1K 4:3': [1200, 896],
  '1K 3:2': [1264, 848],
  '1K 16:9': [1264, 711],
  '1K 9:16': [711, 1264],
  '1K 3:4': [848, 1264],
}

/** 清晰度档位，从低到高 */
export const TIERS = ['1K', '2K', '4K']

/**
 * 浏览器把图放大超过这个倍数，就算「强行放大」而不是原生直出。
 * 2K 在 DPR2 的 1440 宽整屏上会被放大 1.14 倍——这是有意接受的（4K 要翻四倍像素、
 * 翻四倍额度，只为消掉这点轻微发虚不划算）。1.5 倍以上是另一回事。
 */
export const MAX_UPSCALE = 1.5

/**
 * 某一档某一画幅的原生像素：实测优先，登记表兜底。
 * 实测值来自出图时量到的真实文件（scripts/native-sizes.mjs）；
 * 登记表那几行只是「还没渲染过」的保守估计。
 */
export function nativeFor(resolution, aspect) {
  return lookupNative(resolution, aspect) || NATIVE[`${resolution} ${aspect}`] || null
}

/**
 * 一个展示面需要多大的原图，才不会在它里面被放大。
 *
 * cover：两个方向都要够。cover 是「装满框」，装不下的方向会被裁掉，所以原图
 *   在两个方向上都必须装得下这个框，否则浏览器得插值放大——而宽度够、高度
 *   不够是最容易漏掉的一种：命运之卡 384×512 的竖框，1K 的 1264×848 宽是够的，
 *   高差 176px，缩放比按大的那个方向走，于是被放大 1.21 倍。
 * band：只按宽度算（整幅宽置顶，高度由画带自己决定）。
 * contain：缩到能装下即可，同样两个方向都要够。
 */
function needFor(surface) {
  const dev = surface.dpr ?? DPR
  const bw = surface.box[0] * dev
  const bh = surface.box[1] * dev
  if (surface.fit === 'band') return { w: bw, h: 0 }
  return { w: bw, h: bh }
}

/**
 * 选档位：先用登记表定的档；实测发现这档的原生像素太小（放大会超过 MAX_UPSCALE 倍），
 * 就升一档。只认实测数据——没测过的组合按登记表的保守估计走，不猜。
 */
function tierFor(kind, aspect, need) {
  let tier = RESOLUTION_OF[kind]
  for (;;) {
    const measured = lookupNative(tier, aspect)
    if (!measured) break
    if (measured[0] * MAX_UPSCALE >= need.w && measured[1] * MAX_UPSCALE >= need.h) break
    const i = TIERS.indexOf(tier)
    if (i < 0 || i === TIERS.length - 1) break
    const next = TIERS[i + 1]
    // 只升到实测过的档。没实测过的档在 nativeFor 里查不到像素，升上去会让
    // planFor 拿到 null，然后整条出图管线在 import 时就崩了 —— 宁可停在
    // 够用的这一档，让计划里那条「会放大 N 倍」的提示去说话。
    if (!lookupNative(next, aspect)) break
    tier = next
  }
  return tier
}

/** object-position 的单个分量：left/center/right/top/bottom/百分比（'28%' 与 28 等价） */
function posValue(token, fallback) {
  if (token === undefined) return fallback
  if (token === 'left' || token === 'top') return 0
  if (token === 'right' || token === 'bottom') return 1
  if (token === 'center') return 0.5
  const n = Number(String(token).replace('%', ''))
  return Number.isFinite(n) ? n / 100 : fallback
}

/**
 * 一个展示面实际露出的图面窗口（以原图宽高的比例表示）。
 * cover 裁切：框比图窄 → 左右裁；框比图宽 → 上下裁。
 * @param {number} srcRatio 原图宽高比
 * @param {Surface} s
 */
export function windowOf(srcRatio, s) {
  const [bw, bh] = s.box
  const boxRatio = bw / bh
  if (s.fit === 'contain') return { x0: 0, x1: 1, y0: 0, y1: 1, visibleW: 1, visibleH: 1 }
  const parts = s.position.split(/\s+/)
  const px = posValue(parts[0], 0.5)
  const py = posValue(parts[1], 0.5)

  // band：整幅宽置顶成一条画带（竖屏专用）——宽度全露，高度按画带实际高度算
  if (s.fit === 'band') {
    const visibleH = Math.min(1, srcRatio / boxRatio)
    return { x0: 0, x1: 1, y0: 0, y1: visibleH, visibleW: 1, visibleH }
  }

  let visibleW = 1
  let visibleH = 1
  if (boxRatio < srcRatio) {
    visibleW = boxRatio / srcRatio // 左右裁：宽度方向只剩这么多
  } else {
    visibleH = srcRatio / boxRatio // 上下裁：高度方向只剩这么多
  }
  const x0 = visibleW >= 1 ? 0 : px - visibleW / 2
  const y0 = visibleH >= 1 ? 0 : py * (1 - visibleH)
  return { x0, x1: x0 + visibleW, y0, y1: y0 + visibleH, visibleW, visibleH }
}

/**
 * 展示面里「没有被文字压住」的那部分图面。
 * @param {number} srcRatio
 * @param {Surface} s
 */
export function freeOf(srcRatio, s) {
  const w = windowOf(srcRatio, s)
  let cut = s.text * w.visibleH // 文字压住的是框底，映射回原图就是这一段
  if (s.fit === 'band') {
    // 画带只占框顶的一条，文字压的是框底——两者可能根本不重叠。
    // 画带在框里占多高：整幅宽置顶时是 boxW/srcRatio 的高，换算成框的比例。
    const bandFraction = Math.min(1, s.box[0] / srcRatio / s.box[1])
    const overlap = Math.max(0, bandFraction - (1 - s.text)) // 文字压到画带上的部分（框的比例）
    cut = bandFraction > 0 ? (overlap / bandFraction) * w.visibleH : 0
  }
  return { x0: w.x0, x1: w.x1, y0: w.y0, y1: w.y1 - cut, visibleW: w.visibleW, visibleH: w.visibleH }
}

/**
 * 安全区 = 各展示面「没被文字压住的部分」的交集。
 * @param {number} srcRatio
 * @param {Surface[]} surfaces
 */
export function safeZone(srcRatio, surfaces) {
  let x0 = 0
  let x1 = 1
  let y0 = 0
  let y1 = 1
  for (const s of surfaces) {
    const f = freeOf(srcRatio, s)
    x0 = Math.max(x0, f.x0)
    x1 = Math.min(x1, f.x1)
    y0 = Math.max(y0, f.y0)
    y1 = Math.min(y1, f.y1)
  }
  return { x0, x1, y0, y1, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
}

/**
 * 安全区里能塞下的「主体方块」有多大。
 * 主体要么是站着的人（接近方形），要么是一片横景；比例在 0.55–1.8 之间都算数。
 * 只比面积会被「又宽又扁」的窄条骗过去——那地方塞不下一个主体。
 * @param {{w:number,h:number}} z
 */
export function subjectBox(z) {
  if (z.w <= 0 || z.h <= 0) return { w: 0, h: 0, area: 0 }
  const ratio = z.w / z.h
  if (ratio >= 0.55 && ratio <= 1.8) return { w: z.w, h: z.h, area: z.w * z.h }
  if (ratio > 1.8) {
    const h = Math.min(z.h, z.w / 1.8)
    return { w: h * 1.8, h, area: h * 1.8 * h }
  }
  const w = Math.min(z.w, z.h * 0.55)
  return { w, h: w / 0.55, area: w * w / 0.55 }
}

/**
 * 出图计划：画幅、像素尺寸、构图指令，一次算完。
 * 画幅的取舍 = 安全区里能塞下的主体方块最大的那个；
 * 主体方块大 = 构图自由度高 = 画面画得开。
 * @param {string} kind
 */
export function planFor(kind) {
  const surfaces = SURFACES[kind]
  if (!surfaces) throw new Error(`unknown art kind: ${kind}`)
  const aspectName = ASPECT_OF[kind]
  const aspect = ASPECTS.find((a) => a.name === aspectName)
  if (!aspect) throw new Error(`no aspect for ${kind}`)

  const zone = safeZone(aspect.ratio, surfaces)
  const subject = subjectBox(zone)

  // 换个画幅会怎样：列出各候选的主体方块大小，供人复核这个选择
  const alternatives = ASPECTS.map((a) => ({
    aspect: a.name,
    subject: subjectBox(safeZone(a.ratio, surfaces)),
  })).sort((x, y) => y.subject.area - x.subject.area)

  // 像素：各展示面里最需要的那个尺寸（宽高各取最大）——cover 要两个方向都装得下，
  // 少一个方向浏览器就得插值放大；band 只按宽度算。
  const need = surfaces.reduce((acc, s) => {
    const n = needFor(s)
    return { w: Math.max(acc.w, n.w), h: Math.max(acc.h, n.h) }
  }, { w: 0, h: 0 })
  // 档位与原生像素：实测优先（scripts/native-sizes.mjs），登记表兜底
  const resolution = tierFor(kind, aspect.name, need)
  const native = nativeFor(resolution, aspect.name)
  // 走到这里说明这一档既没实测过、登记表里也没有 —— 说清楚是哪一档，
  // 别让它变成后面 native[0] 抛的 TypeError。
  if (!native) throw new Error(`no native size known for ${resolution} ${aspect.name}: render one to measure it, or add it to NATIVE`)

  // 差多少：两个方向各差多少（负数 = 有余量）
  const shortfall = { w: Math.max(0, need.w - native[0]), h: Math.max(0, need.h - native[1]) }

  return {
    kind,
    aspect: aspect.name,
    ratio: aspect.ratio,
    resolution,
    pixels: native,
    nativeMeasured: !!lookupNative(resolution, aspect.name),
    neededWidth: need.w,
    neededHeight: need.h,
    shortfall,
    zone,
    subject,
    alternatives,
    surfaces: surfaces.map((s) => {
      const w = windowOf(aspect.ratio, s)
      const f = freeOf(aspect.ratio, s)
      return {
        name: s.name,
        where: s.where,
        weight: s.weight ?? 1,
        visibleW: w.visibleW,
        visibleH: w.visibleH,
        freeY: [f.y0, f.y1],
      }
    }),
  }
}

/**
 * 把安全区翻译成一句构图指令，附在提示词后面。
 * 这样「主体放哪、留白在哪」由展示面算出来，不靠每条提示词手写。
 * @param {ReturnType<typeof planFor>} plan
 */
export function clauseFor(plan) {
  const { zone: z } = plan
  const parts = []

  // 宽画幅（16:9 一类）：模型很容易把内容画成中间一条竖幅、两侧留白——
  // 实测 10 张封面里有 3 张就是这样出来的（中间竖直硬边 + 两侧填充的天空）。
  // 3:2 不会犯这个毛病（1496 张节点图零例），所以这条只加给宽画幅。
  if (plan.ratio >= 1.6) {
    parts.push('the scene spreads across the full width of the frame, with scenery continuing to both edges')
  }

  // 横向：安全区被裁窄了 → 主体要往中间靠
  if (z.w < 0.95) {
    const cx = (z.x0 + z.x1) / 2
    if (Math.abs(cx - 0.5) < 0.06) parts.push('the main subject is centred in the frame')
    else if (cx < 0.5) parts.push('the main subject is placed left of centre in the frame')
    else parts.push('the main subject is placed right of centre in the frame')
  }
  // 纵向：安全区被压扁了 → 主体要往上提
  if (z.h < 0.95) {
    const cy = (z.y0 + z.y1) / 2
    if (cy <= 0.22) parts.push('with the subject high in the picture, its head near the top')
    else if (cy <= 0.4) parts.push('with the subject in the upper part of the picture')
    else parts.push('with the subject around the middle of the picture')
  }
  // 安全区之外剩下的那截留给陪衬，别放主体。
  // 措辞不能把画框分成上下两块：模型读到「下半部分留给风景」会当成另一个画面，
  // 画出上下分屏的硬边（结局图上实测到过），所以只说「主体周围留白」。
  const openBelow = 1 - z.y1
  if (openBelow > 0.25 || z.y0 > 0.2) {
    parts.push('with open space and quiet scenery around the subject so the composition breathes')
  }
  if (!parts.length) return ''
  return ` ${parts.join(', ')}.`
}

/** 一句话说明某个展示面到底漏掉多少画 */
export function cropReport(plan) {
  return plan.surfaces.map((s) => {
    const lostW = Math.round((1 - s.visibleW) * 100)
    const lostH = Math.round((1 - s.visibleH) * 100)
    const lost = lostW > lostH ? `左右各裁 ${Math.round(lostW / 2)}%` : lostH > 0 ? `上下各裁 ${Math.round(lostH / 2)}%` : '不裁'
    return `    ${s.name.padEnd(14)} 露出 ${(s.visibleW * 100).toFixed(0)}% 宽 × ${(s.visibleH * 100).toFixed(0)}% 高（${lost}）`
  })
}

// 直接运行时打印推导过程
if (process.argv[1] && process.argv[1].endsWith('art-surfaces.mjs')) {
  for (const kind of Object.keys(SURFACES)) {
    const plan = planFor(kind)
    const z = plan.zone
    console.log(`\n■ ${kind}  → 画幅 ${plan.aspect}（${plan.pixels[0]}×${plan.pixels[1]}${plan.nativeMeasured ? '，实测' : '，估计'}）`)
    if (plan.shortfall.w > 0 || plan.shortfall.h > 0) {
      const upW = (plan.neededWidth / plan.pixels[0]).toFixed(2)
      const upH = (plan.neededHeight / plan.pixels[1]).toFixed(2)
      console.log(
        `  ⚠ 最大的展示面要 ${plan.neededWidth}×${plan.neededHeight}px，${plan.resolution} 只有 ${plan.pixels[0]}×${plan.pixels[1]}px` +
          ` —— 会放大 ${upW}×${upH}（超过 ${MAX_UPSCALE} 倍就算强行放大）`,
      )
    }
    console.log(`  安全区：横向 ${(z.x0 * 100).toFixed(0)}–${(z.x1 * 100).toFixed(0)}%，纵向 ${(z.y0 * 100).toFixed(0)}–${(z.y1 * 100).toFixed(0)}%`)
    console.log(cropReport(plan).join('\n'))
    const alts = plan.alternatives.map((a) => `${a.aspect} ${(a.subject.area * 100).toFixed(1)}%`).join('  ')
    console.log(`  主体方块（换画幅的代价）：${alts}`)
    const clause = clauseFor(plan)
    if (clause) console.log(`  构图指令：${clause.trim()}`)
  }
}

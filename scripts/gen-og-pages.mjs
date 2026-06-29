// 预生成「分享入口页」：给每个 题材[/开局] 生成一个带 OG 预览 meta 的静态 HTML，落到 public/s/ 。
// 纯静态方案（GH Pages / EdgeOne 回源等任何静态托管都适用，无需边缘函数）：
//   社交平台爬虫抓 /s/<题材>-<开局>/ 读到正确的 og:image(题材封面)+标题+钩子描述；
//   真人浏览器被 JS / meta-refresh 重定向进 SPA（/?s=&o=），照常开局。
// 改了内置剧本标题/开局后重跑：npx vite-node scripts/gen-og-pages.mjs
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { builtinScenarios } from '../src/scenarios/index.ts'

// 站点规范 origin：og:image / og:url 须用绝对地址（爬虫要求）。换域名改这里。
const CANON = 'https://lives.newzone.top'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 's')
rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function page(sc, openingIdx) {
  const opening = openingIdx != null ? sc.openings?.[openingIdx]?.name : undefined
  const title = `千世书 · ${sc.emoji} ${sc.title}${opening ? ` — ${opening}` : ''}`
  const intro = (sc.intro || '').slice(0, 70)
  const desc = `${opening ? `以「${opening}」之身，` : ''}${intro}…… 同样的开局，换你能走出什么结局？`
  const img = `${CANON}/og/${sc.id}.jpg`
  const q = `s=${sc.id}${openingIdx != null ? `&o=${openingIdx}` : ''}`
  // 跳转用相对路径(../../ 回站点根)，兼容根域名与子路径部署。
  // ★只用 JS 跳转、不放 meta-refresh：部分社交爬虫会跟着 meta-refresh 跳到 SPA，读到通用 OG，
  //   导致预览错成默认图。爬虫不跑 JS → 老实停在本页读对应题材的 OG；真人有 JS → 正常进 SPA。
  const rel = `../../?${q}`
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="千世书 · thousand-lives">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="805">
<meta property="og:url" content="${esc(`${CANON}/?${q}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<link rel="canonical" href="${esc(`${CANON}/?${q}`)}">
<script>location.replace(${JSON.stringify(rel)})</script>
</head>
<body style="margin:0;background:#0c1126;color:#c9a05c;font-family:serif;display:flex;align-items:center;justify-content:center;height:100vh">
<a href="${esc(rel)}" style="color:#c9a05c">正在前往千世书……若未自动跳转请点此</a>
</body>
</html>
`
}

let n = 0
for (const sc of builtinScenarios) {
  if (!sc.openings || sc.openings.length === 0) {
    const d = join(OUT, sc.id)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'index.html'), page(sc, undefined))
    n++
    continue
  }
  // 题材[/无开局] 兜底页 + 每个开局一页
  const d0 = join(OUT, sc.id)
  mkdirSync(d0, { recursive: true })
  writeFileSync(join(d0, 'index.html'), page(sc, undefined))
  n++
  sc.openings.forEach((_, i) => {
    const d = join(OUT, `${sc.id}-${i}`)
    mkdirSync(d, { recursive: true })
    writeFileSync(join(d, 'index.html'), page(sc, i))
    n++
  })
}
console.log(`生成 ${n} 个分享入口页 → public/s/`)

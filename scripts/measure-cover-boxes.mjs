// Measure the boxes the cover art is actually painted into, using CDP.
//   node scripts/measure-cover-boxes.mjs [--url http://localhost:5199/]
//
// The cover is one image shown in three places with three different crops.
// A cover prompt can only be written correctly once those crops are known:
//   .card-cover      — scenario card, object-fit: cover, object-position: center
//   .setup-hero-art  — setup screen hero, background-size: cover, position center 28%
//   .play-ambient    — full-screen ambient wash, blurred and dimmed
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const argv = process.argv.slice(2)
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const URL_ = arg('url', 'http://localhost:5199/')
const PORT = Number(arg('port', 9333))
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PROFILE = path.join(os.tmpdir(), 'tl-cdp-profile')

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1440,1100', URL_,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function cdpTargets() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const j = await r.json()
      const page = j.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('CDP did not come up')
}

const target = await cdpTargets()
const ws = new WebSocket(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const msgId = ++id
    pending.set(msgId, { res, rej })
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    const { res, rej } = pending.get(m.id)
    pending.delete(m.id)
    m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

await send('Page.enable')
await send('Runtime.enable')
await sleep(3500)

const expr = `(() => {
  const out = { viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, boxes: [] };
  const card = document.querySelector('.scenario-card.has-cover');
  if (card) {
    const r = card.getBoundingClientRect();
    const img = card.querySelector('.card-cover');
    const cs = getComputedStyle(img);
    out.card = { w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(3) };
    out.cardImg = { natural: [img.naturalWidth, img.naturalHeight], objectFit: cs.objectFit, objectPosition: cs.objectPosition, opacity: cs.opacity };
  }
  const hero = document.querySelector('.setup-hero-art');
  if (hero) {
    const r = hero.getBoundingClientRect();
    const cs = getComputedStyle(hero);
    out.hero = { w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(3), bgSize: cs.backgroundSize, bgPosition: cs.backgroundPosition };
  }
  const amb = document.querySelector('.play-ambient');
  if (amb) {
    const r = amb.getBoundingClientRect();
    const cs = getComputedStyle(amb);
    out.ambient = { w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(3), bgSize: cs.backgroundSize, bgPosition: cs.backgroundPosition, filter: cs.filter, opacity: cs.opacity };
  }
  // how much of the card is covered by the ink gradient
  const veil = card && card.querySelector('.card-cover + *');
  if (veil) { const r = veil.getBoundingClientRect(); out.veil = { tag: veil.className, top: r.top - card.getBoundingClientRect().top, h: r.height }; }
  return JSON.stringify(out, null, 1);
})()`

const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(r.result.value)
ws.close()
chrome.kill()
try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
process.exit(0)

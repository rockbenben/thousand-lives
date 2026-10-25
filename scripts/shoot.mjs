// Screenshot a page after every image has decoded, so lazy loading cannot
// make a card look emptier than it is.
//   node scripts/shoot.mjs <url> <out.png> [waitMs] [width] [height]
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const [url, out, waitMs = '8000', width = '1440', height = '1100'] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: node scripts/shoot.mjs <url> <out.png> [waitMs] [width] [height]')
  process.exit(1)
}
const PORT = 9334 + Math.floor(Math.random() * 40)
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PROFILE = path.join(os.tmpdir(), 'tl-shoot-profile')

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  `--window-size=${width},${height}`, url,
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const p = j.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (p) return p
    } catch {}
    await sleep(500)
  }
  throw new Error('CDP did not come up')
}

const t = await target()
const ws = new WebSocket(t.webSocketDebuggerUrl)
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
await sleep(Number(waitMs))

// force every <img> that is still lazy to load, then wait for the decode
await send('Runtime.evaluate', {
  expression: `(() => {
    for (const img of document.images) { img.loading = 'eager'; if (!img.complete) img.src = img.src; }
    return document.images.length;
  })()`,
  returnByValue: true,
})
for (let i = 0; i < 40; i++) {
  const r = await send('Runtime.evaluate', {
    expression: `[...document.images].every(i => i.complete && i.naturalWidth > 0)`,
    returnByValue: true,
  })
  if (r.result.value === true) break
  await sleep(500)
}
await sleep(1200)

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(out, Buffer.from(shot.data, 'base64'))
console.log(`${out}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB`)
ws.close()
chrome.kill()
try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
process.exit(0)

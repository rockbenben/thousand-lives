// Re-render the site's Open Graph card from design/og-template.html.
//
// The card is a designed asset: a background painting (design/og-background.jpg)
// with the title and the tagline set in type on top. The template already says
// what the site says today ("一卷千世", "十大题材"); the baked public/og.jpg was
// an older render and still carried the old wording, so the card is rendered
// from the template instead of being hand-edited.
//
//   node scripts/gen-og-card.mjs
//
// Outputs:
//   public/og.jpg         1200x630   the card the social platforms read
//   design/og-preview.png 2400x1260  a 2x preview of the same card
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const TEMPLATE = path.join(ROOT, 'design/og-template.html')
const OUT_JPG = path.join(ROOT, 'public/og.jpg')
const OUT_PNG = path.join(ROOT, 'design/og-preview.png')
const W = 1200
const H = 630

const CHROME =
  process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const PORT = 9340 + Math.floor(Math.random() * 40)
const PROFILE = path.join(os.tmpdir(), `tl-ogcard-profile-${process.pid}`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function render(scale, outPng) {
  const url = `file:///${TEMPLATE.replace(/\\/g, '/')}`
  const chrome = spawn(
    CHROME,
    [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
      `--window-size=${W},${H}`, url,
    ],
    { stdio: 'ignore' },
  )

  let ws
  try {
    let page = null
    for (let i = 0; i < 40 && !page; i++) {
      try {
        const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        page = j.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      } catch {}
      if (!page) await sleep(500)
    }
    if (!page) throw new Error('CDP did not come up')

    ws = new WebSocket(page.webSocketDebuggerUrl)
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: scale, mobile: false,
    })
    // the background is a CSS image, not an <img>: wait until it has actually
    // painted, otherwise the capture can come back with a blank corner
    await sleep(2500)
    const ready = await send('Runtime.evaluate', {
      expression: `document.fonts.ready.then(() => true)`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (!ready.result.value) throw new Error('fonts did not settle')
    await sleep(800)

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'))
  } finally {
    try { ws?.close() } catch {}
    chrome.kill()
    try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
  }
}

const tmp = path.join(os.tmpdir(), `tl-ogcard-${process.pid}.png`)
await render(1, tmp)
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, '-q:v', '3', OUT_JPG])
fs.rmSync(tmp, { force: true })

const tmp2 = path.join(os.tmpdir(), `tl-ogcard2x-${process.pid}.png`)
await render(2, tmp2)
fs.copyFileSync(tmp2, OUT_PNG)
fs.rmSync(tmp2, { force: true })

for (const f of [OUT_JPG, OUT_PNG]) {
  const d = execFileSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f],
    { encoding: 'utf8' },
  ).trim()
  console.log(`${path.relative(ROOT, f)}  ${d}  ${(fs.statSync(f).size / 1024).toFixed(0)}KB`)
}

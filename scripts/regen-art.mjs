// Driver for the art regeneration.
//
// The plan balance behind the image connector is the scarce resource, so the
// generation is deliberately gentle: ONE request per connector call and ONE
// call in flight at a time. A 10-request call is faster per image (the
// service renders the batch concurrently) but a failure then costs the whole
// batch, and a burst is what drains a thin balance fastest.
//
//   node scripts/regen-art.mjs [--batch 1] [--concurrency 1] ...
//
// --batch / --concurrency are the only knobs: raise --batch to trade
// gentleness for throughput.
//
// The run is resumable: finished slots are recorded in the state file, so a
// quota block or a crash costs at most the slot in flight.
import { execFile, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { shardOf } from './art-shards.mjs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { planFor, clauseFor } from './art-surfaces.mjs'
import { measureImage, recordNative } from './native-sizes.mjs'

const execFileAsync = promisify(execFile)

const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(os.tmpdir(), 'thousand-lives-regen', 'raw')
const ARGS_DIR = path.join(os.tmpdir(), 'thousand-lives-regen', 'args')
// Style suffix appended to every scene prompt. The rules come first, because a
// rule at the end of a long prompt does not carry the same weight as one at the
// front, and every one of them was written after a bad render:
//
//  - one scene, one place, one moment: the model paints two pictures joined by
//    a hard line when a clause names two places
//  - fills the frame edge to edge: the model paints a widescreen picture
//    inside the 3:2 frame and leaves black bars, which the full-screen VN
//    stage shows as black stripes
//  - every banner, scroll, tablet and paper is blank: the model puts a
//    Chinese character on it even when the prompt forbids text
//  - nothing appears that the scene does not describe: the model added a
//    modern airliner to a mountain that only had a flying sword in it
//  - the ethnic line is conditional, so a scene with no people in it is not
//    made to invent a figure just to satisfy the cast requirement
//  - writing on a physical surface is allowed where the scene wants it, and
//    everything written must be a real and correctly written Chinese character:
//    that one clause keeps the pseudo-calligraphy, the illegible scribble and
//    the Latin letter out without stripping the scene of the paper it is about
//
// That last rule used to be the opposite. The library forbade writing
// everywhere, on the theory that a Chinese scene with characters on a scroll
// looks wrong, and every prompt in the library was rewritten to ask for a
// blank surface instead of an unreadable one. That was the wrong call: real
// characters on a real prop are what a Chinese scene is supposed to look like.
// The user said it outright: a Chinese character appearing is not a defect.
//
// The old rule also failed on its own terms. "Illegible" turned out to be no
// guard at all, and that is the lesson worth the most here. A prompt that
// asks for writing that cannot be read -- "a worn proclamation, its script
// blurred into unreadable smudges" -- gets exactly what it asks for: a worn
// proclamation with columns of pseudo-glyphs on it, and in one case the word
// "Proclamation" in Latin letters. So the prompts now ask for real, correctly
// written characters rather than for none.
//
// Two failures survive the change, because neither was writing on an object:
// characters that are not on a surface at all (formed in light, smoke or mist,
// standing as glowing glyphs in a formation or an array), and the medallion rim
// on a badge, which is a border and has to keep reading as a border.
//
// The cutaway rule is the other failure seen in the endings: the model drew
// the room as a slab with a second room opened up underneath it, so one frame
// held two places. "One place" did not stop it; naming the cutaway did.
//
// The inset rule is the same failure wearing a frame. A carriage driver
// warning a noblewoman came back as the two of them inside a bordered
// rectangle floating over a misty street, and a survivor looking into a
// cracked shop mirror came back as his own face in a panel hanging in the
// scene. The frame is what tells the model it may show two views.
// A pre-modern room is lit by period light.
//
// The model invents a light source when the prompt leaves it open, and what it
// invents is a kerosene lamp: an elegant teahouse private room in a
// Ming-imperial court came back with a hurricane lamp standing on the round
// table, glass chimney and all. The library already had a kerosene-lamp ban,
// but it lived inside the prompts that happened to mention a lamp -- a room
// whose prompt says nothing about the light was never covered, and the model
// filled the gap.
//
// So the ban moves into the style, and it is conditional on the era anchor the
// prompt already carries: a pre-modern scene is lit by candles, clay oil lamps
// or paper lanterns, while Republican Shanghai and the far future keep the
// kerosene lamp they are allowed to have. The ban is named rather than
// implied, the same way the cutaway rule names the cutaway.
const PREMODERN = /ancient Chinese|Ming-dynasty|Eastern Han|Age of Sail/
const PREMODERN_LIGHT =
  ' Every light in this scene is a period light: a candle, a clay oil lamp or a red paper lantern. No kerosene lamp and no hurricane lamp stands anywhere in the picture.'
// A half-built shrine to a Ming eunuch came up with a modern construction sign
// reading 工程進行中 on it, and a recruitment hall in the late Eastern Han came
// up with 招聘榜. Real characters, but wording no one of that period would
// have put on a board.
//
// The rule is conditional on the era, like the lighting rule: a pre-modern
// scene carries only period wording on its signs, boards, banners, notices and
// placards, while the Republican and far-future scenes keep the modern words
// they are allowed to have.
const PREMODERN_TEXT =
  ' Every sign, board, banner, notice or placard in this picture carries only the wording of the period: no modern slogan, no modern sign, no modern administrative phrase and no modern trade wording appears on it.'
// Two young apprentices in a 1930s Beijing opera dressing room came back in
// white crew-neck T-shirts, which nobody wore in China then. There was no
// clothing rule at all, so the model dressed them for today.
//
// The rule is conditional like the lighting rule: Chinese scenes are dressed
// in Chinese period clothing, Republican scenes in Republican clothing, and
// the Age of Sail and the far future keep whatever their own era wore. The
// ban names the modern garments, the way the cutaway rule names the cutaway.
const CHINESE_ERA = /ancient Chinese|Ming-dynasty|Eastern Han/
const REPUBLIC_ERA = /Republican China|Republican-era China/
const OLD_CLOTHING =
  ' Everyone wears period Chinese clothing of the time: a long robe, a short jacket, a tunic, a work jacket or a scholar gown. Nobody wears a modern T-shirt, jeans, tracksuit, leather biker jacket or Western sportswear.'
const REPUBLIC_CLOTHING =
  ' Everyone wears period clothing of the time: a changshan, a short jacket, a qipao, a tunic, a work jacket, a shirt and tie, or a suit and hat. Nobody wears a modern T-shirt, jeans, tracksuit, leather biker jacket or Western sportswear.'
const eraStyle = (prompt, style) => {
  let s = style
  if (PREMODERN.test(prompt)) s += PREMODERN_LIGHT + PREMODERN_TEXT
  if (CHINESE_ERA.test(prompt)) s += OLD_CLOTHING
  else if (REPUBLIC_ERA.test(prompt)) s += REPUBLIC_CLOTHING
  return s
}

// Three rules added after the review of the drawn library. Each one was broken
// by a picture that had already been made, and each one costs nothing to add,
// because only the scene prompt is fingerprinted (see hashOf below): a style
// change applies to every slot that is still waiting to be drawn and re-queues
// nothing.
//
// 1. The picture reaches every edge. A painted scene stopped at a ragged white
//    paper edge in one corner and left the rest of the frame blank.
// 2. No Latin or English letters anywhere. A survivor's map came back with MET
//    on it, in the middle of a map full of invented place names.
// 3. No inscription the scene did not ask for. A banquet hall grew a hanging
//    scroll on its own and the model wrote pseudo-calligraphy on it, with a
//    Japanese hiragana in the column -- in spite of the rule above, which bans
//    an invented inscription but does not say where to look for one.
//
// Saying a surface is blank does not stop the model writing on it. That is a
// lesson for the scene prompts, not for the style: the style can only say what
// is never allowed.
const STYLE =
  ' One single continuous scene, one place, one moment: never a split screen, never two pictures joined together, never a cutaway or a cross-section that opens a second room below or beside the scene, never a picture inside the picture, never an inset panel or a framed rectangle floating in the frame showing another view of the same people, never black bars or borders, never a flat blank area of any colour, and the picture fills the frame from edge to edge with the scene in every part of it. Writing on a physical surface is allowed where the scene wants it, and everything written in the picture is real and correctly written Chinese: characters on a scroll, plaque, banner, signboard, flag, book, tablet, stele, paper, letter, note, chart, map, ledger, account, coin, fan, handkerchief, seal, rubbing, couplet, memorial, register, diary, musical score, stall label, price tag, tally board, market placard, medicine box label, product label, package or wrapper are Chinese characters of the period, in horizontal lines or vertical columns as the object deserves. An inscription the scene never asks for, a wall plaque or a hanging scroll or a signboard or a couplet or a stele, is not in the picture at all, and an inscription the scene does ask for carries a short ordinary Chinese phrase spelled with standard Chinese characters only, never a Japanese variant of a Chinese character and never a made-up string of characters, never pseudo-calligraphy, never illegible glyph-like scribbles, never mush, never any Latin or English letters and never a watermark. The picture reaches every edge of the frame with the scene itself: no unpainted margin, no torn-paper border, no white edge, no deckled edge, no blank canvas at any corner and no frame drawn around the picture. No Latin or English letters anywhere in the picture: not on a map or chart or label or ledger, not on a package or wrapper or poster, not on a signboard or a machine or an instrument, and never a Roman-letter logo, monogram or initial. A surface that the scene does not describe as carrying an inscription carries none: no scroll, no plaque, no couplet, no stele, no signboard, no chart and no map, and no writing of any kind on a banner, a wall, a tablet, a board or a sheet that hangs or stands in the picture, unless the scene asks for that writing. What is never allowed: characters that are not on a surface at all, not formed in light, smoke or mist and not standing as glowing glyphs in a formation or an array, and no sigils or spell-script that are not Chinese characters. Cinematic atmospheric digital painting, moody dark palette, rich detail, painterly. Nothing appears in the picture that the scene does not describe. People, if any appear, are clearly East Asian (Chinese) with black hair. Every character in the picture is a real Chinese character on a real object.'

// The cover is the one image that is seen at thumbnail size: a 252x252 square
// card in the scenario grid, dimmed to 78% over a near-black page, plus wide
// banner crops (setup hero, share card, og image). A moody full-screen scene
// painting vanishes at that size — measured, the card's visible band came out
// at luma 42 against a luma 45 page, so the art contributed nothing. The cover
// therefore gets its own style line: luminous, high contrast, one subject that
// still reads when the image is small. Where the subject sits is not decided
// here — that comes from the surface registry (scripts/art-surfaces.mjs).
//
// The wide-frame line is not decoration. At 16:9 the model sometimes paints a
// narrow portrait panel in the middle and fills the sides: 3 of the 10 covers
// came out that way, with a hard vertical seam down the image. Saying it
// outright is what keeps the picture a landscape.
//
// The "one unmistakable object" line is about the share image: the og card is
// the only picture a visitor sees before they click, and at 300 px across an
// atmospheric scene of a corridor and a figure says nothing about the genre.
// A prop that names the world (a book, a seal, a face painted in opera
// makeup) has to survive the crop.
//
// The face line is the same problem one level down. A cover is seen at 252 px
// in the scenario grid and at 300 px as a share card, and a figure the size of
// a grain of rice, or one seen from behind, is not a person at that size.
// Covers ask for a readable face; the scene art does not, because a scene
// painting is a full-screen backdrop and the reader looks past it.
const COVER_STYLE =
  ' One single continuous scene, one place, one moment: never a split screen, never two pictures joined together, never a cutaway or a cross-section that opens a second room below or beside the scene, never a picture inside the picture, never an inset panel or a framed rectangle floating in the frame showing another view of the same people, never black bars or borders, never a flat blank area of any colour, and the picture fills the frame from edge to edge with the scene in every part of it. Writing on a physical surface is allowed where the scene wants it, and everything written in the picture is real and correctly written Chinese: characters on a scroll, plaque, banner, signboard, flag, book, tablet, paper, letter, note, chart, map, ledger, seal, couplet, memorial, register, stall label, price tag, tally board, market placard or product label are Chinese characters of the period, never pseudo-calligraphy, never illegible glyph-like scribbles, never mush, never any Latin or English letters and never a watermark. The picture reaches every edge of the frame with the scene itself: no unpainted margin, no torn-paper border, no white edge, no deckled edge, no blank canvas at any corner and no frame drawn around the picture. No Latin or English letters anywhere in the picture: not on a map or chart or label or ledger, not on a package or wrapper or poster, not on a signboard or a machine or an instrument, and never a Roman-letter logo, monogram or initial. A surface that the scene does not describe as carrying an inscription carries none: no scroll, no plaque, no couplet, no stele, no signboard, no chart and no map, and no writing of any kind on a banner, a wall, a tablet, a board or a sheet that hangs or stands in the picture, unless the scene asks for that writing. What is never allowed: characters that are not on a surface at all, not formed in light, smoke or mist and not standing as glowing glyphs in a formation or an array. Cinematic atmospheric digital painting, painterly, luminous and high contrast, one clear readable subject against a simpler background, one vivid accent colour lighting the scene. One object in the scene makes the world unmistakable at a glance. The main subject is close enough to read their face, clearly lit and turned toward the viewer. Wide horizontal composition: the picture is a landscape scene across the full frame, never a narrow vertical panel with empty margins at the sides. Nothing appears in the picture that the scene does not describe. People, if any appear, are clearly East Asian (Chinese) with black hair. Every character in the picture is a real Chinese character on a real object.'

// The ending is the last picture of one life, and it is the only picture in
// the game that gets looked at twice: a vertical crop of its middle half on
// the fate card and in the archive, and the whole frame on the ending page
// and in the lightbox. The subject has to stand in the middle of the frame
// and be close enough to read, or the crop loses it.
//
// It is also the one picture with no next page after it. A scene picture can
// be busy, because the reader is about to move on; an ending has to land.
// So the ending asks for one decisive moment and one subject, and nothing
// else competing for attention.
const ENDING_STYLE =
  STYLE +
  ' One decisive moment and one clear subject close enough to read, filling the middle of the picture with nothing else in the scene competing for attention: the face, the gesture or the object that carries the ending stands in the middle of the picture, large and unobstructed. The mood is final, because this is the last picture of one life and the reader has to feel it at a glance.'

// A badge is an emblem, not a picture of a thing. It lives in a 300px round
// medallion in the achievement panel, and the whole set has to read as one
// family at that size.
//
// The general style was the problem: it says "one single continuous scene"
// and "people, if any appear", and a badge prompt says "a single X, large
// and centred" -- which the model reads as a scene that happens to contain
// an X. That is how a medallion became a battlefield, a ship wheel came
// back inside a rectangular picture frame, and a hand mirror came back
// with a hand holding it.
//
// So the badge gets its own style line: one object, isolated, inside a
// complete round medallion, on a plain dark field, with nothing behind it
// and nobody in it.
const BADGE_STYLE =
  ' An emblem, not a scene: one single object, large and centred, isolated on a plain deep midnight-blue field, standing inside the whole round filigree medallion, whose rim is complete and circular. The medallion is a round frame around the object, never a rectangular panel, and the object stands inside it rather than replacing it. Every floret, scroll and crest of the medallion rim is a plain symmetrical leaf or flower shape, and the rim itself carries no character, no symbol, no seal and no monogram. No landscape, no room, no floor, no sky, no crowd, no hands and no person: behind the medallion there is nothing but the plain dark field. The object alone is lit and carries the whole meaning. Cinematic atmospheric digital painting, painterly, rich detail, strong contrast between the lit object and the dark field. Writing on the object is allowed where the emblem wants it, and everything written on it is real and correctly written Chinese, never pseudo-calligraphy, never illegible glyph-like scribbles and never any Latin or English letters, with no watermark.'

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}
const BATCH = Number(arg('batch', 1)) // requests per connector call
const CONC = Number(arg('concurrency', 1)) // connector calls in flight
const KINDS = arg('kinds', 'node,theme,cover,ending,achievement').split(',').map((s) => s.trim())
const STATE_FILE = path.join(ROOT, arg('state', 'scripts/.regen-state.json'))
const RESOLUTION = arg('resolution', '') // 留空 = 每一类按展示面登记表推导自己的档位
const ASPECT = arg('aspect', '') // 调试用：留空则画幅按展示面登记表推导
const QUALITY = Number(arg('quality', 82))
const LIMIT = Number(arg('limit', Infinity))
const START = Number(arg('start', 0))
// --only a,b,c: render just these slots (paths, or the tail of a path like
// "cover-xian.webp"). Used to put a known-bad picture at the head of the queue
// instead of waiting for the whole library to reach it.
// --shard i/n: take only the slots that hash into shard i, so several
// renderer processes can work on one queue without overlapping.
const SHARD = arg('shard', '')
const [SHARD_INDEX, SHARD_COUNT] = SHARD ? SHARD.split('/').map(Number) : [0, 1]
const ONLY = arg('only', '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
// --force renders the named slots even when they are already marked done
const FORCE = argv.includes('--force')
const DL = Number(arg('dl', 4))

fs.mkdirSync(RAW, { recursive: true })
fs.mkdirSync(ARGS_DIR, { recursive: true })

const inv = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/art-inventory.json'), 'utf8'))
const prompts = JSON.parse(fs.readFileSync(path.join(ROOT, 'design/art-prompts.json'), 'utf8'))
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : { done: [], failed: {} }

// ── slot list ──
// One entry per art slot that has a prompt, with the aspect/resolution its
// surface needs, and the composition rule that surface implies.
// Both come from scripts/art-surfaces.mjs: it registers every place each kind
// of art is shown (with the real box, fit and how much text sits on top), and
// derives from those the one region every surface can see. The scene is
// composed for that region, so the same picture reads correctly in the VN
// stage, on the scenario card, in the share banner and in the og image.
// `out` must be unique across the whole run: the connector names the produced
// file after it, so derive it from the path, not from the file name alone
// (a node and an ending can share the same art id).
// The composition clause is a continuation of the scene, not a new sentence:
// the prompt ends with a full stop and the clause starts in lower case, so
// joining them naively gives "…quiet and expectant. the scene spreads…".
function withClause(prompt, clause) {
  if (!clause) return prompt
  return `${prompt.replace(/[.。]\s*$/, '')}, ${clause.replace(/^[,\s]+/, '')}`
}

const PLANS = {}
for (const kind of ['node', 'theme', 'cover', 'ending', 'achievement']) PLANS[kind] = planFor(kind)
// The prompt a slot was rendered from, fingerprinted. The prompt library gets
// edited as a set -- a rule that fixes one bad render usually applies to
// hundreds of prompts -- and a file on disk that no longer matches its prompt
// has to be rendered again. Only the prompt is hashed: a style change applies
// to every slot at once and would throw the whole library away.
//
// Two things are deliberately outside the fingerprint:
//
//   - the style suffix (STYLE / COVER_STYLE / ENDING_STYLE / BADGE_STYLE), so
//     that tightening a rule costs no quota until the slots are re-rendered
//     by hand;
//   - the composition clause, because it is derived from the surface registry
//     (scripts/art-surfaces.mjs) rather than written per prompt. A layout
//     change therefore does not re-render the library on its own -- that is
//     the deliberate trade: re-rendering two thousand good pictures because a
//     box moved three pixels is worse than asking for it explicitly.
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12)
const jobs = []
const skipped = []
for (const i of inv.items) {
  if (!(i.kind in PLANS) || !KINDS.includes(i.kind)) continue
  // achievement prompts are keyed by badge id (`-|<id>`); the rest by
  // `<scenarioId>|<label>`
  const key = i.kind === 'achievement' ? `-|${i.slot}` : `${i.scenario}|${i.label}`
  const prompt = prompts[key]
  if (!prompt) {
    skipped.push(`${i.kind}:${key}`)
    continue
  }
  const plan = PLANS[i.kind]
  const style =
    i.kind === 'cover' ? COVER_STYLE
    : i.kind === 'ending' ? ENDING_STYLE
    : i.kind === 'achievement' ? BADGE_STYLE
    : STYLE
  jobs.push({
    kind: i.kind,
    path: i.path,
    out: i.path.replace(/^src\/assets\//, '').replace(/\//g, '-').replace(/\.webp$/, ''),
    prompt: withClause(prompt, clauseFor(plan)),
    style: eraStyle(prompt, style),
    hash: hashOf(prompt),
    aspect: ASPECT || plan.aspect,
    resolution: RESOLUTION || plan.resolution,
  })
}
// 出图顺序跟着 --kinds 走。清单本身是按题材排的（封面、结局、节点、主题，最后才是
// 徽章），而 --kinds 决定先出哪一类：徽章和封面是最便宜的两种实测——徽章量出 1K 1:1
// 到底给多少像素（定徽章的档位），封面量出 16:9 的原生像素（定封面的规格）。
// 这两个数一拿到，剩下的 2000 多张就不用再猜了。
jobs.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind))

if (skipped.length) {
  const byKind = skipped.reduce((a, s) => ((a[s.split(':')[0]] = (a[s.split(':')[0]] || 0) + 1), a), {})
  console.log(`skipped (no prompt yet): ${JSON.stringify(byKind)}`)
}

// ── helpers ──
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts })
}

// mcode-tools ships as a .cmd wrapper; Node >=20 refuses to spawn .cmd without a shell.
function mcode(args) {
  return execFileAsync('mcode-tools', args, {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 256 * 1024 * 1024,
  }).then((r) => r.stdout)
}

// The connector renders at the requested aspect ratio; the art is laid out 3:2, and
// the backend does support 3:2 (its documented enum is incomplete). No crop, no
// rescale: the native render is kept as-is and webp does the compression.
function encode(rawPng, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', rawPng,
    '-c:v', 'libwebp', '-q:v', String(QUALITY), '-compression_level', '6',
    dest,
  ])
  const sz = fs.statSync(dest).size
  if (sz < 8192) throw new Error(`encoded file too small: ${sz}B`)
  return sz
}

// The scenario cards show a 512px square thumb of the cover instead of the
// full 2752px one: the card paints 252 CSS px, so the full cover would put
// ten images of ~200 KB on the first screen for 504 pixels of paint.
// The thumb is the same centre square the card crops, so it is the same
// picture at a tenth of the bytes. Re-rendering a cover has to re-cut it.
function encodeThumb(coverPath, id) {
  const dest = path.join(ROOT, 'src/assets/cover-thumbs', `${id}.webp`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', coverPath,
    '-vf', 'crop=ih:ih:(iw-ih)/2:0,scale=512:512',
    '-c:v', 'libwebp', '-q:v', String(QUALITY), '-compression_level', '6',
    dest,
  ])
  return fs.statSync(dest).size
}

// The fate card and the ending gallery show a vertical 3:4 crop of the ending
// -- the middle half of its width -- at 384 CSS px and 105 CSS px. The ending
// itself is 2528x1696, so those two surfaces would download the whole 2K file
// to paint 768 and 210 device pixels of it. The thumb is that same crop at
// exactly the size the card paints: the same picture, a fraction of the bytes.
// Re-rendering an ending has to re-cut it.
function encodeEndingThumb(endingPath, name) {
  const dest = path.join(ROOT, 'src/assets/ending-thumbs', `${name}.webp`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', endingPath,
    '-vf', 'crop=ih*3/4:ih:(iw-ih*3/4)/2:0,scale=768:1024',
    '-c:v', 'libwebp', '-q:v', String(QUALITY), '-compression_level', '6',
    dest,
  ])
  return fs.statSync(dest).size
}

async function download(url, dest) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`http ${r.status}`)
  fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()))
}

// `restyle` lists slots that were rendered with an earlier style suffix. They are
// on disk and counted as done, but their look does not match the rest of the
// library, so they are re-queued: the style suffix is part of the prompt, and a
// different suffix means a different image.
const restyle = new Set(state.restyle || [])
const doneSet = new Set(state.done.filter((p) => !restyle.has(p)))

// A kind rendered at a different tier than the plan asks for now is stale: the
// file on disk was made with the old tier, so it is rendered again. The tier
// each kind was last rendered at lives in the state file next to the done list.
const tiers = state.tiers || {}
for (const kind of KINDS) {
  const want = PLANS[kind]?.resolution
  const had = tiers[kind]
  if (!had || !want || had === want) continue
  const stale = jobs.filter((j) => j.kind === kind && doneSet.has(j.path))
  for (const j of stale) {
    restyle.add(j.path)
    doneSet.delete(j.path)
  }
  if (stale.length) console.log(`tier changed for ${kind}: ${had} -> ${want}; re-rendering ${stale.length} slot(s)`)
}

// A slot rendered from an older prompt is stale in the same way: the prompt
// library was edited after the file was made, and the picture on disk no
// longer shows what its prompt says.
const hashes = state.hashes || {}
const stalePrompts = jobs.filter((j) => hashes[j.path] && hashes[j.path] !== j.hash)
for (const j of stalePrompts) {
  restyle.add(j.path)
  doneSet.delete(j.path)
}
if (stalePrompts.length) {
  console.log(`prompt changed for ${stalePrompts.length} slot(s); re-rendering`)
  // the restyle list is what the state file records, not this set
  state.restyle = [...restyle]
}

// a manual --only render must work no matter which shard owns the slot
const mine = SHARD_COUNT > 1 && !ONLY.length ? jobs.filter((j) => shardOf(j.path, SHARD_COUNT) === SHARD_INDEX) : jobs
const pending = mine.filter((j) => !doneSet.has(j.path) || (FORCE && ONLY.some((o) => j.path === o || j.path.endsWith(o))))
const todo = (ONLY.length ? pending.filter((j) => ONLY.some((o) => j.path === o || j.path.endsWith(o))) : pending).slice(START, START + LIMIT)

console.log(
  `slots: ${jobs.length} total · ${state.done.length} already done · ${pending.length} pending · ` +
    `batch ${BATCH} × concurrency ${CONC} · ${Object.entries(PLANS).map(([k, p]) => `${k}=${ASPECT || p.aspect}@${RESOLUTION || p.resolution}`).join(' ')} q${QUALITY}`,
)
if (!todo.length) {
  console.log('nothing to do')
  process.exit(0)
}

const batches = []
for (let b = 0; b < todo.length; b += BATCH) batches.push(todo.slice(b, b + BATCH))

let produced = 0
let failed = 0
let quotaHit = false
const t0 = Date.now()
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))

async function handleBatch(chunk, id) {
  // the process id keeps two renderers from overwriting each other's arguments
  const argsFile = path.join(ARGS_DIR, `batch-${process.pid}-${id}.json`)
  fs.writeFileSync(
    argsFile,
    JSON.stringify({
      requests: chunk.map((j) => ({
        prompt: j.prompt + j.style,
        aspect_ratio: j.aspect,
        resolution: j.resolution,
        output_file: j.out,
      })),
    }),
  )

  let res
  try {
    res = JSON.parse(await mcode(['connector', 'call', 'connector__matrix__generate_image', '--args-file', argsFile]))
  } catch (e) {
    console.error(`batch ${id}: connector call failed — ${String(e.message).slice(0, 200)}`)
    return
  }
  if (res.code !== 0) {
    // 402 = the account's plan balance is used up. That is a billing limit, not a
    // transient error: stop the whole run instead of burning through the remaining
    // batches, and let the caller resume once the balance refills.
    if (res.code === 402) {
      quotaHit = true
      console.error(`batch ${id}: QUOTA EXHAUSTED — ${res.message}`)
    } else {
      console.error(`batch ${id}: code=${res.code} ${res.message}`)
    }
    return
  }
  const ok = res.success_items || []
  console.log(
    `batch ${id}: ${chunk.length} requested, ${ok.length} ok, ${(res.failed_items || []).length} failed (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`,
  )
  for (const f of res.failed_items || []) console.log('  FAILED-GEN', JSON.stringify(f).slice(0, 200))

  const pairs = []
  for (const item of ok) {
    // the connector picks the extension (.png / .jpg), so match on the stem
    const base = String(item.file_name || '').replace(/\.[^.]+$/, '')
    const job = chunk.find((c) => c.out === base)
    if (!job) {
      console.log('  UNMATCHED', item.file_name)
      continue
    }
    pairs.push({ job, node_id: item.node_id })
  }

  let next = 0
  const workers = Array.from({ length: Math.min(DL, pairs.length) }, async () => {
    while (next < pairs.length) {
      const { job, node_id } = pairs[next++]
      const dest = path.join(ROOT, job.path)
      const rawPng = path.join(RAW, `${job.out}.png`)
      try {
        const u = JSON.parse(await mcode(['get_asset_url', node_id]))
        await download(u.download_url, rawPng)
        // 量一下连接器真正给了多少像素：规格不该靠猜，实测值写进登记表
        const dims = measureImage(rawPng)
        if (dims && recordNative(job.resolution, job.aspect, dims)) {
          console.log(`  native ${job.resolution} ${job.aspect} = ${dims[0]}x${dims[1]}`)
        }
        // ffmpeg occasionally fails on a perfectly good raw (transient libwebp
        // hiccup). Retry the encode, then re-fetch the raw and try once more —
        // a truncated download is the other cause and needs fresh bytes.
        let sz
        try {
          sz = encode(rawPng, dest)
        } catch {
          await new Promise((r) => setTimeout(r, 1500))
          try {
            sz = encode(rawPng, dest)
          } catch {
            try { fs.rmSync(rawPng, { force: true }) } catch {}
            await download(u.download_url, rawPng)
            sz = encode(rawPng, dest)
          }
        }
        if (!state.done.includes(job.path)) state.done.push(job.path)
        doneSet.add(job.path)
        delete state.failed[job.path]
        if (restyle.delete(job.path)) state.restyle = [...restyle]
        state.tiers = state.tiers || {}
        state.tiers[job.kind] = job.resolution
        state.hashes = state.hashes || {}
        state.hashes[job.path] = job.hash
        if (job.kind === 'cover') {
          const id = job.path.replace(/^src\/assets\/cover-/, '').replace(/\.webp$/, '')
          const tsz = encodeThumb(dest, id)
          console.log(`  thumb cover-thumbs/${id}.webp ${(tsz / 1024).toFixed(0)}KB`)
        }
        if (job.kind === 'ending') {
          const name = job.path.replace(/^src\/assets\/endings\//, '').replace(/\.webp$/, '')
          const tsz = encodeEndingThumb(dest, name)
          console.log(`  thumb ending-thumbs/${name}.webp ${(tsz / 1024).toFixed(0)}KB`)
        }
        produced++
        console.log(`  ok ${job.path} ${(sz / 1024).toFixed(0)}KB`)
      } catch (e) {
        // a truncated / unusable download poisons ffmpeg; drop the raw so the
        // retry re-fetches instead of re-encoding the same broken bytes
        try { fs.rmSync(rawPng, { force: true }) } catch {}
        state.failed[job.path] = String(e.message || e).slice(0, 200)
        failed++
        console.log(`  ERR ${job.path}: ${String(e.message || e).slice(0, 160)}`)
      }
    }
  })
  await Promise.all(workers)
  saveState()
}

let nextBatch = 0
async function batchWorker() {
  for (;;) {
    if (quotaHit) return
    const i = nextBatch++
    if (i >= batches.length) return
    await handleBatch(batches[i], i)
  }
}

await Promise.all(Array.from({ length: Math.min(CONC, batches.length) }, batchWorker))

saveState()
const perImage = produced ? ((Date.now() - t0) / 1000 / produced).toFixed(1) : 'n/a'
console.log(
  `=== produced ${produced} · failed ${failed} · ${state.done.length}/${jobs.length} slots done · ` +
    `${((Date.now() - t0) / 1000).toFixed(0)}s (${perImage}s/image) ===`,
)
if (quotaHit) {
  console.error(
    'QUOTA EXHAUSTED: the MiniMax plan balance ran out. Progress is saved; re-run this script after the balance refills to continue where it stopped.',
  )
  process.exit(2)
}

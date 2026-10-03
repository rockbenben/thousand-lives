// 半角标点批量带归一（U-25，批准口径：纯排版、零文字消费）
// 只动可编辑串字段值（narrative/reaction/epilogue/intro）里的半角 , ; ? : → 全角。
// 自证：变换前后把「全部标点剥掉后的字符序列」逐字符比对，必须恒等（吞 0 内容才算过）。
// 用法: node scripts/normalize-punct.mjs <scenarioId> [--apply]
// 期望命中数由批准清单钉死：wuxia=33 sanguo=25 scifi=10 liyuan=6 wasteland=3(问号手工位,此工具不涵盖)
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const [id, flag] = process.argv.slice(2)
if (!id) { console.error('用法: node scripts/normalize-punct.mjs <id> [--apply]'); process.exit(2) }
const file = path.join(ROOT, 'src', 'scenarios', `${id}.ts`)
const src = fs.readFileSync(file, 'utf8')

// 剥掉所有标点后的骨架（零消费判据）
const skeleton = (s) => s.replace(/[，。、；：？！「」『』《》（）“”‘—…·,.:;!?"'()\[\]{}#%&*+\-/\\<>@^$~= \t\r\n]/g, '')

// 找可编辑串字段里的半角标点命中：扫 `'…'` 字面量，看它前面紧邻的 key
const hits = []
const re = /(?:narrative|reaction|epilogue|intro)(?:\?\?)?\s*[:=]\s*'((?:[^'\\]|\\.)*)'/g
let m
while ((m = re.exec(src))) {
  const val = m[1]
  const half = val.match(/[,;:?]/g)
  if (half) hits.push({ at: m.index, val, half: half.length })
}
let out = src
for (const h of hits) out = out.replace(`'${h.val}'`, () => `'${h.val.replaceAll(',', '，').replaceAll(';', '；').replaceAll('?', '？').replaceAll(':', '：')}'`)

const nStrings = hits.length
const nChars = hits.reduce((a, h) => a + h.half, 0)
if (skeleton(out) !== skeleton(src)) { console.log('FAIL: 骨架不恒等，存在文字消费'); process.exit(1) }
console.log(`${id}: 命中 ${nStrings} 条可编辑串 / ${nChars} 个半角字符 · 骨架恒等 PASS`)
if (flag === '--apply') {
  fs.writeFileSync(file, out, 'utf8')
  console.log(`${id}: 已落盘（可再跑本脚本核验归零）`)
}

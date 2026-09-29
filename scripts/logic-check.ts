// 剧本逻辑结构审查 CLI：判据在 src/scenarios/logicAudit.ts，守卫在 src/scenarios/logic.test.ts。
// 用法：npx vite-node scripts/logic-check.ts [scenarioId|all]
//   （本机无 vite-node 时：node .design-qa/run.mjs scripts/logic-check.ts all）
import { builtinScenarios } from '../src/scenarios'
import { auditScenarioLogic } from '../src/scenarios/logicAudit'

const arg = process.argv[2] ?? 'all'
const ids = arg === 'all' ? builtinScenarios.map((s) => s.id) : [arg]
let total = 0
for (const id of ids) {
  const sc = builtinScenarios.find((s) => s.id === id)
  if (!sc) {
    console.log(`未找到剧本 ${id}`)
    continue
  }
  const { hard, soft } = auditScenarioLogic(sc)
  total += hard.length
  console.log(
    `\n══ ${sc.title} (${sc.id})  事件 ${(sc.localEvents ?? []).length} · 结局 ${sc.endings.length} · 硬伤 ${hard.length} · 提示 ${soft.length} ══`,
  )
  for (const h of hard) console.log(`   ✗ ${h}`)
  for (const s of soft) console.log(`   · ${s}`)
}
console.log(`\n合计硬伤 ${total} 条`)

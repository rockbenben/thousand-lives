// scripts/run-ts.mjs — 免安装跑 scripts/*.ts（本机无 vite-node/tsx，用 vite 的 SSR module runner）
// 用法: node scripts/run-ts.mjs scripts/art-inventory.ts [args...]
import { createServer } from 'vite'

const [target, ...rest] = process.argv.slice(2)
if (!target) { console.error('用法: node scripts/run-ts.mjs <scripts/相对路径.ts|.mjs> [args...]'); process.exit(2) }

const server = await createServer({
  configFile: false,                       // 绕开 vite.config.ts 的 PWA/react 插件
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  logLevel: 'error',
})
process.argv = [process.argv[0], target, ...rest]
// Git Bash 会改写以 / 开头的参数：约定入参是仓库根相对路径，前导斜杠在这里补
await server.ssrLoadModule('/' + target.replaceAll('\\', '/'))
await server.close()

import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    environment: 'node',
    // 排除仓库内 git-ignored 的 agent worktree，避免其副本测试文件被重复收集（双跑）
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})

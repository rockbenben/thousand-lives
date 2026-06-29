import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 小图标 / favicon 一并预缓存；大量配图与字体走运行时缓存（见下），避免 SW 安装时下载上百张图
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '千世书 · AI 文字人生模拟器',
        short_name: '千世书',
        description: 'AI 文字人生模拟器 · 十大题材 · 免 Key 即玩，一卷千世，活过千种人生。',
        lang: 'zh-CN',
        theme_color: '#080b18',
        background_color: '#080b18',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 预缓存应用外壳：JS/CSS/HTML + 图标。配图(webp)与字体不进预缓存，改运行时按需缓存
        globPatterns: ['**/*.{js,css,html}', 'pwa-*.png'],
        // 主 bundle 约 1.4MB，抬高单文件上限确保被预缓存
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // 仅 SPA 内部路由走 index.html 兜底；静态资源 / 预生成分享入口页 / 任何带扩展名的文件一律放行回源，
        // 否则 SW 会把它们当导航请求兜成应用外壳 HTML——直接打开图片 URL 会拿到 HTML，/s/ 入口页也会被根 index.html 顶掉
        navigateFallbackDenylist: [/^\/assets\//, /^\/og\//, /^\/s\//, /\.[^/]+$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // 哈希命名的配图，内容不可变 → CacheFirst
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'art-images',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'self-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  base: './',
  test: {
    environment: 'node',
    // 排除仓库内 git-ignored 的 agent worktree，避免其副本测试文件被重复收集（双跑）
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})

# 开发

> 返回 [README](../README.md)

## 环境要求

Node.js ≥ 20（Vite 8 / Vitest 4 要求）。

## 常用命令

```bash
npm install
npm run dev    # 启动开发服务器（热更新），访问 http://localhost:5173
npm test       # 运行 Vitest 单元测试（覆盖 engine / AI 层）
npm run build  # TypeScript 类型检查 + Vite 打包 → dist/
npm run preview # 本地预览生产构建
```

纯静态站点，`vite base: './'` 走相对路径，可部署到任意子路径。将 `dist/` 部署到任意静态托管即可（GitHub Pages / Vercel / Cloudflare Pages 等）。

## 目录结构

```
src/
├── engine/      # 核心引擎：属性结算、状态分段、结局判定、评级、关键抉择、上下文压缩、成就、本地引擎
├── ai/          # AI 适配层：三协议适配器、服务商预设、回合生成、剧本生成、重试与 JSON 纠错
├── scenarios/   # 剧本：schema 校验（Zod）+ 10 个内置剧本数据（含本地事件池）
├── ui/          # React 界面：主页 / 游戏页 / 设置 / 结局卡 / 命运卡分享弹窗 / 社交分享 / 挑战链接 / 命途留影 / 成就 / AI 生成弹窗
├── assets/      # 内置剧本封面、结局图、节点插画、成就徽章（webp）
├── storage.ts   # localStorage 存档与设置读写
└── App.tsx      # 路由与全局状态
```

## 社交分享入口页

`scripts/gen-og-pages.mjs` 预生成社交分享入口页 → `public/s/`，题材 OG 封面置于 `public/og/`。这些页面已随仓库提交并会被 `npm run build` 一并打包。

改动内置剧本标题 / 开局后，重跑：

```bash
npx vite-node scripts/gen-og-pages.mjs
```

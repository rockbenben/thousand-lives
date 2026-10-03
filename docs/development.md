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

免安装等价命令（须从仓库根运行，下同）：

```bash
node scripts/run-ts.mjs scripts/gen-og-pages.mjs
```

生成器输出是确定性的（无时间戳），`public/s/` 随仓库提交。新鲜度判据：重跑后差集为空——

```bash
git diff --exit-code public/s   # 非零 = 已提交页面落后于剧本，把重生成结果一并提交
```

判生成文件漂移一律用 `git diff --exit-code`，别看 `git status`：autocrlf 对重生成的文件会显示假 M。

## 配图清单与出图

`src/assets/` 的 2092 个配图槽位由**剧本源码**决定，不由磁盘决定 —— 所以新事件即使还没图也会出现在清单里，而不是静默回退到主题图：

```bash
npx vite-node scripts/art-inventory.ts   # 重新枚举 → design/art-inventory.json（缺图 / 尺寸 / 孤儿对账）
```

免安装等价命令：

```bash
node scripts/run-ts.mjs scripts/art-inventory.ts
```

补图用的英文场景提示词缓存在 `design/art-prompts.json`（键 `scenario|中文标题`），清单会把它带进对应槽位的 `prompt` 字段。
新增结局 / 本地事件不必先手写 `art`：清单按 `djb2(tone | summary)` 给出稳定文件名，图落到位即生效。但**改现有 tone / summary 之前必须先把 `art` 显式写进源码**，否则旧图立刻变孤儿。

提示词记的是**出图当时**的画面，不随正文润色回改——润色只动散文字段，画面里出现的器物可能与新文案有出入。已知一处：`spy|密写药水` 的提示词写 `a worn frayed Bible`，而该事件正文已按裁决改作「旧历书」（`docs/superpowers/audit/2026-10-03-phase2-acceptance.md` §9）。**重出某张图时顺手把提示词校到当前正文**，不要反过来为迁就旧图改文字。

## 文本/剧本改动闸门

改动剧本或文本后按顺序全部通过再提交：

1. `npx tsc --noEmit` —— 类型检查。
2. `npm test` —— 单元测试。
3. `node scripts/run-ts.mjs scripts/art-inventory.ts` —— stdout 的「带现成英文提示词」计数不得下降；用 `git diff --exit-code design/` 判清单是否漂移，该留的提交、不该留的检出还原。
4. `node scripts/run-ts.mjs scripts/gen-og-pages.mjs` 后 `git diff --exit-code public/s` 为空——非空说明已提交的分享入口页落后于剧本，把重生成结果一并提交。

漂移判定都用 `git diff --exit-code` 而非 `git status`（见上节 autocrlf 假 M 的坑）。

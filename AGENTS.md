# AGENTS.md

千世书 · thousand-lives —— AI 文字人生模拟器。纯前端静态站：10 个内置剧本，可再用一句主题让 AI 现场生成新剧本。Node 20+ / Vite 8 / React 19 / TypeScript 6 / Vitest 4。

## 常用命令

- 装依赖：`npm ci`
- 开发：`npm run dev`
- 构建：`npm run build`（= `tsc --noEmit && vite build` → `dist/`）
- 测试：`npm test`（Vitest）
- 类型检查：`npx tsc --noEmit`
- 跑 `scripts/` 里的 .ts（本机没装 vite-node）：`node scripts/run-ts.mjs scripts/<file>.ts`

## 目录

- `src/engine/` — 核心引擎：属性结算、状态分段、结局判定、评级、关键抉择、成就、本地引擎
- `src/ai/` — AI 适配层：三协议适配器、服务商预设、回合生成、剧本生成、重试与 JSON 纠错
- `src/scenarios/` — 剧本数据与 schema 校验（10 个内置剧本）
- `src/ui/` — React 界面
- `src/assets/` — 配图：2092 个槽位（封面 / 结局 / 节点 / 主题 / 徽章）
- `scripts/` — 出图管线与校对工具（**不在 tsc 范围**，语法由 `verify-art.mjs` 兜底）
- `design/` — 配图提示词库、出图清单、OG 卡片模板
- `public/` — og 图、分享入口页、字体分片
- `docs/` — 面向人的文档（`docs/superpowers/` 是本地审计档案，不入库）

## 生成物：重跑，不要手改

| 文件 | 生成命令 |
|---|---|
| `design/art-inventory.json` | `node scripts/run-ts.mjs scripts/art-inventory.ts` |
| `public/s/**` | `node scripts/run-ts.mjs scripts/gen-og-pages.mjs` |
| `public/og/*.jpg` | `node scripts/gen-og-images.mjs` |
| `src/assets/ending-thumbs/**` | `node scripts/gen-ending-thumbs.mjs` |
| `src/assets/cover-thumbs/**` | `node scripts/gen-cover-thumbs.mjs` |
| `src/ai/providerCatalog.generated.ts` | 上游仓的 provider 目录同步脚本（本仓没有）；文件头已写明别手改 |

判漂移一律用 `git diff --exit-code <路径>`，**不要用 `git status`**：autocrlf 会给重生成的文件显示假 M。

## 代码风格

- TypeScript strict（`noUnusedLocals` / `noUnusedParameters` 开着），ESM（`package.json` 的 `type: module`）
- 单引号、2 空格缩进、不写分号；没有 eslint / prettier 配置，风格跟现有代码
- 注释写「为什么」不写「做了什么」——这里的注释是决策记录（为什么当初那么选、踩过什么坑），改正文前先读它
- `src/` 多用中文注释，`scripts/` 多用英文注释

## 测试

- Vitest，测试与源码同目录（`src/**/*.test.ts`）
- 新增行为要配测试；`src/scenarios/*.test.ts` 钉着剧本的不变量，改剧本先跑它们
- 提交前闸门：`npx tsc --noEmit` → `npm test` → 改了剧本或提示词再 `node scripts/run-ts.mjs scripts/art-inventory.ts`（「带现成英文提示词」计数不得下降）→ 动了配图再 `node scripts/verify-art.mjs`（退出码 0 才算过）

## 配图管线

- **规格只有一处来源**：`scripts/art-surfaces.mjs` 登记每类配图出现在哪些展示面（真实盒子、object-fit、压了多少文字），由它推出画幅、原生像素与构图指令。改版式回来改它，**别去改提示词**。
- 提示词指纹只哈希场景提示词：改风格后缀不重排队、不烧额度；改某一条提示词才重排那一张。构图指令不在指纹里，所以改版式不会自动重画图库。
- 单张重出：`node scripts/regen-art.mjs --kinds <类型> --state <状态文件> --only "<文件名.webp>" --force --batch 1 --concurrency 1 --limit 1`（一次一张，别并行）。整批交给 `regen-art-supervisor.mjs`。
- 状态文件 `scripts/.regen-state*.json` 是 gitignore 的，别提交。
- 审图靠带文件名标签的联览图逐格看；`scripts/detect-seams.mjs` 只筛不判，每一条都要人眼过。

## 剧本身份字段是键，不是文案

结局 `tone`、事件 `summary`、事件/结局 `title`、开场名、成就名默认不改：它们是 `design/art-prompts.json` 的键、`achievementConfig.ts` 的硬编码、旧存档 `tl.endings`、`challengeLink` 反查与钉住测试串的依据。润色只动散文字段（`narrative` / `epilogue` / `reaction` 等）。真要改身份字段，走单独的迁移清单：改提示词键 → 同步成就配置 → 更新钉住测试 → 重跑 `gen-og-pages.mjs`。详见 `DESIGN.md`。

## 提交

- 按功能相关性分组，一个 commit 一个逻辑单元
- commit message 用英文（Conventional Commits 标题 + 英文正文），不写 AI 署名；已写好的 message 不要改
- 动 `src/assets/` 的大批产物时分批提交，只提 `src/assets/` 与 `public/`
- 部署是 push 到 `main` 触发 `.github/workflows/deploy.yml`（`npm run build` → 推到 `gh-pages`），所以推之前先确认本地要发的就是线上要的

## 安全

- 不提交密钥：`.env*` 已在 `.gitignore`；API Key 只落在用户浏览器的 `localStorage`
- 必须走中转的服务商只转发白名单域名，纯透传、不落日志

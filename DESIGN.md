---
version: alpha
name: 千世书 · 玄夜鎏金书卷（Night-Scroll Design Contract）
description: 从 src/styles.css、src/ui 组件与 hooks 静态捕获的既有设计系统契约。深空绀青为底、鎏金为文、朱砂为印——「卷页 + 钤印」的器物语言。本文件是 Task 6/7 审查的基线标尺。
colors:
  canvas: "#080b18"
  surface: "#0e1430"
  surface-raised: "#141d40"
  surface-hover: "#1c2654"
  ink: "#dcdcef"
  ink-dim: "#b4b8d8"
  muted: "#868bb2"
  hairline: "#28326a"
  hairline-gold: "rgba(203, 168, 90, 0.42)"
  primary: "#cba85a"
  primary-bright: "#ecd28f"
  on-primary: "#1a1530"
  seal: "#c9503a"
  seal-bright: "#e0704e"
  on-seal: "#f3e4c8"
  danger: "#e0704e"
  success: "#6fae9b"
typography:
  display-xl:
    fontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'STZhongsong', 'Songti SC', 'SimSun', serif"
    fontSize: 80px
    fontWeight: 400
    letterSpacing: 0.18em
  display-lg:
    fontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'STZhongsong', 'Songti SC', 'SimSun', serif"
    fontSize: "clamp(1.9rem, 8.4vw, 3.4rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: 0.1em
  heading-md:
    fontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'STZhongsong', 'Songti SC', 'SimSun', serif"
    fontSize: "clamp(1.35rem, 1.05rem + 1.1vw, 1.6rem)"
    fontWeight: 400
    lineHeight: 1.22
    letterSpacing: 0.1em
  heading-sm:
    fontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'STZhongsong', 'Songti SC', 'SimSun', serif"
    fontSize: 1.9rem
    fontWeight: 400
    letterSpacing: 0.32em
  body-md:
    fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, 'SimSun', serif"
    fontSize: "calc(17px * var(--font-scale))"
    fontWeight: 400
    lineHeight: 1.95
    letterSpacing: 0.01em
  body-sm:
    fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, 'SimSun', serif"
    fontSize: 0.82rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0px
  caption:
    fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, 'SimSun', serif"
    fontSize: 0.74rem
    fontWeight: 400
    lineHeight: 1.5
  eyebrow:
    fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, 'SimSun', serif"
    fontSize: 0.66rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0.34em
  button-md:
    fontFamily: "'LXGW WenKai', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', 'Songti SC', STSong, 'SimSun', serif"
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0.15em
  seal-glyph:
    fontFamily: "'Ma Shan Zheng', 'Kaiti SC', STKaiti, KaiTi, '楷体', cursive"
    fontSize: 0.9rem
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: 0px
  roman-inscription:
    fontFamily: "'Cinzel', 'Noto Serif SC', serif"
    fontSize: 0.82rem
    fontWeight: 400
    letterSpacing: 0.55em
rounded:
  none: 0px
  xs: 2px
  sm: 3px
  md: 5px
  lg: 8px
  xl: 10px
  pill: 999px
  full: 50%
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 22px
  xl: 28px
  xxl: 46px
  section: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-bright}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-default:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-default-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "10px 18px"
  button-disabled:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
  choice-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "13px 16px 13px 20px"
  choice-option-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.primary-bright}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "13px 16px 13px 20px"
  card-scenario:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "22px 20px"
    minHeight: "190px"
  card-scenario-hover:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.none}"
    padding: "22px 20px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: "18px 22px"
  modal:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: "26px 26px 22px"
    width: "520px"
  lightbox:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    padding: "24px"
    height: "100vh"
  seal-cinnabar:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.on-seal}"
    typography: "{typography.seal-glyph}"
    rounded: "{rounded.sm}"
    size: "2.2em"
  typewriter-narrative:
    textColor: "{colors.ink}"
    typography: "{typography.body-md}"
  statusbar-vital-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-dim}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "3px 12px"
---

## Overview

千世书是纯 React/Vite 单页应用，没有组件库、没有 Tailwind：全部视觉集中在一张全局样式表 `src/styles.css`（约 2300 行）加 `src/fonts.css`（字体分片），组件样式以全局 CSS 类名约定实现。视觉语言为「玄夜书卷」：**绀青深夜为底、鎏金为文、朱砂为印**——面板即卷页（内嵌金色细框），关键状态与落定动作以朱砂小印（`{colors.seal}` + 书法体 `{typography.seal-glyph}`）钤记，装饰动效取星盘缓旋与辉光呼吸。

注意与常见「宣纸底」话术的差异：本项目的 `--paper` 是**亮色文字**（`{colors.ink}` #dcdcef），`--ink-*` 系列是**深色面板**（`{colors.canvas}` 至 `{colors.surface-hover}`）——墨与纸的命名指向「以墨为夜、以纸为字」的暗色系，而非浅色宣纸底。捕获置信度：色彩/字体/间距为 `confirmed`（:root 变量与重复用法）；组件状态矩阵为 `confirmed`（styles.css 明确成对写出）；动效时长为 `likely`（散落但未集中成 token）。本文件为**静态代码捕获**，实机截图比对 待 Task 6 实机复核。

## Colors

色彩以 `:root` CSS 变量为唯一权威源（`--ink-9/8/7/6`、`--paper/--paper-dim/--muted`、`--cinnabar/--jade/--gold/--line/--line-strong`），共四层：

- **地（surface 层）**：`{colors.canvas}` #080b18 最深夜空（body 底色、输入框底），`{colors.surface}` #0e1430 面板/卡片底，`{colors.surface-raised}` #141d40 抬升面（默认按钮、hover 卡片），`{colors.surface-hover}` #1c2654 悬停再抬升。四层是同一色相的明度阶梯，不得引入第五层随意深色。
- **字（ink 层）**：`{colors.ink}` #dcdcef 主文字，`{colors.ink-dim}` #b4b8d8 次级文字，`{colors.muted}` #868bb2 弱化/提示文字。均为清冷浅紫灰。
- **金（primary 层）**：`{colors.primary}` #cba85a 为品牌与**主行动色**（本项目无高饱和品牌蓝红，`primary` 即鎏金：CTA 渐变、焦点描边、结构性细线）；`{colors.primary-bright}` #ecd28f 为 hover/强调；`{colors.on-primary}` #1a1530 为金字之上的深墨字。
- **朱（seal/danger 层）**：`{colors.seal}` #c9503a 朱砂印（选中态、封印、危急），`{colors.seal-bright}` / `{colors.danger}` #e0704e 报错文字与 hover 加剧，`{colors.on-seal}` #f3e4c8 印上文字（米白）。`{colors.success}` #6fae9b 青玉为正向（阅历增益）。警戒/低命数没有独立 warning 色——沿用 `{colors.primary}` 金色（`sev-low`、loading 呼吸），这是有意的一色多用，新增语义色前先确认无法归入金/朱/青三档。

线条：`{colors.hairline}` #28326a 幽蓝细线（分隔、输入框边），`{colors.hairline-gold}` 金色 42% 透明细线（结构性描边、滚动条）。文字之上的半透明底一律 `rgba(8, 11, 24, α)` 系（浮层徽章、角标、卷文药丸），α 取 0.4–0.92。

## Typography

四款字体栈由 `:root` 集中管理，全部离线自托管（`public/fonts`，unicode-range 分片见 `src/fonts.css`），**禁止引入 CDN 字体**：

- 正文 `{typography.body-md}`：霞鹜文楷（`--font-serif`，未达回退思源宋体），行高 1.95、字距 0.01em，叙事段首行缩进 2em。
- 标题 `{typography.display-xl|lg|heading-md|heading-sm}`：ZCOOL 小薇（`--font-display`）；**繁体模式下标题自动换用霞鹜文楷**——`html[lang="zh-Hant"]` 覆盖 `--font-display`，因小薇字库缺约 1/3 繁体专用字会单字回退成混排。改动标题字体时必须同时验证简繁两态。
- 钤印 `{typography.seal-glyph}`：马善政楷体（`--font-script`），只用于「印」类装饰字（千/择/拟/历/封），不作整句排版。
- 罗马题铭 `{typography.roman-inscription}`：Cinzel（`--font-roman`），仅英文铭刻感小字。

字号体系：根 16px（≤600px 时 15px），正文档大量使用 rem 与 `clamp()` 流式缩放。**font-scale 机制**是本契约的硬性约定：玩家可在四档（小 0.9 / 中 1.0 / 大 1.15 / 特大 1.3，`src/ui/useFontScale.ts`）间切换，值存 `localStorage('qs.fontScale')`，由 `applyFontScale` 写入根变量 `--font-scale`，阅读类文字一律 `calc(17px * var(--font-scale))`（VN 卷文为 17.5px）跟随缩放；**界面控件（按钮、标签、菜单、字号选择器本身）固定字号、不随缩放**。新增正文/选项/承接反馈类文字必须走 `calc(× * var(--font-scale))`，新增 chrome 类文字必须不乘 `--font-scale`。简繁为运行时 OpenCC DOM 转换（`LangToggle.tsx`），不设第二套文案源，字体栈按 `html[lang]` 切换。

捕获口径（frontmatter 只记源码实有属性，不补合成值）：`{typography.display-xl}` 的 fontSize 80px 为**桌面基线值**（`.logo` 的 `5rem` × 根 16px；≤600px 根降 15px，且 `.logo` 另有 `3.4rem` 显式覆盖，见 Responsive）。`.logo`、`.archive-title`、`.roman` 三处（对应 `{typography.display-xl}`/`{typography.heading-sm}`/`{typography.roman-inscription}`）源码均**未设 line-height**，计算值继承 body 的 1.95，故 frontmatter 不设 lineHeight；`{typography.caption}` 的 0.74rem 两处来源（`.ach-desc`/`.share-tip`）均**未设 letter-spacing**，计算值继承 body 的 0.01em，故不设 letterSpacing。

## Layout

单栏书卷式布局：`.app` 容器 `max-width: 820px` 居中，内距 16px、页底 48px（`{spacing.section}`）。对局页是更窄的「卷轴」：`.play` 限宽 680px（≥880px 视口 820px），全高 `100dvh - 48px`；VN 模式整屏铺画（`.play.vn` fixed 全屏），卷文区贴底浮于画上、内容居中成 800px 栏。间距节奏以 4 的倍数为主干：`{spacing.xxs}` 4、`{spacing.xs}` 8（列表/芯片 gap）、`{spacing.sm}` 12（row gap、输入间距族）、`{spacing.md}` 16（卡片 gap、panel margin）、`{spacing.lg}` 22（卡片内距、组间）、`{spacing.xl}` 28（区块 margin）、`{spacing.xxl}` 46/`{spacing.section}` 48（卷尾、页脚）。栅格仅用于卡面：剧本卡 `auto-fill minmax(220px,1fr)`、成就 `minmax(216px,1fr)`、图鉴 `minmax(104px,1fr)`。**竖排元素**：`.seal` 用 `writing-mode: vertical-rl` 竖书钤印（全站唯一竖排），题铭、眉标类靠大 `letter-spacing`（0.28–0.55em）造出匾额感；窄屏（≤560/430px）以收紧内距、标签页横向滚动应对，不重排层级。

## Elevation & Depth

没有 Material 式投影层级，纵深由四种手段构成，按「越近越亮越虚」组合使用：

1. **鎏金辉光**：`box-shadow: 0 0 Npx rgba(203,168,90,α)`（α 0.1–0.55）标记可交互与选中（hover 卡片、CTA、命运之卡呼吸辉光）；朱砂辉光 `rgba(201,80,58,α)` 只用于印与评级。
2. **墨纱渐变（veil）**：图片之上永远压 `linear-gradient(to top/bottom, {colors.canvas} …)` 暗纱保证文字可读（卡面 `rgba(8,11,24,0.15→0.94)`、卷文顶部四段渐黑）。图上文字配 `text-shadow: 0 1–2px 6–16px rgba(0,0,0,.8+)`，此为硬规则。
3. **backdrop-filter blur**：浮层类（弹层底 3–6px、HUD 药丸 6px、右上角钮 4px）。
4. **z-index 阶梯**：ambient 画底 -1 → 内容 1 → 下拉/菜单 10/30–31 → 弹窗与留影 50–60 → 徽章放大 70 → 灯箱 80 → 语言钮 90 → skip-link 100。新增浮层必须落进既有档位。

弹层遮罩统一 `rgba(2–6, 3–8, 9–18, 0.74–0.92) + blur`。禁止给页面容器加非 none 的 `transform` 入场——会让内部 `position: fixed` 弹层相对整页定位（styles.css 中已记录的实发缺陷，页面级入场只用 `fadeIn` 纯透明）。

## Shapes

圆角尺度小而有制：`{rounded.none}` 0 用于选关卡（卡面即画，靠内嵌金线 `::before inset:5px` 勾边，不切角）；`{rounded.xs}` 2px 角标/下拉项；`{rounded.sm}` 3px 印章与面板内框；`{rounded.md}` 5px 即 `--radius`——按钮、输入框、面板、选项、结局正文卡的**缺省形状**；`{rounded.lg}` 8px 弹窗/大图卡/存档空态；`{rounded.xl}` 10px 收藏条/浮出菜单；`{rounded.pill}` 999px（含 12–22px 大圆角胶囊实值）用于芯片、字号档按钮、命数药丸；`{rounded.full}` 50% 用于圆形浮钮（34px，触屏 ≥44px）。钤印方章另有硬特征：3–4px 小圆角 + `rotate(±5–8deg)` + 内嵌 1px 暗描边 + 朱砂外晕——印章必须「歪一点点」，正方的印不像钤盖。悬停位移克制：卡片上浮 3–5px、选项横移 2px、按压下沉 1px（`translateY(1px)`，「落指如钤印」）。

## Components

实现入口：全部为 `src/styles.css` 全局类 + `src/ui/*.tsx` 组件，无组件库；样式冲突以后写的同名选择器为准（`.modal` 曾发生视觉被后块覆盖的事故，改动须先看文件内两处 `.modal`）。

- **按钮**（`{components.button-primary}` / `{components.button-default}` / `{components.button-ghost}`）：`.primary` 为鎏金纵向渐变 + 600 字重 + 0.15em 字距 + 金辉光，hover 渐变提亮（`{components.button-primary-hover}`）、按压下沉 1px；默认按钮 `{components.button-default}` 抬升面底 + 金细边，hover 只提亮描边为 `{colors.primary}`；`.ghost` 完全透明、`{colors.muted}` 字，hover 恢复 `{colors.ink}`。`{components.button-disabled}` 一律 `opacity: 0.4` + `not-allowed`，不得再改颜色。loading 态无独立按钮形态：以 `.loading`（金字斜体 + pulse 呼吸）或 `.spinner`（朱砂旋针）伴随呈现。
- **输入**（`{components.text-input}` / `{components.text-input-focused}`）：深夜底 `{colors.canvas}` + `{colors.hairline}` 细边；focus 去 outline、描边换 `{colors.primary}`；键盘导航统一 `:focus-visible` 2px 金描边 + 2px offset——鼠标不显、Tab 必显，这是硬约束。非法值描朱砂（`.invalid`）。
- **卡片**（`{components.card-scenario}` / `{components.card-scenario-hover}`）：选关卡有封面时 1:1 海报化、图上压 veil 与 text-shadow，hover 上浮 5px、金边、封面上浮 70% 不透明度并微放；面板 `{components.panel}` 为卷页器物：渐变底 + `::before` 内嵌金细框 + 标题前缀「◈」。选中态范式（mode/opening）：朱砂描边 + 朱砂 8% 底 + 角部「择」字方印（`{components.seal-cinnabar}`）。
- **选项/choice**（`{components.choice-option}` / `{components.choice-option-hover}`）：正文为主角、非填色按钮——渐变幽底、透明边，hover 左缘浮出 3px 朱砂竖条 + 横移 2px + 字变 `{colors.primary-bright}`；「落子问命」关键节点整套金化。托管「拟」选在右上角加朱砂小印。
- **弹窗**（`{components.modal}`）：`.modal-backdrop`（`rgba(6,8,18,0.74)` + blur 3px）+ 器物块渐变、`{rounded.lg}`、描金 h3；宽 ≤520px（分享卡 720px）、max-height 88vh 内滚。可访问性契约（`useModalA11y.ts`）：容器必须 `role="dialog" aria-modal="true" tabIndex={-1}`；Esc/Tab 只响应**栈顶**弹窗（支持叠加，如留影上开灯箱）；Tab 焦点锁定在弹窗内，打开时移入、关闭时还原触发元素；Esc 尊重 `defaultPrevented`（内层下拉可先吞掉）。
- **灯箱**（`{components.lightbox}`）：全屏 `rgba(2,3,9,0.92)` + blur 6px，点任意处或 Esc 关闭，图 `max 94vw/84vh` contain + 金细边；hint 字 `{colors.muted}` 大字距。
- **打字机**（`{components.typewriter-narrative}`）：每 18ms 出 2 字；未写完时 `cursor: pointer` + 朱砂「▌」光标呼吸，**点击即全文跳显**；写完后撤掉 pointer 与 title（不再承诺无事可做的点击），选项区等正文落定后才 `choicesRise` 淡入——「先读完，再抉择」的节奏不可破坏。
- **状态栏**：代码中无 `.statusbar` 名，实况为 VN 顶部 HUD `.vn-hud`（`{components.statusbar-vital-pill}`）：命数药丸 = `rgba(8,11,24,0.4)` 底 + blur 6px + 金 16% 细边胶囊，状态词着色（安 `success`／平 `ink-dim`／危 `primary`／急 `danger` 且低命数呼吸闪烁），数字退后为 `{colors.muted}` tabular-nums；数值变动以 bump 动画（升绿→复原、降朱→复原 1.8s）报回。
- **钤印**（`{components.seal-cinnabar}`）：朱砂底 + `{colors.on-seal}` 米白楷字 + 3px 圆角 + 微旋转 + 内描边；用于题铭角印、结局落印（sealStamp 砸落动效）、图鉴「历/封」记。

## Do's and Don'ts

**Do**

- 颜色只引用 CSS 变量（`{colors.canvas}`–`{colors.success}` 对应的 `--*`），间距落在 4 的倍数尺度（`{spacing.xxs}`–`{spacing.section}`，既有阶梯外微调见「Token 化登记」），圆角默认 `{rounded.md}`。
- 组件里的运行时数值走 CSS 自定义属性（`cssVars()` 注入 `--fill`/`--reveal-delay`），不在内联 `style` 里写视觉属性；只有装饰性背景图允许内联并加 `inline-style-ok` 注释。
- 新增阅读类文字用 `calc(17px * var(--font-scale))`，新增界面 chrome 用固定 rem 字号——两类文字的分界即 font-scale 契约。
- 印章/择/拟/历这类「落定」记号用 `{typography.seal-glyph}` + `{colors.seal}` 方章形态（3px 角、微旋转、米白字），竖排题字用 `writing-mode: vertical-rl`。
- 篆刻封印装饰位（aria-hidden 单字，如「終」）允许古体字形，不作为简繁混排缺陷上报；除此装饰位之外的界面文字一律简体（触屏触发词统一「轻触」，集中经 `messages.ts` 单源）。
- 图上文字必须压 veil 渐变 + text-shadow；浮层必须给 `:focus-visible` 金描边并走 `useModalA11y`。
- 动效走既有语汇：`fadeUp` 入场（backwards，不用 both 钉死 transform）、辉光呼吸（pulse/logoGlow）、仪式级揭晓（fateSpinIn/edReveal ≥0.7s cubic-bezier）；并在 `prefers-reduced-motion` 下验证降级路径（压 0.01ms、旋转豁免、bump 例外保留）。
- 触屏（`@media (hover: none)`）：hover 才浮现的信息改常显，圆形钮放大到 ≥44px（40 是 WCAG 下限，本项目取 44）。

**Don't**

- 不要新增第五种面板底色、非 4 倍数的魔法间距、`{rounded}` 尺度外的圆角；不要用 Material 灰投影代替鎏金辉光。
- 不要用 emoji 充当装饰主语（现存 emoji 仅剧本图标位），不要用书法体排版正文，不要在简体语境给标题换字库而不同步 `html[lang="zh-Hant"]` 回退。
- 不要在页面级容器写 `transform`（fixed 包含块事故，见 Elevation）；不要在后续样式块重复 `.modal`/`.panel` 的视觉属性（后写覆盖曾抹掉器物感）。
- 不要引入组件库、Tailwind 或 CDN 字体来「规范化」本项目——唯一样式源是 `src/styles.css`，规范化迁移属改版决策。
- 不要修改 `disabled` 的颜色方案（只允许 `opacity: 0.4`），不要用 outline:none 而不补 `:focus-visible`。
- 不要把 identity 文本字段（tone/summary/标题）当 UI 文案改写——见「审查基线」节。

## Responsive Behavior

断点实测清单：`≤880px` 卷轴宽度收拢；`≤600px` 根字号降 15px、logo 3.4rem；`≤560px` VN 卷文限高 66vh、HUD 收紧；`≤480px` 收藏条允许换行；`≤430px` 命书阁标签改为横向滚动不折行。另有 `orientation: landscape × max-height 520px`（手机横持限卷文高度）与 `@media (hover: none)` 触屏常显两条能力查询。所有浮层定位用 `max(12px, env(safe-area-inset-*))` 避开刘海。新增页面必须复用 `.app` 容器与以上断点策略，不再造限宽值。

## Known Gaps

- 实机截图证据缺失：本契约全部来自静态源码捕获，色值/状态比对 待 Task 6 实机复核（含 muted `#868bb2` 于 `#0e1430` 上的小字对比度实测）。
- 半透明色（veil、hud、rgba 金线）有 ~20 处散写 alpha 未收敛为 token：属既有债务，Task 6 判定是否收编，勿在审查中顺手发明新 token 名。
- 无独立 warning/muted-surface token；「低命数」复用 primary 金——是否拆色属改版提案（Task 9）。
- 全局类无组件边界：`design-debt` 类扫描会把注释中的 rgba 与两值 padding 误计（已知插件误报型），引用扫描结果时先核源码。
- `src/ui/messages.ts` 集中文案极少、多数 UI 文案硬编码在各组件——文案审计（Task 7）须按全组件清单扫描，不能只盯集中表。

## 审查基线（Audit Baseline）

本文件是 Task 6（UI/UX 全页审计）与 Task 7（文案审计）的**标尺**：审查时以上述 token/组件规则与 Do/Don't 为准，偏离须作为发现记入报告，而非顺手改样式。

红线（引 spec §1「范围决定/前置事实」：`docs/superpowers/specs/2026-10-02-design-review-uiux-text-design.md`）：**identity 文本字段是键、不是文案**——结局 `tone`、事件 `summary`、事件/结局 `title`、开场名、成就名默认不改动。它们被 `design/art-prompts.json` 提示词缓存键、`achievementConfig.ts` 硬编码、旧存档 `tl.endings`、`challengeLink` 反查与钉住测试串引用；润色只吃散文字段（`narrative`、`epilogue`、`reaction` 等）。确需改身份字段时走单独的迁移清单（改提示词键、同步成就配置、更新钉住测试、重跑 `gen-og-pages.mjs`），逐条批准。UI 文案的简繁问题默认只查 `LangToggle` 运行时转换覆盖（canvas 分享卡与静态 OG 页不吃转换），不发明第二套 locale 文件。

## Token 化登记（阶段二 U-18/20 补充）

- `:root` 新增 `--r-xs/--r-sm/--r-lg/--r-xl/--r-pill/--r-full` 圆角与 `--sp-xxs..--sp-section` 间距、`--on-seal`/`--on-primary` 变量（值即本契约档位，纯引用化，计算样式实测恒等）。**圆角没有 `--r-md`**：`{rounded.md}`（5px）由既有 `--radius` 承载，写 `var(--r-md)` 会因未知自定义属性而让该条 `border-radius` 按初值（0）落地。
- 板外 hex 变体（#e6e7f4 卷文、#f5e8ca/#f1e6cf/#f9eed6 题铭亮态、#8a6f34/#f3dca0 金暗/亮变体、#586089/#5b62a0 线变体、#1a1208/#07140f 印底、#11142e 评级 D 字色、#0c1230/#080b1c/#05060f 星空渐层）为**有意微层级变体**，保留字面值不并 token——并档会抹平刻意的主次差；新增变体需先在此登记。

- U-17/U-21 追加：金/朱/墨/影四族 alpha 以 `--{fam}-aNN` 梯度 token 承载（旧画布金 201,160,92 并入金族，F-16 A）；阴影归档四档 `--shadow-glow-sm/-lift/-panel/-seal`。一次性 alpha 变体（白系、纸色低透明、星云渐层步）保留字面并计入变体登记。
- 阴影并档的一处非恒等（涉三个位点）：`.cs-bar-fill`/`.gal-bar-fill`/`.vn-path-fill` 原为 `0 0 8px rgba(203,168,90,.5)`，归 `--shadow-glow-sm`（α .55）时抬了 .05——三处父轨道均 `overflow:hidden`，8px 外辉光本就被裁掉，视觉为零，故不另立 `.5` 档。像素对照（PSNR）对「被裁掉的属性」失明，这类漂移只能靠逐位点比对发现。

- U-19 追加：`{spacing.*}` 八档之外的既有 px 值，按用途分档登记保留——`1px` 线宽级缝隙、`6/7px` 小芯片内距、`9/11/13px` 次级 gap 与内距、`14/15px` 按钮/芯片内距主档、`18/20px` 控件内距、`24/26/30px` 区块内距、`34/40/44/60px` 大留白与浮层内距。并档（±1px 归阶梯）会让 CJK 字形盒失去与 0.86–1.05rem 字号档的光学位对齐，且每一处都要目检布局抖动，收益低于代价，故一律**登记保留**；新增间距仍只准用 `{spacing.*}`，要用表外值先在此补行。**口径**：凡已作为 `{rounded.*}` 或组件 token 值出现的 px（2/3/5/10px、520px 等）不重复登记，复现计数须按此口径。
- 圆角登记（与 U-19 同口径）：`{rounded}` 尺度外的既有值 `6px`/`7px` 共 11 条声明（反应条、浮层小角、`.vn-zoom` 等，含两处与其它值混写）与非对称四写法（`.reaction` `0 6px 6px 0`、`.play-menu-panel` `14px 14px 0 0`、两枚「择」角印 `::after`（`.choice.recommended`、`.mode-card.selected`/`.opening.selected`））登记保留——共同点是「贴边/相接的一侧不切角」；`4px` 一档另由钤印方章与滚动条等既有形状句覆盖，不在此重复；新增圆角仍走 `{rounded.*}` 档位。

- U-23/F-18 追加：内联 `style` 的口径。**数据驱动量**（进度百分比、动效延迟）经 `cssVars()` 注入自定义属性 `--fill` / `--reveal-delay`，视觉属性写在 `src/styles.css` 的类规则里；**装饰性背景图绑定**（`style={{ backgroundImage: url(...) }}`）保留内联，就地标 `/* inline-style-ok: 装饰绑定 */`——它是逐实例数据，不是可复用的视觉决策。内联写颜色、圆角、间距一律算债。

## 视觉体系改版（v2）

本轮不换皮、不推翻既有语汇，在 `{colors.*}` / `{typography.*}` 之上补三层令牌，并修若干实机暴露的缺陷。`--ink-*` / `--gold` / `--cinnabar` / `--jade` 一律未动。

### 新增令牌

- **动效**：`--ease-out`（入场，快起慢收）、`--ease-out-quint`（仪式级揭晓）、`--ease-spring`（落定回弹）、`--dur-1..5`（0.14/0.22/0.34/0.55/0.9s）。全站时长与缓动只从此出，不再随手写 `0.2s ease`。
- **玻璃层**：`--veil-bg`（贴画）、`--glass-bg` / `--glass-bg-strong` / `--glass-blur` / `--glass-edge`。浮于任意背景之上时，底色透明度是唯一不可控变量（背景亮度未知），此前 HUD 药丸、浮钮、徽标各写各的 rgba，叠在同一张画上明度不一。
- **层次**：在既有 `--shadow-glow-sm/-lift/-panel/-seal` 外补 `--shadow-glass`（浮钮）、`--shadow-inset-page`（卷页内框）、`--shadow-raise`。
- **选中语义**：`--select` / `--select-bright` / `--select-bg`。全站「当前选中」统一走金色，朱砂只留给印、危急与落定反馈。

### 新增/改动组件

- **收藏刻盘** `.cs-dial`：conic 进度环取代原先的 3px 细线 + emoji 前缀。0% 时细线几乎不可见，整块明度发灰，撑不起收集钩子；刻盘的占比本身就是图形。
- **HUD 控件簇** `.vn-hud-ctl`：「图 / ☰」两枚圆钮共一块玻璃底、中隔细线。
- **粘性操作条** `.start-bar`：`position: sticky` + 渐隐背衬，供 AI 模式长表单使用。
- **动作卡** `.action-card`：AI 生成 / 导入两张卡与海报卡同吃 `aspect-ratio: 1/1`，卡阵才是一块完整方格；头图用「拟 / 入」两枚裸字（钤印词汇）取代 emoji。
- **命途珠** `.vn-path-track::after`：菱形珠随 `--fill` 滑到当前进度处，进度因此是个位置而非百分比。`--fill` 改注入在 `.vn-path` 上，填充段与珠子共用同一个量。

### 三条易踩的坑（均已实机复现并修）

1. **`overflow-y:auto` 会把 `overflow-x` 从 `visible` 计算成 `auto`。** 选项悬停右移 2px，顶出容器右缘即长出一条永远滚不动的横向滚动条——表现为卷文底部一条金色横条。修法是给容器留等量横向内距（`.vn-panel .choices { padding-right: 3px }`），而不是加 `overflow-x: hidden`（那会把位移部分切掉）。
2. **`backdrop-filter` 使元素自成层叠上下文，并按 `z-index: 0` 参与父级排序。** `.vn-hud-ctl` 用了 `backdrop-filter` 后，簇内下拉面板的 `z-index: 31` 被困在簇内出不来，与同样用了 `backdrop-filter` 的 `.vn-vitals` 站成平手，最终由 DOM 先后决定——而命数行在后，菜单一开就被药丸压住半截。凡用 `backdrop-filter` 且内含浮层的容器，必须显式 `position: relative; z-index: N`。
3. **`button:hover:not(:disabled)` 的特异度是 (0,2,1)，高于绝大多数「无底控件」的类选择器 (0,1,1)。** 全局悬停一旦加底色，页签、语言钮、菜单项背后就会浮出色块。基元悬停因此只提 `border-color`，填色反馈交给各自的按钮族。

### 其它实机修正

- 首页 hero 尺寸改为 `min(520px, 94vw, 58vh)`：原先只随宽度缩放，宽而矮的视口上罗盘仍吃满 520px，剧本卡被压到折叠线以下。
- 命书阁整页 `min-height: 100dvh` + 内容区 `margin-block: auto`：三个页签内容长短悬殊，顶对齐会让空签页下半屏死黑。用 auto 外边距而非 `justify-content: center`，内容过长时外边距归零，不会把顶部顶出视口。
- 开局页模式卡 / 身份卡选中态由朱砂改为金色，朱砂只留给角印「择」：同屏两张朱砂大块读起来像两处告警。
- 卦象 `.card-rune` 去框、移到右下角、降透明度：卦象 `☰` 本身就是三条横线，外框一加即与「菜单」按钮原型重合，挪位置治不了，只能让它退成纹样。
- 结局页 `.ach-unlock-label` 独占一行：原先与徽章挤在同一行，导致首行左对齐、末行落单徽章却居中，两行轴线对不上。

### 已知遗留

- `xian`（缥缈仙途）未设 `maxTurns`，因而**完全不渲染命途进度条**（10 个内置剧本里仅此一个）。属剧本内容/节奏决策，不在视觉改版范围内，按红线不擅自改。
- `--font-scale` 仍只缩放阅读类文字；本轮新增的 chrome 类文字一律固定字号，契约未变。

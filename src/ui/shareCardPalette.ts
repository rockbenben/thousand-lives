// 分享卡画布色单一来源 —— canvas 2D 用不了 CSS 变量，这里镜像 DESIGN.md token（审计 U-22）。
// 改 token 需两侧同步；画布金与 --gold 同源（F-16 A，原 #c9a05c 已并入）。
export const CARD = {
  bg: '#0c1126', // 画布专用深靛（较 --ink-9 略亮，保证导出图对比）
  gold: '#cba85a', // = --gold / {colors.primary}
  goldBright: '#ecd28f', // = --gold-bright
  goldVeil: 'rgba(203,168,90,0.18)',
  goldEdge: 'rgba(203,168,90,0.55)',
  seal: '#e0704e', // = --seal-bright / danger
  jade: '#6fae9b', // = --success
  text: '#dcdcef', // = --paper
  textDim: '#b4b8d8', // = --paper-dim
  muted: '#868bb2', // = --muted
  hairline: '#28326a', // = --hairline
  onSeal: '#f3e4c8', // = --on-seal（兼二维码浅底）
  shade: 'rgba(0,0,0,0.85)',
  veil: (a: number) => `rgba(12,17,38,${a})`,
} as const

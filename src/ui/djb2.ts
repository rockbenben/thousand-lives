// djb2：把文本映射为稳定的 ASCII 文件名片段（与 game-docs 生成脚本/清单一致）。
// 配图 id 与展示文案解耦：endings.art / localEvent.art 缺省时回退到本 hash，
// 故 nodeArt / endingArt 共用同一实现，改文案不丢图。
export function djb2(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

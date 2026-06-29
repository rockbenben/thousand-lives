/** Centralized user-facing strings — single source of truth for i18n and consistency. */

export const msg = {
  /** Error: no API config found */
  noApiConfig: '未找到 API 配置，请回到卷首重新设置',

  /** Import error prefix */
  importFailed: '剧本导入失败',

  /** Save import error prefix */
  saveImportFailed: '存档导入失败',

  /** Clipboard copy failed */
  copyFailed: '复制失败：浏览器拒绝了剪贴板访问，请手动选择文本复制',

  /** Share card generation failed */
  shareCardFailed: '命运卡生成失败，可改用「复制文字版」分享',

  /** Provider hint when baseURL is empty */
  noBaseUrl: '自填地址',

  /** Lightbox / art thumbnail tooltip */
  clickToEnlarge: '点击看全图',

  /** Lightbox aria-label */
  viewLargeImage: '查看大图',

  /** Node art thumbnail aria-label */
  viewNodeArt: '查看此节点配图',

  /** Save-to-slot failed (browser storage quota full) */
  saveSlotFailed: '存档失败：浏览器存储空间不足，可在命书阁删除旧存档后重试。',

  /** Fate card failed to generate (share button toast) */
  shareFailed: '命运卡生成失败',
} as const
